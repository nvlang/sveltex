import fs = require('node:fs');
import jsYaml = require('js-yaml');

['sveltex', 'markdown'].forEach((lang) => {
    const str = JSON.stringify(
        jsYaml.load(
            fs.readFileSync(`syntaxes/${lang}.tmLanguage.yaml`, {
                encoding: 'utf-8',
            }),
        ),
        null,
        2,
    );
    fs.writeFileSync(`syntaxes/${lang}.tmLanguage.json`, str);
    if (lang === 'sveltex') {
        fs.writeFileSync(`syntaxes/${lang}.tmLanguage.json_default`, str);
    }
});
