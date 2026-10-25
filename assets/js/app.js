/* ==========================================================================
   App shell: sidebar, routing, home page, favorites, recents,
   command palette (Ctrl/Cmd + K), theme and input persistence
   ========================================================================== */
'use strict';

(() => {
  const MAX_RECENT = 5;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const toolById = new Map(TOOLS.map((t) => [t.id, t]));
  const categoryIcon = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.icon]));

  const el = {
    container: document.getElementById('tools-container'),
    home: document.getElementById('home'),
    homeGroups: document.getElementById('home-groups'),
    sidebar: document.getElementById('sidebar'),
    sidebarNav: document.getElementById('sidebar-nav'),
    backdrop: document.getElementById('sidebar-backdrop'),
    menuBtn: document.getElementById('menu-btn'),
    breadcrumb: document.getElementById('breadcrumb'),
    palette: document.getElementById('palette'),
    paletteInput: document.getElementById('palette-input'),
    paletteList: document.getElementById('palette-list'),
  };

  /** First sentence of the info text, used on cards and in the palette. */
  const summary = (tool) => tool.info.split(/(?<=[.!?])\s+(?=[A-Z"])/)[0];

  /* ---------- Favorites & recents ---------- */

  const validIds = (ids) => (Array.isArray(ids) ? ids.filter((id) => toolById.has(id)) : []);
  let favorites = validIds(QA.storage.get('favorites', []));
  let recents = validIds(QA.storage.get('recents', []));

  const isFavorite = (id) => favorites.includes(id);

  const toggleFavorite = (id) => {
    favorites = isFavorite(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    QA.storage.set('favorites', favorites);
    QA.toast(isFavorite(id) ? `★ Added ${toolById.get(id).title} to favorites` : `Removed ${toolById.get(id).title} from favorites`);
    renderNavigation();
    if (!el.palette.hidden) renderPalette();
  };

  const addRecent = (id) => {
    recents = [id, ...recents.filter((r) => r !== id)].slice(0, MAX_RECENT);
    QA.storage.set('recents', recents);
  };

  const starButton = (id, extraClass = '') => `
    <button type="button" class="icon-btn star-btn ${extraClass}" data-fav="${id}" aria-pressed="${isFavorite(id)}"
            aria-label="${isFavorite(id) ? 'Remove from' : 'Add to'} favorites" title="${isFavorite(id) ? 'Remove from' : 'Add to'} favorites">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
    </button>`;

  /* ---------- Theme ---------- */

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    QA.storage.set('theme', theme);
  });

  // Follow the OS theme until the user picks one explicitly.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!QA.storage.get('theme')) document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  });

  /* ---------- Tool sections ---------- */

  const createToolUi = (tool, section) => ({
    $: (ref) => section.querySelector(`[data-ref="${ref}"]`),
    $$: (selector) => [...section.querySelectorAll(selector)],
    load: (key, fallback) => QA.storage.get(`${tool.id}.${key}`, fallback),
    save: (key, value) => QA.storage.set(`${tool.id}.${key}`, value),
  });

  /** Restore every [data-persist] field of a tool and save it again whenever it changes. */
  const bindPersistence = (tool, section) => {
    section.querySelectorAll('[data-persist]').forEach((field) => {
      const key = `${tool.id}.field.${field.dataset.ref}`;
      const isCheckbox = field.type === 'checkbox';
      const saved = QA.storage.get(key);

      if (saved !== null) {
        if (isCheckbox) field.checked = saved;
        else field.value = saved;
      }

      const save = () => QA.storage.set(key, isCheckbox ? field.checked : field.value);
      field.addEventListener(isCheckbox || field.tagName === 'SELECT' ? 'change' : 'input', save);
    });
  };

  /** All tools are rendered once (so their state survives navigation); only the active one is shown. */
  const renderTool = (tool) => {
    const section = document.createElement('section');
    section.className = 'tool';
    section.id = `tool-${tool.id}`;
    section.hidden = true;
    section.setAttribute('aria-labelledby', `${tool.id}-title`);
    section.innerHTML = `
      <div class="tool-header">
        <div class="tool-heading">
          <h1 class="tool-title" id="${tool.id}-title"><span aria-hidden="true">${tool.icon}</span> ${tool.title}</h1>
          <p class="tool-info">${tool.info}</p>
        </div>
        <span data-star-slot></span>
      </div>
      <div class="tool-body">${tool.template}</div>`;

    bindPersistence(tool, section);
    el.container.appendChild(section);

    try {
      tool.setup(createToolUi(tool, section));
    } catch (e) {
      console.error(`Tool "${tool.id}" failed to initialise`, e);
    }
    return section;
  };

  const sections = new Map(TOOLS.map((tool) => [tool.id, renderTool(tool)]));

  /* ---------- Sidebar & home ---------- */

  const MAX_SIDEBAR_RECENT = 4;
  let activeId = null; // id of the tool currently shown, null on the home page
  let collapsedGroups = QA.storage.get('collapsedGroups', []);

  const navLink = (tool) => `
    <a href="#${tool.id}" class="nav-link" data-tool="${tool.id}">
      <span class="nav-icon" aria-hidden="true">${tool.icon}</span>
      <span class="nav-label">${tool.title}</span>
    </a>`;

  /** "Favorites" / "Recent" lists at the top of the sidebar. */
  const personalGroup = (title, tools) => (tools.length ? `
    <div class="nav-personal-group">
      <h2 class="nav-label-small">${title}</h2>
      ${tools.map(navLink).join('')}
    </div>` : '');

  /** Collapsible category with a guide line under its heading. */
  const categoryGroup = (category) => {
    const tools = toolsIn(category.name);
    // Never hide the tool you are looking at.
    const open = !collapsedGroups.includes(category.name) || tools.some((t) => t.id === activeId);
    return `
      <div class="nav-category">
        <button type="button" class="nav-category-toggle" data-category="${category.name}" aria-expanded="${open}">
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          <span class="nav-category-name">${category.name}</span>
          <span class="nav-count">${tools.length}</span>
        </button>
        <div class="nav-items"${open ? '' : ' hidden'}>${tools.map(navLink).join('')}</div>
      </div>`;
  };

  const toolCard = (tool) => `
    <a href="#${tool.id}" class="tool-card">
      <span class="tool-card-icon" aria-hidden="true">${tool.icon}</span>
      <span class="tool-card-text">
        <span class="tool-card-title">${tool.title}</span>
        <span class="tool-card-desc">${QA.escapeHtml(summary(tool))}</span>
      </span>
      ${starButton(tool.id, 'card-star')}
    </a>`;

  const homeGroup = (title, tools, extraClass = '') => (tools.length ? `
    <section class="home-group ${extraClass}">
      <h2 class="home-group-title">${title}<span class="nav-count">${tools.length}</span></h2>
      <div class="card-grid">${tools.map(toolCard).join('')}</div>
    </section>` : '');

  const toolsIn = (category) => TOOLS.filter((t) => t.category === category);
  const byIds = (ids) => ids.map((id) => toolById.get(id));

  /** Re-render everything that depends on favorites / recents / the active tool. */
  const renderNavigation = () => {
    // Recent excludes the open tool and favorites, so nothing is listed twice.
    const sidebarRecents = recents.filter((id) => id !== activeId && !isFavorite(id)).slice(0, MAX_SIDEBAR_RECENT);
    const personal = personalGroup('★ Favorites', byIds(favorites)) + personalGroup('Recent', byIds(sidebarRecents));

    el.sidebarNav.innerHTML = `
      ${personal ? `<div class="nav-personal">${personal}</div>` : ''}
      <h2 class="nav-label-small nav-tools-label">All tools</h2>
      ${CATEGORIES.map(categoryGroup).join('')}`;

    const homeRecents = recents.filter((id) => !isFavorite(id));
    const yourTools = homeGroup('★ Favorites', byIds(favorites)) + homeGroup('Recently used', byIds(homeRecents));
    el.homeGroups.innerHTML = `
      ${yourTools ? `<div class="home-personal">${yourTools}</div>` : '<p class="hint home-tip">Tip: click the ☆ on any tool to pin it to Favorites.</p>'}
      ${CATEGORIES.map((c) => homeGroup(c.name, toolsIn(c.name))).join('')}`;

    sections.forEach((section, id) => {
      section.querySelector('[data-star-slot]').innerHTML = starButton(id);
    });
    markActiveLink();
  };

  el.sidebarNav.addEventListener('click', (e) => {
    const toggle = e.target.closest('.nav-category-toggle');
    if (!toggle) return;
    const name = toggle.dataset.category;
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.nextElementSibling.hidden = !open;
    collapsedGroups = open ? collapsedGroups.filter((g) => g !== name) : [...collapsedGroups, name];
    QA.storage.set('collapsedGroups', collapsedGroups);
  });

  /* ---------- Routing (#tool-id) ---------- */

  const markActiveLink = () => {
    el.sidebarNav.querySelectorAll('.nav-link').forEach((a) => {
      if (a.dataset.tool === activeId) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  const showRoute = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const tool = toolById.get(id);
    activeId = tool ? tool.id : null;

    el.home.hidden = Boolean(tool);
    sections.forEach((section, sid) => { section.hidden = sid !== activeId; });

    if (tool) {
      addRecent(tool.id);
      document.title = `${tool.title} – QA Toolbox`;
      el.breadcrumb.innerHTML = `<a href="#">Home</a><span aria-hidden="true">/</span><span>${tool.category}</span><span aria-hidden="true">/</span><strong>${tool.title}</strong>`;
    } else {
      document.title = 'QA Toolbox – Free Utilities for QA Engineers';
      el.breadcrumb.innerHTML = '<strong>All tools</strong>';
    }

    renderNavigation();
    closeSidebar();
    window.scrollTo(0, 0);

    // Put the cursor in the tool's first field so you can paste right away.
    if (tool) {
      const field = sections.get(tool.id).querySelector('.tool-body textarea, .tool-body input:not([type="checkbox"]):not([type="range"])');
      if (field) field.focus({ preventScroll: true });
    }
  };

  window.addEventListener('hashchange', showRoute);

  /* ---------- Sidebar show / hide ---------- */

  // Desktop: the sidebar always starts open and can be hidden with the « / ☰ buttons.
  // Narrow screens: it is a drawer that slides over the page.
  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

  const setSidebar = (open) => {
    const cls = isNarrow() ? 'sidebar-open' : 'sidebar-collapsed';
    document.body.classList.toggle(cls, isNarrow() ? open : !open);
    el.menuBtn.setAttribute('aria-expanded', String(open));
  };
  const isSidebarOpen = () => (isNarrow()
    ? document.body.classList.contains('sidebar-open')
    : !document.body.classList.contains('sidebar-collapsed'));
  const closeSidebar = () => { if (isNarrow()) setSidebar(false); };

  el.menuBtn.addEventListener('click', () => setSidebar(!isSidebarOpen()));
  document.getElementById('collapse-btn').addEventListener('click', () => setSidebar(false));
  el.backdrop.addEventListener('click', () => setSidebar(false));

  /* ---------- Command palette ---------- */

  let paletteItems = [];
  let paletteIndex = 0;

  /** Lower score = better match; null = no match. */
  const scoreTool = (tool, query) => {
    const title = tool.title.toLowerCase();
    if (title.startsWith(query) || tool.id.startsWith(query)) return 0;
    if (title.split(/[\s&/↔-]+/).some((w) => w.startsWith(query))) return 1;
    if (title.includes(query)) return 2;
    const words = query.split(/\s+/);
    const haystack = `${title} ${tool.category} ${tool.keywords} ${tool.info}`.toLowerCase();
    if (words.every((w) => haystack.includes(w))) return 3;
    return null;
  };

  const paletteResults = (query) => {
    if (!query) {
      // Recents first, then favorites, then everything else.
      const order = [...new Set([...recents, ...favorites, ...TOOLS.map((t) => t.id)])];
      return order.map((id) => toolById.get(id));
    }
    return TOOLS
      .map((tool, i) => ({ tool, i, score: scoreTool(tool, query) }))
      .filter((r) => r.score !== null)
      .sort((a, b) => a.score - b.score || a.i - b.i)
      .map((r) => r.tool);
  };

  const renderPalette = () => {
    const query = el.paletteInput.value.trim().toLowerCase();
    paletteItems = paletteResults(query);
    paletteIndex = Math.min(paletteIndex, Math.max(0, paletteItems.length - 1));

    if (!paletteItems.length) {
      el.paletteList.innerHTML = `<li class="palette-empty">No tools match "${QA.escapeHtml(query)}"</li>`;
      el.paletteInput.removeAttribute('aria-activedescendant');
      return;
    }

    el.paletteList.innerHTML = paletteItems.map((tool, i) => {
      const tag = recents.includes(tool.id) && !query ? 'Recent' : isFavorite(tool.id) ? '★' : tool.category;
      return `
        <li class="palette-item" id="palette-item-${i}" role="option" data-index="${i}" aria-selected="${i === paletteIndex}">
          <span class="nav-icon" aria-hidden="true">${tool.icon}</span>
          <span class="palette-text">
            <span class="palette-title">${tool.title}</span>
            <span class="palette-desc">${QA.escapeHtml(summary(tool))}</span>
          </span>
          <span class="palette-tag">${tag}</span>
        </li>`;
    }).join('');
    el.paletteInput.setAttribute('aria-activedescendant', `palette-item-${paletteIndex}`);
    document.getElementById(`palette-item-${paletteIndex}`).scrollIntoView({ block: 'nearest' });
  };

  const openPalette = () => {
    el.palette.hidden = false;
    el.paletteInput.value = '';
    paletteIndex = 0;
    renderPalette();
    el.paletteInput.focus();
  };

  const closePalette = () => {
    el.palette.hidden = true;
  };

  const choosePaletteItem = (index) => {
    const tool = paletteItems[index];
    if (!tool) return;
    closePalette();
    if (location.hash === `#${tool.id}`) showRoute();
    else location.hash = tool.id;
  };

  el.paletteInput.addEventListener('input', () => {
    paletteIndex = 0;
    renderPalette();
  });

  el.paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      paletteIndex = (paletteIndex + step + paletteItems.length) % Math.max(1, paletteItems.length);
      renderPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choosePaletteItem(paletteIndex);
    } else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); // instead of "bookmark this page"
      if (paletteItems[paletteIndex]) toggleFavorite(paletteItems[paletteIndex].id);
    }
  });

  el.paletteList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) choosePaletteItem(Number(item.dataset.index));
  });
  el.paletteList.addEventListener('mousemove', (e) => {
    const item = e.target.closest('[data-index]');
    if (item && Number(item.dataset.index) !== paletteIndex) {
      paletteIndex = Number(item.dataset.index);
      el.paletteList.querySelectorAll('[aria-selected]').forEach((li) => li.setAttribute('aria-selected', String(li === item)));
      el.paletteInput.setAttribute('aria-activedescendant', item.id);
    }
  });
  el.palette.querySelector('[data-close-palette]').addEventListener('click', closePalette);
  document.getElementById('open-palette').addEventListener('click', openPalette);

  document.querySelectorAll('[data-shortcut]').forEach((kbd) => { kbd.textContent = isMac ? '⌘ K' : 'Ctrl K'; });
  el.palette.querySelectorAll('.palette-footer kbd').forEach((kbd) => {
    if (isMac && kbd.textContent === 'Ctrl') kbd.textContent = '⌘';
  });

  /* ---------- Global keyboard shortcuts ---------- */

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (el.palette.hidden) openPalette();
      else closePalette();
    } else if (e.key === '/' && !typing && el.palette.hidden) {
      e.preventDefault();
      openPalette();
    } else if (e.key === 'Escape') {
      if (!el.palette.hidden) closePalette();
      else closeSidebar(); // narrow-screen drawer only
    }
  });

  /* ---------- Shared clicks (event delegation) ---------- */

  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.preventDefault(); // star buttons sit inside card links
      toggleFavorite(favBtn.dataset.fav);
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

  /* ---------- Header / footer actions ---------- */

  document.getElementById('share-btn').addEventListener('click', async () => {
    const data = { title: document.title, url: location.href };
    if (navigator.share && /Mobi/.test(navigator.userAgent)) {
      try { await navigator.share(data); } catch (e) { /* user cancelled */ }
    } else {
      QA.copy(data.url);
    }
  });

  document.getElementById('clear-storage').addEventListener('click', () => {
    if (!confirm('Clear all saved inputs, favorites and preferences on this device?')) return;
    QA.storage.clear();
    location.reload();
  });

  showRoute();
})();
