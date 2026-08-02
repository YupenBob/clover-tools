#!/usr/bin/env python3
"""
Sync tool desc/keywords from today-tasks.json into tools.json (use the more SEO-friendly versions).
"""
import json
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace/projects/clover-tools-v2')
TOOLS_JSON = ROOT / 'tools.json'
TASKS_JSON = ROOT / 'today-tasks.json'


def main():
    with open(TOOLS_JSON) as f:
        tools = json.load(f)
    with open(TASKS_JSON) as f:
        tasks = json.load(f)
    
    # Build path -> task map
    by_path = {t['path']: t for t in tasks['tasks']}
    
    updated = 0
    for cat in tools:
        for tool in cat.get('tools', []):
            path = tool.get('path', '')
            if path in by_path:
                t = by_path[path]
                # Use today-tasks.json's desc (more detailed SEO)
                if t.get('desc'):
                    tool['desc'] = t['desc']
                if t.get('keywords'):
                    tool['keywords'] = t['keywords']
                # Also keep 'description' in sync (for some tools)
                if 'description' in tool:
                    tool['description'] = t.get('desc', tool['description'])
                updated += 1
                print(f"  Sync: {path}")
    
    with open(TOOLS_JSON, 'w') as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)
    print(f"\nUpdated {updated} tools, saved {TOOLS_JSON}")


if __name__ == '__main__':
    main()
