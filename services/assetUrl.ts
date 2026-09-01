export function assetUrl(relativePath: string): string {
  if (!relativePath) return '';
  // If the path is already an absolute URL (http/https/data:), return it directly
  if (/^(https?:|data:|\/\/)/i.test(relativePath)) {
    return relativePath;
  }
  const rel = String(relativePath || '').replace(/^\/+/, '');
  if (typeof window !== 'undefined' && window.location) {
    const appDirPath = new URL('./', window.location.href).pathname;
    const normalizedBase = appDirPath.endsWith('/') ? appDirPath : `${appDirPath}/`;
    return `${normalizedBase}${rel}`;
  }
  const base = ((import.meta as any)?.env?.BASE_URL as string | undefined) || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${rel}`;
}

