import {
    type MockInstance,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { spy } from '$tests/fixtures.js';
import { sveltex } from '$Sveltex.js';

function fixture() {
    beforeEach(() => {
        vi.resetAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
}

const processors = [
    await sveltex({
        codeBackend: 'escapeOnly',
        markdownBackend: 'marked',
    }),
    await sveltex({
        codeBackend: 'escapeOnly',
        markdownBackend: 'markdown-it',
    }),
    await sveltex({
        codeBackend: 'escapeOnly',
        markdownBackend: 'micromark',
    }),
    await sveltex({
        codeBackend: 'escapeOnly',
        markdownBackend: 'unified',
    }),
];

describe('CommonMark compliance (partial)', () => {
    fixture();
    let log: MockInstance;

    beforeAll(async () => {
        const mocks = await spy(['log', 'fancyWrite', 'writeFile']);
        log = mocks.log;
    });

    describe.concurrent.each(processors)(
        'CommonMark: fenced code blocks ($markdownBackend)',
        (s) => {
            fixture();
            it.concurrent.each([
                {
                    markdown: '```\n<\n >\n```\n',
                    html: '<pre><code>&lt;\n &gt;\n</code></pre>\n',
                    example: 119,
                },
                {
                    markdown: '~~~\n<\n >\n~~~\n',
                    html: '<pre><code>&lt;\n &gt;\n</code></pre>\n',
                    example: 120,
                },
                {
                    markdown: '``\nfoo\n``\n',
                    html: '<p><code>foo</code></p>\n',
                    example: 121,
                },
                {
                    markdown: '```\naaa\n~~~\n```\n',
                    html: '<pre><code>aaa\n~~~\n</code></pre>\n',
                    example: 122,
                },
                {
                    markdown: '~~~\naaa\n```\n~~~\n',
                    html: '<pre><code>aaa\n```\n</code></pre>\n',
                    example: 123,
                },
                {
                    markdown: '````\naaa\n```\n``````\n',
                    html: '<pre><code>aaa\n```\n</code></pre>\n',
                    example: 124,
                },
                {
                    markdown: '~~~~\naaa\n~~~\n~~~~\n',
                    html: '<pre><code>aaa\n~~~\n</code></pre>\n',
                    example: 125,
                },
                {
                    markdown: '```\n',
                    html: '<pre><code></code></pre>\n',
                    example: 126,
                },
                {
                    markdown: '`````\n\n```\naaa\n',
                    html: '<pre><code>\n```\naaa\n</code></pre>\n',
                    example: 127,
                },
                // {
                //     markdown: '> ```\n> aaa\n\nbbb\n',
                //     html: '<blockquote>\n<pre><code>aaa\n</code></pre>\n</blockquote>\n<p>bbb</p>\n',
                //     example: 128,
                // },
                {
                    markdown: '```\n\n  \n```\n',
                    html: '<pre><code>\n  \n</code></pre>\n',
                    example: 129,
                },
                {
                    markdown: '```\n```\n',
                    html: '<pre><code></code></pre>\n',
                    example: 130,
                },
                {
                    markdown: ' ```\n aaa\naaa\n```\n',
                    html: '<pre><code>aaa\naaa\n</code></pre>\n',
                    example: 131,
                },
                {
                    markdown: '  ```\naaa\n  aaa\naaa\n  ```\n',
                    html: '<pre><code>aaa\naaa\naaa\n</code></pre>\n',
                    example: 132,
                },
                {
                    markdown: '   ```\n   aaa\n    aaa\n  aaa\n   ```\n',
                    html: '<pre><code>aaa\n aaa\naaa\n</code></pre>\n',
                    example: 133,
                },
                // We don't support indented code blocks
                // {
                //     markdown: '    ```\n    aaa\n    ```\n',
                //     html: '<pre><code>```\naaa\n```\n</code></pre>\n',
                //     example: 134,
                // },
                {
                    markdown: '```\naaa\n  ```\n',
                    html: '<pre><code>aaa\n</code></pre>\n',
                    example: 135,
                },
                {
                    markdown: '   ```\naaa\n  ```\n',
                    html: '<pre><code>aaa\n</code></pre>\n',
                    example: 136,
                },
                // We don't support indented code blocks
                // {
                //     markdown: '```\naaa\n    ```\n',
                //     html: '<pre><code>aaa\n    ```\n</code></pre>\n',
                //     example: 137,
                // },
                {
                    markdown: '``` ```\naaa\n',
                    html: '<p><code> </code>\naaa</p>\n',
                    example: 138,
                },
                {
                    markdown: '~~~~~~\naaa\n~~~ ~~\n',
                    html: '<pre><code>aaa\n~~~ ~~\n</code></pre>\n',
                    example: 139,
                },
                {
                    markdown: 'foo\n```\nbar\n```\nbaz\n',
                    html: '<p>foo</p>\n<pre><code>bar\n</code></pre>\n<p>baz</p>\n',
                    example: 140,
                },
                {
                    markdown: 'foo\n---\n~~~\nbar\n~~~\n# baz\n',
                    html: '<h2>foo</h2>\n<pre><code>bar\n</code></pre>\n<h1>baz</h1>\n',
                    example: 141,
                },
                {
                    markdown: '```ruby\ndef foo(x)\n  return 3\nend\n```\n',
                    html: '<pre><code class="language-ruby">def foo(x)\n  return 3\nend\n</code></pre>\n',
                    example: 142,
                },
                {
                    markdown:
                        '~~~~    ruby startline=3 $%@#$\ndef foo(x)\n  return 3\nend\n~~~~~~~\n',
                    html: '<pre><code class="language-ruby">def foo(x)\n  return 3\nend\n</code></pre>\n',
                    example: 143,
                },
                {
                    markdown: '````;\n````\n',
                    html: '<pre><code class="language-;"></code></pre>\n',
                    example: 144,
                },
                {
                    markdown: '``` aa ```\nfoo\n',
                    html: '<p><code>aa</code>\nfoo</p>\n',
                    example: 145,
                },
                {
                    markdown: '~~~ aa ``` ~~~\nfoo\n~~~\n',
                    html: '<pre><code class="language-aa">foo\n</code></pre>\n',
                    example: 146,
                },
                {
                    markdown: '```\n``` aaa\n```\n',
                    html: '<pre><code>``` aaa\n</code></pre>\n',
                    example: 147,
                },
            ])('Example $example', async ({ markdown, html, example }) => {
                let code = (
                    await s.markup({
                        content: markdown,
                        filename: `${String(example)}.sveltex`,
                    })
                )?.code;
                code = code?.replaceAll(' class="language-plaintext"', '');
                code = code?.replace('<script>\n</script>\n', '');
                html = html.replace(/<p>(.*?)<\/p>/gsu, '$1');
                code = code?.replace(/<p>(.*?)<\/p>/gsu, '$1');
                if (
                    (s.markdownBackend === 'markdown-it' &&
                        [127, 137, 139].includes(example)) ||
                    (s.markdownBackend === 'marked' &&
                        [126, 130].includes(example))
                ) {
                    expect(code?.replace(/\s/g, '')).toContain(
                        html.replace(/\s/g, ''),
                    );
                } else if (
                    s.markdownBackend === 'marked' &&
                    [12].includes(example)
                ) {
                    //
                } else {
                    expect(code).toContain(html.trim());
                }
                expect(log).not.toHaveBeenCalled();
            });
        },
    );

    describe.concurrent.each(processors)(
        'CommonMark: code spans ($markdownBackend)',
        (s) => {
            fixture();
            it.concurrent.each([
                {
                    markdown: '`foo`\n',
                    html: '<p><code>foo</code></p>\n',
                    example: 328,
                },
                {
                    markdown: '`` foo ` bar ``\n',
                    html: '<p><code>foo ` bar</code></p>\n',
                    example: 329,
                },
                {
                    markdown: '` `` `\n',
                    html: '<p><code>``</code></p>\n',
                    example: 330,
                },
                {
                    markdown: '`  ``  `\n',
                    html: '<p><code> `` </code></p>\n',
                    example: 331,
                },
                {
                    markdown: '` a`\n',
                    html: '<p><code> a</code></p>\n',
                    example: 332,
                },
                {
                    markdown: '`\tb\t`\n',
                    html: '<p><code>\tb\t</code></p>\n',
                    example: 333,
                },
                {
                    markdown: '` `\n`  `\n',
                    html: '<p><code> </code>\n<code>  </code></p>\n',
                    example: 334,
                },
                {
                    markdown: '``\nfoo\nbar  \nbaz\n``\n',
                    html: '<p><code>foo bar   baz</code></p>\n',
                    example: 335,
                },
                {
                    markdown: '``\nfoo \n``\n',
                    html: '<p><code>foo </code></p>\n',
                    example: 336,
                },
                {
                    markdown: '`foo   bar \nbaz`\n',
                    html: '<p><code>foo   bar  baz</code></p>\n',
                    example: 337,
                },
                {
                    markdown: '`foo\\`bar`\n',
                    html: '<p><code>foo\\</code>bar`</p>\n',
                    example: 338,
                },
                {
                    markdown: '``foo`bar``\n',
                    html: '<p><code>foo`bar</code></p>\n',
                    example: 339,
                },
                {
                    markdown: '` foo `` bar `\n',
                    html: '<p><code>foo `` bar</code></p>\n',
                    example: 340,
                },
                {
                    markdown: '*foo`*`\n',
                    html: '<p>*foo<code>*</code></p>\n',
                    example: 341,
                },
                {
                    markdown: '[not a `link](/foo`)\n',
                    html: '<p>[not a <code>link](/foo</code>)</p>\n',
                    example: 342,
                },
                {
                    markdown: '`<a href="`">`\n',
                    html: '<p><code>&lt;a href=&quot;</code>&quot;&gt;`</p>\n',
                    example: 343,
                },
                // {
                //     markdown: '<a href="`">`\n',
                //     html: '<p><a href="`">`</p>\n',
                //     example: 344,
                // },
                {
                    markdown: '`<https://foo.bar.`baz>`\n',
                    html: '<p><code>&lt;https://foo.bar.</code>baz&gt;`</p>\n',
                    example: 345,
                },
                // {
                //     markdown: '<https://foo.bar.`baz>`\n',
                //     html: '<p><a href="https://foo.bar.%60baz">https://foo.bar.`baz</a>`</p>\n',
                //     example: 346,
                // },
                {
                    markdown: '```foo``\n',
                    html: '<p>```foo``</p>\n',
                    example: 347,
                },
                {
                    markdown: '`foo\n',
                    html: '<p>`foo</p>\n',
                    example: 348,
                },
                {
                    markdown: '`foo``bar``\n',
                    html: '<p>`foo<code>bar</code></p>\n',
                    example: 349,
                },
            ])('Example $example', async ({ markdown, html, example }) => {
                let code = (
                    await s.markup({
                        content: markdown,
                        filename: `${String(example)}.sveltex`,
                    })
                )?.code;
                code = code?.replaceAll(' class="language-plaintext"', '');
                code = code?.replace('<script>\n</script>\n', '');
                html = html.replace(/<p>(.*?)<\/p>/gsu, '$1');
                code = code?.replace(/<p>(.*?)<\/p>/gsu, '$1');
                if (
                    s.markdownBackend === 'unified' &&
                    [343, 345].includes(example)
                ) {
                    // It seems unified does not escapes some special characters in
                    // the same way as other markdown processors.
                    if (example === 343) {
                        expect(code).toContain(
                            '<code>&lt;a href=&quot;</code>">`',
                        );
                    } else if (example === 345) {
                        expect(code).toContain(
                            '<code>&lt;https://foo.bar.</code>baz>`',
                        );
                    }
                } else expect(code).toContain(html.trim());
                expect(log).not.toHaveBeenCalled();
            });
        },
    );
});
