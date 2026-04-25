#!/bin/bash
# Direct Vercel API deployment - no git push needed
set -e

VERCEL_TOKEN="${VERCEL_TOKEN}"
PROJECT_ID="${VERCEL_PROJECT_ID}"
TEAM_ID="${VERCEL_ORG_ID}"

# Read GITHUB_TOKEN from .env if not set
if [ -z "$GITHUB_TOKEN" ]; then
  GITHUB_TOKEN=$(grep "GITHUB_TOKEN" ~/.openclaw/workspace/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"')
fi

echo "Deploying to Vercel..."
echo "Token set: $(test -n "$VERCEL_TOKEN" && echo YES || echo NO)"
echo "Project: $VERCEL_PROJECT_ID"

# List recent deployments to check API access
curl -s "https://api.vercel.com/v6/deployments?projectId=$VERCEL_PROJECT_ID&limit=3" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    for dep in d.get('deployments', []):
        print(dep.get('uid','')[:8], dep.get('state',''), dep.get('url',''))
except: print('API error or no deployments')
"
