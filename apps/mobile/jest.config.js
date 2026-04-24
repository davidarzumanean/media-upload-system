/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest-setup.ts'],
  moduleNameMapper: {
    '^@media-upload/core$':
      '<rootDir>/../../packages/upload-core/dist/index.js',
    '^expo-file-system/legacy$':
      '<rootDir>/__mocks__/expo-file-system-legacy.ts',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.ts',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.ts',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.ts',
    '^@expo/vector-icons/(.*)$': '<rootDir>/__mocks__/@expo/vector-icons.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native|@expo|expo|@testing-library)/)',
  ],
};