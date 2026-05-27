/**
 * P2 corpus: a handful of well-known real-world markdown documents, fetched
 * from raw.githubusercontent.com and cached. These are large, messy, GFM-using
 * docs — a sanity check that the harness survives real input and a measure of
 * residual divergence on prose people actually write.
 *
 * Each doc is treated as ONE sample (the whole file).
 */
import { fetchCached } from './_cache.mjs';

/** @type {{ id: string, url: string }[]} */
const DOCS = [
    {
        id: 'rw-react-readme',
        url: 'https://raw.githubusercontent.com/facebook/react/v18.2.0/README.md',
    },
    {
        id: 'rw-vscode-readme',
        url: 'https://raw.githubusercontent.com/microsoft/vscode/1.85.0/README.md',
    },
    {
        id: 'rw-node-readme',
        url: 'https://raw.githubusercontent.com/nodejs/node/v20.10.0/README.md',
    },
];

/**
 * @returns {{ name: string, samples: { id: string, text: string, section: string }[] }}
 */
export function loadRealWorld() {
    const samples = [];
    for (const doc of DOCS) {
        const filename = doc.id + '.md';
        let text;
        try {
            text = fetchCached(doc.url, filename);
        } catch (e) {
            console.warn(`  (skipping ${doc.id}: ${e.message})`);
            continue;
        }
        samples.push({ id: doc.id, text, section: 'real-world' });
    }
    return { name: 'real-world READMEs', samples };
}
