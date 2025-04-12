import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

interface HyperfineBenchmark {
    command: string;
    mean: number;
    stddev: number;
    median: number;
    user: number;
    system: number;
    min: number;
    max: number;
    times: number[];
    exit_codes: number[];
    parameters: Record<string, string>;
}

interface BenchmarkJson {
    results: HyperfineBenchmark[];
}

interface Filesize {
    size: number;
    file: string;
    engine: Engine;
    format: Format;
    converter: Converter;
}

interface Benchmarks {
    compilation: BenchmarkJson;
    conversion: BenchmarkJson;
    filesize: (Filesize | null)[];
    filesizeOptimized: (Filesize | null)[];
}

/* --------------------- Read from generated JSON files --------------------- */

const compilation = JSON.parse(
    await readFile('results/benchmarks-compilation.json', 'utf-8'),
) as BenchmarkJson;

const conversion = JSON.parse(
    await readFile('results/benchmarks-conversion.json', 'utf-8'),
) as BenchmarkJson;

const filesize = JSON.parse(
    await readFile('results/benchmarks-filesize.json', 'utf-8'),
) as Filesize[];

const filesizeOptimized = JSON.parse(
    await readFile('results/benchmarks-filesize-optimized.json', 'utf-8'),
) as Filesize[];

/* ------------------------------- Initialize ------------------------------- */

const benchmarks: Benchmarks = {
    compilation,
    conversion,
    filesize,
    filesizeOptimized,
};

// Get file param values
const files: string[] = [];
benchmarks.compilation.results.forEach((result) => {
    const file = result.parameters['file'];
    if (file && !files.includes(file)) files.push(file);
});

type Engine =
    | 'pdflatex'
    | 'xelatex'
    | 'lualatex'
    | 'pdflatexmk'
    | 'xelatexmk'
    | 'lualatexmk';
type Format = 'pdf' | 'dvi' | 'xdv';
type Converter = 'dvisvgm' | 'pdftocairo';

const enginePrettyName = {
    lualatex: 'LuaLaTeX',
    pdflatex: 'pdfLaTeX',
    xelatex: 'XeLaTeX',
    pdflatexmk: 'pdfLaTeXmk',
    lualatexmk: 'LuaLaTeXmk',
    xelatexmk: 'XeLaTeXmk',
} as const;

interface ConversionTableRow {
    converter: Converter;
    format: Format;
    engine: Engine;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    size: number;
    sizeOptimized: number;
}

interface CompilationTableRow {
    engine: Engine;
    format: Format;
    mean: number;
    stddev: number;
    min: number;
    max: number;
}

function interpretCompilationCommand(command: string): {
    engine: Engine;
    format: Format;
} {
    if (command.startsWith('latexmk -pdflua')) {
        return { engine: 'lualatexmk', format: 'pdf' };
    } else if (command.startsWith('latexmk -dvilua')) {
        return { engine: 'lualatexmk', format: 'dvi' };
    } else if (command.startsWith('latexmk -pdfxe')) {
        return { engine: 'xelatexmk', format: 'pdf' };
    } else if (command.startsWith('latexmk -xdv')) {
        return { engine: 'xelatexmk', format: 'xdv' };
    } else if (command.startsWith('latexmk -pdf')) {
        return { engine: 'pdflatexmk', format: 'pdf' };
    } else if (command.startsWith('latexmk -dvi')) {
        return { engine: 'pdflatexmk', format: 'dvi' };
    } else if (command.startsWith('xelatex -no-pdf')) {
        return { engine: 'xelatex', format: 'xdv' };
    } else if (command.startsWith('xelatex')) {
        return { engine: 'xelatex', format: 'pdf' };
    } else {
        const match = /(lualatex|pdflatex) -?-output-format=(\w+)/u.exec(
            command,
        );
        if (match) {
            const engine = match[1] as Engine;
            const format = match[2] as Format;
            return { engine, format };
        }
    }
    throw new Error(`Couldn't interpret compilation command "${command}"`);
}

