// File description: Parse a generic HTML component into its tag name,
// attributes, and inner content.

// Internal dependencies
import { regex } from '../deps.js';
import { isBoolean, isNumber, isString } from '../typeGuards/utils.js';
import type {
    InterpretedAttributes,
    ParsedComponent,
} from '../types/utils/Escape.js';
import { escapeWhitespace } from './debug.js';

/**
 * Parses a component from an HTML string.
 * @param html - The HTML string to parse.
 * @returns The parsed component.
 *
 * @remarks
 * ✓ **Invariant**: The following is always true:
 * ```ts
 * selfClosing === (content === undefined)
 * ```
 *
 * In other words: `selfClosing` is `true` iff `content` is `undefined`.
 *
 * @example
 * ```ts
 * parseComponent(
 *     `<Something a="a" b='b' c=42 d> test <div>2</div> <<< !@#$%^&*()_+-=/\\[]{}()'"\`:;.,?! </Something> text</Something>`
 * )
 * ```
 *
 * Output:
 *
 * ```ts
 * {
 *     tag: 'Something',
 *     attributes: { a: 'a', b: 'b', c: '42', d: undefined },
 *     innerContent: ' test <div>2</div> <<< !@#$%^&*()_+-=/\\[]{}()\'"`:;.,?! </Something> text',
 *     selfClosing: false,
 * }
 * ```
 */
export function parseComponent(html: string): ParsedComponent {
    const match = componentRegExp.exec(html);
    if (!match) {
        throw new Error(
            `HTML syntax error: could not parse component: "${escapeWhitespace(html)}"`,
        );
    }

    // According to node-html-parser, in this specific case at least, object
    // destructuring is faster than array destructuring (see
    // https://github.com/taoqf/node-html-parser/blob/29c0ac0866253077a1eb6260c455c4a9ad172c0f/src/nodes/html.ts#L1027).
    const {
        leadingSlash,
        tag,
        attributes: attributesString,
        closingSlash,
        innerContent,
        closingTag,
    } = match.groups as unknown as ComponentRegExpMatchGroups;
    // < 1 2 3 4 > 5 6

    // Leading slash must be empty (i.e., must be `undefined`, `null`, or `''`).
    // This is because `parseComponent` is supposed to receive a full component
    // (be it self-closing or not), and so it should not start with `'</'`.
    if (leadingSlash) {
        throw new Error('HTML syntax error: unexpected `</` in opening tag');
    }

    // Tag name must not be empty (i.e., must not be `undefined`, `null`, nor
    // `''`).
    /* v8 ignore next 6 (unreachable code) */
    if (!tag) {
        throw new Error(
            "HTML syntax error: couldn't parse tag name in the following:\n\n" +
                html,
        );
    }

    const selfClosing = closingSlash === '/';

    // <tag/></tag> is invalid
    if (selfClosing && closingTag) {
        throw new Error(
            'HTML syntax error: self-closing tag should not have closing tag',
        );
    }

    const rawAttributes: Record<string, string | undefined> = {};
    if (attributesString) {
        for (
            let attMatch: RegExpExecArray | null;
            (attMatch = attributesRegExp.exec(attributesString));

        ) {
            let { attribute_name, value } =
                attMatch.groups as unknown as AttributesRegExpMatchGroups;
            /* v8 ignore next 6 (unreachable code) */
            if (!attribute_name) {
                throw new Error(
                    'HTML syntax error: could not parse attribute key in the following:\n\n' +
                        attributesString,
                );
            }
            attribute_name = attribute_name.toLowerCase();
            if (value) {
                value =
                    value.startsWith("'") || value.startsWith('"')
                        ? value.slice(1, -1)
                        : value;
            }
            // if (val === undefined) val = 'true';
            rawAttributes[attribute_name] = value;
        }
    }
    const attributes: InterpretedAttributes =
        interpretAttributes(rawAttributes);
    return { tag, attributes, innerContent, selfClosing };
}

/**
 * Regular expression for parsing attributes from an HTML string. The regular
 * expression has two capture groups:
 *
 * 1. Attribute name
 * 2. Attribute value
 *
 * @see {@link parseComponent | `parseComponent`}
 */
