// import { preprocess } from 'svelte/compiler';
// import { sveltex } from '$src';
// import fs from 'fs';
// import path from 'path';
// import { defaultSveltexConfig } from '$config';
// jest.mock('find-cache-dir', () => jest.fn(() => 'node_modules/sveltes'));

// describe('preprocessSveltex', () => {
//     it('should process .sveltex files correctly', async () => {
//         const input = fs.readFileSync(path.resolve(__dirname, 'example.sveltex'), 'utf-8');
//         const processed = await preprocess(input, sveltex(defaultSveltexConfig), {
//             filename: 'example.sveltex',
//         });
//         expect(processed.code).toEqual(expectedOutput);
//     });
// });

// const expectedOutput = `<div class="sveltex-output"><h1>Marked - Markdown Parser</h1>
// <p><a href="https://github.com/markedjs/marked/">Marked</a> lets you convert <a href="http://daringfireball.net/projects/markdown/">Markdown</a> into HTML.  Markdown is a simple text format whose goal is to be very easy to read and write, even when not converted to HTML.  This demo page will let you type anything you like and see how it gets converted.  Live.  No more waiting around.</p>
// <h2>How To Use The Demo</h2>
// <ol>
// <li>Type in stuff on the left.</li>
// <li>See the live updates on the right.</li>
// </ol>
// <p>That's it.  Pretty simple.  There's also a drop-down option above to switch between various views:</p>
// <ul>
// <li><strong>Preview:</strong>  A live display of the generated HTML as it would render in a browser.</li>
// <li><strong>HTML Source:</strong>  The generated HTML before your browser makes it pretty.</li>
// <li><strong>Lexer Data:</strong>  What <a href="https://github.com/markedjs/marked/">marked</a> uses internally, in case you like gory stuff like this.</li>
// <li><strong>Quick Reference:</strong>  A brief run-down of how to format things using markdown.</li>
// </ul>
// <h2>Why Markdown?</h2>
// <p>It's easy.  It's not overly bloated, unlike HTML.  Also, as the creator of <a href="http://daringfireball.net/projects/markdown/">markdown</a> says,</p>
// <blockquote>
// <p>The overriding design goal for Markdown's
// formatting syntax is to make it as readable
// as possible. The idea is that a
// Markdown-formatted document should be
// publishable as-is, as plain text, without
// looking like it's been marked up with tags
// or formatting instructions.</p>
// </blockquote>
// <p>Ready to start writing?  Either start changing stuff on the left or
// <a href="/demo/?text=">clear everything</a> with a simple click.</p>
// </div>`;
