// File description: Types describing the options that can be passed to MathJax
// via SvelTeX.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MathDocument } from '@mathjax/src/js/core/MathDocument.js';
import type { MathItem } from '@mathjax/src/js/core/MathItem.js';
import type { Node, NodeClass } from '@mathjax/src/js/core/Tree/Node.js';
import type {
    Wrapper,
    WrapperClass,
} from '@mathjax/src/js/core/Tree/Wrapper.js';
import type { WrapperFactory } from '@mathjax/src/js/core/Tree/WrapperFactory.js';
import type {
    CharOptions,
    DelimiterData,
    FontData,
    VariantData,
} from '@mathjax/src/js/output/common/FontData.js';
import type { MathjaxFont } from '../handlers/Math.js';
import type {
    EnrichedMathDocument,
    EnrichedMathItem,
} from '@mathjax/src/js/a11y/semantic-enrich.js';

export interface MathjaxConfiguration {
    /**
     * Document options.
     */
    options?: MathjaxOptions | undefined;

    /**
     * The configuration for the SVG output processor.
     */
    svg?: MathjaxSvgOutputProcessorOptions | undefined;

    /**
     * The configuration for the CommonHTML output processor.
     */
    chtml?: MathjaxChtmlOutputProcessorOptions | undefined;

    /**
     * The configuration for the TeX input processor.
     */
    tex?: MathjaxTexInputProcessorOptions | undefined;

    /**
     * Options for the MathML input processor.
     *
     * ⚠ **Warning:** SvelTeX doesn't support MathML input
     */
    mml?: MathjaxMathmlInputProcessorOptions | undefined;

    /**
     * Options for the output processor, regardless of output format. Only
     * options common to both output processors (CHTML and SVG) are listed here.
     *
     * [MathJax v4.0 documentation for
     * `output`](https://docs.mathjax.org/en/v4.0/options/output/index.html#options-common-to-all-output-processors):
     *
     * > The following options are common to all the output processors listed
     * > above. These can be specified in the `output` block of your MathJax
     * > configuration (they apply to any output jax), or can be included in the
     * > configuration for the specific output jax that you are using. It is
     * > best to use the `output` section for these options, since then if your
     * > reader uses the MathJax contextual menu to switch renderers, they will
     * > apply to the new renderer as well.
     */
    output?: MathjaxCommonOutputProcessorOptions | undefined;

    /**
     * Components to load.
     */
    load?: string[] | undefined;
}

export type MathjaxOptions = MathjaxDocumentOptions &
    MathjaxSemanticEnrichOptions &
    MathjaxSpeechOptions &
    MathjaxAssistiveMmlOptions &
    MathjaxExplorerOptions &
    MathjaxComplexityOptions &
    MathjaxContextualMenuOptions;

/**
 * Options that can be passed to `tex2chtml`, `tex2svg`, and related functions.
 *
 * @see
 * https://docs.mathjax.org/en/latest/web/typeset.html#conversion-options
 */
export interface MathjaxConversionOptions {
    /**
     * Specifies whether the math is in display-mode or not (for TeX input).
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * @see
     * https://docs.mathjax.org/en/v4.0/server/direct.html#mathDocument.convert
     */
    display?: boolean | undefined;

    /**
     * Number of pixels in an em for the surrounding font.
     *
     * @defaultValue
     * ```ts
     * 16
     * ```
     *
     * @see
     * https://docs.mathjax.org/en/v4.0/server/direct.html#mathDocument.convert
     */
    em?: number | undefined;

    /**
     * Number of pixels in an ex for the surrounding font.
     *
     * @defaultValue
     * ```ts
     * 8
     * ```
     *
     * @see
     * https://docs.mathjax.org/en/v4.0/server/direct.html#mathDocument.convert
     */
    ex?: number | undefined;

    /**
     * Width of the container, in pixels. If set to `null`, the container is
     * considered to be infinitely wide.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     *
     * @see
     * https://docs.mathjax.org/en/v4.0/server/direct.html#mathDocument.convert
     */
    containerWidth?: number | null | undefined;

    /**
     * A number giving the line-breaking width in em units. Default is a very
     * large number, so effectively no line breaking.
     *
     * @defaultValue
     * ```
     * 100000
     * ```
     */
    lineWidth?: number | undefined;

    /**
     * Scaling factor to apply to the output.
     *
     * @defaultValue
     * ```ts
     * 1
     * ```
     *
     * @see
     * https://docs.mathjax.org/en/v4.0/server/direct.html#mathDocument.convert
     */
    scale?: number | undefined;
}

/**
 * > There are no options that are common to all input jax, but a number of the
 * > [Document
 * > Options](https://docs.mathjax.org/en/v4.0/options/document.html#document-options)
 * > affect what portions of the document will be processed by the input jax
 * > that scan the page for delimiters (i.e., TeX and AsciiMath). In particular,
 * > the options that correspond to the version-2 options `skipTags`,
 * > `includeTags`, and similar options for the various v2 pre-processors are
 * > now document-level options.
 *
 * @see https://docs.mathjax.org/en/v4.0/options/input/index.html#options-common-to-all-input-processors
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MathjaxCommonInputProcessorOptions {}

/**
 * These options control the operation of the [MathML input
 * processor](https://docs.mathjax.org/en/latest/basic/mathematics.html#mathml-input)
 * that is run when you include `'input/mml'` in the `load` array of the
 * `loader` block of your MathJax configuration, or if you load a combined
 * component that includes the MathML input jax. They are listed with their
 * default values. To set any of these options, include an `mml` section in your
 * `MathJax` global object.
 */
/**
 * Options for the MathML input processor.
 */
