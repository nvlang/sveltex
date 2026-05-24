// External scanner for the SvelTeX (`.sveltex`) tree-sitter grammar.
//
// `grammar.js` parses only the `.sveltex` top-level structure and leaves the
// embedded languages to injections. The constructs below cannot be expressed
// with the LR core and are resolved here instead:
//
//   * `_frontmatter_start`     — a `---` / `+++` line opening frontmatter,
//   * `_frontmatter_end`       — a `---` / `+++` line closing frontmatter,
//   * `_frontmatter_body`      — the lines between the two fences,
//   * `_markdown_chunk`        — a maximal run of ordinary Markdown content
//                                that stops right before the next
//                                `.sveltex`-special construct (or EOF),
//   * `_verbatim_tex_content`  — the body of a `<tex>/<latex>/<tikz>` env,
//   * `_verbatim_plain_content`— the body of a `<verb>/<verbatim>` env:
//                                everything up to the matching `</tag>`,
//   * `_inline_math_content`   — the body of `$ ... $`,
//   * `_display_math_content`  — the body of `$$ ... $$`,
//   * `_svelte_expression_body`— the body of `{ ... }` (excluding the
//                                braces, which the LR grammar matches),
//   * `_each_iterable`         — `{#each ITERABLE as …}` up to ` as `,
//   * `_each_binding`          — `… as BINDING[, INDEX][ (KEY)]}` binding,
//   * `_each_key`              — `… (KEY)}` key expression inside parens,
//   * `_snippet_params`        — `{#snippet name(PARAMS)}` inside parens,
//   * `_await_promise`         — `{#await PROMISE[ then|catch BINDING]}`.
//
// The scanner is stateless between tokens (no `serialize`/`deserialize`
// payload), which keeps it trivially correct under tree-sitter's speculative
// parsing: every decision is recomputed from the input. tree-sitter only
// marks `_frontmatter_start` valid in the document's initial parse state, so
// the scanner need not separately verify that it sits at byte offset 0.

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>

// Token ids — must match the order of the `externals` array in `grammar.js`.
enum TokenType {
    FRONTMATTER_START,
    FRONTMATTER_END,
    FRONTMATTER_BODY,
    VERBATIM_TEX_CONTENT,
    VERBATIM_PLAIN_CONTENT,
    INLINE_MATH_CONTENT,
    DISPLAY_MATH_CONTENT,
    MARKDOWN_CHUNK,
    SVELTE_EXPRESSION_BODY,
    ELEMENT_ATTRIBUTES,
    EACH_ITERABLE,
    EACH_BINDING,
    EACH_KEY,
    SNIPPET_PARAMS,
    AWAIT_PROMISE,
    ERROR_SENTINEL,
};

// Verbatim environment tag names. Kept in sync with `grammar.js`'s
// `TEX_VERBATIM_TAGS` / `PLAIN_VERBATIM_TAGS`. Matching is case-sensitive
// here; the listed capitalised variants cover the common spellings.
static const char *const VERBATIM_TAGS[] = {
    "tex",  "latex",    "tikz", "TeX",      "LaTeX", "TikZ",
    "verb", "verbatim", "Verb", "Verbatim",
};
static const unsigned VERBATIM_TAG_COUNT =
    sizeof(VERBATIM_TAGS) / sizeof(VERBATIM_TAGS[0]);

// ── Low-level helpers ────────────────────────────────────────────────────

static inline bool is_eof(TSLexer *lexer) { return lexer->eof(lexer); }

static inline void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static inline bool is_tag_name_char(int32_t c) {
    // SvelTeX tag names match `[a-zA-Z][-.:0-9_a-zA-Z]*` (see the VS Code
    // extension's settings docs). This predicate covers the trailing chars.
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
           (c >= '0' && c <= '9') || c == '-' || c == '.' || c == ':' ||
           c == '_';
}

static inline bool is_space_or_tab(int32_t c) {
    return c == ' ' || c == '\t';
}

// Consumes a `\n` or `\r\n` line ending. Returns whether one was consumed.
static bool consume_line_ending(TSLexer *lexer) {
    if (lexer->lookahead == '\n') {
        advance(lexer);
        return true;
    }
    if (lexer->lookahead == '\r') {
        advance(lexer);
        if (lexer->lookahead == '\n') advance(lexer);
        return true;
    }
    return false;
}

// Returns whether `name` is one of the configured verbatim tags.
static bool is_verbatim_tag(const char *name) {
    for (unsigned i = 0; i < VERBATIM_TAG_COUNT; i++) {
        if (strcmp(name, VERBATIM_TAGS[i]) == 0) return true;
    }
    return false;
}

// Forward declaration: case-insensitive equality of an already-read tag name
// against a keyword (defined with the `<script>`/`<style>` helpers below).
static bool eq_keyword_ci(const char *name, const char *keyword);

// ── Tag look-ahead / classification ──────────────────────────────────────
//
// Classification of what a `<` in the Markdown stream begins. Used by
// `scan_markdown_chunk` to decide whether (and how) to stop.
enum TagKind {
    TAG_NONE,        // not a tag start — ordinary `<` text (`a < b`, `<3`, …)
    TAG_VERBATIM,    // a verbatim environment open tag (`<tex …>`, `<verb>`)
    TAG_SCRIPT,      // `<script …>` — opaque block, skip wholesale
    TAG_STYLE,       // `<style …>`  — opaque block, skip wholesale
    TAG_ELEMENT,     // a plain HTML/Svelte element open/self-closing tag
    TAG_ELEMENT_CLOSE,  // a plain element close tag `</name>`
};
//
// At a `<`, classify what follows. The lexer's lookahead is the `<`. This
// CONSUMES the `<` (+ optional `/`) and the tag name as scratch (the caller has
// already `mark_end`-ed the boundary at the `<`), leaving the cursor at the
// char after the name. Returns the classification.
//
// The first char of a tag name must be an ASCII letter (`[A-Za-z]`). This is
// the key guard against false positives in prose: `a < b`, `1<2`, `x <- y` and
// `<3` all have a non-letter after the `<` (or `</`) and so classify as
// TAG_NONE — they stay inside the Markdown run.
// Lookahead from just after a tag name: does a well-formed terminator `>`
// appear before a blank line or EOF? An (inline) HTML/Svelte tag may span
// several lines but never contains a blank line, so a `<` whose tag has no
// terminator is prose, not a tag — declining to carve it keeps an unclosed
// `<foo` as ordinary text instead of producing a `MISSING ">"` error node
// that runs to EOF. Steps over quoted strings and brace-balanced `{…}` so a
// `>` inside them is not mistaken for the terminator and a newline inside
// them does not count toward a blank line. Pure scratch lookahead: the caller
// has already `mark_end`ed the chunk at `<`, so advancing here cannot change
// the emitted token.
static bool tag_has_terminator(TSLexer *lexer) {
    bool blank_pending = false;  // a newline seen with only whitespace since
    for (;;) {
        if (is_eof(lexer)) return false;
        int32_t c = lexer->lookahead;
        if (c == '>') return true;
        if (c == '"' || c == '\'') {
            int32_t q = c;
            advance(lexer);
            while (!is_eof(lexer) && lexer->lookahead != q) advance(lexer);
            if (!is_eof(lexer)) advance(lexer);  // closing quote
            blank_pending = false;
            continue;
        }
        if (c == '{') {
            unsigned depth = 0;
            for (;;) {
                if (is_eof(lexer)) break;
                int32_t b = lexer->lookahead;
                if (b == '{') { depth++; advance(lexer); continue; }
                if (b == '}') {
                    advance(lexer);
                    if (depth <= 1) break;
                    depth--;
                    continue;
                }
                if (b == '"' || b == '\'' || b == '`') {
                    int32_t q = b;
                    advance(lexer);
                    while (!is_eof(lexer) && lexer->lookahead != q) advance(lexer);
                    if (!is_eof(lexer)) advance(lexer);
                    continue;
                }
                advance(lexer);
            }
            blank_pending = false;
            continue;
        }
        if (c == '\n') {
            if (blank_pending) return false;  // blank line — not a tag
            blank_pending = true;
            advance(lexer);
            continue;
        }
        if (c == '\r' || c == ' ' || c == '\t') {
            advance(lexer);
            continue;
        }
        blank_pending = false;
        advance(lexer);
    }
}

