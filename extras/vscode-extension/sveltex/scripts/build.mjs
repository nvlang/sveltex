import { readFileSync, writeFileSync } from 'fs';
import { load } from 'js-yaml';

// this code if you want to save
writeFileSync(
    'syntaxes/sveltex.tmLanguage.json',
    JSON.stringify(
        load(
            readFileSync('syntaxes/sveltex.tmLanguage.yaml', {
                encoding: 'utf-8',
            }),
        ),
        null,
        2,
    ),
);
