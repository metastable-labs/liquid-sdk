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
  json(),
  terser(),
];

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      exports: 'named',
      entryFileNames: '[name].js',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/cjs',
        rootDir: './src',
      }),
    ],
  },
  // ES module build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'es',
      entryFileNames: '[name].js',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/esm',
        rootDir: './src',
      }),
    ],
  },
  // React Native specific build
  {
    input: 'src/index.native.ts',
    output: {
      dir: 'dist/native',
      format: 'es',
      entryFileNames: '[name].js',
    },
    external: ['react', 'react-native', 'viem'],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/native',
        rootDir: './src',
      }),
    ],
  },
];