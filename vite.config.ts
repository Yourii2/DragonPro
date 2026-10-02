import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function isCloudflareActive(): boolean {
  try {
    const sc = execSync('sc query Cloudflared', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 }).toString();
    if (/STATE\s*:\s*\d+\s+RUNNING/i.test(sc)) return true;
  } catch (e) {}
  try {
    const scWarp = execSync('sc query CloudflareWARP', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 }).toString();
    if (/STATE\s*:\s*\d+\s+RUNNING/i.test(scWarp)) return true;
  } catch (e) {}
  try {
    const tasks = execSync('tasklist /NH', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 }).toString();
    if (/cloudflared\.exe/i.test(tasks) || /warp-svc\.exe/i.test(tasks)) return true;
  } catch (e) {}
  return false;
}

function getCloudflareTunnelUrl(projectRoot: string, port: number = 3000): string | null {
  if (!isCloudflareActive()) {
    return null;
  }

  // 1. Check tunnel.json for user override (custom IP or URL)
  try {
    const tPath = path.resolve(projectRoot, 'tunnel.json');
    if (fs.existsSync(tPath)) {
      const cfg = JSON.parse(fs.readFileSync(tPath, 'utf8'));
      const val = cfg.cloudflare_ip || cfg.tunnel_ip || cfg.ip || cfg.cloudflare_url || cfg.url;
      if (val && typeof val === 'string' && val.trim()) {
        const clean = val.trim();
        return clean.startsWith('http://') || clean.startsWith('https://')
          ? clean
          : `http://${clean}${clean.includes(':') ? '' : `:${port}`}/`;
      }
    }
  } catch (e) {}

  // 2. Check environment variable override
  if (process.env.CLOUDFLARE_TUNNEL_IP) {
    const ip = process.env.CLOUDFLARE_TUNNEL_IP.trim();
    return `http://${ip}:${port}/`;
  }
  if (process.env.CLOUDFLARE_TUNNEL_URL) {
    return process.env.CLOUDFLARE_TUNNEL_URL.trim();
  }

  // 3. Auto-detect from network interfaces
  try {
    const ifaces = os.networkInterfaces();

    // Look for adapter specifically named cloudflare, warp, tailscale, tunnel, or vpn
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (/cloud|warp|tailscale|tunnel|vpn/i.test(name)) {
        const v4 = (addrs || []).find(a => a.family === 'IPv4' && !a.internal);
        if (v4) return `http://${v4.address}:${port}/`;
      }
    }

    // Look for 100.x.x.x CGNAT range (used by Tailscale and Cloudflare WARP)
    for (const [name, addrs] of Object.entries(ifaces)) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal && a.address.startsWith('100.')) {
          return `http://${a.address}:${port}/`;
        }
      }
    }
  } catch (e) {}

  return null;
}

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
    base: '/',
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      // Allow all external hosts when accessed via a public hostname (e.g. Cloudflare tunnels)
      allowedHosts: true,
      proxy: {
        '^/components/.*\\.php(\\?.*)?$': {
          target: `http://127.0.0.1${phpBasePath}`,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
            });
          },
        }
      },
    },
    preview: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '^/components/.*\\.php(\\?.*)?$': {
          target: `http://127.0.0.1${phpBasePath}`,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
            });
          },
        }
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('sweetalert2')) {
                return 'vendor-swal';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor-framework';
            }
          }
        }
      }
    },
    plugins: [
      react(),
      {
        name: 'vite-cloudflare-banner',
        configureServer(server: any) {
          const printBanner = () => {
            setTimeout(() => {
              const url = getCloudflareTunnelUrl(projectRoot, server.config?.server?.port || 3000);
              if (url) {
                console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mCloudflare:\x1b[0m \x1b[36m${url}\x1b[0m`);
              }
            }, 100);
          };
          if (server.httpServer?.listening) {
            printBanner();
          } else {
            server.httpServer?.once('listening', printBanner);
          }
        },
        configurePreviewServer(server: any) {
          const printBanner = () => {
            setTimeout(() => {
              const url = getCloudflareTunnelUrl(projectRoot, server.config?.preview?.port || 3000);
              if (url) {
                console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mCloudflare:\x1b[0m \x1b[36m${url}\x1b[0m`);
              }
            }, 100);
          };
          if (server.httpServer?.listening) {
            printBanner();
          } else {
            server.httpServer?.once('listening', printBanner);
          }
        }
      }
    ],
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
