import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'js-yaml';

['sveltex', 'markdown'].forEach((lang) => {
    const str = JSON.stringify(
        load(
            readFileSync(`syntaxes/${lang}.tmLanguage.yaml`, {
                encoding: 'utf-8',
            }),
        ),
        null,
        2,
    );
    writeFileSync(`syntaxes/${lang}.tmLanguage.json`, str);
    if (lang === 'sveltex') {
        writeFileSync(`syntaxes/${lang}.tmLanguage.json_default`, str);
    }
});
