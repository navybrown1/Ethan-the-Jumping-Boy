import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// No `define` block on purpose. This game ships as static files on GitHub Pages,
// so anything injected here is baked into public JavaScript. `process.env.*`
// below is evaluated by Node while Vite loads this config, which is safe; a
// `define` entry would not be.
export default defineConfig(() => {
  return {
    // Relative, not "/". The game ships as static files on GitHub Pages, where
    // a project site is served from https://<user>.github.io/<repo>/ rather
    // than from the domain root. With the default base of "/", Vite writes the
    // script and stylesheet tags root-absolute, so at a subpath the browser
    // asks for https://<user>.github.io/assets/index-*.js, gets a 404, and the
    // page is blank white with nothing in the game to blame because the game
    // never loads. `import.meta.env.BASE_URL` is what the sprite and boss atlas
    // URLs are built from, so the same value fixes those too.
    //
    // "./" rather than the hardcoded "/Ethan-the-Jumping-Boy/": relative works
    // at any subpath, at a domain root, and under `vite preview` or localhost,
    // and it survives the repository being renamed or forked. A relative base
    // is only a problem for apps with client-side routing at nested paths,
    // since "./" would resolve against the wrong segment; this app is a single
    // document that never touches history, so there is no such path.
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
