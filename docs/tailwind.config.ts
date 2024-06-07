import type { Config } from 'tailwindcss';
import { colors } from './src/lib/colors.js';

export default {
    darkMode: 'selector',
    content: ['./src/**/*.{md,html,js,ts}'],
    plugins: [],
    theme: {
        colors: {
            transparent: 'transparent',
            ...colors,
        },
        extend: {},
    },
} satisfies Config;
