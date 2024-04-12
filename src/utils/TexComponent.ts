import { type BinaryToTextEncoding, createHash } from 'node:crypto';
import type {
    CliInstruction,
    TexComponentConfig,
    SupportedTexEngine,
    FullTexLiveConfig,
    FullTexComponentConfig,
    HTMLFigureAttributes,
} from '$types';
import { JSDOM } from 'jsdom';
import { dirname, join } from 'node:path';
import {
    log,
    mergeConfigs,
    spawnCliInstruction,
    time,
    timeSince,
    timeToString,
} from '$utils';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildDvisvgmInstruction } from '$utils';
import { AdvancedTexHandler } from '$src';
import {
    defaultAdvancedTexConfiguration,
    defaultTexComponentConfig,
} from '$config';
import pc from 'picocolors';
import ora from 'ora';
import type { MarkRequiredNonNullable } from '$types';
import { alphanumeric } from '$src/processor/Sveltex.js';

/**
 * Hash function used to generate unique references for TeX components.
 */
export function sha256(
    input: string,
    format: BinaryToTextEncoding = 'base64url',
): string {
    return createHash('sha256').update(input).digest(format);
}

/**
 * A SvelTeX component — i.e., a component which can be used in SvelTeX files —
 * whose contents will be rendered using a TeX engine, after which the entire
 * component gets replaced by an `<img>` tag referencing the rendered TeX file
 * (an SVG).
 */
export class TexComponent {
    readonly svgComponentName: string;
    get svgComponentTag(): string {
        return `<${this.svgComponentName} />`;
    }
    readonly name: string;

    /**
     * TeX component config to use to render this component.
     */
    private _configuration: FullTexComponentConfig = defaultTexComponentConfig;

    set configuration(config: TexComponentConfig) {
        this._configuration = mergeConfigs(this._configuration, config);
    }

    get configuration(): FullTexComponentConfig {
        return this._configuration;
    }

    get texLiveConfig(): FullTexLiveConfig {
        const parentConfig = {
            ...this.advancedTexHandler.configuration,
        } as FullTexLiveConfig & { components?: never };
        delete parentConfig.components;

        return mergeConfigs(
            defaultAdvancedTexConfiguration.local,
            parentConfig,
            this.configuration.overrides,
        );

        // return {
        //     ...defaultAdvancedTexConfiguration.local,
        //     ...parentConfig,
        //     ...this.configuration.overrides,
        //     dvisvgmOptions: {
        //         ...defaultAdvancedTexConfiguration.local.dvisvgmOptions,
        //         ...parentConfig.dvisvgmOptions,
        //         ...this.configuration.overrides.dvisvgmOptions,
        //     },
        // } as FullTexLiveConfig;
    }

    /**
     * Content of the component (interpreted as TeX code which would be given
     * between `\begin{document}` and `\end{document}`).
     *
     */
    private texDocumentBody: string;

    /**
     * SHA256 hash (in base64url) of the component's TeX content.
     *
     */
    readonly hash: string;

    /**
     * The base filename to use for files associated with this component. Esed
     * as `\jobname` in the TeX document.
     *
     * @example 'myfig'
     *
     * @remarks Please provide a string without any extensions (i.e., *not*
     * ending in `.svg`, `.tex`, etc.).
     *
     * @remarks The TexComponent will log an error to the console if the
     * filename includes any path separators (`'/'` or `'\'`), and replace them
     * with `'+'` before using the filename.
     *
     * @example
     * If `this.ref` is `'myfig'` and `this.config.outputDirectory` is
     * `'src/sveltex/tikz'` the rendered TeX file will be saved to
     * `src/sveltex/tikz/myfig.svg`.
     *
     * @readonly
     */
    readonly ref: string;

    get svgImportPath(): string {
        return this.svgFilepath;
    }