interface MathjaxMathmlInputProcessorOptions
    extends MathjaxCommonInputProcessorOptions {
    /**
     * Specifies how to parse the MathML input.
     *
     * @defaultValue `'html'`
     *
     * Specifies how MathML strings should be parsed: as XML or as HTML. When
     * set to `'xml'`, the browser’s XML parser is used, which is more strict
     * about format (e.g., matching end tags) than the HTML parser, which is the
     * default. In node application (where the `liteDOM` is used), these both
     * use the same parser, which is not very strict.
     */
    parseAs?: 'html' | 'xml';

    /**
     * Whether to force re-parsing of all MathML.
     *
     * @defaultValue `false`
     *
     * Specifies whether MathJax will serialize and re-parse MathML found in the
     * document. This can be useful if you want to do XML parsing of the MathML
     * from an HTML document.
     */
    forceReparse?: boolean;

    /**
     * Function to process parsing errors.
     *
     * @defaultValue
     * ```ts
     * (node) => this.error(this.adaptor.textContent(node).replace(/\n(?:.*)/g, ''));
     * ```
     *
     * Specifies a function to be called when there is a parsing error in the
     * MathML (usually only happens with XML parsing). The `node` is a DOM node
     * containing the error text. Your function can process that in any way it
     * sees fit. The default is to call the MathML input processor’s error
     * function with the text of the error (which will create an `merror` node
     * with the error message). Note that this function runs with `this` being
     * the MathML input processor object.
     */
    parseError?: (node: unknown) => void;

    /**
     * This object controls what verification/modifications are to be performed
     * on the MathML that is being processed by MathJax.
     *
     * @defaultValue
     * ```typescript
     * {
     *   checkArity: true,
     *   checkAttributes: false,
     *   fullErrors: false,
     *   fixMmultiscripts: true,
     *   fixMtables: true
     * }
     * ```
     */
    verify?: {
        /**
         * Check if number of children is correct.
         *
         * @defaultValue
         * ```ts
         * true
         * ```
         *
         * This specifies whether the number of children is verified or not. The
         * default is to check for the correct number of children. If the number
         * is wrong, the node is replaced by an `<merror>` node containing
         * either a message indicating the wrong number of children, or the name
         * of the node itself, depending on the setting of
         * {@link fullErrors | `fullErrors`} below.
         */
        checkArity?: boolean;

        /**
         * Check if attribute names are valid.
         *
         * @defaultValue `false`
         *
         * This specifies whether the names of all attributes are checked to see
         * if they are valid on the given node (i.e., they have a default value,
         * or are one of the standard attributes such as style, class, id, href,
         * or a data- attribute. If an attribute is in error, the node is either
         * placed inside an `<merror>` node (so that it is marked in the output
         * as containing an error), or is replaced by an `<merror>` containing a
         * full message indicating the bad attribute, depending on the setting
         * of fullErrors below.
         *
         * Currently only names are checked, not values. Value verification may
         * be added in a future release.
         */
        checkAttributes?: boolean;

        /**
         * Display full error messages or just error node.
         *
         * @defaultValue `false`
         *
         * This specifies whether a full error message is displayed when a node
         * produces an error, or whether just the node name is displayed (or the
         * node itself in the case of attribute errors).
         */
        fullErrors?: boolean;

        /**
         * Fix unbalanced mmultiscripts.
         *
         * @defaultValue
         * ```ts
         * true
         * ```
         *
         * This specifies whether extra `<none/>` entries are added to
         * `<mmultiscripts>` elements to balance the super- and subscripts, as
         * required by the specification, or whether to generate an error
         * instead.
         */
        fixMmultiscripts?: boolean;

        /**
         * Fix incorrect nesting in mtables.
         *
         * @defaultValue
         * ```ts
         * true
         * ```
         *
         * This specifies whether missing `<mtable>`, `<mtr>` and `<mtd>`
         * elements are placed around cells or not. When true, MathJax will
         * attempt to correct the table structure if these elements are missing
         * from the tree. For example, an `<mtr>` element that is not within an
         * `<mtable>` will have an `<mtable>` placed around it automatically,
         * and an `<mtable>` containing an `<mi>` as a direct child node will
         * have an `<mtr>` and `<mtd>` inserted around the `<mi>`.
         */
        fixMtables?: boolean;
    };

    /**
     * The `FindMathML` object instance that will override the default one. This
     * allows you to create a subclass of `FindMathML` and pass that to the
     * MathML input jax. A `null` value means use the default `FindMathML` class
     * and make a new instance of that.
     *
     * @defaultValue `null`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    FindMathML?: unknown;

    /**
     * The `MathMLCompile` object instance that will override the default one.
     * This allows you to create a subclass of `MathMLCompile` and pass that to
     * the MathML input jax. A `null` value means use the default
     * `MathMLCompile` class and make a new instance of that.
     *
     * @defaultValue `null`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    MathMLCompile?: unknown;
}

/**
 * Names of the TeX-input extension packages MathJax recognizes.
 */
export type MathjaxTexExtension =
    | 'action'
    | 'ams'
    | 'amscd'
    | 'autoload'
    | 'base'
    | 'bbm'
    | 'bboldx'
    | 'bbox'
    | 'begingroup'
    | 'boldsymbol'
    | 'braket'
    | 'bussproofs'
    | 'cancel'
    | 'cases'
    | 'centernot'
    | 'color'
    | 'colortbl'
    | 'colorv2'
    | 'configmacros'
    | 'dsfont'
    | 'empheq'
    | 'enclose'
    | 'extpfeil'
    | 'gensymb'
    | 'html'
    | 'mathtools'
    | 'mhchem'
    | 'newcommand'
    | 'noerrors'
    | 'noundefined'
    | 'physics'
    | 'require'
    | 'setoptions'
    | 'tagformat'
    | 'texhtml'
    | 'textcomp'
    | 'textmacros'
    | 'unicode'
    | 'units'
    | 'upgreek'
    | 'verb';

/**
 * The TeX-input extensions MathJax loads by default.
 *
 * @see https://github.com/mathjax/MathJax-src/blob/1a2ef74c0ac0620e7b8de46402c9dce3b95ade52/components/mjs/input/tex/config.json
 */
export type MathjaxDefaultTexExtension =
    | 'base'
    | 'ams'
    | 'newcommand'
    | 'textmacros'
    | 'noundefined'
    | 'require'
    | 'autoload'
    | 'configmacros';

/**
 * The options below control the operation of the [TeX input
 * processor](https://docs.mathjax.org/en/latest/basic/mathematics.html#tex-input)
 * that is run when you include `'input/tex'`, `'input/tex-full'`, or
 * `'input/tex-base'` in the `load` array of the `loader` block of your MathJax
 * configuration, or if you load a combined component that includes the TeX
 * input jax. They are listed with their default values. To set any of these
 * options, include a `tex` section in your `MathJax` global object.
 */
interface MathjaxTexInputProcessorOptions
    extends MathjaxCommonInputProcessorOptions {
    /**
     * Extensions that the TeX input processor (Jax) should use.
     *
     * The TeX input processor, by default, loads and activates the following
     * extensions: `base`, `ams`, `newcommand`, `textmacros`, `noundefined`,
     * `require`, `autoload`, and `configmacros`. This property should be seen
     * as a way to load and activate more extensions, and/or prevent some of the
     * extensions that are loaded and activated by default from being loaded or
     * activated.
     *
     * @example
     * To load and activate the `color` extension, you could set this property
     * to
     *
     * ```ts
     * ['color']
     * ```
     *
     * or
     *
     * ```ts
     * { '[+]': ['color'] }
     * ```
     *
     * If you'd like to also prevent, say, the `newcommand` extension from being
     * loaded or activated, you would set this property to
     *
     *
     * ```ts
     * { '[-]': ['newcommand'], '[+]': ['color'] }
     * ```
     *
     * @defaultValue
     * ```ts
     * { '[+]': ['amscd', 'bbm', 'bboldx', 'bbox', 'begingroup', 'boldsymbol',
     * 'braket', 'bussproofs', 'cancel', 'cases', 'centernot', 'color',
     * 'colortbl', 'dsfont', 'empheq', 'enclose', 'extpfeil', 'gensymb', 'html',
     * 'mathtools', 'mhchem', 'noerrors', 'physics', 'setoptions', 'tagformat',
     * 'texhtml', 'textcomp', 'unicode', 'units', 'upgreek', 'verb'] }
     * ```
     */
    packages?:
        | Exclude<MathjaxTexExtension, MathjaxDefaultTexExtension>[]
        | {
              '[-]'?: MathjaxDefaultTexExtension[];
              '[+]'?: Exclude<
                  MathjaxTexExtension,
                  MathjaxDefaultTexExtension
              >[];
          }
        | undefined;

    /**
     * Start and end delimiter pairs for in-line math.
     *
     * @defaultValue `[['\\(', '\\)']]`
     *
     * This is an array of pairs of strings that are to be used as in-line math
     * delimiters. The first in each pair is the initial delimiter and the
     * second is the terminal delimiter. You can have as many pairs as you want.
     * For example,
     *
     * ```ts
     * inlineMath: [ ['$','$'], ['\\(','\\)'] ]
     * ```
     *
     * would cause MathJax to look for `$ ... $` and `\( ... \)` as delimiters
     * for in-line mathematics. (Note that the single dollar signs are not
     * enabled by default because they are used too frequently in normal text,
     * so if you want to use them for math delimiters, you must specify them
     * explicitly.)
     *
     * Note that the delimiters can’t look like HTML tags (i.e., can’t include
     * the less-than sign), as these would be turned into tags by the browser
     * before MathJax has the chance to run. You can only include text, not
     * tags, as your math delimiters.
     *
     * @remarks Within Sveltex, the default value is actually
     * `[['$', '$'], ['\\(', '\\)']]`.
     */
    // inlineMath?: [string, string][];

    /**
     * Start and end delimiter pairs for display math.
     *
     * @defaultValue `[['$$', '$$'], ['\\[', '\\]']]`
     *
     * This is an array of pairs of strings that are to be used as delimiters
     * for displayed equations. The first in each pair is the initial delimiter
     * and the second is the terminal delimiter.  You can have as many pairs as
     * you want.
     *
     * Note that the delimiters can't look like HTML tags (i.e., can't include
     * the less-than sign), as these would be turned into tags by the browser
     * before MathJax has the chance to run.  You can only include text, not
     * tags, as your math delimiters.
     */
    // displayMath?: [string, string][];

    /**
     * Use `$` to produce a literal dollar sign.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * When set to `true`, you may use `\$` to represent a literal dollar sign,
     * rather than using it as a math delimiter, and `\\` to represent a literal
     * backslash (so that you can use `\\\$` to get a literal `\$` or `\\$...$`
     * to get a backslash just before in-line math).  When `false`, `\$` will
     * not be altered, and its dollar sign may be considered part of a math
     * delimiter. Typically this is set to `true` if you enable the `$ ... $`
     * in-line delimiters, so you can type `\$` and MathJax will convert it to a
     * regular dollar sign in the rendered document.
     *
     * @remarks In MathJax v2, the default was `false`.
     */
    // processEscapes?: boolean;

    /**
     * Process `\begin{xxx}...\end{xxx}` outside math mode.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * When `true`, `tex2jax` looks not only for the in-line and display math
     * delimiters, but also for LaTeX environments (`\begin{something} ...
     * \end{something}`) and marks them for processing by MathJax. When `false`,
     * LaTeX environments will not be processed outside of math mode.
     */
    processEnvironments?: boolean;

    /**
     * Process `\ref{...}` outside of math mode.
     *
     * @remarks
     * When set to `true`, MathJax will process `\ref{...}` outside of math
     * mode.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    processRefs?: boolean;

    /**
     * Pattern for recognizing numbers.
     *
     * @defaultValue `/^(?:[0-9]+(?:\{,\}[0-9]{3})*(?:\.[0-9]*)?|\.[0-9]+)/`
     *
     * This gives a regular expression that is used to identify numbers during
     * the parsing of your TeX expressions.  By default, the decimal point is
     * ``.`` and you can use ``{,}`` between every three digits before that.  If
     * you want to use ``{,}`` as the decimal indicator, use
     *
     * ```ts
     * MathJax = {
     *   tex: {
     *     digits: /^(?:[0-9]+(?:\{,\}[0-9]*)?|\{,\}[0-9]+)/
     *   }
     * };
     * ```
     */
    digits?: RegExp;

    /**
     * Specify the tags to use. Can be `'none'`, `'ams'`, or `'all'`.
     *
     * @defaultValue `'none'`
     *
     * This controls whether equations are numbered and how.  By default it is
     * set to `'none'` to be compatible with earlier versions of MathJax where
     * auto-numbering was not performed (so pages will not change their
     * appearance).  You can change this to `'ams'` for equations numbered as
     * the AMSmath package would do, or `'all'` to get an equation number for
     * every displayed equation.
     */
    tags?: 'none' | 'ams' | 'all';

    /**
     * Side for `\tag` macros.
     *
     * @defaultValue `'right'`
     *
     * This specifies the side on which `\tag{}` macros will place the tags, and
     * on which automatic equation numbers will appear. Set it to `'left'` to
     * place the tags on the left-hand side.
     */
    tagSide?: 'left' | 'right';

    /**
     * Amount to indent tags.
     *
     * @defaultValue `'0.8em'`
     *
     * This is the amount of indentation (from the right or left) for the tags
     * produced by the `\tag{}` macro or by automatic equation numbers.
     */
    tagIndent?: string;

    /**
     * Use label name rather than tag for ids.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * This controls whether element IDs for tags use the `\label` name or the
     * equation number. When `true`, use the label, when `false`, use the
     * equation number.
     */
    useLabelIds?: boolean;

    /**
     * Maximum number of macro substitutions per expression.
     *
     * @defaultValue `10000`
     *
     * Because a definition of the form `\def\x{\x} \x` would cause MathJax to
     * loop infinitely, the maxMacros constant will limit the number of macro
     * substitutions allowed in any expression processed by MathJax.
     */
    maxMacros?: number;

    /**
     * Maximum size for the internal TeX string, in bytes.
     *
     * @defaultValue `5 * 1024`
     *
     * Because a definition of the form `\def\x{\x aaa} \x` would loop
     * infinitely, and at the same time stack up lots of a’s in MathJax’s
     * equation buffer, the `maxBuffer` constant is used to limit the size of
     * the string being processed by MathJax. It is set to 5KB, which should be
     * sufficient for any reasonable equation.
     */
    maxBuffer?: number;

    /**
     * URL for use with links to tags (when there is a `<base>` tag in effect).
     *
     * @defaultValue
     * ```ts
     * document.getElementsByTagName('base').length === 0
     *   ? ''
     *   : String(document.location).replace(/#.*$/, '')
     * ```
     *
     * This is the base URL to use when creating links to tagged equations (via
     * `\ref{}` or `\eqref{}`) when there is a `<base>` element in the document
     * that would affect those links. You can set this value by hand if MathJax
     * doesn’t produce the correct link.
     */
    baseURL?: string;

    /**
     * Function called when TeX syntax errors occur.
     *
     * @defaultValue `(jax: any, err: any) => jax.formatError(err)`
     *
     * This is a function that is called when the TeX input jax reports a syntax
     * or other error in the TeX that it is processing. The default is to
     * generate an `<merror>` MathML element with the message indicating the
     * error that occurred. You can override the function to perform other
     * tasks, like recording the message, replacing the message with an
     * alternative message, or throwing the error so that MathJax will stop at
     * that point (you can catch the error using promises or a `try`/`catch`
     * block).
     */
    formatError?: (jax: unknown, err: unknown) => unknown;

    /**
     * The `FindTeX` object instance that will override the default one. This
     * allows you to create a subclass of `FindTeX` and pass that to the TeX
     * input jax. A `null` value means use the default `FindTeX` class and make
     * a new instance of that.
     *
     * @defaultValue `null`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    FindTeX?: unknown;
}

/**
 * @typeParam N - Node.
 * @typeParam T - Text.
 * @typeParam D - Document.
 */
type MathjaxFilterFunction<N, T, D> = ({
    math,
    document,
    data,
}: {
    math: MathItem<N, T, D>;
    document: MathDocument<N, T, D>;
    data: N;
}) => boolean | undefined;

interface MathjaxCommonOutputProcessorOptions {
    /**
     * Global scaling factor for all expressions.
     *
     * [MathJax v4.0 documentation for
     * `scale`](https://docs.mathjax.org/en/v4.0/options/output/#output-scale):
     *
     * > The scaling factor for math compared to the surrounding text. The
     * > MathJax output processors try to match the ex-size of the mathematics
     * > with that of the text where it is placed, so that the lower-case
     * > letters in the mathematics are the same height as lower-case letters in
     * > the surrounding text. Note that this may mean that upper-case letters
     * > in the mathematics may not match those in the surrounding font, as not
     * > all fonts have the same height ratio between upper- and lower-case
     * > letters. You may want to adjust the results using this scaling factor
     * > to suit your situation. The user can also adjust this value using the
     * > contextual menu item associated with the typeset mathematics.
     *
     * @defaultValue
     * ```ts
     * 1
     * ```
     */
    scale?: number;

    /**
     * [MathJax v4.0 documentation for
     * `minScale`](https://docs.mathjax.org/en/v4.0/options/output/#output-minscale):
     *
     * > This gives a minimum scale factor for the scaling used by MathJax to
     * > match the equation to the surrounding text. This will prevent MathJax
     * > from making the mathematics too small.
     *
     * @defaultValue
     * ```ts
     * 0.5
     * ```
     */
    minScale?: number;

    /**
     * [MathJax v4.0 documentation for
     * `mtextInheritFont`](https://docs.mathjax.org/en/v4.0/options/output/#output-mtextinheritfont):
     *
     * > This setting controls whether `<mtext>` elements will be typeset using
     * > the math fonts or the font of the surrounding text. When `false`, the
     * > [mtextFont](https://docs.mathjax.org/en/v4.0/options/output/#output-mtextfont)
     * > will be used, unless it is blank, in which case math fonts will be
     * > used, as they are for other token elements; when `true`, the font will
     * > be inherited from the surrounding text, when possible, depending on the
     * > `mathvariant` for the element (some math variants, such as `fraktur`
     * > can’t be inherited from the surroundings).
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    mtextInheritFont?: boolean;

    /**
     * [MathJax v4.0 documentation for
     * `merrorInheritFont`](https://docs.mathjax.org/en/v4.0/options/output/#output-merrorinheritfont):
     *
     * > This setting controls whether the text for `<merror>` elements will be
     * > typeset using the math fonts or the font of the surrounding text. When
     * > `false`, the
     * > [merrorFont](https://docs.mathjax.org/en/v4.0/options/output/#output-merrorfont)
     * > will be used; when `true`, the font will be inherited from the
     * > surrounding text, when possible, depending on the `mathvariant` for the
     * > element (some math variants, such as `fraktur` can’t be inherited from
     * > the surroundings).
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    merrorInheritFont?: boolean;

    /**
     * [MathJax v4.0 documentation for
     * `mtextFont`](https://docs.mathjax.org/en/v4.0/options/output/#output-mtextfont):
     *
     * > This specifies the font family to use for `<mtext>` elements when
     * > [mtextInheritFont](https://docs.mathjax.org/en/v4.0/options/output/#output-mtextinheritfont)
     * > is `false` (and is ignored if it is `true`). It can be a
     * > comma-separated list of font-family names. If it is empty, then the
     * > math fonts are used, as they are with other token elements.
     *
     * @defaultValue
     * ```ts
     * ''
     * ```
     */
    mtextFont?: string;

    /**
     * [MathJax v4.0 documentation for
     * `merrorFont`](https://docs.mathjax.org/en/v4.0/options/output/#output-merrorfont):
     *
     * > This specifies the font family to use for `<merror>` elements when
     * > [merrorInheritFont](https://docs.mathjax.org/en/v4.0/options/output/#output-merrorinheritfont)
     * > is `false` (and is ignored if it is `true`). It can be a
     * > comma-separated list of font-family names. If it is empty, then the
     * > math fonts are used, as they are with other token elements.
     *
     * @defaultValue
     * ```ts
     * 'serif'
     * ```
     */
    merrorFont?: string;

    /**
     * [MathJax v4.0 documentation for
     * `unknownFamily`](https://docs.mathjax.org/en/v4.0/options/output/#output-unknownfamily):
     *
     * > This specifies the font family to use for characters that are not found
     * > in the MathJax math fonts. For example, if you enter unicode characters
     * > directly, these may not be in MathJax’s font, and so they will be taken
     * > from the font or fonts specified here.
     *
     * @defaultValue
     * ```ts
     * 'serif'
     * ```
     */
    unknownFamily?: string;

    /**
     * [MathJax v4.0 documentation for
     * `mathmlSpacing`](https://docs.mathjax.org/en/v4.0/options/output/#output-mathmlspacing):
     *
     * > This specifies whether to use TeX spacing or MathML spacing rules when
     * > typesetting the math. When `true`, MathML spacing rules are used; when
     * > `false`, the TeX rules are used.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    mathmlSpacing?: boolean;

    /**
     * [MathJax v4.0 documentation for
     * `skipAttributes`](https://docs.mathjax.org/en/v4.0/options/output/#output-skipattributes):
     *
     * > This object gives a list of non-standard attributes (e.g., RFDa
     * > attributes) that will not be transferred from MathML element to their
     * > corresponding DOM elements in the typeset output. For example, with
     * >
     * > ```ts
     * > skipAttributes: {
     * >   'data-my-attr': true
     * > }
     * > ```
     * >
     * > a MathML element like `<mi data-my-attr="some data">x</mi>` will not
     * > have the `data-my-attr` attribute on the `<mjx-mi>` element created by
     * > the CommonHTML output processor to represent the `<mi>` element
     * > (normally, any non-standard attributes are retained in the output).
     *
     * @defaultValue
     * ```ts
     * {}
     * ```
     */
    skipAttributes?: Record<string, unknown>;

    /**
     * [MathJax v4.0 documentation for
     * `exFactor`](https://docs.mathjax.org/en/v4.0/options/output/#output-exfactor):
     *
     * > This is the size of an ex in comparison to 1 em that is to be used when
     * > the ex-size can’t be determined (e.g., when running in a Node
     * > application, where the size of DOM elements can’t be determined).
     *
     * @defaultValue
     * ```ts
     * 0.5
     * ```
     */
    exFactor?: number;

    /**
     * [MathJax v4.0 documentation for
     * `displayAlign`](https://docs.mathjax.org/en/v4.0/options/output/#output-displayalign):
     *
     * > This determines how displayed equations will be aligned (left, center,
     * > or right). The default is 'center'.
     *
     * @defaultValue
     * ```ts
     * 'center'
     * ```
     */
    displayAlign?: string;

    /**
     * [MathJax v4.0 documentation for
     * `displayIndent`](https://docs.mathjax.org/en/v4.0/options/output/#output-displayindent):
     *
     * > This gives the amount of indentation that should be used for displayed
     * > equations. The default is `0`. A value of `'1em'`, for example, would
     * > introduce an extra 1 em of space from whichever margin the equation is
     * > aligned to, or an offset from the center position if the expression is
     * > centered. Note that negative values are allowed.
     *
     * @defaultValue
     * ```ts
     * '0'
     * ```
     */
    displayIndent?: string;

    /**
     * [MathJax v4.0 documentation for
     * `displayOverflow`](https://docs.mathjax.org/en/v4.0/options/output/#output-displayoverflow):
     *
     * > This specifies how displayed equations that are too wide for their
     * > containers should be treated. The possible values are:
     * >
     * > -  `'scroll'` to use a horizontal scroll bar to allow the rest of the
     * >    equation scroll into view.
     * > -  `'scale'` to scale the equation until it fits into its container.
     * > -  `'truncate'` to clip the expression at the container size.
     * > -  `'elide'` is not yet implemented.
     * > -  `'linebreak'` to insert line breaks to keep the expression within
     * >    the container.
     * > -  `'overflow'`, to allow the expression to overflow the width of the
     * >    container. This is the default.
     * >
     * > Note that this option sets the `overflow` attribute of the underlying
     * > MathML expression, if there isn’t one already.
     * >
     * > The user can change this value globally using the MathJax contextual
     * > menu.
     *
     * @defaultValue
     * ```ts
     * 'overflow'
     * ```
     */
    displayOverflow?:
        | 'scroll'
        | 'scale'
        | 'truncate'
        | 'elide'
        | 'linebreak'
        | 'overflow';

    /**
     * [MathJax v4.0 documentation for
     * `linebreaks`](https://docs.mathjax.org/en/v4.0/options/output/#output-linebreaks):
     *
     * > This block of options controls the line-breaking that is performed when
     * > the `displayOverflow` is set to `'linebreak'` or the user selects
     * > linebreaking in the MathJax contextual menu. The options include:
     * >
     * > **`inline: true`**
     * >
     * > > When set to true, in-line equations will be allowed to break (at
     * > > locations that TeX would allow for linebreaks). The browser will then
     * > > break the mathematics when needed, if the expression extends beyond
     * > > the container’s width.
     * >
     * > **`width: '100%'`**
     * >
     * > > Gives the width for where displayed equations should be broken,
     * > > either as a fixed size (e.g. `'500px'` or `'20em'`), or as a
     * > > percentage of the container’s width (e.g., the default value of
     * > > `'100%'`).
     * >
     * > **`lineleading: .2`**
     * >
     * > > The amount of extra vertical space, in em units, to be inserted
     * > > between the lines of a displayed equation when it is broken.
     * >
     * > Note that in-line breaks can change when the window size changes, since
     * > they are handled by the browser; but displayed equations are broken
     * > when initially typeset, and the breaks are not altered after that
     * > unless you explicitly rerender the equation.
     * >
     * > See the [Automatic Line
     * > Breaking](https://docs.mathjax.org/en/v4.0/output/linebreaks.html#automatic-linebreaking)
     * > section for more details on controlling line breaking within
     * > expressions.
     */
    linebreaks?:
        | {
              /**
               * [MathJax v4.0 documentation for
               * `inline`](https://docs.mathjax.org/en/v4.0/options/output/#linebreaks-inline):
               *
               * > When set to true, in-line equations will be allowed to break (at
               * > locations that TeX would allow for linebreaks). The browser will
               * > then break the mathematics when needed, if the expression extends
               * > beyond the container’s width.
               *
               * @defaultValue
               * ```ts
               * true
               * ```
               */
              inline?: boolean;

              /**
               * [MathJax v4.0 documentation for
               * `width`](https://docs.mathjax.org/en/v4.0/options/output/#linebreaks-width):
               *
               * > Gives the width for where displayed equations should be broken,
               * > either as a fixed size (e.g. `'500px'` or `'20em'`), or as a
               * > percentage of the container’s width (e.g., the default value of
               * > `'100%'`).
               *
               * @defaultValue
               * ```ts
               * '100%'
               * ```
               */
              width?: string;

              /**
               * [MathJax v4.0 documentation for
               * `lineleading`](https://docs.mathjax.org/en/v4.0/options/output/#linebreaks-lineleading):
               *
               * > The amount of extra vertical space, in em units, to be
               * > inserted between the lines of a displayed equation when it is
               * > broken.
               *
               * @defaultValue
               * ```ts
               * 0.2
               * ```
               */
              lineleading?: number;

              /**
               * [MathJax v4.0 documentation for
               * `LinebreakVisitor`](https://docs.mathjax.org/en/v4.0/options/output/#output-linebreaks-linebreakvisitor):
               *
               * > The `LinebreakVisitor` object class to use for breaking long
               * > displayed equations. This allows you to create a subclass of the
               * > `LinebreakVisitor` class and pass that to the output jax in place
               * > of the usual one. MathJax will make an instance of the class you
               * > pass it, or of its default class if this value is `null`.
               *
               * @defaultValue
               * ```ts
               * null
               * ```
               */
              LinebreakVisitor?: object | null;
          }
        | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `font`](https://docs.mathjax.org/en/v4.0/options/output/#output-font):
     *
     * > This specifies the font to use from among the fonts available in
     * > MathJax, either as a name like `mathjax-stix2` or as a path to the font
     * > npm package, like
     * > `https://cdn.jsdelivr.net/npm/@mathjax/mathjax-stix2-font@4` for
     * > in-browser use, or `@mathjax/mathjax-stix2-font` for use in node.
     * >
     * > See the [MathJax Font
     * > Support](https://docs.mathjax.org/en/v4.0/output/fonts.html#font-support)
     * > section for more details about the fonts available and how to use them.
     *
     * @remarks
     * SvelTeX only supports specifying a font with the format
     * `'mathjax-<font>'` (e.g., `'mathjax-newcm'`).
     *
     * @defaultValue
     * ```ts
     * 'mathjax-newcm'
     * ```
     */
    font?: `mathjax-${MathjaxFont}` | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `fontPath`](https://docs.mathjax.org/en/v4.0/options/output/#output-fontpath):
     *
     * > This specifies the path for locating fonts by name. The default is
     * > `https://cdn.jsdelivr.net/npm/@mathjax/%%FONT%%-font` in the MathJax
     * > components for the browser, and `@mathjax/%%FONT%%-font` in node
     * > applications. Any occurrences of `%%FONT%%` in the path will be
     * > replaced by the font name when the font is accessed.
     *
     * @defaultValue
     * Depends on context. In the MathJax components for the browser, the
     * default is:
     *
     * ```ts
     * 'https://cdn.jsdelivr.net/npm/@mathjax/%%FONT%%-font'
     * ```
     *
     * In node applications, the default is:
     *
     * ```ts
     * '@mathjax/%%FONT%%-font'
     * ```
     */
    fontPath?: string;

    /**
     * [MathJax v4.0 documentation for
     * `htmlHDW`](https://docs.mathjax.org/en/v4.0/options/output/#output-htmlhdw):
     *
     * > This controls how MathJax handles the size of HTML code embedded in
     * > your mathematics when its top-level element has an `data-mjx-hdw`
     * > attribute that gives the size of the content. The possible values are:
     * >
     * > - `'ignore'` to ignore the value of `data-mjs-hdw`.
     * > - `'force'` to use the `data-mjx-hdw` values to surround the HTML with
     * >   additional nodes that force the HTML to have the given dimensions.
     * >   (This makes the result in node and the browser always be the same.)
     * > - `'use'` to assume the `data-mjx-hdw` values are correct so that
     * >   MathJax will use them in its size computations without forcing the
     * >   HTML to have the given dimensions.
     * > - `'auto'` to allow MathJax to determine which option to use; this will
     * >   be `ignore` when in the browser and `force` when in node
     * >   applications.
     *
     * > See [Specifying the size of HTML in
     * > Expressions](https://docs.mathjax.org/en/v4.0/input/html.html#specifying-htmlhdw)
     * > for more information, and for a tool for computing the values to use
     * > for the `data-mjx-hdw` attributes.
     *
     * @defaultValue
     * ```ts
     * 'auto'
     * ```
     */
    htmlHDW?: 'ignore' | 'force' | 'use' | 'auto';

    /**
     * [MathJax v4.0 documentation for
     * `preFilters`](https://docs.mathjax.org/en/v4.0/options/output/#output-prefilters):
     *
     * > This specifies a list of functions to run as pre-filters for the output
     * > jax. Each entry is either a function, or an array consisting of a
     * > function followed by a number, which is the priority of the pre-filter
     * > (lower priorities run first). The functions are passed an object with
     * > three properties: `math`, giving the `MathItem` being processed,
     * > `document` giving the `MathDocument` for the math item, and `data`
     * > giving the `mjx-container` DOM node for the math (empty at this point).
     * > The pre-filters are executed when the output jax is asked to typeset an
     * > expression, but before typesetting has occurred. The pre-filters can be
     * > used to adjust the internal MathML before any output is produced; the
     * > math item’s `root` property holds the internal structure.
     * >
     * > See the [MathJax Pre- and
     * > Post-Filters](https://docs.mathjax.org/en/v4.0/advanced/synchronize/filters.html#sync-filters)
     * > section for examples of pre-filters.
     *
     * @defaultValue
     * ```ts
     * []
     * ```
     */
    preFilters?: (
        | MathjaxFilterFunction<any, any, any>
        | [MathjaxFilterFunction<any, any, any>, number]
    )[];

    /**
     * [MathJax v4.0 documentation for
     * `postFilters`](https://docs.mathjax.org/en/v4.0/options/output/#output-postfilters):
     *
     * > This specifies a list of functions to run as post-filters for the TeX
     * > input jax. Each entry is either a function, or an array consisting of a
     * > function followed by a number, which is the priority of the pre-filter
     * > (lower priorities run first). The functions are passed an object with
     * > three properties: `math`, giving the `MathItem` being processed,
     * > `document` giving the `MathDocument` for the math item, and `data`
     * > giving the `mjx-container` DOM node for the math. The pre-filters are
     * > executed when the output jax has completed typesetting the expression
     * > into DOM elements, but before other actions involving the DOM tree for
     * > the expression (such as adding event handlers, adding speech, inserting
     * > it into the page, etc.) have occurred. The `mjx-container` now holds
     * > the DOM tree for the typeset math.
     * >
     * > See the [MathJax Pre- and
     * > Post-Filters](https://docs.mathjax.org/en/v4.0/advanced/synchronize/filters.html#sync-filters)
     * > section for examples of post-filters.
     *
     * @defaultValue
     * ```ts
     * []
     * ```
     */
    postFilters?: (
        | MathjaxFilterFunction<any, any, any>
        | [MathjaxFilterFunction<any, any, any>, number]
    )[];

    /**
     * [MathJax v4.0 documentation for
     * `wrapperFactory`](https://docs.mathjax.org/en/v4.0/options/output/#output-wrapperfactory):
     *
     * > The `WrapperFactory` object instance to use for creating wrappers for
     * > the internal MathML objects. This allows you to create a subclass of
     * > the `WrapperFactory` class, make an instance of it, and pass and
     * > instance of that to the output jax to use in place of the usual one. A
     * > `null` value means use the default `WrapperFactory` class and make a
     * > new instance of that.
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    wrapperFactory?: WrapperFactory<
        Node<Node<any, any>, NodeClass<any, any>>,
        NodeClass<Node<any, any>, NodeClass<any, any>>,
        Wrapper<Node<any, any>, NodeClass<any, any>, Wrapper<any, any, any>>,
        WrapperClass<
            Node<any, any>,
            NodeClass<any, any>,
            Wrapper<any, any, any>
        >
    > | null;

    /**
     * ⚠ **Warning:** SvelTeX sets this property itself, and recommends that you
     * control the font via the
     * {@link SveltexMathjaxConfig.font | `SveltexMathjaxConfig.font`} instead.
     *
     * [MathJax v4.0 documentation for
     * `fontData`](https://docs.mathjax.org/en/v4.0/options/output/#output-fontdata):
     *
     * > The `FontData` object instance to use for the font to use. This is
     * > usually obtained from a font package, such as `MathJaxNewcmFont`
     * > imported from `@mathjax/mathjax-newcm-font/js/chtml.js`. This allows
     * > you to override the default font with a different one. It is also
     * > possible to subclass one of the MathJax fonts, make an instance of
     * > that, and pass that to the output jax to use in place of its usual one.
     * > A `null` value means use the default `FontData` class (the
     * > `mathjax-newcm` font) and make a new instance of that.
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    fontData?: FontData<
        CharOptions,
        VariantData<CharOptions>,
        DelimiterData
    > | null;

    /**
     * [MathJax v4.0 documentation for
     * `cssStyles`](https://docs.mathjax.org/en/v4.0/options/output/#output-cssstyles):
     *
     * > The `CssStyles` object instance to use for collecting the CSS styles
     * > from the various MathML classes, the font, and so on. This allows you
     * > to create a subclass of the `CssStyles` class, make an instance of it,
     * > and pass that to the output jax in place of the usual one. A `null`
     * > value means use the default `CssStyles` class and make a new instance
     * > of that.
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    cssStyles?: unknown;
}

/**
 * SVG options.
 */
interface MathjaxSvgOutputProcessorOptions
    extends MathjaxCommonOutputProcessorOptions {
    /**
     * [MathJax v4.0 documentation for
     * `blacker`](https://docs.mathjax.org/en/v4.0/options/output/svg.html#svg-blacker):
     *
     * > This specifies the stroke-width to use for SVG character paths in units
     * > that are 1/1000 of an em. Enlarging this makes the characters a bit
     * > bolder, but can also cause them to render poorly, as some details may
     * > begin to overlap and become unreadable. You probably don’t want to go
     * > above 20 or so.
     *
     * @defaultValue
     * ```ts
     * 3
     * ```
     */
    blacker?: number;

    /**
     * [MathJax v4.0 documentation for
     * `fontCache`](https://docs.mathjax.org/en/v4.0/options/output/svg.html#svg-fontcache):
     *
     * > This setting determines how the SVG output jax manages characters that
     * > appear multiple times in an equation or on a page. The SVG processor
     * > uses SVG paths to display the characters in your math expressions, and
     * > when a character is used more than once, it is possible to reuse the
     * > same path description; this can save space in the SVG image, as the
     * > paths can be quite complex. When set to `'local'`, MathJax will cache
     * > font paths on an express-by-expression (each expression has its own
     * > cache within the SVG image itself), which makes the SVG self-contained,
     * > but still allows for some savings if characters are repeated. When set
     * > to `'global'`, a single cache is used for all paths on the page; this
     * > gives the most savings, but makes the images dependent on other
     * > elements of the page. When set to `'none'`, no caching is done and
     * > explicit paths are used for every character in the expression.
     *
     * @defaultValue
     * ```ts
     * 'local'
     * ```
     */
    fontCache?: 'local' | 'global' | 'none';

    /**
     * [MathJax v4.0 documentation for
     * `useXlink`](https://docs.mathjax.org/en/v4.0/options/output/svg.html#svg-usexlink):
     *
     * > When a font cache is used, MathJax employs `<use>` tags to access the
     * > character path definitions. Traditionally, the `href` attributes that
     * > reference the path IDs are required to be in the `xlink` namespace, and
     * > so appear as `xlink:href`. HTML5 has deprecated namespaces, so in HTML
     * > pages, they should appear as plain `href` attributes instead. The
     * > `useXlink` attribute determines whether the `xlink` namespace should be
     * > included in the `href` attributes or not.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    useXlink?: boolean;

    /**
     * [MathJax v4.0 documentation for
     * `localID`](https://docs.mathjax.org/en/v4.0/options/output/svg.html#svg-localid):
     *
     * > This gives the ID prefix to use for the paths stored in a local font
     * > cache when `fontCache` is set to `'local'`. This is useful if you need
     * > to process multiple equations by hand and want to generate unique ids
     * > for each equation, even if MathJax is restarted between equations. If
     * > set to `null`, no prefix is used.
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     *
     * @defaultValue
     * ```ts
     * null
     * ```
     */
    localID?: string | null;
}

/**
 * These options control the operation of the
 * {@link https://docs.mathjax.org/en/latest/output/html.html#html-output | CommonHTML output processor}
 * that is run when you include `'output/chtml'` in the load array of the loader
 * block of your MathJax configuration, or if you load a combined component that
 * includes the CommonHTML output jax. They are listed with their default
 * values. To set any of these options, include a chtml section in your MathJax
 * global object.
 */
interface MathjaxChtmlOutputProcessorOptions
    extends MathjaxCommonOutputProcessorOptions {
    /**
     * Set to `true` to match x-height of surrounding font.
     *
     * [MathJax v4.0 documentation for
     * `matchFontHeight`](https://docs.mathjax.org/en/v4.0/options/output/chtml.html#chtml-matchfontheight):
     *
     * > This setting controls whether MathJax will scale the mathematics so
     * > that the ex-height of the math fonts matches the ex-height of the
     * > surrounding fonts. This makes the math match the surroundings better,
     * > but if the surrounding font does not have its ex-height set properly
     * > (and not all fonts do), it can cause the math to not match the
     * > surrounding text.
     * >
     * > While a true value will make the lower-case letters match the
     * > surrounding fonts, the upper case letters may not match (that would
     * > require the font height and ex-height to have the same ratio in the
     * > surrounding text as in the math fonts, which is unlikely).
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    matchFontHeight?: boolean;

    /**
     * [MathJax v4.0 documentation for
     * `fontURL`](https://docs.mathjax.org/en/v4.0/options/output/chtml.html#chtml-fonturl)
     * (**warning:** the font URL in the documentation example is incorrect,
     * it's missing a version specifier):
     *
     * > This is the URL to the location where the MathJax fonts are stored. The
     * > `URL` is set up by the default font to point to its CDN location. For
     * > the `mathjax-newcm` font, the `URL` would be set to
     * > `https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font/chtml/woff2`,
     * > for example.
     * >
     * > While v3 included the fonts as part of the MathJax distribution, in v4,
     * > the fonts are in separate npm packages. Each font sets up its own
     * > location when it is loaded, and the default is to take the fonts from
     * > `cdn.jsdelivr.net`. If you are serving your own copy of MathJax, you
     * > may want to include your own copy of the fonts, and so may need to set
     * > this value accordingly.
     *
     * @defaultValue
     * ```ts
     * 'https://cdn.jsdelivr.net/npm/@mathjax/mathjax-newcm-font@latest/chtml/woff2'
     * ```
     */
    fontURL?: string;

    /**
     * [MathJax v4.0 documentation for
     * `dynamicPrefix`](https://docs.mathjax.org/en/v4.0/options/output/chtml.html#chtml-dynamicprefix):
     *
     * > This is the location where MathJax should look for font data that has
     * > to be loaded dynamically. The `URL` is set up by the default font to
     * > point to its CDN location. For the `mathjax-newcm` font, the `URL`
     * > would be set to `[mathjax-newcm]/chtml/dynamic`, for example, with the
     * > `[mathjax-newcm]` path being set to the CDN location.
     * >
     * > Version 3 included all the font data in one file, but in v4, where the
     * > fonts include much greater character coverage, the fonts are broken
     * > into several smaller pieces that are loaded only when needed.
     */
    dynamicPrefix?: string;

    /**
     * [MathJax v4.0 documentation for
     * `adaptiveCSS`](https://docs.mathjax.org/en/v4.0/options/output/chtml.html#chtml-adaptivecss):
     *
     * > This setting controls how the CommonHTML output jax handles the CSS
     * > styles that it generates. When true, this means that only the CSS
     * > needed for the math that has been processed on the page so far is
     * > generated. When false, the CSS needed for all elements and all
     * > characters in the MathJax font are generated. This is an extremely
     * > large amount of CSS, and that can have an effect on the performance of
     * > your page, so it is best to leave this as `true`. You can reset the
     * > information about what CSS is needed by using the command
     * >
     * > ```ts
     * > MathJax.startup.document.output.clearCache();
     * > ```
     * >
     * > to clear the font cache.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    adaptiveCSS?: boolean;
}

interface MathjaxDocumentOptions {
    /**
     * [MathJax v4.0 documentation for
     * `skipHtmlTags`](https://docs.mathjax.org/en/v4.0/options/document.html#skiphtmltags):
     *
     * > This array lists the names of the tags whose contents should not be
     * > processed by MathJax (other than to look for ignore/process classes as
     * > listed below). You can add to (or remove from) this list to prevent
     * > MathJax from processing mathematics in specific contexts. E.g.,
     * >
     * > ```ts
     * > skipHtmlTags: {'[-]': ['code', 'pre'], '[+]': ['li']}
     * > ```
     * >
     * > would remove 'code' and 'pre' tags from the list, while adding 'li'
     * > tags to the list.
     *
     * @defaultValue
     * ```ts
     * ['script', 'noscript', 'style', 'textarea', 'pre',
     * 'code', 'math' 'select', 'option', 'mjx-container']
     * ```
     */
    skipHtmlTags?: string[] | { '[+]'?: string[]; '[-]'?: string[] };

    /**
     * [MathJax v4.0 documentation for
     * `includeHtmlTags`](https://docs.mathjax.org/en/v4.0/options/document.html#includehtmltags):
     *
     * > This object specifies what tags can appear within a math expression,
     * > and what text to replace them by within the math. The default is to
     * > allow `<br>`, which becomes a newline, and `<wbr>` and HTML comments,
     * > which are removed entirely.
     * >
     * > The value associate with a tag is either a string, which replaces the
     * > tag in the math string, or a function of the form `(node, adaptor) =>
     * > string` that takes two arguments, the DOM node matching the given tag
     * > and the current DOM adaptor, and returns the replacement string for the
     * > DOM node in the math string.
     *
     * @defaultValue
     * ```ts
     * { br: '\n', wbr: '', '#comment': '' }
     * ```
     */
    includeHtmlTags?: Record<string, string>;

    /**
     * [MathJax v4.0 documentation for
     * `ignoreHtmlClass`](https://docs.mathjax.org/en/v4.0/options/document.html#ignorehtmlclass):
     *
     * > This is the class name used to mark elements whose contents should not
     * > be processed by MathJax (other than to look for the `processHtmlClass`
     * > pattern below). Note that this is a regular expression, and so you need
     * > to be sure to quote any regexp special characters. The pattern is
     * > inserted into one that requires your pattern to match a complete word,
     * > so setting `ignoreHtmlClass: 'class2'` would cause it to match an
     * > element with `class='class1 class2 class3'` but not `class='myclass2'`.
     * > Note that you can assign several classes by separating them by the
     * > vertical line character (`|`). For instance, with `ignoreHtmlClass:
     * > 'class1|class2'` any element assigned a class of either `class1` or
     * > `class2` will be skipped. This could also be specified by
     * > `ignoreHtmlClass: 'class[12]'`, which matches `class` followed by
     * > either a `1` or a `2`.
     *
     * @defaultValue
     * ```ts
     * 'mathjax_ignore'
     * ```
     */
    ignoreHtmlClass?: string;

    /**
     * [MathJax v4.0 documentation for
     * `processHtmlClass`](https://docs.mathjax.org/en/v4.0/options/document.html#processhtmlclass):
     *
     * > This is the class name used to mark elements whose contents should be
     * > processed by MathJax. This is used to restart processing within tags
     * > that have been marked as ignored via the `ignoreHtmlClass` or to cause
     * > a tag that appears in the `skipHtmlTags` list to be processed rather
     * > than skipped. Note that this is a regular expression, and so you need
     * > to be sure to quote any regexp special characters. The pattern is
     * > inserted into one that requires your pattern to match a complete word,
     * > so setting `processHtmlClass: 'class2'` would cause it to match an
     * > element with `class='class1 class2 class3'` but not `class='myclass2'`.
     * > Note that you can assign several classes by separating them by the
     * > vertical line character (`|`). For instance, with `processHtmlClass:
     * > 'class1|class2'` any element assigned a class of either `class1` or
     * > `class2` will have its contents processed. This could also be specified
     * > by `processHtmlClass: 'class[12]'`, which matches `class` followed by
     * > either a `1` or a `2`.
     *
     * @defaultValue
     * ```ts
     * 'mathjax_process'
     * ```
     */
    processHtmlClass?: string;

    /**
     * [MathJax v4.0 documentation for
     * `compileError`](https://docs.mathjax.org/en/v4.0/options/document.html#document-compileerror):
     *
     * > This is the function called whenever there is an uncaught error while
     * > an input jax is running (i.e., during the document’s `compile()` call).
     * > The arguments are the `MathDocument` in which the error occurred, the
     * > `MathItem` for the expression where it occurred, and the `Error` object
     * > for the uncaught error. The default action is to call the document’s
     * > default
     * > [`compileError()`](https://docs.mathjax.org/en/v4.0/web/errors.html#compileError)
     * > function, which sets `math.root` to a math element containing an error
     * > message (i.e., `<math><merror><mtext>Math input
     * > error<mtext></merror></math>`). You can replace this with your own
     * > function for trapping run-time errors in the input processors.
     *
     * @defaultValue
     * ```ts
     * function (doc, math, err) {
     *     doc.compileError(math, err);
     * }
     * ```
     */
    compileError?: (
        doc: MathDocument<any, any, any>,
        math: MathItem<any, any, any>,
        err: Error,
    ) => void;

    /**
     * [MathJax v4.0 documentation for
     * `typesetError`](https://docs.mathjax.org/en/v4.0/options/document.html#document-typeseterror):
     *
     * > This is the function called whenever there is an uncaught error while
     * > an output jax is running (i.e., during the document’s `typeset()`
     * > call). The arguments are the `MathDocument` in which the error
     * > occurred, the `MathItem` for the expression where it occurred, and the
     * > `Error` object for the uncaught error. The default action is to call
     * > the document’s default
     * > [`typesetError()`](https://docs.mathjax.org/en/v4.0/web/errors.html#typesetError)
     * > function, which sets `math.typesetRoot` to a `<span>` element
     * > containing the text `Math output error`. You can replace this with your
     * > own function for trapping run-time errors in the output processors.
     *
     * @defaultValue
     * ```ts
     * function (doc, math, err) {
     *     doc.typesetError(math, err);
     * }
     * ```
     */
    typesetError?: (
        doc: MathDocument<any, any, any>,
        math: MathItem<any, any, any>,
        err: Error,
    ) => void;

    /**
     * [MathJax v4.0 documentation for
     * `renderActions`](https://docs.mathjax.org/en/v4.0/options/document.html#document-renderactions):
     *
     * > This is an object that specifies the actions to take during the
     * > [`MathJax.typeset()`](https://docs.mathjax.org/en/v4.0/web/typeset.html#MathJax.typeset)
     * > (and its underlying `MathJax.startup.document.render()` call), and the
     * > various conversion functions, such as
     * > [`MathJax.tex2svg()`](https://docs.mathjax.org/en/v4.0/web/convert.html#MathJax.tex2svg)
     * > (and their underlying `MathJax.startup.document.convert()` call), and
     * > during the promise-based versions of all these functions. The structure
     * > of the object is `name: value` pairs separated by commas, where the
     * > `name` gives an identifier for each action, and the `value` is an array
     * > consisting of a number and zero, one, or two functions, followed
     * > optionally by a boolean value.
     * >
     * > The number gives the priority of the action (lower numbers are executed
     * > first when the actions are performed). The first function gives the
     * > action to perform when a document is rendered as a whole, and the
     * > second a function to perform when an individual expression is converted
     * > or re-rendered. These can be given either as an explicit function, or
     * > as a string giving the name of a method to call (the first should be a
     * > method of a `MathDocument`, and the second of a `MathItem`). If either
     * > is an empty string, that action is not performed. If the function is
     * > missing, the method name is taken from the `name` of the action. The
     * > boolean value tells whether the second function should be performed
     * > during a `convert()` call (when true) or only during a `rerender()`
     * > call (when false).
     * >
     * > For example,
     * >
     * > ```ts
     * > MathJax = {
     * >   options: {
     * >     renderActions: {
     * >       compile: [MathItem.STATE.COMPILED],
     * >       metrics: [MathItem.STATE.METRICS, 'getMetrics', '', false]
     * >     }
     * >   }
     * > };
     * > ```
     * >
     * > specifies two actions, the first called `compile` that uses the
     * > `compile()` method of the `MathDocument` and `MathItem`, and the second
     * > called `metrics` that uses the `getMetrics()` call for the
     * > `MathDocument` when the document is rendered, but does nothing during a
     * > `rerender()` or `convert()` call on an individual `MathItem`.
     * >
     * > If the first function is given explicitly, it should take one argument,
     * > the `MathDocument` on which it is running. If the second function is
     * > given explicitly, it should take two arguments, the `MathItem` that is
     * > being processed, and the `MathDocument` in which it exists.
     * >
     * > The default value includes actions for the main calls needed to perform
     * > rendering of math: `find`, `compile`, `metrics`, `typeset`, and
     * > `update`. These find the math in the document, call the input jax on
     * > the math that was located, obtain the metric information for the
     * > location of the math, call the output jax to convert the internal
     * > format to the output format, and insert the output into the document.
     * >
     * > You can add your own actions by adding new named actions to the
     * > `renderActions` object, or override existing ones by reusing an
     * > existing name from above. See the [MathML
     * > Support](https://docs.mathjax.org/en/v4.0/output/mathml.html#mathml-output)
     * > section for an example of doing this. The priority number tells where
     * > in the list your actions will be performed.
     * >
     * > Loading extensions may cause additional actions to be inserted into the
     * > list. For example, the
     * > [ui/menu](https://docs.mathjax.org/en/v4.0/web/components/misc.html#menu-component)
     * > component inserts an action to add the menu event handlers to the math
     * > after it is inserted into the page.
     * >
     * > See the [MathJax Render
     * > Actions](https://docs.mathjax.org/en/v4.0/advanced/synchronize/renderactions.html#sync-renderactions)
     * > section for more information and examples.
     */
    renderActions?: Record<
        string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        [number, Function | string, Function | string | boolean]
    >;

    // The developer options `OutputJax`, `InputJax`, `MmlFactory`, `MathList`,
    // and `MathItem` are not included. For some of them, this is because
    // messing with them could mess with SvelTeX's MathJax setup. For others, I
    // don't recall why I didn't include them.
}

interface MathjaxSemanticEnrichOptions {
    /**
     * [MathJax v4.0 documentation for
     * `enableEnrichment`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#semantic-enrich-enableenrichment):
     *
     * > This setting controls whether semantic enrichment is applied to the
     * > internal MathML representation of the mathematics in the page when the
     * > _semantic-enrich_ extension is loaded. This is controlled automatically
     * > by the settings of the context menu, so you should use those to control
     * > semantic-enrichment if the menu component is present. If not, you can
     * > use it to disable semantic enrichment if the _semantic-enrich_
     * > component has been loaded automatically and you don’t need it.
     *
     * @remarks
     * If this is set to `true`, SvelTeX will load the `semantic-enrich`
     * extension and turn semantic enrichment on. If this option is `false`,
     * SvelTeX won't load the `semantic-enrich` extension to begin with.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    enableEnrichment?: boolean | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `enrichError`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#semantic-enrich-error):
     *
     * > This setting provides a function that gets called when the semantic
     * > enrichment process fails for some reason. The default is to call the
     * > MathDocument’s `enrichError()` method, which simply prints a warning
     * > message in the browser console window. The original (unenriched) MathML
     * > will be used for the output of the expression. You can override the
     * > default behavior by providing a function that does whatever you want,
     * > such as recording the error, or replacing the original MathML with
     * > alternative MathML containing an error message.
     *
     * @remarks
     * This property is only relevant if semantic enrichment is enabled
     * (see {@link enableEnrichment | `enableEnrichment`}).
     */
    enrichError?(
        doc: EnrichedMathDocument<any, any, any>,
        math: EnrichedMathItem<any, any, any>,
        err: Error,
    ): void;
}

interface MathjaxSpeechOptions {
    /**
     * [MathJax v4.0 documentation for
     * `enableSpeech`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-enablespeech):
     *
     * > This setting controls whether speech strings are generated and attached
     * > to the DOM elements within the page when the _speech_ extension is
     * > loaded. This is controlled automatically by the settings of the context
     * > menu, so you should use those to control speech generation if the menu
     * > component is present. If not, you can use it to disable _speech_
     * > generation if the speech component has been loaded automatically and
     * > you don’t need it.
     *
     * @remarks
     * If this is set to `true`, SvelTeX will load the `speech` extension and
     * turn speech generation on. If both this option and
     * {@link enableBraille | `enableBraille`} are `false`, SvelTeX won't load
     * the `speech` extension.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    enableSpeech?: boolean | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `enableBraille`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-enablebraille):
     *
     * > This setting controls whether Braille labels are generated and attached
     * > to the DOM elements within the page when the `speech` extension is
     * > loaded. This is controlled automatically by the settings of the context
     * > menu, so you should use those to control Braille labels if the menu
     * > component is present. If not, you can use it to disable Braille
     * > generation if the `speech` component has been loaded automatically and
     * > you don’t need it.
     *
     * @remarks
     * If this is set to `true`, SvelTeX will load the `speech` extension and
     * turn speech generation on. If both this option and
     * {@link enableSpeech | `enableSpeech`} are `false`, SvelTeX won't load the
     * `speech` extension.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    enableBraille?: boolean | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `speechError`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-error):
     *
     * > This setting provides a function that gets called when the speech or Braille generation fails for some reason. The default is to call the MathDocument’s `speechError()` method, which simply prints a warning message in the browser console window. You can override the default behavior by providing a function that does whatever you want, such as recording the error.
     */
    speechError?(doc: unknown, math: unknown, err: Error): void;
    /**
     * [MathJax v4.0 documentation for
     * `sre`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-sre):
     *
     * > This block sets configuration values for the Speech-Rule Engine (SRE)
     * > that underlies MathJax’s speech and Braille features. See the [SRE
     * > documentation](https://github.com/zorkow/speech-rule-engine/tree/master#options-to-control-speech-output)
     * > for more details.
     *
     * @remarks
     * [Note from SRE
     * documentation](https://github.com/Speech-Rule-Engine/speech-rule-engine/tree/master?tab=readme-ov-file#options-to-control-speech-output):
     *
     * > Observe that not every _domain_ (i.e., speech rule set) implements
     * > every style. Similarly, not every speech rule set is implemneted in
     * > every locale. For a more detailed overview of `locale, domain, style`
     * > combinations, use the `--opt` switch on the command line interface.
     *
     * To see all possible `locale`-`domain`-`style` combinations, you can run
     * something like `pnpm dlx speech-rule-engine --opt-all` (or `pnpm dlx
     * speech-rule-engine --opt-all -P` to get markdown output) (you can also
     * use a different package manager instead of PNPM, of course).
     */
    sre?:
        | {
              /**
               * Speech rule set, i.e., domain or subject area of speech rules.
               *
               * @defaultValue
               * ```ts
               * 'mathspeak'
               * ```
               */
              domain?:
                  | 'chromevox'
                  | 'clearspeak'
                  | 'default'
                  | 'emacspeak'
                  | 'mathspeak'
                  | undefined;

              /**
               * Style to use for the speech rules.
               *
               * @defaultValue
               * ```ts
               * 'default'
               * `
               */
              style?:
                  | 'default'
                  | 'brief'
                  | 'sbrief'
                  | 'alternative'
                  | 'literary'
                  | 'physics'
                  | 'plural'
                  | undefined;

              /**
               * Language locale (some ISO 639-1 codes and `'euro'` (Braille) and
               * `'nemeth'`).
               *
               * @defaultValue
               * ```ts
               * 'en'
               * ```
               */
              locale?:
                  | 'en'
                  | 'af'
                  | 'ca'
                  | 'da'
                  | 'de'
                  | 'es'
                  | 'euro'
                  | 'fr'
                  | 'hi'
                  | 'it'
                  | 'ko'
                  | 'nb'
                  | 'nn'
                  | 'sv'
                  | 'nemeth'
                  | undefined;
          }
        | undefined;

    /**
     * [MathJax v4.0 documentation for
     * `a11y`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-a11y):
     *
     * > This block gives boolean values that essentially duplicate the
     * > `enableSpeech` and `enableBraille` values above.
     *
     * @remarks
     * ⚠ SvelTeX passes these options to MathJax, but they have no effect on
     * SvelTeX's decision of whether to load the `speech` extension or not —
     * that is based solely on the {@link enableSpeech | `enableSpeech`} and
     * {@link enableBraille | `enableBraille`} options. As such, if
     * `enableSpeech` and `enableBraille` are both `false`, the `a11y` options
     * will have no effect.
     */
    a11y?: {
        /**
         * [MathJax v4.0 documentation for
         * `speech`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`switch on speech output when enabled`_
         *
         * @defaultValue
         * ```ts
         * true
         * ```
         */
        speech?: boolean | undefined;

        /**
         * [MathJax v4.0 documentation for
         * `braille`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`switch on Braille output when enabled`_
         *
         * @defaultValue
         * ```ts
         * true
         * ```
         */
        braille?: boolean | undefined;
    };

    /**
     * [MathJax v4.0 documentation for
     * `worker`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-worker):
     *
     * > This block gives parameters that control the speech generation, which is performed using webworkers so that this time-consuming process will not interfere with the responsiveness of the page. You should not need to change these.
     */
    worker?: {
        /**
         * [MathJax v4.0 documentation for
         * `srePath`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`full path to bundle/a11y/sre (set automatically)`_
         *
         * @defaultValue
         * ```ts
         * 'path-to-bundle/a11y/sre'
         * ```
         */
        path?: string | undefined;

        /**
         * [MathJax v4.0 documentation for
         * `srePool`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`name of worker-pool file to load in an iframe`_
         *
         * @defaultValue
         * ```ts
         * 'speech-workerpool.html'
         * ```
         */
        pool?: string | undefined;

        /**
         * [MathJax v4.0 documentation for
         * `worker`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`name of worker script to load as a webworker`_
         *
         * @defaultValue
         * ```ts
         * 'speech-worker.js'
         * ```
         */
        worker?: string | undefined;

        /**
         * [MathJax v4.0 documentation for
         * `debug`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#speech-extension-options):
         *
         * > _`true to include debugging messages in the browser console about
         * > the communications between the page, worker pool, and workers.`_
         *
         * @defaultValue
         * ```ts
         * false
         * ```
         */
        debug?: boolean | undefined;
    };
}

/**
 * @see
 * https://docs.mathjax.org/en/v4.0/options/accessibility.html#assisitve-mml-extension-options
 */
interface MathjaxAssistiveMmlOptions {
    /**
     * [MathJax v4.0 documentation for
     * `enableAssistiveMml`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#assistivemml-enableassistivemml):
     *
     * > This setting controls whether the _assistive-mml_ extension is to run
     * > or not when it is loaded. The value is controlled automatically by the
     * > settings of the context menu, so when the menu component is present,
     * > you should use those to control whether assistive MathML is inserted.
     * > If the menu is not available, you can use this option to disable the
     * > assistive MathML if the _assistive-mml_ component has been loaded
     * > automatically and you don’t need it.
     *
     * @remarks
     * In MathJax v3, assistive MML was active by default. However, in MathJax
     * v4, this is no longer the case, and instead other accessibility tools are
     * active by default. However, due to SvelTeX being purely a pre-processor
     * (i.e., foregoing any runtime functionality), some of these accessibility
     * tools (e.g., the contextual menu, the explorer extension, and the
     * complexity extension) are not supported, since they would require running
     * MathJax in the browser. For this reason, SvelTeX turns assistive MML on
     * by default.
     *
     * @remarks
     * If this is set to `true`, SvelTeX will load the `assistive-mml` extension
     * and turn assistive MML on. If this option is `false`, SvelTeX won't load
     * the `assistive-mml` extension.
     *
     * @defaultValue
     * ```
     * true
     * ```
     */
    enableAssistiveMml?: boolean | undefined;
}

/**
 * @see
 * https://docs.mathjax.org/en/v4.0/options/accessibility.html#explorer-extension-options
 */
interface MathjaxExplorerOptions {
    /**
     * ⚠ **Warning:** Being purely a pre-processor (i.e., foregoing any runtime
     * functionality), SvelTeX's MathJax integration doesn't support MathJax's
     * `explorer` extension, since this would require running MathJax in the
     * browser.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    enableExplorer?: false | undefined;
}

interface MathjaxComplexityOptions {
    /**
     * ⚠ **Warning:** Being purely a pre-processor (i.e., foregoing any runtime
     * functionality), SvelTeX's MathJax integration doesn't support the
     * `complexity` extension's core feature making complex subexpressions
     * collapsible. However, since the complexity computations themselves can
     * take place at build-time, the extension _can_ be used for those.
     *
     * [MathJax v4.0 documentation for
     * `enableComplexity`](https://docs.mathjax.org/en/v4.0/options/accessibility.html#complexity-enablecomplexity)
     *
     * > This setting controls whether the _complexity_ extension is to run or
     * > not when it is loaded. The value is controlled automatically by the
     * > settings of the context menu, so you should use those to control the
     * > complexity computations if the menu component is present. If not, you
     * > can use it to disable the computations if the _complexity_ component
     * > has been loaded automatically and you don’t need it.
     *
     * @remarks
     * If this is set to `true`, SvelTeX will load the `complexity` extension
     * and turn it on. If this option is `false`, SvelTeX won't load the
     * `complexity` extension.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    enableComplexity?: boolean | undefined;
}

interface MathjaxContextualMenuOptions {
    /**
     * ⚠ **Warning:** Being purely a pre-processor (i.e., foregoing any runtime
     * functionality), SvelTeX's MathJax integration doesn't support MathJax's
     * contextual menu, since this would require running MathJax in the browser.
     *
     * @defaultValue
     * ```ts
     * false
     * ```
     */
    enableMenu?: false | undefined;

    /**
     * ⚠ **Warning:** Being purely a pre-processor (i.e., foregoing any runtime
     * functionality), SvelTeX's MathJax integration doesn't support MathJax's
     * contextual menu, since this would require running MathJax in the browser.
     */
    menuOptions?: never;
}
