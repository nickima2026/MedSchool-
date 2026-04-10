/* ============================================
   MSIB.io — Medical School in a Box
   Core JavaScript
   ============================================ */

// --- Tab System ---
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tabs__btn');
    const panelContainer = tabGroup.nextElementSibling?.closest('section') || tabGroup.parentElement;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        // Deactivate all in this group
        buttons.forEach(b => b.classList.remove('active'));
        panelContainer.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        // Activate selected
        btn.classList.add('active');
        const panel = panelContainer.querySelector(`#${target}`);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// --- Flashcard System ---
function initFlashcards() {
  document.querySelectorAll('.flashcard-deck').forEach(deck => {
    const cards = JSON.parse(deck.dataset.cards || '[]');
    if (!cards.length) return;

    let currentIndex = 0;
    let isFlipped = false;

    const cardEl = deck.querySelector('.flashcard');
    const frontEl = deck.querySelector('.flashcard__front');
    const backEl = deck.querySelector('.flashcard__back');
    const counter = deck.querySelector('.flashcard-counter');
    const prevBtn = deck.querySelector('[data-action="prev"]');
    const nextBtn = deck.querySelector('[data-action="next"]');
    const exportBtn = deck.querySelector('[data-action="anki-export"]');

    function renderCard() {
      if (!cards[currentIndex]) return;
      frontEl.innerHTML = `<p>${cards[currentIndex].front}</p>`;
      backEl.innerHTML = `<p>${cards[currentIndex].back}</p>`;
      if (counter) counter.textContent = `${currentIndex + 1} / ${cards.length}`;
      cardEl.classList.remove('flipped');
      isFlipped = false;
    }

    cardEl?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      cardEl.classList.toggle('flipped', isFlipped);
    });

    prevBtn?.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + cards.length) % cards.length;
      renderCard();
    });

    nextBtn?.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % cards.length;
      renderCard();
    });

    // Anki export: generates a TSV file for import
    exportBtn?.addEventListener('click', () => {
      const tsv = cards.map(c => `${c.front}\t${c.back}`).join('\n');
      const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.dataset.deckName || 'msib-flashcards'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });

    renderCard();
  });
}

// --- Quiz Engine ---
function initQuizzes() {
  document.querySelectorAll('.quiz-container').forEach(quiz => {
    const questions = quiz.querySelectorAll('.quiz-question');
    let score = 0;
    let answered = 0;

    questions.forEach(q => {
      const correctAnswer = q.dataset.correct;
      const options = q.querySelectorAll('.quiz-option');
      const explanation = q.querySelector('.quiz-explanation');

      options.forEach(opt => {
        opt.addEventListener('click', () => {
          if (q.classList.contains('answered')) return;
          q.classList.add('answered');
          answered++;

          const selected = opt.dataset.option;
          opt.classList.add('selected');

          if (selected === correctAnswer) {
            opt.classList.add('correct');
            score++;
            if (explanation) {
              explanation.classList.add('show', 'correct-explanation');
            }
          } else {
            opt.classList.add('incorrect');
            // Highlight correct answer
            options.forEach(o => {
              if (o.dataset.option === correctAnswer) o.classList.add('correct');
            });
            if (explanation) {
              explanation.classList.add('show', 'incorrect-explanation');
            }
          }

          // Update score display
          const scoreDisplay = quiz.querySelector('.quiz-score__number');
          if (scoreDisplay && answered === questions.length) {
            const pct = Math.round((score / questions.length) * 100);
            scoreDisplay.textContent = `${pct}%`;
            scoreDisplay.closest('.quiz-score').style.display = 'block';
          }
        });
      });
    });

    // Reset button
    const resetBtn = quiz.querySelector('[data-action="reset-quiz"]');
    resetBtn?.addEventListener('click', () => {
      score = 0;
      answered = 0;
      questions.forEach(q => {
        q.classList.remove('answered');
        q.querySelectorAll('.quiz-option').forEach(o => {
          o.classList.remove('selected', 'correct', 'incorrect');
        });
        const exp = q.querySelector('.quiz-explanation');
        if (exp) exp.classList.remove('show', 'correct-explanation', 'incorrect-explanation');
      });
      const scoreDisplay = quiz.querySelector('.quiz-score');
      if (scoreDisplay) scoreDisplay.style.display = 'none';
    });
  });
}

