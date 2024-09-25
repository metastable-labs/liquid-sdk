import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const commonPlugins = [
  resolve({
    preferBuiltins: true,
  }),
  commonjs(),
  typescript({ tsconfig: './tsconfig.json' }),
  terser(),
];

export default [
  // Browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: {
      name: 'LiquidSDK',
      file: 'dist/index.umd.js', // For UMD, we expect a single bundled file
      format: 'umd',
      globals: {
        react: 'React',
        'react-native': 'ReactNative',
      },
      inlineDynamicImports: true, // Ensures UMD does not attempt code splitting
    },
    external: ['react', 'react-native'],
    plugins: commonPlugins,
  },

  // CommonJS (for Node) and ES module (for bundlers) build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist', // We use `dir` for multiple chunks or formats
      format: 'cjs',
      exports: 'auto', // Ensure that named exports are handled correctly in CommonJS
      preserveModules: true, // Keep module structure, helps with ES modules and tree-shaking
    },
    external: ['react', 'react-native'],
    plugins: commonPlugins,
  },

  // React Native specific build
  {
    input: 'src/index.native.ts',
    output: {
      dir: 'dist', 
      format: 'es',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: commonPlugins,
  },
];
