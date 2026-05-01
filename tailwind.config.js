/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"IBM Plex Sans Arabic"', 'sans-serif'],
                quran: ['"UthmanicHafs"', 'serif'],
                lateef: ['"Lateef"', 'serif'],
            },
            colors: {
                // Premium Navy Blue
                navy: {
                    50: '#f0f4f8',
                    100: '#d9e2ec',
                    200: '#bcccdc',
                    300: '#9fb3c8',
                    400: '#829ab1',
                    500: '#627d98',
                    600: '#486581',
                    700: '#334e68',
                    800: '#243b53',
                    900: '#102a43',
                    950: '#0a1c2e',
                },
                // Premium Gold/Beige
                gold: {
                    50: '#fbf9f5',
                    100: '#f5f0e6',
                    200: '#e6dcc4',
                    300: '#d6c69e',
                    400: '#c6ad73',
                    500: '#b08d55',
                    600: '#8d6e3f',
                    700: '#6d5430',
                    800: '#4f3c22',
                    900: '#342817',
                },
                emerald: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
            }
        },
    },
    plugins: [],
}