// --- Checklist with Local Storage ---
function initChecklists() {
  document.querySelectorAll('.checklist').forEach(list => {
    const courseId = list.dataset.courseId || 'default';
    const stored = JSON.parse(localStorage.getItem(`msib-checklist-${courseId}`) || '{}');

    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const id = cb.id;
      if (stored[id]) {
        cb.checked = true;
        cb.nextElementSibling?.classList.add('completed');
      }

      cb.addEventListener('change', () => {
        stored[id] = cb.checked;
        localStorage.setItem(`msib-checklist-${courseId}`, JSON.stringify(stored));
        cb.nextElementSibling?.classList.toggle('completed', cb.checked);
        updateProgress(list);
      });
    });

    updateProgress(list);
  });
}

function updateProgress(list) {
  const total = list.querySelectorAll('input[type="checkbox"]').length;
  const checked = list.querySelectorAll('input[type="checkbox"]:checked').length;
  const bar = list.closest('section')?.querySelector('.progress-bar__fill');
  const label = list.closest('section')?.querySelector('.progress-label');
  if (bar) bar.style.width = `${(checked / total) * 100}%`;
  if (label) label.textContent = `${checked}/${total} completed`;
}

// --- Sidebar Active State (scroll spy) ---
function initScrollSpy() {
  const sidebar = document.querySelector('.course-sidebar__nav');
  if (!sidebar) return;

  const sections = [];
  sidebar.querySelectorAll('a[href^="#"]').forEach(link => {
    const id = link.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) sections.push({ link, el });
  });

  function onScroll() {
    const scrollY = window.scrollY + 100;
    let active = sections[0];
    for (const s of sections) {
      if (s.el.offsetTop <= scrollY) active = s;
    }
    sections.forEach(s => s.link.classList.remove('active'));
    if (active) active.link.classList.add('active');
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// --- Mobile Navigation ---
function initMobileNav() {
  const hamburger = document.querySelector('.topnav__hamburger');
  const links = document.querySelector('.topnav__links');
  hamburger?.addEventListener('click', () => {
    links?.classList.toggle('open');
  });
}

// --- Code Runner (simple display + Pyodide integration placeholder) ---
function initCodeRunners() {
  document.querySelectorAll('.code-runner').forEach(runner => {
    const runBtn = runner.querySelector('.code-runner__run-btn');
    const output = runner.querySelector('.code-runner__output');
    const code = runner.querySelector('.code-runner__editor pre')?.textContent || '';

    runBtn?.addEventListener('click', async () => {
      output.textContent = 'Running...';
      runBtn.disabled = true;

      try {
        // Check if Pyodide is loaded
        if (typeof loadPyodide !== 'undefined' && !window.pyodide) {
          output.textContent = 'Loading Python environment...';
          window.pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
          });
          await window.pyodide.loadPackage(['matplotlib', 'numpy']);
        }

        if (window.pyodide) {
          // Redirect stdout
          window.pyodide.runPython(`
import sys, io
sys.stdout = io.StringIO()
          `);
          window.pyodide.runPython(code);
          const stdout = window.pyodide.runPython('sys.stdout.getvalue()');
          output.textContent = stdout || '(no output)';
        } else {
          // Fallback: just show the code
          output.textContent = '⚠ Python runtime not loaded. Copy this code to run in Jupyter on your Mac Mini.\n\nTo enable browser execution, add Pyodide to the page.';
        }
      } catch (err) {
        output.textContent = `Error: ${err.message}`;
      }

      runBtn.disabled = false;
    });
  });
}

