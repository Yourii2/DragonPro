const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '../index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Reset icon and manifest paths to original source files (remove repeated hashes)
  html = html.replace(/<link rel="icon"[^>]+>/i, '<link rel="icon" type="image/png" href="/Dragon.png" />');
  html = html.replace(/<link rel="apple-touch-icon"[^>]+>/i, '<link rel="apple-touch-icon" href="/Dragon.png" />');
  html = html.replace(/<link rel="manifest"[^>]+>/i, '<link rel="manifest" href="/manifest.json">');

  // Remove compiled stylesheet links
  html = html.replace(/<link rel="stylesheet" crossorigin href="\/assets\/index-[^"]+\.css">/g, '');
  html = html.replace(/<link rel="stylesheet"[^>]+href="\/assets\/index-[^"]+\.css"[^>]*>/g, '');

  // Reset script to source index.tsx
  html = html.replace(/<script type="module"[^>]+src="\/assets\/index-[^"]+\.js"[^>]*><\/script>/g, '');
  html = html.replace(/<script type="module"[^>]+src="\/index\.tsx"[^>]*><\/script>/g, '');

  // Ensure clean script tag before </head>
  html = html.replace('</head>', '    <script type="module" src="/index.tsx"></script>\n</head>');

  // Clean extra blank lines
  html = html.replace(/\n\s*\n\s*\n/g, '\n\n');

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[prepare-html] index.html successfully reset to source mode (/index.tsx).');
}
