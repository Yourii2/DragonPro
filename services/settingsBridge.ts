// Polyfill bridge: proxy selected localStorage keys to server-side DB via components/settings.php
const PREFIXES = ['Dragon_', 'Nexus_', 'nexus_'];
const API = (window as any).API_BASE_PATH || '';

const originalGet = window.localStorage.getItem.bind(window.localStorage);
const originalSet = window.localStorage.setItem.bind(window.localStorage);
const originalRemove = window.localStorage.removeItem.bind(window.localStorage);

let cache: Record<string, string> = {};
let initialized = false;

function keyToSettingName(key: string) {
  for (const p of PREFIXES) if (key.startsWith(p)) {
    return key.substring(p.length).toLowerCase();
  }
  return null;
}

async function init() {
  try {
    const r = await fetch((API ? API + '/' : '') + 'components/settings.php?action=get', { credentials: 'include' });
    const j = await r.json();
    if (j && j.success && j.data) {
      cache = {};
      for (const k in j.data) {
        cache[k.toLowerCase()] = j.data[k];
      }
    }
  } catch (e) {
    console.error('settingsBridge: failed to init', e);
  } finally {
    initialized = true;
  }
}

// kick off init (async)
init();

window.localStorage.getItem = function(key: string) {
  try {
    const name = keyToSettingName(key);
    if (name) {
      if (name in cache) return cache[name];
      return null;
    }
  } catch (e) {}
  return originalGet(key);
};

window.localStorage.setItem = function(key: string, value: string) {
  try {
    const name = keyToSettingName(key);
    if (name) {
      cache[name] = value;
      // persist to server (fire-and-forget)
      fetch((API ? API + '/' : '') + 'components/settings.php?action=update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value })
      }).catch(()=>{});
      return;
    }
  } catch (e) {}
  return originalSet(key, value);
};

window.localStorage.removeItem = function(key: string) {
  try {
    const name = keyToSettingName(key);
    if (name) {
      delete cache[name];
      // clear on server
      fetch((API ? API + '/' : '') + 'components/settings.php?action=update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: '' })
      }).catch(()=>{});
      return;
    }
  } catch (e) {}
  return originalRemove(key);
};

export {};
