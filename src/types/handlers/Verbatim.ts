// File description: Types related to the `VerbatimHandler` class.

/* eslint-disable tsdoc/syntax */
import type { TexConfiguration } from '$types/handlers/Tex.js';
import type { Transformers } from '$types/handlers/Handler.js';
import type {
    EscapeOptions,
    InterpretedAttributes,
} from '$types/utils/Escape.js';
import type {
    FirstTwoLevelsRequiredDefined,
    RequiredDefinedNotNull,
} from '$types/utils/utility-types.js';
import type { TexComponent } from '$utils/TexComponent.js';

// For TSDoc comments
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CompilationOptions } from '$types/handlers/Tex.js';
import type { SveltexConfiguration } from '$types/SveltexConfiguration.js';
/* eslint-enable @typescript-eslint/no-unused-vars */

export interface VerbatimProcessOptions {
    filename: string;
    selfClosing: boolean;
    attributes: InterpretedAttributes;
    tag: string;
    outerContent?: string | undefined;
    escapeOptions?: EscapeOptions | undefined;
    lineOffset?: number | undefined;
}

export type FullVerbatimConfiguration = Record<string, FullVerbEnvConfig>;
export type VerbatimConfiguration = Record<string, VerbEnvConfig>; // {
/**
 * Verbatim environments.
 *
 * @remarks The keys are the names of the environments, and the values describe
 * how to process the inner content of the environment.
 *
 * @example
 * ```ts
 * { Verbatim: { escapeBraces: true, escapeHtml: true } }
 * ```
 *
 * This environment would then be used as follows:
 * ```html
 * <Verbatim>
 * Content.
 * </Verbatim>
 * ```
 *
 * @defaultValue
 * ```ts
 * {}
 * ```
 */
//     verbatimEnvironments?: | undefined | Record<string,
//     VerbatimEnvironmentConfiguration>;
// }

/**
 * Interface used to describe how to escape a string.
 */
export interface SimpleEscapeInstruction {
    /**
     * Whether braces (aka. curly brackets) should be escaped.
     *
     * - `{` → `&lbrace;`
     * - `}` → `&rbrace;`
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    braces?: boolean | undefined;

    /**
     * Whether HTML should be escaped.
     *
     * - `<` → `&lt;`
     * - `>` → `&gt;`
     * - `&` → `&amp;`
     * - `"` → `&quot;`
     * - `'` → `&apos;`
     *
     * @defaultValue
     * ```ts
     * true
     * ```
     */
    html?: boolean | undefined;
}

/**
 * Type describing the possible ways to process the inner content of a verbatim
 * environment.
 */
export type VerbatimType = 'code' | 'noop' | 'tex' | 'escape';
// | SimpleEscapeInstruction | VerbatimProcessInnerFn;

// /**
//  * Function which takes the inner content and the attributes of a verbatim
//  * environment and returns the processed content (including HTML tag).
//  *
//  * @param inner - The inner content of the component.
//  * @param attributes - The attributes of the component.
//  *
//  * @example
//  * ```ts
//  * (inner, attributes) => {
//  *     let attrStrings = Object.entries(attributes).map(
//  *         ([key, value]) => `${key}="${String(value)}"`
//  *     );
//  *     const attrString = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';
//  *     return `<pre${attrString}><code>${inner}</code></pre>`;
//  * }
//  * ```
//  */
// export type VerbatimProcessInnerFn = (
//     inner: string,
//     attributes: Record<string, string | number | boolean | null | undefined>,
// ) => string;

export type FullVerbEnvConfig =
    | FullVerbEnvConfigCode
    | FullVerbEnvConfigEscape
    | FullVerbEnvConfigNoop
    | FullVerbEnvConfigTex;

type VerbEnvConfig =
    | VerbEnvConfigCode
    | VerbEnvConfigEscape
    | VerbEnvConfigNoop
    | VerbEnvConfigTex;

export type FullVerbEnvConfigCode = RequiredDefinedNotNull<VerbEnvConfigCode> &
    FullVerbEnvConfigBase;
export type FullVerbEnvConfigEscape =
    RequiredDefinedNotNull<VerbEnvConfigEscape> & FullVerbEnvConfigBase;
export type FullVerbEnvConfigNoop = RequiredDefinedNotNull<VerbEnvConfigNoop> &
    FullVerbEnvConfigBase;
export type FullVerbEnvConfigTex = RequiredDefinedNotNull<VerbEnvConfigTex> &
    FullVerbEnvConfigBase;

export type FullVerbEnvConfigBase = RequiredDefinedNotNull<VerbEnvConfigBase> &
    FirstTwoLevelsRequiredDefined<Pick<VerbEnvConfigBase, 'transformers'>>;

export type Preset = TikzPreset;

export type PresetName = TikzPreset['name'];

interface TikzPreset {
    name: 'tikz';

