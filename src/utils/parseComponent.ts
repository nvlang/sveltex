// Internal dependencies
import { re } from '$utils';
import { escapeWhitespace } from '$utils/debug.js';

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
 *     content: ' test <div>2</div> <<< !@#$%^&*()_+-=/\\[]{}()\'"`:;.,?! </Something> text',
 *     selfClosing: false,
 * }
 * ```
 */
export function parseComponent(html: string) {
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
        1: leadingSlash,
        2: tag,
        3: attributesString,
        4: closingSlash,
        5: content,
        6: closingTag,
    } = match;
    // < 1 2 3 4 > 5 6

    // Leading slash must be empty (i.e., must be `undefined`, `null`, or `''`).
    // This is because `parseComponent` is supposed to receive a full component
    // (be it self-closing or not), and so it should not start with `'</'`.
    if (!isEmpty(leadingSlash)) {
        throw new Error('HTML syntax error: unexpected `</` in opening tag');
    }

    // Tag name must not be empty (i.e., must not be `undefined`, `null`, nor
    // `''`).
    /* v8 ignore next 6 (unreachable code) */
    if (isEmpty(tag)) {
        throw new Error(
            "HTML syntax error: couldn't parse tag name in the following:\n\n" +
                html,
        );
    }

    const selfClosing = closingSlash === '/';

    // <tag/></tag> is invalid
    if (selfClosing && !isEmpty(closingTag)) {
        throw new Error(
            'HTML syntax error: self-closing tag should not have closing tag',
        );
    }

    const attributes: Record<string, string | undefined> = {};

    if (!isEmpty(attributesString)) {
        for (
            let attMatch: RegExpExecArray | null;
            (attMatch = attributesRegExp.exec(attributesString));

        ) {
            let { 1: key, 2: val } = attMatch;
            /* v8 ignore next 6 (unreachable code) */
            if (isEmpty(key)) {
                throw new Error(
                    'HTML syntax error: could not parse attribute key in the following:\n\n' +
                        attributesString,
                );
            }
            key = key.toLowerCase();
            if (!isEmpty(val)) {
                val =
                    val.startsWith("'") || val.startsWith('"')
                        ? val.slice(1, -1)
                        : val;
            }
            attributes[key] = val;
        }
    }

    return {
        tag,
        attributes,
        content: isEmpty(content) ? undefined : content,
        selfClosing,
    };
}

function isEmpty(str: string | undefined | null): str is '' | undefined | null {
    return str === '' || str === undefined || str === null;
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
export const attributesRegExp = re`
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
                \s+             # (optional whitespace)
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
    (                           # 5: content
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
