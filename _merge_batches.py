#!/usr/bin/env python3
"""
合并 subagent 产出到 tools.json，并验证 + 写 today-tasks/progress。
"""
import json
import os
import sys

BASE = '/root/.openclaw/workspace/projects/clover-tools-v2'

# Today task id → target category in tools.json
CAT_MAP = {
    't1': '数学计算', 't2': '数学计算', 't3': '数学计算', 't4': '数学计算',
    't5': '文本工具', 't6': '文本工具', 't7': '文本工具', 't8': '文本工具',
    't9': '开发工具', 't10': '开发工具', 't11': '开发工具', 't12': '开发工具',
    't13': '其他工具', 't14': '其他工具', 't15': '其他工具',
    't16': '编码/加密', 't17': '编码/加密', 't18': '编码/加密',
    't19': '生活实用', 't20': '生活实用',
}


def merge():
    with open(os.path.join(BASE, 'tools.json'), 'r') as f:
        data = json.load(f)
    with open(os.path.join(BASE, 'today-tasks.json'), 'r') as f:
        today = json.load(f)

    # Load all batch files
    batches = {}
    for bid in ['A', 'B', 'C', 'D', 'E']:
        path = os.path.join(BASE, f'_subagent-batch-{bid}.json')
        if not os.path.exists(path):
            print(f'⚠️ Missing batch {bid}')
            continue
        with open(path) as f:
            batches[bid] = json.load(f)
        print(f'  ✅ Loaded batch {bid} ({len(batches[bid])} tools)')

    # Flatten with id
    new_tools = {}  # id -> tool entry
    for bid, items in batches.items():
        for t in items:
            new_tools[t['id']] = t

    # Check id coverage
    expected_ids = set(CAT_MAP.keys())
    actual_ids = set(new_tools.keys())
    missing = expected_ids - actual_ids
    if missing:
        print(f'❌ Missing tool IDs: {missing}')
        sys.exit(1)
    print(f'✅ All 20 tools present')

    # Append to tools.json
    cat_index = {c['category']: c for c in data}
    added_count = 0
    for tid, target_cat in CAT_MAP.items():
        tool = new_tools[tid]
        # Validate required fields
        required = ['name', 'path', 'desc', 'keywords', 'customHtml', 'customScript']
        for f in required:
            if f not in tool:
                print(f'❌ {tid} missing {f}')
                sys.exit(1)
        # Add to category
        cat_index[target_cat]['tools'].append(tool)
        added_count += 1
        print(f"  + {tid} → {target_cat}/{tool['path']}")

    # Write back
    with open(os.path.join(BASE, 'tools.json'), 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'\n✅ Added {added_count} tools to tools.json')
    print(f'  New total: {sum(len(c["tools"]) for c in data)} tools')


if __name__ == '__main__':
    merge()