    /**
     * The filepath to the output SVG file.
     *
     * @example 'src/sveltex/tikz/myfig.svg'
     */
    get svgFilepath(): `${string}.svg` {
        return join(
            this.outputDirectoryRel,
            `${this.ref}.svg`,
        ) as `${string}.svg`;
    }

    // /**
    //  * The filepath to the output SVG file, relative to the static directory.
    //  *
    //  * @example 'sveltex/tikz/myfig.svg'
    //  */
    // get svgFilepathFromStatic(): `${string}.svg` {
    //     return join(
    //         this.outputDirectoryFromStatic,
    //         `${this.ref}.svg`,
    //     ) as `${string}.svg`;
    // }

    /**
     * The filename of the TeX file to be generated.
     *
     * @example 'myfig.tex'
     */
    get texFilename(): `${string}.tex` {
        return `${this.ref}.tex`;
    }

    /**
     * The filepath to the TeX file to be generated.
     *
     * @example 'node_modules/.cache/sveltex-preprocess/tikz/myfig/myfig.tex'
     */
    get texFilepath(): `${string}.tex` {
        return join(this.texDirectory, this.texFilename) as `${string}.tex`;
    }

    /**
     * The directory in which to store the TeX file and any auxiliary files
     * generated during compilation.
     *
     * @example 'node_modules/.cache/sveltex-preprocess/tikz/ref'
     */
    private get texDirectory(): string {
        return join(this.texLiveConfig.cacheDirectory, this.name, this.ref);
    }

    /**
     * The file**name** (*not* file**path**) to use for the intermediary DVI or
     * PDF file generated by the TeX engine.
     *
     * @example 'myfig.pdf'
     */
    private get intermediaryFilename(): `${string}.${'pdf' | 'dvi'}` {
        return `${this.ref}.${this.texLiveConfig.intermediateFiletype}`;
    }

    /**
     * Path to the DVI or PDF file generated by the TeX engine.
     *
     * @example 'node_modules/.cache/sveltex-preprocess/tikz/ysmaZDEwj9Kal7qPZM4IxXqSAFBV41ibfpDOWjYhN5I.pdf'
     */
    get intermediaryFilepath(): `${string}.${'pdf' | 'dvi'}` {
        return join(
            this.texDirectory,
            this.intermediaryFilename,
        ) as `${string}.${'pdf' | 'dvi'}`;
    }

    /**
     * The directory in which to store the output SVG file.
     *
     * @example 'static/sveltex/tikz'
     */
    get outputDirectoryRel(): string {
        return join(this.texLiveConfig.outputDirectory, this.name);
    }

    /**
     * The directory from which static assets are served.
     *
     * @example 'static'
     */
    get staticDirectory(): string {
        return (
            (this.outputDirectoryRel.match(/^(?:\.?\/)?([^]+?)(?:\/(.*)|$)/u) ??
                [])[1] ?? 'static'
        );
    }

    /**
     * The directory from which static assets are served.
     *
     * @example 'sveltex'
     */
    private get outputDirectoryFromStatic(): string {
        return (
            (this.outputDirectoryRel.match(/^(?:\.?\/)?([^]+?)(?:\/(.*)|$)/u) ??
                [])[2] ?? ''
        );
    }

    /**
     * Attributes of the `<figure>` tag that will be generated for this component.
     *
     */
    private _attributes: MarkRequiredNonNullable<HTMLFigureAttributes, 'id'>;

    /**
     * Getter: Get the attributes of the `<img>` tag that will be generated for
     * this component, including the automatically generated `src` attribute.
     *
     * @remarks The `alt` attribute defaults to the filename of the rendered SVG
     * file if not explicitly set anywhere.
     */
    get attributes(): MarkRequiredNonNullable<HTMLFigureAttributes, 'id'> {
        return {
            ...this._attributes,
        };
    }

