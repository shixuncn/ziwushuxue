#!/usr/bin/env node
/**
 * 版本一致性检查。
 * 唯一版本源：releases.json（latest + versions[0]）。
 * 运行：node tools/check_versions.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];

const releases = JSON.parse(read('releases.json'));
const latest = releases.latest;
const first = releases.versions[0];

if (!latest || !first || first.v !== latest) {
  errors.push(`releases.json: latest(${latest}) 与 versions[0](${first && first.v}) 不一致`);
}

const app = read('app.html');
const appVer = (app.match(/const APP_VER = '([^']+)';/) || [])[1];
const appDate = (app.match(/const APP_DATE = '([^']+)';/) || [])[1];
const releasesMatch = app.match(/const RELEASES = (\[[\s\S]*?\]);\s*\n\/\* RELEASES:END \*\//);

if (appVer !== latest) errors.push(`app.html: APP_VER=${appVer}，应为 ${latest}`);
if (appDate !== first.date) errors.push(`app.html: APP_DATE=${appDate}，应为 ${first.date}`);
if (!releasesMatch) {
  errors.push('app.html: 未找到 RELEASES 标记');
} else {
  let embedded;
  try {
    embedded = JSON.parse(releasesMatch[1]);
  } catch (e) {
    errors.push(`app.html: RELEASES 不是合法 JSON（${e.message}）`);
  }
  if (embedded && JSON.stringify(embedded) !== JSON.stringify(releases.versions)) {
    errors.push('app.html: 内嵌 RELEASES 与 releases.json versions 不一致');
  }
}

/* code 字段：必须存在、最新版与 APP_CODE 一致、随版本严格递增（数组按新→旧排列） */
const appCode = Number((app.match(/const APP_CODE = (\d+);/) || [])[1]);
const versions = releases.versions || [];
versions.forEach((v) => {
  if (!Number.isInteger(v.code)) {
    errors.push(`releases.json: 版本 ${v.v} 缺少整数 code（实际：${JSON.stringify(v.code)}）`);
  }
});
if (!Number.isInteger(appCode)) {
  errors.push('app.html: 未找到整数 APP_CODE');
} else if (Number.isInteger(first.code) && appCode !== first.code) {
  errors.push(`app.html: APP_CODE=${appCode}，应为 ${first.code}（须与 releases.json 最新版 code 一致）`);
}
for (let i = 0; i + 1 < versions.length; i++) {
  const a = versions[i], b = versions[i + 1];
  if (Number.isInteger(a.code) && Number.isInteger(b.code) && a.code <= b.code) {
    errors.push(`releases.json: code 未随版本递增：${a.v}(${a.code}) 应大于 ${b.v}(${b.code})`);
  }
}

if (/const APP_VER = '1\.4\.0';/.test(app)) {
  errors.push('app.html: 仍残留 APP_VER=1.4.0');
}

const manifest = JSON.parse(read('子午穴枢.manifest.webmanifest'));
if (manifest.id !== '/ziwushuxue/') errors.push(`manifest: id=${manifest.id}`);
if (manifest.start_url !== './app.html') errors.push(`manifest: start_url=${manifest.start_url}`);
if (manifest.scope !== './') errors.push(`manifest: scope=${manifest.scope}`);
(manifest.icons || []).forEach((icon) => {
  if (!exists(icon.src)) errors.push(`manifest: 图标不存在 ${icon.src}`);
});

const sw = read('子午穴枢.sw.js');

// 1) CACHE_NAME 必须与 APP_VER 同步（换版必须换缓存名）
const cacheName = (sw.match(/const CACHE_NAME = '([^']+)';/) || [])[1];
if (!cacheName) {
  errors.push('sw: 未找到 CACHE_NAME');
} else if (cacheName !== `ziwu-xueshu-${latest}`) {
  errors.push(`sw: CACHE_NAME=${cacheName}，应为 ziwu-xueshu-${latest}（须与 APP_VER 一致）`);
}

const cacheMatch = sw.match(/FILES_TO_CACHE = (\[[\s\S]*?\]);/);
if (!cacheMatch) {
  errors.push('sw: 未找到 FILES_TO_CACHE');
} else {
  const files = (cacheMatch[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1));
  // 2) 必须缓存的关键离线资源
  ['./app.html', './images/eye-reference.png'].forEach((need) => {
    if (!files.includes(need)) {
      errors.push(`sw: FILES_TO_CACHE 缺少 ${need}（实际：${files.join(', ')}）`);
    }
  });
  // 3) 已废弃的旧入口不应再进缓存
  if (files.includes('./子午穴枢.html')) {
    errors.push('sw: FILES_TO_CACHE 仍包含已废弃的 ./子午穴枢.html，请移除');
  }
  files.forEach((file) => {
    const rel = file === './' ? 'index.html' : file.replace(/^\.\//, '');
    if (!exists(rel)) errors.push(`sw: 缓存文件不存在 ${file}`);
  });
}

const redirect = read('子午穴枢.html');
if (!/http-equiv="refresh"[^>]*url=\.\/app\.html/.test(redirect)) {
  errors.push('子午穴枢.html: 缺少指向 app.html 的 meta refresh');
}
if (!/rel="canonical"[^>]*app\.html/.test(redirect)) {
  errors.push('子午穴枢.html: canonical 未指向 app.html');
}

if (!/rel="canonical"[^>]*app\.html/.test(app)) {
  errors.push('app.html: 缺少指向 app.html 的 canonical');
}

['index.html', 'releases.html'].forEach((page) => {
  const html = read(page);
  if (!new RegExp(`v${latest.replace(/\./g, '\\.')}`).test(html)) {
    errors.push(`${page}: 未出现最新版本 v${latest}`);
  }
  if (!/href="app\.html"/.test(html)) errors.push(`${page}: 缺少指向 app.html 的 CTA`);
  if (!new RegExp(`apk/ziwu-xueshu-v${latest.replace(/\./g, '\\.')}\.apk`).test(html)) {
    errors.push(`${page}: 未链接 apk/ziwu-xueshu-v${latest}.apk`);
  }
  if (!/rel="canonical"/.test(html)) errors.push(`${page}: 缺少 canonical`);
});

const apk = `apk/ziwu-xueshu-v${latest}.apk`;
if (!exists(apk)) {
  errors.push(`缺失安装包 ${apk}`);
} else {
  const kb = Math.round(fs.statSync(path.join(root, apk)).size / 1024);
  if (String(kb) !== String(first.size).replace(/\s*KB/i, '')) {
    errors.push(`安装包体积 ${kb} KB 与 releases.json 的 ${first.size} 不一致`);
  }
}

if (errors.length) {
  console.error('版本一致性检查失败：');
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log(`版本一致性检查通过：v${latest} · ${first.date} · ${releases.versions.length} 个版本`);
