/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Outfit', 'system-ui', 'sans-serif'],
        mono:  ['DM Mono', 'monospace'],
      },
      colors: {
        void:    '#060709',
        base:    '#0a0c10',
        surface: '#0f1117',
        raised:  '#151820',
        hover:   '#1c2030',
        blue: {
          DEFAULT: '#3b82f6',
          dim:     '#1d4ed8',
          glow:    'rgba(59,130,246,0.15)',
        },
      },
    },
  },
  plugins: [],
};