static enum TagKind classify_tag_at_lt(TSLexer *lexer, char *out_name,
                                       unsigned out_cap) {
    advance(lexer);  // consume '<'
    bool closing = false;
    if (lexer->lookahead == '/') {
        closing = true;
        advance(lexer);
    }
    int32_t first = lexer->lookahead;
    if (!((first >= 'a' && first <= 'z') || (first >= 'A' && first <= 'Z'))) {
        out_name[0] = '\0';
        return TAG_NONE;
    }
    unsigned len = 0;
    out_name[len++] = (char)first;
    advance(lexer);
    while (len + 1 < out_cap && is_tag_name_char(lexer->lookahead)) {
        out_name[len++] = (char)lexer->lookahead;
        advance(lexer);
    }
    out_name[len] = '\0';

    // A real tag name never *ends* in a `-`, `.` or `:` separator; rejecting
    // these rules out `<https://…>` autolinks (name would be `https:` followed
    // by `/`) and similar prose containing a `<word:`.
    char last = out_name[len - 1];
    if (last == '-' || last == '.' || last == ':') return TAG_NONE;

    // The char after the name must plausibly continue a tag.
    int32_t after = lexer->lookahead;
    bool plausible = after == '>' || after == ' ' || after == '\t' ||
                     after == '\r' || after == '\n' || after == '/';
    if (!plausible) return TAG_NONE;

    if (is_verbatim_tag(out_name)) {
        // Verbatim *open* tags are their own construct; a verbatim *close* tag
        // is consumed by the verbatim body scanner, never reached here. Only
        // an opening verbatim tag should stop the chunk as TAG_VERBATIM.
        return closing ? TAG_NONE : TAG_VERBATIM;
    }
    if (!closing && eq_keyword_ci(out_name, "script")) return TAG_SCRIPT;
    if (!closing && eq_keyword_ci(out_name, "style")) return TAG_STYLE;

    // Only carve a plain element tag out of the Markdown stream when it is
    // actually well-formed — i.e. a terminating `>` follows before any blank
    // line or EOF. Otherwise a stray `<word` in prose (or a genuinely
    // unterminated tag) would become an `html_open_tag` with a `MISSING ">"`
    // error spanning to EOF; declining here leaves it as ordinary text.
    if (!tag_has_terminator(lexer)) return TAG_NONE;
    return closing ? TAG_ELEMENT_CLOSE : TAG_ELEMENT;
}

// ── Frontmatter ──────────────────────────────────────────────────────────
//
// A frontmatter fence is a line consisting solely of `---` or `+++` (the
// `---` form may carry a trailing language keyword on the opening fence; the
// keyword itself is a separate immediate token in `grammar.js`). The scanner
// emits three tokens:
//
//   * FRONTMATTER_START — the opening fence (just the `---`/`+++`),
//   * FRONTMATTER_BODY  — every line up to, but excluding, the closing fence,
//   * FRONTMATTER_END   — the closing fence line, line ending included.

// Scans the opening `---` / `+++`. Only the three fence characters are
// consumed; a trailing `yaml`/`toml`/`json` keyword (if any) is left for the
// grammar's immediate token.
static bool scan_frontmatter_start(TSLexer *lexer) {
    int32_t fence = lexer->lookahead;
    if (fence != '-' && fence != '+') return false;
    for (int i = 0; i < 3; i++) {
        if (lexer->lookahead != fence) return false;
        advance(lexer);
    }
    lexer->result_symbol = FRONTMATTER_START;
    lexer->mark_end(lexer);
    return true;
}

// Returns whether the current line (lexer at its first column) consists
// solely of a frontmatter language keyword (`yaml`/`toml`/`json`) followed by
// optional spaces/tabs and a line ending. This is the keyword that may follow
// the *opening* `---` fence; the body scanner must decline it so the grammar's
// dedicated `frontmatter_language` token can match it instead. Consumes only
// scratch input; the caller controls `mark_end`.
static bool line_is_language_keyword(TSLexer *lexer) {
    static const char *const KEYWORDS[] = {"yaml", "toml", "json"};
    char word[8];
    unsigned len = 0;
    while (len + 1 < sizeof(word) && lexer->lookahead >= 'a' &&
           lexer->lookahead <= 'z') {
        word[len++] = (char)lexer->lookahead;
        advance(lexer);
    }
    word[len] = '\0';
    bool match = false;
    for (unsigned i = 0; i < 3; i++) {
        if (strcmp(word, KEYWORDS[i]) == 0) {
            match = true;
            break;
        }
    }
    if (!match) return false;
    while (is_space_or_tab(lexer->lookahead)) advance(lexer);
    return lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
           is_eof(lexer);
}

