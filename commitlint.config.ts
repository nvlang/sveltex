import type { UserConfig } from '@commitlint/types';
import { RuleConfigSeverity } from '@commitlint/types';

/**
 *
 * `commitlint` configuration.
 *
 * @see https://commitlint.js.org/#/reference-configuration
 *
 * ---
 *
 * Parts of a commit message:
 *
 * ```plaintext
 * type(scope): subject
 * <BLANK LINE>
 * body
 * <BLANK LINE>
 * footer
 * ```
 *
 * By `header`, we mean the `type(scope): subject` part.
 *
 * @see https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits
 *
 */
const Configuration: UserConfig = {
    /**
     * Resolve and load \@commitlint/config-conventional from node_modules.
     */
    extends: ['@commitlint/config-conventional'],

    /**
     * Rules are made up by a name and a configuration array.
     *
     * ```js
     * '<rule-name>': [<severity>, <applicability>, <value>]
     * ```
     *
     * - `<severity>`:
     *   - `0` (or `RuleConfigSeverity.Disabled`): violation of rule does
     *     nothing. This effectively disables the rule.
     *   - `1` (or `RuleConfigSeverity.Warning`): violation of rule throws
     *     warning.
     *   - `2` (or `RuleConfigSeverity.Error`): violation of rule throws error.
     *
     * - `<applicability>`:
     *   - `'always'`: rule should always pass.
     *   - `'never'`: rule should never pass. This effectively "inverts" the
     *     rule.
     *
     * - `<value>`: value to use for this rule.
     *
     * @example
     * ```js
     * "rules": {
     *     "header-max-length": [0, "always", 72]
     * }
     * ```
     */
    rules: {
        /**
         * In `type(scope): subject`, `type` must always be lowercase.
         */
        'type-case': [RuleConfigSeverity.Error, 'always', 'lower-case'],

        /**
         * The header, i.e., `type(scope): subject`, must always be less than 50
         * characters long in total.
         */
        'header-max-length': [RuleConfigSeverity.Error, 'always', 50],

        /**
         * The `header` must always be preceded by a blank line.
         */
        'body-leading-blank': [RuleConfigSeverity.Error, 'always'],

        /**
         * The body, i.e., the part after the header, must always be wrapped at
         * 72 characters.
         */
        'body-max-line-length': [RuleConfigSeverity.Error, 'always', 72],

        /**
         * The `footer` must always be preceded by a blank line.
         */
        'footer-leading-blank': [RuleConfigSeverity.Error, 'always'],
    },
};

module.exports = Configuration;
