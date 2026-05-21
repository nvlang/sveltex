/**
 * @file Tree-sitter grammar for SvelTeX (`.sveltex`) documents.
 * @author N. V. Lang
 * @license MIT
 *
 * A `.sveltex` file is a Svelte component whose markup is written in Markdown,
 * with embedded LaTeX/math, fenced/inline code, YAML/TOML/JSON frontmatter and
 * SvelTeX "verbatim" environments (`<tex>`, `<verbatim>`, ...).
 *
 * This grammar deliberately does NOT reimplement Markdown, Svelte or LaTeX.
 * Instead it parses only the `.sveltex` top-level structure — the constructs
 * the plain Markdown grammar would mis-tokenise — and leaves everything else as
 * opaque spans. `queries/injections.scm` then delegates each span to an
 * existing grammar:
 *
 *   - `markdown` / `markdown_inline` for prose (which in turn injects Svelte
 *     and fenced-code languages),
 *   - `latex` for math and TeX verbatim environments,
 *   - `yaml` / `toml` / `json` for frontmatter.
 *
 * The split into `frontmatter`, `verbatim_environment`, `math` and
 * `markdown_chunk` mirrors the `RegionKind`s the SvelTeX language server
 * computes in `packages/sveltex-language-server/src/core/regions.ts`.
 *
 * Everything that needs to recognise a *closing* delimiter whose body may hold
 * arbitrary text (paired `$`/`$$` fences, the matching `</tag>` of a verbatim
 * environment, the `---`/`+++` end of frontmatter, and opaque Markdown runs)
 * is handled by the external scanner in `src/scanner.c`.
 */

/* eslint-disable no-undef */

// Verbatim environment tag names whose body is LaTeX. SvelTeX's default
// `verbatim` config registers `tex`, `latex` and `tikz` as TeX environments
// (see `defaultConfigSnapshot()` in the language server's `config.ts`).
const TEX_VERBATIM_TAGS = ['tex', 'latex', 'tikz', 'TeX', 'LaTeX', 'TikZ'];

// Verbatim environment tag names whose body is treated as opaque/escaped text
// (no embedded language). SvelTeX's defaults register `verb` and `verbatim`.
const PLAIN_VERBATIM_TAGS = ['verb', 'verbatim', 'Verb', 'Verbatim'];

