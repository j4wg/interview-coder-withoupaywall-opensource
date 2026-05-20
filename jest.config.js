const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    ...tsJestTransformCfg,
    "^.+\\.(svg|css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub",
  },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(svg|css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "identity-obj-proxy",
    "^react-syntax-highlighter/dist/esm/(.*)$": "react-syntax-highlighter/dist/cjs/$1",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/renderer/"
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(react-syntax-highlighter|@tanstack)/)",
  ],
};