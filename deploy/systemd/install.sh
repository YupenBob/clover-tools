#!/usr/bin/env bash
# Install/refresh the systemd timer. Requires sudo.
set -euo pipefail
cd "$(dirname "$0")/../.."
sudo install -m 644 deploy/systemd/clovertools-tool-pipeline.service /etc/systemd/system/
sudo install -m 644 deploy/systemd/clovertools-tool-pipeline.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clovertools-tool-pipeline.timer
systemctl list-timers clovertools-tool-pipeline.timer