    /**
     * The TikZ libraries to load.
     *
     * @remarks
     * We use the names of the TikZ libraries as keys, treating dots as nested
     * objects.
     *
     * @remarks
     * Loading a sublibrary will generally also load its parent library, with
     * some exceptions (e.g., `arrows.meta` does not load `arrows`, since
     * `arrows` is deprecated (but `arrows.meta` isn't)).
     *
     * @remarks
     * The `graphdrawing` libraries aren't loaded with
     * [`\usetikzlibrary`](https://tikz.dev/tikz-scopes#pgf.back/usetikzlibrary)
     * like the other libraries. Instead, they are loaded with
     * [`\usegdlibrary`](https://tikz.dev/gd-usage-tikz#pgf.back/usegdlibrary).
     */
    libraries: {
        /**
         * This package provides some styles and options for drawing three
         * dimensional shapes.
         *
         * @see https://tikz.dev/library-3d
         */
        '3d'?: boolean;

        /**
         * This library defines pic types for drawing angles.
         *
         * @see https://tikz.dev/library-angle
         */
        angles?: boolean;

        /**
         * This library must be loaded in order to use animations with TikZ.
         *
         * @see https://tikz.dev/tikz-animations
         */
        animations?: boolean;

        /**
         * Parent library of `arrows.meta`.
         */
        arrows?:
            | false
            | {
                  /**
                   * This library defines a large number of standard "meta" arrow tips.
                   * "Meta" means that you can configure these arrow tips in many
                   * different ways like changing their size or their line caps and joins
                   * and many other details.
                   *
                   * @defaultValue `true`
                   *
                   * @see https://tikz.dev/tikz-arrows#pgf.arrows.meta
                   */
                  meta?: boolean;
              };

        /**
         * This packages provides shapes and styles for drawing finite state
         * automata and Turing machines.
         *
         * @see https://tikz.dev/library-automata
         */
        automata?: boolean;

        /**
         * A tiny library that make the interaction with the `babel` package
         * easier. Despite the name, it may also be useful in other contexts,
         * namely whenever the catcodes of important symbols are changed
         * globally. Normally, using this library is always a good idea.
         *
         * @defaultValue `true`
         *
         * @see https://tikz.dev/library-babel
         */
        babel?: boolean;

        /**
         * This library defines "backgrounds" for pictures. This does not refer
         * to background pictures, but rather to frames drawn around and behind
         * pictures. For example, this package allows you to just add the framed
         * option to a picture to get a rectangular box around your picture or
         * gridded to put a grid behind your picture.
         *
         * @see https://tikz.dev/library-backgrounds
         */
        backgrounds?: boolean;

        /**
         * Load this library to use the `flex`, `flex'`, or `bending` arrow
         * keys. When this library is loaded, `flex` becomes the default mode
         * that is used with all paths, unless `quick` is explicitly selected
         * for the arrow tip.
         *
         * @see https://tikz.dev/tikz-arrows#pgf.bending
         */
        bending?: boolean;

        /**
         * The library allows advanced coordinate calculations.
         *
         * @defaultValue `true`
         *
         * @see https://tikz.dev/library-calc
         * @see https://tikz.dev/tikz-coordinates#pgf.calc
         */
        calc?: boolean;

        /**
         * The library defines the `\calendar` command, which can be used to
         * typeset calendars. The command relies on the `\pgfcalendar` command
         * from the `pgfcalendar` package, which is loaded automatically.
         *
         * The `\calendar` command is quite configurable, allowing you to
         * produce all kinds of different calendars.
         *
         * @see https://tikz.dev/library-calender _[sic.]_
         */
        calendar?: boolean;

        /**
         * This library defines options for creating chains.
         *
         * @see https://tikz.dev/library-chains
         */
        chains?: boolean;

        /**
         * Defines general keys for creating circuits. Mostly, these keys are
         * useful for defining more specialized libraries.
         *
         * You normally do not use this library directly since it does not
         * define any symbol graphics.
         *
         * @see https://tikz.dev/library-circuits#pgf.circuits
         */
        circuits?:
            | boolean
            | {
                  /**
                   * Defines keys for creating logical gates like AND-gates or
                   * XOR-gates. However, this library also does not actually
                   * define any symbol graphics; this is done by two
                   * sublibraries: `circuits.logic.US` and `circuits.logic.IEC`.
                   *
                   * @remarks
                   * This library also loads its parent library, `circuits`.
                   *
                   * @remarks
                   * The `circuits.logic` library does not define any actual
                   * graphics, so to actually draw a logical circuit, you need
                   * to use one or more of its sublibraries:
                   * `circuits.logic.CDH`, `circuits.logic.IEC`, or
                   * `circuits.logic.US`. Accordingly, you probably don't want
                   * to set this key to `true`, but rather to an object `{ CDH?:
                   * boolean; IEC?: boolean; US?: boolean }`.
                   *
                   * @see https://tikz.dev/library-circuits#pgf.circuits.logic
                   */
                  logic?:
                      | boolean
                      | {
                            /**
                             * This library provides graphics based on the logic
                             * symbols used in A. Croft, R. Davidson, and M.
                             * Hargreaves (1992), _Engineering Mathematics_,
                             * Addison-Wesley, 82–95. They are identical to the
                             * US-style symbols, except for the AND- and
                             * NAND-gates.
                             *
                             * @see
                             * https://tikz.dev/library-circuits#pgf.circuits.logic.CDH
                             */
                            CDH?: boolean;

                            /**
                             * This library provides graphics based on gates
                             * recommended by the International Electrotechnical
                             * Commission.
                             *
                             * @remarks
                             * This library can coexist peacefully with the
                             * `circuits.logic.US` library — you can change
                             * which symbol graphics are used "on the fly".
                             *
                             * @remarks
                             * This library also loads its parent libraries,
                             * `circuits` and `circuits.logic`.
                             *
                             * @see
                             * https://tikz.dev/library-circuits#pgf.circuits.logic.IEC
                             */
                            IEC?: boolean;

                            /**
                             * This library provides graphics showing "American"
                             * logic gates.
                             *
                             * @remarks
                             * This library can coexist peacefully with the
                             * `circuits.logic.IEC` library —you can change
                             * which symbol graphics are used "on the fly".
                             *
                             * @remarks
                             * This library also loads its parent libraries,
                             * `circuits` and `circuits.logic`.
                             *
                             * @see
                             * https://tikz.dev/library-circuits#pgf.circuits.logic.US
                             */
                            US?: boolean;
                        };

                  /**
                   * Defines keys for symbols from electrical engineering like
                   * resistors or capacitors.
                   *
                   * @remarks
                   * As for logical circuits, to draw a circuit the first step
                   * is to include a library containing the symbols graphics.
                   * Currently, you have to include `circuits.ee.IEC` for this.
                   * Accordingly, you probably don't want to set this key to
                   * `true`, but rather to `{ IEC: true }`.
                   *
                   * @remarks
                   * This library also loads its parent library, `circuits`.
                   *
                   * @see https://tikz.dev/library-circuits#pgf.circuits.ee
                   */
                  ee?:
                      | boolean
                      | {
                            /**
                             * Defines symbol shapes that follow the IEC norm.
                             *
                             * @see
                             * https://tikz.dev/library-circuits#pgf.circuits.ee.IEC
                             */
                            IEC?: boolean;
                        };
              };

        /**
         * This library defines commands for computing nonlinear transformers
         * "along Bézier curves".
         *
         * @see https://tikz.dev/base-transformers#pgf.curvilinear
         */
        curvilinear?: boolean;

        /**
         * This library must be loaded if you wish to use the
         * `\datavisualization` command. It defines all styles needed to create
         * basic data visualizations; additional, more specialized libraries
         * need to be loaded for more advanced features.
         *
         * @see https://tikz.dev/dv-main#pgf.datavisualization
         */
        datavisualization?:
            | boolean
            | {
                  formats?:
                      | false
                      | {
                            /**
                             * This library defines the format `function`, which
                             * allows you to specify the data points indirectly,
                             * namely via a to-be-evaluated function.
                             *
                             * @see
                             * https://tikz.dev/dv-formats#pgf.datavisualization.formats.functions
                             */
                            functions?: boolean;
                        };

                  /**
                   * This library contains keys that allow you to create plots
                   * in a polar axis system is used.
                   *
                   * @see https://tikz.dev/dv-polar
                   */
                  polar?: boolean;
              };

        /**
         * Decorations are a general concept to make (sub)paths "more
         * interesting". The commands for creating decorations are defined in
         * this module, so you need to load this library to use decorations.
         * This library is automatically loaded by the different decoration
         * sublibraries.
         *
         * @remarks
         * You probably don't want to set this option to `true`, but rather to
         * an object with sublibraries as keys and booleans as values.
         *
         * @see https://tikz.dev/library-decorations
         * @see https://tikz.dev/tikz-decorations#section-tikz-decorations
         * @see https://tikz.dev/base-decorations#section-base-decorations
         */
        decorations?:
            | boolean
            | {
                  /**
                   * A path morphing decoration "morphs" or "deforms" the
                   * to-be-decorated path. This means that what used to be a
                   * straight line might afterwards be a snaking curve and have
                   * bumps. However, a line is still a line and path deforming
                   * decorations do not change the number of subpaths. For
                   * instance, if the path used to consist of two circles and an
                   * open arc, the path will, after the decoration process,
                   * still consist of two closed subpaths and one open subpath.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.pathmorphing
                   */
                  pathmorphing?: boolean;

                  /**
                   * This library defines decorations that replace the
                   * to-be-decorated path by another path. Unlike morphing
                   * decorations, the replaced path might be quite different,
                   * for instance a straight line might be replaced by a set of
                   * circles. Note that filling a path that has been replaced
                   * using one of the decorations in this library typically does
                   * not fill the original area but, rather, the smaller area of
                   * the newly-created path segments.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.pathreplacing
                   */
                  pathreplacing?: boolean;

                  /**
                   * Markings are arbitrary "marks" that can be put on a path.
                   * Marks can be arrow tips or nodes or even whole pictures.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.markings
                   */
                  markings?: boolean;

                  /**
                   * The decorations of this library can be used to decorate a
                   * path with little footprints, as if someone had "walked"
                   * along the path.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.footprints
                   */
                  footprints?: boolean;

                  /**
                   * This library defines decorations that use shapes or
                   * shape-like drawings to decorate a path.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.shapes
                   */
                  shapes?: boolean;

                  /**
                   * The decoration in this library decorates the path with some
                   * text. This can be used to draw text that follows a curve.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.text
                   */
                  text?: boolean;

                  /**
                   * The decorations of this library can be used to create
                   * fractal lines. To use them, you typically have to apply the
                   * decoration repeatedly to an originally straight path.
                   *
                   * @see
                   * https://tikz.dev/library-decorations#pgf.decorations.fractals
                   */
                  fractals?: boolean;
              };

        /**
         * This packages provides styles for drawing entity-relationship
         * diagrams.
         *
         * @see https://tikz.dev/library-er
         */
        er?: boolean;

        /**
         * This library provides a high-level automatic or semi-automatic export
         * feature for TikZ pictures. Its purpose is to convert each picture to
         * a separate pdf without changing the document as such.
         *
         * It also externalizes `\label` information (and other aux file related
         * stuff) using auxiliary files.
         *
         * @see https://tikz.dev/library-external
         */
        externalization?: boolean;

        /**
         * This library defines a number of fadings; see
         *  [_Transparency_](https://tikz.dev/tikz-transparency) for an
         *  introduction.
         *
         * @see https://tikz.dev/library-fadings
         */
        fadings?: boolean;

        /**
         * The library defines options for fitting a node so that it contains a
         * set of coordinates.
         *
         * @see https://tikz.dev/library-fit
         */
        fit?: boolean;

        /**
         * This library provides an interface to the LaTeX package
         * [`fp`](https://ctan.org/pkg/fp) for fixed point arithmetic.
         *
         * @see https://tikz.dev/library-fixedpoint
         * @see https://ctan.org/pkg/fp
         *
         * @privateRemarks
         * In addition to loading this library you must ensure the `fp` package
         * is loaded, otherwise errors will occur. Sveltex will take care of
         * this by appending the following code to the preamble if this TikZ
         * library is loaded:
         * ```tex
         * \makeatletter
         * \@ifpackageloaded{fp}{}{\usepackage{fp}}
         * \makeatother
         * ```
         */
        fixedpointarithmetic?: boolean;

        /**
         * The floating point unit (`fpu`) library allows the full data range of
         * scientific computing for use in PGF. Its core is the PGF math
         * routines for mantissa operations, leading to a reasonable trade-off
         * between speed and accuracy. It does not require any third-party
         * packages or external programs.
         *
         * @see https://tikz.dev/library-fpu
         */
        fpu?: boolean;

        /**
         * This library provides capabilities for automatic graph drawing. It
         * requires that the document is typeset using LuaTeX (i.e.,
         * {@link CompilationOptions.engine | `engine`} set to `lualatex` or
         * `lualatexmk`). This package should work with LuaTeX 0.54 or higher.
         *
         * @see https://tikz.dev/gd-usage-tikz#pgf.graphdrawing
         */
        graphdrawing?:
            | boolean
            | {
                  /**
                   * "Circular" graph drawing algorithms arrange the nodes of a
                   * graph on one of more circles.
                   *
                   * @see https://tikz.dev/gd-circular
                   */
                  circular?: boolean;

                  /**
                   * @see
                   */
                  examples?: boolean;

                  /**
                   * Nature creates beautiful graph layouts all the time.
                   * Consider a spider's web: Nodes are connected by edges in a
                   * visually most pleasing manner (if you ignore the spider in
                   * the middle). The layout of a spider's web is created just
                   * by the physical forces exerted by the threads. The idea
                   * behind force-based graph drawing algorithms is to mimic
                   * nature: We treat edges as threads that exert forces and
                   * simulate into which configuration the whole graph is
                   * "pulled" by these forces.
                   *
                   * @see https://tikz.dev/gd-force
                   */
                  force?: boolean;

                  /**
                   * A "layered" layout of a graph tries to arrange the nodes in
                   * consecutive horizontal layers (naturally, by rotating the
                   * graph, this can be changed in to vertical layers) such that
                   * edges tend to be only between nodes on adjacent layers.
                   * Trees, for instance, can always be laid out in this way.
                   * This method of laying out a graph is especially useful for
                   * hierarchical graphs.
                   *
                   * The method implemented in this library is often called the
                   * Sugiyama method, which is a rather advanced method of
                   * assigning nodes to layers and positions on these layers.
                   *
                   * @see https://tikz.dev/gd-layered
                   */
                  layered?: boolean;

                  /**
                   * A phylogenetic tree (or network) depicts the evolutionary
                   * history of species or, more generally, so-called taxa. This
                   * library includes a number of algorithms for drawing
                   * phylogenetic trees.
                   *
                   * @see https://tikz.dev/gd-phylogenetics
                   */
                  phylogenetics?: boolean;

                  /**
                   * This library contains algorithms for routing edges through
                   * a graph.
                   *
                   * @see https://tikz.dev/gd-edge-routing
                   */
                  routing?: boolean;

                  /**
                   * TikZ offers several different syntax to specify trees (see
                   * [_§ Specifying
                   * Graphs_](https://tikz.dev/tikz-graphs#section-library-graphs)
                   * and [_§ Making Trees
                   * Grow_](https://tikz.dev/tikz-trees#section-trees)). The job
                   * of the graph drawing algorithms from this library is to
                   * turn the specification of trees into beautiful layouts.
                   *
                   * @see https://tikz.dev/gd-trees#pgf.trees
                   */
                  trees?: boolean;
              };

        /**
         * The package must be loaded to use the `graph` path command.
         *
         * @see https://tikz.dev/tikz-graphs#pgf.graphs
         */
        graphs?:
            | boolean
            | {
                  /**
                   * This library defines a number of graph macros that are
                   * often used in the literature. When new graphs are added to
                   * this collection, they will follow the definitions in the
                   * Mathematica program, see
                   * https://mathworld.wolfram.com/topics/SimpleGraphs.html.
                   *
                   * @remarks
                   * This library also loads its parent library, `graphs`.
                   *
                   * @see https://tikz.dev/tikz-graphs#pgf.graphs.standard
                   */
                  standard?: boolean;
              };

        /**
         * This library defines the below command and allows you to calculate
         * the intersections of two arbitrary paths. However, due to the low
         * accuracy of TeX, the paths should not be "too complicated". In
         * particular, you should not try to intersect paths consisting of lots
         * of very small segments such as plots or decorated paths.
         *
         * @see https://tikz.dev/base-points
         */
        intersections?: boolean;

        /**
         * This library provides basic commands for defining and using simple
         * L-systems.
         *
         * @remarks
         * Lindenmayer systems (also commonly known as "L-systems"), were
         * originally developed by Aristid Lindenmayer as a theory of algae
         * growth patterns and then subsequently used to model branching
         * patterns in plants and produce fractal patterns. Typically, an
         * L-system consists of a set of symbols, each of which is associated
         * with some graphical action (such as "turn left" or "move forward")
         * and a set of rules ("production" or "rewrite" rules). Given a string
         * of symbols, the rewrite rules are applied several times and when the
         * resulting string is processed the action associated with each symbol
         * is executed.
         *
         * @see https://tikz.dev/library-lsystems
         */
        lindenmayersystems?: boolean;

        /**
         * This library defines a simple mathematical language to define simple
         * functions and perform sequences of basic mathematical operations.
         *
         * @see https://tikz.dev/library-math
         */
        math?: boolean;

        /**
         * This library package defines additional styles and options for
         * creating matrices. The basic matrix styles and options can be found
         * in [_§ Matrices and
         * Alignment_](https://tikz.dev/tikz-matrices#section-matrices).
         *
         * @see https://tikz.dev/library-matrix
         * @see https://tikz.dev/tikz-matrices#section-matrices
         */
        matrix?: boolean;

        /**
         * This library provides styles for drawing mindmap diagrams.
         *
         * @see https://tikz.dev/library-mindmaps
         */
        mindmap?: boolean;

        /**
         * This library defines `pic` types for creating paper-folding diagrams.
         *
         * @see https://tikz.dev/library-folding
         */
        folding?: boolean;

        /**
         * This library defines patterns for filling areas.
         *
         * @see https://tikz.dev/library-patterns
         */
        patterns?:
            | boolean
            | {
                  /**
                   * ⚠ **Warning**: This library is currently experimental and
                   * might change without notice. There are some known
                   * shortcomings that will hopefully be fixed in the future.
                   *
                   * This library allows you to define your own patterns with a
                   * syntax similar to `arrows.meta`.
                   *
                   * @see https://tikz.dev/library-patterns#pgf.patterns.meta
                   * @experimental
                   */
                  meta?: boolean;
              };

        /**
         * This library provides tools for perspective drawing with one, two, or
         * three vanishing points.
         *
         * @see https://tikz.dev/library-perspective
         */
        perspective?: boolean;

        /**
         * This packages provides shapes and styles for drawing Petri nets.
         *
         * @see https://tikz.dev/library-petri
         */
        petri?: boolean;

        /**
         * This library defines a number of plot marks.
         *
         * @see https://tikz.dev/library-plot-marks
         */
        plotmarks?: boolean;

        /**
         * The library defines additional options for placing nodes
         * conveniently. It also redefines the standard options like `above` so
         * that they give you better control of node placement.
         *
         * @see https://tikz.dev/tikz-shapes#pgf.positioning
         */
        positioning?: boolean;

        /**
         * A library to simplify the optimization of runtime speed of TEX
         * programs.
         *
         * It relies on the pdfTeX primitive `\pdfelapsedtime` to count
         * (fractional) seconds and counts total time and self time for macro
         * invocations. (The primitive is emulated in LuaTeX.)
         *
         * @remarks
         * The intended audience for this library are people writing TeX code
         * which should be optimized. It is certainly _not_ useful for the
         * end-user.
         *
         * @remarks
         * This library works with `pdftex` (e.g., `pdflatex`) and `luatex`
         * (e.g., `lualatex` or `lualatexmk`). Furthermore, it requires a more
         * or less recent version of `pdftex` which supports the
         * `\pdfelapsedtime` directive.
         */
        profiler?: boolean;

        /**
         * Enables the quotes syntax for labels, pins, edge nodes, and pic
         * texts.
         *
         * @see https://tikz.dev/tikz-shapes#pgf.quotes
         */
        quotes?: boolean;

        /**
         * With certain output formats (in particular, with SVG), TikZ can add
         * _semantic annotations_ to an output file. There is a standard for
         * specifying such annotations ("resource description framework
         * annotations", abbreviated RDFA), and TikZ provides a way of adding
         * such annotations with this library.
         *
         * @remarks
         * {@link CompilationOptions.intermediateFiletype | `intermediateFiletype`}
         * must be set to `'dvi'` for this library to work.
         *
         * @see https://tikz.dev/library-rdf
         */
        rdf?: boolean;

        /**
         * This library defines a shorthand for starting and ending `{scope}`
         * environments.
         *
         * @see https://tikz.dev/tikz-scopes#pgf.scopes
         */
        scopes?: boolean;

        /**
         * This library defines a number of shadings in addition to the ball and
         * axis shadings that are available by default.
         *
         * @see https://tikz.dev/library-shadings
         */
        shadings?: boolean;

        /**
         * This library defines styles that help adding a (partly) transparent
         * shadow to a path or node.
         *
         * @see https://tikz.dev/library-shadows
         */
        shadows?: boolean;

        /**
         * In addition to the standard shapes `rectangle`, `circle` and
         * `coordinate`, there exist a number of additional shapes defined in
         * different shape libraries. The `shapes` library should not be loaded
         * directly; instead, to use the library you should load one or more of
         * its sublibraries.
         *
         * @remarks
         *
         * @see https://tikz.dev/library-shapes
         */
        shapes?:
            | false
            | {
                  /**
                   * This library defines different shapes that correspond to
                   * basic geometric objects like ellipses or polygons.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.geometric
                   */
                  geometric?: boolean;

                  /**
                   * This library defines shapes that can be used for drawing
                   * symbols like a forbidden sign or a cloud.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.symbols
                   */
                  symbols?: boolean;

                  /**
                   * This library defines arrow shapes. Note that an arrow shape
                   * is something quite different from a (normal) arrow tip: It
                   * is a shape that just "happens" to "look like" an arrow. In
                   * particular, you cannot use these shapes as arrow tips.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.arrows
                   */
                  arrows?: boolean;

                  /**
                   * This library defines general-purpose shapes that are
                   * composed of multiple (text) parts.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.multipart
                   */
                  multipart?: boolean;

                  /**
                   * Producing basic callouts can be done quite easily in pgf
                   * and TikZ by creating a node and then subsequently drawing a
                   * path from the border of the node to the required point.
                   * This library provides more fancy, 'balloon'-style callouts.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.callouts
                   */
                  callouts?: boolean;

                  /**
                   * This library defines general-purpose shapes that do not fit
                   * into the previous categories.
                   *
                   * @see https://tikz.dev/library-shapes#pgf.shapes.misc
                   */
                  misc?: boolean;
              };

        /**
         * The package defines options for creating pictures in which some part
         * of the picture is repeated in another area in a magnified way (as if
         * you were looking through a spyglass, hence the name).
         *
         * @see https://tikz.dev/library-spy
         */
        spy?: boolean;

        /**
         * At the time of writing, `svg` doesn't seem to be a library of its
         * own, but merely the first part of the `svg.path` library's name.
         * However, for consistency's sake, it is treated here as if it were a
         * parent library of `svg.path`. However, you should not set this key to
         * `true`, but rather to an object `{ path: boolean }`.
         */
        svg?:
            | false
            | {
                  /**
                   * This library defines a command that allows you to specify a
                   * path using SVG syntax.
                   *
                   * @see https://tikz.dev/library-svg-path
                   */
                  path?: boolean;
              };

        /**
         * This library defines keys for creating shapes that go through given
         * points.
         *
         * @see https://tikz.dev/library-through
         */
        through?: boolean;

        /**
         * This packages defines styles to be used when drawing trees.
         *
         * @see https://tikz.dev/library-trees
         */
        trees?: boolean;

        /**
         * This little library defines some keys to create simple turtle
         * graphics in the tradition of the Logo programming language. These
         * commands are mostly for fun, but they can also be used for more
         * "serious" business.
         *
         * @see https://tikz.dev/library-turtle
         */
        turtle?: boolean;

        /**
         * This library is used for creating views, which are transformers of
         * a part of a picture so that this part "fits" into a "viewbox".
         * Mostly, views are useful in conjunction with animations.
         *
         * @see https://tikz.dev/library-views
         */
        views?: boolean;
    };
}