// --- Search (simple client-side) ---
function initSearch() {
  const searchInput = document.querySelector('#course-search');
  const cards = document.querySelectorAll('.course-card');

  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// --- Sessions: YouTube & Zoom Connector ---
function initSessions() {
  const STORAGE_KEY = 'msib-session-transcripts';
  const urlInput = document.getElementById('session-url-input');
  const connectBtn = document.getElementById('session-connect-btn');
  const urlError = document.getElementById('session-url-error');
  const playerArea = document.getElementById('session-player-area');
  const embedContainer = document.getElementById('session-embed-container');
  const zoomCard = document.getElementById('session-zoom-card');
  const zoomUrlDisplay = document.getElementById('session-zoom-url-display');
  const zoomLaunch = document.getElementById('session-zoom-launch');
  const disconnectBtn = document.getElementById('session-disconnect-btn');
  const transcriptArea = document.getElementById('session-transcript-area');
  const transcriptText = document.getElementById('session-transcript-text');
  const fetchTranscriptBtn = document.getElementById('session-fetch-transcript');
  const pasteTranscriptBtn = document.getElementById('session-paste-transcript');
  const saveTarget = document.getElementById('session-save-target');
  const saveLabel = document.getElementById('session-save-label');
  const saveBtn = document.getElementById('session-save-btn');
  const saveFeedback = document.getElementById('session-save-feedback');
  const savedItems = document.getElementById('session-saved-items');
  const savedEmpty = document.getElementById('session-saved-empty');

  if (!urlInput || !connectBtn) return; // Not on the landing page

  let currentSession = { type: null, videoId: null, url: null };

  // --- Session type picker ---
  document.querySelectorAll('.sessions-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sessions-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.sessionType;
      urlInput.placeholder = type === 'youtube'
        ? 'Paste a YouTube video or live stream URL here...'
        : 'Paste a Zoom meeting or webinar join link here...';
    });
  });

  // --- URL parsing helpers ---
  function parseYouTubeUrl(url) {
    // Handles: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/live/ID, youtube.com/embed/ID
    let match;
    match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function isZoomUrl(url) {
    return /zoom\.(us|com)\/[jw]\//.test(url) || /zoom\.(us|com)\/meeting\//.test(url);
  }

  function detectUrlType(url) {
    if (parseYouTubeUrl(url)) return 'youtube';
    if (isZoomUrl(url)) return 'zoom';
    return null;
  }

  // --- Connect ---
  connectBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please paste a URL first.');
      return;
    }

    const activeType = document.querySelector('.sessions-type-btn.active')?.dataset.sessionType;
    const detectedType = detectUrlType(url);

    // Auto-detect or validate
    const sessionType = detectedType || activeType;
    if (!sessionType) {
      showError('Could not recognize this URL. Make sure it\'s a valid YouTube or Zoom link.');
      return;
    }

    // If detected type differs from selected, auto-switch
    if (detectedType && detectedType !== activeType) {
      document.querySelectorAll('.sessions-type-btn').forEach(b => b.classList.remove('active'));
      document.querySelector(`.sessions-type-btn[data-session-type="${detectedType}"]`)?.classList.add('active');
    }

    hideError();

    if (sessionType === 'youtube') {
      const videoId = parseYouTubeUrl(url);
      if (!videoId) {
        showError('Could not extract a video ID from this YouTube URL. Please check the link.');
        return;
      }
      currentSession = { type: 'youtube', videoId, url };
      embedContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="YouTube session"></iframe>`;
      embedContainer.style.display = '';
      zoomCard.style.display = 'none';
    } else {
      currentSession = { type: 'zoom', videoId: null, url };
      zoomUrlDisplay.textContent = url;
      zoomLaunch.href = url;
      embedContainer.style.display = 'none';
      embedContainer.innerHTML = '';
      zoomCard.style.display = '';
    }

    playerArea.style.display = '';
    transcriptArea.style.display = '';
    urlInput.value = '';
  });

  // Allow Enter key to connect
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); connectBtn.click(); }
  });

  // --- Disconnect ---
  disconnectBtn.addEventListener('click', () => {
    embedContainer.innerHTML = '';
    embedContainer.style.display = '';
    zoomCard.style.display = 'none';
    playerArea.style.display = 'none';
    transcriptArea.style.display = 'none';
    currentSession = { type: null, videoId: null, url: null };
  });

  // --- Fetch Transcript (YouTube only — tries API, then guides user) ---
  fetchTranscriptBtn.addEventListener('click', async () => {
    if (currentSession.type === 'zoom') {
      showTranscriptMessage('Zoom transcripts must be downloaded from Zoom after the meeting ends. Use "Paste Transcript" to add it manually.', '#E98300');
      return;
    }
    if (!currentSession.videoId) {
      showTranscriptMessage('No YouTube video connected.', '#c62828');
      return;
    }

    fetchTranscriptBtn.disabled = true;
    fetchTranscriptBtn.textContent = 'Fetching...';

    try {
      // Call our Vercel API (tries ANDROID, TV_EMBEDDED, WEB clients + watch page scrape)
      const apiUrl = `/api/transcript?v=${currentSession.videoId}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(35000) });
      const data = await resp.json();

      if (data.ok && data.timestamped) {
        transcriptText.value = data.timestamped;
        const langNote = data.isAutoGenerated ? ' (auto-generated)' : '';
        const segNote = `${data.segmentCount} segments`;
        showTranscriptMessage(
          `Transcript fetched successfully! ${segNote}, ${data.language}${langNote}`,
          '#2D8659'
        );
      } else if (data.ok && data.transcript) {
        transcriptText.value = data.transcript;
        showTranscriptMessage('Transcript fetched successfully!', '#2D8659');
      } else {
        throw new Error(data.error || 'No transcript data returned');
      }
    } catch (err) {
      // Auto-fetch failed — show guided workflow since the student is already watching
      showTranscriptGrabGuide(currentSession.videoId);
    }

    fetchTranscriptBtn.disabled = false;
    fetchTranscriptBtn.textContent = 'Fetch Transcript';
  });

  // --- Guided transcript grab: shown when API can't reach YouTube ---
  function showTranscriptGrabGuide(videoId) {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    // Remove any existing guide
    const existing = document.getElementById('transcript-grab-guide');
    if (existing) existing.remove();

    const guide = document.createElement('div');
    guide.id = 'transcript-grab-guide';
    guide.style.cssText = 'background:#1a2332;border:1px solid #E98300;border-radius:10px;padding:18px 20px;margin:12px 0;color:#f0f0f0;font-size:0.97rem;line-height:1.6;';
    guide.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:1.3rem;">📋</span>
        <strong style="color:#E98300;">Grab the transcript from YouTube</strong>
      </div>
      <p style="margin:0 0 10px;color:#ccc;">Since you're watching this video, you can grab the transcript in seconds:</p>
      <ol style="margin:0 0 14px 18px;padding:0;color:#ddd;">
        <li style="margin-bottom:6px;">Click <strong>"Open on YouTube"</strong> below (or switch to your YouTube tab)</li>
        <li style="margin-bottom:6px;">Click the <strong>⋮ More</strong> button below the video → <strong>Show transcript</strong></li>
        <li style="margin-bottom:6px;">Click inside the transcript panel, press <strong>Ctrl+A</strong> (or ⌘A) to select all, then <strong>Ctrl+C</strong> (or ⌘C) to copy</li>
        <li style="margin-bottom:6px;">Come back here and click <strong>"Paste from Clipboard"</strong></li>
      </ol>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${ytUrl}" target="_blank" rel="noopener"
           style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#c62828;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.95rem;">
          ▶ Open on YouTube
        </a>
        <button id="transcript-clipboard-btn"
                style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#2D8659;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:0.95rem;cursor:pointer;">
          📋 Paste from Clipboard
        </button>
        <button id="transcript-guide-dismiss"
                style="padding:8px 12px;background:transparent;color:#888;border:1px solid #444;border-radius:6px;font-size:0.9rem;cursor:pointer;">
          Dismiss
        </button>
      </div>
    `;

    // Insert guide above the transcript textarea
    transcriptText.parentNode.insertBefore(guide, transcriptText);

    // Wire up Paste from Clipboard button
    document.getElementById('transcript-clipboard-btn').addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.length > 10) {
            transcriptText.value = text;
            guide.remove();
            showTranscriptMessage('Transcript pasted from clipboard! You can now save it to a course.', '#2D8659');
          } else {
            showTranscriptMessage('Clipboard is empty — copy the transcript from YouTube first, then try again.', '#E98300');
          }
        } else {
          transcriptText.focus();
          showTranscriptMessage('Your browser blocked clipboard access. Please click in the text box below and press Ctrl+V (or ⌘V) to paste.', '#E98300');
        }
      } catch (e) {
        transcriptText.focus();
        showTranscriptMessage('Clipboard access was denied. Please click in the text box below and press Ctrl+V (or ⌘V) to paste manually.', '#E98300');
      }
    });

    // Dismiss button
    document.getElementById('transcript-guide-dismiss').addEventListener('click', () => {
      guide.remove();
    });
  }

  // --- Paste Transcript (focus the textarea) ---
  pasteTranscriptBtn.addEventListener('click', () => {
    transcriptText.focus();
    transcriptText.placeholder = 'Paste your transcript or notes here...';
    // Try to read from clipboard
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        if (text && text.length > 20) {
          transcriptText.value = text;
          showTranscriptMessage('Pasted from clipboard!', '#2D8659');
        }
      }).catch(() => {
        // Clipboard access denied, user can paste manually
      });
    }
  });

  // --- Save Transcript ---
  saveBtn.addEventListener('click', () => {
    const text = transcriptText.value.trim();
    if (!text) {
      showSaveFeedback('No transcript to save. Fetch or paste a transcript first.', '#c62828');
      return;
    }

    const target = saveTarget.value;
    const label = saveLabel.value.trim() || 'Session ' + new Date().toLocaleDateString();
    const targetLabel = saveTarget.options[saveTarget.selectedIndex].text;

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: currentSession.type || 'manual',
      url: currentSession.url || '',
      target: target,
      targetLabel: targetLabel,
      label: label,
      transcript: text,
      savedAt: Date.now(),
      charCount: text.length
    };

    const saved = loadSaved();
    saved.unshift(entry);
    saveSaved(saved);

    showSaveFeedback(`Saved to "${targetLabel}" as "${label}"`, '#2D8659');
    saveLabel.value = '';
    renderSavedList();
  });

  // --- Storage helpers ---
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
  }
  function saveSaved(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // --- Render saved transcripts ---
  function renderSavedList() {
    const saved = loadSaved();
    savedItems.innerHTML = '';

    if (!saved.length) {
      savedEmpty.style.display = '';
      return;
    }
    savedEmpty.style.display = 'none';

    saved.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = 'session-saved-card';

      const iconClass = entry.type === 'youtube' ? 'youtube' : entry.type === 'zoom' ? 'zoom' : 'general';
      const iconEmoji = entry.type === 'youtube' ? '&#9654;' : entry.type === 'zoom' ? '&#128247;' : '&#128196;';
      const date = new Date(entry.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      card.innerHTML =
        `<div class="session-saved-card__icon session-saved-card__icon--${iconClass}">${iconEmoji}</div>` +
        `<div class="session-saved-card__info">` +
          `<div class="session-saved-card__title">${escHtml(entry.label)}</div>` +
          `<div class="session-saved-card__meta">${escHtml(entry.targetLabel)} &middot; ${date} &middot; ${entry.charCount.toLocaleString()} chars</div>` +
        `</div>` +
        `<div class="session-saved-card__actions">` +
          `<button data-action="view" data-idx="${idx}" title="View transcript">View</button>` +
          `<button data-action="delete" data-idx="${idx}" class="delete-btn" title="Delete">Del</button>` +
        `</div>`;

      savedItems.appendChild(card);
    });

    // Event delegation for saved card actions
    savedItems.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      const saved = loadSaved();

      if (btn.dataset.action === 'view' && saved[idx]) {
        openTranscriptViewer(saved[idx]);
      } else if (btn.dataset.action === 'delete') {
        if (confirm('Delete this saved transcript?')) {
          saved.splice(idx, 1);
          saveSaved(saved);
          renderSavedList();
        }
      }
    };
  }

  // --- Transcript Viewer (Raw + AI Key Points) ---
  function openTranscriptViewer(entry) {
    // Remove any existing viewer
    const existing = document.getElementById('transcript-viewer-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'transcript-viewer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:#0f1923;border:1px solid #2a3a4a;border-radius:14px;width:100%;max-width:900px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:18px 24px;border-bottom:1px solid #2a3a4a;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
    header.innerHTML = `
      <div>
        <h3 style="margin:0;color:#fff;font-size:1.1rem;">${escHtml(entry.label)}</h3>
        <p style="margin:4px 0 0;color:#888;font-size:0.82rem;">${escHtml(entry.targetLabel)} &middot; ${new Date(entry.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; ${entry.charCount.toLocaleString()} chars</p>
      </div>
      <button id="viewer-close" style="background:none;border:none;color:#888;font-size:1.5rem;cursor:pointer;padding:4px 8px;line-height:1;" title="Close">&times;</button>
    `;

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;border-bottom:1px solid #2a3a4a;flex-shrink:0;';
    tabBar.innerHTML = `
      <button class="viewer-tab active" data-viewer-tab="raw" style="flex:1;padding:12px 16px;background:none;border:none;border-bottom:2px solid #E98300;color:#E98300;font-weight:600;cursor:pointer;font-size:0.95rem;">Raw Transcript</button>
      <button class="viewer-tab" data-viewer-tab="keypoints" style="flex:1;padding:12px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#888;font-weight:600;cursor:pointer;font-size:0.95rem;">AI Key Points</button>
    `;

    // Content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'flex:1;overflow-y:auto;padding:20px 24px;';

    // Raw transcript content
    const rawContent = document.createElement('div');
    rawContent.id = 'viewer-raw';
    rawContent.style.cssText = 'white-space:pre-wrap;font-family:"SF Mono",Monaco,Consolas,monospace;font-size:0.88rem;color:#ddd;line-height:1.7;';
    rawContent.textContent = entry.transcript;

    // Key points content (initially shows loading prompt)
    const keyContent = document.createElement('div');
    keyContent.id = 'viewer-keypoints';
    keyContent.style.cssText = 'display:none;color:#ddd;font-size:0.95rem;line-height:1.7;';
    keyContent.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:2rem;margin-bottom:12px;">🧠</div>
        <p style="color:#ccc;margin:0 0 16px;font-size:1rem;">Extract key learning points, clinical pearls, terminology, and exam questions from this transcript using AI.</p>
        <button id="viewer-analyze-btn" style="padding:12px 28px;background:linear-gradient(135deg,#E98300,#c62828);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">
          Analyze with AI
        </button>
        <p style="color:#666;margin:12px 0 0;font-size:0.8rem;">Powered by Claude &middot; Takes 10-30 seconds</p>
      </div>
    `;

    contentArea.appendChild(rawContent);
    contentArea.appendChild(keyContent);
    panel.appendChild(header);
    panel.appendChild(tabBar);
    panel.appendChild(contentArea);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Tab switching
    tabBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.viewer-tab');
      if (!tab) return;
      const target = tab.dataset.viewerTab;
      tabBar.querySelectorAll('.viewer-tab').forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = '#888';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = '#E98300';
      tab.style.color = '#E98300';
      rawContent.style.display = target === 'raw' ? '' : 'none';
      keyContent.style.display = target === 'keypoints' ? '' : 'none';
    });

    // Close handlers
    document.getElementById('viewer-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    });

    // AI Analyze button
    setTimeout(() => {
      const analyzeBtn = document.getElementById('viewer-analyze-btn');
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => runAIAnalysis(entry, keyContent));
      }
    }, 50);
  }

  // --- AI Analysis Engine ---
  async function runAIAnalysis(entry, container) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div class="ai-spinner" style="width:48px;height:48px;border:3px solid #2a3a4a;border-top-color:#E98300;border-radius:50%;margin:0 auto 16px;animation:aiSpin 1s linear infinite;"></div>
        <p style="color:#E98300;font-weight:600;margin:0 0 8px;">Analyzing transcript with Claude...</p>
        <p style="color:#666;font-size:0.85rem;margin:0;">Extracting key learning points, clinical pearls, and exam questions</p>
      </div>
      <style>@keyframes aiSpin { to { transform: rotate(360deg); } }</style>
    `;

    try {
      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: entry.transcript,
          title: entry.label,
        }),
        signal: AbortSignal.timeout(65000),
      });

      const data = await resp.json();

      if (!data.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      if (data.format === 'text') {
        container.innerHTML = `<div style="white-space:pre-wrap;font-size:0.92rem;line-height:1.7;">${escHtml(data.analysis.rawText)}</div>`;
        return;
      }

      const a = data.analysis;
      container.innerHTML = renderAnalysis(a);

      // Save the analysis back to the entry in localStorage
      const saved = loadSaved();
      const idx = saved.findIndex(s => s.id === entry.id);
      if (idx >= 0) {
        saved[idx].aiAnalysis = a;
        saved[idx].aiAnalyzedAt = Date.now();
        saveSaved(saved);
      }

    } catch (err) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
          <p style="color:#c62828;font-weight:600;margin:0 0 8px;">${escHtml(err.message)}</p>
          <p style="color:#888;font-size:0.85rem;margin:0 0 16px;">This might mean the Anthropic API key needs to be configured in Vercel.</p>
          <button onclick="this.closest('#transcript-viewer-overlay').remove()" style="padding:8px 20px;background:#2a3a4a;color:#ccc;border:none;border-radius:6px;cursor:pointer;">Close</button>
        </div>
      `;
    }
  }

  // --- Render structured AI analysis ---
  function renderAnalysis(a) {
    const sectionStyle = 'margin-bottom:24px;';
    const headingStyle = 'color:#E98300;font-size:1.05rem;font-weight:700;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #2a3a4a;';
    const listStyle = 'margin:0;padding:0 0 0 20px;';
    const liStyle = 'margin-bottom:8px;color:#ddd;';

    let html = '';

    // Summary
    if (a.summary) {
      html += `<div style="${sectionStyle}">
        <h4 style="${headingStyle}">📝 Summary</h4>
        <p style="color:#ccc;line-height:1.7;margin:0;">${escHtml(a.summary)}</p>
      </div>`;
    }

    // Key Learning Points
    if (a.keyPoints?.length) {
      html += `<div style="${sectionStyle}">
        <h4 style="${headingStyle}">🎯 Key Learning Points</h4>
        <ol style="${listStyle}">${a.keyPoints.map(p => `<li style="${liStyle}">${escHtml(p)}</li>`).join('')}</ol>
      </div>`;
    }

    // Clinical Pearls
    if (a.clinicalPearls?.length) {
      html += `<div style="${sectionStyle}">
        <h4 style="${headingStyle}">💎 Clinical Pearls</h4>
        <ul style="${listStyle}">${a.clinicalPearls.map(p => `<li style="${liStyle}">${escHtml(p)}</li>`).join('')}</ul>
      </div>`;
    }

    // Terminology
    if (a.terminology?.length) {
      html += `<div style="${sectionStyle}">
        <h4 style="${headingStyle}">📖 Key Terminology</h4>
        <dl style="margin:0;">
          ${a.terminology.map(t => `
            <dt style="color:#E98300;font-weight:600;margin-bottom:2px;">${escHtml(t.term)}</dt>
            <dd style="color:#ccc;margin:0 0 12px 16px;line-height:1.5;">${escHtml(t.definition)}</dd>
          `).join('')}
        </dl>
      </div>`;
    }

    // Exam Questions
    if (a.examQuestions?.length) {
      html += `<div style="${sectionStyle}">
        <h4 style="${headingStyle}">📋 Potential Exam Questions</h4>
        ${a.examQuestions.map((q, i) => `
          <div style="background:#1a2332;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
            <p style="color:#fff;font-weight:600;margin:0 0 8px;">Q${i + 1}: ${escHtml(q.question)}</p>
            <details style="cursor:pointer;">
              <summary style="color:#E98300;font-size:0.9rem;font-weight:600;">Show Answer</summary>
              <p style="color:#ccc;margin:8px 0 0;line-height:1.5;padding-left:8px;border-left:2px solid #E98300;">${escHtml(q.answer)}</p>
            </details>
          </div>
        `).join('')}
      </div>`;
    }

    return html || '<p style="color:#888;">No analysis data available.</p>';
  }

  // --- Utility helpers ---
  function showError(msg) {
    urlError.textContent = msg;
    urlError.style.display = '';
  }
  function hideError() {
    urlError.style.display = 'none';
  }
  function showTranscriptMessage(msg, color) {
    const el = document.createElement('div');
    el.style.cssText = `padding:0.6rem 1rem;background:${color}15;border-left:3px solid ${color};border-radius:4px;margin-bottom:0.75rem;font-size:0.85rem;color:${color};white-space:pre-line;`;
    el.textContent = msg;
    transcriptText.parentNode.insertBefore(el, transcriptText);
    setTimeout(() => el.remove(), 8000);
  }
  function showSaveFeedback(msg, color) {
    saveFeedback.textContent = msg;
    saveFeedback.style.color = color;
    saveFeedback.style.display = '';
    setTimeout(() => { saveFeedback.style.display = 'none'; }, 5000);
  }
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // Initial render of saved list
  renderSavedList();
}

// --- Initialize All ---
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initFlashcards();
  initQuizzes();
  initChecklists();
  initScrollSpy();
  initMobileNav();
  initCodeRunners();
  initSearch();
  initSessions();
});
