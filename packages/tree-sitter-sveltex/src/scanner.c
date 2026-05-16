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
//   * `_display_math_content`  — the body of `$$ ... $$`.
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

// ── Verbatim-environment look-ahead ──────────────────────────────────────
//
// At a `<`, decide whether what follows opens a verbatim environment. The
// lexer's lookahead is the `<`.
//
// Returns the length of the matched tag name (>0) on success and consumes the
// `<` and the tag name, or returns 0 on failure (having consumed only scratch
// input). The caller must `mark_end` before calling so a failed probe is
// discarded.
static unsigned probe_verbatim_open(TSLexer *lexer, char *out_name,
                                    unsigned out_cap) {
    advance(lexer);  // consume '<'
    if (lexer->lookahead == '/') return 0;  // a closing tag, not an opening

    unsigned len = 0;
    while (len + 1 < out_cap && is_tag_name_char(lexer->lookahead)) {
        out_name[len++] = (char)lexer->lookahead;
        advance(lexer);
    }
    out_name[len] = '\0';
    if (len == 0) return 0;

    // The char after the name must be whitespace or `>` for this to be a tag.
    int32_t after = lexer->lookahead;
    bool ok = after == '>' || after == ' ' || after == '\t' ||
              after == '\r' || after == '\n';
    if (!ok) return 0;

    for (unsigned i = 0; i < VERBATIM_TAG_COUNT; i++) {
        if (strcmp(out_name, VERBATIM_TAGS[i]) == 0) return len;
    }
    return 0;
}

// Returns whether `name` is one of the configured verbatim tags.
static bool is_verbatim_tag(const char *name) {
    for (unsigned i = 0; i < VERBATIM_TAG_COUNT; i++) {
        if (strcmp(name, VERBATIM_TAGS[i]) == 0) return true;
    }
    return false;
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

// Consumes a balanced `{ … }` mustache tag whose opening `{` has *already*
// been consumed by the caller. Nested braces are tracked so a `{ {x} }`
// expression is consumed as a whole; an unbalanced tag consumes to EOF.
// Strings and template literals inside the expression are skipped so a `}`
// (or a `$`) inside a string literal does not end the tag prematurely.
static void skip_mustache_after_open(TSLexer *lexer) {
    unsigned depth = 1;
    for (;;) {
        if (is_eof(lexer)) return;
        int32_t c = lexer->lookahead;
        if (c == '{') {
            depth++;
            advance(lexer);
            continue;
        }
        if (c == '}') {
            depth--;
            advance(lexer);
            if (depth == 0) return;
            continue;
        }
        if (c == '\'' || c == '"' || c == '`') {
            // Skip a string / template literal verbatim.
            int32_t quote = c;
            advance(lexer);
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
                    break;
                }
                advance(lexer);
            }
            continue;
        }
        advance(lexer);
    }
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
            // Probe the tag. `mark_end` first so the boundary (the `<`) is
            // the token end if this turns out to be a verbatim environment.
            lexer->mark_end(lexer);
            char name[32];
            unsigned len = probe_verbatim_open(lexer, name, sizeof(name));
            if (len > 0) {
                // A verbatim environment starts here — the chunk ends at the
                // already-marked `<`.
                return consumed;
            }
            // Not verbatim. `probe_verbatim_open` left the (lower-case-able)
            // tag name in `name`; a `<script>` / `<style>` element is opaque
            // to SvelTeX, so skip the whole element — the cursor is already
            // positioned right after the tag name.
            if (eq_keyword_ci(name, "script")) {
                skip_script_or_style_after_name(lexer, "script");
                consumed = true;
                at_line_start = false;
                continue;
            }
            if (eq_keyword_ci(name, "style")) {
                skip_script_or_style_after_name(lexer, "style");
                consumed = true;
                at_line_start = false;
                continue;
            }
            // Any other `<` is ordinary Markdown/HTML/Svelte text. The probe
            // consumed the `<` (and any partial name) as scratch; that scratch
            // is now kept text, so the next loop iteration's `mark_end` (or
            // the final one) includes it.
            consumed = true;
            at_line_start = false;
            continue;
        }

        if (here == '{') {
            // A Svelte mustache tag / logic-block delimiter. SvelTeX escapes
            // `{ … }`, so a `$` inside it is JS, not math — skip the balanced
            // tag wholesale.
            advance(lexer);  // consume '{'
            skip_mustache_after_open(lexer);
            consumed = true;
            at_line_start = false;
            continue;
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
                char name[32];
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
    if (valid_symbols[MARKDOWN_CHUNK]) {
        return scan_markdown_chunk(lexer);
    }

    return false;
}
