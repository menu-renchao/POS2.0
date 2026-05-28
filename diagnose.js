// diagnose.js — Run on Jenkins machine to find the root cause
const g = require('./node_modules/playwright/lib/globals');

console.log('=== Module Resolution Diagnostics ===');
console.log('globals.js path:', require.resolve('./node_modules/playwright/lib/globals'));
console.log('globals.js module id:', require.cache[require.resolve('./node_modules/playwright/lib/globals')]?.id);

// Simulate what the loader process does
g.setCurrentlyLoadingFileSuite({ _diagnostic: true });

// Now require @playwright/test like the test file does
const pwt = require('./node_modules/@playwright/test');

// Check if the globals are shared
const g2 = require('./node_modules/playwright/lib/globals');
console.log('Same module instance?', g === g2);
console.log('currentlyLoadingFileSuite:', g.currentlyLoadingFileSuite());
console.log('currentlyLoadingFileSuite (g2):', g2.currentlyLoadingFileSuite());

// Now try through the full chain
const pw = require('./node_modules/playwright/test');
const libIndex = require('./node_modules/playwright/lib/index');
console.log('test object has describe?', typeof pw.describe);
console.log('test object has describe (from @playwright/test)?', typeof pwt.describe);

// Check all cached modules related to playwright/globals
console.log('\n=== Cached modules with "globals" ===');
for (const [key, mod] of Object.entries(require.cache)) {
  if (key.includes('playwright') && key.includes('globals')) {
    console.log('  ', key, '- id:', mod.id);
  }
}
