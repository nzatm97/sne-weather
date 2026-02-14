import { geocodePlaces } from './api.js';

const RECENTS_KEY = 'recentSearches';

export function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRecentSearch(place) {
  const recents = loadRecentSearches().filter((entry) => entry.name !== place.name);
  recents.unshift(place);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 5)));
}

export function setupSearch({ input, resultsList, onSelect, onError }) {
  let debounceTimer;

  async function search() {
    const query = input.value.trim();
    if (query.length < 2) {
      resultsList.innerHTML = '';
      return;
    }

    resultsList.innerHTML = '<li class="muted">Searching…</li>';

    try {
      const results = await geocodePlaces(query);
      if (!results.length) {
        resultsList.innerHTML = '<li class="muted">No locations found.</li>';
        return;
      }

      resultsList.innerHTML = '';
      results.forEach((place) => {
        const li = document.createElement('li');
        li.textContent = place.name;
        li.addEventListener('click', () => {
          input.value = place.name;
          resultsList.innerHTML = '';
          onSelect(place);
        });
        resultsList.append(li);
      });
    } catch (error) {
      resultsList.innerHTML = '<li class="muted">Search unavailable right now.</li>';
      onError(error);
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(search, 350);
  });

  document.addEventListener('click', (event) => {
    if (!resultsList.contains(event.target) && event.target !== input) {
      resultsList.innerHTML = '';
    }
  });
}