    /**
     * Setter: Add attributes to the `<figure>` tag that will be generated for
     * this component.
     *
     * @param attributes - Attributes to add to the `<figure>` tag.
     *
     * @remarks Existing attributes are only overwritten if they are explicitly
     * set in the new attributes object. To "unset" an existing attribute, set
     * it to `undefined`.
     */
    set attributes(attributes: HTMLFigureAttributes) {
        // Filter out any keys of `attributes` which are not in the
        // HTMLFigureAttributes type
        // const validKeys = Object.keys(attributes).filter(
        //     (key) => key in this._attributes && key !== 'src',
        // );
        // const validAttributes = Object.fromEntries(
        //     validKeys.map((key) => [
        //         key,
        //         attributes[key as keyof Omit<HTMLFigureAttributes, 'src'>],
        //     ]),
        // );
        this._attributes = mergeConfigs(this._attributes, attributes);
    }

    /**
     * Create a new TeX component.
     */
    constructor({
        name,
        config,
        texDocumentBody,
        ref,
        attributes,
        advancedTexHandler,
    }: {
        name: string;
        config?: TexComponentConfig | undefined;
        texDocumentBody?: string;
        ref: string;
        attributes?: HTMLFigureAttributes | undefined;
        // From parent Sveltex instance
        advancedTexHandler: AdvancedTexHandler<'local'>;
    }) {
        this.ref = ref;
        this.name = name;
        this.advancedTexHandler = advancedTexHandler;
        if (config) this.configuration = config;
        this.texDocumentBody = texDocumentBody ?? '';
        this.hash = sha256(this.content);
        if (attributes) {
            this._attributes = {
                ...attributes,
                id: attributes.id ?? this.hash,
            };
        } else {
            this._attributes = { id: this.hash };
        }
        this.svgComponentName = `Sveltex000${alphanumeric(this.name)}000${alphanumeric(this.ref)}}`;
    }

    private readonly advancedTexHandler: AdvancedTexHandler<'local'>;

    /**
     * The full content of the `.tex` file corresponding to the component.
     *
     * @example
     * ```tex
     * \documentclass{standalone}
     * \usepackage{microtype}
     * \begin{document}
     * example
     * \end{document}
     * ```
     */
    get content(): string {
        return [
            this.configuration.documentClass,
            this.configuration.preamble,
            '\\begin{document}',
            this.texDocumentBody,
            '\\end{document}',
        ].join('\n');
    }

