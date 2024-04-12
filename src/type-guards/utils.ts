export function isDefined(input: unknown) {
    return input !== undefined;
}

export function isString(input: unknown): input is string {
    return typeof input === 'string';
}

export function isNumber(input: unknown): input is number {
    return typeof input === 'number';
}

export function isBoolean(input: unknown): input is boolean {
    return typeof input === 'boolean';
}

export function isObject(input: unknown): input is object | null {
    return typeof input === 'object';
}

export function isNonNullObject(input: unknown): input is object {
    return isObject(input) && input !== null;
}

export function isArray(input: unknown): input is unknown[] {
    return Array.isArray(input);
}

// export function isStringArray(input: unknown): input is string[] {
//     return isArray(input) && input.every(isString);
// }

export function checkBackend<B extends string>(
    this: unknown,
    obj: unknown,
    backend: B,
): obj is { backend: B } {
    return (
        (isNonNullObject(obj) &&
            'backend' in obj &&
            isString(obj.backend) &&
            obj.backend === backend) ||
        // TODO: Make sure this makes sense and isn't dangerous
        (isNonNullObject(obj) &&
            (!('backend' in obj) || obj.backend === undefined) &&
            isNonNullObject(this) &&
            'backend' in this &&
            isString(this.backend) &&
            this.backend === backend)
    );
}

// export function hasProperty(
//     obj: unknown,
//     prop: string,
// ): obj is { prop: unknown } {
//     return isNonNullObject(obj) && prop in obj;
// }