// Returns whether the current line (lexer at its first column) is a closing
// frontmatter fence: exactly `---` or `+++` optionally followed by spaces or
// tabs, then a line ending or EOF. Does not consume input the caller keeps;
// the caller controls `mark_end`.
static bool line_is_fence(TSLexer *lexer) {
    int32_t fence = lexer->lookahead;
    if (fence != '-' && fence != '+') return false;
    for (int i = 0; i < 3; i++) {
        if (lexer->lookahead != fence) return false;
        advance(lexer);
    }
    while (is_space_or_tab(lexer->lookahead)) advance(lexer);
    return lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
           is_eof(lexer);
}

// Scans the closing fence line, line ending included so the frontmatter node
// ends cleanly on a line boundary. The lexer starts at the fence's first
// column (the body scanner stops there).
static bool scan_frontmatter_end(TSLexer *lexer) {
    int32_t fence = lexer->lookahead;
    if (fence != '-' && fence != '+') return false;
    for (int i = 0; i < 3; i++) {
        if (lexer->lookahead != fence) return false;
        advance(lexer);
    }
    while (is_space_or_tab(lexer->lookahead)) advance(lexer);
    if (!is_eof(lexer) && !consume_line_ending(lexer)) return false;
    lexer->result_symbol = FRONTMATTER_END;
    lexer->mark_end(lexer);
    return true;
}

// Scans the body: every line up to, but excluding, the closing fence. An
// unterminated frontmatter block consumes to EOF and still yields a body so a
// partial document parses into a stable tree.
//
// The token end is `mark_end`-ed at the start of each line *before* probing
// it for a fence: if the line is the closing fence, that marked position
// (line start) is exactly where the body must end, and `line_is_fence`'s own
// advances past the fence are left as scratch. On EOF the end is re-marked at
// the true cursor.
static bool scan_frontmatter_body(TSLexer *lexer) {
    lexer->result_symbol = FRONTMATTER_BODY;
    bool consumed = false;
    bool first_line = true;

    for (;;) {
        if (is_eof(lexer)) {
            // End the body at the current cursor (the marked end still sits
            // at the start of the last consumed line otherwise).
            lexer->mark_end(lexer);
            break;
        }
        // At the start of a line: mark here, then classify the line. The
        // first character is enough to pick the right probe — `-`/`+` can
        // only begin a closing fence, `a`–`z` can only begin the opening
        // fence's language keyword — and the probes are mutually exclusive,
        // so exactly one runs and the line-start `mark_end` stays valid for a
        // fence stop.
        lexer->mark_end(lexer);
        int32_t first = lexer->lookahead;
        if (first == '-' || first == '+') {
            if (line_is_fence(lexer)) break;
        } else if (first_line && first >= 'a' && first <= 'z') {
            // The very first body line might be the opening fence's language
            // keyword (`---toml`). Decline so the grammar's dedicated
            // `frontmatter_language` immediate token can match it.
            if (line_is_language_keyword(lexer)) return false;
        }
        first_line = false;
        // An ordinary body line — consume the rest of it (a probe above may
        // have advanced the cursor partway through) plus its line ending.
        while (!is_eof(lexer) && lexer->lookahead != '\n' &&
               lexer->lookahead != '\r') {
            advance(lexer);
        }
        consume_line_ending(lexer);
        consumed = true;
    }

    return consumed;
}

// ── Markdown code skipping ───────────────────────────────────────────────
//
// SvelTeX treats fenced code blocks and inline code spans as opaque: a `$`,
// `<tag>` or `\(` inside them is *not* a math/verbatim delimiter (a `$state`
// rune inside a ```svelte block is the canonical example). The Markdown-chunk
// scanner must therefore skip over code the same way SvelTeX's escaper does,
// so those characters stay inside the chunk and reach the `markdown` grammar
// (which highlights the code and injects the code language) rather than being
// mis-tokenised as `.sveltex` constructs.
//
// These helpers are called from `scan_markdown_chunk` with all of their
// consumed input *kept* (they are not scratch): the chunk legitimately
// contains the code.

// Consumes a fenced code block whose `open_len`-long opening fence (of
// character `tick`, ` ` ` ` or `~`) has *already* been consumed by the
// caller, but whose info-string line has not. On return the rest of the
// opening line, the content, and the closing fence (or EOF) are all consumed.
//
// The closing fence is a line whose first non-indent run is at least
// `open_len` characters of the same `tick`.
static void skip_fenced_code_block_after_open(TSLexer *lexer, int32_t tick,
                                              unsigned open_len) {
    // Consume the rest of the opening fence line (the info string).
    while (!is_eof(lexer) && lexer->lookahead != '\n' &&
           lexer->lookahead != '\r') {
        advance(lexer);
    }
    if (!consume_line_ending(lexer)) return;

    for (;;) {
        if (is_eof(lexer)) return;
        // Skip up to three leading spaces of indent.
        unsigned indent = 0;
        while (indent < 3 && lexer->lookahead == ' ') {
            advance(lexer);
            indent++;
        }
        if (lexer->lookahead == tick) {
            unsigned close_len = 0;
            while (lexer->lookahead == tick) {
                advance(lexer);
                close_len++;
            }
            if (close_len >= open_len) {
                // A closing fence — consume the rest of its line and stop.
                while (!is_eof(lexer) && lexer->lookahead != '\n' &&
                       lexer->lookahead != '\r') {
                    advance(lexer);
                }
                consume_line_ending(lexer);
                return;
            }
        }
        // Not a closing fence — consume the rest of the line.
        while (!is_eof(lexer) && lexer->lookahead != '\n' &&
               lexer->lookahead != '\r') {
            advance(lexer);
        }
        if (!consume_line_ending(lexer)) return;
    }
}

// Consumes an inline code span whose `open_len`-long opening backtick run has
// *already* been consumed by the caller. On return the content and the
// matching closing run are consumed. A code span is closed by a backtick run
// of exactly `open_len`. If none is found before EOF the cursor stops at EOF,
// so the backticks simply degrade to literal text inside the chunk.
static void skip_inline_code_span_after_open(TSLexer *lexer,
                                             unsigned open_len) {
    for (;;) {
        if (is_eof(lexer)) return;
        if (lexer->lookahead == '`') {
            unsigned run = 0;
            while (lexer->lookahead == '`') {
                advance(lexer);
                run++;
            }
            if (run == open_len) return;  // matched closing run
            // A run of a different length is part of the span content.
            continue;
        }
        advance(lexer);
    }
}

// ── Svelte `<script>` / `<style>` and mustache-tag skipping ──────────────
//
// SvelTeX's escaper also treats `<script>` / `<style>` blocks and `{ … }`
// mustache tags as opaque (see `docs/.../escaping.md`): a `$` inside them is
// JS/CSS, not math (`import x from '$lib/…'` is the canonical example). The
// Markdown-chunk scanner skips them so the embedded grammars — not the
// `.sveltex` math rules — handle their contents.

