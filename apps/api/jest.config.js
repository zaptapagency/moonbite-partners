/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: "<rootDir>/../tsconfig.spec.json" },
    ],
  },
  // Resolve the workspace package from source so tests need no prior build.
  moduleNameMapper: {
    "^@moonbite/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
  },
};
