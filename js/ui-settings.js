const THEME_KEY = 'uiTheme';
const FONT_KEY = 'uiFontPair';

export const THEME_OPTIONS = [
  { id: 'midnight-indigo', name: 'Midnight Indigo' },
  { id: 'carbon-ember', name: 'Carbon + Ember' },
  { id: 'deep-forest', name: 'Deep Forest' }
];

export const FONT_OPTIONS = [
  {
    id: 'inter-space',
    name: 'Inter + Space Grotesk',
    heading: "'Space Grotesk', 'Inter', 'Segoe UI', sans-serif",
    body: "'Inter', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Inter:wght@400;500;600;700', 'Space+Grotesk:wght@500;600;700', 'JetBrains+Mono:wght@500;600']
  },
  {
    id: 'manrope-plus',
    name: 'Manrope + Plus Jakarta Sans',
    heading: "'Plus Jakarta Sans', 'Manrope', sans-serif",
    body: "'Manrope', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Manrope:wght@400;500;600;700', 'Plus+Jakarta+Sans:wght@500;600;700', 'JetBrains+Mono:wght@500;600']
  },
  {
    id: 'public-ibm',
    name: 'Public Sans + IBM Plex Sans',
    heading: "'Public Sans', 'IBM Plex Sans', sans-serif",
    body: "'IBM Plex Sans', 'Segoe UI', sans-serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Public+Sans:wght@500;600;700', 'IBM+Plex+Sans:wght@400;500;600;700', 'IBM+Plex+Mono:wght@500;600']
  },
  {
    id: 'exo-source',
    name: 'Exo 2 + Source Sans 3',
    heading: "'Exo 2', 'Source Sans 3', sans-serif",
    body: "'Source Sans 3', 'Segoe UI', sans-serif",
    mono: "'Roboto Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Exo+2:wght@500;600;700', 'Source+Sans+3:wght@400;500;600;700', 'Roboto+Mono:wght@500;600']
  },
  {
    id: 'sora-dm',
    name: 'Sora + DM Sans',
    heading: "'Sora', 'DM Sans', sans-serif",
    body: "'DM Sans', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Sora:wght@500;600;700', 'DM+Sans:wght@400;500;700', 'JetBrains+Mono:wght@500;600']
  },
  {
    id: 'urbanist-nunito',
    name: 'Urbanist + Nunito Sans',
    heading: "'Urbanist', 'Nunito Sans', sans-serif",
    body: "'Nunito Sans', 'Segoe UI', sans-serif",
    mono: "'Space Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Urbanist:wght@500;600;700', 'Nunito+Sans:wght@400;500;600;700', 'Space+Mono:wght@400;700']
  },
  {
    id: 'outfit-assistant',
    name: 'Outfit + Assistant',
    heading: "'Outfit', 'Assistant', sans-serif",
    body: "'Assistant', 'Segoe UI', sans-serif",
    mono: "'Roboto Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Outfit:wght@500;600;700', 'Assistant:wght@400;600;700', 'Roboto+Mono:wght@500;600']
  },
  {
    id: 'rajdhani-worksans',
    name: 'Rajdhani + Work Sans',
    heading: "'Rajdhani', 'Work Sans', sans-serif",
    body: "'Work Sans', 'Segoe UI', sans-serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace",
    families: ['Rajdhani:wght@500;600;700', 'Work+Sans:wght@400;500;600;700', 'IBM+Plex+Mono:wght@500;600']
  }
];

const DEFAULT_THEME = THEME_OPTIONS[0].id;
const DEFAULT_FONT = FONT_OPTIONS[0].id;

function readSavedTheme() {
  return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
}

function readSavedFont() {
  return localStorage.getItem(FONT_KEY) || DEFAULT_FONT;
}

function getFontOption(fontId) {
  return FONT_OPTIONS.find((option) => option.id === fontId) || FONT_OPTIONS[0];
}

function getThemeOption(themeId) {
  return THEME_OPTIONS.find((option) => option.id === themeId) || THEME_OPTIONS[0];
}

function ensureFontLink() {
  let link = document.getElementById('active-font-link');
  if (link) return link;

  link = document.createElement('link');
  link.id = 'active-font-link';
  link.rel = 'stylesheet';
  document.head.append(link);
  return link;
}

function applyFontOption(fontOption) {
  const root = document.documentElement;
  root.style.setProperty('--font-heading', fontOption.heading);
  root.style.setProperty('--font-body', fontOption.body);
  root.style.setProperty('--font-mono', fontOption.mono);
  root.dataset.fontPair = fontOption.id;

  const fontHref = `https://fonts.googleapis.com/css2?family=${fontOption.families.join('&family=')}&display=swap`;
  const link = ensureFontLink();
  if (link.href !== fontHref) link.href = fontHref;
}

export function applyTheme(themeId, persist = true) {
  const option = getThemeOption(themeId);
  document.documentElement.setAttribute('data-theme', option.id);
  if (persist) localStorage.setItem(THEME_KEY, option.id);
  return option.id;
}

export function applyFontPair(fontId, persist = true) {
  const option = getFontOption(fontId);
  applyFontOption(option);
  if (persist) localStorage.setItem(FONT_KEY, option.id);
  return option.id;
}

export function applySavedPreferences() {
  const appliedTheme = applyTheme(readSavedTheme(), false);
  const appliedFont = applyFontPair(readSavedFont(), false);
  console.info('[ui-settings] Applied preferences', { appliedTheme, appliedFont });
  return { theme: appliedTheme, font: appliedFont };
}

export function setupSelectControl(select, options, selectedId, onChange) {
  if (!select) return;
  select.innerHTML = '';
  options.forEach((option) => {
    const el = document.createElement('option');
    el.value = option.id;
    el.textContent = option.name;
    if (option.id === selectedId) el.selected = true;
    select.append(el);
  });
  select.addEventListener('change', (event) => onChange(event.target.value));
}
