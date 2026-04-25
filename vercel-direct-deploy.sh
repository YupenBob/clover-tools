#!/bin/bash
set -e
VERCEL_TOKEN="${VERCEL_TOKEN}"
PROJECT_ID="${VERCEL_PROJECT_ID}"
DIST_DIR="/home/yock/clover-tools-v2/dist"

echo "Deploying dist/ directly to Vercel (no git)..."

# Create zip of dist
WORK_DIR=$(mktemp -d)
cp -r "$DIST_DIR" "$WORK_DIR/dist"
cd "$WORK_DIR" && zip -r dist.zip dist/ 2>/dev/null

# Get upload URL
RESP=$(curl -s -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "clover-tools",
    "project": "'"$PROJECT_ID"'",
    "files": [{"file": "dist.zip", "data": "'$(base64 -w0 dist.zip)'"}],
    "gitSource": {"type": "none"}
  }')

echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('url',''), d.get('id',''), d.get('state',''))"
rm -rf "$WORK_DIR"
