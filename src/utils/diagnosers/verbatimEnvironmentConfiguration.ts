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
import { insteadGot } from '$utils/diagnosers/Diagnoser.js';
import assert from 'node:assert';

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
            `Expected configuration to be non-null object. ${insteadGot(x)}`,
        );
    } else {
        if (!ifPresentAndDefined(x, 'processInner', isVerbatimProcessInner)) {
            assert('processInner' in x);
            reasonsForFailure.push(
                `Expected "processInner" to be a valid description of how the inner content of the verbatim environment should be processed. ${insteadGot(x.processInner)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'defaultAttributes', isNonNullObject)) {
            assert('defaultAttributes' in x);
            reasonsForFailure.push(
                `The "defaultAttributes" field must be a non-null object. ${insteadGot(x.defaultAttributes)}`,
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
                `The "attributeForwardingBlocklist" field must be an array of strings. ${insteadGot(x.attributeForwardingBlocklist)}`,
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
                `The "attributeForwardingAllowlist" field must be an array of strings or the string "all". ${insteadGot(x.attributeForwardingAllowlist)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'component', isString)) {
            assert('component' in x);
            reasonsForFailure.push(
                `The "component" field must be a string. ${insteadGot(x.component)}`,
            );
        }
        if (!ifPresentAndDefined(x, 'respectSelfClosing', isBoolean)) {
            assert('respectSelfClosing' in x);
            reasonsForFailure.push(
                `The "respectSelfClosing" field must be a boolean. ${insteadGot(x.respectSelfClosing)}`,
            );
        }
        if (
            !ifPresentAndDefined(x, 'selfCloseOutputWith', (v) =>
                isOneOf(v, ['auto', '/>', ' />']),
            )
        ) {
            assert('selfCloseOutputWith' in x);
            reasonsForFailure.push(
                `The "selfCloseOutputWith" field must be one of "auto", "/>", or " />". ${insteadGot(x.selfCloseOutputWith)}`,
            );
        }
    }
    return {
        reasonsForFailure,
        isVerbatimEnvironmentConfiguration: reasonsForFailure.length === 0,
    };
}
