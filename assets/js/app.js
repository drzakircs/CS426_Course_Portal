/*
 * CS-426 Course Portal
 * -------------------------------------------------------------
 * Repository configuration: update these values after creating
 * the GitHub repository. Do not change other code for materials.
 */
const GITHUB_REPO = 'USERNAME/REPOSITORY';
const GITHUB_BRANCH = 'main';
const MATERIALS_DIR = 'materials';

const COURSE_DATA_PATH = 'data/course.json';
const naturalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const state = {
  courseData: null,
  materials: [],
  materialsByWeek: new Map()
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  removeRawFrontMatterArtifact();
  bindSearchControls();
  bindMaterialViewerActions();

  try {
    const [courseData, materials] = await Promise.all([
      loadCourseData(),
      discoverMaterials()
    ]);

    state.courseData = courseData;
    state.materials = materials;
    state.materialsByWeek = groupMaterialsByWeek(materials, courseData.course.weeks);

    renderCourse(courseData);
    renderWeeklyPlan(courseData.weeklyPlan);
    setupFilenameMarquees();
  } catch (error) {
    console.error(error);
    showFatalError(error);
  }

  const rerunMarquees = debounce(setupFilenameMarquees, 150);
  window.addEventListener('resize', rerunMarquees, { passive: true });
}

