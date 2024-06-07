// Types
import type { BackendChoices } from '$types/SveltexConfiguration.js';
import type { TexBackend } from '$types/handlers/Tex.js';
import type { CodeBackend } from '$types/handlers/Code.js';
import type { MarkdownBackend } from '$types/handlers/Markdown.js';
import type { MathBackend } from '$types/handlers/Math.js';

// Internal dependencies
import { isNonNullObject, isOneOf } from '$type-guards/utils.js';
import { log } from '$utils/debug.js';
import { Diagnoser, insteadGot } from '$utils/diagnosers/Diagnoser.js';

// External dependencies
import { typeAssert, type Equals } from '$deps.js';

// Constants describing the possible backends
export const markdownBackends = [
    'markdown-it',
    'marked',
    'micromark',
    'unified',
    'none',
    'custom',
] as const;
export const codeBackends = [
    'escapeOnly',
    'highlight.js',
    'starry-night',
    'shiki',
    'none',
] as const;
export const mathBackends = ['mathjax', 'katex', 'none', 'custom'] as const;
export const texBackends = ['local'] as const;
const backendChoices = [
    ['markdownBackend', markdownBackends],
    ['codeBackend', codeBackends],
    ['mathBackend', mathBackends],
    ['texBackend', texBackends],
] as const;
const backendKeys = [
    'markdownBackend',
    'codeBackend',
    'mathBackend',
    'texBackend',
] as const;

// Ensure we didn't miss any backend
typeAssert<Equals<(typeof markdownBackends)[number], MarkdownBackend>>();
typeAssert<Equals<(typeof codeBackends)[number], CodeBackend>>();
typeAssert<Equals<(typeof mathBackends)[number], MathBackend>>();
typeAssert<Equals<(typeof texBackends)[number], TexBackend>>();
typeAssert<
    Equals<(typeof backendChoices)[number][0], (typeof backendKeys)[number]>
>();

/**
 * Diagnose whether a given object is a valid
 * {@link BackendChoices | `BackendChoices`} object.
 *
 * @param choices - The object to diagnose.
 * @returns The number of problems found.
 *
 * @remarks
 * This function will log any problems found to the console.
 */
export function diagnoseBackendChoices(
    choices: BackendChoices<MarkdownBackend, CodeBackend, MathBackend>,
) {
    if (!isNonNullObject(choices)) {
        log(
            'error',
            `Expected backend choices to be non-null object. ${insteadGot(choices)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }
    const d = new Diagnoser(choices);
    backendChoices.forEach(([key, backendChoices]) => {
        d.ifPresent(
            key,
            `one of: "${backendChoices.join('", "')}"`,
            (v) => isOneOf(v, backendChoices),
            'string',
        );
    });
    const extraneousKeys = Object.keys(choices).filter(
        (key) => !backendKeys.includes(key as (typeof backendKeys)[number]),
    );
    if (extraneousKeys.length > 0) {
        d.addProblem(
            `Extraneous keys detected: "${extraneousKeys.join('", ')}". Supported keys: "${backendKeys.join('", ')}".`,
            'warn',
        );
    }
    d.printProblems();
    return d.stats;
}
