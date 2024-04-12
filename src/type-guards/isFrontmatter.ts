import { Frontmatter } from '$types';

export function isFrontmatter(obj: unknown): obj is Frontmatter {
    if (obj === undefined || obj === null || typeof obj !== 'object') {
        return false;
    }

    const { ...rest } = obj as Frontmatter;

    for (const key in rest) {
        if (typeof rest[key] === 'undefined') {
            return false;
        }
    }

    return true;
}
