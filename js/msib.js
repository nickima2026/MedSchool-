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
});
