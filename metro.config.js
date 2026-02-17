const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 1. Add extra node modules mapping if needed
// 2. Ensure all extensions are supported
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// 3. Fix react-native-svg specifically by ensuring it doesn't try to use src/ index on Windows
// if it causes issues, but we already patched package.json.
// Let's add an alias for the problematic mixin if necessary.

module.exports = config;
