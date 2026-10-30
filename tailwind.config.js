/** Colours point at CSS variables so the light and dark token sets in index.css keep working. */
const v = (n) => `var(--${n})`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: v('surface'), wash: v('wash'), line: { DEFAULT: v('line'), soft: v('line-soft') }, ink: v('ink'), muted: v('muted'),
        pine: { DEFAULT: v('pine'), 600: v('pine-600'), 100: v('pine-100'), 50: v('pine-050') },
        amber: { DEFAULT: v('amber'), 100: v('amber-100') }, danger: { DEFAULT: v('danger'), 100: v('danger-100') },
        ok: { DEFAULT: v('ok'), 100: v('ok-100') }, blue: v('blue'),
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', '"SF Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,28,.06), 0 8px 24px rgba(16,24,28,.10)', soft: '0 1px 3px rgba(16,24,28,.12)' },
      borderRadius: { card: '8px' },
      minHeight: { tap: '46px' },
    },
  },
  plugins: [],
};