/**
 * TeX component configuration options.
 */
export interface VerbEnvConfigTex extends VerbEnvConfigBase {
    type: 'tex';

    respectSelfClosing?: false;
    component?: 'none';

    // /**
    //  * Aliases for the component.
    //  *
    //  * @remarks Aliases are case-sensitive.
    //  * @remarks Don't use existing HTML tags as aliases (e.g., don't use
    //    `code`
    //  * or `span`).
    //  * @example ['TikZ', 'Tikz']
    //    */
    // aliases?: string[];

    /**
     * Preamble to include in the TeX file (everything after
     * `\documentclass{...}` but before `\begin{document}`).
     *
     * @defaultValue
     * ```tex
     * \usepackage{microtype}
     * \usepackage{tikz}
     * \usepackage{mathtools}
     * \usepackage{xcolor}
     * ```
     */
    preamble?: string;

    preset?: Preset | Preset[] | undefined;

    /**
     * This property describes the arguments to be passed to the
     * `\documentclass` command. If a string is provided, it will be used as the
     * class name. If an object is provided, the `name` property will be used as
     * the class name, and the `options` property will be passed to the optional
     * argument of the `\documentclass` command.
     *
     * @defaultValue
     *
     * ```ts
     * { name: 'standalone', options: [] }
     * ```
     */
    documentClass?:
        | string
        | {
              /**
               * Document class; passed to the mandatory argument of the LaTeX
               * command `\documentclass`.
               *
               * @defaultValue `'standalone'`
               *
               * @remarks
               * The options and class name will be converted to TeX code as
               * follows:
               *
               * ```
               * `\\documentclass[${options.join(',')}]{${name}}`
               * ```
               */
              name?: string | undefined;
              /**
               * Document class options; passed to the optional argument of the
               * LaTeX command `\documentclass`.
               *
               * @defaultValue `[]`
               *
               * @remarks
               * The options and class name will be converted to TeX code as
               * follows:
               *
               * ```
               * `\\documentclass[${options.join(',')}]{${name}}`
               * ```
               *
               * @remarks
               * Sveltex will automatically add the class option `dvisvgm` if
               * {@link CompilationOptions.intermediateFiletype | `intermediateFiletype`}
               * is set to `'dvi'`. See https://tikz.dev/drivers.
               */
              options?: string[] | undefined;
          }
        | undefined;

