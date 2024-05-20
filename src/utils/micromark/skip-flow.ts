/* eslint-disable @typescript-eslint/no-this-alias */
// Types
import type {
    Code,
    Construct,
    Effects,
    State,
    TokenizeContext,
} from 'micromark-util-types';

import {
    markdownLineEnding,
    markdownLineEndingOrSpace,
} from 'micromark-util-character';
import { codes } from 'micromark-util-symbol';
import { skipTags } from '$utils/micromark/syntax.js';
import { htmlRawNames } from 'micromark-util-html-tag-name';

declare module 'micromark-util-types' {
    interface TokenTypeMap {
        skipFlow: 'skipFlow';
        skipFlowData: 'skipFlowData';
    }
}

const nonLazyContinuationStart: Construct = {
    tokenize: tokenizeNonLazyContinuationStart,
    partial: true,
};

// // Could also still provide second param `context: TokenizeContext`, see
// // `Resolver` type.
// export function resolveToSkipFlow(events: Event[]): Event[] {
//     let index = events.length;
//     while (index--) {
//         if (
//             events[index]?.[0] === 'enter' &&
//             events[index]?.[1].type === 'skipFlow'
//         ) {
//             break;
//         }
//     }
//     if (index > 1 && events[index - 2]?.[1].type === 'linePrefix') {
//         // Add the prefix start to the HTML token.
//         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//         events[index]![1].start = events[index - 2]![1].start;
//         // Add the prefix start to the HTML line token.
//         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//         events[index + 1]![1].start = events[index - 2]![1].start;
//         // Remove the line prefix.
//         events.splice(index - 2, 2);
//     }
//     return events;
// }

