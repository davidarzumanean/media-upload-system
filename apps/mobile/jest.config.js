/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  // Override the babel transform for tests only: use @react-native/babel-preset
  // (not babel-preset-expo) to avoid expo's winter-runtime import.meta polyfill
  // blowing up under Jest. babel.config.js keeps babel-preset-expo for the app build.
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        // Prevent Babel from also loading babel.config.js (babel-preset-expo),
        // which would conflict with @react-native/babel-preset here.
        configFile: false,
        presets: [['@react-native/babel-preset', { enableBabelRuntime: false }]],
      },
    ],
  },
  setupFiles: ['./jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@media-upload/core$':
      '<rootDir>/../../packages/upload-core/dist/index.js',
    '^expo-file-system/legacy$':
      '<rootDir>/__mocks__/expo-file-system-legacy.ts',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.ts',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.ts',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.js',
    '^@expo/vector-icons/(.*)$': '<rootDir>/__mocks__/@expo/vector-icons.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native|@expo|expo|@testing-library)/)',
  ],
};