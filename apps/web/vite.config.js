import { defineConfig } from "vite";

/**
 * Vite configuration for RiffRush web shell.
 *
 * Source layout:
 *   apps/web/public/   ← root: Vite serves & bundles from here
 *     index.html       ← entry HTML (processed by @vitejs/plugin-legacy if needed)
 *     app.js           ← entry script (vanilla JS, no imports)
 *     styles.css       ← stylesheet (included via <link> in index.html)
 *
 * Build output:
 *   apps/web/dist/     ← production bundle (gitignored)
 *     index.html       ← rewritten with hashed asset references
 *     assets/
 *       app-[hash].js  ← minified JS
 *       index-[hash].css ← extracted & minified CSS
 */
export default defineConfig({
  // Vite treats this directory as the project root when resolving index.html.
  root: "public",

  build: {
    // Output relative to the config file location (apps/web/), not root.
    outDir: "../dist",
    emptyOutDir: true,

    // Use esbuild (bundled with Vite) for minification — no extra install needed.
    minify: "esbuild",

    // Emit a sourcemap alongside the bundle so errors in production can be
    // traced back to the original source lines.
    sourcemap: true,

    rollupOptions: {
      // Explicit entry so Rollup never guesses wrong.
      input: "public/index.html"
    }
  },

  // Keep the Vite dev server on the same port the static server used, so
  // bookmarks and CORS allow-lists stay unchanged.
  server: {
    port: 4173,
    strictPort: false
  },

  preview: {
    port: 4173,
    strictPort: false
  }
});