async function loadCourseData() {
  const response = await fetch(resolveSitePath(`${COURSE_DATA_PATH}?v=1`), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${COURSE_DATA_PATH} (${response.status}).`);
  }
  return response.json();
}

async function discoverMaterials() {
  const jekyllResult = readJekyllMaterialManifest();

  // A valid Jekyll build is authoritative, including the valid case of zero files.
  if (jekyllResult.builtByJekyll) {
    return normalizeMaterialFiles(jekyllResult.files);
  }

  // Fallback for local/static hosting where Liquid was not processed.
  if (isGitHubRepoConfigured()) {
    try {
      const apiFiles = await fetchMaterialsFromGitHubApi();
      return normalizeMaterialFiles(apiFiles);
    } catch (error) {
      console.warn('GitHub API material discovery failed:', error);
    }
  }

  return [];
}

function readJekyllMaterialManifest() {
  const node = document.getElementById('jekyll-materials');
  if (!node) return { builtByJekyll: false, files: [] };

  const text = node.textContent.trim();
  if (!text || text.includes('{%') || text.includes('{{')) {
    return { builtByJekyll: false, files: [] };
  }

  try {
    const parsed = JSON.parse(text);
    return {
      builtByJekyll: parsed.builtByJekyll === true,
      files: Array.isArray(parsed.files) ? parsed.files : []
    };
  } catch (error) {
    console.warn('Jekyll material manifest could not be parsed:', error);
    return { builtByJekyll: false, files: [] };
  }
}

async function fetchMaterialsFromGitHubApi() {
  const directory = encodeURIComponent(MATERIALS_DIR).replace(/%2F/gi, '/');
  const endpoint = `https://api.github.com/repos/${GITHUB_REPO}/contents/${directory}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/vnd.github+json' }
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}.`);
  }

  const items = await response.json();
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => item.type === 'file' && /\.html?$/i.test(item.name))
    .map(item => ({ name: item.name, path: item.path }));
}

function isGitHubRepoConfigured() {
  return Boolean(
    GITHUB_REPO &&
    GITHUB_REPO.includes('/') &&
    !GITHUB_REPO.includes('USERNAME') &&
    !GITHUB_REPO.includes('REPOSITORY')
  );
}

function normalizeMaterialFiles(files) {
  return files
    .filter(file => file && file.name && file.path && /\.html?$/i.test(file.name))
    .map(file => {
      const week = extractWeekNumber(file.name);
      return {
        name: file.name,
        path: file.path,
        week,
        displayName: makeFriendlyMaterialName(file.name, week)
      };
    })
    .filter(file => Number.isInteger(file.week))
    .sort((a, b) => naturalSort.compare(a.name, b.name));
}

function extractWeekNumber(filename) {
  const base = decodeURIComponent(String(filename));
  const match = base.match(/(?:^|[^a-z0-9])week[\s_-]*0*(\d{1,2})(?=[^0-9]|$)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function makeFriendlyMaterialName(filename, weekNumber) {
  const base = decodeURIComponent(filename).replace(/\.html?$/i, '');
  const match = base.match(/week[\s_-]*0*(\d{1,2})/i);

  let tail = match ? base.slice(match.index + match[0].length) : base;
  tail = tail
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (Number.isInteger(weekNumber)) {
    const weekLabel = `Week${String(weekNumber).padStart(2, '0')}`;
    return tail ? `${weekLabel} ${tail}` : weekLabel;
  }

  return tail || base;
}

function groupMaterialsByWeek(materials, maxWeeks) {
  const map = new Map();
  for (let week = 1; week <= maxWeeks; week += 1) map.set(week, []);

  for (const material of materials) {
    if (material.week >= 1 && material.week <= maxWeeks) {
      map.get(material.week).push(material);
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => naturalSort.compare(a.name, b.name));
  }
  return map;
}

function renderCourse(data) {
  const { course } = data;
  document.title = `${course.code} — ${course.title}`;
  setText('course-title', `${course.code} — ${course.title}`);
  setText('portal-line', `Course Material Portal · ${course.academicYear || 'Academic Session not specified in course guide'}`);
  setText('instructor-name', course.instructor.name);
  setText('instructor-role', `${course.instructor.designation}, ${course.instructor.department}`);
  setText('instructor-campus', course.instructor.campus);
  setText('footer-course', `${course.code} · ${course.title}`);
  setText('course-description', data.description);

  renderCourseOverview(data);
  renderDeliveryFramework(data.deliveryFramework);
  renderReferences(data.references);
  renderClos(data.clos);
  renderAssessments(data.assessments);
}

function renderCourseOverview(data) {
  const { course, assessments } = data;
  const quiz = assessments.components.find(item => item.component.toLowerCase().startsWith('quizzes'));
  const assignment = assessments.components.find(item => item.component.toLowerCase().startsWith('assignments'));
  const mid = assessments.components.find(item => item.component.toLowerCase().startsWith('mid'));
  const finalExam = assessments.components.find(item => item.component.toLowerCase().startsWith('final'));

  const items = [
    ['Course Code', course.code],
    ['Course Title', course.title],
    ['Program', course.program || 'Not specified', course.sourceNotes?.program],
    ['Semester', course.semester || 'Not specified', course.sourceNotes?.semester],
    ['Academic Session', course.academicYear || 'Not specified', course.sourceNotes?.academicYear],
    ['Weeks', `${course.weeks} teaching weeks`],
    ['Total Sessions', `${course.totalSessions} theory sessions`],
    ['Sessions per Week', `${course.sessionsPerWeek} theory sessions`],
    ['Programming Language', course.programmingLanguage || 'Not specified', course.sourceNotes?.programmingLanguage],
    ['Tools / Frameworks', course.tools.join(', ')],
    ['Prerequisite', course.prerequisite],
    ['Quizzes', `${quiz?.component || 'Quizzes'} · ${quiz?.weight || ''}`.replace('Quizzes (4)', '4 quizzes')],
    ['Assignments', `${assignment?.component || 'Assignments'} · ${assignment?.weight || ''}`.replace('Assignments (4)', '4 assignments')],
    ['Mid-Term', `${mid?.weight || ''} · ${course.midSemesterExam}`],
    ['Final Examination', `${finalExam?.weight || ''} · ${course.finalExam}`],
    ['Teaching Mode', course.teachingMode]
  ];

  const container = document.getElementById('course-overview');
  container.innerHTML = items.map(([label, value, note]) => `
    <article class="overview-item">
      <span class="label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${note && value === 'Not specified' ? `<small>${escapeHtml(note)}</small>` : ''}
    </article>
  `).join('');
}

function renderDeliveryFramework(phases) {
  const body = document.getElementById('delivery-framework');
  body.innerHTML = phases.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.phase)}</strong></td>
      <td>${escapeHtml(item.weeks)}</td>
      <td>${escapeHtml(item.coreFocus)}</td>
      <td>${escapeHtml(item.learningProgression)}</td>
    </tr>
  `).join('');
}

function renderReferences(references) {
  const container = document.getElementById('reference-material');
  container.innerHTML = `
    <h4>Primary Textbooks</h4>
    <ol>${references.primaryTextbooks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
    <h4>Reference Books</h4>
    <ul>${references.referenceBooks.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  `;
}

