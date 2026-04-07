// ============================================================================
// MATCH PORTAL JAVASCRIPT - PART 2
// Tab switching, profile form, program search, ROL management, analysis, simulator
// ============================================================================

// ============================================================================
// 1. TAB SWITCHING
// ============================================================================
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('[data-tab-content]');

  // Hide all tab contents initially
  tabContents.forEach(content => {
    content.style.display = 'none';
  });

  // Show profile tab by default
  const profileTab = document.querySelector('[data-tab-content="profile"]');
  if (profileTab) {
    profileTab.style.display = 'block';
  }

  // Add click handlers to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Hide all tab contents
      tabContents.forEach(content => {
        content.style.display = 'none';
      });

      // Remove active class from all buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });

      // Show selected tab content
      const selectedTab = document.querySelector(`[data-tab-content="${tabName}"]`);
      if (selectedTab) {
        selectedTab.style.display = 'block';
      }

      // Add active class to clicked button
      button.classList.add('active');

      // Re-render content for specific tabs
      if (tabName === 'search') {
        renderProgramSearch();
      } else if (tabName === 'dream-sheet') {
        renderROL();
      } else if (tabName === 'analysis') {
        renderAnalysis();
      } else if (tabName === 'simulator') {
        renderSimulator();
      }
    });
  });

  // Set initial active tab to profile
  const profileButton = document.querySelector('[data-tab="profile"]');
  if (profileButton) {
    profileButton.classList.add('active');
  }
}

// ============================================================================
// 2. PROFILE FORM HANDLERS
// ============================================================================
function initProfileForm() {
  const profileForm = document.getElementById('profileForm');
  const imgCheckbox = document.getElementById('img');
  const visaField = document.getElementById('visaField');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  if (!profileForm) return;

  // Show/hide visa field based on IMG checkbox
  if (imgCheckbox) {
    imgCheckbox.addEventListener('change', () => {
      if (visaField) {
        visaField.style.display = imgCheckbox.checked ? 'block' : 'none';
      }
    });

    // Initialize visa field visibility
    if (visaField) {
      visaField.style.display = imgCheckbox.checked ? 'block' : 'none';
    }
  }

  // Save Profile button handler
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      // Read form inputs
      const medicalSchool = document.getElementById('medicalSchool').value.trim();
      const step1 = parseFloat(document.getElementById('step1').value) || 0;
      const step2 = parseFloat(document.getElementById('step2').value) || 0;
      const step3 = parseFloat(document.getElementById('step3').value) || 0;
      const publications = parseInt(document.getElementById('publications').value) || 0;
      const researchMonths = parseInt(document.getElementById('researchMonths').value) || 0;
      const targetSpecialty = document.getElementById('targetSpecialty').value;
      const isImg = imgCheckbox.checked;
      const visaRequired = document.getElementById('visaRequired').checked;
      const geographicPreference = document.getElementById('geographicPreference').value.trim();

      // Validate required fields
      if (!medicalSchool || !targetSpecialty) {
        alert('Please fill in all required fields');
        return;
      }

      // Update state
      state.profile = {
        medicalSchool,
        step1,
        step2,
        step3,
        publications,
        researchMonths,
        targetSpecialty,
        isImg,
        visaRequired,
        geographicPreference
      };

      // Save to localStorage
      localStorage.setItem('matchPortalProfile', JSON.stringify(state.profile));

      // Render profile summary
      renderProfileSummary();

      // Enable other tabs
      const tabButtons = document.querySelectorAll('.tab');
      tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') !== 'profile') {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
      });

      alert('Profile saved successfully!');
    });
  }

  // Load profile from localStorage if available
  const savedProfile = localStorage.getItem('matchPortalProfile');
  if (savedProfile) {
    state.profile = JSON.parse(savedProfile);
    populateFormFromState();
  }
}

