import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  target: 'es2020',
  outfile: 'out/extension.js',
  external: [
    'vscode' // Exclude VS Code API from the bundle
  ],
  sourcemap: true,
  format: 'cjs',
  logLevel: 'info'
}).catch(() => process.exit(1));