function renderClos(clos) {
  const body = document.getElementById('clo-table-body');
  body.innerHTML = clos.map(item => `
    <tr>
      <td>${escapeHtml(item.clo)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.domain)}</td>
      <td>${escapeHtml(item.taxonomy)}</td>
      <td>${escapeHtml(item.ga)}${item.plo ? ` / ${escapeHtml(item.plo)}` : '<br><small>PLO not specified in source guide</small>'}</td>
    </tr>
  `).join('');
}

function renderAssessments(assessments) {
  const cards = document.getElementById('assessment-cards');
  cards.innerHTML = assessments.components.map(item => `
    <article class="assessment-card">
      <span class="weight">${escapeHtml(item.weight)}</span>
      <span class="component">${escapeHtml(item.component)}</span>
      <span class="management">${escapeHtml(item.management)}</span>
    </article>
  `).join('');

  setText('assessment-protection', assessments.protectionNote);

  const calendar = document.getElementById('assessment-calendar');
  calendar.innerHTML = assessments.calendar.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.item)}</strong></td>
      <td>${escapeHtml(item.plannedSession)}</td>
      <td>${escapeHtml(item.coverage)}</td>
      <td>${escapeHtml(item.release)}</td>
      <td>${escapeHtml(item.dueConduct)}</td>
      <td><strong>${escapeHtml(item.weight)}</strong></td>
    </tr>
  `).join('');
}

function renderWeeklyPlan(weeklyPlan) {
  const grid = document.getElementById('week-grid');
  grid.innerHTML = weeklyPlan.map(week => renderWeekCard(week)).join('');
  refreshWeekSearchIndex();
}

function renderWeekCard(week) {
  const materials = state.materialsByWeek.get(week.week) || [];
  const weekNumber = String(week.week).padStart(2, '0');

  const sessionsHtml = week.sessions.map(session => `
    <div class="session-block">
      <span class="session-label">Session ${escapeHtml(session.session)}</span>
      <p class="session-title">${escapeHtml(session.title)}</p>
      <p class="session-coverage">${escapeHtml(session.coverage)}</p>
      <p class="session-focus"><strong>Learning focus:</strong> ${escapeHtml(session.learningFocus)}</p>
    </div>
  `).join('');

  const assessmentPill = week.assessment && week.assessment !== '—'
    ? `<span class="meta-pill assessment">${escapeHtml(week.assessment)}</span>`
    : '';

  return `
    <article class="week-card" data-week="${week.week}">
      <div class="week-card-header">
        <span class="week-number">WEEK ${weekNumber}</span>
        <h3>${escapeHtml(week.title)}</h3>
      </div>
      <div class="week-card-body">
        <div class="sessions-wrap">${sessionsHtml}</div>
        <div class="week-meta">
          <span class="meta-pill">${escapeHtml(week.clo)}</span>
          ${assessmentPill}
        </div>
        ${renderMaterialsBlock(week.week, materials)}
      </div>
    </article>
  `;
}

function renderMaterialsBlock(week, materials) {
  if (!materials.length) {
    return `
      <div class="materials-block">
        <div class="materials-heading">
          <span>Learning Material</span>
          <span class="material-status">Not uploaded yet</span>
        </div>
      </div>
    `;
  }

  const countText = `${materials.length} ${materials.length === 1 ? 'file' : 'files'}`;
  const rows = materials.map((material, index) => {
    const href = resolveSitePath(material.path);
    return `
      <div class="material-row">
        <span class="material-index">${index + 1}</span>
        <div class="material-name-viewport" title="${escapeHtml(material.displayName)}">
          <span class="material-name-track">${escapeHtml(material.displayName)}</span>
        </div>
        <button
          type="button"
          class="material-action view"
          data-material-view
          data-week="${week}"
          data-name="${escapeHtmlAttr(material.displayName)}"
          data-path="${escapeHtmlAttr(material.path)}"
        >View</button>
        <a class="material-action open" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener">Open</a>
      </div>
    `;
  }).join('');

  return `
    <div class="materials-block">
      <div class="materials-heading">
        <span>Learning Material</span>
        <span class="material-status">${countText}</span>
      </div>
      <div class="material-list">${rows}</div>
    </div>
  `;
}

function bindMaterialViewerActions() {
  const grid = document.getElementById('week-grid');
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-material-view]');
    if (!button) return;

    showMaterialInViewer({
      week: Number.parseInt(button.dataset.week, 10),
      name: button.dataset.name,
      path: button.dataset.path
    });
  });
}

function showMaterialInViewer(material) {
  const url = resolveSitePath(material.path);
  const frame = document.getElementById('material-frame');
  const placeholder = document.getElementById('viewer-placeholder');
  const openLink = document.getElementById('viewer-open-link');

  setText('viewer-week', `Week ${String(material.week).padStart(2, '0')}`);
  setText('viewer-name', material.name);
  setText('viewer-path', material.path);

  frame.src = url;
  frame.classList.add('is-active');
  placeholder.classList.add('is-hidden');

  openLink.href = url;
  openLink.classList.remove('is-hidden');

  document.getElementById('material-viewer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindSearchControls() {
  const input = document.getElementById('week-search');
  const clear = document.getElementById('clear-search');

  input.addEventListener('input', () => filterWeeklyCards(input.value));
  clear.addEventListener('click', () => {
    input.value = '';
    filterWeeklyCards('');
    input.focus();
  });
}

function refreshWeekSearchIndex() {
  if (!state.courseData) return;

  for (const week of state.courseData.weeklyPlan) {
    const card = document.querySelector(`.week-card[data-week="${week.week}"]`);
    if (!card) continue;

    const materials = state.materialsByWeek.get(week.week) || [];
    const searchParts = [
      `week ${week.week}`,
      `week ${String(week.week).padStart(2, '0')}`,
      `week${week.week}`,
      `week${String(week.week).padStart(2, '0')}`,
      week.title,
      week.clo,
      week.assessment,
      ...week.sessions.flatMap(session => [
        `session ${session.session}`,
        session.title,
        session.coverage,
        session.learningFocus,
        session.clo.join(' '),
        session.assessment
      ]),
      ...materials.flatMap(material => [material.name, material.displayName])
    ];

    card.dataset.search = normalizeSearchText(searchParts.filter(Boolean).join(' '));
  }
}

function filterWeeklyCards(query) {
  const normalizedQuery = normalizeSearchText(query.trim());
  const cards = [...document.querySelectorAll('.week-card')];
  let visible = 0;

  for (const card of cards) {
    const match = !normalizedQuery || card.dataset.search.includes(normalizedQuery);
    card.classList.toggle('is-hidden', !match);
    if (match) visible += 1;
  }

  const status = document.getElementById('search-status');
  status.textContent = normalizedQuery ? `${visible} of ${cards.length} weeks match your search.` : '';
  setupFilenameMarquees();
}

function setupFilenameMarquees() {
  const tracks = document.querySelectorAll('.material-name-track');
  tracks.forEach(track => {
    const viewport = track.closest('.material-name-viewport');
    if (!viewport || viewport.offsetParent === null) return;

    track.classList.remove('is-overflowing');
    track.style.removeProperty('--scroll-distance');
    track.style.removeProperty('--scroll-duration');

    const overflow = Math.ceil(track.scrollWidth - viewport.clientWidth);
    if (overflow > 4) {
      const distance = overflow + 8;
      const duration = Math.max(7, Math.min(18, 6 + distance / 28));
      track.style.setProperty('--scroll-distance', `${distance}px`);
      track.style.setProperty('--scroll-duration', `${duration.toFixed(1)}s`);
      track.classList.add('is-overflowing');
    }
  });
}

function resolveSitePath(path) {
  const text = String(path || '');
  if (/^https?:\/\//i.test(text)) return text;

  // Strip a leading slash so project sites resolve under /REPOSITORY/ rather than domain root.
  const relative = text.replace(/^\/+/, '');
  return new URL(relative, document.baseURI).href;
}

function normalizeSearchText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '';
}

function showFatalError(error) {
  const overview = document.getElementById('course-overview');
  const grid = document.getElementById('week-grid');
  const message = `Course data could not be loaded. ${error?.message || ''}`.trim();
  if (overview) overview.innerHTML = `<div class="error-box">${escapeHtml(message)}</div>`;
  if (grid) grid.innerHTML = `<div class="error-box">${escapeHtml(message)}</div>`;
}

function removeRawFrontMatterArtifact() {
  // When index.html is served without Jekyll, the two YAML delimiter lines may be rendered as text.
  // Remove only that exact artifact; GitHub Pages removes it during the normal Jekyll build.
  [...document.body.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && /^\s*---\s*---\s*$/.test(node.textContent || '')) {
      node.remove();
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