// Helper function to populate form fields from state
function populateFormFromState() {
  if (!state.profile) return;

  const fields = {
    'medicalSchool': 'medicalSchool',
    'step1': 'step1',
    'step2': 'step2',
    'step3': 'step3',
    'publications': 'publications',
    'researchMonths': 'researchMonths',
    'targetSpecialty': 'targetSpecialty',
    'img': 'isImg',
    'visaRequired': 'visaRequired',
    'geographicPreference': 'geographicPreference'
  };

  for (const [elementId, stateProp] of Object.entries(fields)) {
    const element = document.getElementById(elementId);
    if (element && state.profile[stateProp] !== undefined) {
      if (element.type === 'checkbox') {
        element.checked = state.profile[stateProp];
      } else {
        element.value = state.profile[stateProp];
      }
    }
  }

  // Show/hide visa field
  const visaField = document.getElementById('visaField');
  const imgCheckbox = document.getElementById('img');
  if (visaField && imgCheckbox) {
    visaField.style.display = imgCheckbox.checked ? 'block' : 'none';
  }
}

// ============================================================================
// 3. PROGRAM SEARCH & FILTER
// ============================================================================
function renderProgramSearch() {
  const searchContainer = document.getElementById('programSearchContainer');
  if (!searchContainer) return;

  const specialty = state.profile.targetSpecialty;
  const filteredBySpecialty = PROGRAMS.filter(p => p.specialty === specialty);

  let html = `
    <div class="search-controls">
      <input type="text" id="searchInput" placeholder="Search by program name, city, or state" class="search-input">
    </div>
    <div id="searchResults" class="search-results">
  `;

  if (filteredBySpecialty.length === 0) {
    html += '<p>No programs found for this specialty.</p>';
  } else {
    filteredBySpecialty.forEach(program => {
      const fitScore = calculateFitScore(program);
      const fitColor = fitScore >= 80 ? '#22c55e' : fitScore >= 60 ? '#f59e0b' : '#ef4444';

      html += `
        <div class="search-result-card" data-program-id="${program.id}">
          <div class="result-header">
            <div class="result-info">
              <h4>${program.name}</h4>
              <p>${program.city}, ${program.state}</p>
            </div>
            <div class="fit-badge" style="background-color: ${fitColor}">
              ${fitScore.toFixed(0)}
            </div>
          </div>
          <button class="btn-add-to-rol" data-program-id="${program.id}">Add to ROL</button>
        </div>
      `;
    });
  }

  html += '</div>';
  searchContainer.innerHTML = html;

  // Search input event listener
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('.search-result-card');

      cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
      });
    });
  }

  // Add to ROL button handlers
  const addBtns = document.querySelectorAll('.btn-add-to-rol');
  addBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const programId = btn.getAttribute('data-program-id');
      const program = PROGRAMS.find(p => p.id === programId);

      if (program && !state.rol.some(p => p.id === programId)) {
        state.rol.push(program);
        state.rolOrder.push(programId);
        localStorage.setItem('matchPortalROL', JSON.stringify(state.rol));
        renderProgramSearch(); // Re-render to update button state
        alert(`${program.name} added to your ROL!`);
      } else if (state.rol.some(p => p.id === programId)) {
        alert('This program is already in your ROL!');
      }
    });
  });
}

