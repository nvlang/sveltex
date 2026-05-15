/**
 * Unit tests for the MathJax accessibility helpers exported by `MathHandler`.
 *
 * `resolveMathjaxA11y` and `stripMathjaxMenuOptions` are pure functions, so —
 * unlike the rest of the MathJax suite — these tests need no process-global
 * MathJax singleton and run synchronously.
 */
import { describe, it, expect } from 'vitest';

import {
    resolveMathjaxA11y,
    stripMathjaxMenuOptions,
} from '../../../../src/handlers/MathHandler.js';
import type { MathjaxOptions } from '../../../../src/types/utils/MathjaxOptions.js';

describe('resolveMathjaxA11y', () => {
    it('loads assistive MathML (only) for undefined options', () => {
        expect(resolveMathjaxA11y(undefined)).toEqual({
            load: ['a11y/assistive-mml'],
            options: {},
        });
    });

    it('treats an empty options object like undefined', () => {
        expect(resolveMathjaxA11y({})).toEqual({
            load: ['a11y/assistive-mml'],
            options: {},
        });
    });

    it('resolves the SvelTeX default config to assistive MathML only', () => {
        // The accessible-by-default posture: assistive MML on; speech,
        // braille and enrichment off. Only `enableAssistiveMml` survives into
        // the forwarded options — the rest are consumed as load-decisions, so
        // MathJax never sees an option whose component is not loaded.
        expect(
            resolveMathjaxA11y({
                enableAssistiveMml: true,
                enableBraille: false,
                enableEnrichment: false,
                enableSpeech: false,
            }),
        ).toEqual({
            load: ['a11y/assistive-mml'],
            options: { enableAssistiveMml: true },
        });
    });

    it('does not load assistive MathML when it is explicitly disabled', () => {
        expect(resolveMathjaxA11y({ enableAssistiveMml: false })).toEqual({
            load: [],
            options: {},
        });
    });

    it('loads the semantic-enrich component when enrichment is on', () => {
        expect(resolveMathjaxA11y({ enableEnrichment: true })).toEqual({
            load: ['a11y/assistive-mml', 'a11y/semantic-enrich'],
            options: { enableEnrichment: true },
        });
    });

    it('loads the speech component when speech is on', () => {
        expect(resolveMathjaxA11y({ enableSpeech: true })).toEqual({
            load: ['a11y/assistive-mml', 'a11y/speech'],
            options: { enableSpeech: true },
        });
    });

    it('loads the speech component when only braille is on', () => {
        expect(resolveMathjaxA11y({ enableBraille: true })).toEqual({
            load: ['a11y/assistive-mml', 'a11y/speech'],
            options: { enableBraille: true },
        });
    });

    it('loads the complexity component when complexity is on', () => {
        expect(resolveMathjaxA11y({ enableComplexity: true })).toEqual({
            load: ['a11y/assistive-mml', 'a11y/complexity'],
            options: { enableComplexity: true },
        });
    });

    it('forwards speech sub-options only when the speech component loads', () => {
        const sre = { locale: 'en' } as const;
        // Speech on: `sre` is registered by the speech component — keep it.
        expect(resolveMathjaxA11y({ enableSpeech: true, sre })).toEqual({
            load: ['a11y/assistive-mml', 'a11y/speech'],
            options: { enableSpeech: true, sre },
        });
        // Speech off: `sre` would be an unregistered option — drop it.
        expect(resolveMathjaxA11y({ sre })).toEqual({
            load: ['a11y/assistive-mml'],
            options: {},
        });
    });

    it('always strips options for components SvelTeX never loads', () => {
        expect(
            resolveMathjaxA11y({ enableExplorer: false, enableMenu: false }),
        ).toEqual({
            load: ['a11y/assistive-mml'],
            options: {},
        });
    });

    it('passes core (non-accessibility) options through untouched', () => {
        // `renderActions` is a core document option, owned by no a11y
        // component, so it must survive the filtering unchanged.
        const options: MathjaxOptions = {
            renderActions: { sveltex: [100, 'addStuff', false] },
        };
        const result = resolveMathjaxA11y(options);
        expect(result.load).toEqual(['a11y/assistive-mml']);
        expect(result.options).toEqual(options);
    });
});

describe('stripMathjaxMenuOptions', () => {
    it('removes the menuOptions key the assistive-mml component injects', () => {
        const config: Record<string, unknown> = {
            options: {
                enableAssistiveMml: true,
                menuOptions: { settings: { assistiveMml: true } },
            },
        };
        stripMathjaxMenuOptions(config);
        expect(config['options']).toEqual({ enableAssistiveMml: true });
    });

    it('does nothing when there are no options', () => {
        const config: Record<string, unknown> = {};
        stripMathjaxMenuOptions(config);
        expect(config).toEqual({});
    });
});
