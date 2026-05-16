const root = require("path").join(__dirname, "..", "..");

const binding = require("node-gyp-build")(root);

try {
  module.exports = require("../../prebuilds/index.js");
} catch (_) {
  module.exports = binding;
}

try {
  module.exports.nodeTypeInfo = require("../../src/node-types.json");
} catch (_) {}
