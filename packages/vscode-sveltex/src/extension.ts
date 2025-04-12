import vscode = require('vscode');
import fs = require('node:fs');
import crypto = require('node:crypto');
import path = require('node:path');

const defaultLatexTags = ['tex', 'latex', 'tikz'];
const defaultEscapeTags = ['verb', 'verbatim'];

const tagRegex = /[a-zA-Z][-.:0-9_a-zA-Z]*/u;

/**
 * Idea: start with two copies of the same grammar, `sveltex.tmLanguage.json`
 * and `sveltex.tmLanguage.json_default`. The `sveltex.tmLanguage.json_default`
 * file is never modified, but is also not used for syntax highlighting.
 * Instead, `sveltex.tmLanguage.json` is updated dynamically based on the user's
 * settings. The `sveltex.tmLanguage.json_default` file exists solely to ease
 * the process of updating the grammar file, namely by providing an easy way to
 * enact the `latexTags` and `escapeTags` settings.
 *
 * @param grammarDir - The directory containing the grammar files.
 * @param latexTagsIn - The LaTeX tags to use for syntax highlighting.
 * @param escapeTagsIn - The verbatim tags to use for syntax highlighting.
 */
function updateGrammarFile(
    grammarDir: string,
    latexTagsIn: string[],
    escapeTagsIn: string[],
) {
    let grammar = fs.readFileSync(
        path.join(grammarDir, 'sveltex.tmLanguage.json_default'),
        'utf8',
    );

    const latexTags = [...latexTagsIn].filter((tag) => tagRegex.test(tag));
    const escapeTags = escapeTagsIn.filter((tag) => tagRegex.test(tag));

    if (latexTags.length === 0) latexTags.push(crypto.randomUUID());
    if (escapeTags.length === 0) escapeTags.push(crypto.randomUUID());

    grammar = grammar.replaceAll(
        defaultLatexTags.join('|'),
        latexTags.join('|'),
    );

    grammar = grammar.replaceAll(
        defaultEscapeTags.join('|'),
        escapeTags.join('|'),
    );

    // Write the modified grammar to the dynamically set grammar file
    fs.writeFileSync(path.join(grammarDir, 'sveltex.tmLanguage.json'), grammar);
}

function activate(context: vscode.ExtensionContext) {
    const grammarDir = path.join(context.extensionPath, 'syntaxes');

    const updateGrammar = () => {
        const latexTags = vscode.workspace
            .getConfiguration()
            .get<string[]>('sveltex.latexTags');
        const escapeTags = vscode.workspace
            .getConfiguration()
            .get<string[]>('sveltex.escapeTags');
        if (latexTags || escapeTags) {
            updateGrammarFile(
                grammarDir,
                latexTags ?? defaultLatexTags,
                escapeTags ?? defaultEscapeTags,
            );
        }
    };

    // Update grammar when the extension is activated
    updateGrammar();

    // Update grammar when the settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (
                e.affectsConfiguration('sveltex.latexTags') ||
                e.affectsConfiguration('sveltex.escapeTags')
            ) {
                updateGrammar();
            }
        }),
    );
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function deactivate() {}

export = {
    activate,
    deactivate,
};
