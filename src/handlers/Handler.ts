// Types
import type {
    ConfigureFn,
    ProcessFn,
    SimplerProcessFn,
} from '$types/handlers/Handler.js';

// Internal dependencies
import { mergeConfigs } from '$utils/merge.js';

// External dependencies
import { getProperty, rfdc, setProperty } from '$deps.js';

export const deepClone = rfdc();

/**
 * This is the generic class which all handlers should extend.
 *
 * ---
 * ##### CONCERETE TYPE PARAMETERS
 *
 * @typeParam ActualBackend - The name of the handler backend. Should extend
 * {@link PossibleBackend | `PossibleBackend`}.
 *
 * @typeParam PossibleBackend - The possible values for the backend.
 *
 * ---
 * ##### GENERIC TYPE PARAMETERS
 *
 * The following type parameters should usually be generic, with
 * {@link ActualBackend | `ActualBackend`} as the type parameter:
 *
 * @typeParam Processor - The type of
 * {@link Handler.processor | `Handler.processor`}.
 *
 * @typeParam ProcessOptions - The type of the second parameter of the
 * {@link Handler.process | `Handler.process`} function.
 *
 * @typeParam Configuration - The type of input accepted by
 * {@link Handler.configure |` Handler.configure`}.
 *
 * @typeParam FullConfiguration - The return type of the
 * {@link Handler.configuration | `Handler.configuration`} getter.
 *
 * @typeParam ActualHandler - The type of the specific handler extending this
 * more generic {@link Handler | `Handler`} class.
 *
 * @example
 * ```ts
 * class ExampleHandler<
 *     B extends 'backend-1' | | 'backend-2' | 'none'
 * > extends Handler<
 *     B, // actual backend
 *     'backend-1' | 'backend-2' | 'none', // possible backends
 *     object, // processor
 *     object, // process options
 *     Configuration<B>, // configuration
 *     Required<Configuration<B>>, // full configuration
 *     ExampleHandler<B> // "actual handler"
 * {
 *     // ...
 * }
 * ```
 */
export class Handler<
    ActualBackend extends PossibleBackend,
    PossibleBackend extends string,
    Processor extends object,
    ProcessOptions extends object,
    Configuration extends object,
    FullConfiguration extends object,
    ActualHandler extends object,