// Case-insensitive equality of an already-read tag name against `keyword`.
static bool eq_keyword_ci(const char *name, const char *keyword) {
    const char *a = name;
    const char *b = keyword;
    for (; *a && *b; a++, b++) {
        int ca = (*a >= 'A' && *a <= 'Z') ? *a + 32 : *a;
        if (ca != *b) return false;
    }
    return *a == '\0' && *b == '\0';
}

// Case-insensitively compares the upcoming input to `keyword`, consuming the
// characters as it goes. Returns whether they all matched. The caller has
// already consumed `<`; this is used to recognise `script` / `style`.
static bool match_keyword_ci(TSLexer *lexer, const char *keyword) {
    for (const char *k = keyword; *k; k++) {
        int32_t c = lexer->lookahead;
        int32_t lower = (c >= 'A' && c <= 'Z') ? c + 32 : c;
        if (lower != (int32_t)*k) return false;
        advance(lexer);
    }
    return true;
}

// Consumes a `<script …>…</script>` or `<style …>…</style>` element whose
// opening `<` *and* tag name have already been consumed by the caller (the
// caller passes which `tag` was matched). The rest of the opening tag, the
// body and the matching `</tag>` (or EOF) are consumed. A self-closing
// `<script/>` is handled too.
static void skip_script_or_style_after_name(TSLexer *lexer,
                                            const char *tag) {
    // Consume the remainder of the opening tag, up to and including `>`.
    for (;;) {
        if (is_eof(lexer)) return;
        int32_t c = lexer->lookahead;
        if (c == '>') {
            advance(lexer);
            break;
        }
        if (c == '/') {
            advance(lexer);
            if (lexer->lookahead == '>') {
                advance(lexer);
                return;  // self-closing `<script/>` — no body
            }
            continue;
        }
        advance(lexer);
    }
    // Consume the body up to the matching `</tag>` (case-insensitive).
    for (;;) {
        if (is_eof(lexer)) return;
        if (lexer->lookahead == '<') {
            advance(lexer);
            if (lexer->lookahead == '/') {
                advance(lexer);
                if (match_keyword_ci(lexer, tag)) {
                    // Skip optional whitespace then require `>`.
                    while (lexer->lookahead == ' ' ||
                           lexer->lookahead == '\t' ||
                           lexer->lookahead == '\r' ||
                           lexer->lookahead == '\n') {
                        advance(lexer);
                    }
                    if (lexer->lookahead == '>') {
                        advance(lexer);
                        return;
                    }
                }
            }
            continue;
        }
        advance(lexer);
    }
}

// Skips a string or template literal starting at the current quote char.
// Returns when the closing quote has been consumed, or on EOF. Sets
// `*made_progress` to true if any chars were consumed.
static void skip_string_literal(TSLexer *lexer, int32_t quote,
                                bool *made_progress) {
    advance(lexer); // opening quote
    *made_progress = true;
    for (;;) {
        if (is_eof(lexer)) return;
        int32_t s = lexer->lookahead;
        if (s == '\\') {
            advance(lexer);
            if (!is_eof(lexer)) advance(lexer);
            continue;
        }
        if (s == quote) {
            advance(lexer);
            return;
        }
        advance(lexer);
    }
}

// ── `_svelte_expression_body` ────────────────────────────────────────────
//
// Consumes the body of a `{ … }` mustache expression. The cursor starts
// just past the opening `{` (the LR grammar matches the literal `{` itself)
// and stops just before the matching `}`, so the LR grammar can match the
// `}` after this token. Nested braces are tracked so `{ {x} }` works; an
// unbalanced expression consumes to EOF. Strings and template literals
// inside the expression are skipped verbatim so a `}` inside `"..."` does
// not end the body prematurely.
static bool scan_svelte_expression_body(TSLexer *lexer) {
    lexer->result_symbol = SVELTE_EXPRESSION_BODY;
    bool consumed = false;
    unsigned depth = 1; // inside the opening `{` already consumed by the LR grammar

    for (;;) {
        if (is_eof(lexer)) {
            // Unmatched — keep what we've collected so the partial parse is
            // still useful for highlighting.
            lexer->mark_end(lexer);
            return consumed;
        }
        int32_t c = lexer->lookahead;
        if (c == '{') {
            depth++;
            advance(lexer);
            consumed = true;
            continue;
        }
        if (c == '}') {
            if (depth == 1) {
                // Matching close: stop here so the LR grammar can consume
                // the `}` as part of the `svelte_expression` rule.
                lexer->mark_end(lexer);
                return consumed;
            }
            depth--;
            advance(lexer);
            consumed = true;
            continue;
        }
        if (c == '\'' || c == '"' || c == '`') {
            // Skip a string / template literal verbatim.
            int32_t quote = c;
            advance(lexer);
            consumed = true;
            for (;;) {
                if (is_eof(lexer)) {
                    lexer->mark_end(lexer);
                    return consumed;
                }
                int32_t s = lexer->lookahead;
                if (s == '\\') {
                    advance(lexer);
                    if (!is_eof(lexer)) advance(lexer);
                    continue;
                }
                if (s == quote) {
                    advance(lexer);
                    break;
                }
                advance(lexer);
            }
            continue;
        }
        advance(lexer);
        consumed = true;
    }
}

// ── `{#each}`-head scanners ──────────────────────────────────────────────
//
// `{#each iterable as binding[, index][ (key)]}` decomposes the head into
// four named sub-bodies (`iterable`, `binding`, `key`) plus a plain
// identifier (`index`). The cursor for each scanner starts just past the
// previous LR token (the `{#each ` opener for `iterable`, the literal
// ` as ` for `binding`, etc.) and stops *just before* the next literal
// token the LR grammar matches (` as ` / `,` / `(` / `}` for the body
// scanners, `)` for the key scanner).
//
// Why custom scanners rather than reusing `scan_svelte_expression_body`:
// the body of `{ … }` stops at the matching `}` and only that; the each
// head needs different stop conditions depending on which sub-body is
// being scanned. All four respect JS string-literal escaping and
// brace/bracket nesting so the boundaries inside an embedded object or
// string don't fire prematurely.

