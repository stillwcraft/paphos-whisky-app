#!/usr/bin/env sh
set -eu

requirements_path="backend/requirements.txt"
if [ ! -f "$requirements_path" ]; then
  requirements_path="requirements.txt"
fi

pip install -r "$requirements_path"
PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright \
  python -m playwright install chromium
