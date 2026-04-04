/**
 * MSIB Resources Enhancer
 * Replaces the inline prompt()-based resource handler with a non-blocking
 * inline modal form. Saves resources to localStorage per course.
 *
 * Root cause fixed: the original inline script called window.prompt() to
 * collect URL + title, which blocks the browser and hangs Chrome automation.
 *
 * Deploy: replace /js/msib-resources.js in the repo with this file.
 * No HTML changes needed — this script intercepts the existing button.
 */
(function () {

  // ─── Course ID mapping (matches msib-notes.js and msib-quiz.js) ──────────
  var FILE_MAP = {
    "molecular-foundations":"BIOC205","clinical-anatomy":"SURG203",
    "embryology":"SURG201","bls":"EMED201","immunology":"IMMU210",
    "genetics":"GENE205","neurobiology":"NEUR208","microbiology":"MICR207",
    "biostats-epi":"BIOS206","behavioral-ethics":"BEHV204",
    "pom1":"POM-I","pom2":"POM-II","pom3":"POM-III",
    "som-cvr":"SOM-I","som-rgh":"SOM-II","som-emw":"SOM-IIB",
    "som-nd":"SOM-IIIA","som-hoid":"SOM-IIIB",
    "internal-medicine":"MED300A","surgery":"SURG300A",
    "pediatrics":"PEDS300A","obgyn":"OBGYN300A","psychiatry":"PSYC300A",
    "neurology":"NENS301A","emergency-medicine":"EMED301A",
    "critical-care":"ANES306A","family-medicine":"FAMMED301A",
    "ambulatory":"MED313A","radiology":"RADL302","pocus":"POCUS303",
    "epidemiology":"EPID304","anesthesia-extended":"ANES305",
    "bioengineering":"SC-BIOENG","biomedical-ethics":"SC-ETHICS",
    "ai-computational":"SC-AICOMP","clinical-research":"SC-CLINRES",
    "community-health":"SC-COMMHEALTH","health-services-policy":"SC-HSPOLICY",
    "molecular-basis":"SC-MOLMED","medical-education":"SC-MEDED"
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  var CSS = '\
#msib-res-modal-overlay {\
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);\
  z-index: 9999; display: flex; align-items: center; justify-content: center;\
}\
#msib-res-modal {\
  background: #fff; border-radius: 12px; padding: 28px 28px 22px;\
  width: 440px; max-width: 94vw; box-shadow: 0 8px 40px rgba(0,0,0,0.18);\
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\
}\
#msib-res-modal h3 {\
  margin: 0 0 18px; font-size: 16px; font-weight: 700; color: #1a1a1a;\
}\
.msib-res-field { margin-bottom: 14px; }\
.msib-res-field label {\
  display: block; font-size: 12px; font-weight: 600;\
  text-transform: uppercase; letter-spacing: .05em;\
  color: #888; margin-bottom: 5px;\
}\
.msib-res-field input, .msib-res-field select {\
  width: 100%; box-sizing: border-box;\
  border: 1px solid #ddd; border-radius: 7px;\
  padding: 9px 12px; font-size: 14px; color: #1a1a1a;\
  outline: none; transition: border-color .15s, box-shadow .15s;\
}\
.msib-res-field input:focus, .msib-res-field select:focus {\
  border-color: #8B1A1A; box-shadow: 0 0 0 3px rgba(139,26,26,.1);\
}\
.msib-res-err {\
  font-size: 12px; color: #c0392b; margin-top: 4px; display: none;\
}\
.msib-res-btns { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }\
.msib-res-cancel {\
  padding: 9px 18px; border: 1px solid #ddd; border-radius: 7px;\
  background: #fff; font-size: 14px; cursor: pointer; color: #555;\
}\
.msib-res-cancel:hover { background: #f5f5f5; }\
.msib-res-save {\
  padding: 9px 22px; border: none; border-radius: 7px;\
  background: #8B1A1A; color: #fff; font-size: 14px;\
  font-weight: 600; cursor: pointer;\
}\
.msib-res-save:hover { background: #701515; }\
#msib-res-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }\
.msib-res-card {\
  display: flex; align-items: flex-start; gap: 12px;\
  background: #fff; border: 1px solid #ebe8e4; border-radius: 9px;\
  padding: 12px 14px; transition: box-shadow .15s;\
}\
.msib-res-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.07); }\
.msib-res-favicon {\
  width: 20px; height: 20px; border-radius: 4px;\
  flex-shrink: 0; margin-top: 2px;\
  object-fit: contain; background: #f3f0ec;\
}\
.msib-res-body { flex: 1; min-width: 0; }\
.msib-res-title {\
  font-size: 14px; font-weight: 600; color: #1a1a1a;\
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\
}\
.msib-res-url {\
  display: block; font-size: 12px; color: #8B1A1A;\
  text-decoration: none; overflow: hidden; text-overflow: ellipsis;\
  white-space: nowrap; margin-top: 2px;\
}\
.msib-res-url:hover { text-decoration: underline; }\
.msib-res-tag {\
  display: inline-block; font-size: 11px; padding: 1px 7px;\
  border-radius: 20px; background: #f3f0ec; color: #888;\
  margin-top: 5px;\
}\
.msib-res-del {\
  background: none; border: none; cursor: pointer;\
  font-size: 15px; opacity: .35; padding: 2px 4px;\
  flex-shrink: 0; transition: opacity .15s;\
}\
.msib-res-del:hover { opacity: 1; }\
.msib-res-empty {\
  text-align: center; font-size: 13px; color: #ccc; padding: 18px 0;\
}';

  // ─── localStorage helpers ─────────────────────────────────────────────────
  function storageKey(courseId) { return 'msib-resources-v1-' + courseId; }

  function loadResources(courseId) {
    try { return JSON.parse(localStorage.getItem(storageKey(courseId))) || []; }
    catch (e) { return []; }
  }

  function saveResources(courseId, list) {
    localStorage.setItem(storageKey(courseId), JSON.stringify(list));
  }

  // ─── Favicon helper ───────────────────────────────────────────────────────
  function faviconUrl(url) {
    try {
      var origin = new URL(url).origin;
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(origin) + '&sz=32';
    } catch (e) {
      return '';
    }
  }

  // ─── Normalise URL ────────────────────────────────────────────────────────
  function normaliseUrl(raw) {
    var s = raw.trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { new URL(s); return s; } catch (e) { return ''; }
  }

  // ─── Render resource list into the container ──────────────────────────────
  function renderList(container, courseId) {
    var list = loadResources(courseId);
    if (!list.length) {
      container.innerHTML = '<p class="msib-res-empty">No resources added yet. Click "+ Add Resource" to save a link.</p>';
      return;
    }
    container.innerHTML = '<div id="msib-res-list">' +
      list.map(function (r, i) {
        var fav = faviconUrl(r.url);
        return '<div class="msib-res-card">' +
          (fav ? '<img class="msib-res-favicon" src="' + fav + '" onerror="this.style.display=\'none\'">' : '') +
          '<div class="msib-res-body">' +
            '<div class="msib-res-title">' + escHtml(r.title || r.url) + '</div>' +
            '<a class="msib-res-url" href="' + escHtml(r.url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(r.url) + '</a>' +
            (r.category ? '<span class="msib-res-tag">' + escHtml(r.category) + '</span>' : '') +
          '</div>' +
          '<button class="msib-res-del" data-i="' + i + '" title="Remove">🗑</button>' +
        '</div>';
      }).join('') +
    '</div>';

    container.querySelectorAll('.msib-res-del').forEach(function (btn) {
      btn.onclick = function () {
        var list2 = loadResources(courseId);
        list2.splice(parseInt(this.dataset.i), 1);
        saveResources(courseId, list2);
        renderList(container, courseId);
      };
    });
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Modal ────────────────────────────────────────────────────────────────
  function showModal(courseId, container) {
    // Remove any stale overlay
    var old = document.getElementById('msib-res-modal-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'msib-res-modal-overlay';
    overlay.innerHTML =
      '<div id="msib-res-modal">' +
        '<h3>🔗 Add Resource</h3>' +
        '<div class="msib-res-field">' +
          '<label>URL</label>' +
          '<input id="msib-res-url-input" type="url" placeholder="https://laneguides.stanford.edu/anesthesia" autocomplete="off">' +
          '<div class="msib-res-err" id="msib-res-url-err">Please enter a valid URL.</div>' +
        '</div>' +
        '<div class="msib-res-field">' +
          '<label>Title <span style="font-weight:400;text-transform:none;font-size:11px;color:#bbb">(optional — auto-filled from URL)</span></label>' +
          '<input id="msib-res-title-input" type="text" placeholder="e.g. Stanford Anesthesia Guide">' +
        '</div>' +
        '<div class="msib-res-field">' +
          '<label>Category</label>' +
          '<select id="msib-res-cat-input">' +
            '<option value="">— None —</option>' +
            '<option value="Guidelines">Guidelines</option>' +
            '<option value="Reference">Reference</option>' +
            '<option value="Video">Video</option>' +
            '<option value="Article">Article</option>' +
            '<option value="Tool">Tool</option>' +
            '<option value="Other">Other</option>' +
          '</select>' +
        '</div>' +
        '<div class="msib-res-btns">' +
          '<button class="msib-res-cancel">Cancel</button>' +
          '<button class="msib-res-save">Save Resource</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var urlInput   = document.getElementById('msib-res-url-input');
    var titleInput = document.getElementById('msib-res-title-input');
    var catInput   = document.getElementById('msib-res-cat-input');
    var urlErr     = document.getElementById('msib-res-url-err');
    var saveBtn    = overlay.querySelector('.msib-res-save');
    var cancelBtn  = overlay.querySelector('.msib-res-cancel');

    // Focus URL field
    setTimeout(function () { urlInput.focus(); }, 50);

    // Close helpers
    function closeModal() { overlay.remove(); }

    cancelBtn.onclick = closeModal;
    overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', esc); }
    });

    // Save
    saveBtn.onclick = function () {
      var rawUrl = urlInput.value.trim();
      var url    = normaliseUrl(rawUrl);
      if (!url) {
        urlErr.style.display = 'block';
        urlInput.focus();
        return;
      }
      urlErr.style.display = 'none';

      var title    = titleInput.value.trim() || url;
      var category = catInput.value;

      var list = loadResources(courseId);
      list.unshift({ url: url, title: title, category: category, addedAt: new Date().toISOString() });
      saveResources(courseId, list);

      closeModal();
      renderList(container, courseId);
    };

    // Allow Enter to submit from URL/title fields
    [urlInput, titleInput].forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') saveBtn.click();
      });
    });
  }

  // ─── Main enhancer ────────────────────────────────────────────────────────
  function enhance(courseId) {
    var addBtn = document.getElementById('addResourceButton');
    if (!addBtn || addBtn.dataset.msibEnhanced) return;
    addBtn.dataset.msibEnhanced = '1';

    // Container where the existing inline script puts "No resources added yet"
    var container = document.getElementById('resourcesContainer');
    if (!container) return;

    // Intercept ALL click handlers on the button — run first, stop others
    addBtn.addEventListener('click', function (e) {
      e.stopImmediatePropagation();   // prevents the original prompt() handler
      showModal(courseId, container);
    }, true);  // useCapture = true → fires before inline handlers

    // Render any already-saved resources on load
    renderList(container, courseId);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function init() {
    // Inject styles
    if (!document.getElementById('msib-res-styles')) {
      var s = document.createElement('style');
      s.id = 'msib-res-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    var filename = window.location.pathname.split('/').pop().replace('.html', '');
    var courseId = FILE_MAP[filename];
    if (!courseId) return;

    enhance(courseId);

    // Re-enhance when Resources tab is clicked (portal may re-render the tab)
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (btn && /resources/i.test(btn.textContent)) {
        setTimeout(function () { enhance(courseId); }, 80);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
