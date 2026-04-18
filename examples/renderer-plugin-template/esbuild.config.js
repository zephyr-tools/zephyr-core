import esbuild from 'esbuild';
import { argv, cwd } from 'node:process';
import { resolve } from 'node:path';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/renderer.jsx'],
  bundle: true,
  format: 'esm',
  outfile: 'renderer.js',
  // Use the automatic JSX runtime — esbuild will emit imports of
  // `jsx`/`jsxs` from `react/jsx-runtime`, which our shim provides.
  // WITHOUT this, esbuild uses the classic transform (React.createElement)
  // and the plugin fails with "React is not defined" at render time.
  jsx: 'automatic',
  // Redirect React imports to shims that read from the host app's window globals.
  // This ensures the plugin shares the host's React instance (required for hooks).
  alias: {
    react: resolve(cwd(), 'src/react-shim.js'),
    'react/jsx-runtime': resolve(cwd(), 'src/react-jsx-runtime-shim.js'),
  },
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  sourcemap: 'inline',
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Built renderer.js');
}
