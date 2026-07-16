/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./**/*.{html,js,jsx}"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: 'var(--primary-color)',
                secondary: 'var(--secondary-color)',
                background: 'var(--background-color)',
                text: 'var(--text-color)',
                border: 'var(--border-color)',
            },
            transitionDuration: {
                DEFAULT: 'var(--transition-duration)',
            }
        },
    },
    plugins: [],
};