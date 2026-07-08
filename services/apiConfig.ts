function getApiBasePath(): string {
  // This function dynamically determines the absolute base path for the API.
  // It assumes the project is either in a subfolder of the web root (e.g., /DragonPro)
  // or directly at the web root.
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_PATH as string | undefined;
  const globalOverride = (window as any)?.API_BASE_PATH_OVERRIDE as string | undefined;
  const storedOverride = (typeof window !== 'undefined' && window.localStorage)
    ? window.localStorage.getItem('apiBasePath') || undefined
    : undefined;
  const override = envBase || globalOverride || storedOverride;
  if (override) return override.replace(/\/$/, '');

  // If running in development (Vite dev server or CF Tunnel pointing to Vite),
  // route requests via Vite's local dev server proxy to avoid CORS and Private Network Access issues.
  const isDev = !!(import.meta as any).env?.DEV;
  if (isDev) {
    return `${window.location.origin}/components`;
  }

  // Production (or Apache-served build): derive the directory that the SPA is running under.
  // This supports nested installs like /clients/Nexus/ as well as root installs.
  const appDirPath = new URL('./', window.location.href).pathname; // always ends with '/'
  return `${window.location.origin}${appDirPath}components`;
}

const buildCandidateApiBases = (initialBase: string): string[] => {
  const origin = window.location.origin;
  const pathname = window.location.pathname || '/';
  const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
  const candidates = [
    initialBase,
    `${origin}/components`,
    `${origin}/Nexus/components`,
    `http://localhost/DragonPro/components`,
    firstSegment ? `${origin}/${firstSegment}/components` : '',
  ].filter(Boolean).map((x) => x.replace(/\/$/, ''));
  return Array.from(new Set(candidates));
};

let API_BASE_PATH = getApiBasePath();
let resolvedApiBasePath: string | null = null;

const setResolvedApiBasePath = (value: string) => {
  const normalized = value.replace(/\/$/, '');
  resolvedApiBasePath = normalized;
  API_BASE_PATH = normalized;
  try {
    window.localStorage.setItem('apiBasePath', normalized);
  } catch {
    // ignore storage failures
  }
};

const tryResolveApiBasePath = async () => {
  if (typeof window === 'undefined') return;
  const candidates = buildCandidateApiBases(API_BASE_PATH);
  // Run all checks in parallel with a 3-second timeout to avoid sequential blocking
  await Promise.all(candidates.map(async (candidate) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${candidate}/test.php`, { 
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      const json = JSON.parse(text);
      if (json && json.status === 'success') {
        setResolvedApiBasePath(candidate);
      }
    } catch (e) {
      // ignore failures
    }
  }));
};

export { API_BASE_PATH };

// Test connection to PHP server
export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_PATH}/test.php`, { credentials: 'include' });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      return result && result.status === 'success';
    } catch {
      // Most common cause: API_BASE_PATH points to a static server (Vite) and returns raw PHP.
      console.error('Connection test failed: non-JSON response (first 120 chars):', text.slice(0, 120));
      return false;
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

// Ensure fetch sends cookies by default (dev server runs on different port)
if (typeof window !== 'undefined' && (window as any).fetch) {
  const _origFetch = (window as any).fetch.bind(window);
  // Kick off async auto-discovery of API base path once at startup.
  tryResolveApiBasePath();

  (window as any).fetch = (input: RequestInfo, init?: RequestInit) => {
    let nextInput: RequestInfo = input;
    try {
      if (typeof input === 'string' && resolvedApiBasePath) {
        const currentBase = API_BASE_PATH.replace(/\/$/, '');
        const resolvedBase = resolvedApiBasePath.replace(/\/$/, '');
        if (currentBase !== resolvedBase && input.startsWith(currentBase)) {
          nextInput = resolvedBase + input.slice(currentBase.length);
        }
      }
    } catch {
      // ignore rewrite errors
    }

    const isExternal = typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://')) && !input.startsWith(window.location.origin) && !input.startsWith(API_BASE_PATH);
    const newInit = isExternal
      ? init
      : Object.assign({}, init || {}, { credentials: (init && init.credentials) || 'include' });
    return _origFetch(nextInput, newInit as RequestInit);
  };
}