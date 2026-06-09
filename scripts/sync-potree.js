// Copies the freshly built Potree bundle from the `potree` submodule
// (potree/build/potree) into PotreeDesktop's libs/potree, which is what
// index.html actually loads. Run after building the submodule.
//
//   node scripts/sync-potree.js
//
// Cross-platform (uses fs.cpSync), no shell dependencies.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "potree", "build", "potree");
const dest = path.join(root, "libs", "potree");

if (!fs.existsSync(src)) {
	console.error(
		`Build output not found at ${src}\n` +
		`Run the Potree build first:  npm run potree:build`
	);
	process.exit(1);
}

console.log(`Syncing Potree build:\n  from ${src}\n  to   ${dest}`);
fs.cpSync(src, dest, { recursive: true });
console.log("Done. libs/potree is now up to date with the submodule build.");
