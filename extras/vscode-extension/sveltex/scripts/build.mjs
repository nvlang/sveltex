import { readFileSync, writeFileSync } from 'fs';
import { load } from 'js-yaml';

['sveltex', 'markdown'].forEach((lang) => {
    writeFileSync(
        `syntaxes/${lang}.tmLanguage.json`,
        JSON.stringify(
            load(
                readFileSync(`syntaxes/${lang}.tmLanguage.yaml`, {
                    encoding: 'utf-8',
                }),
            ),
            null,
            2,
        ),
    );
});
