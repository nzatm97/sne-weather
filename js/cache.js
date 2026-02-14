const memoryCache = new Map();

function keyFor(namespace, key) {
  return `${namespace}:${key}`;
}

export function getCached(namespace, key, ttlMs) {
  const composedKey = keyFor(namespace, key);
  const now = Date.now();

  const memEntry = memoryCache.get(composedKey);
  if (memEntry && now - memEntry.timestamp < ttlMs) {
    return memEntry.value;
  }

  const raw = localStorage.getItem(composedKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (now - parsed.timestamp >= ttlMs) {
      localStorage.removeItem(composedKey);
      return null;
    }
    memoryCache.set(composedKey, parsed);
    return parsed.value;
  } catch {
    localStorage.removeItem(composedKey);
    return null;
  }
}

export function setCached(namespace, key, value) {
  const composedKey = keyFor(namespace, key);
  const entry = { value, timestamp: Date.now() };
  memoryCache.set(composedKey, entry);
  localStorage.setItem(composedKey, JSON.stringify(entry));
}
