# 味单 · 电子菜单

手机端电子菜单应用：菜品展示、分类管理、店铺设置、视频文案拆步骤，支持打包为 Android / iOS App。

## 目录

```
index.html / styles.css / js/      网页主体（也是 App 内的 WebView 内容）
icons/ images/                     PWA 图标与示例图片
server/                            Python 识别服务（语音识别 + 画面文字 OCR）
android/ ios/                      Capacitor 原生工程
scripts/copy-web.js                把网页资源同步到 www/
.github/workflows/                 Android / iOS 自动打包流水线
```

## 网页版运行

```bash
# 静态页面
python3 -m http.server 8080

# 识别服务（可选，端口 8787）
cd server
pip install -r requirements.txt
python3 server.py
```

## 打包 App

```bash
npm install
npm run sync          # 复制网页资源并同步到 Android / iOS 工程
```

- Android：`npx cap open android` 用 Android Studio 打包，或直接看下方 CI 产物
- iOS：`npx cap open ios` 用 Xcode 打开（需 macOS），选团队签名后安装

### 自动打包（GitHub Actions）

推送到 `main` 或在 Actions 页面手动触发：

| 工作流 | 产物 | 说明 |
| --- | --- | --- |
| Android APK | `weidan-android-apk`（debug APK） | 可直接安装到安卓手机 |
| iOS App | `weidan-ios-ipa-unsigned`（未签名 ipa） | 未签名不能直接装机，见下方签名说明 |

**iOS 安装到真机需要苹果开发者签名**，两种方式：

1. 用 Xcode 打开 `ios/App/App.xcworkspace`，在 Signing & Capabilities 里选自己的 Team，连接手机运行/导出；
2. 在 GitHub 仓库 Secrets 里配置证书与描述文件，把 `ios.yml` 的编译步骤改成 `-exportArchive`（需要 Apple Developer 账号）。

没有开发者账号时，iPhone 上可直接用 Safari 打开网页版并「添加到主屏幕」，体验与 App 基本一致。

## App 里的视频识别

上传带字幕的视频时，App 会在设备上直接识别画面字幕，不需要联网，也不需要服务器。

- 识别引擎：PP-OCR 中英文识别模型（`js/vendor/ocr/ppocr_rec.onnx`）+ onnxruntime-web
- 字幕定位：先按亮色像素在画面下部找字幕条，再逐条送入模型
- 多帧合并：每隔 0.8 秒取一帧，同一句字幕按出现次数投票取最完整的一条
- 人声讲解的视频，可在 **管理 → 店铺 → 识别服务地址** 填写部署好的 `server/` 服务地址，改为服务器语音识别

服务器需允许跨域访问（`server.py` 已内置 CORS 响应头）。

## 数据存储

菜品与店铺数据保存在设备本地（localStorage），换设备可通过「管理 → 数据」导出 / 导入 JSON。
