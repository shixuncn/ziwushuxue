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
import base64
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
MAX_UPLOAD = 300 * 1024 * 1024  # 上传视频大小上限 300MB

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


try:
    from rapidocr_onnxruntime import RapidOCR
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

_ocr = {"engine": None, "error": None}
_ocr_lock = threading.Lock()


def get_ocr_engine():
    if not OCR_AVAILABLE:
        return None
    with _ocr_lock:
        if _ocr["engine"] is None and _ocr["error"] is None:
            try:
                print("[server] 正在加载 OCR 模型…", flush=True)
                _ocr["engine"] = RapidOCR()
                print("[server] OCR 模型就绪", flush=True)
            except Exception as e:
                _ocr["error"] = f"{type(e).__name__}: {e}"
                print(f"[server] OCR 模型加载失败: {_ocr['error']}", flush=True)
        return _ocr["engine"]


def ocr_video(media, workdir, fps=1, max_frames=240):
    """抽帧识别画面文字，相邻帧去重后按行拼接"""
    engine = get_ocr_engine()
    if engine is None:
        return ""
    fdir = workdir / "frames"
    fdir.mkdir(exist_ok=True)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(media), "-vf", f"fps={fps}",
             "-q:v", "3", str(fdir / "%04d.jpg"), "-loglevel", "error"],
            check=True, timeout=180,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return ""
    frames = sorted(fdir.glob("*.jpg"))[:max_frames]
    text = ocr_frame_files(frames)
    for f in frames:
        try:
            f.unlink()
        except OSError:
            pass
    return text


def ocr_frame_files(files):
    """对一组图片帧做 OCR，相邻帧去重后按行拼接"""
    engine = get_ocr_engine()
    if engine is None or not files:
        return ""
    from difflib import SequenceMatcher

    def similar(a, b):
        return SequenceMatcher(None, a, b).ratio() >= 0.7

    lines = []
    for f in files:
        try:
            result, _ = engine(str(f))
        except Exception:
            continue
        if not result:
            continue
        for box, text, score in result:
            t = re.sub(r"\s+", " ", str(text)).strip()
            try:
                sc = float(score)
            except (TypeError, ValueError):
                sc = 0.0
            if len(t) < 2 or sc < 0.5:
                continue
            if lines and similar(t, lines[-1]):
                if len(t) > len(lines[-1]):
                    lines[-1] = t
                continue
            lines.append(t)
    return "\n".join(lines)


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


def recognize_media(media, workdir, cached):
    """先语音识别；无人声时回退画面文字 OCR。成功时写入缓存。"""
    text, segs = "", []
    if has_audio_stream(media):
        wav = to_wav(media, workdir)
        text, segs = transcribe(wav)
    if text:
        result = {"ok": True, "text": text, "segments": segs, "source": "audio"}
    else:
        if not OCR_AVAILABLE:
            return {"ok": False, "error": "没有识别到说话声（服务器未启用画面文字识别）"}
        print("[server] 无人声，尝试画面文字 OCR…", flush=True)
        text = ocr_video(media, workdir)
        if not text:
            return {"ok": False, "error": "没有识别到语音或画面文字"}
        result = {"ok": True, "text": text, "segments": [], "source": "ocr"}
    cached.write_text(json.dumps(result, ensure_ascii=False), "utf-8")
    print(f"[server] 识别完成[{result['source']}]: {len(result['text'])} 字", flush=True)
    return result


def transcribe_audio_upload(raw_body):
    """手机端两阶段上传·第一段：浏览器已提取的 16k WAV 音频 → 语音识别"""
    key = "aud-" + hashlib.sha256(raw_body).hexdigest()[:16]
    workdir = CACHE_DIR / key
    workdir.mkdir(exist_ok=True)
    cached = workdir / "transcript.json"
    if cached.exists():
        return json.loads(cached.read_text("utf-8"))
    tmp = workdir / "input.bin"
    tmp.write_bytes(raw_body)
    try:
        wav = to_wav(tmp, workdir)
        text, segs = transcribe(wav)
        if not text:
            return {"ok": False, "error": "没有识别到说话声，试试画面文字识别", "needFrames": True}
        result = {"ok": True, "text": text, "segments": segs, "source": "audio"}
        cached.write_text(json.dumps(result, ensure_ascii=False), "utf-8")
        print(f"[server] 音频识别完成: {len(text)} 字", flush=True)
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


