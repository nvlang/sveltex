import { htmlTagNames } from 'html-tag-names';

export function isValidComponentName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(name) && !htmlTagNames.includes(name);
}