// ============================================================================
// 4. RANK ORDER LIST (DREAM SHEET) RENDERER
// ============================================================================
function renderROL() {
  const rolContainer = document.getElementById('rolContainer');
  if (!rolContainer) return;

  if (state.rol.length === 0) {
    rolContainer.innerHTML = '<p>No programs added yet. Use the Search tab to add programs.</p>';
    return;
  }

  // Calculate cumulative match probability for safety floor
  let cumulativeProbability = 0;
  let safetyFloorIndex = -1;

  for (let i = 0; i < state.rol.length; i++) {
    const prob = calculateMatchProbability(state.rol[i]);
    cumulativeProbability += prob;
    if (cumulativeProbability > 0.95 && safetyFloorIndex === -1) {
      safetyFloorIndex = i;
    }
  }

  // Render drag-and-drop cards
  let html = '<div id="rolCards" class="rol-cards">';

  state.rol.forEach((program, index) => {
    const fitScore = calculateFitScore(program);
    const fitColor = fitScore >= 80 ? '#22c55e' : fitScore >= 60 ? '#f59e0b' : '#ef4444';
    const isSignaled = state.signals.has(program.id);

    html += `
      <div class="rol-card" draggable="true" data-program-id="${program.id}" data-rank="${index}">
        <div class="rol-rank">${index + 1}</div>
        <div class="rol-info">
          <h4>${program.name}</h4>
          <p>${program.city}, ${program.state}</p>
        </div>
        <div class="rol-fit-score" style="background-color: ${fitColor}">
          ${fitScore.toFixed(0)}
        </div>
        <button class="signal-toggle ${isSignaled ? 'signaled' : ''}" data-program-id="${program.id}" title="Toggle signal (max 5)">
          ⭐
        </button>
        <button class="btn-remove-rol" data-program-id="${program.id}">×</button>
        ${index === safetyFloorIndex ? '<div class="safety-floor-marker">Safety Floor</div>' : ''}
      </div>
    `;
  });

  html += '</div>';

  // Add progress bar
  const avgFitScore = state.rol.reduce((sum, p) => sum + calculateFitScore(p), 0) / state.rol.length;
  const avgMatchProb = state.rol.reduce((sum, p) => sum + calculateMatchProbability(p), 0) / state.rol.length;

  html += `
    <div class="rol-stats">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${(state.rol.length / 30) * 100}%"></div>
        <span>${state.rol.length}/30 programs</span>
      </div>
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">Total Ranked</span>
          <span class="stat-value">${state.rol.length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg Fit Score</span>
          <span class="stat-value">${avgFitScore.toFixed(0)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Match Probability</span>
          <span class="stat-value">${(avgMatchProb * 100).toFixed(0)}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Signals</span>
          <span class="stat-value">${state.signals.size}/5</span>
        </div>
      </div>
    </div>
  `;

  rolContainer.innerHTML = html;

  // Drag and drop handlers
  const cards = document.querySelectorAll('.rol-card');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', card.innerHTML);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      const draggedCard = document.querySelector('.dragging');
      if (draggedCard && draggedCard !== card) {
        const draggedIndex = parseInt(draggedCard.getAttribute('data-rank'));
        const targetIndex = parseInt(card.getAttribute('data-rank'));

        // Reorder in state
        const [movedProgram] = state.rol.splice(draggedIndex, 1);
        state.rol.splice(targetIndex, 0, movedProgram);
        state.rolOrder = state.rol.map(p => p.id);

        localStorage.setItem('matchPortalROL', JSON.stringify(state.rol));
        renderROL();
      }
    });
  });

  // Remove button handlers
  const removeBtns = document.querySelectorAll('.btn-remove-rol');
  removeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const programId = btn.getAttribute('data-program-id');
      state.rol = state.rol.filter(p => p.id !== programId);
      state.rolOrder = state.rol.map(p => p.id);
      state.signals.delete(programId);
      localStorage.setItem('matchPortalROL', JSON.stringify(state.rol));
      renderROL();
    });
  });

  // Signal toggle handlers
  const signalBtns = document.querySelectorAll('.signal-toggle');
  signalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const programId = btn.getAttribute('data-program-id');
      toggleSignal(programId);
    });
  });
}

// ============================================================================
// 5. SIGNAL TOGGLE
// ============================================================================
function toggleSignal(programId) {
  if (state.signals.has(programId)) {
    state.signals.delete(programId);
  } else {
    if (state.signals.size >= 5) {
      alert('Maximum 5 signals allowed');
      return;
    }
    state.signals.add(programId);
  }

  localStorage.setItem('matchPortalSignals', JSON.stringify(Array.from(state.signals)));
  renderROL();
}

