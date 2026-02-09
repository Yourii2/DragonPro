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
    return {
      base: mode === 'production' ? './' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Dev-only: proxy PHP endpoints through Vite to avoid CORS and ensure PHP executes under Apache.
          '/components': {
            target: `http://localhost${phpBasePath}`,
            changeOrigin: true,
            secure: false,
            // IMPORTANT: do NOT proxy TS/TSX modules (the app imports from /components/*.tsx in dev).
            // Only proxy PHP requests like /components/api.php, /components/test.php, etc.
            bypass: (req) => {
              const url = (req.url || '').toLowerCase();
              return url.includes('.php') ? undefined : req.url;
            },
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
