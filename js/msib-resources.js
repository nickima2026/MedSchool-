/**
 * MSIB Notes Enhancer
 * Upgrades the My Notes tab with rich paste from Notion/OneNote + localStorage persistence.
 * Add one line before </body> in each portal HTML:
 *   <script src="../../js/msib-notes.js"></script>
 */
(function () {

  // ─── Course ID mapping ──────────────────────────────────────────────────────
  const FILE_MAP = {"molecular-foundations":"BIOC205","clinical-anatomy":"SURG203","embryology":"SURG201","bls":"EMED201","immunology":"IMMU210","genetics":"GENE205","neurobiology":"NEUR208","microbiology":"MICR207","biostats-epi":"BIOS206","behavioral-ethics":"BEHV204","pom1":"POM-I","pom2":"POM-II","pom3":"POM-III","som-cvr":"SOM-I","som-rgh":"SOM-II","som-emw":"SOM-IIB","som-nd":"SOM-IIIA","som-hoid":"SOM-IIIB","internal-medicine":"MED300A","surgery":"SURG300A","pediatrics":"PEDS300A","obgyn":"OBGYN300A","psychiatry":"PSYC300A","neurology":"NENS301A","emergency-medicine":"EMED301A","critical-care":"ANES306A","family-medicine":"FAMMED301A","ambulatory":"MED313A","radiology":"RADL302","pocus":"POCUS303","epidemiology":"EPID304","anesthesia-extended":"ANES305","bioengineering":"SC-BIOENG","biomedical-ethics":"SC-ETHICS","ai-computational":"SC-AICOMP","clinical-research":"SC-CLINRES","community-health":"SC-COMMHEALTH","health-services-policy":"SC-HSPOLICY","molecular-basis":"SC-MOLMED","medical-education":"SC-MEDED"};

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const CSS = `
    #msib-notes-enhanced { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
    .msib-paste-banner {
      display: flex; align-items: center; gap: 10px;
      background: #fdf8f4; border: 1px dashed #c9a882;
      border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #5a4a3a; line-height: 1.5;
    }
    .msib-paste-banner strong { color: #8B1A1A; }
    .msib-paste-steps {
      display: flex; gap: 16px; flex-wrap: wrap;
      margin-top: 6px; font-size: 12px; color: #888;
    }
    .msib-paste-step { display: flex; align-items: center; gap: 5px; }
    .msib-paste-step kbd {
      background: #fff; border: 1px solid #ddd; border-radius: 4px;
      padding: 1px 5px; font-size: 11px; font-family: monospace;
    }
    .msib-rich-editor {
      min-height: 160px; max-height: 480px; overflow-y: auto;
      border: 1px solid #e0dbd5; border-radius: 8px;
      padding: 14px 16px;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: 14px; line-height: 1.65; outline: none;
      background: #fff; color: #1a1a1a;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .msib-rich-editor:focus {
      border-color: #8B1A1A;
      box-shadow: 0 0 0 3px rgba(139,26,26,0.08);
    }
    .msib-rich-editor:empty::before {
      content: attr(data-placeholder); color: #bbb; pointer-events: none;
    }
    .msib-rich-editor h1 { font-size: 1.35em; font-weight: 700; margin: 10px 0 4px; }
    .msib-rich-editor h2 { font-size: 1.18em; font-weight: 600; margin: 8px 0 3px; }
    .msib-rich-editor h3 { font-size: 1.05em; font-weight: 600; margin: 6px 0 3px; }
    .msib-rich-editor p { margin: 4px 0; }
    .msib-rich-editor ul, .msib-rich-editor ol { padding-left: 22px; margin: 4px 0; }
    .msib-rich-editor li { margin: 2px 0; }
    .msib-rich-editor blockquote {
      border-left: 3px solid #8B1A1A; margin: 8px 0;
      padding: 4px 12px; color: #555; background: #fafafa;
    }
    .msib-rich-editor code {
      background: #f3f0ec; border-radius: 3px;
      padding: 1px 5px; font-size: 0.88em; font-family: monospace;
    }
    .msib-rich-editor pre { background: #f3f0ec; padding: 10px; border-radius: 6px; overflow-x: auto; }
    .msib-rich-editor a { color: #8B1A1A; text-decoration: underline; }
    .msib-rich-editor table { border-collapse: collapse; width: 100%; margin: 6px 0; }
    .msib-rich-editor td, .msib-rich-editor th {
      border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 13px;
    }
    .msib-rich-editor th { background: #f8f5f2; font-weight: 600; }
    .msib-btn-row { display: flex; gap: 8px; align-items: center; }
    .msib-save-btn {
      padding: 8px 20px; background: #8B1A1A; color: #fff;
      border: none; border-radius: 6px; font-size: 14px; font-weight: 500;
      cursor: pointer; transition: background 0.15s;
    }
    .msib-save-btn:hover { background: #701515; }
    .msib-clear-btn {
      padding: 8px 14px; background: transparent; color: #999;
      border: 1px solid #ddd; border-radius: 6px; font-size: 13px; cursor: pointer;
    }
    .msib-clear-btn:hover { background: #f5f5f5; color: #666; }
    .msib-char-count { font-size: 12px; color: #bbb; margin-left: auto; }
    .msib-saved-section { display: flex; flex-direction: column; gap: 10px; }
    .msib-saved-heading {
      font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
      text-transform: uppercase; color: #aaa;
      padding-bottom: 8px; border-bottom: 1px solid #eee;
    }
    .msib-note-card {
      background: #fff; border: 1px solid #ebe8e4;
      border-radius: 8px; padding: 14px 16px;
      transition: box-shadow 0.15s;
    }
    .msib-note-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .msib-note-meta {
      display: flex; justify-content: space-between;
      align-items: center; margin-bottom: 10px;
    }
    .msib-note-date { font-size: 12px; color: #bbb; }
    .msib-note-del {
      background: none; border: none; cursor: pointer;
      font-size: 15px; opacity: 0.4; padding: 2px 4px;
      transition: opacity 0.15s;
    }
    .msib-note-del:hover { opacity: 1; }
    .msib-note-body {
      font-size: 14px; line-height: 1.65; color: #1a1a1a;
    }
    .msib-note-body h1 { font-size: 1.25em; font-weight: 700; margin: 8px 0 3px; }
    .msib-note-body h2 { font-size: 1.1em; font-weight: 600; margin: 6px 0 3px; }
    .msib-note-body h3 { font-size: 1em; font-weight: 600; margin: 5px 0 2px; }
    .msib-note-body p { margin: 3px 0; }
    .msib-note-body ul, .msib-note-body ol { padding-left: 20px; margin: 3px 0; }
    .msib-note-body blockquote {
      border-left: 3px solid #8B1A1A; margin: 6px 0;
      padding: 3px 10px; color: #666; background: #fafafa;
    }
    .msib-note-body code {
      background: #f3f0ec; border-radius: 3px;
      padding: 1px 4px; font-size: 0.88em; font-family: monospace;
    }
    .msib-note-body a { color: #8B1A1A; }
    .msib-note-body table { border-collapse: collapse; width: 100%; margin: 4px 0; }
    .msib-note-body td, .msib-note-body th {
      border: 1px solid #ddd; padding: 5px 8px; font-size: 13px;
    }
    .msib-note-body th { background: #f8f5f2; font-weight: 600; }
    .msib-no-notes { color: #ccc; font-size: 13px; text-align: center; padding: 20px 0; }
  `;

  // ─── HTML sanitiser (safe for Notion / OneNote paste) ───────────────────────
  const KEEP_TAGS = new Set([
    'h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','b','em','i','u',
    'a','br','blockquote','code','pre','table','tbody','thead','tr','td','th','hr','div','span'
  ]);

  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    (function clean(node) {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 8) { child.remove(); return; }          // comments
        if (child.nodeType === 1) {
          const tag = child.tagName.toLowerCase();
          if (!KEEP_TAGS.has(tag)) {
            // unwrap — keep inner content, ditch the element
            const parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
          } else {
            // strip all attrs except href on <a>
            Array.from(child.attributes).forEach(a => {
              if (!(tag === 'a' && a.name === 'href')) child.removeAttribute(a.name);
            });
            if (tag === 'a') {
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer');
            }
            clean(child);
          }
        }
      });
    })(doc.body);
    return doc.body.innerHTML;
  }

  // ─── localStorage helpers ────────────────────────────────────────────────────
  function key(courseId) { return 'msib-notes-v1-' + courseId; }

  function loadNotes(courseId) {
    try { return JSON.parse(localStorage.getItem(key(courseId))) || []; }
    catch (e) { return []; }
  }

  function persistNotes(courseId, notes) {
    localStorage.setItem(key(courseId), JSON.stringify(notes));
  }

  // ─── Render saved notes list ─────────────────────────────────────────────────
  function renderList(listEl, courseId) {
    const notes = loadNotes(courseId);
    if (!notes.length) {
      listEl.innerHTML = '<p class="msib-no-notes">No saved notes yet — paste from Notion or OneNote and hit Save.</p>';
      return;
    }
    listEl.innerHTML =
      '<p class="msib-saved-heading">Saved Notes (' + notes.length + ')</p>' +
      notes.map((n, i) =>
        '<div class="msib-note-card">' +
          '<div class="msib-note-meta">' +
            '<span class="msib-note-date">' + n.date + '</span>' +
            '<button class="msib-note-del" data-i="' + i + '" title="Delete note">🗑</button>' +
          '</div>' +
          '<div class="msib-note-body">' + n.content + '</div>' +
        '</div>'
      ).join('');

    listEl.querySelectorAll('.msib-note-del').forEach(btn => {
      btn.onclick = function () {
        const notes2 = loadNotes(courseId);
        notes2.splice(parseInt(this.dataset.i), 1);
        persistNotes(courseId, notes2);
        renderList(listEl, courseId);
      };
    });
  }

  // ─── Main enhancer ───────────────────────────────────────────────────────────
  function enhance(courseId) {
    // Already injected?
    if (document.getElementById('msib-notes-enhanced')) {
      renderList(document.querySelector('.msib-saved-section'), courseId);
      return;
    }

    // Find the existing textarea and save button
    const existingTA = document.querySelector('textarea.notes-textarea') ||
                       document.querySelector('[placeholder="Add your notes here..."]');
    const existingSave = document.querySelector('button.notes-save-button') ||
                         document.querySelector('.notes-editor button');
    if (!existingTA) return;

    // Hide originals
    existingTA.style.display = 'none';
    if (existingSave) existingSave.style.display = 'none';

    // Find parent to inject into
    const parent = existingTA.closest('.notes-editor') || existingTA.parentNode;

    // Build UI
    const wrap = document.createElement('div');
    wrap.id = 'msib-notes-enhanced';
    wrap.innerHTML =
      '<div class="msib-paste-banner">' +
        '<div>' +
          '<div>📋 <strong>Notion</strong> &amp; <strong>OneNote</strong> friendly — rich formatting is preserved when you paste</div>' +
          '<div class="msib-paste-steps">' +
            '<span class="msib-paste-step">1. Copy notes in Notion / OneNote <kbd>⌘C</kbd></span>' +
            '<span class="msib-paste-step">2. Click below &amp; paste <kbd>⌘V</kbd></span>' +
            '<span class="msib-paste-step">3. Hit <kbd>Save Note</kbd></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="msib-rich-editor" contenteditable="true" ' +
           'data-placeholder="Paste from Notion, OneNote, or just type here..."></div>' +
      '<div class="msib-btn-row">' +
        '<button class="msib-save-btn">💾 Save Note</button>' +
        '<button class="msib-clear-btn">✕ Clear</button>' +
        '<span class="msib-char-count"></span>' +
      '</div>' +
      '<div class="msib-saved-section"></div>';

    parent.insertBefore(wrap, existingTA);

    const editor   = wrap.querySelector('.msib-rich-editor');
    const saveBtn  = wrap.querySelector('.msib-save-btn');
    const clearBtn = wrap.querySelector('.msib-clear-btn');
    const charEl   = wrap.querySelector('.msib-char-count');
    const listEl   = wrap.querySelector('.msib-saved-section');

    // Rich paste handler — strips Notion/OneNote cruft, keeps structure
    editor.addEventListener('paste', function (e) {
      e.preventDefault();
      const html  = e.clipboardData.getData('text/html');
      const plain = e.clipboardData.getData('text/plain');
      if (html) {
        document.execCommand('insertHTML', false, sanitize(html));
      } else {
        document.execCommand('insertText', false, plain);
      }
      updateCount();
    });

    editor.addEventListener('input', updateCount);

    function updateCount() {
      const len = editor.innerText.trim().length;
      charEl.textContent = len ? len.toLocaleString() + ' chars' : '';
    }

    saveBtn.addEventListener('click', function () {
      const content = editor.innerHTML.trim().replace(/^(<br\s*\/?>)+$/i, '');
      if (!content) return;
      const notes = loadNotes(courseId);
      notes.unshift({
        date: new Date().toLocaleString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        content: content
      });
      persistNotes(courseId, notes);
      editor.innerHTML = '';
      charEl.textContent = '';
      renderList(listEl, courseId);
    });

    clearBtn.addEventListener('click', function () {
      editor.innerHTML = '';
      charEl.textContent = '';
    });

    // Load existing notes
    renderList(listEl, courseId);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function init() {
    if (!document.getElementById('msib-notes-styles')) {
      const s = document.createElement('style');
      s.id = 'msib-notes-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    const filename = window.location.pathname.split('/').pop().replace('.html', '');
    const courseId = FILE_MAP[filename];
    if (!courseId) return;

    // Enhance immediately in case notes tab is already active
    enhance(courseId);

    // Re-run whenever the My Notes tab is clicked
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (btn && /my.notes/i.test(btn.textContent)) {
        setTimeout(function () { enhance(courseId); }, 60);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();