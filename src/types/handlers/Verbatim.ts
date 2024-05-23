/* eslint-disable tsdoc/syntax */
import type { TexLiveConfiguration } from '$types/handlers/AdvancedTex.js';
import { PreAndPostTransformations } from '$types/handlers/misc.js';
import type {
    EscapeOptions,
    InterpretedAttributes,
} from '$types/utils/Escape.js';
import type {
    FirstTwoLevelsRequiredNonNullable,
    RequiredNonNullable,
} from '$types/utils/utility-types.js';
import { TexComponent } from '$utils/TexComponent.js';

export interface VerbatimProcessOptions {
    filename: string;
    selfClosing: boolean;
    attributes: InterpretedAttributes;
    tag: string;
    outerContent?: string | undefined;
    escapeOptions?: EscapeOptions | undefined;
}

export type FullVerbatimConfiguration = Record<string, FullVerbEnvConfig>;
export type VerbatimConfiguration = Record<string, VerbEnvConfig>; // {
/**
 * Verbatim environments.
 *
 * @remarks The keys are the names of the environments, and the values
 * describe how to process the inner content of the environment.
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
 * {
 *     Code: {
 *         type: 'code',
 *         defaultAttributes: {
 *             inline: false,
 *             lang: 'plaintext',
 *         }
 *     },
 *     TeX: {
 *         type: 'advancedTex',
 *         aliases: ['tex', 'LaTeX', 'latex'],
 *         defaultAttributes: {
 *             inline: false,
 *         }
 *     }
 * }
 * ```
 */
//     verbatimEnvironments?:
//         | undefined
//         | Record<string, VerbatimEnvironmentConfiguration>;
// }

/**
 * Interface used to describe how to escape a string.
 */
export interface SimpleEscapeInstruction {
    /**
     * Braces (aka. curly brackets) should be escaped:
     * - `{` → `&lbrace;`
     * - `}` → `&rbrace;`
     *
     * @defaultValue `false`
     */
    escapeBraces?: boolean | undefined;

    /**
     * HTML should be escaped:
     * - `<` → `&lt;`
     * - `>` → `&gt;`
     * - `&` → `&amp;`
     * - `"` → `&quot;`
     * - `'` → `&apos;`
     *
     * @defaultValue `true`
     */
    escapeHtml?: boolean | undefined;
}

/**
 * Type describing the possible ways to process the inner content of a verbatim
 * environment.
 */
export type VerbatimType =
    | 'code'
    | 'noop'
    | 'advancedTex'
    | 'escapeOnly'
    | 'custom';
// | SimpleEscapeInstruction
// | VerbatimProcessInnerFn;

/**
 * Function which takes the inner content and the attributes of a verbatim
 * environment and returns the processed content (including HTML tag).
 *
 * @param inner - The inner content of the component.
 * @param attributes - The attributes of the component.
 *
 * @example
 * ```ts
 * (inner, attributes) => {
 *     let attrStrings = Object.entries(attributes).map(
 *         ([key, value]) => `${key}="${String(value)}"`
 *     );
 *     const attrString = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';
 *     return `<pre${attrString}><code>${inner}</code></pre>`;
 * }
 * ```
 */
export type VerbatimProcessInnerFn = (
    inner: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
) => string;

export type FullVerbEnvConfig =
    | FullVerbEnvConfigCode
    | FullVerbEnvConfigCustom
    | FullVerbEnvConfigEscapeOnly
    | FullVerbEnvConfigNoop
    | FullVerbEnvConfigAdvancedTex;

export type VerbEnvConfig =
    | VerbEnvConfigCode
    | VerbEnvConfigCustom
    | VerbEnvConfigEscapeOnly
    | VerbEnvConfigNoop
    | VerbEnvConfigAdvancedTex;

export type FullVerbEnvConfigCode = RequiredNonNullable<VerbEnvConfigCode> &
    FullVerbEnvConfigBase;
export type FullVerbEnvConfigCustom = RequiredNonNullable<VerbEnvConfigCustom> &
    FullVerbEnvConfigBase;
export type FullVerbEnvConfigEscapeOnly =
    RequiredNonNullable<VerbEnvConfigEscapeOnly> & FullVerbEnvConfigBase;
export type FullVerbEnvConfigNoop = RequiredNonNullable<VerbEnvConfigNoop> &
    FullVerbEnvConfigBase;
export type FullVerbEnvConfigAdvancedTex =
    RequiredNonNullable<VerbEnvConfigAdvancedTex> & FullVerbEnvConfigBase;

export type FullVerbEnvConfigBase = RequiredNonNullable<VerbEnvConfigBase> &
    FirstTwoLevelsRequiredNonNullable<
        Pick<VerbEnvConfigBase, 'transformations'>
    >;

/**
 * TeX component configuration options.
 */
export interface VerbEnvConfigAdvancedTex extends VerbEnvConfigBase {
    /**
     * Name of the component (used to define an HTML tag for SvelTeX files).
     *
     * @remarks Names are case-sensitive.
     * @remarks Don't use existing HTML tags as names (e.g., don't use `code` or
     * `span`).
     * @example 'tikz'
     */
    // name: string;

    type: 'advancedTex';

