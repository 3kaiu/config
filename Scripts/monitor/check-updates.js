#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', '..', 'output');
const updatesFile = path.join(outputDir, 'updates.json');
const resultsFile = path.join(outputDir, 'monitor-results.json');

let hasUpdate = false;
let updateInfo = null;

if (fs.existsSync(updatesFile)) {
  try {
    updateInfo = JSON.parse(fs.readFileSync(updatesFile, 'utf8'));
    hasUpdate = Array.isArray(updateInfo) && updateInfo.some(r => r.has_update);
  } catch { /* ignore */ }
} else if (fs.existsSync(resultsFile)) {
  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    hasUpdate = Array.isArray(results) && results.some(r => r.has_update);
  } catch { /* ignore */ }
}

if (hasUpdate) {
  process.stdout.write('has_update=true\n');
  const fs2 = require('fs');
  fs2.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', 'has_update=true\n');
} else {
  process.stdout.write('has_update=false\n');
  const fs2 = require('fs');
  fs2.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', 'has_update=false\n');
}
