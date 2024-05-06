declare module 'sorcery' {
    export function load(
        file: string,
        options: {
            content?: Record<string, string>;
            sourcemaps?: Record<string, SourceMap>;
        },
    ): Promise<null | Chain>;

    export class Chain {
        node: object;
        sourcesContentByPath: object;
        _stats: Stats;
        stat(): Stats;
        apply(options?: SourceMapOptions): SourceMap;

        /**
         * @param oneBasedLineIndex - The line number in the output file
         * @param zeroBasedColumnIndex - The column number in the output file
         * @returns The source file, line number, column number, and (possibly)
         * the name of the symbol at the given position in the output file.
         */
        trace(
            oneBasedLineIndex: number,
            zeroBasedColumnIndex: number,
        ): TraceResult;

        write(dest: string, options: { inline?: boolean }): Promise<void>;
        write(options: { inline?: boolean }): Promise<void>;
        writeSync(dest: string, options: { inline?: boolean }): void;
        writeSync(options: { inline?: boolean }): void;
    }

    export class Node {
        sources: string[] | null;
        map: SourceMap | null;
        mappings: string | null;
        isOriginalSource: boolean | null;
        file: string | null;
        content: string | null;
        stats: Stats;
        /**
         * @param oneBasedLineIndex - The line number in the output file
         * @param zeroBasedColumnIndex - The column number in the output file
         * @returns The source file, line number, column number, and (possibly)
         * the name of the symbol at the given position in the output file.
         */
        trace(
            oneBasedLineIndex: number,
            zeroBasedColumnIndex: number,
        ): TraceResult;
    }

    function processWriteOptions(
        dest: string,
        chain: Chain,
        options: SourceMapOptions,
    ): {
        resolved: string;
        content: string;
        map: SourceMap;
    };

    function tally(nodes: object[], stat: Stats): object;
    function sourceMapComment(url: string, dest: string): string;

    interface SourceMapOptions {
        includeContent?: boolean;
        base?: string;
        inline?: boolean;
        absolutePath?: boolean;
    }
    interface Stats {
        selfDecodingTime: number;
        totalDecodingTime: number;
        encodingTime: number;
        tracingTime: number;
        untraceable: number;
    }
    export interface TraceResult {
        source: string;
        line: number;
        column: number;
        name: string | null;
    }
    export type SourceMapSegment =
        | [number]
        | [number, number, number, number]
        | [number, number, number, number, number];
    export interface DecodedSourceMap {
        file: string;
        sources: string[];
        sourcesContent?: string[];
        names: string[];
        mappings: SourceMapSegment[][];
        x_google_ignoreList?: number[];
    }
    export class SourceMap {
        constructor(properties: DecodedSourceMap);

        version: number;
        file: string;
        sources: string[];
        sourcesContent?: string[];
        names: string[];
        mappings: string;
        x_google_ignoreList?: number[];

        /**
         * Returns the equivalent of `JSON.stringify(map)`
         */
        toString(): string;
        /**
         * Returns a DataURI containing the sourcemap. Useful for doing this sort of thing:
         * `generateMap(options?: SourceMapOptions): SourceMap;`
         */
        toUrl(): string;
    }
}