    /**
     * Override any part of the default TeX configuration inherited
     * from the {@link SveltexConfiguration.tex | `tex`}
     * property of the Sveltex configuration.
     */
    overrides?: TexConfiguration | undefined;

    /**
     * ⚠ **Warning**: While you can set this property, you should be aware that
     * the default value (that is, function) takes care of a bunch of things
     * that, although not essential, might be helpful; overriding this function
     * risks losing that functionality. (In particular, the default function
     * filters the attributes into several categories, and dynamically decides
     * whether and how they should be passed to the final HTML, or if they
     * should be interpreted as ad hoc modifications to the TeX component's
     * configuration.)
     *
     * @param attributes - Attributes the user passed to the TeX component
     * (except `ref`).
     * @param tc - The TeX component, which this function may mutate.
     * @returns An object which will be assigned to the
     * {@link TexComponent.handledAttributes | `handledAttributes`} property of
     * the TeX component, for later use by the
     * {@link postprocess | `postprocess`} function.
     */
    handleAttributes?: (
        attributes: InterpretedAttributes,
        tc: Omit<TexComponent, 'configuration' | 'handledAttributes'> &
            Omit<Pick<TexComponent, 'configuration'>, 'handleAttributes'>,
    ) => Record<string, unknown>;

    /**
     * Postprocessing function to control how the SVG component is inserted into
     * the output Svelte file.
     *
     * @param svgComponent - `'<svelte:component this={...} />'`.
     * @param tc - The TeX component whose output SVG component is being
     * post-processed.
     * @returns The HTML code to be inserted into the output Svelte file.
     *
     * @example
     * The default function, if `tc.handledAttributes` is empty, might output
     * something like this:
     *
     * ```html
     * <figure>
     * <svelte:component this={Sveltex_tikz_myfig} />
     * </figure>
     * ```
     */
    postprocess?: (svgComponent: string, tc: TexComponent) => string;
}