    /**
     * Compile the component's content:
     * 1. Write the content to a temporary TeX file.
     * 2. Compile the TeX file using the specified TeX engine.
     * 3. Convert the resulting PDF to an SVG using the specified conversion
     *   command.
     * 4. Save the SVG to the specified output directory.
     * 5. Return the path to the SVG file.
     */
    readonly compile = async (): Promise<number | null> => {
        try {
            const texFilepath = this.texFilepath;
            const svgFilepath = this.svgFilepath;

            // 1. Write the content to a temporary TeX file
            const { escaped, cssColorVars } =
                this.escapeCssColorVarsToNamedColors(this.content);

            const compilationCacheHit =
                existsSync(texFilepath) && this.texLiveConfig.caching;
            const conversionCacheHit =
                compilationCacheHit && existsSync(svgFilepath);

            if (!compilationCacheHit) {
                writeFileSyncEnsureDir(texFilepath, escaped);
                const compileCmd = this.compileCmd;
                const compileCmdString = `${compileCmd.command} ${compileCmd.args?.join(' ') ?? ''}`;

                // console.info(pc.blue(`> ${compileCmdString}`));
                const start = time();
                const spinner = ora(`Compiling "${this.texFilepath}"`).start();
                const compilation = await spawnCliInstruction(compileCmd);

                if (compilation.code !== 0) {
                    spinner.fail(
                        pc.red(
                            `TeX compilation failed for "${this.texFilepath}" a ${timeToString(timeSince(start))}. See ${this.texFilepath.replace(/\.tex$/, '.log')} for details.`,
                        ),
                    );
                    log(
                        'error',
                        'dim',
                    )(
                        `\nThe compilation was attempted by running the following command from within "${String(compileCmd.cwd ?? process.cwd())}":\n\n${compileCmdString}\n\nThe following stderr was produced:${compilation.stderr.length > 0 ? '\n\n' + compilation.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${compilation.stdout.length > 0 ? '\n\n' + compilation.stdout : pc.italic(' (no stdout output)')}\n`,
                    );
                    // console.log('escaped', escaped);
                    return compilation.code;
                } else {
                    spinner.succeed(
                        pc.green(
                            `Compiled "${this.texFilename}" in ${timeToString(timeSince(start))}`,
                        ),
                    );
                }
            }

            if (!conversionCacheHit) {
                const convertCmd = this.convertCmd;
                const convertCmdString = `${convertCmd.command} ${convertCmd.args?.join(' ') ?? ''}`;

                ensureDirSync(this.outputDirectoryRel);

                // console.info(pc.blue(`> ${convertCmdString}`));
                const start = time();
                const spinner = ora(
                    `Converting "${this.intermediaryFilename}" to SVG`,
                ).start();
                const conversion = await spawnCliInstruction(convertCmd);

                if (conversion.code !== 0) {
                    spinner.fail(
                        pc.red(
                            `${this.texLiveConfig.intermediateFiletype.toUpperCase()} to SVG conversion failed for "${this.intermediaryFilepath}" after ${timeToString(timeSince(start))}.`,
                        ),
                    );
                    log(
                        'error',
                        'dim',
                    )(
                        `\nThe conversion was attempted by running the following command from within "${String(convertCmd.cwd ?? process.cwd())}":\n\n${convertCmdString}\n\nThe following stderr was produced:${conversion.stderr.length > 0 ? '\n\n' + conversion.stderr : pc.italic(' (no stderr output)')}\n\nThe following stdout was produced: ${conversion.stdout.length > 0 ? '\n\n' + conversion.stdout : pc.italic(' (no stdout output)')}\n`,
                    );
                    return conversion.code;
                }

                const svg = readFileSync(svgFilepath, 'utf8');
                const unescaped = unescapeCssColorVarsFromSvg(
                    svg,
                    cssColorVars,
                );
                writeFileSync(svgFilepath, unescaped);

                spinner.succeed(
                    pc.green(
                        `Converted to "${this.ref}" in ${timeToString(timeSince(start))}`,
                    ),
                );
            }

            return 0;
        } catch (err) {
            log('error')(
                `✖ Error while compiling or converting ${this.texFilename}:\n\n`,
                err,
            );
            return 1;
        }
    };

    private readonly _figureElement: HTMLElement =
        new JSDOM().window.document.createElement('figure');

    /**
     * {@link HTMLElement | `<figure>`} element that will be generated for
     * this component, with the `src` attribute set to the path of the rendered
     * SVG file.
     */
    get figureElement() {
        for (const [attr, value] of Object.entries(this.attributes)) {
            if (typeof value === 'string') {
                this._figureElement.setAttribute(attr, value);
            }
        }
        return this._figureElement;
    }

    /**
     * CLI instruction with which to convert the TeX output PDF/DVI to an SVG.
     */
    get convertCmd(): CliInstruction {
        const overrideInstr = this.texLiveConfig.overrideConversionCommand;
        const instr = overrideInstr
            ? overrideInstr
            : // If no conversion command is specified, use dvisvgm
              buildDvisvgmInstruction({
                  dvisvgmOptions: this.texLiveConfig.dvisvgmOptions,
                  inputType: this.texLiveConfig.intermediateFiletype,
                  outputPath: this.svgFilepath,
                  texPath: this.intermediaryFilepath,
              });
        const env = {
            FILEPATH: this.intermediaryFilepath,
            FILENAME: this.intermediaryFilename,
            FILENAME_BASE: this.hash,
            FILETYPE: this.texLiveConfig.intermediateFiletype,
            OUTDIR: this.outputDirectoryRel,
            OUTFILEPATH: this.svgFilepath,
        };
        instr.env = { ...instr.env, ...env };
        instr.silent = true;
        return instr;
    }

