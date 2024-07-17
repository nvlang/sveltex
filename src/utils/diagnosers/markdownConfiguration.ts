// File description: Diagnoser for `MarkdownConfiguration` type.

// Types
import type { MarkdownBackend } from '$types/handlers/Markdown.js';

// Internal dependencies
import {
    isArray,
    isBoolean,
    isFunction,
    isNonNullObject,
    isOneOf,
    isPresentAndDefined,
    isString,
} from '$typeGuards/utils.js';
import { log } from '$utils/debug.js';
import {
    checkTransformers,
    Diagnoser,
    insteadGot,
} from '$utils/diagnosers/Diagnoser.js';
import { getDefaultMarkdownConfig } from '$base/defaults.js';

export function diagnoseMarkdownConfiguration(
    backend: MarkdownBackend,
    x: unknown,
): { errors: number; warnings: number; problems: number } {
    if (!isNonNullObject(x)) {
        log(
            'error',
            `Expected configuration to be non-null object. ${insteadGot(x)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }
    const d = new Diagnoser(x);
    checkTransformers(d);
    d.ifPresent('strict', 'a boolean', isBoolean, ['boolean']);
    d.ifPresent(
        'prefersInline',
        'a function (tag: string) => boolean',
        isFunction,
        'function',
    );
    d.ifPresent(
        'components',
        'an array of ComponentInfo objects',
        isArray,
        'object',
    );
    if (isPresentAndDefined(x, 'components') && isArray(x.components)) {
        x.components.forEach((_componentInfo, index) => {
            d.isPresent(
                `components[${String(index)}].name`,
                'a string matching the regex /^[A-Z][-.:0-9_a-zA-Z]*/',
                (v) => isString(v) && /^[A-Z][-.:0-9_a-zA-Z]*/.test(v),
                'string',
            );
            d.ifPresent(
                `components[${String(index)}].importPath`,
                'a string',
                isString,
                'string',
            );
            d.ifPresent(
                `components[${String(index)}].type`,
                'one of "default", "phrasing", "sectioning", "none", "all"',
                (v) =>
                    isOneOf(v, [
                        'default',
                        'phrasing',
                        'sectioning',
                        'none',
                        'all',
                    ]),
                'string',
            );
            d.ifPresent(
                `components[${String(index)}].prefersInline`,
                'a boolean',
                isBoolean,
                'boolean',
            );
        });
    }
    if (backend === 'unified') {
        d.ifPresent('remarkPlugins', 'an array of remark plugins', isArray);
        d.ifPresent('rehypePlugins', 'an array of rehype plugins', isArray);
        d.ifPresent('retextPlugins', 'an array of retext plugins', isArray);
        d.ifPresent(
            'remarkRehypeOptions',
            'a non-null object',
            isNonNullObject,
        );
        d.ifPresent(
            'rehypeStringifyOptions',
            'a non-null object',
            isNonNullObject,
        );
    } else if (backend === 'markdown-it' || backend === 'marked') {
        d.ifPresent('options', 'a non-null object', isNonNullObject);
        d.ifPresent('extensions', 'an array', isArray);
    } else if (backend === 'micromark') {
        d.ifPresent('options', 'a non-null object', isNonNullObject);
    } else if (backend === 'custom') {
        d.isPresent('process', 'a function', isFunction, 'function');
    }
    d.noteUnexpectedProperties(Object.keys(getDefaultMarkdownConfig(backend)));
    d.printProblems();
    return d.stats;
}
