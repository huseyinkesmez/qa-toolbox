/* ==========================================================================
   App shell: renders tools, search, categories, theme, persistence
   ========================================================================== */
'use strict';

(() => {
  const container = document.getElementById('tools-container');
  const searchInput = document.getElementById('tool-search');
  const chipsEl = document.getElementById('category-chips');
  const quickNav = document.getElementById('quick-nav');

  const state = {
    query: '',
    category: QA.storage.get('category', 'All'),
  };
  if (state.category !== 'All' && !CATEGORIES.includes(state.category)) state.category = 'All';

  /* ---------- Theme ---------- */

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    QA.storage.set('theme', theme);
  };

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // Follow the OS theme until the user picks one explicitly.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!QA.storage.get('theme')) document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  });

  /* ---------- Rendering ---------- */

  const createToolUi = (tool, section) => ({
    $: (ref) => section.querySelector(`[data-ref="${ref}"]`),
    $$: (selector) => [...section.querySelectorAll(selector)],
    load: (key, fallback) => QA.storage.get(`${tool.id}.${key}`, fallback),
    save: (key, value) => QA.storage.set(`${tool.id}.${key}`, value),
  });

  /** Restore every [data-persist] field of a tool and save it again whenever it changes. */
  const bindPersistence = (tool, section) => {
    section.querySelectorAll('[data-persist]').forEach((el) => {
      const key = `${tool.id}.field.${el.dataset.ref}`;
      const isCheckbox = el.type === 'checkbox';
      const saved = QA.storage.get(key);

      if (saved !== null) {
        if (isCheckbox) el.checked = saved;
        else el.value = saved;
      }

      const save = () => QA.storage.set(key, isCheckbox ? el.checked : el.value);
      el.addEventListener(isCheckbox || el.tagName === 'SELECT' ? 'change' : 'input', save);
    });
  };

  const renderTool = (tool) => {
    const section = document.createElement('section');
    section.className = 'tool';
    section.id = tool.id;
    section.setAttribute('aria-labelledby', `${tool.id}-title`);
    section.innerHTML = `
      <div class="tool-header">
        <div>
          <h2 class="tool-title" id="${tool.id}-title"><span aria-hidden="true">${tool.icon}</span> ${tool.title}</h2>
          <span class="tool-category">${tool.category}</span>
        </div>
        <button type="button" class="icon-btn" data-info-toggle aria-expanded="false" aria-controls="${tool.id}-info" aria-label="About ${tool.title}" title="About this tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </button>
      </div>
      <p class="tool-info" id="${tool.id}-info" hidden>${tool.info}</p>
      <div class="tool-body">${tool.template}</div>`;

    bindPersistence(tool, section);
    container.appendChild(section);

    try {
      tool.setup(createToolUi(tool, section));
    } catch (e) {
      console.error(`Tool "${tool.id}" failed to initialise`, e);
    }
    return section;
  };

  const sections = new Map(TOOLS.map((tool) => [tool.id, renderTool(tool)]));

  const emptyState = document.createElement('p');
  emptyState.className = 'empty-state';
  emptyState.hidden = true;
  container.appendChild(emptyState);

  /* ---------- Shared tool interactions (event delegation) ---------- */

  container.addEventListener('click', (e) => {
    const infoBtn = e.target.closest('[data-info-toggle]');
    if (infoBtn) {
      const box = document.getElementById(infoBtn.getAttribute('aria-controls'));
      box.hidden = !box.hidden;
      infoBtn.setAttribute('aria-expanded', String(!box.hidden));
      return;
    }

    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const target = copyBtn.closest('.tool').querySelector(`[data-ref="${copyBtn.dataset.copy}"]`);
      QA.copy(target.classList.contains('is-error') ? '' : target.textContent);
      return;
    }

    const copyValueBtn = e.target.closest('[data-copy-value]');
    if (copyValueBtn) QA.copy(copyValueBtn.dataset.copyValue);
  });

  /* ---------- Search & category filter ---------- */

  const matchesQuery = (tool, words) => {
    const haystack = `${tool.title} ${tool.category} ${tool.keywords} ${tool.info}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  };

  const renderChips = (counts) => {
    chipsEl.innerHTML = ['All', ...CATEGORIES].map((cat) => `
      <button type="button" class="chip" data-category="${cat}" aria-pressed="${cat === state.category}">
        ${cat}<span class="count">${counts[cat] || 0}</span>
      </button>`).join('');
  };

  const applyFilters = () => {
    const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    const searchHits = TOOLS.filter((tool) => matchesQuery(tool, words));

    // Chip counts reflect the current search so empty categories are obvious.
    const counts = { All: searchHits.length };
    searchHits.forEach((tool) => { counts[tool.category] = (counts[tool.category] || 0) + 1; });
    renderChips(counts);

    const visible = searchHits.filter((tool) => state.category === 'All' || tool.category === state.category);
    const visibleIds = new Set(visible.map((t) => t.id));
    sections.forEach((section, id) => { section.hidden = !visibleIds.has(id); });

    quickNav.innerHTML = visible.map((t) => `<a href="#${t.id}">${t.title.replace(/ (Converter|Generator|Lookup|Tester|Reader|Parser|Formatter & Validator|Encoder \/ Decoder|Decoder)$/, '')}</a>`).join('');

    emptyState.hidden = visible.length > 0;
    emptyState.textContent = `No tools match "${state.query}"${state.category !== 'All' ? ` in ${state.category}` : ''}.`;
  };

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim();
    applyFilters();
  });

  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-category]');
    if (!chip) return;
    state.category = chip.dataset.category;
    QA.storage.set('category', state.category);
    applyFilters();
  });

  // "/" focuses search, Escape clears it.
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      state.query = '';
      applyFilters();
      searchInput.blur();
    }
  });

  /* ---------- Deep link to a tool (#jwt) ---------- */

  const revealFromHash = () => {
    const section = sections.get(decodeURIComponent(location.hash.slice(1)));
    if (!section) return;
    if (section.hidden) {
      state.query = '';
      searchInput.value = '';
      state.category = 'All';
      applyFilters();
    }
    section.scrollIntoView();
    section.classList.add('flash');
    setTimeout(() => section.classList.remove('flash'), 1500);
  };
  window.addEventListener('hashchange', revealFromHash);

  /* ---------- Header / footer actions ---------- */

  document.getElementById('share-btn').addEventListener('click', async () => {
    const data = { title: document.title, url: location.href.split('#')[0] };
    if (navigator.share) {
      try { await navigator.share(data); } catch (e) { /* user cancelled */ }
    } else {
      QA.copy(data.url);
    }
  });

  document.getElementById('clear-storage').addEventListener('click', () => {
    if (!confirm('Clear all saved inputs and preferences on this device?')) return;
    QA.storage.clear();
    location.reload();
  });

  applyFilters();
  if (location.hash) revealFromHash();
})();
