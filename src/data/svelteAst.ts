/**
 * One of the differences between the parser from Svelte 5 (when the `modern`
 * option is set to `true`) and the parser from Svelte 4 is that, with the
 * latter, there are some nodes which may contain children nodes in properties
 * other than `children`. This is the case the nodes of type `IfBlock`,
 * `EachBlock`, and `AwaitBlock`.
 */
export const otherChildrenProps_v4: Record<string, string[]> = {
    IfBlock: ['else'],
    // ElseBlock: [],
    EachBlock: ['else'],
    // KeyBlock: [],
    AwaitBlock: ['pending', 'then', 'catch'],
    // PendingBlock: [], ThenBlock: [], CatchBlock: [],
};

/**
 * Keys which either never point to children nodes, or which point to children
 * nodes which we are not interested in.
 */
export const notRelevantChildrenKeys = new Set([
    'type',
    'expression',
    'attributes',
    'start',
    'end',
    'loc',
    'name',
]);
