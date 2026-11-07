#!/bin/bash
# 识别服务看门狗：进程退出后自动拉起，日志写到 /var/log/weidan-server.log
cd /workspace/menu-app/server
while true; do
  HF_ENDPOINT=https://hf-mirror.com WHISPER_MODEL=small \
    python3 server.py >> /var/log/weidan-server.log 2>&1
  echo "$(date '+%F %T') server exited, restarting in 3s" >> /var/log/weidan-server.log
  sleep 3
done
