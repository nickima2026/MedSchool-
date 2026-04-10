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

  // --- Fetch Transcript (YouTube only — uses a proxy-friendly approach) ---
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
      // Call our own Vercel API route to fetch YouTube captions
      const apiUrl = `/api/transcript?v=${currentSession.videoId}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
      const data = await resp.json();

      if (data.ok && data.timestamped) {
        // Show timestamped version by default (more useful for study)
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
        // API returned an error with details
        const hint = data.hint || '';
        throw new Error(data.error || 'No transcript data returned');
      }
    } catch (err) {
      // Fallback message with manual instructions
      transcriptText.value = '';
      const errorDetail = err.message && !err.message.includes('abort')
        ? `Reason: ${err.message}\n\n` : '';
      showTranscriptMessage(
        errorDetail +
        'Try these alternatives to get the transcript:\n' +
        '1. On YouTube, click "..." below the video → "Show transcript" → Copy/paste here\n' +
        '2. Use a transcript tool like tactiq.io or otter.ai\n' +
        '3. Paste your own notes or transcript manually',
        '#E98300'
      );
    }

    fetchTranscriptBtn.disabled = false;
    fetchTranscriptBtn.textContent = 'Fetch Transcript';
  });

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
        transcriptText.value = saved[idx].transcript;
        transcriptArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (btn.dataset.action === 'delete') {
        if (confirm('Delete this saved transcript?')) {
          saved.splice(idx, 1);
          saveSaved(saved);
          renderSavedList();
        }
      }
    };
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