// Common helper: returns true iff the cursor is positioned at a
// whitespace + "as" + whitespace sequence (matching the LR `_each_as`
// token). Does not advance the cursor — uses the lexer's lookahead only.
// vscode-textmate-style: peeks ahead by `advance`+save? `TSLexer` exposes
// only single-char `lookahead`, so we have to actually advance and rely on
// the caller having `mark_end`ed the boundary first.
static bool starts_as_keyword(TSLexer *lexer) {
    // Caller must be at the position to test.
    if (lexer->lookahead != ' ' && lexer->lookahead != '\t') return false;
    // Mark the boundary before we walk forward so we can return false
    // without consuming anything (the caller's last `mark_end` is what
    // tree-sitter sees if we don't `mark_end` again).
    advance(lexer);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
        advance(lexer);
    }
    if (lexer->lookahead != 'a') return false;
    advance(lexer);
    if (lexer->lookahead != 's') return false;
    advance(lexer);
    if (lexer->lookahead != ' ' && lexer->lookahead != '\t') return false;
    return true;
}

// `_each_iterable`: scan a JS expression up to whichever of the three
// boundaries comes first at outer brace/paren/bracket-depth 0:
//
//   * ` as ` — `{#each iterable as binding}` form;
//   * `,`    — `{#each iterable, index}` bindingless form with an index;
//   * `}`    — `{#each iterable}` bindingless N-times form.
//
// Cursor stops just before the boundary character. Inner `,` / `}` etc.
// inside an `[]` / `()` / `{}` literal don't trigger because of the depth
// tracking, and inner `as` inside a TS-style `[items as Type]` is
// likewise skipped.
static bool scan_each_iterable(TSLexer *lexer) {
    lexer->result_symbol = EACH_ITERABLE;
    bool consumed = false;
    unsigned brace_depth = 0; // `{`/`}`
    unsigned paren_depth = 0; // `(`/`)`
    unsigned bracket_depth = 0; // `[`/`]`

    for (;;) {
        if (is_eof(lexer)) {
            lexer->mark_end(lexer);
            return consumed;
        }
        // Only check for the boundary keywords/punct at outer depth — an
        // inner `as` / `,` is part of the expression.
        bool at_outer = brace_depth == 0 && paren_depth == 0 && bracket_depth == 0;
        if (at_outer) {
            lexer->mark_end(lexer);
            if (starts_as_keyword(lexer)) return consumed;
        }
        int32_t c = lexer->lookahead;
        if (at_outer && c == ',') {
            lexer->mark_end(lexer);
            return consumed;
        }
        if (c == '{') { brace_depth++; advance(lexer); consumed = true; continue; }
        if (c == '}') {
            if (brace_depth == 0) {
                // `{#each iterable}` (N-times) — the iterable ends at the
                // enclosing `}`. Leave the `}` for the LR grammar.
                lexer->mark_end(lexer);
                return consumed;
            }
            brace_depth--; advance(lexer); consumed = true; continue;
        }
        if (c == '(') { paren_depth++; advance(lexer); consumed = true; continue; }
        if (c == ')') { if (paren_depth > 0) paren_depth--; advance(lexer); consumed = true; continue; }
        if (c == '[') { bracket_depth++; advance(lexer); consumed = true; continue; }
        if (c == ']') { if (bracket_depth > 0) bracket_depth--; advance(lexer); consumed = true; continue; }
        if (c == '\'' || c == '"' || c == '`') {
            skip_string_literal(lexer, c, &consumed);
            continue;
        }
        advance(lexer);
        consumed = true;
    }
}

// `_each_binding`: scan a binding pattern (identifier, destructuring,
// etc.) that ends at `,` (introducing the index), `(` (introducing the
// key), or `}` (closing the head). All three stop conditions only fire
// at outer depth.
static bool scan_each_binding(TSLexer *lexer) {
    lexer->result_symbol = EACH_BINDING;
    bool consumed = false;
    unsigned brace_depth = 0;
    unsigned paren_depth = 0;
    unsigned bracket_depth = 0;

    for (;;) {
        if (is_eof(lexer)) {
            lexer->mark_end(lexer);
            return consumed;
        }
        int32_t c = lexer->lookahead;
        if (brace_depth == 0 && paren_depth == 0 && bracket_depth == 0) {
            if (c == ',' || c == '(' || c == '}') {
                lexer->mark_end(lexer);
                return consumed;
            }
        }
        if (c == '{') { brace_depth++; advance(lexer); consumed = true; continue; }
        if (c == '}') { if (brace_depth > 0) brace_depth--; advance(lexer); consumed = true; continue; }
        if (c == '(') { paren_depth++; advance(lexer); consumed = true; continue; }
        if (c == ')') { if (paren_depth > 0) paren_depth--; advance(lexer); consumed = true; continue; }
        if (c == '[') { bracket_depth++; advance(lexer); consumed = true; continue; }
        if (c == ']') { if (bracket_depth > 0) bracket_depth--; advance(lexer); consumed = true; continue; }
        if (c == '\'' || c == '"' || c == '`') {
            skip_string_literal(lexer, c, &consumed);
            continue;
        }
        advance(lexer);
        consumed = true;
    }
}

// Generic helper: scan a balanced body that ends at the matching `)`. The
// cursor starts just past the opening `(` (paren_depth=1) and stops just
// before the matching `)`. Tracks paren depth so `(foo(x))` works; tracks
// braces/brackets/strings for the same reasons as the other JS scanners.
// Used by `{#each ... (KEY)}` and `{#snippet name(PARAMS)}`.
static bool scan_paren_balanced_body(TSLexer *lexer, enum TokenType result) {
    lexer->result_symbol = result;
    bool consumed = false;
    unsigned brace_depth = 0;
    unsigned paren_depth = 1; // inside the opening `(` already
    unsigned bracket_depth = 0;

    for (;;) {
        if (is_eof(lexer)) {
            lexer->mark_end(lexer);
            return consumed;
        }
        int32_t c = lexer->lookahead;
        if (c == ')' && paren_depth == 1
            && brace_depth == 0 && bracket_depth == 0) {
            lexer->mark_end(lexer);
            return consumed;
        }
        if (c == '{') { brace_depth++; advance(lexer); consumed = true; continue; }
        if (c == '}') { if (brace_depth > 0) brace_depth--; advance(lexer); consumed = true; continue; }
        if (c == '(') { paren_depth++; advance(lexer); consumed = true; continue; }
        if (c == ')') { if (paren_depth > 0) paren_depth--; advance(lexer); consumed = true; continue; }
        if (c == '[') { bracket_depth++; advance(lexer); consumed = true; continue; }
        if (c == ']') { if (bracket_depth > 0) bracket_depth--; advance(lexer); consumed = true; continue; }
        if (c == '\'' || c == '"' || c == '`') {
            skip_string_literal(lexer, c, &consumed);
            continue;
        }
        advance(lexer);
        consumed = true;
    }
}