interface VerbEnvConfigNoop extends VerbEnvConfigBase {
    type: 'noop';
}

interface VerbEnvConfigCode extends VerbEnvConfigBase {
    type: 'code';
}

interface VerbEnvConfigEscape extends VerbEnvConfigBase {
    type: 'escape';
    escape?: SimpleEscapeInstruction | undefined;
}

export interface VerbEnvConfigBase {
    /**
     * How to process the inner content of the component.
     *
     * - `'tex'`: Process as TeX component.
     * - `'code'`: Process inner content as code.
     * - `'noop'`: Leave inner content as-is.
     * - `'escape'`: Escape the inner content according to the given
     *   instructions.
     * - `'custom'`: Use the `customProcess` prop to provide a function which
     *   takes the inner content and the attributes of the component and returns
     *   the processed content.
     */
    type: VerbatimType;

    /**
     * The HTML tag(s) to use top refer to this verbatim environment.
     */
    // tag: string | [string, ...string[]];

    /**
     * @example
     * ```ts
     * Example: {
     *     defaultAttributes: {
     *        inline: false,
     *        lang: 'plaintext'
     *     }
     * }
     * ```
     *
     * Now, the following code block:
     *
     * ```html
     * <Example>
     * Content.
     * </Example>
     * ```
     *
     * ...would be processed the same way as this one:
     *
     * ```html
     * <Code lang="plaintext" inline="false">
     * Content.
     * </Code>
     * ```
     */
    defaultAttributes?: Record<
        string,
        string | boolean | number | null | undefined
    >;

