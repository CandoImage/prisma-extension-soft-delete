/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  testRegex: "test/unit/.+\\.test\\.ts$",
  // @faker-js/faker v10+ is ESM-only — exclude it from the ignore list so
  // Jest transforms it, then provide explicit transforms for both TS and JS.
  transformIgnorePatterns: ["/node_modules/(?!@faker-js/faker)"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    "^.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true, module: "commonjs", strict: false }, isolatedModules: true }],
  },
};
