/* ============================================
   MSIB.io — Spaced Repetition Engine + Study Streak
   SM-2 algorithm for optimal long-term retention
   ============================================ */

(function() {
  'use strict';

  // ── Storage Keys ──
  var SR_KEY = 'msib-sr-cards';
  var STREAK_KEY = 'msib-study-streak';
  var STATS_KEY = 'msib-study-stats';

  // ── SM-2 Algorithm Defaults ──
  var DEFAULT_EF = 2.5;     // initial easiness factor
  var MIN_EF = 1.3;         // minimum easiness factor
  var INITIAL_INTERVAL = 1; // day

  // ══════════════════════════════════════════
  //  SM-2 Core Algorithm
  // ══════════════════════════════════════════

  /**
   * Process a review. quality: 0-5 (0=blackout, 5=perfect)
   * Returns updated card object.
   */
  function sm2(card, quality) {
    var now = Date.now();
    card.lastReview = now;
    card.totalReviews = (card.totalReviews || 0) + 1;

    if (quality < 3) {
      // Failed — reset repetitions, short interval
      card.repetitions = 0;
      card.interval = INITIAL_INTERVAL;
      card.consecutiveCorrect = 0;
    } else {
      // Passed
      card.consecutiveCorrect = (card.consecutiveCorrect || 0) + 1;
      card.repetitions = (card.repetitions || 0) + 1;

      if (card.repetitions === 1) {
        card.interval = 1;
      } else if (card.repetitions === 2) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.ef);
      }
    }

    // Update easiness factor
    card.ef = card.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (card.ef < MIN_EF) card.ef = MIN_EF;

    // Schedule next review
    card.nextReview = now + card.interval * 86400000; // days to ms

    // Track quality history (last 10)
    if (!card.qualityHistory) card.qualityHistory = [];
    card.qualityHistory.push(quality);
    if (card.qualityHistory.length > 10) card.qualityHistory.shift();

    return card;
  }

  // ══════════════════════════════════════════
  //  Card Storage
  // ══════════════════════════════════════════

  function loadCards() {
    try { return JSON.parse(localStorage.getItem(SR_KEY)) || {}; } catch(e) { return {}; }
  }
  function saveCards(cards) {
    localStorage.setItem(SR_KEY, JSON.stringify(cards));
  }

  /** Add a card to the SR deck. course = slug, front/back = text */
  function addCard(course, front, back) {
    var cards = loadCards();
    var id = 'sr_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    cards[id] = {
      id: id,
      course: course,
      front: front,
      back: back,
      ef: DEFAULT_EF,
      interval: INITIAL_INTERVAL,
      repetitions: 0,
      consecutiveCorrect: 0,
      totalReviews: 0,
      nextReview: Date.now(), // due immediately
      lastReview: null,
      created: Date.now(),
      qualityHistory: []
    };
    saveCards(cards);
    return cards[id];
  }

  /** Import flashcards from a course's existing deck */
  function importDeck(course, cardsArray) {
    var cards = loadCards();
    var imported = 0;
    cardsArray.forEach(function(c) {
      // Check for duplicate by front text + course
      var isDupe = Object.values(cards).some(function(existing) {
        return existing.course === course && existing.front === c.front;
      });
      if (!isDupe) {
        var id = 'sr_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6) + imported;
        cards[id] = {
          id: id, course: course, front: c.front, back: c.back,
          ef: DEFAULT_EF, interval: INITIAL_INTERVAL, repetitions: 0,
          consecutiveCorrect: 0, totalReviews: 0,
          nextReview: Date.now(), lastReview: null, created: Date.now(),
          qualityHistory: []
        };
        imported++;
      }
    });
    saveCards(cards);
    return imported;
  }

  /** Get cards due for review */
  function getDueCards(courseFilter) {
    var cards = loadCards();
    var now = Date.now();
    return Object.values(cards).filter(function(c) {
      if (courseFilter && c.course !== courseFilter) return false;
      return c.nextReview <= now;
    }).sort(function(a, b) {
      return a.nextReview - b.nextReview;
    });
  }

  /** Get stats across all cards */
  function getStats() {
    var cards = loadCards();
    var all = Object.values(cards);
    var now = Date.now();
    var due = all.filter(function(c) { return c.nextReview <= now; });
    var courses = {};
    all.forEach(function(c) {
      if (!courses[c.course]) courses[c.course] = { total: 0, due: 0, mastered: 0 };
      courses[c.course].total++;
      if (c.nextReview <= now) courses[c.course].due++;
      if (c.interval >= 21) courses[c.course].mastered++; // 21+ day interval = mastered
    });
    var mastered = all.filter(function(c) { return c.interval >= 21; }).length;
    return {
      totalCards: all.length,
      dueCards: due.length,
      masteredCards: mastered,
      courses: courses,
      retentionRate: all.length > 0 ? Math.round((mastered / all.length) * 100) : 0
    };
  }

  // ══════════════════════════════════════════
  //  Study Streak Tracker
  // ══════════════════════════════════════════

  function loadStreak() {
    try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { current: 0, best: 0, lastStudyDate: null, history: [] }; }
    catch(e) { return { current: 0, best: 0, lastStudyDate: null, history: [] }; }
  }
  function saveStreak(data) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }

  function getToday() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }
  function getYesterday() {
    var d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Record a study session. Call after any review. */
  function recordStudy(cardsReviewed) {
    var streak = loadStreak();
    var today = getToday();

    if (streak.lastStudyDate === today) {
      // Already studied today — update count
      var todayEntry = streak.history.find(function(h) { return h.date === today; });
      if (todayEntry) {
        todayEntry.cards += cardsReviewed;
        todayEntry.sessions++;
      }
    } else {
      if (streak.lastStudyDate === getYesterday()) {
        streak.current++;
      } else if (streak.lastStudyDate !== today) {
        streak.current = 1; // streak broken, restart
      }
      streak.lastStudyDate = today;
      if (streak.current > streak.best) streak.best = streak.current;

      streak.history.push({ date: today, cards: cardsReviewed, sessions: 1 });
      // Keep last 90 days
      if (streak.history.length > 90) streak.history.shift();
    }

    saveStreak(streak);
    return streak;
  }

  function getStreak() {
    var streak = loadStreak();
    var today = getToday();
    // Check if streak is still alive
    if (streak.lastStudyDate && streak.lastStudyDate !== today && streak.lastStudyDate !== getYesterday()) {
      streak.current = 0; // streak broken
      saveStreak(streak);
    }
    return streak;
  }

  // ══════════════════════════════════════════
  //  Review Session UI
  // ══════════════════════════════════════════

  function startReviewSession(courseFilter) {
    var dueCards = getDueCards(courseFilter);
    if (dueCards.length === 0) {
      alert('No cards due for review! Check back later or add more cards.');
      return;
    }

    var sessionCards = dueCards.slice(0, 50); // max 50 per session
    var currentIdx = 0;
    var sessionResults = { correct: 0, incorrect: 0, total: sessionCards.length };

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'sr-review-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:20px;';

    function renderCard() {
      var card = sessionCards[currentIdx];
      var progress = (currentIdx + 1) + ' / ' + sessionCards.length;
      var isFlipped = false;

      overlay.innerHTML = '<div style="width:100%;max-width:600px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><span style="color:#E98300;font-weight:600;font-size:0.95rem;">' + progress + '</span><span style="color:#888;font-size:0.85rem;">' + (card.course || 'General') + '</span><button id="sr-close" style="background:none;border:none;color:#888;font-size:1.5rem;cursor:pointer;">&times;</button></div>'
        + '<div id="sr-card" style="background:#1a2332;border:1.5px solid #2a3a4a;border-radius:16px;min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;cursor:pointer;transition:all .3s;text-align:center;">'
        + '<p id="sr-label" style="color:#E98300;font-size:0.78rem;font-weight:600;letter-spacing:1px;margin:0 0 16px;text-transform:uppercase;">QUESTION</p>'
        + '<p id="sr-text" style="color:#fff;font-size:1.2rem;line-height:1.6;margin:0;">' + escHtml(card.front) + '</p>'
        + '<p style="color:#555;font-size:0.8rem;margin-top:20px;">Click card to reveal answer</p>'
        + '</div>'
        + '<div id="sr-rating" style="display:none;margin-top:16px;text-align:center;">'
        + '<p style="color:#ccc;margin:0 0 12px;font-size:0.9rem;">How well did you know this?</p>'
        + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
        + '<button class="sr-rate" data-q="1" style="padding:10px 16px;background:#c62828;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9rem;min-width:80px;">Again<br><span style="font-size:0.72rem;opacity:0.8;">1 day</span></button>'
        + '<button class="sr-rate" data-q="3" style="padding:10px 16px;background:#E98300;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9rem;min-width:80px;">Hard<br><span style="font-size:0.72rem;opacity:0.8;">' + Math.max(1, Math.round(card.interval * 0.5)) + 'd</span></button>'
        + '<button class="sr-rate" data-q="4" style="padding:10px 16px;background:#2D8659;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9rem;min-width:80px;">Good<br><span style="font-size:0.72rem;opacity:0.8;">' + Math.max(1, card.interval) + 'd</span></button>'
        + '<button class="sr-rate" data-q="5" style="padding:10px 16px;background:#007C92;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.9rem;min-width:80px;">Easy<br><span style="font-size:0.72rem;opacity:0.8;">' + Math.round(card.interval * card.ef) + 'd</span></button>'
        + '</div></div>'
        + '<div style="margin-top:12px;background:#1a2332;border-radius:8px;overflow:hidden;height:4px;"><div style="height:100%;background:linear-gradient(90deg,#E98300,#2D8659);width:' + Math.round(((currentIdx) / sessionCards.length) * 100) + '%;transition:width .3s;"></div></div>'
        + '</div>';

      // Flip card on click
      document.getElementById('sr-card').addEventListener('click', function() {
        if (isFlipped) return;
        isFlipped = true;
        document.getElementById('sr-label').textContent = 'ANSWER';
        document.getElementById('sr-label').style.color = '#2D8659';
        document.getElementById('sr-text').textContent = card.back;
        document.getElementById('sr-card').style.borderColor = '#2D8659';
        document.getElementById('sr-rating').style.display = '';
      });

      // Close button
      document.getElementById('sr-close').addEventListener('click', function() {
        if (sessionResults.correct + sessionResults.incorrect > 0) {
          recordStudy(sessionResults.correct + sessionResults.incorrect);
          updateDashboard();
        }
        overlay.remove();
      });

      // Rating buttons
      overlay.querySelectorAll('.sr-rate').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var quality = parseInt(btn.dataset.q, 10);
          var cards = loadCards();
          if (cards[card.id]) {
            sm2(cards[card.id], quality);
            saveCards(cards);
          }
          if (quality >= 3) sessionResults.correct++;
          else sessionResults.incorrect++;

          currentIdx++;
          if (currentIdx < sessionCards.length) {
            renderCard();
          } else {
            showSessionComplete(sessionResults);
          }
        });
      });
    }

    function showSessionComplete(results) {
      var pct = Math.round((results.correct / results.total) * 100);
      var streak = recordStudy(results.total);
      overlay.innerHTML = '<div style="text-align:center;max-width:500px;">'
        + '<div style="font-size:3rem;margin-bottom:16px;">' + (pct >= 80 ? '&#127942;' : pct >= 60 ? '&#128170;' : '&#128218;') + '</div>'
        + '<h2 style="color:#fff;margin:0 0 8px;">Session Complete!</h2>'
        + '<p style="color:#ccc;margin:0 0 24px;">' + results.total + ' cards reviewed</p>'
        + '<div style="display:flex;gap:16px;justify-content:center;margin-bottom:24px;">'
        + '<div style="background:#1a2332;border-radius:12px;padding:16px 24px;"><div style="color:#2D8659;font-size:1.8rem;font-weight:700;">' + results.correct + '</div><div style="color:#888;font-size:0.8rem;">Correct</div></div>'
        + '<div style="background:#1a2332;border-radius:12px;padding:16px 24px;"><div style="color:#c62828;font-size:1.8rem;font-weight:700;">' + results.incorrect + '</div><div style="color:#888;font-size:0.8rem;">Again</div></div>'
        + '<div style="background:#1a2332;border-radius:12px;padding:16px 24px;"><div style="color:#E98300;font-size:1.8rem;font-weight:700;">' + pct + '%</div><div style="color:#888;font-size:0.8rem;">Score</div></div>'
        + '</div>'
        + '<div style="background:#1a2332;border-radius:12px;padding:16px;margin-bottom:24px;"><span style="font-size:1.5rem;">&#128293;</span> <span style="color:#E98300;font-weight:700;font-size:1.2rem;">' + streak.current + ' day streak</span><span style="color:#666;font-size:0.85rem;margin-left:8px;">(best: ' + streak.best + ')</span></div>'
        + '<button id="sr-done" style="padding:12px 32px;background:#8C1515;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;">Done</button>'
        + '</div>';

      document.getElementById('sr-done').addEventListener('click', function() {
        overlay.remove();
        updateDashboard();
      });
    }

    document.body.appendChild(overlay);

    // Keyboard support
    document.addEventListener('keydown', function srKey(e) {
      if (!document.getElementById('sr-review-overlay')) {
        document.removeEventListener('keydown', srKey);
        return;
      }
      if (e.key === 'Escape') {
        if (sessionResults.correct + sessionResults.incorrect > 0) {
          recordStudy(sessionResults.correct + sessionResults.incorrect);
          updateDashboard();
        }
        overlay.remove();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        var cardEl = document.getElementById('sr-card');
        if (cardEl) cardEl.click();
      }
      if (e.key >= '1' && e.key <= '4') {
        var qMap = { '1': 1, '2': 3, '3': 4, '4': 5 };
        var btn = overlay.querySelector('.sr-rate[data-q="' + qMap[e.key] + '"]');
        if (btn) btn.click();
      }
    });

    renderCard();
  }

  // ══════════════════════════════════════════
  //  Dashboard Rendering
  // ══════════════════════════════════════════

  function updateDashboard() {
    var stats = getStats();
    var streak = getStreak();

    // Update streak display
    var streakNum = document.getElementById('streak-number');
    var streakBest = document.getElementById('streak-best');
    if (streakNum) streakNum.textContent = streak.current;
    if (streakBest) streakBest.textContent = 'Best: ' + streak.best;

    // Update due cards
    var dueNum = document.getElementById('sr-due-number');
    if (dueNum) dueNum.textContent = stats.dueCards;

    // Update total / mastered
    var totalNum = document.getElementById('sr-total-number');
    var masteredNum = document.getElementById('sr-mastered-number');
    if (totalNum) totalNum.textContent = stats.totalCards;
    if (masteredNum) masteredNum.textContent = stats.masteredCards;

    // Update retention bar
    var retBar = document.getElementById('sr-retention-bar');
    var retPct = document.getElementById('sr-retention-pct');
    if (retBar) retBar.style.width = stats.retentionRate + '%';
    if (retPct) retPct.textContent = stats.retentionRate + '%';

    // Update course breakdown
    var courseList = document.getElementById('sr-course-breakdown');
    if (courseList) {
      var courseNames = {
        'general': 'General', 'molecular-foundations': 'Molecular Foundations',
        'clinical-anatomy': 'Clinical Anatomy', 'embryology': 'Embryology',
        'immunology': 'Immunology', 'genetics': 'Genetics',
        'neurobiology': 'Neurobiology', 'microbiology': 'Microbiology',
        'biostats-epi': 'Biostatistics', 'behavioral-ethics': 'Behavioral Science',
        'internal-medicine': 'Internal Medicine', 'surgery': 'Surgery',
        'pediatrics': 'Pediatrics', 'obgyn': 'OB/GYN',
        'psychiatry': 'Psychiatry', 'neurology': 'Neurology',
        'emergency-medicine': 'Emergency Med', 'radiology': 'Radiology'
      };
      var entries = Object.entries(stats.courses).sort(function(a, b) { return b[1].due - a[1].due; });
      if (entries.length === 0) {
        courseList.innerHTML = '<p style="color:#9EA8B4;font-size:0.85rem;text-align:center;padding:1rem;">No cards yet. Add flashcards from any course to start spaced repetition.</p>';
      } else {
        courseList.innerHTML = entries.map(function(e) {
          var slug = e[0], data = e[1];
          var name = courseNames[slug] || slug;
          var pct = data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0;
          return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid #F0EDE8;">'
            + '<div style="flex:1;min-width:0;"><div style="font-size:0.85rem;font-weight:600;color:#2E4057;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(name) + '</div>'
            + '<div style="font-size:0.75rem;color:#9EA8B4;">' + data.total + ' cards &middot; ' + data.mastered + ' mastered</div></div>'
            + (data.due > 0 ? '<span style="background:#FFF3E0;color:#E98300;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:10px;">' + data.due + ' due</span>' : '<span style="color:#2D8659;font-size:0.75rem;">&#10003;</span>')
            + '</div>';
        }).join('');
      }
    }

    // Heatmap (last 30 days)
    var heatmap = document.getElementById('sr-heatmap');
    if (heatmap) {
      var history = streak.history || [];
      var cells = [];
      for (var i = 29; i >= 0; i--) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var dateStr = d.toISOString().slice(0, 10);
        var entry = history.find(function(h) { return h.date === dateStr; });
        var cards = entry ? entry.cards : 0;
        var intensity = cards === 0 ? 0 : cards < 10 ? 1 : cards < 25 ? 2 : cards < 50 ? 3 : 4;
        var colors = ['#F0EDE8', '#C8E6C9', '#81C784', '#4CAF50', '#2E7D32'];
        var dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
        cells.push('<div title="' + dateStr + ': ' + cards + ' cards" style="width:14px;height:14px;border-radius:2px;background:' + colors[intensity] + ';"></div>');
      }
      heatmap.innerHTML = cells.join('');
    }
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ══════════════════════════════════════════
  //  Wire Up Buttons & Initialize
  // ══════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function() {
    // Start review button
    var reviewBtn = document.getElementById('sr-start-review');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function() { startReviewSession(null); });
    }

    // Add sample cards button (for first-time users)
    var addSampleBtn = document.getElementById('sr-add-sample');
    if (addSampleBtn) {
      addSampleBtn.addEventListener('click', function() {
        var samples = [
          { course: 'clinical-anatomy', front: 'What are the branches of the aortic arch (from right to left)?', back: 'Brachiocephalic trunk, Left common carotid artery, Left subclavian artery' },
          { course: 'clinical-anatomy', front: 'What nerve innervates the diaphragm?', back: 'Phrenic nerve (C3, C4, C5 — "C3, 4, 5 keeps the diaphragm alive")' },
          { course: 'immunology', front: 'What is the difference between MHC class I and class II?', back: 'MHC I: on all nucleated cells, presents to CD8+ T cells. MHC II: on APCs only, presents to CD4+ T cells.' },
          { course: 'microbiology', front: 'What organism causes pseudomembranous colitis?', back: 'Clostridioides difficile (C. diff) — often triggered by broad-spectrum antibiotic use' },
          { course: 'molecular-foundations', front: 'What enzyme unwinds DNA during replication?', back: 'Helicase — breaks hydrogen bonds between base pairs at the replication fork' },
          { course: 'biostats-epi', front: 'What is the difference between sensitivity and specificity?', back: 'Sensitivity: true positive rate (TP/TP+FN) — rules OUT disease (SnNOut). Specificity: true negative rate (TN/TN+FP) — rules IN disease (SpPIn).' },
          { course: 'genetics', front: 'What is Hardy-Weinberg equilibrium?', back: 'p² + 2pq + q² = 1. Allele frequencies remain constant if: no mutation, random mating, no selection, no migration, large population.' },
          { course: 'neurobiology', front: 'What neurotransmitter is depleted in Parkinson disease?', back: 'Dopamine — specifically in the substantia nigra pars compacta' },
          { course: 'behavioral-ethics', front: 'What are the 4 principles of medical ethics?', back: 'Autonomy, Beneficence, Non-maleficence, Justice' },
          { course: 'embryology', front: 'From which germ layer does the nervous system develop?', back: 'Ectoderm — specifically the neural plate → neural tube (neurulation)' }
        ];
        var count = 0;
        samples.forEach(function(s) {
          var cards = loadCards();
          var exists = Object.values(cards).some(function(c) { return c.front === s.front; });
          if (!exists) { addCard(s.course, s.front, s.back); count++; }
        });
        if (count > 0) {
          addSampleBtn.textContent = count + ' cards added!';
          addSampleBtn.disabled = true;
          setTimeout(function() { addSampleBtn.textContent = 'Add Sample Cards'; addSampleBtn.disabled = false; }, 2000);
        } else {
          addSampleBtn.textContent = 'Already added';
          setTimeout(function() { addSampleBtn.textContent = 'Add Sample Cards'; }, 2000);
        }
        updateDashboard();
      });
    }

    // Initial render
    updateDashboard();
  });

  // Export for use by other modules
  window.MSIB_SR = {
    addCard: addCard,
    importDeck: importDeck,
    getDueCards: getDueCards,
    getStats: getStats,
    getStreak: getStreak,
    startReview: startReviewSession,
    updateDashboard: updateDashboard,
    recordStudy: recordStudy
  };

})();