// ============================================================================
// 6. PROGRAM DETAILS PANEL
// ============================================================================
function renderProgramDetails(programId) {
  const detailsPanel = document.getElementById('programDetailsPanel');
  if (!detailsPanel) return;

  const program = PROGRAMS.find(p => p.id === programId);
  if (!program) return;

  const fitScore = calculateFitScore(program);
  const fitColor = fitScore >= 80 ? '#22c55e' : fitScore >= 60 ? '#f59e0b' : '#ef4444';

  // Calculate strengths and gaps
  const profileStep2 = state.profile.step2 || 0;
  const profilePubs = state.profile.publications || 0;
  const profileResearch = state.profile.researchMonths || 0;

  const strengths = [];
  const gaps = [];

  if (profileStep2 >= program.avgStep2) strengths.push('Strong Step 2 score');
  else gaps.push('Step 2 score below program average');

  if (profilePubs >= 3) strengths.push('Solid publication record');
  else gaps.push('Limited publications');

  if (profileResearch >= 12) strengths.push('Extensive research experience');
  else gaps.push('Limited research time');

  const tierTier = program.tier === 'T1' ? 'Tier 1 (Top)' :
                   program.tier === 'T2' ? 'Tier 2 (Mid)' : 'Tier 3 (Bottom)';

  let html = `
    <div class="program-details">
      <h3>${program.name}</h3>
      <p class="program-location">${program.city}, ${program.state}</p>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tier</span>
          <span class="detail-value">${tierTier}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">IMG-Friendly</span>
          <span class="detail-value">${program.imgFriendly ? 'Yes' : 'No'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Avg Step 2</span>
          <span class="detail-value">${program.avgStep2}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Avg Publications</span>
          <span class="detail-value">${program.avgPublications}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Interview Rate</span>
          <span class="detail-value">${program.interviewRate}%</span>
        </div>
      </div>

      <div class="fit-score-section">
        <h4>Fit Score: <span style="color: ${fitColor}; font-size: 1.2em;">${fitScore.toFixed(0)}</span></h4>
        <div class="color-gauge">
          <div class="gauge-segment" style="background-color: #ef4444; width: 33%;"></div>
          <div class="gauge-segment" style="background-color: #f59e0b; width: 33%;"></div>
          <div class="gauge-segment" style="background-color: #22c55e; width: 34%;"></div>
        </div>
      </div>

      <div class="details-analysis">
        <h4>Strengths</h4>
        <ul class="strengths-list">
          ${strengths.map(s => `<li style="color: #22c55e;">✓ ${s}</li>`).join('')}
        </ul>

        <h4>Gaps</h4>
        <ul class="gaps-list">
          ${gaps.map(g => `<li style="color: #ef4444;">✗ ${g}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  detailsPanel.innerHTML = html;
}

