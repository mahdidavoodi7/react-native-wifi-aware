// Expo resolves `app.plugin.js` from the package root when an app lists this package by name in
// its `plugins` array. The compiled plugin lives under plugin/build; `rootDir: ".."` in the
// plugin's tsconfig preserves the source layout so the service-name validator stays shared with
// the library rather than being duplicated here.
module.exports = require('./plugin/build/plugin/src/index.js');
