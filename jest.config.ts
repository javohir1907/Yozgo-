const tsJestESM = {
  "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
};

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
      transform: tsJestESM,
      extensionsToTreatAsEsm: [".ts"],
    },
    {
      displayName: "client",
      preset: "ts-jest",
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
          { useESM: true, tsconfig: { jsx: "react-jsx" } },
        ],
      },
      extensionsToTreatAsEsm: [".ts", ".tsx"],
    },
  ],
};
