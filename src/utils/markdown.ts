/**
 * Small remark plugin to disable indented code blocks and autolinks.
 */
export function remarkDisableIndentedCodeBlocksAndAutolinks(
    this: import('unified').Processor,
) {
    const data = this.data();
    const micromarkExtensions =
        data.micromarkExtensions ?? (data.micromarkExtensions = []);
    micromarkExtensions.push(micromarkDisableIndentedCodeAndAutolinks);
}

/**
 * Small micromark extension to disable indented code blocks and autolinks.
 *
 * @remarks
 * The names come from `import('micromark-util-types').TokenTypeMap`.
 */
export const micromarkDisableIndentedCodeAndAutolinks = {
    disable: {
        null: [
            'codeIndented',
            'autolink',
            'autolinkEmail',
            'autolinkMarker',
            'autolinkProtocol',
        ],
    },
};
