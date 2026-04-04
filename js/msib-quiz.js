/**
 * MSIB Quiz Engine
 * Reads saved notes → generates quiz questions → accepts typed or spoken answers → gives feedback.
 * Uses /api/quiz (Claude) when available, falls back to built-in keyword extractor automatically.
 * Add before </body>: <script src="../../js/msib-quiz.js"></script>
 */
(function () {

  // ─── Course mapping ──────────────────────────────────────────────────────────
  const FILE_MAP = {"molecular-foundations":"BIOC205","clinical-anatomy":"SURG203","embryology":"SURG201","bls":"EMED201","immunology":"IMMU210","genetics":"GENE205","neurobiology":"NEUR208","microbiology":"MICR207","biostats-epi":"BIOS206","behavioral-ethics":"BEHV204","pom1":"POM-I","pom2":"POM-II","pom3":"POM-III","som-cvr":"SOM-I","som-rgh":"SOM-II","som-emw":"SOM-IIB","som-nd":"SOM-IIIA","som-hoid":"SOM-IIIB","internal-medicine":"MED300A","surgery":"SURG300A","pediatrics":"PEDS300A","obgyn":"OBGYN300A","psychiatry":"PSYC300A","neurology":"NENS301A","emergency-medicine":"EMED301A","critical-care":"ANES306A","family-medicine":"FAMMED301A","ambulatory":"MED313A","radiology":"RADL302","pocus":"POCUS303","epidemiology":"EPID304","anesthesia-extended":"ANES305","bioengineering":"SC-BIOENG","biomedical-ethics":"SC-ETHICS","ai-computational":"SC-AICOMP","clinical-research":"SC-CLINRES","community-health":"SC-COMMHEALTH","health-services-policy":"SC-HSPOLICY","molecular-basis":"SC-MOLMED","medical-education":"SC-MEDED"};

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const CSS = `
    #msib-quiz-engine { font-family: var(--font-sans, -apple-system, sans-serif); }

    /* ── Idle state ── */
    .msib-quiz-idle { text-align: center; padding: 32px 20px; }
    .msib-quiz-idle-title { font-size: 1.15em; font-weight: 600; color: #1a1a1a; margin-bottom: 6px; }
    .msib-quiz-idle-sub { font-size: 13px; color: #888; margin-bottom: 24px; }
    .msib-quiz-start-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 28px; background: #8B1A1A; color: #fff;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
    }
    .msib-quiz-start-btn:hover { background: #701515; transform: translateY(-1px); }
    .msib-quiz-start-btn:active { transform: translateY(0); }
    .msib-quiz-no-notes {
      background: #fdf8f4; border: 1px dashed #c9a882; border-radius: 8px;
      padding: 20px 24px; text-align: center; color: #8a7060; font-size: 13px;
    }
    .msib-quiz-no-notes a { color: #8B1A1A; font-weight: 600; }
    .msib-quiz-mode-badge {
      display: inline-block; margin-top: 12px;
      font-size: 11px; padding: 3px 10px; border-radius: 20px;
      background: #f0f0f0; color: #888;
    }
    .msib-quiz-mode-badge.ai { background: #eef6ee; color: #2d7a2d; }

    /* ── Loading state ── */
    .msib-quiz-loading { text-align: center; padding: 48px 20px; }
    .msib-quiz-spinner {
      display: inline-block; width: 36px; height: 36px;
      border: 3px solid #e0dbd5; border-top-color: #8B1A1A;
      border-radius: 50%; animation: msib-spin 0.8s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes msib-spin { to { transform: rotate(360deg); } }
    .msib-quiz-loading-text { font-size: 14px; color: #888; }

    /* ── Question state ── */
    .msib-quiz-progress-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px;
    }
    .msib-quiz-progress-label { font-size: 12px; color: #aaa; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .msib-quiz-score-live { font-size: 12px; color: #666; }
    .msib-quiz-bar-track {
      height: 4px; background: #eee; border-radius: 4px; margin-bottom: 20px;
    }
    .msib-quiz-bar-fill {
      height: 100%; background: #8B1A1A; border-radius: 4px;
      transition: width 0.4s ease;
    }
    .msib-quiz-card {
      background: #fff; border: 1px solid #e8e4df; border-radius: 10px;
      padding: 20px 22px; margin-bottom: 16px;
    }
    .msib-quiz-q-label { font-size: 11px; color: #bbb; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; }
    .msib-quiz-question { font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.5; }
    .msib-quiz-answer-row { display: flex; gap: 8px; align-items: stretch; margin-bottom: 12px; }
    .msib-quiz-answer-input {
      flex: 1; padding: 10px 14px;
      border: 1px solid #ddd; border-radius: 8px;
      font-size: 14px; font-family: inherit; outline: none;
      transition: border-color 0.15s;
    }
    .msib-quiz-answer-input:focus { border-color: #8B1A1A; box-shadow: 0 0 0 2px rgba(139,26,26,0.08); }
    .msib-quiz-mic-btn {
      padding: 0 14px; background: #f5f0eb; border: 1px solid #ddd;
      border-radius: 8px; font-size: 18px; cursor: pointer;
      transition: background 0.15s; flex-shrink: 0;
    }
    .msib-quiz-mic-btn:hover { background: #ede8e2; }
    .msib-quiz-mic-btn.listening { background: #fee; border-color: #f99; animation: msib-pulse 1s ease infinite; }
    @keyframes msib-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
    .msib-quiz-submit-btn {
      width: 100%; padding: 11px; background: #8B1A1A; color: #fff;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .msib-quiz-submit-btn:hover { background: #701515; }
    .msib-quiz-submit-btn:disabled { background: #ccc; cursor: default; }
    .msib-quiz-hint { font-size: 12px; color: #aaa; text-align: center; margin-top: 8px; }

    /* ── Feedback state ── */
    .msib-quiz-feedback-card {
      border-radius: 10px; padding: 18px 20px; margin-bottom: 14px;
    }
    .msib-quiz-feedback-card.correct { background: #f0f9f0; border: 1px solid #a8d5a8; }
    .msib-quiz-feedback-card.incorrect { background: #fdf3f3; border: 1px solid #e8b4b4; }
    .msib-quiz-feedback-verdict {
      font-size: 20px; font-weight: 700; margin-bottom: 6px;
    }
    .correct .msib-quiz-feedback-verdict { color: #2a7a2a; }
    .incorrect .msib-quiz-feedback-verdict { color: #9a2a2a; }
    .msib-quiz-feedback-score { font-size: 12px; margin-bottom: 10px; color: #777; }
    .msib-quiz-feedback-text { font-size: 14px; color: #333; line-height: 1.55; margin-bottom: 10px; }
    .msib-quiz-source-box {
      background: rgba(139,26,26,0.06); border-left: 3px solid #8B1A1A;
      border-radius: 0 6px 6px 0; padding: 10px 14px; margin-top: 10px;
    }
    .msib-quiz-source-label { font-size: 11px; font-weight: 700; color: #8B1A1A; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 4px; }
    .msib-quiz-source-text { font-size: 13px; color: #555; font-style: italic; line-height: 1.5; }
    .msib-quiz-your-answer { font-size: 13px; color: #888; margin-top: 8px; }
    .msib-quiz-next-btn {
      width: 100%; padding: 11px; background: #8B1A1A; color: #fff;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .msib-quiz-next-btn:hover { background: #701515; }

    /* ── Complete state ── */
    .msib-quiz-complete { text-align: center; padding: 32px 20px; }
    .msib-quiz-score-big { font-size: 56px; font-weight: 800; color: #8B1A1A; line-height: 1; }
    .msib-quiz-score-denom { font-size: 22px; color: #ccc; }
    .msib-quiz-complete-emoji { font-size: 36px; margin: 10px 0; }
    .msib-quiz-complete-msg { font-size: 15px; color: #555; margin-bottom: 24px; }
    .msib-quiz-retry-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 28px; background: #8B1A1A; color: #fff;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .msib-quiz-retry-btn:hover { background: #701515; }
  `;

  // ─── localStorage helpers ────────────────────────────────────────────────────
  function loadNotes(courseId) {
    try { return JSON.parse(localStorage.getItem('msib-notes-v1-' + courseId)) || []; }
    catch (e) { return []; }
  }

  // ─── Local question generator (fallback, no API) ─────────────────────────────
  function localGenerate(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const qs = [];

    // Strategy 1: heading + following paragraph
    doc.querySelectorAll('h1,h2,h3').forEach(function (h) {
      const term = h.textContent.trim();
      if (!term || term.length > 80) return;
      let sibling = h.nextElementSibling;
      while (sibling && !sibling.textContent.trim()) sibling = sibling.nextElementSibling;
      const answer = sibling ? sibling.textContent.trim() : '';
      if (answer.length > 15) {
        qs.push({
          question: 'Describe or define: "' + term + '"',
          answer: answer.slice(0, 300),
          explanation: 'This is covered under the "' + term + '" section in your notes.',
          sourceText: answer.slice(0, 120)
        });
      }
    });

    // Strategy 2: bold/strong terms with context
    doc.querySelectorAll('strong, b').forEach(function (el) {
      const term = el.textContent.trim();
      if (term.length < 3 || term.length > 60) return;
      const parent = el.closest('p,li,td') || el.parentElement;
      const ctx = parent ? parent.textContent.trim() : '';
      if (ctx.length > 20) {
        qs.push({
          question: 'What is "' + term + '"?',
          answer: ctx.slice(0, 300),
          explanation: 'From your notes.',
          sourceText: ctx.slice(0, 120)
        });
      }
    });

    // Strategy 3: list items with colon (Term: definition)
    doc.querySelectorAll('li').forEach(function (li) {
      const txt = li.textContent.trim();
      const colon = txt.indexOf(':');
      if (colon > 2 && colon < 60) {
        const term = txt.slice(0, colon).trim();
        const def  = txt.slice(colon + 1).trim();
        if (def.length > 8) {
          qs.push({
            question: 'What is the definition/role of "' + term + '"?',
            answer: def.slice(0, 300),
            explanation: 'From your notes.',
            sourceText: txt.slice(0, 120)
          });
        }
      }
    });

    // Shuffle and cap at 5
    for (var i = qs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = qs[i]; qs[i] = qs[j]; qs[j] = tmp;
    }
    return qs.slice(0, 5);
  }

  // ─── Local answer evaluator (fallback) ──────────────────────────────────────
  function localEvaluate(correctAnswer, studentAnswer) {
    var correct = correctAnswer.toLowerCase().replace(/[^\w\s]/g, '');
    var student = studentAnswer.toLowerCase().replace(/[^\w\s]/g, '');
    var keywords = correct.split(/\s+/).filter(function (w) { return w.length > 4; });
    if (!keywords.length) keywords = correct.split(/\s+/);
    var hits = keywords.filter(function (kw) { return student.includes(kw); });
    var score = keywords.length ? Math.round((hits.length / keywords.length) * 100) : 50;
    var isCorrect = score >= 55;
    return {
      correct: isCorrect,
      score: score,
      feedback: isCorrect
        ? 'Good answer! You covered the key concepts.'
        : 'Not quite — your answer missed some key points.',
      hint: isCorrect ? '' : 'Review: "' + correctAnswer.slice(0, 100) + '..."'
    };
  }

  // ─── API calls ──────────────────────────────────────────────────────────────
  var apiAvailable = null; // null = unknown, true/false = tested

  async function apiGenerate(html) {
    const r = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', notesHtml: html })
    });
    const data = await r.json();
    if (data.fallback) { apiAvailable = false; throw new Error('fallback'); }
    apiAvailable = true;
    return data;
  }

  async function apiEvaluate(question, correctAnswer, studentAnswer) {
    const r = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'evaluate', question, correctAnswer, studentAnswer })
    });
    const data = await r.json();
    if (data.fallback) throw new Error('fallback');
    return data;
  }

  // ─── Speech recognition ──────────────────────────────────────────────────────
  function setupSpeech(input, micBtn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }
    var recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-US';
    var listening = false;

    micBtn.onclick = function () {
      if (listening) { recog.stop(); return; }
      recog.start();
    };
    recog.onstart = function () {
      listening = true;
      micBtn.textContent = '🔴';
      micBtn.title = 'Listening... tap to stop';
      micBtn.classList.add('listening');
    };
    recog.onresult = function (e) {
      input.value = e.results[0][0].transcript;
    };
    recog.onend = function () {
      listening = false;
      micBtn.textContent = '🎤';
      micBtn.title = 'Speak your answer';
      micBtn.classList.remove('listening');
    };
    recog.onerror = function () {
      listening = false;
      micBtn.textContent = '🎤';
      micBtn.classList.remove('listening');
    };
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function scoreEmoji(correct, total) {
    var pct = correct / total;
    if (pct === 1)    return '🏆';
    if (pct >= 0.8)   return '🌟';
    if (pct >= 0.6)   return '👍';
    if (pct >= 0.4)   return '📚';
    return '💪';
  }

  function scoreMsg(correct, total) {
    var pct = correct / total;
    if (pct === 1)    return 'Perfect score! Excellent work.';
    if (pct >= 0.8)   return 'Great job! Almost there.';
    if (pct >= 0.6)   return 'Good effort — review the ones you missed.';
    if (pct >= 0.4)   return 'Keep studying — you\'re making progress.';
    return 'Review your notes and try again — you\'ve got this!';
  }

  // ─── Quiz state machine ──────────────────────────────────────────────────────
  function runQuiz(container, courseId) {
    var notes = loadNotes(courseId);
    var allHTML = notes.map(function (n) { return n.content; }).join('\n');

    // Loading
    container.innerHTML =
      '<div class="msib-quiz-loading">' +
        '<div class="msib-quiz-spinner"></div>' +
        '<div class="msib-quiz-loading-text">Generating your quiz' +
          (apiAvailable !== false ? ' with AI' : '') + '…</div>' +
      '</div>';

    // Generate questions (try API, fall back to local)
    var generatePromise = (apiAvailable === false)
      ? Promise.resolve(null)
      : apiGenerate(allHTML).catch(function () { return null; });

    generatePromise.then(function (apiQuestions) {
      var questions = apiQuestions || localGenerate(allHTML);
      var isAI = !!apiQuestions;

      if (!questions || questions.length === 0) {
        container.innerHTML =
          '<div class="msib-quiz-no-notes">' +
            '⚠️ Couldn\'t generate questions — your notes may be too short. ' +
            'Add more content in the <strong>My Notes</strong> tab and try again.' +
          '</div>';
        return;
      }

      var current = 0;
      var score = 0;

      function showQuestion() {
        var q = questions[current];
        var pct = Math.round((current / questions.length) * 100);

        container.innerHTML =
          '<div id="msib-quiz-engine">' +
            '<div class="msib-quiz-progress-row">' +
              '<span class="msib-quiz-progress-label">Question ' + (current + 1) + ' of ' + questions.length + '</span>' +
              '<span class="msib-quiz-score-live">Score: ' + score + '/' + current + '</span>' +
            '</div>' +
            '<div class="msib-quiz-bar-track"><div class="msib-quiz-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="msib-quiz-card">' +
              '<div class="msib-quiz-q-label">Question</div>' +
              '<div class="msib-quiz-question">' + esc(q.question) + '</div>' +
            '</div>' +
            '<div class="msib-quiz-answer-row">' +
              '<input class="msib-quiz-answer-input" type="text" placeholder="Type your answer here…" autocomplete="off" />' +
              '<button class="msib-quiz-mic-btn" title="Speak your answer">🎤</button>' +
            '</div>' +
            '<button class="msib-quiz-submit-btn">Submit Answer</button>' +
            '<p class="msib-quiz-hint">Press Enter or click Submit · Tap 🎤 to speak</p>' +
          '</div>';

        var input   = container.querySelector('.msib-quiz-answer-input');
        var micBtn  = container.querySelector('.msib-quiz-mic-btn');
        var submitBtn = container.querySelector('.msib-quiz-submit-btn');

        setupSpeech(input, micBtn);
        input.focus();

        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && input.value.trim()) submitBtn.click();
        });

        submitBtn.addEventListener('click', function () {
          var answer = input.value.trim();
          if (!answer) return;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Checking…';
          checkAnswer(q, answer);
        });
      }

      function checkAnswer(q, studentAnswer) {
        var evaluatePromise = (apiAvailable === false)
          ? Promise.resolve(null)
          : apiEvaluate(q.question, q.answer, studentAnswer).catch(function () { return null; });

        evaluatePromise.then(function (apiResult) {
          var result = apiResult || localEvaluate(q.answer, studentAnswer);
          if (result.correct) score++;
          showFeedback(q, studentAnswer, result);
        });
      }

      function showFeedback(q, studentAnswer, result) {
        var isLast = (current === questions.length - 1);
        var cls = result.correct ? 'correct' : 'incorrect';
        var verdict = result.correct ? '✅ Correct!' : '❌ Not quite';
        var nextLabel = isLast ? 'See Final Score →' : 'Next Question →';

        container.innerHTML =
          '<div id="msib-quiz-engine">' +
            '<div class="msib-quiz-progress-row">' +
              '<span class="msib-quiz-progress-label">Question ' + (current + 1) + ' of ' + questions.length + '</span>' +
              '<span class="msib-quiz-score-live">Score: ' + score + '/' + (current + 1) + '</span>' +
            '</div>' +
            '<div class="msib-quiz-bar-track"><div class="msib-quiz-bar-fill" style="width:' + Math.round(((current + 1) / questions.length) * 100) + '%"></div></div>' +

            '<div class="msib-quiz-feedback-card ' + cls + '">' +
              '<div class="msib-quiz-feedback-verdict">' + verdict + '</div>' +
              '<div class="msib-quiz-feedback-score">Confidence: ' + result.score + '%</div>' +
              '<div class="msib-quiz-feedback-text">' + esc(result.feedback) + '</div>' +
              (!result.correct ?
                '<div class="msib-quiz-your-answer">Your answer: <em>' + esc(studentAnswer) + '</em></div>' +
                (result.hint ? '<div class="msib-quiz-source-box"><div class="msib-quiz-source-label">📍 Hint</div><div class="msib-quiz-source-text">' + esc(result.hint) + '</div></div>' : '')
              : '') +
              (q.sourceText ?
                '<div class="msib-quiz-source-box">' +
                  '<div class="msib-quiz-source-label">📖 From your notes</div>' +
                  '<div class="msib-quiz-source-text">' + esc(q.sourceText) + '</div>' +
                '</div>'
              : '') +
            '</div>' +

            '<button class="msib-quiz-next-btn">' + nextLabel + '</button>' +
          '</div>';

        container.querySelector('.msib-quiz-next-btn').addEventListener('click', function () {
          current++;
          if (current < questions.length) {
            showQuestion();
          } else {
            showComplete();
          }
        });
      }

      function showComplete() {
        container.innerHTML =
          '<div id="msib-quiz-engine">' +
            '<div class="msib-quiz-complete">' +
              '<div class="msib-quiz-score-big">' + score + '<span class="msib-quiz-score-denom">/' + questions.length + '</span></div>' +
              '<div class="msib-quiz-complete-emoji">' + scoreEmoji(score, questions.length) + '</div>' +
              '<div class="msib-quiz-complete-msg">' + scoreMsg(score, questions.length) + '</div>' +
              '<button class="msib-quiz-retry-btn">🔄 Try Again</button>' +
            '</div>' +
          '</div>';

        container.querySelector('.msib-quiz-retry-btn').addEventListener('click', function () {
          runQuiz(container, courseId);
        });
      }

      showQuestion();
    });
  }

  // ─── Enhance the Quizzes tab ─────────────────────────────────────────────────
  function enhance(courseId) {
    // Find quizzes tab content by locating the "No quizzes available" message
    // OR an already-injected quiz engine wrapper inside the quiz tab
    var emptyEl = Array.from(document.querySelectorAll('*')).find(function (el) {
      return el.children.length === 0 &&
             el.textContent.trim().indexOf('No quizzes available') === 0;
    });

    // If the engine already exists, find its container and re-render fresh
    var existingEngine = document.getElementById('msib-quiz-engine');
    var quizContainer;
    if (existingEngine) {
      quizContainer = existingEngine.parentElement;
      quizContainer.innerHTML = '';
    } else if (emptyEl) {
      quizContainer = emptyEl.closest('[data-tab-content]') || emptyEl.parentElement;
      if (!quizContainer) return;
      quizContainer.innerHTML = '';
    } else {
      return;
    }

    var notes = loadNotes(courseId);
    var hasNotes = notes.length > 0;

    var wrap = document.createElement('div');
    wrap.id = 'msib-quiz-engine';

    if (!hasNotes) {
      wrap.innerHTML =
        '<div class="msib-quiz-idle">' +
          '<div class="msib-quiz-title">📝 Quiz Me on My Notes</div>' +
          '<div class="msib-quiz-no-notes">' +
            'No saved notes found for this course.<br>' +
            'Go to the <strong>My Notes</strong> tab, paste your notes, and save them — then come back here to quiz yourself.' +
          '</div>' +
        '</div>';
    } else {
      var modeLabel = apiAvailable === false
        ? '<span class="msib-quiz-mode-badge">Keyword mode</span>'
        : '<span class="msib-quiz-mode-badge ai">✨ AI-powered when available</span>';

      wrap.innerHTML =
        '<div class="msib-quiz-idle">' +
          '<div class="msib-quiz-idle-title">📝 Quiz Me on My Notes</div>' +
          '<div class="msib-quiz-idle-sub">' + notes.length + ' saved note' + (notes.length > 1 ? 's' : '') + ' · up to 5 questions generated from your content</div>' +
          '<button class="msib-quiz-start-btn">▶ Start Quiz</button>' +
          modeLabel +
        '</div>';

      wrap.querySelector('.msib-quiz-start-btn').addEventListener('click', function () {
        runQuiz(wrap, courseId);
      });
    }

    quizContainer.appendChild(wrap);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function init() {
    if (!document.getElementById('msib-quiz-styles')) {
      var s = document.createElement('style');
      s.id = 'msib-quiz-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    var filename = window.location.pathname.split('/').pop().replace('.html', '');
    var courseId = FILE_MAP[filename];
    if (!courseId) return;

    enhance(courseId);

    // Re-enhance when Quizzes tab is clicked
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (btn && /quizzes/i.test(btn.textContent)) {
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