// ============================================================================
// 7. RADAR CHART (CANVAS)
// ============================================================================
function drawRadarChart(programId) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;

  const program = PROGRAMS.find(p => p.id === programId);
  if (!program) return;

  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(centerX, centerY) - 40;

  // Axes: Academic, Scholarly, Institutional, Holistic, Geographic
  const axes = ['Academic', 'Scholarly', 'Institutional', 'Holistic', 'Geographic'];
  const studentData = [
    state.profile.step2 / 260 * 100,
    Math.min(state.profile.publications * 20, 100),
    state.profile.researchMonths / 24 * 100,
    75, // Holistic placeholder
    state.profile.geographicPreference ? 80 : 40
  ];

  const programData = [
    program.avgStep2 / 260 * 100,
    Math.min(program.avgPublications * 20, 100),
    70, // Institutional placeholder
    80,
    75
  ];

  const angleSlice = (Math.PI * 2) / axes.length;

  // Draw grid (3 concentric pentagons)
  const gridLevels = [0.33, 0.66, 1];
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;

  gridLevels.forEach(level => {
    ctx.beginPath();
    for (let i = 0; i < axes.length; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const x = centerX + (maxRadius * level) * Math.cos(angle);
      const y = centerY + (maxRadius * level) * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // Draw axis lines
  ctx.strokeStyle = '#ccc';
  axes.forEach((axis, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = centerX + maxRadius * Math.cos(angle);
    const y = centerY + maxRadius * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  // Draw student polygon (blue)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  studentData.forEach((value, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw program polygon (red)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  programData.forEach((value, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw axis labels
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  axes.forEach((label, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const labelRadius = maxRadius + 20;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);
    ctx.fillText(label, x, y);
  });

  // Draw legend
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
  ctx.fillRect(20, canvas.height - 35, 12, 12);
  ctx.fillStyle = '#333';
  ctx.fillText('You', 35, canvas.height - 29);

  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.fillRect(120, canvas.height - 35, 12, 12);
  ctx.fillStyle = '#333';
  ctx.fillText('Program Average', 135, canvas.height - 29);
}

// ============================================================================
// 8. FIT SCORE BREAKDOWN
// ============================================================================
function renderFitBreakdown(programId) {
  const breakdownContainer = document.getElementById('fitBreakdownContainer');
  if (!breakdownContainer) return;

  const program = PROGRAMS.find(p => p.id === programId);
  if (!program) return;

  // Score components
  const profileStep2 = state.profile.step2 || 0;
  const profilePubs = state.profile.publications || 0;
  const profileResearch = state.profile.researchMonths || 0;

  const step2Score = Math.min((profileStep2 / program.avgStep2) * 100, 100);
  const pubsScore = Math.min((profilePubs / program.avgPublications) * 100, 100);
  const researchScore = Math.min((profileResearch / 24) * 100, 100);
  const tierScore = program.tier === 'T1' ? 100 : program.tier === 'T2' ? 80 : 60;

  const components = [
    { label: 'Step 2 Score', value: step2Score },
    { label: 'Publications', value: pubsScore },
    { label: 'Research Experience', value: researchScore },
    { label: 'Program Tier', value: tierScore }
  ];

  let html = '<div class="fit-breakdown">';

  components.forEach(comp => {
    const color = comp.value >= 80 ? '#22c55e' : comp.value >= 60 ? '#f59e0b' : '#ef4444';
    html += `
      <div class="breakdown-item">
        <div class="breakdown-label">${comp.label}</div>
        <div class="breakdown-bar-container">
          <div class="breakdown-bar" style="width: ${comp.value}%; background-color: ${color};"></div>
        </div>
        <div class="breakdown-value">${comp.value.toFixed(0)}</div>
      </div>
    `;
  });

  html += '</div>';
  breakdownContainer.innerHTML = html;
}

// ============================================================================
// 9. RECOMMENDATIONS
// ============================================================================
function renderRecommendations(programId) {
  const recsContainer = document.getElementById('recommendationsContainer');
  if (!recsContainer) return;

  const program = PROGRAMS.find(p => p.id === programId);
  if (!program) return;

  const profileStep2 = state.profile.step2 || 0;
  const profilePubs = state.profile.publications || 0;

  const strengths = [];
  const gaps = [];
  const tips = [];

  // Analyze strengths
  if (profileStep2 >= program.avgStep2) {
    strengths.push('Your Step 2 score matches or exceeds the program average');
  }
  if (profilePubs >= program.avgPublications) {
    strengths.push('You have strong publication activity');
  }
  if (program.imgFriendly && state.profile.isImg) {
    strengths.push('You\'re an IMG and this program is IMG-friendly');
  }

  // Analyze gaps
  if (profileStep2 < program.avgStep2) {
    gaps.push(`Step 2 score ${profileStep2} is below program avg of ${program.avgStep2}`);
  }
  if (profilePubs < program.avgPublications) {
    gaps.push(`Your ${profilePubs} publications are below program avg of ${program.avgPublications}`);
  }
  if (!program.imgFriendly && state.profile.isImg) {
    gaps.push('This program is less IMG-friendly');
  }

  // Tips
  tips.push('Highlight your research involvement and any clinical experience');
  tips.push('Emphasize why you\'re interested in this specific program');
  tips.push('Reach out to residents at this program for insight into their culture');

  let html = `
    <div class="recommendations">
      <div class="rec-section">
        <h4 style="color: #22c55e;">Strengths</h4>
        <ul style="color: #22c55e;">
          ${strengths.length > 0 ? strengths.map(s => `<li>✓ ${s}</li>`).join('') : '<li>Keep building your profile</li>'}
        </ul>
      </div>

      <div class="rec-section">
        <h4 style="color: #ef4444;">Gaps</h4>
        <ul style="color: #ef4444;">
          ${gaps.length > 0 ? gaps.map(g => `<li>✗ ${g}</li>`).join('') : '<li>No major gaps identified</li>'}
        </ul>
      </div>

      <div class="rec-section">
        <h4 style="color: #3b82f6;">Tips</h4>
        <ul style="color: #3b82f6;">
          ${tips.map(t => `<li>💡 ${t}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  recsContainer.innerHTML = html;
}

// ============================================================================
// 10. ANALYSIS TAB MASTER RENDERER
// ============================================================================
function renderAnalysis() {
  const analysisContainer = document.getElementById('analysisContainer');
  if (!analysisContainer) return;

  if (!state.selectedProgramId) {
    analysisContainer.innerHTML = '<p>Select a program from your Dream Sheet to view detailed analysis.</p>';
    return;
  }

  const program = PROGRAMS.find(p => p.id === state.selectedProgramId);
  if (!program) return;

  let html = `
    <div class="analysis-section">
      <h3>${program.name} - Detailed Analysis</h3>

      <div class="analysis-grid">
        <div class="analysis-card">
          <h4>Profile Comparison</h4>
          <canvas id="radarChart" width="300" height="300"></canvas>
        </div>

        <div class="analysis-card">
          <h4>Component Breakdown</h4>
          <div id="fitBreakdownContainer"></div>
        </div>
      </div>

      <div class="analysis-full-width">
        <h4>Recommendations & Insights</h4>
        <div id="recommendationsContainer"></div>
      </div>
    </div>
  `;

  analysisContainer.innerHTML = html;

  // Render the detailed components
  setTimeout(() => {
    drawRadarChart(state.selectedProgramId);
    renderFitBreakdown(state.selectedProgramId);
    renderRecommendations(state.selectedProgramId);
  }, 0);
}

// ============================================================================
// 11. MONTE CARLO SIMULATOR
// ============================================================================
function runSimulation(iterations) {
  const results = [];
  const programMatches = {};

  for (let iter = 0; iter < iterations; iter++) {
    let matched = false;
    let matchRank = -1;

    for (let i = 0; i < state.rol.length; i++) {
      const program = state.rol[i];
      const fitScore = calculateFitScore(program);

      // Add random noise: ±15%
      const noiseAmount = (Math.random() - 0.5) * 0.3; // -15% to +15%
      const noisyThreshold = program.interviewRate / 100 * (1 + noiseAmount);

      // Match if fit score exceeds noisy threshold
      if (fitScore / 100 > noisyThreshold) {
        matchRank = i + 1;
        matched = true;
        programMatches[program.id] = (programMatches[program.id] || 0) + 1;
        break;
      }
    }

    if (matched) {
      results.push(matchRank);
    }
  }

  // Aggregate statistics
  const matchRate = (results.length / iterations) * 100;
  const top3Rate = (results.filter(r => r <= 3).length / iterations) * 100;
  const top5Rate = (results.filter(r => r <= 5).length / iterations) * 100;
  const medianRank = results.length > 0 ? results[Math.floor(results.length / 2)] : 0;

  // Find mode program
  let modeProgram = null;
  let maxMatches = 0;
  for (const [progId, count] of Object.entries(programMatches)) {
    if (count > maxMatches) {
      maxMatches = count;
      modeProgram = progId;
    }
  }

  state.simResults = {
    iterations,
    matchRate,
    top3Rate,
    top5Rate,
    medianRank,
    modeProgram,
    histogram: results
  };

  return state.simResults;
}

// ============================================================================
// 12. HISTOGRAM CHART
// ============================================================================
function drawHistogram() {
  const canvas = document.getElementById('histogramChart');
  if (!canvas || !state.simResults) return;

  const ctx = canvas.getContext('2d');
  const histogram = state.simResults.histogram;

  // Build frequency map
  const freqMap = {};
  histogram.forEach(rank => {
    freqMap[rank] = (freqMap[rank] || 0) + 1;
  });

  const maxRank = Math.max(...histogram);
  const maxFreq = Math.max(...Object.values(freqMap));

  const barWidth = canvas.width / maxRank;
  const maxBarHeight = canvas.height - 40;

  // Draw bars
  for (let rank = 1; rank <= maxRank; rank++) {
    const freq = freqMap[rank] || 0;
    const barHeight = (freq / maxFreq) * maxBarHeight;

    const x = (rank - 1) * barWidth + 5;
    const y = canvas.height - barHeight - 30;

    // Color bands
    let color;
    if (rank <= 3) color = '#22c55e'; // Green - top 3
    else if (rank <= 5) color = '#3b82f6'; // Blue - top 5
    else if (rank <= 10) color = '#f59e0b'; // Yellow - top 10
    else if (rank <= 20) color = '#f97316'; // Orange
    else color = '#ef4444'; // Red

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth - 2, barHeight);

    // Draw rank label
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(rank, x + barWidth / 2 - 1, canvas.height - 10);
  }

  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, canvas.height - 30);
  ctx.lineTo(canvas.width, canvas.height - 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(30, canvas.height - 30);
  ctx.stroke();

  // Draw labels
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Rank Position', canvas.width / 2, canvas.height - 5);

  ctx.save();
  ctx.translate(10, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Frequency', 0, 0);
  ctx.restore();
}

// ============================================================================
// 13. SIMULATOR TAB RENDERER
// ============================================================================
function renderSimulator() {
  const simContainer = document.getElementById('simulatorContainer');
  if (!simContainer) return;

  if (state.rol.length === 0) {
    simContainer.innerHTML = '<p>Add programs to your Dream Sheet before running simulations.</p>';
    return;
  }

  let html = `
    <div class="simulator-control">
      <h3>Match Probability Simulator</h3>
      <p>Run Monte Carlo simulations to estimate your match probability across your rank list.</p>

      <div class="sim-config">
        <label>
          Number of Iterations:
          <input type="number" id="simIterations" value="1000" min="100" max="10000" step="100">
        </label>
      </div>

      <button id="runSimButton" class="btn-primary">Run Simulation (1000 iterations)</button>
    </div>

    <div id="simLoadingState" style="display: none;">
      <p>Running simulation... Please wait.</p>
    </div>

    <div id="simResultsContainer"></div>
  `;

  simContainer.innerHTML = html;

  // Run simulation button
  const runBtn = document.getElementById('runSimButton');
  const iterInput = document.getElementById('simIterations');

  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const iterations = parseInt(iterInput.value) || 1000;
      runBtn.disabled = true;
      runBtn.innerText = 'Running...';

      const loadingState = document.getElementById('simLoadingState');
      if (loadingState) loadingState.style.display = 'block';

      // Simulate async
      setTimeout(() => {
        const results = runSimulation(iterations);
        displaySimulationResults(results);

        runBtn.disabled = false;
        runBtn.innerText = 'Run Simulation (' + iterations + ' iterations)';
        if (loadingState) loadingState.style.display = 'none';
      }, 100);
    });
  }

  // Update button text
  if (iterInput) {
    iterInput.addEventListener('change', () => {
      runBtn.innerText = 'Run Simulation (' + iterInput.value + ' iterations)';
    });
  }
}

