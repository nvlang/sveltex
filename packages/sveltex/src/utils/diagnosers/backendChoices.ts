// File description: Diagnoser for `BackendChoices` type.

// Types
import type {
    BackendChoices,
    SveltexConfiguration,
} from '../../types/SveltexConfiguration.js';
import type { TexBackend } from '../../types/handlers/Tex.js';
import type { CodeBackend } from '../../types/handlers/Code.js';
import type { MarkdownBackend } from '../../types/handlers/Markdown.js';
import type { MathBackend } from '../../types/handlers/Math.js';

// Internal dependencies
import { isNonNullObject, isOneOf } from '../../typeGuards/utils.js';
import { log } from '../debug.js';
import { Diagnoser, insteadGot } from './Diagnoser.js';

// External dependencies
import { typeAssert, type Equals } from '../../deps.js';

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
    'escape',
    'highlight.js',
    'starry-night',
    'shiki',
    'none',
] as const;
export const mathBackends = ['mathjax', 'katex', 'none', 'custom'] as const;
const texBackends = ['local'] as const;
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

// Keys that belong in the *second* argument to `sveltex()` (the
// configuration). Used to turn the generic "extraneous keys" warning into an
// actionable hint when one of these turns up among the backend choices — the
// classic mistake of merging both `sveltex()` arguments into a single object.
const configurationKeys = [
    'markdown',
    'code',
    'math',
    'tex',
    'verbatim',
    'extensions',
    'frontmatter',
] as const;

// Ensure the list stays exhaustive: if a configuration key is added or
// renamed, this assertion fails until `configurationKeys` is updated.
typeAssert<
    Equals<
        (typeof configurationKeys)[number],
        keyof SveltexConfiguration<MarkdownBackend, CodeBackend, MathBackend>
    >
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
): { errors: number; warnings: number; problems: number } {
    if (!isNonNullObject(choices)) {
        log(
            'error',
            `Expected backend choices to be non-null object. ${insteadGot(choices)}`,
        );
        return { errors: 1, warnings: 0, problems: 1 };
    }
    const d = new Diagnoser(choices);
    backendChoices.forEach(([key, bc]) => {
        d.ifPresent(
            key,
            `one of: "${bc.join('", "')}"`,
            (v) => isOneOf(v, bc),
            'string',
        );
    });
    const extraneousKeys = Object.keys(choices).filter(
        (key) => !backendKeys.includes(key as (typeof backendKeys)[number]),
    );
    if (extraneousKeys.length > 0) {
        // If any extraneous key is actually a configuration option, the user
        // most likely merged the two `sveltex()` arguments into one object —
        // the most common setup mistake — so point them at the two-argument
        // form instead of just listing the offending keys.
        const misplacedConfigKeys = extraneousKeys.filter((key) =>
            (configurationKeys as readonly string[]).includes(key),
        );
        let message = `Extraneous keys detected: "${extraneousKeys.join('", "')}". Supported keys: "${backendKeys.join('", "')}".`;
        if (misplacedConfigKeys.length > 0) {
            const plural = misplacedConfigKeys.length > 1;
            message +=
                ` "${misplacedConfigKeys.join('", "')}" ${
                    plural
                        ? 'are configuration options'
                        : 'is a configuration option'
                }, not ${plural ? 'backend choices' : 'a backend choice'}: ` +
                '`sveltex()` takes the backend choices first and the ' +
                `configuration second, so ${
                    plural ? 'they belong' : 'it belongs'
                } in the second argument, e.g. ` +
                '`sveltex({ … }, { ' +
                misplacedConfigKeys.map((k) => `${k}: …`).join(', ') +
                ' })`.';
        }
        d.addProblem(message, 'warn');
    }
    d.printProblems();
    return d.stats;
}
