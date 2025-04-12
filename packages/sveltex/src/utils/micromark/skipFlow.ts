// File description: Exports the `tokenizeSkipFlowFactory` function, which,
// given an array of tags, returns the tokenizer that forms the essence of the
// corresponding micromark extension.

// NOTE: This file is based on the following micromark-internal file:
// https://github.com/micromark/micromark/blob/6038803b533061627d9c2cb58579f74fc80e0339/packages/micromark-core-commonmark/dev/lib/html-flow.js

// I'm not entirely sure why the `this` aliases are necessary, but I tried
// removing them and the code broke. I may investigate this at some later point
// in time. For now, we'll just disable the corresponding ESLint rule.
/* eslint-disable @typescript-eslint/no-this-alias */

// Types
import type {
    MicromarkCode as Code,
    MicromarkConstruct as Construct,
    MicromarkEffects as Effects,
    MicromarkState as State,
    MicromarkTokenizeContext as TokenizeContext,
    MicromarkTokenTypeMap as TokenTypeMap,
} from '../../deps.js';

// External dependencies
import {
    micromarkMarkdownLineEnding as markdownLineEnding,
    micromarkMarkdownLineEndingOrSpace as markdownLineEndingOrSpace,
    asciiCodes as codes,
    htmlRawNames,
} from '../../deps.js';

// The below is, as far as I can tell, the approach suggested by micromark for
// type safety. However, JSR doesn't like global type augmentation, so I'm going
// to be using type assertions instead for now.
//
// /**
//  * Interface augmentation for `micromark-util-types`'s `TokenTypeMap`, which is
//  * a record of all permissible token types.
//  */
// declare module 'micromark-util-types' {
//     interface TokenTypeMap {
//         skipFlow: 'skipFlow';
//         skipFlowData: 'skipFlowData';
//     }
// }

/**
 * @param skipTags - An array of tags to skip.
 * @returns A tokenizer that skips the specified tags.
 */
export function tokenizeSkipFlowFactory(
    skipTags: string[],
): (this: TokenizeContext, effects: Effects, ok: State, nok: State) => State {
    return function tokenizeSkipFlow(
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
            effects.enter('skipFlow' as keyof TokenTypeMap);
            effects.enter('skipFlowData' as keyof TokenTypeMap);
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
                if (
                    !slash &&
                    !closingTag &&
                    skipTags.includes(openingTagString)
                ) {
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
                effects.exit('skipFlowData' as keyof TokenTypeMap);
                return continuationStart(code);
            }
            effects.consume(code);
            return continuation;
        }

        /**
         * In continuation, at EOL.
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
         * In continuation, at EOL, before non-lazy content.
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
            effects.enter('skipFlowData' as keyof TokenTypeMap);
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
         * In closed continuation.
         *
         * ```markdown
         * > | <!doctype>
         *               ^
         * ```
         */
        function continuationClose(code: Code): State | undefined {
            // if (code === null || markdownLineEnding(code)) {
            effects.exit('skipFlowData' as keyof TokenTypeMap);
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
            effects.exit('skipFlow' as keyof TokenTypeMap);
            return ok(code);
        }
    };
}

const nonLazyContinuationStart: Construct = {
    tokenize: tokenizeNonLazyContinuationStart,
    partial: true,
};

function tokenizeNonLazyContinuationStart(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
): State {
    const self = this;
    return start;

    /**
     * At EOL, before continuation.
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

/**
 * @param code - The character code to check.
 * @returns Whether the code represents a dash, dot, colon, or underscore (`-`,
 * `.`, `:`, or `_`), which are the punctuation characters that we deem
 * permissible in verbatim tag names.
 */
function tagPunctuation(code: NonNullable<Code>): boolean {
    return (
        code === codes.dash ||
        code === codes.dot ||
        code === codes.colon ||
        code === codes.underscore
    );
}

/**
 * @param code - The character code to check.
 * @returns Whether the code represents an ASCII alphabetic character.
 */
function asciiAlphabetic(code: NonNullable<Code>): boolean {
    return (
        (codes.uppercaseA <= code && code <= codes.uppercaseZ) ||
        (codes.lowercaseA <= code && code <= codes.lowercaseZ)
    );
}

/**
 * @param code - The character code to check.
 * @returns Whether the code represents an ASCII alphanumeric character.
 */
function asciiAlphanumeric(code: NonNullable<Code>): boolean {
    return (
        asciiAlphabetic(code) || (codes.digit0 <= code && code <= codes.digit9)
    );
}