    respectSelfClosing?: false;
    component?: 'none';

    // /**
    //  * Aliases for the component.
    //  *
    //  * @remarks Aliases are case-sensitive.
    //  * @remarks Don't use existing HTML tags as aliases (e.g., don't use `code`
    //  * or `span`).
    //  * @example ['TikZ', 'Tikz']
    //  */
    // aliases?: string[];

    /**
     * Preamble to include in the TeX file (everything after
     * `\documentclass{...}` but before `\begin{document}`).
     *
     * @defaultValue
     * ```tex
     * \usepackage{microtype}
     * ```
     */
    preamble?: string;

    /**
     * First line(s) of the TeX document.
     *
     * @defaultValue `'\\documentclass{standalone}'`
     */
    documentClass?: string;

    /**
     *
     */
    overrides?: TexLiveConfiguration | undefined;

    /**
     * @param attributes - Attributes the user passed to the TeX component
     * (except `ref`).
     * @param tc - The TeX component, which this function may mutate.
     * @returns An object which will be assigned to the
     * {@link TexComponent.handledAttributes | `handledAttributes`} property of
     * the TeX component, for use by the {@link postprocess | `postprocess`}
     * function.
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
     */
    postprocess?: (svgComponent: string, tc: TexComponent) => string;
}

export interface VerbEnvConfigNoop extends VerbEnvConfigBase {
    type: 'noop';
}

export interface VerbEnvConfigCode extends VerbEnvConfigBase {
    type: 'code';

    /**
     * **Note: For `type === 'code'` only.**
     *
     * Whether to wrap the "inner output" in a `<code>` tag (or `<pre><code>`,
     * depending on whether the `inline` attribute is `true`.
     *
     * @defaultValue `true`
     *
     * @example
     * ```ts
     * Example: {
     *     type: 'code',
     *     wrap: true,
     * }
     * ```
     *
     * Now, the following code block...
     *
     * ```html
     * <Example lang="js">
     * let a
     * </Example>
     * ```
     *
     * ...would be transformed into...
     *
     * ```html
     * <Example lang="js">
     * <pre><code class="language-js">
     * <span class="hljs-keyword">let</span> a
     * </code></pre>
     * </Example>
     * ```
     *
     * Meanwhile, if `wrap` had been set to `false`, the output would've been:
     *
     * ```html
     * <Example lang="js">
     * <span class="hljs-keyword">let</span> a
     * </Example>
     * ```
     */
    wrap?: boolean | undefined;
}

export interface VerbEnvConfigEscapeOnly extends VerbEnvConfigBase {
    type: 'escapeOnly';
    escapeInstructions?: SimpleEscapeInstruction | undefined;
}
export interface VerbEnvConfigCustom extends VerbEnvConfigBase {
    type: 'custom';
    customProcess?: VerbatimProcessInnerFn | undefined;
}

export interface VerbEnvConfigBase {
    /**
     * How to process the inner content of the component.
     *
     * - `'advancedTex'`: Process as advanced TeX component.
     * - `'code'`: Process inner content as code.
     * - `'noop'`: Leave inner content as-is.
     * - `'escapeOnly'`: Escape the inner content according to the given
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
     * - `'advancedTex'`: `[]`
     * - _Otherwise:_ `['lang', 'inline', 'info']`
     * @see {@link attributeForwardingAllowlist | `attributeForwardingAllowlist`}
     */
    attributeForwardingBlocklist?: string[];

    /**
     * HTML tags that should be treated as aliases for this component.
     *
     * @defaultValue `[]`
     *
     * @remarks
     * The output will remain the same regardless of which, if any, alias
     * was used.
     */
    aliases?: string[] | undefined;

    /**
     * @defaultValue
     * - `type === 'advancedTex'`: `null`, which means the processed
     *   inner content won't be wrapped in anything (in particular,
     *   `postprocess` should take care of this in the case of TeX components).
     * - otherwise: `'this'`, which means the key of this object in the
     *   `verbatim` prop is used.
     *
     * @example
     * ```ts
     * Example: {
     *     component: 'Code',
     *     type: 'code',
     * }
     * ```
     *
     * Now, the following code block:
     *
     * ```html
     * <Example lang="js">
     * let a
     * </Example>
     * ```
     *
     * ...would be processed the same way as this one:
     *
     * ```html
     * <Code lang="js">
     * <span class="hljs-keyword">let</span> a
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
     * Now we'd have the following transformations:
     *
     * - `<break />` → `<br />`
     * - `<break/>` → `<br/>`
     * - `<break></break>` → `<br></br>` (just to clarify the behavior, you
     *   shouldn't do this in this particular case).
     */
    respectSelfClosing?: boolean | undefined;

    /**
     * Transformations to apply to
     * - the inner content before passing it to the `VerbatimHandler` for
     *   processing, or to
     * - the inner content of the output produced by the `VerbatimHandler`
     *   (or by whatever handler it forwards the content to).
     */
    transformations?:
        | PreAndPostTransformations<VerbatimProcessOptions>
        | undefined;

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
     * @defaultValue `'auto'`
     * @see {@link respectSelfClosing | `respectSelfClosing`}
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
     * The following transformations would then occur, depending on the chosen
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
