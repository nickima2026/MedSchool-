#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

const NAV_BUTTONS = [
  '  <div class="msib-nav-auth" style="display:flex;align-items:center;gap:0.6rem;">',
  '    <a href="/login.html"',
  '       style="padding:0.45rem 1rem;border:1.5px solid #8C1515;border-radius:7px;',
  '              color:#8C1515;font-weight:600;font-size:0.875rem;text-decoration:none;"',
  '       onmouseover="this.style.background=\'#8C1515\';this.style.color=\'#fff\'"',
  '       onmouseout="this.style.background=\'transparent\';this.style.color=\'#8C1515\'">',
  '      Sign in',
  '    </a>',
  '    <a href="/signup.html"',
  '       style="padding:0.45rem 1rem;background:#8C1515;border:1.5px solid #8C1515;',
  '              border-radius:7px;color:#fff;font-weight:600;font-size:0.875rem;text-decoration:none;"',
  '       onmouseover="this.style.background=\'#6B0F0F\'"',
  '       onmouseout="this.style.background=\'#8C1515\'">',
  '      Sign up',
  '    </a>',
  '  </div>'
].join('\n');

function main() {
  console.log('\n--- MSIB Nav Button Injector ---\n');
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('ERROR: index.html not found at project root.'); process.exit(1);
  }
  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  if (html.includes('msib-nav-auth')) {
    console.log('Already done — msib-nav-auth found in index.html. Nothing changed.\n'); return;
  }
  const anchor = html.includes('</nav>') ? '</nav>' : html.includes('</header>') ? '</header>' : '</body>';
  html = html.replace(anchor, NAV_BUTTONS + '\n' + anchor);
  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log('Injected Sign in / Sign up buttons before ' + anchor + ' in index.html\n');
  console.log('Next: git add index.html scripts/ && git commit -m "feat: auth nav buttons" && git push\n');
}

main();
