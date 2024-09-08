import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

const commonPlugins = [
  resolve(),
  commonjs(),
  typescript({ tsconfig: "./tsconfig.json" }),
  terser(),
];

export default [
  // Browser-friendly UMD build
  {
    input: "src/index.ts",
    output: {
      name: "LiquidSDK",
      file: "dist/index.umd.js",
      format: "umd",
      globals: {
        react: "React",
        "react-native": "ReactNative",
      },
    },
    external: ["react", "react-native"],
    plugins: commonPlugins,
  },

  // CommonJS (for Node) and ES module (for bundlers) build
  {
    input: "src/index.ts",
    output: [
      { file: "dist/index.js", format: "cjs" },
      { file: "dist/index.mjs", format: "es" },
    ],
    external: ["react", "react-native"],
    plugins: commonPlugins,
  },

  // React Native specific build
  {
    input: "src/index.native.ts",
    output: {
      file: "dist/index.native.js",
      format: "es",
    },
    external: ["react", "react-native"],
    plugins: commonPlugins,
  },
];
