export function assetUrl(relativePath: string): string {
  const base = ((import.meta as any)?.env?.BASE_URL as string | undefined) || '/';
  const rel = String(relativePath || '').replace(/^\//, '');
  // Ensure exactly one slash between base and rel for both '/' and './'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${rel}`;
}
