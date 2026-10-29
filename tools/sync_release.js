#!/usr/bin/env node
/**
 * 版本同步脚本：以 releases.json 为唯一数据源，
 * 1) 生成静态更新站（releases.html，并镜像为 web/index.html）
 * 2) 把版本数据注入 子午穴枢.html 的 RELEASES 标记块
 * 用法：node tools/sync_release.js
 *
 * 发版只需：改 releases.json → 放好 apk/ziwu-xueshu-v<版本>.apk → 跑本脚本。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'releases.json'), 'utf8'));
const latest = data.latest || (data.versions[0] && data.versions[0].v) || '1.0.0';
const newest = data.versions.find((r) => r.v === latest) || data.versions[0] || {};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const apkOf = (r) => r.file || `apk/ziwu-xueshu-v${r.v}.apk`;

/* ---------- 1. 生成静态更新站 ---------- */
const cards = data.versions.map((r) => {
  const isNew = r.v === latest;
  const apk = esc(apkOf(r));
  const size = r.size ? ` · ${esc(r.size)}` : '';
  return `
  <section class="ver${isNew ? ' new' : ''}">
    <div class="vhead">
      <h3>v${esc(r.v)}${isNew ? '<span class="tag">最新</span>' : ''}</h3>
      <span class="date">${esc(r.date)}${size}</span>
    </div>
    <p class="feat">${esc(r.feature || '')}</p>
    <ul class="notes">${(r.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="dl">
      <a class="btn primary" href="${apk}" download>下载安卓版</a>
      <a class="btn" href="app.html">打开网页版</a>
    </div>
  </section>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f4efe4">
<meta name="description" content="子午穴枢 · 按时取穴。在线打开网页版，或下载安卓安装包；每一版更新日志与安装包都在这里。">
<title>子午穴枢 · 更新日志与安装包</title>
<link rel="icon" href="子午穴枢.icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="子午穴枢.icon180.png">
<script>if(location.protocol==='file:')document.documentElement.className+=' inapp';</script>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  :root{--paper:#f4efe4;--card:#fffdf6;--ink:#2a2620;--ink2:#7a7161;--ink3:#a29a8a;
    --line:#e7decb;--red:#a8402f;--red2:#c4604a;--redsoft:#f7e9e3;--jade:#3c6a58;--gold:#a8874f;
    --shadow:0 1px 2px rgba(70,55,30,.05),0 8px 22px -12px rgba(70,55,30,.18)}
  html,body{margin:0;padding:0}
  body{background:radial-gradient(900px 420px at 50% -8%,#fffbf2 0%,rgba(255,251,242,0) 62%),var(--paper);
    color:var(--ink);font-size:15px;line-height:1.62;min-height:100dvh;
    font-family:"Songti SC","STSong","Noto Serif CJK SC",ui-serif,Georgia,serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:520px;margin:0 auto;padding:22px 15px 56px}
  .brand{display:flex;align-items:center;gap:11px}
  .seal{width:38px;height:38px;border-radius:7px;background:var(--red);color:#fff8ee;
    display:grid;place-items:center;font-size:20px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)}
  h1{margin:0;font-size:19px;letter-spacing:2px;font-weight:600}
  .brand p{margin:0;font-size:11px;color:var(--ink3);letter-spacing:.6px}
  /* 主卡片 */
  .hero{background:linear-gradient(160deg,#fffdf7 0%,#fdf6ea 100%);border:1px solid var(--line);
    border-radius:18px;padding:16px;margin-top:16px;box-shadow:var(--shadow);text-align:center}
  .hero img{width:72px;height:72px;border-radius:16px;box-shadow:0 6px 18px -10px rgba(70,55,30,.6)}
  .hname{font-size:20px;font-weight:600;letter-spacing:2px;margin-top:8px}
  .htag{font-size:11.5px;color:var(--ink2);margin-top:3px;letter-spacing:.3px}
  .hver{display:inline-block;margin-top:8px;font-size:11px;color:var(--red);
    background:var(--redsoft);border-radius:999px;padding:2px 10px;font-variant-numeric:tabular-nums}
  .cta{display:flex;gap:8px;margin-top:14px}
  .cta .btn{flex:1;justify-content:center;padding:11px 10px;font-size:13px;border-radius:11px}
  .tip{font-size:10.5px;color:var(--ink3);margin:9px 4px 0;line-height:1.6}
  /* 版本列表 */
  .stitle{display:flex;align-items:baseline;justify-content:space-between;margin:22px 2px 2px}
  .stitle h2{margin:0;font-size:14px;letter-spacing:1.5px;font-weight:600}
  .stitle span{font-size:10.5px;color:var(--ink3)}
  .ver{background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:15px;margin-top:12px;box-shadow:var(--shadow)}
  .ver.new{border-color:#e6c9bd;box-shadow:0 0 0 1px #f0d8cd inset,var(--shadow)}
  .vhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .vhead h3{margin:0;font-size:16px;letter-spacing:.5px}
  .tag{font-size:9.5px;color:#fff;background:var(--red);border-radius:999px;padding:1px 7px;
    margin-left:6px;vertical-align:2px;letter-spacing:.5px}
  .date{font-size:11px;color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap}
  .feat{margin:6px 0 2px;font-size:12.5px;color:var(--jade);font-weight:600}
  ul.notes{margin:6px 0 12px;padding-left:17px}
  ul.notes li{font-size:12px;color:var(--ink2);line-height:1.7;margin:3px 0}
  .dl{display:flex;gap:8px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;border:1px solid var(--line);background:#fff;
    border-radius:9px;padding:7px 13px;font-size:12px;color:var(--ink2);text-decoration:none}
  .btn.primary{background:var(--red);border-color:var(--red);color:#fff8ee}
  /* 联系 */
  .about{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:16px;
    padding:6px 15px;box-shadow:var(--shadow)}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:11px 0;border-bottom:1px solid #f2ecdf;font-size:13px}
  .row:last-child{border-bottom:0}
  .row .v{color:var(--ink2);text-decoration:none;word-break:break-all}
  .row a.v{color:var(--jade);border-bottom:1px dashed var(--line)}
  .foot{text-align:center;font-size:10.5px;color:var(--ink3);margin-top:20px;line-height:1.8}
  .inapp-tip{display:none;font-size:11px;color:var(--ink3);margin-top:10px}
  html.inapp .dl,html.inapp .cta,html.inapp .stitle span{display:none}
  html.inapp .inapp-tip{display:block}
</style>
</head>
<body>
<div class="wrap">
  <header class="brand">
    <div class="seal">枢</div>
    <div>
      <h1>子午穴枢</h1>
      <p>按时取穴 · 更新日志与安装包</p>
    </div>
  </header>

  <section class="hero">
    <img src="子午穴枢.icon180.png" alt="子午穴枢">
    <div class="hname">子午穴枢</div>
    <div class="htag">灵龟八法 · 飞腾八法 · 子午流注 · 五运六气</div>
    <div class="hver">v${esc(latest)} · ${esc(newest.date || '')}</div>
    <div class="cta">
      <a class="btn primary" href="app.html">打开网页版</a>
      <a class="btn" href="${esc(apkOf(newest))}" download>下载安卓版${newest.size ? ' · ' + esc(newest.size) : ''}</a>
    </div>
    <p class="tip">安装包请以浏览器下载；各版使用同一签名，可直接覆盖升级。首次安装需在系统设置中允许「未知来源」。</p>
    <p class="inapp-tip">当前为应用内离线页，安装包请到在线更新站下载。</p>
  </section>

  <div class="stitle"><h2>更新日志</h2><span>累计 ${data.versions.length} 个版本</span></div>
${cards}

  <div class="about">
    <div class="row"><span>联系作者</span><a class="v" href="mailto:${esc(data.author)}">${esc(data.author)}</a></div>
    <div class="row"><span>QQ 群</span><span class="v">${esc(data.qq)}</span></div>
    <div class="row"><span>在线网页版</span><a class="v" href="app.html">打开</a></div>
  </div>

  <div class="foot">
    本程序仅供学习与临床参考，针刺操作须由执业医师完成。<br>
    © 子午穴枢 · 全线离线计算，不上传任何数据
  </div>
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'releases.html'), html, 'utf8');
// 站点首页（web/ 部署根目录）与兼容旧链接
const pageMirrors = ['web/index.html', 'web/releases.html', 'app/src/main/assets/releases.html'];
pageMirrors.forEach((rel) => {
  const f = path.join(ROOT, rel);
  if (fs.existsSync(path.dirname(f))) fs.writeFileSync(f, html, 'utf8');
});
console.log('更新站已生成：' + data.versions.length + ' 个版本，最新 v' + latest);

// 同步 releases.json（供线上「检查更新」比对）
['web/releases.json', 'app/src/main/assets/releases.json'].forEach((rel) => {
  const f = path.join(ROOT, rel);
  if (fs.existsSync(path.dirname(f))) fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
});

/* ---------- 2. 注入 子午穴枢.html ---------- */
const appPath = path.join(ROOT, '子午穴枢.html');
let app = fs.readFileSync(appPath, 'utf8');
const B = '/* RELEASES:BEGIN';
const E = '/* RELEASES:END */';
const i = app.indexOf(B);
const j = app.indexOf(E);
if (i < 0 || j < 0) {
  console.error('未找到 RELEASES 标记块，跳过注入');
  process.exit(1);
}
const payload =
  B + ' —— 由 tools/sync_release.js 从 releases.json 自动生成，请勿手改 */\n' +
  "const APP_VER = '" + latest + "';\n" +
  "const APP_DATE = '" + (newest.date || '') + "';\n" +
  'const RELEASES = ' + JSON.stringify(data.versions, null, 0) + ';\n' +
  E;
app = app.slice(0, i) + payload + app.slice(j + E.length);
fs.writeFileSync(appPath, app, 'utf8');
// 同步到 PWA 站点与安卓 assets
[['web/app.html'], ['web/子午穴枢.html'], ['app/src/main/assets/index.html']].forEach(([rel]) => {
  const f = path.join(ROOT, rel);
  if (fs.existsSync(path.dirname(f))) fs.writeFileSync(f, app, 'utf8');
});
console.log('已注入 子午穴枢.html：APP_VER = ' + latest);