    /**
     * CLI instruction with which to compile the `.tex` file.
     */
    get compileCmd(): CliInstruction {
        const env = {
            FILEPATH: this.texFilepath,
            FILENAME: this.texFilename,
            FILENAME_BASE: this.hash,
            OUTDIR: this.texDirectory,
            OUTFILETYPE: this.texLiveConfig.intermediateFiletype,
        };

        const override = this.texLiveConfig.overrideCompilationCommand;
        if (override) {
            override.env = { ...override.env, ...env };
            return override;
        }

        const cwd = this.texDirectory;
        const args: string[] = [];
        const engine = this.texLiveConfig.engine;
        const filetype = this.texLiveConfig.intermediateFiletype;
        const silent = true;

        /**
         * Curiously enough, `lualatex` prefixes flags with `--` , while all the
         * other engines use `-`.
         */
        const pre = engine === 'lualatex' ? '--' : '-';

        // Add the TeX engine command
        const command = texBaseCommand[engine];

        // Add the filetype flag
        switch (engine) {
            case 'lualatex':
            case 'latexmk':
            case 'pdflatex':
                args.push(pre + 'output-format=' + filetype);
                break;
            case 'tex':
                if (filetype === 'pdf') {
                    log('error')('Plain TeX does not support PDF output.');
                }
                break;
            case 'lualatexmk':
                args.push(filetype === 'pdf' ? '-pdflua' : '-dvilua');
                break;
        }

        // Add --safer resp. -safer flag for lualatex resp. lualatexmk, if
        // saferLua is set to true
        if (
            (engine === 'lualatex' || engine === 'lualatexmk') &&
            this.texLiveConfig.saferLua
        ) {
            args.push(pre + 'safer');
        }

        // Add shell escape flags
        const shellEscape = this.texLiveConfig.shellEscape;
        if (shellEscape === 'restricted') {
            args.push(pre + 'shell-restricted');
        } else {
            // if (Array.isArray(shellEscape)) {
            //     args.push(
            //         `${pre}cnf-line="shell_escape_commands=${shellEscape.join(',')}"`,
            //     );
            // }
            args.push(pre + (!shellEscape ? 'no-' : '') + 'shell-escape');
        }

        // Add interaction flag
        args.push(`${pre}interaction=nonstopmode`);

        // args.push(`${pre}silent`);

        // Add the filename
        args.push(`"${this.texFilename}"`);

        return { command, args, env, cwd, silent };
    }

    /**
     * Escape CSS color variables in the TeX content to named colors.
     *
     * @param tex - TeX content to escape.
     * @returns The escaped TeX content and a map of the CSS color variables to
     * their corresponding named colors.
     *
     * @example
     * Calling this function on the following TeX content...
     *
     * ```tex
     * \documentclass[tikz]{standalone}
     * \usepackage{microtype}
     * \begin{document}
     * \begin{tikzpicture}
     *     \draw[var(--red)] (0,0) rectangle (3, 3);
     * \end{tikzpicture}
     * \end{document}
     * ```
     *
     * ...would return a variable `escaped` containing...
     *
     * ```tex
     * \documentclass[tikz]{standalone}
     * \usepackage{xcolor}
     * \definecolor{sveltexe4a6ed}{HTML}{e4a6ed}
     * \usepackage{microtype}
     * \begin{document}
     * \begin{tikzpicture}
     *     \draw[sveltexe4a6ed] (0,0) rectangle (3, 3);
     * \end{tikzpicture}
     * \end{document}
     * ```
     *
     * ...and a map `cssColorVars` with the entry `var(--red) => 'e4a6ed'`.
     */
    escapeCssColorVarsToNamedColors(tex: string) {
        const cssColorVars = parseCssColorVarsFromTex(tex);
        let escaped = tex;
        cssColorVars.forEach((color, cssColorVar) => {
            escaped = escaped.replaceAll(cssColorVar, 'sveltex' + color);
        });

        escaped = escaped
            .split(this.configuration.documentClass)
            .join(
                this.configuration.documentClass +
                    '\n\\usepackage{xcolor}\n' +
                    texDefineHexColors(cssColorVars),
            );
        return { escaped, cssColorVars };
    }
}

