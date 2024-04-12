import type { RequiredNonNullable } from '$types';

export type SimplerProcessFn<ProcessOptions extends object | boolean> = (
    content: string,
    options: ProcessOptions,
) => string | Promise<string>;

export type ProcessFn<ProcessOptions extends object | boolean, H> = (
    content: string,
    options: ProcessOptions,
    handler: H,
) => string | Promise<string>;

export type ConfigureFn<Configuration extends object, H> = (
    configuration: Configuration,
    handler: H,
) => void | Promise<void>;

export interface DefineHandlerInterface<
    PossibleBackend extends string,
    Config extends object,
    FullConfig extends Config,
    ProcessOpts extends object,
    Processor extends object = object,
> extends Record<string, unknown> {
    possibleBackend: PossibleBackend;
    processor: Processor;
    process: ProcessFn<ProcessOpts, this>;
    configuration: FullConfig;
    configure: ConfigureFn<Config, this>;
}

export interface HandlerInterface {
    possibleBackend: string;
    processor: object;
    process: ProcessFn<object, this>;
    configuration: object;
    configure: ConfigureFn<object, this>;
}

export interface IHandler<
    PartialConfiguration = Record<string, unknown>,
    Processor = null,
    ProcessOptions = boolean,
    FullConfiguration = RequiredNonNullable<PartialConfiguration>,
> {
    /**
     * Some handlers can benefit from keeping track of a configuration object.
     *
     * (The alternative would be to redefine `process` to take in a new
     * configuration object every time it is called, but this way we can let
     * `process` be a readonly property.)
     */
    configuration?: FullConfiguration;
    processor?: Processor | undefined;
    readonly process: (
        content: string,
        options: ProcessOptions,
        handler: this,
    ) => string | Promise<string>;
    readonly configure?: (
        configuration: PartialConfiguration,
        handler: this,
    ) => void;

    [key: string]: unknown;
}

export interface IBackend<PossibleBackend extends string> {
    readonly backend: PossibleBackend;
    backendIs<Q extends PossibleBackend>(backend: Q): this is IBackend<Q>;
}
