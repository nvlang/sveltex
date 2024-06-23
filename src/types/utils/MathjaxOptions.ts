/* eslint-disable @typescript-eslint/no-unused-vars */
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
     */
    mml?: MathjaxMathmlInputProcessorOptions | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MathjaxOptions extends MathjaxDocumentOptions {}

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
     */
    display?: boolean;

    /**
     * Number of pixels in an em for the surrounding font.
     *
     * @defaultValue `16`
     */
    em?: number;

    /**
     * Number of pixels in an ex for the surrounding font.
     *
     * @defaultValue `8`
     */
    ex?: number;

    /**
     * Width of the container, in pixels.
     *
     * @defaultValue `80 * ex`
     */
    containerWidth?: number;

    /**
     * A number giving the line-breaking width in em units. Default is a very
     * large number, so effectively no line breaking.
     *
     * @defaultValue `100000`
     */
    lineWidth?: number;

    /**
     * Scaling factor to apply to the resulting conversion.
     *
     * @defaultValue `1`
     */
    scale?: number;
}

/**
 * There are no options that are common to all input jax, but a number of the
 * [Document
 * Options](https://docs.mathjax.org/en/latest/options/document.html#document-options)
 * affect what portions of the document will be processed by the input jax that
 * scan the page for delimiters (i.e., TeX and AsciiMath). In particular, the
 * options that correspond to the version-2 options `skipTags`, `includeTags`,
 * and similar options for the various v2 pre-processors are now document-level
 * options.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MathjaxCommonInputProcessorOptions {}

/**
 * These options control the operation of the [AsciiMath input
 * processor](https://docs.mathjax.org/en/latest/basic/mathematics.html#asciimath-input)
 * that is run when you include `'input/asciimath'` in the in the `load` array
 * of the `loader` block of your MathJax configuration, or if you load a
 * combined component that includes the AsciiMath input jax (none currently do,
 * since the AsciiMath input has not been fully ported to version 3). They are
 * listed with their default values. To set any of these options, include an
 * `asciimath` section in your `MathJax` global object.
 */
