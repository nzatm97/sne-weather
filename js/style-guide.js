import {
  FONT_OPTIONS,
  THEME_OPTIONS,
  applyFontPair,
  applySavedPreferences,
  applyTheme,
  setupSelectControl
} from './ui-settings.js';

const elements = {
  themeSelect: document.getElementById('themeSelect'),
  fontSelect: document.getElementById('fontSelect'),
  themePreviewGrid: document.getElementById('themePreviewGrid'),
  fontReviewGrid: document.getElementById('fontReviewGrid')
};

function renderThemePreviewCards(activeTheme) {
  elements.themePreviewGrid.innerHTML = '';

  THEME_OPTIONS.forEach((theme) => {
    const article = document.createElement('article');
    article.className = 'theme-preview-card';
    article.setAttribute('data-preview-theme', theme.id);

    const activeClass = theme.id === activeTheme ? 'active' : '';
    article.innerHTML = `
      <h3>${theme.name}</h3>
      <p>Background, card, accent, and feedback states preview.</p>
      <div class="preview-chips">
        <span class="preview-chip primary">Primary</span>
        <span class="preview-chip secondary">Secondary</span>
        <span class="preview-chip success">Success</span>
        <span class="preview-chip warning">Warn</span>
      </div>
      <button class="btn ${activeClass}" data-theme-id="${theme.id}">${theme.id === activeTheme ? 'Active' : 'Apply theme'}</button>
    `;
    elements.themePreviewGrid.append(article);
  });

  elements.themePreviewGrid.querySelectorAll('button[data-theme-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-theme-id');
      applyTheme(id);
      elements.themeSelect.value = id;
      renderThemePreviewCards(id);
    });
  });
}

function buildFontCard(option, activeFont) {
  const article = document.createElement('article');
  article.className = 'font-preview-card';

  const isActive = option.id === activeFont;
  article.style.setProperty('--preview-heading', option.heading);
  article.style.setProperty('--preview-body', option.body);
  article.style.setProperty('--preview-mono', option.mono);
  article.innerHTML = `
    <div class="font-card-head">
      <h3>${option.name}</h3>
      <button class="btn ${isActive ? 'btn-secondary' : 'btn-ghost'}" data-font-id="${option.id}">
        ${isActive ? 'Selected' : 'Use this pairing'}
      </button>
    </div>
    <div class="font-sample heading">H1 Regional Weather Ops</div>
    <div class="font-sample heading h2">H2 Radar and Alerts</div>
    <div class="font-sample heading h3">H3 Forecast Confidence</div>
    <p class="font-sample body">Southern New England forecast discussion with precipitation probabilities, wind direction shifts, and visibility impacts overnight.</p>
    <div class="font-sample body">Button text: <button class="btn btn-ghost">View latest briefing</button></div>
    <div class="font-sample body nav">Nav text: Home, About, Contact, Social, Style Guide</div>
    <div class="font-sample mono">Numeric readout: 34°F  |  Wind 12 mph  |  29.91 inHg</div>
  `;

  return article;
}

function renderFontReview(activeFont) {
  elements.fontReviewGrid.innerHTML = '';
  FONT_OPTIONS.forEach((option) => {
    elements.fontReviewGrid.append(buildFontCard(option, activeFont));
  });

  elements.fontReviewGrid.querySelectorAll('button[data-font-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-font-id');
      applyFontPair(id);
      elements.fontSelect.value = id;
      renderFontReview(id);
    });
  });
}

function init() {
  const active = applySavedPreferences();

  setupSelectControl(elements.themeSelect, THEME_OPTIONS, active.theme, (id) => {
    applyTheme(id);
    renderThemePreviewCards(id);
  });

  setupSelectControl(elements.fontSelect, FONT_OPTIONS, active.font, (id) => {
    applyFontPair(id);
    renderFontReview(id);
  });

  renderThemePreviewCards(active.theme);
  renderFontReview(active.font);
}

init();
