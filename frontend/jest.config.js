/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Babel is configured here, not in babel.config.js, so Next.js keeps using
  // SWC for the app build. Jest only ever compiles the pure lib modules.
  transform: {
    "^.+\\.(js|jsx)$": [
      "babel-jest",
      { presets: [["@babel/preset-env", { targets: { node: "current" } }]] },
    ],
  },
};
