/**
 * Generic type for the a handler's `process` function, as returned by the
 * handler's getter for the function.
 *
 * @typeParam ProcessOptions - The type of the options object that the handler
 * accepts for processing.
 */
export type SimplerProcessFn<ProcessOptions extends object> = (
    content: string,
    options: ProcessOptions,
) => string | Promise<string>;

/**
 * Generic type for the a handler's `process` function, as stored internally and
 * set during the handler's initialization.
 *
 * @typeParam ProcessOptions - The type of the options object that the handler
 * accepts for processing.
 * @typeParam H - The type of the handler that the function is associated with.
 */
export type ProcessFn<ProcessOptions extends object, H> = (
    content: string,
    options: ProcessOptions,
    handler: H,
) => string | Promise<string>;

/**
 * Generic type for a handler's `configure` function.
 *
 * @typeParam Configuration - The type of the configuration object that the
 * handler accepts as input to its `configure` function.
 * @typeParam H - The type of the handler that the function is associated with.
 */
export type ConfigureFn<Configuration extends object, H> = (
    configuration: Configuration,
    handler: H,
) => void | Promise<void>;