> {
    /**
     * The name of the handler backend.
     *
     * @remarks
     * **✓ Invariant**: The value of this property will always match the type
     * parameter {@link ActualBackend | `B`}.
     * @readonly
     */
    readonly backend: ActualBackend;

    /**
     * The processor object. If the handler does not use a processor, this
     * property should be set to `{}`. Otherwise, this object should be used by
     * the {@link Handler.process | `Handler.process`} function to process
     * content.
     */
    processor: Processor;

    /**
     * To ensure that handler instances can be constructed with `process`
     * functions which make use of `this.processor` and `this.configuration`,
     * we allow the `process` parameter of the constructor to be a function with
     * three arguments instead of two:
     *
     * @param content - The content to process.
     * @param options - Options to pass to the processor.
     * @param handler - The handler instance.
     * @returns The processed content, or promise resolving to it.
     *
     * When `Handler.process` is called later on, the getter will provide a
     * function which only takes two arguments, as the third argument will
     * automatically be set to the `Handler` instance's `this`.
     *
     * @internal
     * @readonly
     */
    private readonly _process: ProcessFn<ProcessOptions, ActualHandler>;

    /**
     * Process content.
     *
     * @param content - The content to process.
     * @param options - Options to pass to the processor.
     * @returns The processed content, or promise resolving to it.
     */
    get process(): SimplerProcessFn<ProcessOptions> {
        return (content: string, options: ProcessOptions) => {
            return this._process(
                content,
                options,
                this as unknown as ActualHandler,
            );
        };
    }

    /**
     * The configuration object for this handler. This object should be
     * initialized with a deep copy of the configuration object passed to the
     * constructor, and be mutable only by the
     * {@link Handler.configure | `Handler.configure`} method.
     *
     * @remarks The type of this property should usually be more stringent than
     * the type of the parameter passed to `configure`. The idea here is that,
     * even if multiple settings must always be defined, the user should still
     * generally be able to set them one at a time, with separate calls to
     * `configure`.
     */
    protected _configuration: FullConfiguration;

    /**
     * A deep copy of the configuration object for this handler.
     *
     * ⚠ **Warning**: Mutating this object will have no effect on the actual
     * configuration of the handler. To change the configuration, use the
     * {@link Handler.configure | `configure`} method.
     */
    get configuration(): FullConfiguration {
        return deepClone(this._configuration);
    }

    /**
     * Perhaps confusingly, this function is *not* responsible for updating
     * {@link Handler.configuration | `Handler.configuration`}. Instead, it is
     * responsible for updating the handler's internal state based on the new
     * configuration.
     *
     * The {@link Handler.configure | `Handler.configure`} getter will return a
     * function which will first update `Handler.configuration` (by merging its
     * input into the current `Handler.configuration`, forbidding `null` and
     * `undefined` overrides), and then call
     * {@link Handler._configure | `Handler._configure`}. Similarly to the
     * `_process` function, the `_configure` function has one more argument than
     * the one returned by the `configure` getter, which will be set to the
     * `Handler` instance's `this`.
     *
     * @example
     * ```ts
     * interface Config {
     *     a?: string | undefined;
     *     b?: number | undefined;
     *     c?: boolean | undefined;
     * }
     * type FC = Required<Config>;
     * interface AH {
     *     configuration: FC;
     *     configure: (config: Config) => void;
     *     // ...
     * }
     * const handler = new Handler<'test', string, object, object, Config, FC, AH>({
     *     backend: 'test',
     *     process: () => '',
     *     configuration: { a: 'a', b: 0, c: false },
     *     processor: {},
     *     configure: (config: Config, handler: AH) => {
     *         console.log(
     *             'After passing',
     *             config,
     *             'to Handler.configure, the configuration is now',
     *             handler.configuration,
     *         );
     *     },
     * });
     *
     * await handler.configure({
     *     a: 'anew',
     *     b: undefined,
     * });
     *
     * // After passing { a: 'anew', b: undefined } to Handler.configure,
     * // the configuration is now { a: 'anew', b: 0, c: false }
     * ```
     */
    private readonly _configure: ConfigureFn<Configuration, ActualHandler>;

    /**
     * Configure the handler.
     *
     * @param configuration - Options to update.
     *
     * @remarks This method should be called whenever the user wants to update
     * the handler's configuration.
     */
    get configure() {
        return async (configuration: Configuration) => {
            this._configuration = mergeConfigs(
                this._configuration,
                configuration,
            );
            this.configureNullOverrides.forEach(([path, value]) => {
                if (getProperty(configuration, path) === null) {
                    this._configuration = setProperty(
                        this._configuration,
                        path,
                        value,
                    );
                }
            });
            await this._configure(
                configuration,
                this as unknown as ActualHandler,
            );
        };
    }

    configureNullOverrides: [string, unknown][] = [];

    /**
     * Create a new instance of {@link Handler | `Handler`}.
     *
     * ⚠ **Warning**: The `processor` parameter is passed by reference.
     *
     * @param backend - The name of the handler backend. Used to initialize the
     * readonly property {@link Handler.backend | `Handler.backend`}.
     *
     * @param process - The function to process content. Used to initialize the
     * readonly property {@link Handler._process | `Handler._process`}.
     *
     * @param configure - Function which will be called whenever
     * {@link Handler.configure | `Handler.configure`} is called, right after
     * the configuration is updated. Used to initialize the readonly property
     * {@link Handler._configure | `Handler._configure`}. (In other words, this
     * function is responsible for updating the handler's internal state based
     * on the new configuration, except for the configuration itself, which will
     * be updated automatically *before* this function is run.)
     *
     * @param configuration - A deep copy of this object is used to initialize
     * the readonly property
     * {@link Handler._configuration | `Handler._configuration`}.
     *
     * @param processor - The processor object, *passed by reference*. Used to
     * initialize {@link Handler.processor | `Handler.processor`}. If no
     * processor is used, set this to `{}`. Otherwise, this object should be
     * used by the `process` function to process content.
     *
     * @returns A new instance of {@link Handler | `Handler`}
     */
    constructor({
        backend,
        processor,
        process,
        configure,
        configuration,
    }: {
        backend: ActualBackend;
        process: ProcessFn<ProcessOptions, ActualHandler>;
        processor: Processor;
        configure?: ConfigureFn<Configuration, ActualHandler> | undefined;
        configuration: FullConfiguration;
    }) {
        this.backend = backend;
        this._process = process;
        this.processor = processor;
        this._configure =
            configure ??
            (() => {
                return;
            });
        this._configuration = deepClone(configuration);
    }
}