module.exports = grammar({
    name: 'sveltex',

    // The external scanner resolves the constructs an LR grammar cannot:
    // frontmatter fences and body, paired `$`/`$$` math fences, the matching
    // close tag of a verbatim environment, and opaque Markdown runs that stop
    // right before the next `.sveltex`-special token.
    externals: ($) => [
        $._frontmatter_start, // `---` / `+++` opening a frontmatter block
        $._frontmatter_end, // `---` / `+++` closing a frontmatter block
        $._frontmatter_body, // the lines between the frontmatter fences
        $._verbatim_tex_content, // body of a <tex>/<latex>/<tikz> environment
        $._verbatim_plain_content, // body of a <verb>/<verbatim> environment
        $._inline_math_content, // body of `$ ... $`
        $._display_math_content, // body of `$$ ... $$`
        $._markdown_chunk, // a run of ordinary Markdown text
        $._svelte_expression_body, // body of `{ … }` (excluding the braces)
        $._error_sentinel, // tree-sitter's invalid-input sentinel
    ],

    // `$` participates in math fences and must never be silently skipped; the
    // scanner owns all whitespace handling, so nothing is `extras`.
    extras: () => [],

    // Keyword-extraction token. It makes the lexer treat the frontmatter
    // language keywords (`yaml`/`toml`/`json`) and verbatim tag names as whole
    // words, so `yamlx` is not tokenised as `yaml` + `x` and `<texx>` is not
    // mistaken for a `<tex>` environment.
    word: ($) => $._word,

    conflicts: () => [],

    rules: {
        // A document is an optional frontmatter block followed by body content.
        document: ($) => seq(optional($.frontmatter), repeat($._block)),

        // ── Frontmatter ──────────────────────────────────────────────────
        //
        // Only valid as the very first thing in the file (the scanner only
        // emits `_frontmatter_start` at offset 0). The optional language
        // keyword right after the opening `---` selects the embedded language;
        // `injections.scm` keys off the `language` child. `+++ … +++` is the
        // TOML shorthand and carries no keyword.
        frontmatter: ($) =>
            seq(
                field('open', alias($._frontmatter_start, $.frontmatter_fence)),
                optional(field('language', $.frontmatter_language)),
                optional(field('content', $.frontmatter_content)),
                field('close', alias($._frontmatter_end, $.frontmatter_fence)),
            ),

        // `yaml` is the implicit default when no keyword is given. The keyword
        // is glued to the opening fence (`---toml`), hence `token.immediate`.
        frontmatter_language: () =>
            token.immediate(choice('yaml', 'toml', 'json')),

        // Everything between the fences, produced by the external scanner.
        frontmatter_content: ($) => $._frontmatter_body,

        // ── Body blocks ──────────────────────────────────────────────────
        //
        // Verbatim environments, math, Svelte mustache expressions, Svelte
        // logic blocks (`{#if}`/`{#each}`/…) and Svelte `@`-commands
        // (`{@const}`/`{@html}`/…) are recognised explicitly; anything else
        // is an opaque `markdown_chunk` for the `markdown` grammar.
        _block: ($) =>
            choice(
                $.verbatim_environment,
                $.display_math,
                $.inline_math,
                $.svelte_at_const,
                $.svelte_at_html,
                $.svelte_at_render,
                $.svelte_at_debug,
                $.svelte_block_if,
                $.svelte_block_each,
                $.svelte_block_await,
                $.svelte_block_key,
                $.svelte_block_snippet,
                $.svelte_expression,
                $.markdown_chunk,
            ),

        // ── Svelte mustache expressions ──────────────────────────────────
        //
        // A `{ … }` expression in prose. The braces are matched by the LR
        // grammar; the body is consumed by the external scanner, which
        // tracks brace depth and steps over string literals so embedded
        // braces inside `'...'` / `"..."` / `` `...` `` do not perturb the
        // matching. `injections.scm` ships the body to the JavaScript
        // grammar.
        svelte_expression: ($) =>
            seq(
                '{',
                optional(field('body', $.svelte_expression_body)),
                '}',
            ),

        svelte_expression_body: ($) => $._svelte_expression_body,

        // ── Svelte @-commands ────────────────────────────────────────────
        //
        // `{@const x = 1}` / `{@html expr}` / `{@render expr(args)}` /
        // `{@debug a, b, c}`. Each carries an expression body (the body
        // grammar is JS in all four cases). Word-boundary regexes on the
        // opening tokens keep `{@constx}` from being mistaken for
        // `{@const}` + body.
        svelte_at_const: ($) =>
            seq(
                alias($._at_const_open, $.svelte_block_tag),
                field('body', $.svelte_expression_body),
                '}',
            ),
        svelte_at_html: ($) =>
            seq(
                alias($._at_html_open, $.svelte_block_tag),
                field('body', $.svelte_expression_body),
                '}',
            ),
        svelte_at_render: ($) =>
            seq(
                alias($._at_render_open, $.svelte_block_tag),
                field('body', $.svelte_expression_body),
                '}',
            ),
        // `{@debug}` (no args) is its own complete token because the
        // boundary regex on `_at_debug_open` would otherwise consume the
        // closing `}` greedily, leaving no `}` for the grammar to match.
        svelte_at_debug: ($) =>
            choice(
                seq(
                    alias($._at_debug_open, $.svelte_block_tag),
                    field('body', $.svelte_expression_body),
                    '}',
                ),
                alias($._at_debug_empty, $.svelte_block_tag),
            ),

        // ── Svelte logic blocks ──────────────────────────────────────────
        //
        // `{#if cond}` / `{:else if cond}` / `{:else}` / `{/if}` etc.
        // Continuation branches (`{:else if}`, `{:else}`, `{:then}`,
        // `{:catch}`) are pulled out so the parent block's grammar reads
        // naturally; their bodies live in a `svelte_block_content` repeat
        // of `_block`, which makes the whole thing recursive — blocks
        // nest, and any block can contain math, verbatim environments,
        // markdown, more blocks, etc.
        svelte_block_content: ($) => repeat1($._block),

        svelte_block_if: ($) =>
            seq(
                alias($._block_if_open, $.svelte_block_tag),
                field('condition', $.svelte_expression_body),
                '}',
                optional(field('then', $.svelte_block_content)),
                repeat(field('elseif', $.svelte_branch_else_if)),
                optional(field('else', $.svelte_branch_else)),
                alias($._block_if_close, $.svelte_block_tag),
            ),
        svelte_branch_else_if: ($) =>
            seq(
                alias($._branch_else_if, $.svelte_block_tag),
                field('condition', $.svelte_expression_body),
                '}',
                optional(field('content', $.svelte_block_content)),
            ),
        svelte_branch_else: ($) =>
            seq(
                alias($._branch_else, $.svelte_block_tag),
                optional(field('content', $.svelte_block_content)),
            ),

        // `{#each items as item, i (key)}` — the whole head is kept opaque
        // as one expression body so the JavaScript injection can colour
        // `items`, `as`, the binding and the optional `(key)` together.
        // Refining the head into `iterable` / `binding` / `index` / `key`
        // fields would need its own scanner pass; deferred.
        svelte_block_each: ($) =>
            seq(
                alias($._block_each_open, $.svelte_block_tag),
                field('head', $.svelte_expression_body),
                '}',
                optional(field('body', $.svelte_block_content)),
                optional(field('else', $.svelte_branch_else)),
                alias($._block_each_close, $.svelte_block_tag),
            ),

        // `{#await promise}` / `{:then value}` / `{:catch error}` /
        // `{/await}`. Each continuation's binding is optional
        // (`{:then}` / `{:catch}` are valid).
        svelte_block_await: ($) =>
            seq(
                alias($._block_await_open, $.svelte_block_tag),
                field('promise', $.svelte_expression_body),
                '}',
                optional(field('pending', $.svelte_block_content)),
                optional(field('then', $.svelte_branch_then)),
                optional(field('catch', $.svelte_branch_catch)),
                alias($._block_await_close, $.svelte_block_tag),
            ),
        // `{:then}` / `{:catch}` (no binding) need their own complete
        // tokens — same reason as `{@debug}` above.
        svelte_branch_then: ($) =>
            choice(
                seq(
                    alias($._branch_then_with_value, $.svelte_block_tag),
                    field('value', $.svelte_expression_body),
                    '}',
                    optional(field('content', $.svelte_block_content)),
                ),
                seq(
                    alias($._branch_then_empty, $.svelte_block_tag),
                    optional(field('content', $.svelte_block_content)),
                ),
            ),
        svelte_branch_catch: ($) =>
            choice(
                seq(
                    alias($._branch_catch_with_error, $.svelte_block_tag),
                    field('error', $.svelte_expression_body),
                    '}',
                    optional(field('content', $.svelte_block_content)),
                ),
                seq(
                    alias($._branch_catch_empty, $.svelte_block_tag),
                    optional(field('content', $.svelte_block_content)),
                ),
            ),

        // `{#key expr}…{/key}` — re-render the content whenever `expr`
        // changes.
        svelte_block_key: ($) =>
            seq(
                alias($._block_key_open, $.svelte_block_tag),
                field('expr', $.svelte_expression_body),
                '}',
                optional(field('body', $.svelte_block_content)),
                alias($._block_key_close, $.svelte_block_tag),
            ),

        // `{#snippet name(args)}…{/snippet}` — Svelte 5 named snippet.
        // The head (name + args) is kept as one opaque expression body for
        // the same reason as `{#each}`.
        svelte_block_snippet: ($) =>
            seq(
                alias($._block_snippet_open, $.svelte_block_tag),
                field('signature', $.svelte_expression_body),
                '}',
                optional(field('body', $.svelte_block_content)),
                alias($._block_snippet_close, $.svelte_block_tag),
            ),

        // ── Block-tag opening / continuation / closing tokens ────────────
        //
        // Each opener requires a trailing `\s` so `{#ifx}` does not match
        // `{#if`. Where the keyword has no expression body (`{:else}` /
        // `{/if}` and friends), the closing `}` is part of the token; the
        // grammar therefore does NOT consume a separate `}` for those.
        // Where the keyword DOES carry a body, the opener consumes the
        // whitespace boundary but leaves the `}` for the grammar to match
        // after the expression body.

        // `{@…` heads.
        _at_const_open: () => token(seq('{@const', /\s/)),
        _at_html_open: () => token(seq('{@html', /\s/)),
        _at_render_open: () => token(seq('{@render', /\s/)),
        _at_debug_open: () => token(seq('{@debug', /\s/)),
        _at_debug_empty: () => token(seq('{@debug', /\s*}/)),

        // `{#…` heads.
        _block_if_open: () => token(seq('{#if', /\s/)),
        _block_each_open: () => token(seq('{#each', /\s/)),
        _block_await_open: () => token(seq('{#await', /\s/)),
        _block_key_open: () => token(seq('{#key', /\s/)),
        _block_snippet_open: () => token(seq('{#snippet', /\s/)),

        // `{:…` continuations.
        _branch_else_if: () => token(seq('{:else', /\s+/, 'if', /\s/)),
        _branch_else: () => token(seq('{:else', /\s*}/)),
        _branch_then_with_value: () => token(seq('{:then', /\s/)),
        _branch_then_empty: () => token(seq('{:then', /\s*}/)),
        _branch_catch_with_error: () => token(seq('{:catch', /\s/)),
        _branch_catch_empty: () => token(seq('{:catch', /\s*}/)),

        // `{/…}` closes. The closing `}` is baked in because there is no
        // body to consume between the keyword and the close.
        _block_if_close: () => token(seq('{/if', /\s*}/)),
        _block_each_close: () => token(seq('{/each', /\s*}/)),
        _block_await_close: () => token(seq('{/await', /\s*}/)),
        _block_key_close: () => token(seq('{/key', /\s*}/)),
        _block_snippet_close: () => token(seq('{/snippet', /\s*}/)),

        // ── Verbatim environments ────────────────────────────────────────
        //
        // `<tex …>…</tex>`, `<verbatim>…</verbatim>`, etc. The body never
        // participates in Markdown/Svelte parsing. The external scanner reads
        // up to (but not including) the matching `</tag>`; for TeX tags the
        // body is `latex`, otherwise it is opaque text.
        // Two arms keep the TeX vs. plain distinction: the opening tag's name
        // token (`_tex_tag_name` / `_plain_tag_name`) is distinct, so the
        // parser commits to the right arm at the tag, and the body's external
        // token (`_verbatim_tex_content` / `_verbatim_plain_content`) is
        // therefore unambiguous.
        verbatim_environment: ($) =>
            choice($._verbatim_tex, $._verbatim_plain),

        _verbatim_tex: ($) =>
            seq(
                field('open', $.verbatim_tex_open_tag),
                optional(field('body', $.tex_verbatim_body)),
                field('close', $.verbatim_close_tag),
            ),

        _verbatim_plain: ($) =>
            seq(
                field('open', $.verbatim_plain_open_tag),
                optional(field('body', $.plain_verbatim_body)),
                field('close', $.verbatim_close_tag),
            ),

        // Opening tags. The tag name is captured so `highlights.scm` can
        // colour it; attributes are kept as one opaque blob (they may hold
        // Svelte expressions, but precise attribute parsing is out of scope).
        verbatim_tex_open_tag: ($) =>
            seq(
                '<',
                field('name', alias($._tex_tag_name, $.tag_name)),
                optional(field('attributes', $.verbatim_attributes)),
                token.immediate('>'),
            ),

        verbatim_plain_open_tag: ($) =>
            seq(
                '<',
                field('name', alias($._plain_tag_name, $.tag_name)),
                optional(field('attributes', $.verbatim_attributes)),
                token.immediate('>'),
            ),

        verbatim_close_tag: ($) =>
            seq(
                '</',
                field('name', alias($._verbatim_tag_name, $.tag_name)),
                token.immediate('>'),
            ),

        _tex_tag_name: () =>
            token.immediate(choiceOfStrings(TEX_VERBATIM_TAGS)),
        _plain_tag_name: () =>
            token.immediate(choiceOfStrings(PLAIN_VERBATIM_TAGS)),
        _verbatim_tag_name: () =>
            token.immediate(
                choiceOfStrings([
                    ...TEX_VERBATIM_TAGS,
                    ...PLAIN_VERBATIM_TAGS,
                ]),
            ),

        // Attributes of a verbatim opening tag — opaque up to the closing `>`.
        verbatim_attributes: () => token.immediate(/[ \t\r\n][^>]*/),

        tex_verbatim_body: ($) => $._verbatim_tex_content,
        plain_verbatim_body: ($) => $._verbatim_plain_content,

        // ── Math ─────────────────────────────────────────────────────────
        //
        // Four delimiter styles. `$$…$$` and `\[…\]` are display math; `$…$`
        // and `\(…\)` are inline. Dollar fences need the external scanner
        // because the same token opens and closes them. The escaped-bracket
        // styles are plain LR rules. The body is `latex` in every case.
        //
        // `$$…$$` is genuinely ambiguous with two empty `$…$` spans wrapping
        // text, so `display_math` and `inline_math` carry `prec.dynamic`
        // weights (and appear in `conflicts`): GLR explores both parses and
        // keeps the higher-weighted display reading.
        display_math: ($) =>
            prec.dynamic(
                2,
                choice(
                    seq(
                        alias($._dollar_dollar, $.math_delimiter),
                        optional(field('body', $.math_content_display)),
                        alias($._dollar_dollar, $.math_delimiter),
                    ),
                    seq(
                        alias('\\[', $.math_delimiter),
                        optional(field('body', $.math_content_bracket)),
                        alias('\\]', $.math_delimiter),
                    ),
                ),
            ),

        inline_math: ($) =>
            prec.dynamic(
                1,
                choice(
                    seq(
                        alias($._dollar, $.math_delimiter),
                        optional(field('body', $.math_content_inline)),
                        alias($._dollar, $.math_delimiter),
                    ),
                    seq(
                        alias('\\(', $.math_delimiter),
                        optional(field('body', $.math_content_paren)),
                        alias('\\)', $.math_delimiter),
                    ),
                ),
            ),

        _dollar: () => token(prec(1, '$')),
        _dollar_dollar: () => token(prec(2, '$$')),

        // Dollar-delimited math bodies come from the external scanner, which
        // stops right before the matching closing fence.
        math_content_display: ($) => $._display_math_content,
        math_content_inline: ($) => $._inline_math_content,

        // `\[ ... \]` body: anything up to the literal closing `\]`.
        math_content_bracket: () => token(prec(-1, /([^\\]|\\[^\]])+/)),

        // `\( ... \)` body: anything up to the literal closing `\)`.
        math_content_paren: () => token(prec(-1, /([^\\]|\\[^)])+/)),

        // ── Markdown ─────────────────────────────────────────────────────
        //
        // An opaque run of ordinary content. The external scanner produces it
        // greedily, stopping just before the next `.sveltex`-special token
        // (a verbatim open tag, a `$`/`$$`/`\(`/`\[` math opener, or EOF).
        // `injections.scm` ships the whole run to the `markdown` grammar.
        markdown_chunk: ($) => $._markdown_chunk,

        // A bare identifier; only used to satisfy `word`.
        _word: () => /[A-Za-z][A-Za-z0-9_-]*/,
    },
});

/**
 * Builds a `choice()` of string literals.
 *
 * @param {string[]} strings
 * @returns {ChoiceRule}
 */
function choiceOfStrings(strings) {
    return choice(...strings.map((s) => s));
}
