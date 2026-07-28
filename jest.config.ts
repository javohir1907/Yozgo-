export default {
  projects: [
    {
      displayName: "server",
      preset: "ts-jest",
      testEnvironment: "node",
      roots: ["<rootDir>/server"],
      testMatch: ["**/__tests__/**/*.test.ts"],
      moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/shared/$1",
      },
      transform: {
        "^.+\\.ts$": ["ts-jest", { useESM: true }],
      },
      extensionsToTreatAsEsm: [".ts"],
    },
    {
      displayName: "client",
      // The ESM preset (not plain "ts-jest") is required: the default preset
      // forces module=commonjs, which makes every `import.meta.env` read a
      // TS1343 compile error, and client code uses it in DEV-only branches.
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "jsdom",
      roots: ["<rootDir>/client/src"],
      testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/client/src/__tests__/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/client/src/$1",
        "^@shared/(.*)$": "<rootDir>/shared/$1",
        "\\.(css|less|scss)$": "identity-obj-proxy",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          { useESM: true, tsconfig: "<rootDir>/tsconfig.test.json" },
        ],
      },
      extensionsToTreatAsEsm: [".ts", ".tsx"],
    },
  ],
};