const attributesRegExp: RegExp = regex('g')`
    (?<attribute_name>
        [a-zA-Z\(\)\[\]@:\$\.\?\#]
        [a-zA-Z0-9\(\)\[\]_:\-\#]*
    )
    (                           # optional "=value" part
        \s* = \s*
        (?<value>
            ' [^']* '           # (single-quoted value)
          | " [^"]* "           # (double-quoted value)
          | \S+                 # (unquoted value)
        )
    )?
    `;

interface AttributesRegExpMatchGroups {
    attribute_name: string;
    value?: string;
}

/**
 * Regular expression for parsing a component from an HTML string.
 *
 * @see {@link parseComponent | `parseComponent`}
 */
export const componentRegExp: RegExp = regex('s')`
    ^
    \s*
    <
        (?<leadingSlash> \/ )?
        (?<tag> [a-zA-Z] [\-\.:0-9_a-zA-Z]* )
        (?<attributes>
            ( \s [^>]*? ( ( '[^']*' ) | ( "[^"]*" ) )? )*
        )
        \s*
        (?<closingSlash> \/ )?
    >
    (?<innerContent> .*? )
    (?<closingTag> <\/ \s* \k<tag> \s* > )?
    \s*
    $
`;

interface ComponentRegExpMatchGroups {
    /** _(Optional)_ Leading slash. */
    leadingSlash?: '/';
    /** Tag name (e.g., `'span'`). */
    tag: string;
    /** Attributes. May be empty. */
    attributes: string;
    /** _(Optional)_ Closing slash. Present iff tag is self-closing. */
    closingSlash?: '/';
    /** _(Optional)_ Inner content. Present iff tag is not self-closing. */
    innerContent: string;
    /**
     * _(Optional)_ Closing tag (e.g., `</span>`). Present iff tag is not
     * self-closing.
     */
    closingTag?: `</${string}>`;
}

/**
 * "Interprets" a string as a boolean, number, null, or undefined, if
 * applicable. Otherwise, returns the string as is.
 *
 * @param str - The string to interpret.
 * @returns The interpreted value.
 *
 * @example
 * // All of the below are true
 * interpretString('true') === true;
 * interpretString('false') === false;
 * interpretString('null') === null;
 * interpretString('undefined') === undefined;
 * interpretString('NaN') === NaN;
 * interpretString('Infinity') === Infinity;
 * interpretString('-Infinity') === -Infinity;
 * interpretString('5') === 5;
 * interpretString('5.5') === 5.5;
 * interpretString('something') === 'something';
 */
export function interpretString(
    str: string | number | boolean | null | undefined,
): string | number | boolean | null | undefined {
    if (!isString(str)) return str;
    const trimmedStr = str.trim();
    switch (trimmedStr) {
        case 'true':
            return true;
        case 'false':
            return false;
        case 'null':
            return null;
        case 'undefined':
            return undefined;
        case 'NaN':
            return NaN;
        case 'Infinity':
            return Infinity;
    }
    if (trimmedStr.endsWith('Infinity')) {
        if (/^[+]\s*Infinity$/u.test(trimmedStr)) {
            return +Infinity;
        }
        if (/^[-]\s*Infinity$/u.test(trimmedStr)) {
            return -Infinity;
        }
    }
    if (/^[+-]?(\d+|\d*.\d+)$/u.test(trimmedStr.replace(/\s*/gu, ''))) {
        const num = Number(trimmedStr);
        if (!isNaN(num)) {
            return num;
        }
    }
    return str;
}

/**
 * Calls {@link interpretString | `interpretString`} on each value in the given
 * object.
 *
 * @param attrs - The object whose values to interpret.
 * @returns A new object with the interpreted values.
 *
 * @example
 * ```ts
 * interpretAttributes({
 *     a: 'true',
 *     b: '5',
 *     c: 'something',
 * });
 * ```
 *
 * ...would return...
 *
 * ```ts
 * {
 *     a: true,
 *     b: 5,
 *     c: 'something',
 * }
 * ```
 */
export function interpretAttributes(
    attrs: Record<string, unknown>,
): InterpretedAttributes {
    const rv: InterpretedAttributes = {};
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && !isString(value)) {
            const supportedValueType: boolean =
                isBoolean(value) ||
                isNumber(value) ||
                (value as unknown) === null;
            if (supportedValueType) rv[key] = value as boolean | number | null;
        } else {
            rv[key] = interpretString(value);
        }
    }
    return rv;
}