function displaySimulationResults(results) {
  const resultsContainer = document.getElementById('simResultsContainer');
  if (!resultsContainer) return;

  const modeProgram = PROGRAMS.find(p => p.id === results.modeProgram);
  const modeName = modeProgram ? modeProgram.name : 'N/A';

  let html = `
    <div class="sim-results">
      <h4>Simulation Results</h4>
      <div class="results-grid">
        <div class="result-item">
          <span class="result-label">Overall Match Rate</span>
          <span class="result-value">${results.matchRate.toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Top 3 Match Rate</span>
          <span class="result-value">${results.top3Rate.toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Top 5 Match Rate</span>
          <span class="result-value">${results.top5Rate.toFixed(1)}%</span>
        </div>
        <div class="result-item">
          <span class="result-label">Median Rank</span>
          <span class="result-value">${results.medianRank}</span>
        </div>
        <div class="result-item">
          <span class="result-label">Most Likely Match</span>
          <span class="result-value">${modeName}</span>
        </div>
      </div>

      <div class="histogram-container">
        <h4>Distribution of Matches</h4>
        <canvas id="histogramChart" width="600" height="300"></canvas>
      </div>

      <div class="whatif-section">
        <h4>What-If Scenarios</h4>
        <button class="btn-whatif" data-scenario="add_pubs">What if I had +2 publications?</button>
        <button class="btn-whatif" data-scenario="signal_top3">What if I signal top 3?</button>
        <button class="btn-whatif" data-scenario="add_programs">What if I add more programs?</button>
        <div id="whatifResults"></div>
      </div>
    </div>
  `;

  resultsContainer.innerHTML = html;

  // Draw histogram
  setTimeout(() => {
    drawHistogram();
  }, 0);

  // What-if buttons
  const whatifBtns = document.querySelectorAll('.btn-whatif');
  whatifBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const scenario = btn.getAttribute('data-scenario');
      runWhatIf(scenario);
    });
  });
}

