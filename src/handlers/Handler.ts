// Types
import type { ProcessFn, SimplerProcessFn } from '$types/handlers/Handler.js';

// Internal dependencies

// External dependencies
import { rfdc } from '$deps.js';
import { isString } from '$typeGuards/utils.js';

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
 * @typeParam ProcessOptions - The type of the second parameter of the
 * `process` function.
 *
 * @typeParam FullConfiguration - The return type of the `configuration`
 * getter.
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
 *     object, // process options
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
    ProcessOptions extends object,
    FullConfiguration extends object,
    ActualHandler extends Handler<
        ActualBackend,
        PossibleBackend,
        ProcessOptions,
        FullConfiguration,
        ActualHandler
    >,
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
     * When `process` is called later on, the getter will provide a
     * function which only takes two arguments, as the third argument will
     * automatically be set to the `Handler` instance's `this`.
     *
     * @internal
     * @readonly
     */
    protected readonly _process: ProcessFn<ProcessOptions, ActualHandler>;

    /**
     * Process content.
     *
     * @param content - The content to process.
     * @param options - Options to pass to the processor.
     * @returns The processed content, or promise resolving to it.
     */
    get process(): SimplerProcessFn<ProcessOptions> {
        return async (content: string, options: ProcessOptions) => {
            const res = await this._process(
                content,
                options,
                this as unknown as ActualHandler,
            );
            if (isString(res))
                return {
                    processed: res,
                    unescapeOptions: { removeParagraphTag: true },
                };
            return res;
        };
    }

    /**
     * The configuration object for this handler. This object should be
     * initialized with a deep copy of the configuration object passed to the
     * constructor, and be mutable only by the
     * {@link configure | `configure`} method.
     *
     * @remarks The type of this property should usually be more stringent than
     * the type of the parameter passed to `configure`. The idea here is that,
     * even if multiple settings must always be defined, the user should still
     * generally be able to set them one at a time, with separate calls to
     * `configure`.
     */
    protected _configuration: FullConfiguration;

    /**
     * The configuration object for this handler.
     *
     * ⚠ **Warning**: Do not mutate this object; otherwise, the configuration of
     * the handler's backend may not match the configuration of the handler
     * itself. This is because the backend's configuration is only set once, at
     * the time of the handler's creation, and never updated after that.
     */
    get configuration(): FullConfiguration {
        return this._configuration;
    }

    /**
     * Create a new instance of {@link Handler | `Handler`}.
     *
     * ⚠ **Warning**: The `processor` parameter is passed by reference.
     *
     * @param backend - The name of the handler backend. Used to initialize the
     * readonly property {@link backend | `backend`}.
     *
     * @param process - The function to process content. Used to initialize the
     * readonly property {@link _process | `_process`}.
     *
     * @param configure - Function which will be called whenever
     * {@link configure | `configure`} is called, right after
     * the configuration is updated. Used to initialize the readonly property
     * {@link _configure | `_configure`}. (In other words, this
     * function is responsible for updating the handler's internal state based
     * on the new configuration, except for the configuration itself, which will
     * be updated automatically *before* this function is run.)
     *
     * @param configuration - This object is used to initialize the readonly
     * property {@link _configuration | `_configuration`}.
     * Careful: the original is used, not a copy.
     *
     * @param processor - The processor object, *passed by reference*. Used to
     * initialize {@link processor | `processor`}. If no
     * processor is used, set this to `{}`. Otherwise, this object should be
     * used by the `process` function to process content.
     *
     * @returns A new instance of {@link Handler | `Handler`}
     */
    constructor({
        backend,
        process,
        configuration,
    }: {
        backend: ActualBackend;
        process: ProcessFn<ProcessOptions, ActualHandler>;
        configuration: FullConfiguration;
    }) {
        this.backend = backend;
        this._process = process;
        this._configuration = configuration;
    }
}