export function tokenizeSkipFlow(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
): State {
    const self = this;
    let closingTag: boolean;
    let buffer: string;
    let openingTagString: string = '';

    return start;

    /**
     * Start of HTML (flow).
     *
     * ```markdown
     * > | <x />
     *     ^
     * ```
     */
    function start(code: Code): State | undefined {
        // To do: parse indent like `markdown-rs`.
        return before(code);
    }

    /**
     * At `<`, after optional whitespace.
     *
     * ```markdown
     * > | <x />
     *     ^
     * ```
     */
    function before(code: Code): State | undefined {
        effects.enter('skipFlow');
        effects.enter('skipFlowData');
        effects.consume(code);
        return open;
    }

    /**
     * After `<`, at tag name or other stuff.
     *
     * ```markdown
     * > | <x />
     *      ^
     * > | <!doctype>
     *      ^
     * > | <!--xxx-->
     *      ^
     * ```
     */
    function open(this: TokenizeContext, code: Code): State | undefined {
        // ASCII alphabetical
        if (code !== null && asciiAlphabetic(code)) {
            effects.consume(code);
            buffer = String.fromCharCode(code);
            return tagName;
        }
        return nok(code);
    }

    /**
     * In tag name.
     *
     * ```markdown
     * > | <ab>
     *      ^^
     * > | </ab>
     *       ^^
     * ```
     */
    function tagName(this: TokenizeContext, code: Code): State | undefined {
        if (
            code === null ||
            code === codes.slash ||
            code === codes.greaterThan ||
            markdownLineEndingOrSpace(code)
        ) {
            const slash = code === codes.slash;
            const bufferLowerCase = buffer.toLowerCase();
            // `script`, `style`, `textarea`, and `pre` should be treated as
            // case-insensitive.
            if (htmlRawNames.includes(bufferLowerCase)) {
                openingTagString = bufferLowerCase;
            } else {
                openingTagString = buffer;
            }
            if (!slash && !closingTag && skipTags.includes(openingTagString)) {
                return self.interrupt ? ok(code) : continuation(code);
            }
            return nok(code);
        }

        // ASCII alphanumerical and `-`, `.`, `:`, and `_`.
        if (asciiAlphanumeric(code) || tagPunctuation(code)) {
            effects.consume(code);
            buffer += String.fromCharCode(code);
            return tagName;
        }
        return nok(code);
    }

    /**
     * In continuation of any HTML kind.
     *
     * ```markdown
     * > | <!--xxx-->
     *          ^
     * ```
     */
    function continuation(code: Code): State | undefined {
        if (code === codes.lessThan) {
            effects.consume(code);
            return continuationRawTagOpen;
        }
        if (code === null || markdownLineEnding(code)) {
            effects.exit('skipFlowData');
            return continuationStart(code);
        }
        effects.consume(code);
        return continuation;
    }

    /**
     * In continuation, at eol.
     *
     * ```markdown
     * > | <x>
     *        ^
     *   | asd
     * ```
     */
    function continuationStart(code: Code): State | undefined {
        return effects.check(
            nonLazyContinuationStart,
            continuationStartNonLazy,
            continuationAfter,
        )(code);
    }

    /**
     * In continuation, at eol, before non-lazy content.
     *
     * ```markdown
     * > | <x>
     *        ^
     *   | asd
     * ```
     */
    function continuationStartNonLazy(code: Code): State | undefined {
        effects.enter('lineEnding');
        effects.consume(code);
        effects.exit('lineEnding');
        return continuationBefore;
    }

    /**
     * In continuation, before non-lazy content.
     *
     * ```markdown
     *   | <x>
     * > | asd
     *     ^
     * ```
     */
    function continuationBefore(code: Code): State | undefined {
        if (code === null || markdownLineEnding(code)) {
            return continuationStart(code);
        }
        effects.enter('skipFlowData');
        return continuation(code);
    }

    /**
     * In raw continuation, after `<`, at `/`.
     *
     * ```markdown
     * > | <script>console.log(1)</script>
     *                            ^
     * ```
     */
    function continuationRawTagOpen(code: Code): State | undefined {
        if (code === codes.slash) {
            effects.consume(code);
            buffer = '';
            return continuationRawEndTagFirstChar;
        }
        return continuation(code);
    }

    /**
     * In raw continuation, after `</`, in a raw tag name.
     *
     * ```markdown
     * > | <script>console.log(1)</script>
     *                             ^^^^^^
     * ```
     */
    function continuationRawEndTagFirstChar(code: Code): State | undefined {
        if (code !== null && asciiAlphabetic(code)) {
            effects.consume(code);
            buffer += String.fromCharCode(code);
            return continuationRawEndTag;
        }
        return continuation(code);
    }

    /**
     * In raw continuation, after `</`, in a raw tag name.
     *
     * ```markdown
     * > | <script>console.log(1)</script>
     *                             ^^^^^^
     * ```
     */
    function continuationRawEndTag(code: Code): State | undefined {
        if (code === codes.greaterThan) {
            const bufferLowerCase = buffer.toLowerCase();
            let closingTagString: string;
            // `script`, `style`, `textarea`, and `pre` should be treated as
            // case-insensitive.
            if (htmlRawNames.includes(bufferLowerCase)) {
                closingTagString = bufferLowerCase;
            } else {
                closingTagString = buffer;
            }
            if (closingTagString === openingTagString) {
                effects.consume(code);
                return continuationClose;
            }
            return continuation(code);
        }

        // ASCII alphanumerical and `-`, `.`, `:`, and `_`.
        if (
            code !== null &&
            (asciiAlphanumeric(code) || tagPunctuation(code))
        ) {
            effects.consume(code);
            buffer += String.fromCharCode(code);
            return continuationRawEndTag;
        }
        return continuation(code);
    }

    /**
     * In closed continuation: everything we get until the eol/eof is part of it.
     *
     * ```markdown
     * > | <!doctype>
     *               ^
     * ```
     */
    function continuationClose(code: Code): State | undefined {
        // if (code === null || markdownLineEnding(code)) {
        effects.exit('skipFlowData');
        return continuationAfter(code);
        // }
        // effects.consume(code);
        // return continuationClose;
    }

    /**
     * Done.
     *
     * ```markdown
     * > | <!doctype>
     *               ^
     * ```
     */
    function continuationAfter(code: Code): State | undefined {
        effects.exit('skipFlow');
        // // Feel free to interrupt.
        // tokenizer.interrupt = false
        // // No longer concrete.
        // tokenizer.concrete = false
        return ok(code);
    }
}

function tokenizeNonLazyContinuationStart(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
): State {
    const self = this;
    return start;

    /**
     * At eol, before continuation.
     *
     * ```markdown
     * > | * ```js
     *            ^
     *   | b
     * ```
     */
    function start(code: Code): State | undefined {
        if (markdownLineEnding(code)) {
            effects.enter('lineEnding');
            effects.consume(code);
            effects.exit('lineEnding');
            return after;
        }
        return nok(code);
    }

    /**
     * A continuation.
     *
     * ```markdown
     *   | * ```js
     * > | b
     *     ^
     * ```
     */
    function after(this: TokenizeContext, code: Code): State | undefined {
        return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
    }
}

function tagPunctuation(code: NonNullable<Code>): boolean {
    return (
        code === codes.dash ||
        code === codes.dot ||
        code === codes.colon ||
        code === codes.underscore
    );
}

function asciiAlphabetic(code: NonNullable<Code>): boolean {
    return (
        (codes.uppercaseA <= code && code <= codes.uppercaseZ) ||
        (codes.lowercaseA <= code && code <= codes.lowercaseZ)
    );
}

function asciiAlphanumeric(code: NonNullable<Code>): boolean {
    return (
        asciiAlphabetic(code) || (codes.digit0 <= code && code <= codes.digit9)
    );
}