const texBaseCommand: Record<SupportedTexEngine, string> = {
    lualatex: 'lualatex',
    pdflatex: 'pdflatex',
    tex: 'tex',
    latexmk: 'latexmk',
    // The output format flag will take care of making this actually use
    // lualatex
    lualatexmk: 'latexmk',
};

// type SvgFilename = `${string}.svg`;
// function isSvgFilename(filename: string): filename is SvgFilename {
//     return filename.endsWith('.svg');
// }
// function ensureEndsInSvg(filename: string): SvgFilename {
//     return isSvgFilename(filename)
//         ? filename
//         : isSvgFilename(filename.toLowerCase())
//           ? `${filename.slice(0, -4)}.svg`
//           : `${filename}.svg`;
// }

// Support CSS color variables in advanced TeX blocks
const cssVarRegex = /var\(--[-]*[_a-zA-Z\u00A1-\uFFFF][-\w\u00A1-\uFFFF]*\)/gu;

export function texDefineHexColors(cssColorVars: Map<CssVar, string>) {
    return [...cssColorVars.values()]
        .map((color) => `\\definecolor{sveltex${color}}{HTML}{${color}}`)
        .join('\n');
}

type CssVar = `var(--${string})`;
function isCssVar(str: string): str is CssVar {
    return str.startsWith('var(--') && str.endsWith(')');
}

export function parseCssColorVarsFromTex(tex: string) {
    const cssColorVarMatches = [...new Set(tex.match(cssVarRegex))];
    const cssColorVars = new Map<CssVar, string>();
    cssColorVarMatches.forEach((cssColorVar) => {
        if (isCssVar(cssColorVar)) {
            const color = sha256(cssColorVar, 'hex').slice(0, 6);
            cssColorVars.set(cssColorVar, color);
        }
    });
    return cssColorVars;
}

export function unescapeCssColorVarsFromSvg(
    svg: string,
    cssColorVars: Map<CssVar, string>,
) {
    let unescaped = svg;
    cssColorVars.forEach((hexColor, cssColorVar) => {
        unescaped = unescaped.replaceAll(`#${hexColor}`, cssColorVar);
        const hexColorArray = hexColor.split('');
        if (
            hexColorArray[0] &&
            hexColorArray[2] &&
            hexColorArray[4] &&
            hexColorArray[0] === hexColorArray[1] &&
            hexColorArray[2] === hexColorArray[3] &&
            hexColorArray[4] === hexColorArray[5]
        ) {
            unescaped = unescaped.replaceAll(
                '#' + hexColorArray[0] + hexColorArray[2] + hexColorArray[4],
                cssColorVar,
            );
        }
    });
    return unescaped;
}

/**
 * Ensure that a directory exists, creating it (and any necessary intermediate
 * directories) if it does not.
 */
export function ensureDirSync(dir: string) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

/**
 * Write content to a file, creating any necessary directories along the way. If
 * the file already exists, it will be overwritten.
 *
 * @param file - Path to the file to write.
 * @param content - Content to write to the file.
 *
 * @remarks `'utf8'` encoding is used to write the file.
 */
export function writeFileSyncEnsureDir(file: string, content: string) {
    const dir = dirname(file);

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    writeFileSync(file, content, 'utf8');
}