    /**
     * Attributes that should be forwarded to the output.
     *
     * @defaultValue `'all'`
     * @see
     * {@link attributeForwardingBlocklist | `attributeForwardingBlocklist`},
     * which takes precedence over this setting.
     */
    attributeForwardingAllowlist?: 'all' | string[];

    /**
     * Attributes that should not be forwarded to the output.
     *
     * @defaultValue Depends on the value of {@link type | `type`}:
     * - `'code'`: `['lang', 'inline', 'metaString']`
     * - _Otherwise:_ `[]`
     * @see
     * {@link attributeForwardingAllowlist | `attributeForwardingAllowlist`}
     */
    attributeForwardingBlocklist?: string[];

    /**
     * HTML tags that should be treated as aliases for this component.
     *
     * @defaultValue
     * ```ts
     * []
     * ```
     *
     * @remarks
     * The output will remain the same regardless of which, if any, alias was
     * used.
     */
    aliases?: string[] | undefined;

    /**
     * @defaultValue
     * - `type === 'tex'`: `null`, which means the processed inner
     *   content won't be wrapped in anything (in particular, `postprocess`
     *   should take care of this in the case of TeX components).
     * - _Otherwise:_ `'this'`, which means the key of this object in the
     *   `verbatim` prop is used.
     *
     * @example
     * Suppose we have the following verbatim environment:
     *
     * ```ts
     * Example: {
     *     component: 'Code',
     *     type: 'escape',
     * }
     * ```
     *
     * Now, the following code block...
     *
     * ```html
     * <Example attr="...">
     * let a = {}
     * </Example>
     * ```
     *
     * ...would be transformed into:
     *
     * ```html
     * <Code attr="...">
     * let a = &lbrace;&rbrace;
     * </Code>
     * ```
     */
    component?: string | undefined;

