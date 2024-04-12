import { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';

export function isLiteElement(obj: unknown): obj is LiteElement {
    return obj instanceof LiteElement;
}
