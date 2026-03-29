export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/server"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/shared/$1"
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: [".ts"],
};


