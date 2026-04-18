import esbuild from 'esbuild';
import { argv, cwd } from 'node:process';
import { resolve } from 'node:path';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/renderer.jsx'],
  bundle: true,
  format: 'esm',
  outfile: 'renderer.js',
  jsx: 'automatic',
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
