/* 把根目录的网页资源同步到 Capacitor 的 www 目录 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'www');
const items = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'js', 'images', 'icons'];

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

for (const item of items) {
  const from = path.join(root, item);
  if (!fs.existsSync(from)) continue;
  const to = path.join(dest, item);
  fs.cpSync(from, to, { recursive: true });
}

console.log('[copy-web] 已同步网页资源到 www/');
