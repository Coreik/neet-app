// Writes the catalogue, add-ons and settings as JSON for tools/build_sheet.py
// Run: node tools/build_sheet.cjs > /tmp/cbq.json
const path = require("path");
["cbq-catalog.js", "cbq-config.js"].forEach((f) => require(path.join(__dirname, "..", "assets", f)));
process.stdout.write(JSON.stringify({ catalog: globalThis.CBQ.catalog, defaults: globalThis.CBQ.defaults }));
