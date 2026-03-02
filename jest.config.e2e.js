/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  testRegex: "test/e2e/.+\\.test\\.ts$",
  transformIgnorePatterns: ["/node_modules/(?!@faker-js/faker)"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    "^.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true, module: "commonjs", strict: false }, isolatedModules: true }],
  },
};
