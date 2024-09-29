import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const commonPlugins = [
  resolve({
    preferBuiltins: true,
  }),
  commonjs(),
  typescript({ tsconfig: './tsconfig.json' }),
  json(),
  terser(),
];

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: commonPlugins,
  },
  // ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.mjs',
      format: 'es',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: commonPlugins,
  },
  // Browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: {
      name: 'LiquidSDK',
      file: 'dist/index.umd.js',
      format: 'umd',
      globals: {
        react: 'React',
        'react-native': 'ReactNative',
        viem: 'viem',
      },
    },
    external: ['react', 'react-native', 'viem'],
    plugins: commonPlugins,
  },
  // React Native specific build
  {
    input: 'src/index.native.ts',
    output: {
      file: 'dist/index.native.js',
      format: 'es',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: commonPlugins,
  },
];