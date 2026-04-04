#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const PORTAL_DIR   = path.join(__dirname, '..', 'portal');
const GUARD_TAG    = '<script src="/js/msib-auth-guard.js"></script>';
const USER_BAR_TAG = '<script src="/js/msib-user.js"></script>';
const HEAD_ANCHOR  = '</head>';
const BODY_REGEX   = /(<body[^>]*>)/i;

function walkHtml(dir) {
  let files = [];
  if (!fs.existsSync(dir)) {
    console.error('\n✗ /portal/ directory not found. Run from project root.\n');
    process.exit(1);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  if (html.includes(GUARD_TAG) && html.includes(USER_BAR_TAG)) return 'skipped';
  if (!html.includes(GUARD_TAG)) {
    if (html.includes(HEAD_ANCHOR)) { html = html.replace(HEAD_ANCHOR, '  ' + GUARD_TAG + '\n' + HEAD_ANCHOR); changed = true; }
  }
  if (!html.includes(USER_BAR_TAG)) {
    if (BODY_REGEX.test(html)) { html = html.replace(BODY_REGEX, '$1\n  ' + USER_BAR_TAG); changed = true; }
  }
  if (changed) { fs.writeFileSync(filePath, html, 'utf8'); return 'processed'; }
  return 'skipped';
}

function main() {
  console.log('\n--- MSIB Auth Guard Injector ---\n');
  const files = walkHtml(PORTAL_DIR);
  console.log('Found ' + files.length + ' HTML file(s) in /portal/\n');
  let processed = 0, skipped = 0, failed = 0;
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    try {
      const result = processFile(file);
      if (result === 'processed') { console.log('  + Updated  ' + rel); processed++; }
      else { console.log('  - Skipped  ' + rel); skipped++; }
    } catch (err) { console.error('  ! Error    ' + rel + ': ' + err.message); failed++; }
  }
  console.log('\n--- Done: updated=' + processed + ' skipped=' + skipped + (failed?' failed='+failed:'') + ' ---\n');
}

main();
