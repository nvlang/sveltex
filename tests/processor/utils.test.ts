import { describe, it, expect } from 'vitest';
import { re } from '$src/processor/index.js';

describe('re', () => {
    it('removes unescaped whitespace', () => {
        expect(re` a  b `).toEqual(/ab/);
        expect(re` a \\ b `).toEqual(/a\\b/);
        expect(re` a \\\\ b `).toEqual(/a\\\\b/);
        expect(
            re`
                a\\\\ b \n
                
                \n
            `,
        ).toEqual(/a\\\\b\n\n/);
    });
    it('unescapes escaped whitespace', () => {
        expect(re` a \   b `).toEqual(/a b/);
        expect(re` a  \\\   b `).toEqual(/a\\ b/);
    });
    it('removes comments', () => {
        expect(re` a \   b # abc `).toEqual(/a b/);
        expect(re` a  \\\   b # some comment \\ something \n\n\n c `).toEqual(
            /a\\ b/,
        );
    });
    it('unescapes escaped backticks and hashtags', () => {
        expect(re` a \   b \# \\\# \\\\# abc \# \\\# \\\\#`).toEqual(
            /a b#\\#\\\\/,
        );
        expect(
            re` \`\\\` a  \\\   b # some comment \\ something \n\n\n c `,
        ).toEqual(/`\\`a\\ b/);
    });
});
