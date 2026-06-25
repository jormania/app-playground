// Tailwind only emits utilities/preflight for files matched by tailwind.config.js
// `content` (Sol Odyssey only) and only where `@tailwind` directives appear (its entry
// CSS). Autoprefixer just adds vendor prefixes — safe for every entry in the repo.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