// Looks like ` then ` or ` catch ` (whitespace + keyword + whitespace) at
// the current cursor — same disposable-lookahead trick as
// `starts_as_keyword`. Used by `scan_await_promise` to detect the
// shorthand boundary.
static bool starts_await_keyword(TSLexer *lexer) {
    if (lexer->lookahead != ' ' && lexer->lookahead != '\t') return false;
    advance(lexer);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
        advance(lexer);
    }
    // `then` or `catch`?
    int32_t c = lexer->lookahead;
    if (c == 't') {
        advance(lexer);
        if (lexer->lookahead != 'h') return false;
        advance(lexer);
        if (lexer->lookahead != 'e') return false;
        advance(lexer);
        if (lexer->lookahead != 'n') return false;
        advance(lexer);
    } else if (c == 'c') {
        advance(lexer);
        if (lexer->lookahead != 'a') return false;
        advance(lexer);
        if (lexer->lookahead != 't') return false;
        advance(lexer);
        if (lexer->lookahead != 'c') return false;
        advance(lexer);
        if (lexer->lookahead != 'h') return false;
        advance(lexer);
    } else {
        return false;
    }
    return lexer->lookahead == ' ' || lexer->lookahead == '\t';
}

// `_await_promise`: scan a JS expression that ends either at the shorthand
// ` then ` / ` catch ` boundary or at the closing `}`. Cursor stops just
// before the matching boundary (the LR grammar consumes ` then ` /
// ` catch ` or `}` next).
static bool scan_await_promise(TSLexer *lexer) {
    lexer->result_symbol = AWAIT_PROMISE;
    bool consumed = false;
    unsigned brace_depth = 0;
    unsigned paren_depth = 0;
    unsigned bracket_depth = 0;

    for (;;) {
        if (is_eof(lexer)) {
            lexer->mark_end(lexer);
            return consumed;
        }
        if (brace_depth == 0 && paren_depth == 0 && bracket_depth == 0) {
            lexer->mark_end(lexer);
            if (starts_await_keyword(lexer)) return consumed;
        }
        int32_t c = lexer->lookahead;
        if (c == '}') {
            if (brace_depth == 0) {
                lexer->mark_end(lexer);
                return consumed;
            }
            brace_depth--; advance(lexer); consumed = true; continue;
        }
        if (c == '{') { brace_depth++; advance(lexer); consumed = true; continue; }
        if (c == '(') { paren_depth++; advance(lexer); consumed = true; continue; }
        if (c == ')') { if (paren_depth > 0) paren_depth--; advance(lexer); consumed = true; continue; }
        if (c == '[') { bracket_depth++; advance(lexer); consumed = true; continue; }
        if (c == ']') { if (bracket_depth > 0) bracket_depth--; advance(lexer); consumed = true; continue; }
        if (c == '\'' || c == '"' || c == '`') {
            skip_string_literal(lexer, c, &consumed);
            continue;
        }
        advance(lexer);
        consumed = true;
    }
}

// ── `_element_attributes` ────────────────────────────────────────────────
//
// Consume the attribute run of a plain element open / self-closing tag. The
// cursor starts right after the tag name (the LR grammar matched `<name`) and
// stops just before the closing `>` or `/>` (which the LR grammar matches
// next). Quoted attribute values (`"..."` / `'...'`) and Svelte mustache
// attributes / shorthands (`{...}`, possibly nested) are stepped over so a `>`
// or `/` inside them does not end the tag early (`<div title="a>b">`,
// `<a href={x > y ? p : q}>`). An unterminated tag consumes to EOF.
//
// Declines (returns false) when there are no attributes — i.e. the cursor is
// already at `>` or at a `/` that begins `/>` — so the grammar's `optional`
// attribute slot is left empty and the right tag arm (open vs self-closing) is
// chosen by the following `>` / `/>` token.
static bool scan_element_attributes(TSLexer *lexer) {
    lexer->result_symbol = ELEMENT_ATTRIBUTES;
    bool consumed = false;

    for (;;) {
        if (is_eof(lexer)) break;
        int32_t c = lexer->lookahead;

        if (c == '>') {
            // End of an open tag — attributes (if any) end here.
            lexer->mark_end(lexer);
            return consumed;
        }
        if (c == '/') {
            // Could be the `/` of a self-closing `/>`. Peek: if a `>` follows,
            // the attribute run ends before the `/`. (A bare `/` not followed
            // by `>` is unusual but kept as attribute text.)
            lexer->mark_end(lexer);
            advance(lexer);  // scratch
            if (lexer->lookahead == '>') {
                // `/>` — stop before the `/` (already marked).
                return consumed;
            }
            // A lone `/` — part of the attributes; keep it.
            consumed = true;
            continue;
        }
        if (c == '"' || c == '\'') {
            skip_string_literal(lexer, c, &consumed);
            continue;
        }
        if (c == '{') {
            // A Svelte mustache attribute / shorthand. Step over a brace-
            // balanced run (respecting string literals inside) so a `>` or
            // `/` inside the expression is ignored.
            unsigned depth = 0;
            for (;;) {
                if (is_eof(lexer)) break;
                int32_t b = lexer->lookahead;
                if (b == '{') { depth++; advance(lexer); consumed = true; continue; }
                if (b == '}') {
                    advance(lexer);
                    consumed = true;
                    if (depth <= 1) break;
                    depth--;
                    continue;
                }
                if (b == '"' || b == '\'' || b == '`') {
                    skip_string_literal(lexer, b, &consumed);
                    continue;
                }
                advance(lexer);
                consumed = true;
            }
            continue;
        }
        advance(lexer);
        consumed = true;
    }

    // EOF without a closing `>` — keep what we have so the partial parse is
    // still useful.
    if (consumed) {
        lexer->mark_end(lexer);
        return true;
    }
    return false;
}

