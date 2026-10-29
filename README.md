# 子午穴枢 · 按时取穴

一款**离线可用**的中医按时取穴工具。以日期时辰推算开穴，也收录按部位/经脉查阅的针法体系。
单 HTML 文件实现（无外部依赖），同时提供 Android 外壳、可直接安装的 APK，以及 GitHub Actions 自动打包。

> 仅作学习与临床参考，不构成诊疗建议；针灸操作须由执业医师完成。

---

## 功能

| 模块 | 内容 |
|---|---|
| 此时 | 当前时辰应开之穴（灵龟八法 / 飞腾八法 / 子午流注纳甲·纳子），含开穴、配穴、当令经与主治 |
| 全日 | 一日十二时辰开穴总表，可前后翻日、选任意日期 |
| 运气 | 五运六气：岁运、司天在泉、主客气、当步加临，并给出按时取穴建议 |
| 诸法 | 五腧穴、焦氏头皮针（十五刺激区＋体系图）、眼针、脐针、董氏奇穴（十二部位逐穴定位/主治/针法） |
| 检索 | 全站穴位、主治、方诀全文检索 |
| 说明 | 算法来源、流派差异、禁忌与免责说明 |

- 农历、干支、节气、真太阳时均为本地计算，不联网。
- 董氏奇穴已按 2023 年团体标准 T/GDACM 0118—2023 与杨维杰《董氏奇穴针灸学》逐穴校核，异说标「待考」。

## 目录

```
ziwu-xueshu/
├─ app/                     Android 外壳（WebView + assets/index.html）
├─ web/                     HTTPS 站点根目录（GitHub Pages 发布）：更新站 + 网页版 + apk/
├─ apk/                     各版安卓安装包（ASCII 文件名，供站点下载）
├─ .github/workflows/       android.yml（打 APK）、pages.yml（发布 web/）
├─ 子午穴枢.html            网页源文件（与 web/app.html 同源）
└─ gradlew / *.gradle.kts   Gradle 工程
```

## 更新

**v1.2.1（黑边修复 · 独立更新站）**

- 修复安卓端黑边：状态栏、导航栏统一为纸色，按 Android 11–16 的边到边规则处理系统栏内边距，顶部标题不再被状态栏压住。
- 更新日志升级为独立静态站点（`web/index.html`）：可在线「打开网页版」、下载每一版安卓安装包。
- 安装包改用 ASCII 文件名（`apk/ziwu-xueshu-v1.2.1.apk`），浏览器下载不再乱码。

**v1.2.0（关于页与更新日志）**

- 说明页新增「关于」卡片：当前版本、版本特点、更新时间、联系方式，仿设置页版式。
- 更新日志页（静态）收录每一版安装包与更新内容。
- 灵龟八法新增「日干支 / 时干支代数歌」与甲子日甲子时算例。

**v1.1.0（子午流注深化）**

- 纳子法卡片新增「不虚不实／补泻时已过 → 取本穴」一行，并标出母穴补时、子穴泻时。
- 新增可折叠《纳支法补母泻子取穴表》：十二时辰 × 当令经、母穴（补时）、子穴（泻时）、本穴、原穴，当前时辰高亮。
- 纳甲法卡片新增「开穴规则」六条：阳进阴退、经生经穴生穴、返本还原、日干重见（气纳三焦／血归包络）、合日互用（夫妻互用）、癸日涌泉亥时之谜。
- 说明页「四、子午流注」重写：子午与流注释义、纳甲五法、纳子三法、两法优劣与运用要点。

## 版本与更新日志（在线站点）

- `releases.json` 是**唯一数据源**（版本号、日期、更新条目、安装包体积）。
- `node tools/sync_release.js` 会自动：
  1. 生成 `releases.html` —— 独立静态更新站（首页 Hero：打开网页版 / 下载安卓版；版本卡；联系方式）；
  2. 把它镜像为 `web/index.html`（站点首页）与 `app/src/main/assets/releases.html`（应用内离线页）；
  3. 把版本数据注入 `子午穴枢.html`（说明页「关于」卡片与「检查更新」）；
  4. 同步副本到 `web/app.html`、`web/子午穴枢.html`、`app/src/main/assets/index.html`。
- 发布新版的流程：

  ```bash
  # 1. 改代码 / 内容（子午穴枢.html）
  # 2. 在 releases.json 顶部加一条新版本，latest 改成新版本号
  # 3. 同步日志与关于页
  node tools/sync_release.js
  # 4. 打包，APK 用 ASCII 文件名放进 apk/ 与 web/apk/
  ./gradlew assembleDebug
  cp app/build/outputs/apk/debug/app-debug.apk apk/ziwu-xueshu-vX.Y.Z.apk
  cp apk/ziwu-xueshu-vX.Y.Z.apk web/apk/
  # 5. 提交并打 tag
  git add -A && git commit -m "vX.Y.Z" && git tag vX.Y.Z && git push --tags
  ```

- 站点上线：`.github/workflows/pages.yml` 会把 `web/` 发布到 GitHub Pages，
  地址形如 `https://<用户名>.github.io/ziwu-xueshu/`（HTTPS，无需额外配置）。
  也可直接把 `web/` 目录上传到任意静态托管（Netlify / Vercel / 对象存储），
  因为所有链接都是相对路径。

## 联系

- 邮箱：1784035058@qq.com
- QQ 群：1132558598

## 本地构建 APK

```bash
# 需要 JDK 17 与 Android SDK（platform 34 + build-tools 34.0.0）
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

## 自动打包（推荐）

1. 新建仓库并推送：

   ```bash
   git remote add origin git@github.com:<你的账号>/ziwu-xueshu.git
   git push -u origin main
   ```

2. 打开 **Actions → Build Android APK**，每次 push 都会产出可下载的 `ziwu-xueshu-apk` 工件；
   打 tag 时（如 `git tag v1.0.0 && git push --tags`）会自动把 APK 附到 Release 页，直链下载。
3. **Settings → Pages → Source: GitHub Actions**，`web/` 会发布为 HTTPS 站点：
   首页是更新日志与下载（网页版 / 安卓安装包），`app.html` 是在线网页版（可"添加到主屏幕"）。

## 更新网页内容

网页是单文件，改完 `子午穴枢.html` 后跑一次同步脚本即可（会镜像到 `web/` 与 Android assets）：

```bash
node tools/sync_release.js
```

## 签名说明

CI 默认构建 **debug 签名** APK，可直接安装（首次安装需允许"未知来源"）。
若要长期更新同一应用，请自行生成 keystore 并在仓库 Secrets 中配置
`ZIWU_KEYSTORE`、`ZIWU_STORE_PASS`、`ZIWU_KEY_ALIAS`、`ZIWU_KEY_PASS`，
`app/build.gradle.kts` 会自动启用 release 签名。

## 许可

个人学习用途。古籍原文属公有领域；引用的现代著作文字仅作核对与索引，版权归原作者与出版方。
