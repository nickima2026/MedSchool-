(function () {
  'use strict';
  var token = localStorage.getItem('msib-access-token');
  if (!token) { window.location.replace('/login.html'); return; }
  try {
    var payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('msib-access-token');
      localStorage.removeItem('msib-refresh-token');
      localStorage.removeItem('msib-user');
      window.location.replace('/login.html?reason=expired');
    }
  } catch (e) {
    window.location.replace('/login.html');
  }
})();
