// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')
const { FileStore } = require('metro-cache')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// 1. Watch the entire monorepo so Metro sees changes in workspace packages
config.watchFolders = [workspaceRoot]

// 2. Let Metro resolve modules from both the project and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// 3. Enable package.json "exports" field resolution and include the
//    "react-native" condition so @media-upload/core resolves to ./src/index.ts.
config.resolver.unstable_enablePackageExports = true
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'default',
]

// 4. Rewrite internal .js imports inside upload-core source to .ts so Metro
//    can resolve TypeScript source files (e.g. './types.js' → './types.ts').
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.endsWith('.js') &&
    context.originModulePath.includes('upload-core/src')
  ) {
    const tsPath = moduleName.slice(0, -3) + '.ts'
    try {
      return context.resolveRequest(context, tsPath, platform)
    } catch {
      // fall through to default resolution
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

// 5. Transpile the workspace package source through Metro's Babel pipeline
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx', 'mjs']

// 6. Use a persistent cache so repeated starts are fast
config.cacheStores = [
  new FileStore({ root: path.join(projectRoot, '.metro-cache') }),
]

module.exports = config