    /**
     * Whether to respect self-closing tags.
     *
     * - `true`: If the component is found in a SvelTeX-enabled file in a
     *   self-closing form (e.g., `<Example />`), the transformed component will
     *   still be self-closing.
     * - `false`: If the component is found in a SvelTeX-enabled file in a
     *   self-closing form (e.g., `<Example />`), the transformed component will
     *   be closed with a closing tag (e.g., `<Example></Example>`).
     *
     * @defaultValue `true`
     * @see {@link selfCloseOutputWith | `selfCloseOutputWith`}
     *
     * @example
     * If, for some reason, you wanted to manually insert line breaks with
     * `<br />` tags, but wanted to invoke these with a different name, you
     * could, for example, set `respectSelfClosing` to `true`:
     * ```ts
     * break: {
     *     type: 'noop',
     *     respectSelfClosing: true,
     *     component: 'br',
     *     selfCloseOutputWith: 'auto',
     * }
     * ```
     *
     * Now we'd have the following transformers:
     *
     * - `<break />` → `<br />`
     * - `<break/>` → `<br/>`
     * - `<break></break>` → `<br></br>` (just to clarify the behavior, you
     *   shouldn't do this in this particular case).
     */
    respectSelfClosing?: boolean | undefined;

    /**
     * Transformers to apply to:
     * -   The inner content of the input which `VerbatimHandler` will receive
     *     for processing;
     * -   The inner content of the output produced by the `VerbatimHandler` (or
     *     by whatever handler it forwards the content to).
     */
    transformers?: Transformers<VerbatimProcessOptions> | undefined;

