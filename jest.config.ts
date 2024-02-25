import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    preset: 'ts-jest/presets/default-esm',
    transform: {
        '^.+\\.m?[tj]s?$': ['ts-jest', { useESM: true }],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.(m)?js$': '$1',
    },
    testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.(m)?ts$',
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.ts', 'src/**/*.mts', '!src/**/*.d.ts', '!src/**/*.d.mts'],
};

export default config;