// ── `_markdown_chunk` ────────────────────────────────────────────────────
//
// Consume a maximal run of ordinary content. The run stops just before the
// next `.sveltex`-special construct:
//   * a verbatim opening tag `<tag …>` for a configured tag,
//   * a `$` (single- or double-dollar math fence),
//   * `\(` or `\[` (escaped-delimiter math).
//
// Fenced code blocks and inline code spans are skipped over wholesale (see
// the helpers above), so delimiter-like characters inside code never end the
// run.
//
// An empty result would loop forever, so it fails the token instead (which
// only happens on an empty document or when the cursor already sits on a
// boundary — both handled by the surrounding grammar).
//
// Whenever the run stops *at a boundary*, the token must end at that boundary
// — not at the cursor, which the look-ahead probes may have advanced past as
// scratch. Each boundary branch therefore `mark_end`s at the boundary and
// returns directly; only the EOF and end-of-loop paths `mark_end` at the
// cursor.
static bool scan_markdown_chunk(TSLexer *lexer) {
    lexer->result_symbol = MARKDOWN_CHUNK;
    bool consumed = false;
    // Whether the cursor is at the first column of a line (modulo indent).
    bool at_line_start = true;

    for (;;) {
        if (is_eof(lexer)) break;

        int32_t here = lexer->lookahead;

        // Fenced code block: a ``` or ~~~ run at the start of a line. Skipped
        // wholesale so its contents never end the Markdown run.
        if (at_line_start && (here == '`' || here == '~')) {
            // A fence needs at least three of the same character.
            // `skip_fenced_code_block` handles indent itself, but here the
            // cursor is already past any indent (see the space branch below).
            // Probe the run length without losing the position: only commit
            // to a fenced block for a 3+ run, otherwise treat ``` as inline.
            if (here == '`') {
                // Could be a fenced block (3+) or an inline span (any run).
                // `skip_inline_code_span` handles a 1–2 run; a 3+ run at line
                // start is a fenced block. Distinguish by counting first.
                lexer->mark_end(lexer);  // boundary fallback (unused on skip)
                unsigned run = 0;
                // The probe advances the cursor; those advances are kept text
                // regardless of the branch taken, so `consumed` is set.
                while (lexer->lookahead == '`') {
                    advance(lexer);
                    run++;
                }
                consumed = true;
                if (run >= 3) {
                    // Fenced block: consume content until the closing fence.
                    // The opening run is already consumed; resume from there.
                    skip_fenced_code_block_after_open(lexer, '`', run);
                } else {
                    // Inline span opened by a 1–2 run: find the closing run.
                    skip_inline_code_span_after_open(lexer, run);
                }
                at_line_start = false;
                continue;
            }
            // `~` only ever begins a fenced block (no inline `~` spans).
            unsigned run = 0;
            while (lexer->lookahead == '~') {
                advance(lexer);
                run++;
            }
            consumed = true;
            if (run >= 3) {
                skip_fenced_code_block_after_open(lexer, '~', run);
            }
            at_line_start = false;
            continue;
        }

        if (here == '`') {
            // An inline code span not at line start.
            unsigned run = 0;
            while (lexer->lookahead == '`') {
                advance(lexer);
                run++;
            }
            consumed = true;
            skip_inline_code_span_after_open(lexer, run);
            at_line_start = false;
            continue;
        }

        if (here == '$') {
            // A `$` always ends the Markdown run; the math rules decide
            // whether it is inline or display. The cursor is exactly at the
            // boundary, so mark and stop here.
            lexer->mark_end(lexer);
            return consumed;
        }

        if (here == '<') {
            // Classify the tag. `mark_end` first so the boundary (the `<`) is
            // the token end if the run must stop here.
            lexer->mark_end(lexer);
            // Fixed stack buffer (no heap allocation in the scanner hot path)
            // that holds the tag name for classification. 64 covers every
            // realistic verbatim / element / component name; a longer name
            // overruns the capacity, fails the "char after the name" check in
            // `classify_tag_at_lt`, and is safely treated as ordinary text
            // (TAG_NONE) rather than misclassified.
            char name[64];
            enum TagKind kind = classify_tag_at_lt(lexer, name, sizeof(name));
            if (kind == TAG_VERBATIM || kind == TAG_ELEMENT ||
                kind == TAG_ELEMENT_CLOSE) {
                // A verbatim environment or a plain element tag starts here —
                // the chunk ends at the already-marked `<` so the LR grammar
                // can match the tag. (For TAG_ELEMENT* this is the change that
                // carves `<div>` / `</div>` out of the Markdown stream.)
                //
                // Exception: if nothing has been consumed yet, the cursor is
                // *at* the tag start. Returning an empty token would loop
                // forever, so decline — the surrounding grammar then matches
                // the tag rule directly without a leading `markdown_chunk`.
                if (!consumed) return false;
                return consumed;
            }
            // `<script>` / `<style>` elements are opaque to SvelTeX; skip the
            // whole element. `classify_tag_at_lt` left the cursor right after
            // the tag name.
            if (kind == TAG_SCRIPT) {
                skip_script_or_style_after_name(lexer, "script");
                consumed = true;
                at_line_start = false;
                continue;
            }
            if (kind == TAG_STYLE) {
                skip_script_or_style_after_name(lexer, "style");
                consumed = true;
                at_line_start = false;
                continue;
            }
            // TAG_NONE: an ordinary `<` is plain Markdown text (`a < b`, `<3`).
            // The classify probe consumed the `<` (and any partial name) as
            // scratch; that scratch is now kept text, so the next iteration's
            // `mark_end` (or the final one) includes it.
            consumed = true;
            at_line_start = false;
            continue;
        }

        if (here == '{') {
            // A Svelte mustache expression is a separate top-level construct
            // (the LR grammar matches `{` + body + `}`), so the chunk ends
            // here. The cursor is exactly at the `{`, so `mark_end` pins the
            // boundary at the opening brace.
            lexer->mark_end(lexer);
            return consumed;
        }

        if (here == '\\') {
            // Could be `\(` / `\[` math, or an ordinary backslash escape.
            lexer->mark_end(lexer);
            advance(lexer);  // scratch: consume '\'
            int32_t n = lexer->lookahead;
            if (n == '(' || n == '[') {
                // Escaped-delimiter math starts here — body ends at the `\`.
                return consumed;
            }
            // Ordinary escape — keep the `\` and the next char.
            consumed = true;
            at_line_start = false;
            if (!is_eof(lexer)) advance(lexer);
            continue;
        }

        // Ordinary character. A newline puts the cursor at a line start;
        // leading spaces/tabs keep it there (so an indented fence still
        // counts as a fence opener).
        if (here == '\n' || here == '\r') {
            at_line_start = true;
        } else if (here != ' ' && here != '\t') {
            at_line_start = false;
        }
        advance(lexer);
        consumed = true;
    }

    // Reached EOF: the whole remaining input is Markdown.
    if (consumed) {
        lexer->mark_end(lexer);
        return true;
    }
    return false;
}

