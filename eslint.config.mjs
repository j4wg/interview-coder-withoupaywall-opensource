import js from "@eslint/js";
import globals from "globals";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules, 
    },
  },

  {
    files: ["**/*.json"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    rules: { ...markdown.configs.recommended.rules },
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    rules: { ...css.configs.recommended.rules },
  },
];