function compilationResultToTableRow(
    result: HyperfineBenchmark,
): CompilationTableRow {
    const { command, mean, stddev, min, max } = result;
    const { format, engine } = interpretCompilationCommand(command);
    return {
        format,
        engine,
        mean,
        stddev,
        min,
        max,
    };
}

function nsToMs(x: number): string {
    return (x * 1000).toLocaleString('en-US').replace(/\.\d+$/u, '');
}

function compilationTableRowToString(row: CompilationTableRow): string {
    return (
        `| ${enginePrettyName[row.engine]} ` +
        `| ${row.format.toUpperCase()} ` +
        `| ${nsToMs(row.mean)} ` +
        `| ${nsToMs(row.stddev)} ` +
        `| ${nsToMs(row.min)} ` +
        `| ${nsToMs(row.max)} |`
    );
}

function conversionResultToTableRow(
    result: HyperfineBenchmark,
): ConversionTableRow {
    const { command, mean, stddev, min, max } = result;
    const { converter, format, engine } = interpretConversionCommand(command);
    const size =
        benchmarks.filesize.find(
            (f) =>
                f?.file === result.parameters['file'] &&
                f?.engine === engine &&
                (f.format === format ||
                    (f.engine.startsWith('xe') &&
                        ['xdv', 'dvi'].includes(f.format))) &&
                f.converter === converter,
        )?.size ?? -1;
    const sizeOptimized =
        benchmarks.filesizeOptimized.find(
            (f) =>
                f?.file === result.parameters['file'] &&
                f?.engine === engine &&
                (f.format === format ||
                    (f.engine.startsWith('xe') &&
                        ['xdv', 'dvi'].includes(f.format))) &&
                f.converter === converter,
        )?.size ?? -1;
    return {
        converter,
        format,
        engine,
        mean,
        stddev,
        min,
        max,
        size,
        sizeOptimized,
    };
}

const table: {
    conversion: Record<string, string>;
    compilation: Record<string, string>;
} = { conversion: {}, compilation: {} };

files.forEach((file) => {
    table.conversion[file] = [
        '| Converter | Fmt. | Engine | Avg. | $\\sigma$ | Size | Size (opt.)|',
        '|-----------|------|--------|-----:|----------:|-----:|-----------:|',
        ...benchmarks.conversion.results
            .filter((b) => b.parameters['file'] === file)
            .map(conversionResultToTableRow)
            .map(conversionTableRowToString),
    ].join('\n');
    table.compilation[file] = [
        '| Engine | Fmt. | Avg. | $\\sigma$ | Min. | Max. |',
        '|--------|------|-----:|----------:|-----:|-----:|',
        ...benchmarks.compilation.results
            .filter((b) => b.parameters['file'] === file)
            .map(compilationResultToTableRow)
            .map(compilationTableRowToString),
    ].join('\n');
});

function conversionTableRowToString(row: ConversionTableRow): string {
    return (
        `| ${row.converter} ` +
        `| ${row.format.toUpperCase()} ` +
        `| ${enginePrettyName[row.engine]} ` +
        `| ${nsToMs(row.mean)} ` +
        `| ${nsToMs(row.stddev)} ` +
        `| ${row.size.toLocaleString('en-US')} ` +
        `| ${row.sizeOptimized.toLocaleString('en-US')} |`
    );
}

function interpretConversionCommand(command: string): {
    converter: Converter;
    format: Format;
    engine: Engine;
} {
    if (command.startsWith('dvisvgm')) {
        const match = /--output=svg\/(\w+)-(\w+)-dvisvgm\.svg/u.exec(command);
        if (match) {
            const engine = match[1] as Engine;
            const format =
                engine.toLowerCase().startsWith('xe') && match[2] === 'dvi'
                    ? 'xdv'
                    : (match[2] as 'pdf' | 'dvi');
            const converter = 'dvisvgm';
            return { converter, format, engine };
        }
    } else if (command.startsWith('pdftocairo')) {
        const match = /(\w+)-(\w+)-pdftocairo\.svg/u.exec(command);
        if (match) {
            const engine = match[1] as Engine;
            const format = match[2] as Format;
            const converter = 'pdftocairo';
            return { converter, format, engine };
        }
    }
    throw new Error(`Couldn't interpret conversion command "${command}"`);
}