// ── Verbatim body scanners ───────────────────────────────────────────────
//
// Consume everything up to (but excluding) the matching `</tag>`. The closing
// tag is matched by the LR grammar. An unterminated environment consumes to
// EOF and still yields a (non-empty) body so the partial tree is stable.
//
// `lexer` starts right after the opening tag's `>`.
static bool scan_verbatim_body(TSLexer *lexer, enum TokenType result) {
    lexer->result_symbol = result;
    bool consumed = false;

    for (;;) {
        if (is_eof(lexer)) break;

        if (lexer->lookahead == '<') {
            // Mark the end *before* the `<` so a found `</tag>` is excluded
            // from the body.
            lexer->mark_end(lexer);
            advance(lexer);
            if (lexer->lookahead == '/') {
                advance(lexer);
                // See the element-tag scan above: fixed buffer sized well past
                // any verbatim tag; an over-long name simply won't match one.
                char name[64];
                unsigned len = 0;
                while (len + 1 < sizeof(name) &&
                       is_tag_name_char(lexer->lookahead)) {
                    name[len++] = (char)lexer->lookahead;
                    advance(lexer);
                }
                name[len] = '\0';
                if (len > 0 && lexer->lookahead == '>' &&
                    is_verbatim_tag(name)) {
                    // A real `</tag>` — stop, body excludes it.
                    if (consumed) return true;
                    // Zero-width body: let the grammar's `optional` body
                    // handle it by failing this token.
                    return false;
                }
            }
            // A `<` that is not a verbatim close tag: part of the body.
            consumed = true;
            continue;
        }

        advance(lexer);
        consumed = true;
    }

    // Reached EOF without a close tag.
    if (consumed) {
        lexer->mark_end(lexer);
        return true;
    }
    return false;
}

// ── Dollar-math body scanners ────────────────────────────────────────────
//
// Consume the body of `$ … $` or `$$ … $$`. The lexer starts right after the
// opening fence. The body excludes the closing fence, which the LR grammar
// matches. A `\$` is an escaped dollar and does not close the math.
static bool scan_math_body(TSLexer *lexer, enum TokenType result,
                           bool display) {
    lexer->result_symbol = result;
    bool consumed = false;

    for (;;) {
        if (is_eof(lexer)) break;

        if (lexer->lookahead == '\\') {
            // Escape: keep the backslash and the next char verbatim.
            advance(lexer);
            consumed = true;
            if (!is_eof(lexer)) advance(lexer);
            continue;
        }

        if (lexer->lookahead == '$') {
            // Potential closing fence — exclude it from the body.
            lexer->mark_end(lexer);
            advance(lexer);
            bool second_dollar = (lexer->lookahead == '$');
            if (display) {
                // `$$` closes display math; a lone `$` inside is body.
                if (second_dollar) {
                    return consumed;  // empty body -> grammar `optional`
                }
            } else {
                // A single `$` closes inline math. Even if it is the first
                // `$` of a `$$`, the body still ends here.
                return consumed;
            }
            // A lone `$` in display math: part of the body.
            consumed = true;
            continue;
        }

        advance(lexer);
        consumed = true;
    }

    if (consumed) {
        lexer->mark_end(lexer);
        return true;
    }
    return false;
}

// ── tree-sitter entry points ─────────────────────────────────────────────

void *tree_sitter_sveltex_external_scanner_create(void) { return NULL; }

void tree_sitter_sveltex_external_scanner_destroy(void *payload) {
    (void)payload;
}

unsigned tree_sitter_sveltex_external_scanner_serialize(void *payload,
                                                        char *buffer) {
    (void)payload;
    (void)buffer;
    return 0;  // stateless
}

void tree_sitter_sveltex_external_scanner_deserialize(void *payload,
                                                      const char *buffer,
                                                      unsigned length) {
    (void)payload;
    (void)buffer;
    (void)length;
}

bool tree_sitter_sveltex_external_scanner_scan(void *payload, TSLexer *lexer,
                                               const bool *valid_symbols) {
    (void)payload;

    // tree-sitter sets the error-sentinel slot while recovering from a parse
    // error. The scanner has nothing useful to contribute then; declining
    // lets the LR error recovery proceed.
    if (valid_symbols[ERROR_SENTINEL]) {
        return false;
    }

    // Frontmatter fences. `_frontmatter_start` is only valid in the document's
    // initial state, so emitting it whenever it is valid and the input looks
    // right is correct.
    if (valid_symbols[FRONTMATTER_START] &&
        (lexer->lookahead == '-' || lexer->lookahead == '+')) {
        if (scan_frontmatter_start(lexer)) return true;
    }
    if (valid_symbols[FRONTMATTER_END] &&
        (lexer->lookahead == '-' || lexer->lookahead == '+')) {
        if (scan_frontmatter_end(lexer)) return true;
    }
    if (valid_symbols[FRONTMATTER_BODY]) {
        if (scan_frontmatter_body(lexer)) return true;
        // No body (closing fence immediately follows the opening fence); fall
        // through so `_frontmatter_end` can be tried at the same position.
        if (valid_symbols[FRONTMATTER_END] &&
            (lexer->lookahead == '-' || lexer->lookahead == '+')) {
            if (scan_frontmatter_end(lexer)) return true;
        }
    }

    // Body tokens are mutually exclusive with `_markdown_chunk` at any given
    // position, so the order of these checks does not matter for correctness —
    // tree-sitter only marks the symbols valid in the current parse state.
    if (valid_symbols[VERBATIM_TEX_CONTENT]) {
        return scan_verbatim_body(lexer, VERBATIM_TEX_CONTENT);
    }
    if (valid_symbols[VERBATIM_PLAIN_CONTENT]) {
        return scan_verbatim_body(lexer, VERBATIM_PLAIN_CONTENT);
    }
    if (valid_symbols[DISPLAY_MATH_CONTENT]) {
        return scan_math_body(lexer, DISPLAY_MATH_CONTENT, true);
    }
    if (valid_symbols[INLINE_MATH_CONTENT]) {
        return scan_math_body(lexer, INLINE_MATH_CONTENT, false);
    }
    if (valid_symbols[EACH_ITERABLE]) {
        return scan_each_iterable(lexer);
    }
    if (valid_symbols[EACH_BINDING]) {
        return scan_each_binding(lexer);
    }
    if (valid_symbols[EACH_KEY]) {
        return scan_paren_balanced_body(lexer, EACH_KEY);
    }
    if (valid_symbols[SNIPPET_PARAMS]) {
        return scan_paren_balanced_body(lexer, SNIPPET_PARAMS);
    }
    if (valid_symbols[AWAIT_PROMISE]) {
        return scan_await_promise(lexer);
    }
    if (valid_symbols[SVELTE_EXPRESSION_BODY]) {
        return scan_svelte_expression_body(lexer);
    }
    if (valid_symbols[ELEMENT_ATTRIBUTES]) {
        return scan_element_attributes(lexer);
    }
    if (valid_symbols[MARKDOWN_CHUNK]) {
        return scan_markdown_chunk(lexer);
    }

    return false;
}
