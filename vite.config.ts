import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const cwd = process.cwd();
  // Auto-detect where the project lives under XAMPP htdocs.
  // Supports:
  // - C:\xampp\htdocs\Nexus                 -> /Nexus
  // - C:\xampp\htdocs\clients\Nexus        -> /clients/Nexus
  // - C:\xampp\htdocs                       -> (root)
  const normalizedCwd = cwd.replace(/\\+/g, '/');
  const marker = '/xampp/htdocs';
  const idx = normalizedCwd.toLowerCase().indexOf(marker);
  const relFromHtdocs = idx >= 0 ? normalizedCwd.slice(idx + marker.length).replace(/^\/+/, '') : '';
  const defaultPhpBasePath = relFromHtdocs ? `/${relFromHtdocs}` : '';
    let phpBasePath = (env.VITE_PHP_BASE_PATH ?? defaultPhpBasePath).toString().trim();
    if (phpBasePath && !phpBasePath.startsWith('/')) phpBasePath = `/${phpBasePath}`;
    phpBasePath = phpBasePath.replace(/\/+$/, '');
    // Find the nearest ancestor directory (starting from this file) that
    // contains both `index.html` and `package.json`. This makes the
    // build resilient when invoked from another working directory (e.g.
    // a different project folder under XAMPP like `Dragon`).
    const findProjectRoot = (startDir: string) => {
      let dir = path.resolve(startDir);
      while (true) {
        const hasIndex = fs.existsSync(path.join(dir, 'index.html'));
        const hasPkg = fs.existsSync(path.join(dir, 'package.json'));
        if (hasIndex && hasPkg) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return path.resolve(__dirname, '.');
    };

    const projectRoot = findProjectRoot(__dirname);

    return {
      // Use the discovered project root (falls back to config file dir)
      root: projectRoot,
      base: mode === 'production' ? './' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Dev-only: proxy only PHP endpoints under /components to Apache.
          // Use a regex key so TS/TSX module requests (e.g. /components/*.tsx)
          // are NOT proxied and remain served by Vite.
          // Note: Vite matches against req.url (can include query string),
          // so we must allow optional `?query` for routes like api.php?module=...
          '^/components/.*\\.php(\\?.*)?$': {
            target: `http://localhost${phpBasePath}`,
            changeOrigin: true,
            secure: false,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
