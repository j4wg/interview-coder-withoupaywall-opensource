import cssPlugin from '@eslint/css';
import js from '@eslint/js';
import json from "@eslint/json";
import markdownPlugin from '@eslint/markdown';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...js.configs.recommended,
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
    },
  },

  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ['**/*.md'],
    plugins: {
      markdown: markdownPlugin,
    },
    language: "markdown/commonmark",
    rules: {
      ...markdownPlugin.configs.recommended.rules
    }
  },

  {
    files: ['**/*.css'],
    plugins: {
      css: cssPlugin,
    },
    language: "css/css",
    rules: {
      ...cssPlugin.configs.recommended.rules,
      // Allow @tailwind directive
      'css/no-invalid-at-rules': 'off',
      // Allow !important
      'css/no-important': 'off',
      // Allow not widely available css features
      'css/use-baseline': 'off'
    },
  },
  { ignores: [
      'dist/',
      'dist-electron/',
      'postcss.config.js',
      'package-lock.json'
    ]
  }
];