    /**
     * Controls whether or not to add a space before the closing slash in the
     * self-closing transformed output of this component.
     *
     * - `' />'`: always add a space before the closing slash in self-closing
     *   tags.
     * - `'/>'`: never add a space before the closing slash in self-closing
     *   tags.
     * - `'auto'`: Add a space iff the user did so in the input.
     *
     * @defaultValue
     * ```ts
     * 'auto'
     * ```
     *
     * @see {@link respectSelfClosing | `respectSelfClosing`}
     *
     * @example
     * Suppose a verbatim environment is defined as follows:
     *
     * ```ts
     * break: {
     *     type: 'noop',
     *     respectSelfClosing: true,
     *     component: 'br',
     * }
     * ```
     *
     * The following transformers would then occur, depending on the chosen
     * value for `selfCloseOutputWith` and the input provided:
     *
     * | `selfCloseOutputWith` | Input             | Output      |
     * |:---------------------:|:------------------|:------------|
     * | `'auto'`              | `<brake />`       | `<br />`    |
     * | `'auto'`              | `<brake/>`        | `<br/>`     |
     * | `' />'`               | `<brake />`       | `<br />`    |
     * | `' />'`               | `<brake/>`        | `<br />`    |
     * | `'/>'`                | `<brake />`       | `<br/>`     |
     * | `'/>'`                | `<brake/>`        | `<br/>`     |
     * | *(any)*               | `<brake></brake>` | `<br></br>` |
     *
     * NB: The last row is included just to clarify the behavior; having
     *     `<br></br>` in the output may not be desirable.
     */
    selfCloseOutputWith?: ' />' | '/>' | 'auto';
}