/* ---------------------------- Generate Markdown --------------------------- */

await rm('markdown', { recursive: true, force: true });
await mkdir('markdown/res/benchmarks', { recursive: true });

await Promise.all(
    files.map(async (file) => {
        let svg = await readFile(
            `svg-optimized/${file}-pdflatex-dvi-dvisvgm.svg`,
            'utf-8',
        );
        svg = '<template>\n' + svg + '\n</template>\n';
        svg = svg.replace(
            /(.*)<style>(.*)<\/style>(.*)/su,
            '<style scoped>\n$2\n</style>\n$1$3',
        );
        svg = svg.replace(/&quot;woff2&quot;/gu, '"woff2"');
        await writeFile(`markdown/res/benchmarks/${capitalize(file)}.vue`, svg);
    }),
);

function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const imports = files.map(
    (file) =>
        `import ${capitalize(file)} from './res/benchmarks/${capitalize(file)}.vue';`,
);

const md = `---
title: "Benchmarks"
---

<script setup>
${imports.join('\n')}
</script>

# Benchmarks

<p class="text-lg py-2">
Compare the compilation and conversion times, as well as the size of the output, for different kinds of content and supported LaTeX engines and converters.
</p>

::: info

<div class="compact">

**Legends:**
-   **Compilation:**
    -   **Engine:** The LaTeX engine used for compilation. Note: {pdf,Lua,Xe}LaTeXmk refer to LaTeXmk with the respective engine.
    -   **Fmt.:** The output format of the compilation.
    -   **Avg.:** The average time taken for compilation, in milliseconds.
    -   **$\\sigma$:** The standard deviation of the compilation times, in milliseconds.
    -   **Min.:** The minimum time taken for compilation, in milliseconds.
    -   **Max.:** The maximum time taken for compilation, in milliseconds.
-   **Conversion:**
    -   **Converter:** The tool used for conversion.
    -   **Fmt.:** The format of the input file provided to the converter.
    -   **Engine:** The LaTeX engine that was used to generate the input file provided to the converter.
    -   **Avg.:** The average time taken for conversion, in milliseconds.
    -   **$\\sigma$:** The standard deviation of the conversion times, in milliseconds.
    -   **Size:** The size of the output file generated by the converter, in bytes.
    -   **Size (opt.):** The size of the optimized output file generated by the converter, in bytes.

</div>

:::

${(
    await Promise.all(
        files.map(async (file) =>
            [
                `## ${file.replace(/^\w/u, (m) => m.toUpperCase())}`,
                '',
                `:::: details \`${file}.tex\``,
                '',
                '::: code-group',
                `\`\`\`latex [${file}.tex (DVI)]`,
                await readFile(`files/dvi/${file}.tex`, 'utf-8'),
                '```',
                '',
                `\`\`\`latex [${file}.tex (PDF)]`,
                await readFile(`files/pdf/${file}.tex`, 'utf-8'),
                '```',
                ':::',
                '',
                '::::',
                '',
                `::: details \`${file}.svg\``,
                '<figure class="flex flex-col items-center gap-2 mt-2">',
                '<div class="checkerboard px-10 py-4" >',
                `<${capitalize(file)} class="w-full" />`,
                '</div>',
                `<figcaption class="text-center max-w-prose text-sm text-[var(--vp-c-text-2)]">`,
                `SVG output generated from <code>${file}.dvi</code> with <code>dvisvgm</code>.<br>The <code>${file}.dvi</code> file was generated from <code>${file}.tex</code> via pdfLaTeX.`,
                `</figcaption>`,
                '</figure>',
                ':::',
                '',
                `::: details Compilation`,
                table.compilation[file],
                ':::',
                '',
                `::: details Conversion`,
                table.conversion[file],
                ':::',
            ].join('\n'),
        ),
    )
).join('\n\n')}
`;

await writeFile('markdown/benchmarks.md', md);
