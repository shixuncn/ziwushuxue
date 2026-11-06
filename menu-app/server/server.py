#!/usr/bin/env python3
"""味单 · 视频步骤识别后端（本地运行）

流程：yt-dlp 下载视频音轨 → ffmpeg 转 16k 单声道 wav → faster-whisper 转写为文字。
前端拿到文字后用菜单自带的「文案整理」功能拆成步骤，识别结果按链接缓存。
服务同时托管菜单静态页面：启动后直接打开 http://127.0.0.1:8787/ 即可。

依赖：pip install -r requirements.txt，并确保系统有 ffmpeg 命令。
启动：python3 server.py
环境变量：
  PORT           监听端口，默认 8787
  WHISPER_MODEL  识别模型，默认 small（可选 tiny / base / small / medium）
  HF_ENDPOINT    HuggingFace 镜像，国内可设 https://hf-mirror.com
  COOKIES_FILE   Netscape 格式 cookies 文件路径（抖音/小红书需要登录时）
"""
import hashlib
import json
import os
import re
import subprocess
import threading
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEB_ROOT = BASE_DIR.parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

PORT = int(os.environ.get("PORT", "8787"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")

_model = None
_model_error = None
_jobs = {}
_jobs_lock = threading.Lock()


def load_model():
    global _model, _model_error
    try:
        from faster_whisper import WhisperModel
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        print(f"[server] 模型 {WHISPER_MODEL} 加载完成，可以开始识别")
    except Exception as exc:
        _model_error = str(exc)
        print(f"[server] 模型加载失败: {exc}")


def send_json(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def friendly_error(exc):
    name = type(exc).__name__
    msg = str(exc)
    if name == "DownloadError" or "yt_dlp" in name:
        return "无法下载该视频，可能需要登录、链接已失效或平台暂时限制"
    if isinstance(exc, subprocess.CalledProcessError):
        return "音频转换失败，请确认已安装 ffmpeg"
    if isinstance(exc, subprocess.TimeoutExpired):
        return "音频转换超时"
    return ("识别失败：" + msg)[:200]


def download_audio(url, workdir):
    import yt_dlp
    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(workdir / "audio.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 2,
    }
    cookies = os.environ.get("COOKIES_FILE")
    if cookies:
        opts["cookiefile"] = cookies
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])
    for f in sorted(workdir.iterdir()):
        if f.stem == "audio" and f.suffix != ".wav":
            return f
    raise RuntimeError("下载完成但找不到音频文件")


def to_wav(src, workdir):
    dst = workdir / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", "-vn", str(dst)],
        check=True, capture_output=True, timeout=180,
    )
    return dst


def transcribe(wav):
    segments, _info = _model.transcribe(str(wav), language="zh", vad_filter=True)
    texts, segs = [], []
    for s in segments:
        t = s.text.strip()
        if t:
            texts.append(t)
            segs.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": t})
    return "\n".join(texts), segs


def extract_steps(url):
    key = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    workdir = CACHE_DIR / key
    workdir.mkdir(exist_ok=True)
    cached = workdir / "transcript.json"
    if cached.exists():
        return json.loads(cached.read_text("utf-8"))

    # 同一链接只跑一个识别任务，其余请求等待结果
    with _jobs_lock:
        evt = _jobs.get(key)
        owner = evt is None
        if owner:
            evt = threading.Event()
            _jobs[key] = evt
    if not owner:
        if evt.wait(timeout=600) and cached.exists():
            return json.loads(cached.read_text("utf-8"))
        return {"ok": False, "error": "相同链接识别未完成，请稍后重试"}

    try:
        print(f"[server] 开始识别: {url}")
        raw = download_audio(url, workdir)
        wav = to_wav(raw, workdir)
        text, segs = transcribe(wav)
        result = {"ok": True, "text": text, "segments": segs}
        cached.write_text(json.dumps(result, ensure_ascii=False), "utf-8")
        print(f"[server] 识别完成: {len(segs)} 段, {len(text)} 字")
        return result
    except Exception as exc:
        traceback.print_exc()
        return {"ok": False, "error": friendly_error(exc)}
    finally:
        for f in workdir.iterdir():
            if f.name != "transcript.json":
                try:
                    f.unlink()
                except OSError:
                    pass
        with _jobs_lock:
            _jobs.pop(key, None)
        evt.set()


class Handler(SimpleHTTPRequestHandler):
    server_version = "WeidanExtract/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[http]", fmt % args)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/health":
            data = {"ok": True, "model": WHISPER_MODEL, "ready": _model is not None}
            if _model_error:
                data["modelError"] = _model_error
            send_json(self, data)
        elif self.path.startswith("/api/"):
            send_json(self, {"ok": False, "error": "not found"}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/extract-steps":
            send_json(self, {"ok": False, "error": "not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(min(length, 64 * 1024)) if length else b"{}"
            data = json.loads(body.decode("utf-8") or "{}")
        except Exception:
            send_json(self, {"ok": False, "error": "请求格式错误"})
            return
        url = str(data.get("url") or "").strip()
        if not re.match(r"^https?://", url):
            send_json(self, {"ok": False, "error": "链接无效"})
            return
        if _model is None:
            if _model_error:
                send_json(self, {"ok": False, "error": "识别模型加载失败：" + _model_error})
            else:
                send_json(self, {"ok": False, "error": "识别模型正在加载，请半分钟后重试"})
            return
        send_json(self, extract_steps(url))


def main():
    print("=" * 56)
    print("味单 · 视频步骤识别后端 + 菜单页")
    print(f"  菜单:  http://127.0.0.1:{PORT}/  （浏览器打开即用）")
    print(f"  模型:  {WHISPER_MODEL}（后台加载中，可用 WHISPER_MODEL 更换）")
    print(f"  缓存:  {CACHE_DIR}")
    print("  停止:  Ctrl+C")
    print("=" * 56)
    threading.Thread(target=load_model, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
