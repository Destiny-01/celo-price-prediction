const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// Configure project root and watch folders
config.projectRoot = projectRoot;
config.watchFolders = [projectRoot, workspaceRoot];

// Configure resolver
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ],
  // Ensure TypeScript files are resolved
  sourceExts: [...(config.resolver?.sourceExts || []), "ts", "tsx"],
  // Resolve from project root
  resolverMainFields: ["react-native", "browser", "main"],
};

// Enable transforming node_modules that contain TypeScript
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;