// @ts-expect-error We include this interface for the sake of completeness, even
// if it's unused.
interface MathjaxAsciimathInputProcessorOptions
    extends MathjaxCommonInputProcessorOptions {
    /**
     * Specifies whether to use TeX mapping or unicode mapping for the `fixphi`
     * option.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * Determines whether MathJax will switch the Unicode values for `phi` and
     * `varphi`. If set to true MathJax will use the TeX mapping, otherwise the
     * Unicode mapping.
     */
    fixphi?: boolean;

    /**
     * Specifies whether to use displaystyle typesetting or in-line typesetting
     * for the `displaystyle` option.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     *
     * Determines whether operators like summation symbols will have their
     * limits above and below the operators (true) or to their right (false).
     * The former is how they would appear in displayed equations that are shown
     * on their own lines, while the latter is better suited to in-line
     * equations so that they don’t interfere with the line spacing so much.
     */
    displaystyle?: boolean;

    /**
     * Specifies the character to use for the decimal separator for the
     * `decimalsign` option.
     *
     * @defaultValue `'.'`
     *
     * This is the character to be used for decimal points in numbers. If you
     * change this to `','`, then you need to be careful about entering points
     * or intervals. E.g., use `(1, 2)` rather than `(1,2)` in that case.
     */
    decimalsign?: string;

    /**
     * The `FindAsciiMath` object instance that will override the default one.
     * This allows you to create a subclass of `FindAsciiMath` and pass that to
     * the AsciiMath input jax. A `null` value means use the default
     * `FindAsciiMath` class and make a new instance of that.
     *
     * @defaultValue `null`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    FindAsciiMath?: unknown;
}

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
     * Extensions to use.
     *
     * @defaultValue `['base']`
     *
     * This array lists the names of the packages that should be initialized by
     * the TeX input processor. The
     * [`input/tex`](https://docs.mathjax.org/en/latest/basic/mathematics.html#tex-input)
     * and
     * [`input/tex-full`](https://docs.mathjax.org/en/latest/basic/mathematics.html#tex-input)
     * components automatically add to this list the packages that they load. If
     * you explicitly load additional tex extensions, you should add them to
     * this list.
     *
     * @example
     * ```ts
     * MathJax = {
     *   loader: {load: ['[tex]/enclose']},
     *   tex: {
     *     packages: {'[+]': ['enclose']}
     *   }
     * };
     * ```
     *
     * This loads the enclose extension and activates it by including it in the
     * package list.
     *
     * You can remove packages from the default list using `'[-]'` rather than
     * `'[+]'`, as in the followiong example:
     *
     * ```ts
     * MathJax = {
     *   tex: {
     *     packages: {'[-]': ['noundefined']}
     *   }
     * };
     * ```
     *
     * This would disable the
     * [`noundefined`](https://docs.mathjax.org/en/latest/input/tex/extensions/noundefined.html#tex-noundefined)
     * extension, so that unknown macro names would cause error messages rather
     * than be displayed in red.
     *
     * If you need to both remove some default packages and add new ones, you
     * can do so by including both within the braces:
     *
     * ```ts
     * MathJax = {
     *   loader: {load: ['[tex]/enclose']},
     *   tex: {
     *     packages: {'[-]': ['noundefined', 'autoload'], '[+]': ['enclose']}
     *   }
     * };
     * ```
     *
     * This disables the
     * [`noundefined`](https://docs.mathjax.org/en/latest/input/tex/extensions/noundefined.html#tex-noundefined)
     * and
     * [`autoload`](https://docs.mathjax.org/en/latest/input/tex/extensions/autoload.html#tex-autoload)
     * extensions, and adds in the
     * [`enclose`](https://docs.mathjax.org/en/latest/input/tex/extensions/enclose.html#tex-enclose)
     * extension.
     */
    packages?: string[];

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

    /* eslint-disable tsdoc/syntax */
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
    /* eslint-enable tsdoc/syntax */
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

    /* eslint-disable tsdoc/syntax */
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
    /* eslint-enable tsdoc/syntax */
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

interface MathjaxCommonOutputProcessorOptions {
    /**
     * Global scaling factor for all expressions.
     *
     * The scaling factor for math compared to the surrounding text. The
     * CommonHTML output processor tries to match the ex-size of the mathematics
     * with that of the text where it is placed, but you may want to adjust the
     * results using this scaling factor. The user can also adjust this value
     * using the contextual menu item associated with the typeset mathematics.
     *
     * @defaultValue `1`
     */
    scale?: number;

    /**
     * Smallest scaling factor to use.
     *
     * This gives a minimum scale factor for the scaling used by MathJax to
     * match the equation to the surrounding text. This will prevent MathJax
     * from making the mathematics too small.
     *
     * @defaultValue `0.5`
     */
    minScale?: number;

    /**
     * True to make mtext elements use surrounding font.
     *
     * This setting controls whether <mtext> elements will be typeset using the
     * math fonts or the font of the surrounding text. When false, the mtextFont
     * will be used, unless it is blank, in which case math fonts will be used,
     * as they are for other token elements; when true, the font will be
     * inherited from the surrounding text, when possible, depending on the
     * mathvariant for the element (some math variants, such as fraktur can’t be
     * inherited from the surroundings).
     *
     * @defaultValue `false`
     */
    mtextInheritFont?: boolean;

    /**
     * True to make merror text use surrounding font.
     *
     * This setting controls whether the text for <merror> elements will be
     * typeset using the math fonts or the font of the surrounding text. When
     * false, the merrorFont will be used; when true, the font will be inherited
     * from the surrounding text, when possible, depending on the mathvariant
     * for the element (some math variants, such as fraktur can’t be inherited
     * from the surroundings).
     *
     * @defaultValue `false` for SVG output, possibly `true` for CHTML output
     * (ambiguous docs).
     */
    merrorInheritFont?: boolean;

    /**
     * Font to use for mtext, if not inheriting.
     *
     * This specifies the font family to use for <mtext> elements when
     * mtextInheritFont is false (and is ignored if it is true). It can be a
     * comma-separated list of font-family names. If it is empty, then the math
     * fonts are used, as they are with other token elements.
     *
     * @defaultValue `''`
     */
    mtextFont?: string;

    /**
     * Font to use for merror, if not inheriting.
     *
     * This specifies the font family to use for <merror> elements when
     * merrorInheritFont is false (and is ignored if it is true). It can be a
     * comma-separated list of font-family names. If it is empty, then the math
     * fonts are used, as they are with other token elements.
     *
     * @defaultValue `'serif'`
     */
    merrorFont?: string;

    /**
     * Font to use for characters that aren't in MathJax's fonts.
     *
     * This specifies the font family to use for characters that are not found
     * in the MathJax math fonts. For example, if you enter unicode characters
     * directly, these may not be in MathJax’s font, and so they will be taken
     * from the font specified here.
     *
     * @defaultValue `'serif'`
     */
    unknownFamily?: string;

    /**
     * True for MathML spacing rules, false for TeX rules.
     *
     * This specifies whether to use TeX spacing or MathML spacing when
     * typesetting the math. When true, MathML spacing rules are used; when
     * false, the TeX rules are used.
     *
     * @defaultValue `false`
     */
    mathmlSpacing?: boolean;

    /**
     * RFDa and other attributes NOT to copy to the output.
     *
     * This object gives a list of non-standard attributes (e.g., RFDa
     * attributes) that will not be transferred from MathML element to their
     * corresponding DOM elements in the typeset output.
     *
     * @defaultValue `{}`
     */
    skipAttributes?: Record<string, unknown>;

    /**
     * Default size of ex in em units.
     *
     * This is the size of an ex in comparison to 1 em that is to be used when
     * the ex-size can’t be determined (e.g., when running in a Node
     * application, where the size of DOM elements can’t be determined).
     *
     * @defaultValue `0.5`
     */
    exFactor?: number;

    /**
     * Default for indentalign when set to 'auto'.
     *
     * right). The default is 'center'.
     *
     * @defaultValue `'center'`
     */
    displayAlign?: string;

    /**
     * Default for indentshift when set to 'auto'.
     *
     * This gives the amount of indentation that should be used for displayed
     * equations. The default is 0. A value of '1em', for example, would
     * introduce an extra 1 em of space from whichever margin the equation is
     * aligned to, or an offset from the center position if the expression is
     * centered. Note that negative values are allowed.
     *
     * @defaultValue `'0'`
     */
    displayIndent?: string;
}

/**
 * SVG options.
 */
interface MathjaxSvgOutputProcessorOptions
    extends MathjaxCommonOutputProcessorOptions {
    /**
     * True for MathML spacing rules, false for TeX rules.
     *
     * @defaultValue `false`
     */
    mathmlSpacing?: boolean;

    /**
     * Font cache option.
     *
     * This setting determines how the SVG output jax manages characters that
     * appear multiple times in an equation or on a page. The SVG processor uses
     * SVG paths to display the characters in your math expressions, and when a
     * character is used more than once, it is possible to reuse the same path
     * description; this can save space in the SVG image, as the paths can be
     * quite complex. When set to `'local'`, MathJax will cache font paths on an
     * express-by-expression (each expression has its own cache within the SVG
     * image itself), which makes the SVG self-contained, but still allows for
     * some savings if characters are repeated. When set to `'global'`, a single
     * cache is used for all paths on the page; this gives the most savings, but
     * makes the images dependent on other elements of the page. When set to
     * `'none'`, no caching is done and explicit paths are used for every
     * character in the expression.
     *
     * @defaultValue `'local'`
     */
    fontCache?: 'local' | 'global' | 'none';

    /**
     * Insert <title> tags with speech content.
     *
     * This tells the SVG output jax whether to put speech text into <title>
     * elements within the SVG (when set to `'true'`), or to use an aria-label
     * attribute instead. Neither of these control whether speech strings are
     * generated (that is handled by the Semantic-Enrich Extension Options
     * settings); this setting only tells what to do with a speech string when
     * it has been generated or included as an attribute on the root MathML
     * element.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    internalSpeechTitles?: boolean;

    /**
     * ID to use for local font cache (for single equation processing).
     *
     * This gives the ID prefix to use for the paths stored in a local font
     * cache when fontCache is set to 'local'. This is useful if you need to
     * process multiple equations by hand and want to generate unique ids for
     * each equation, even if MathJax is restarted between equations. If set to
     * null, no prefix is used.
     *
     * @defaultValue `null`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    localID?: string | null;

    /**
     * Initial id number to use for aria-labeledby titles.
     *
     * This gives the initial number used to make unique <title> ids when
     * internalSpeechTitles is true. This is useful if you need to process
     * multiple equations by hand and want to generate unique ids for each
     * equation, even if MathJax is restarted between equations.
     *
     * @defaultValue `0`
     *
     * @remarks This is a "developer option", i.e., a low-level option intended
     * for developers.
     */
    titleID?: number;
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
interface MathjaxChtmlOutputProcessorOptions {
    /**
     * True for MathML spacing rules, false for TeX rules.
     *
     * @defaultValue `false`
     */
    mathmlSpacing?: boolean;

    /**
     * True to match ex-height of surrounding font.
     *
     * This setting controls whether MathJax will scale the mathematics so that
     * the ex-height of the math fonts matches the ex-height of the surrounding
     * fonts. This makes the math match the surroundings better, but if the
     * surrounding font does not have its ex-height set properly (and not all
     * fonts do), it can cause the math to not match the surrounding text. While
     * this will make the lower-case letters match the surrounding fonts, the
     * upper case letters may not match (that would require the font height and
     * ex-height to have the same ratio in the surrounding text as in the math
     * fonts, which is unlikely).
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    matchFontHeight?: boolean;

    /**
     * The URL where the fonts are found.
     *
     * This is the URL to the location where the MathJax fonts are stored. In
     * the default, `[mathjax]` is replaced by the location from which you have
     * loaded MathJax. You should include a complete URL to the location of the
     * fonts you want to use.
     *
     * @defaultValue `'[mathjax]/components/output/chtml/fonts/woff-v2'`
     */
    fontURL?: string;

    /**
     * True means only produce CSS that is used in the processed equations.
     *
     * This setting controls how the CommonHTML output jax handles the CSS
     * styles that it generates. When true, this means that only the CSS needed
     * for the math that has been processed on the page so far is generated.
     * When false, the CSS needed for all elements and all characters in the
     * MathJax font are generated. This is an extremely large amount of CSS, and
     * that can have an effect on the performance of your page, so it is best to
     * leave this as true. You can reset the information about what CSS is
     * needed by using the command
     *
     * ```ts
     * MathJax.startup.document.output.clearCache();
     * ```
     *
     * to clear the font cache.
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    adaptiveCSS?: boolean;
}

interface MathjaxDocumentOptions {
    /* eslint-disable tsdoc/syntax */
    /**
     * This array lists the names of the tags whose contents should not be
     * processed by MathJaX. You can add to (or remove from) this list to
     * prevent MathJax from processing mathematics in specific contexts.
     *
     * @defaultValue `['script', 'noscript', 'style', 'textarea', 'pre', 'code',
     * 'annotation', 'annotation-xml']`
     */
    /* eslint-enable tsdoc/syntax */
    skipHtmlTags?: string[];

    /**
     * This object specifies what tags can appear within a math expression, and
     * what text to replace them by within the math. The default is to allow
     * `<br>`, which becomes a newline, and `<wbr>` and HTML comments, which are
     * removed entirely.
     *
     * @defaultValue `{ br: '\n', wbr: '', '#comment': '' }`
     */
    includeHtmlTags?: Record<string, string>;

    /**
     * This is the class name used to mark elements whose contents should not be
     * processed by MathJax. This is a regular expression, and so you need to be
     * sure to quote any `regexp` special characters.
     *
     * @defaultValue `'mathjax_ignore'`
     */
    ignoreHtmlClass?: string;

    /**
     * This is the class name used to mark elements whose contents *should* be
     * processed by MathJax. This is a regular expression, and so you need to be
     * sure to quote any `regexp` special characters.
     *
     * @defaultValue `'mathjax_process'`
     */
    processHtmlClass?: string;

    /**
     * This is the function called whenever there is an uncaught error while an
     * input jax is running.
     *
     * @defaultValue `function (doc, math, err) {doc.compileError(math, err)}`
     */
    compileError?: (doc: unknown, math: unknown, err: Error) => void;

    /**
     * This is the function called whenever there is an uncaught error while an
     * output jax is running.
     *
     * @defaultValue `function (doc, math, err) {doc.typesetError(math, err)}`
     */
    typesetError?: (doc: unknown, math: unknown, err: Error) => void;

    /**
     * This is an object that specifies the actions to take during the
     * `MathJax.typeset()` call and its underlying calls. The structure of the
     * object is `name: value` pairs where the `name` gives an identifier for
     * each action, and the `value` is an array consisting of a number and zero,
     * one, or two functions.
     *
     * @defaultValue `See documentation for default structure`
     */
    renderActions?: Record<
        string,
        // eslint-disable-next-line @typescript-eslint/ban-types
        [number, Function | string, Function | string | boolean]
    >;

    // /**
    //  * The `OutputJax` object instance to use for this `MathDocument`.
    //  *
    //  * @defaultValue `null`
    //  *
    //  * @remarks This is a "developer option", i.e., a low-level option intended
    //  * for developers.
    //  */
    // OutputJax?: Record<string, unknown> | null;

    // /**
    //  * The `InputJax` object instance to use for this `MathDocument`.
    //  *
    //  * @defaultValue `null`
    //  *
    //  * @remarks This is a "developer option", i.e., a low-level option intended
    //  * for developers.
    //  */
    // InputJax?: InputJax | null;

    // /**
    //  * The `MmlFactory` object instance to use for creating the internal MathML
    //  * objects.
    //  *
    //  * @defaultValue `null`
    //  *
    //  * @remarks This is a "developer option", i.e., a low-level option intended
    //  * for developers.
    //  */
    // MmlFactory?: MmlFactory | null;

    // /**
    //  * The `MathList` object class to use for managing the list of `MathItem`
    //  * objects associated with the `MathDocument`.
    //  *
    //  * @defaultValue `DefaultMathList`
    //  *
    //  * @remarks This is a "developer option", i.e., a low-level option intended
    //  * for developers.
    //  */
    // MathList?: MathList;

    // /**
    //  * The `MathItem` object class to use for maintaining the information about
    //  * a single expression in a `MathDocument`.
    //  *
    //  * @defaultValue `DefaultMathItem`
    //  *
    //  * @remarks This is a "developer option", i.e., a low-level option intended
    //  * for developers.
    //  */
    // MathItem?: MathItem;
}

/**
 *  The InputJax interface
 */
// @ts-expect-error We include this interface for the sake of completeness, even
// if it's unused.
interface InputJax {
    /**
     * The name of the input jax subclass (e.g,. 'TeX')
     */
    name: string;

    /**
     * Whether this input jax processes string arrays or DOM nodes
     * (TeX and AsciiMath process strings, MathML processes DOM nodes)
     */
    processStrings: boolean;

    /**
     * The options for this input jax instance
     */
    options: Record<string, unknown>;

    /**
     * Lists of pre- and post-filters to call before and after processing the input
     */
    preFilters: Record<string, unknown>;
    postFilters: Record<string, unknown>;

    /**
     * The DOM adaptor for managing HTML elements
     */
    adaptor: unknown;
}
