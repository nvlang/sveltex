// Internal dependencies
import {
    ifPresentAndDefined,
    isBoolean,
    isNonNullObject,
    isOneOf,
    isString,
    isStringArray,
    isVerbatimProcessInner,
} from '$type-guards';

// External dependencies
import assert from 'node:assert';
import { inspect } from 'node:util';

/**
 * Diagnose whether a given object is a valid verbatim environment
 * configuration.
 *
 * @param x - The object to diagnose.
 * @returns An object containing:
 * - `isVerbatimEnvironmentConfiguration` - Whether the object is a valid
 *   verbatim environment configuration.
 * - `reasonsForFailure` - An array of reasons why the object is not a valid
 *   verbatim environment configuration. This array will be empty iff the object
 *   is a valid verbatim environment configuration.
 */
export function diagnoseVerbatimEnvironmentConfiguration(x: unknown): {
    isVerbatimEnvironmentConfiguration: boolean;
    reasonsForFailure: string[];
} {
    const reasonsForFailure: string[] = [];
    if (!isNonNullObject(x)) {
        reasonsForFailure.push(
            `Expected configuration to be non-null object. Instead, got: ${inspect(x)}`,
        );
    } else {
        if (!ifPresentAndDefined(x, 'processInner', isVerbatimProcessInner)) {
            assert('processInner' in x);
            reasonsForFailure.push(
                `Expected "processInner" to be a valid description of how the inner content of the verbatim environment should be processed. Instead, got: ${inspect(x.processInner)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'defaultAttributes', isNonNullObject)) {
            assert('defaultAttributes' in x);
            reasonsForFailure.push(
                `The "defaultAttributes" field must be a non-null object. Instead, got: ${inspect(x.defaultAttributes)}`,
            );
        }
        if (
            !ifPresentAndDefined(
                x,
                'attributeForwardingBlocklist',
                isStringArray,
            )
        ) {
            assert('attributeForwardingBlocklist' in x);
            reasonsForFailure.push(
                `The "attributeForwardingBlocklist" field must be an array of strings. Instead, got: ${inspect(x.attributeForwardingBlocklist)}`,
            );
        }
        if (
            !ifPresentAndDefined(
                x,
                'attributeForwardingAllowlist',
                (v) => isStringArray(v) || v === 'all',
            )
        ) {
            assert('attributeForwardingAllowlist' in x);
            reasonsForFailure.push(
                `The "attributeForwardingAllowlist" field must be an array of strings or the string "all". Instead, got: ${inspect(x.attributeForwardingAllowlist)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'component', isString)) {
            assert('component' in x);
            reasonsForFailure.push(
                `The "component" field must be a string. Instead, got: ${inspect(x.component)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'respectSelfClosing', isBoolean)) {
            assert('respectSelfClosing' in x);
            reasonsForFailure.push(
                `The "respectSelfClosing" field must be a boolean. Instead, got: ${inspect(x.respectSelfClosing)}`,
            );
        }
        if (
            !ifPresentAndDefined(x, 'selfCloseOutputWith', (v) =>
                isOneOf(v, ['auto', '/>', ' />']),
            )
        ) {
            assert('selfCloseOutputWith' in x);
            reasonsForFailure.push(
                `The "selfCloseOutputWith" field must be one of "auto", "/>", or " />". Instead, got: ${inspect(x.selfCloseOutputWith)}`,
            );
        }
    }
    return {
        reasonsForFailure,
        isVerbatimEnvironmentConfiguration: reasonsForFailure.length === 0,
    };
}