// ============================================================================
// 14. WHAT-IF SCENARIOS
// ============================================================================
function runWhatIf(scenario) {
  const whatifResults = document.getElementById('whatifResults');
  if (!whatifResults) return;

  let message = '';

  if (scenario === 'add_pubs') {
    // Temporarily add 2 publications
    const originalPubs = state.profile.publications;
    state.profile.publications += 2;

    const newResults = runSimulation(state.simResults.iterations);
    const improvement = newResults.matchRate - state.simResults.matchRate;

    message = `
      <div class="whatif-result">
        <strong>Scenario: +2 Publications</strong>
        <p>With 2 additional publications:</p>
        <ul>
          <li>Match Rate: ${newResults.matchRate.toFixed(1)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%)</li>
          <li>Top 3 Rate: ${newResults.top3Rate.toFixed(1)}%</li>
          <li>Top 5 Rate: ${newResults.top5Rate.toFixed(1)}%</li>
        </ul>
      </div>
    `;

    // Restore original
    state.profile.publications = originalPubs;

  } else if (scenario === 'signal_top3') {
    // Temporarily signal top 3
    const originalSignals = new Set(state.signals);
    state.signals.clear();
    for (let i = 0; i < Math.min(3, state.rol.length); i++) {
      state.signals.add(state.rol[i].id);
    }

    const newResults = runSimulation(state.simResults.iterations);
    const improvement = newResults.matchRate - state.simResults.matchRate;

    message = `
      <div class="whatif-result">
        <strong>Scenario: Signal Top 3</strong>
        <p>If you signal your top 3 programs:</p>
        <ul>
          <li>Match Rate: ${newResults.matchRate.toFixed(1)}% (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%)</li>
          <li>Top 3 Rate: ${newResults.top3Rate.toFixed(1)}%</li>
          <li>Median Rank: ${newResults.medianRank}</li>
        </ul>
      </div>
    `;

    // Restore original
    state.signals = originalSignals;

  } else if (scenario === 'add_programs') {
    message = `
      <div class="whatif-result">
        <strong>Scenario: Add More Programs</strong>
        <p>You currently have ${state.rol.length} programs ranked.</p>
        <p>Adding 5-10 more programs to your list can:</p>
        <ul>
          <li>Increase overall match probability</li>
          <li>Lower your "safety floor" ranking position</li>
          <li>Provide backup options in competitive markets</li>
        </ul>
        <p>Consider adding programs you're comfortable with below your current list.</p>
      </div>
    `;
  }

  whatifResults.innerHTML = message;
}

// ============================================================================
// 15. INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Load state from localStorage
  const savedROL = localStorage.getItem('matchPortalROL');
  if (savedROL) {
    state.rol = JSON.parse(savedROL);
    state.rolOrder = state.rol.map(p => p.id);
  }

  const savedSignals = localStorage.getItem('matchPortalSignals');
  if (savedSignals) {
    state.signals = new Set(JSON.parse(savedSignals));
  }

  const savedProfile = localStorage.getItem('matchPortalProfile');
  if (savedProfile) {
    state.profile = JSON.parse(savedProfile);
  }

  // Initialize UI
  initTabs();
  initProfileForm();

  // Set default active tab
  const profileTab = document.querySelector('[data-tab-content="profile"]');
  if (profileTab) {
    profileTab.style.display = 'block';
  }

  // Render initial profile summary
  renderProfileSummary();
});