def ocr_frames_upload(frames):
    """手机端两阶段上传·第二段：浏览器抽取的 JPEG 帧(base64) → 画面文字 OCR"""
    if not OCR_AVAILABLE:
        return {"ok": False, "error": "服务器未启用画面文字识别"}
    frames = [f for f in frames if isinstance(f, str) and f][:120]
    if not frames:
        return {"ok": False, "error": "没有收到有效的画面帧"}
    key = "frm-" + hashlib.sha256(("|".join(f[:64] + str(len(f)) for f in frames)).encode()).hexdigest()[:16]
    workdir = CACHE_DIR / key
    workdir.mkdir(exist_ok=True)
    cached = workdir / "transcript.json"
    if cached.exists():
        return json.loads(cached.read_text("utf-8"))
    files = []
    try:
        for i, f in enumerate(frames):
            p = workdir / f"f{i:03d}.jpg"
            p.write_bytes(base64.b64decode(f))
            files.append(p)
        text = ocr_frame_files(files)
        if not text:
            return {"ok": False, "error": "没有识别到画面文字，可尝试上传有人声讲解的视频"}
        result = {"ok": True, "text": text, "source": "ocr"}
        cached.write_text(json.dumps(result, ensure_ascii=False), "utf-8")
        print(f"[server] 帧画面识别完成: {len(files)} 帧, {len(text)} 字", flush=True)
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
        return recognize_media(raw, workdir, cached)
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


def model_unready_error():
    if _model is not None:
        return None
    if _model_error:
        return {"ok": False, "error": "识别模型加载失败：" + _model_error}
    return {"ok": False, "error": "识别模型正在加载，请半分钟后重试"}


def has_audio_stream(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, timeout=30,
    )
    return "audio" in r.stdout


def transcribe_upload(tmp_path, key):
    """上传文件的识别：与链接识别共用缓存与去重，跳过下载环节"""
    workdir = CACHE_DIR / key
    workdir.mkdir(exist_ok=True)
    cached = workdir / "transcript.json"
    if cached.exists():
        return json.loads(cached.read_text("utf-8"))

    with _jobs_lock:
        evt = _jobs.get(key)
        owner = evt is None
        if owner:
            evt = threading.Event()
            _jobs[key] = evt
    if not owner:
        if evt.wait(timeout=600) and cached.exists():
            return json.loads(cached.read_text("utf-8"))
        return {"ok": False, "error": "相同视频识别未完成，请稍后重试"}

    try:
        print(f"[server] 开始识别上传文件: {key}")
        return recognize_media(tmp_path, workdir, cached)
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
        path = self.path.split("?")[0]
        if path == "/api/extract-steps":
            self.handle_extract()
        elif path == "/api/transcribe-upload":
            self.handle_upload()
        elif path == "/api/transcribe-audio":
            self.handle_audio()
        elif path == "/api/ocr-frames":
            self.handle_frames()
        else:
            send_json(self, {"ok": False, "error": "not found"}, 404)

    def handle_audio(self):
        """两阶段上传·第一段：浏览器提取的 16k WAV 音频"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            send_json(self, {"ok": False, "error": "没有收到音频数据"})
            return
        if length > 40 * 1024 * 1024:
            send_json(self, {"ok": False, "error": "音频过大，请用 3 分钟以内的视频"})
            return
        unready = model_unready_error()
        if unready:
            send_json(self, unready)
            return
        body = self.rfile.read(length)
        send_json(self, transcribe_audio_upload(body))

    def handle_frames(self):
        """两阶段上传·第二段：浏览器抽取的画面帧(base64 JPEG 数组)"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            send_json(self, {"ok": False, "error": "没有收到画面数据"})
            return
        if length > 80 * 1024 * 1024:
            send_json(self, {"ok": False, "error": "画面数据过大，请用 3 分钟以内的视频"})
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            send_json(self, {"ok": False, "error": "请求格式错误"})
            return
        frames = data.get("frames")
        if not isinstance(frames, list):
            send_json(self, {"ok": False, "error": "请求格式错误"})
            return
        send_json(self, ocr_frames_upload(frames))

    def handle_extract(self):
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
        unready = model_unready_error()
        if unready:
            send_json(self, unready)
            return
        send_json(self, extract_steps(url))

    def handle_upload(self):
        """原始字节流上传视频（body 即文件内容），省去 multipart 解析"""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            send_json(self, {"ok": False, "error": "没有收到视频文件"})
            return
        if length > MAX_UPLOAD:
            send_json(self, {"ok": False, "error": "视频超过 300MB，请剪短或压缩后再上传"})
            return
        unready = model_unready_error()
        if unready:
            send_json(self, unready)
            return
        h = hashlib.sha256()
        tmp = CACHE_DIR / ("upload-" + os.urandom(6).hex() + ".part")
        remaining = length
        try:
            with open(tmp, "wb") as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    h.update(chunk)
                    remaining -= len(chunk)
        except Exception:
            try:
                tmp.unlink()
            except OSError:
                pass
            send_json(self, {"ok": False, "error": "文件上传中断，请重试"})
            return
        if remaining > 0:
            try:
                tmp.unlink()
            except OSError:
                pass
            send_json(self, {"ok": False, "error": "文件上传不完整，请重试"})
            return
        key = "up-" + h.hexdigest()[:16]
        try:
            send_json(self, transcribe_upload(tmp, key))
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass


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
