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
        // Verbatim environments and math are recognised explicitly; anything
        // else is an opaque `markdown_chunk` for the `markdown` grammar.
        _block: ($) =>
            choice(
                $.verbatim_environment,
                $.display_math,
                $.inline_math,
                $.markdown_chunk,
            ),

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
