(function () {
  'use strict';
  var raw = localStorage.getItem('msib-user');
  if (!raw) return;
  var user;
  try { user = JSON.parse(raw); } catch (e) { return; }

  var meta = user.user_metadata || {};
  var app  = user.app_metadata  || {};
  var name = meta.full_name || user.email || 'Student';
  var year = app.year ? 'Year ' + app.year : '';

  var bar = document.createElement('div');
  bar.id = 'msib-user-bar';
  bar.style.cssText = [
    'position:fixed','top:0','left:0','right:0','z-index:9999',
    'background:#1a1a2e','color:#fff',
    'display:flex','align-items:center','justify-content:space-between',
    'padding:0 1.25rem','height:44px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-size:0.85rem','box-shadow:0 2px 8px rgba(0,0,0,0.35)'
  ].join(';');

  bar.innerHTML =
    '<a href="/index.html" style="color:#fff;text-decoration:none;font-weight:700;letter-spacing:-.3px;">MSIB.io</a>' +
    '<div style="display:flex;align-items:center;gap:1.25rem;">' +
      '<span style="opacity:.75;">' + name + (year ? ' &bull; ' + year : '') + '</span>' +
      '<a href="/index.html" style="color:#aab4d4;text-decoration:none;font-size:0.8rem;">&#8592; All Courses</a>' +
      '<button id="msib-signout" style="background:#8C1515;color:#fff;border:none;border-radius:6px;' +
        'padding:0.3rem 0.75rem;font-size:0.8rem;font-weight:600;cursor:pointer;">Sign out</button>' +
    '</div>';

  document.body.insertBefore(bar, document.body.firstChild);
  document.body.style.paddingTop = '44px';

  document.getElementById('msib-signout').addEventListener('click', function () {
    localStorage.removeItem('msib-access-token');
    localStorage.removeItem('msib-refresh-token');
    localStorage.removeItem('msib-user');
    window.location.replace('/login.html');
  });
})();
