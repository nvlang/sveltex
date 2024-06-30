// File description: Parse a generic HTML component into its tag name,
// attributes, and inner content.

// Internal dependencies
import { is, typeAssert } from '$deps.js';
import { isBoolean, isNumber, isString } from '$typeGuards/utils.js';
import type { InterpretedAttributes, ParsedComponent } from '$types/utils/Escape.js';
import { escapeWhitespace } from '$utils/debug.js';
import { re } from '$utils/misc.js';

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

    // Match groups that weren't matched are set to the empty string, so all of
    // the match groups are guaranteed to be defined.
    typeAssert(
        is<{
            0: string;
            1: string;
            2: string;
            3: string;
            4: string;
            5: string;
            6: string;
            index: number;
            input: string;
        }>(match),
    );

    // According to node-html-parser, in this specific case at least, object
    // destructuring is faster than array destructuring (see
    // https://github.com/taoqf/node-html-parser/blob/29c0ac0866253077a1eb6260c455c4a9ad172c0f/src/nodes/html.ts#L1027).
    const {
        1: leadingSlash,
        2: tag,
        3: attributesString,
        4: closingSlash,
        5: innerContent,
        6: closingTag,
    } = match;
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
            let { 1: key, 2: val } = attMatch;
            /* v8 ignore next 6 (unreachable code) */
            if (!key) {
                throw new Error(
                    'HTML syntax error: could not parse attribute key in the following:\n\n' +
                        attributesString,
                );
            }
            key = key.toLowerCase();
            if (val) {
                val =
                    val.startsWith("'") || val.startsWith('"')
                        ? val.slice(1, -1)
                        : val;
            }
            // if (val === undefined) val = 'true';
            rawAttributes[key] = val;
        }
    }
    const attributes = interpretAttributes(rawAttributes);
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
const attributesRegExp = re`
    (                           # 1: attribute name
        [                       # (first character)
            a-zA-Z
            \(\)
            \[\]
            @:
            \$\.\?\#
        ]
        [                       # (remaining characters)
            a-zA-Z
            0-9
            \(\)
            \[\]
            _:
            \-\#
        ]*
    )
    (?:                         # -: optional "=value" part
        \s*                     # (optional whitespace)
        =                       # (equals sign)
        \s*                     # (optional whitespace)
        (                       # 2: value
            ' [^']* '           # (single-quoted value)
            | " [^"]* "         # (double-quoted value)
            | \S+               # (unquoted value)
        )
    )?

                                # FLAGS
    ${'gu'}                     # g = Global (find all matches)
                                # u = Unicode support
    `;

/**
 * Regular expression for parsing a component from an HTML string. The regular
 * expression has six capture groups:
 *
 * 1. Leading slash (*optional;* `/` or empty string)
 * 2. Tag name *(required)*
 * 3. Attributes *(optional)*
 * 4. Closing slash (*optional;* `/` or empty string) (present iff tag is
 *    self-closing)
 * 5. Content (*optional;* present iff tag is not self-closing)
 * 6. Closing tag (*optional;* present iff tag is not self-closing)
 *
 * @see {@link parseComponent | `parseComponent`}
 */
export const componentRegExp = re`
    ^                           # (start of string)
    \s*                         # (optional leading whitespace)
    <                           # (opening angle bracket)
        (                       # 1: leading slash
            /?                  # (optional slash)
        )
        (                       # 2: tag name
            [a-zA-Z]            # (first character)
            [-.:0-9_a-zA-Z]*    # (remaining characters)
        )
        (                       # 3: attributes
            (?:                 # -: optional attribute(s)
                \s              # (mandatory whitespace)
                [^>]*?          # (any character except '>', lazy)
                (?:
                    (?:         # -: single-quoted attribute value
                        '[^']*' # (any characters except "'", surrounded by "'"s)
                    )
                    | (?:       # -: double-quoted attribute value
                        "[^"]*" # (any characters except '"', surrounded by '"'s)
                    )
                )?
            )*
        )
        \s*
        (                       # 4: optional closing slash
            \/?                 # (optional slash)
        )
    >
    (                           # 5: inner content
        .*?                     # (any character, incl. newlines; lazy, so that
                                # it doesn't eat the closing tag)
    )
    (                           # 6: closing tag
        (?:                     # -: optional closing tag
            <                   # (opening angle bracket)
            /                   # (leading slash)
            \s*                 # (optional whitespace)
            \2                  # (tag name backreference)
            \s*                 # (optional whitespace)
            >                   # (closing angle bracket)
        )?
    )
    \s*                         # (optional trailing whitespace)
    $                           # (end of string)

                                # FLAGS
    ${'su'}                     # s = Single line (dot matches newline)
                                # u = Unicode support
`;

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
        if (/^[+]\s*Infinity$/.test(trimmedStr)) {
            return +Infinity;
        }
        if (/^[-]\s*Infinity$/.test(trimmedStr)) {
            return -Infinity;
        }
    }
    if (/^[+-]?(\d+|\d*.\d+)$/.test(trimmedStr.replace(/\s*/g, ''))) {
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
