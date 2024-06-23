export interface Test {
    input: string;
    expected?: string;
    label: string;
}

export type TestRunner = (test: Test) => Promise<void> | void;

export function range(start: number, end: number, step: number = 1): number[] {
    const arr = [];
    for (let i = start; i <= end; i += step) {
        arr.push(i);
    }
    return arr;
}

export const uuidV4Regexp =
    /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/;

export function cartesianProduct<X1>(x1: X1[]): [X1][];
export function cartesianProduct<X1, X2>(x1: X1[], x2: X2[]): [X1, X2][];
export function cartesianProduct<X1, X2, X3>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
): [X1, X2, X3][];
export function cartesianProduct<X1, X2, X3, X4>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
): [X1, X2, X3, X4][];
export function cartesianProduct<X1, X2, X3, X4, X5>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
): [X1, X2, X3, X4, X5][];
export function cartesianProduct<X1, X2, X3, X4, X5, X6>(
    x1: X1[],
    x2: X2[],
    x3: X3[],
    x4: X4[],
    x5: X5[],
    x6: X6[],
): [X1, X2, X3, X4, X5, X6][];
export function cartesianProduct(...a: unknown[][]) {
    return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
}
