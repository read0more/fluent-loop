const esbuild = require('esbuild');
const path = require('path');
const { sassPlugin, postcssModules } = require('esbuild-sass-plugin');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, '../src/renderer/index.tsx')],
  bundle: true,
  outdir: path.join(__dirname, '../dist'),
  entryNames: 'renderer',
  platform: 'browser',
  target: ['chrome110'],
  plugins: [
    // CSS Modules for .module.scss files
    sassPlugin({
      filter: /\.module\.scss$/,
      transform: postcssModules({}),
      loadPaths: [path.join(__dirname, '../src/renderer/styles')],
    }),
    // Global CSS for regular .scss files (non-module)
    sassPlugin({
      filter: /\.scss$/,
      type: 'css',
      loadPaths: [path.join(__dirname, '../src/renderer/styles')],
    }),
  ],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for renderer changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Renderer build completed!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
