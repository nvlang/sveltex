import { describe, it, expect, suite } from 'vitest';
import { componentRegExp, parseComponent } from '$utils/parseComponent.js';

suite('parseComponent', () => {
    describe('basic functionality', () => {
        it.each([
            [
                '<div class="container">Hello, world!</div>',
                {
                    tag: 'div',
                    attributes: { class: 'container' },
                    content: 'Hello, world!',
                    selfClosing: false,
                },
            ],
            [
                '<tex ref="test">\\begin{something}&&&;<>>\\end{something}</tex>',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    content: '\\begin{something}&&&;<>>\\end{something}',
                    selfClosing: false,
                },
            ],
            [
                '<tex ref="test" />',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    content: undefined,
                    selfClosing: true,
                },
            ],
            [
                '<tex ref=test />',
                {
                    tag: 'tex',
                    attributes: { ref: 'test' },
                    content: undefined,
                    selfClosing: true,
                },
            ],
        ])(
            'should correctly parse valid HTML components',
            (input, expected) => {
                expect(parseComponent(input)).toEqual(expected);
            },
        );
    });

    describe('error handling', () => {
        it.each(['</div>', '<></>', '<tag/></tag>'])(
            'should throw on invalid HTML components',
            (input) => {
                expect(() => parseComponent(input)).toThrow();
            },
        );
    });
});

describe('componentsRegExp', () => {
    it.each(['<span>text</span>'])(
        'should match valid HTML components',
        (input) => {
            expect(input.match(componentRegExp)).not.toBeNull();
        },
    );
});
