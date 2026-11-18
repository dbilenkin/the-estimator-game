#!/bin/sh
# usage: tools/shot.sh "<page and query>" out.png [width height]   (serves game/ on localhost:8765)
cd "$(dirname "$0")/.." || exit 1
lsof -ti tcp:8765 >/dev/null 2>&1 || (nohup python3 tools/serve.py >/dev/null 2>&1 &)
sleep 0.5
rm -rf /private/tmp/estimator-shot-profile   # a fresh browser profile each time, so no stale cached scripts
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu-sandbox --use-angle=metal --ignore-gpu-blocklist \
  --enable-webgl --hide-scrollbars --window-size=${3:-1600},${4:-1000} --virtual-time-budget=9000 \
  --user-data-dir=/private/tmp/estimator-shot-profile --enable-logging=stderr --v=0 --screenshot="$2" "http://localhost:8765/$1" 2>&1 | grep -E "CONSOLE|Uncaught" | grep -v -i "favicon" | head -8
