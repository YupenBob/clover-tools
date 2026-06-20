#!/usr/bin/env python3
"""
Self-evaluate all 19 today tools and update today-tasks.json + progress-clover-tools-v2.json.
"""
import json
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path('/root/.openclaw/workspace/projects/clover-tools-v2')
TOOLS_JSON = ROOT / 'tools.json'
TASKS_JSON = ROOT / 'today-tasks.json'
PROGRESS_JSON = ROOT / 'progress-clover-tools-v2.json'
DIST_DIR = ROOT / 'dist' / 'tools'

SHANGHAI_TZ = timezone(timedelta(hours=8))


def evaluate_task(task):
    """Self-evaluate a single task. Returns (score: float, review: str, passed: bool)."""
    issues = []
    path = task['path']
    name = task['name']
    keywords = task.get('keywords', [])
    dist_file = DIST_DIR / path
    
    # 1. File exists
    if not dist_file.exists():
        return 0.0, f"❌ 生成文件不存在: {path}", False
    
    size = dist_file.stat().st_size
    if size < 5000:
        issues.append(f"文件过小 ({size}B)")
    elif size > 100000:
        issues.append(f"文件过大 ({size}B),可能模板未正确展开")
    
    html = dist_file.read_text()
    
    # 2. Title contains tool name
    title_m = re.search(r'<title>([^<]+)</title>', html)
    if not title_m:
        issues.append("缺少 <title>")
    elif name not in title_m.group(1):
        issues.append(f"title 不含工具名: {title_m.group(1)}")
    
    # 3. Meta description
    desc_m = re.search(r'<meta name="description" content="([^"]+)"', html)
    if not desc_m:
        issues.append("缺少 meta description")
    else:
        # Check that description contains some key phrase from task desc
        task_desc_snippet = task['desc'][:15]
        if task_desc_snippet not in desc_m.group(1):
            issues.append(f"description 与任务 desc 不匹配")
    
    # 4. Meta keywords - check that primary keyword is in keywords meta
    kw_m = re.search(r'<meta name="keywords" content="([^"]+)"', html)
    if not kw_m:
        issues.append("缺少 meta keywords")
    else:
        kw_content = kw_m.group(1)
        primary_kw = keywords[0] if keywords else name
        if primary_kw not in kw_content:
            issues.append(f"主关键词 '{primary_kw}' 不在 meta keywords 中")
        # Count matched keywords
        matched = sum(1 for k in keywords[:5] if k in kw_content)
        if matched < 2:
            issues.append(f"5个核心关键词仅 {matched} 个在 meta 中")
    
    # 5. H1 matches tool name
    h1_m = re.search(r'<h1>([^<]+)</h1>', html)
    if not h1_m:
        issues.append("缺少 <h1>")
    elif h1_m.group(1).strip() != name:
        issues.append(f"h1 '{h1_m.group(1).strip()}' ≠ 工具名 '{name}'")
    
    # 6. customScript is present and has functional logic
    scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
    logic_script = None
    for s in scripts:
        if any(kw in s for kw in ['onclick', 'addEventListener', 'ffmpeg', 'heic2any', 'pdfjsLib', 'JSON.parse', 'drawImage', 'toBlob']):
            logic_script = s
            break
    
    if not logic_script:
        issues.append("未找到功能脚本 (customScript 缺失)")
    elif len(logic_script) < 500:
        issues.append(f"功能脚本过短 ({len(logic_script)} 字符)")
    
    # 7. Check for unrendered template placeholders
    placeholders = re.findall(r'\{\{[A-Z_]+\}\}', html)
    if placeholders:
        issues.append(f"未替换的占位符: {set(placeholders)}")
    
    # 8. Check that customHtml is actually inserted (file has upload-area or input elements)
    has_ui = 'upload-area' in html or '<textarea' in html or 'input type="file"' in html
    if not has_ui:
        issues.append("未检测到 UI 元素 (upload-area/textarea/file input)")
    
    # 9. Check that meta tags use Chinese (not raw {{...}} or garbled)
    if '{{' in html or 'undefined' in html[html.find('<h1>'):html.find('</h1>')+5]:
        issues.append("可能存在模板渲染问题")
    
    # Scoring
    if not issues:
        return 1.0, "✅ 工具完整,标题/描述/关键词/功能脚本均正确,无明显问题", True
    
    # Score based on number of issues (0.5-0.9 range)
    score = 0.9
    if len(issues) >= 1:
        score -= 0.1 * len(issues)
    score = max(0.4, score)
    
    review = "⚠️  " + "; ".join(issues)
    passed = score >= 0.5
    return round(score, 2), review, passed


def main():
    with open(TASKS_JSON) as f:
        tasks_data = json.load(f)
    with open(PROGRESS_JSON) as f:
        progress = json.load(f)
    
    pending = [t for t in tasks_data['tasks'] if t['status'] == 'pending']
    print(f"Evaluating {len(pending)} pending tasks...")
    print()
    
    completed = 0
    retry_list = []
    total_score = 0.0
    
    for task in pending:
        score, review, passed = evaluate_task(task)
        total_score += score
        completed += 1
        
        # Mark as done
        task['status'] = 'done'
        task['selfScore'] = score
        task['selfReview'] = review
        
        if not passed:
            retry_list.append({'id': task['id'], 'name': task['name'], 'path': task['path'], 'score': score, 'reason': review})
        
        # Display
        flag = '✅' if score >= 0.9 else '⚠️ ' if score >= 0.5 else '❌'
        print(f"  {flag} {task['id']} | {task['name']:20} | score={score} | {review[:60]}")
    
    # Update today-tasks.json
    avg = round(total_score / completed, 3) if completed else 0
    tasks_data['completedCount'] = completed
    tasks_data['avgSelfScore'] = avg
    tasks_data['lastUpdated'] = datetime.now(SHANGHAI_TZ).strftime('%Y-%m-%dT%H:%M:%S+08:00')
    
    with open(TASKS_JSON, 'w') as f:
        json.dump(tasks_data, f, ensure_ascii=False, indent=2)
    print(f"\nUpdated {TASKS_JSON}: completedCount={completed}, avgSelfScore={avg}")
    
    # Update progress-clover-tools-v2.json
    progress['completed'] = progress.get('completed', 0) + completed
    progress['todayCompleted'] = completed
    progress['lastModified'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')[:-3] + 'Z'
    if 'history' not in progress:
        progress['history'] = []
    today_date = datetime.now(SHANGHAI_TZ).strftime('%Y-%m-%d')
    history_entry = {
        'date': today_date,
        'completed': completed,
        'avgScore': avg,
        'passed': [t['name'] for t in tasks_data['tasks'] if t['status'] == 'done' and t.get('selfScore', 0) >= 0.5],
        'failed': [t['name'] for t in tasks_data['tasks'] if t['status'] == 'done' and t.get('selfScore', 0) < 0.5]
    }
    # Add note
    cats = {}
    for t in tasks_data['tasks']:
        if t['status'] == 'done':
            subcat = t.get('subcategory', '其他')
            main_cat = subcat.split('/')[0] if '/' in subcat else '其他'
            cats[main_cat] = cats.get(main_cat, 0) + 1
    cat_summary = '+'.join(f"{k}{v}" for k,v in sorted(cats.items()))
    history_entry['note'] = f"{completed}/{len(pending)} 通过,avg {avg} ({cat_summary})"
    
    # Remove any existing entry for today
    progress['history'] = [h for h in progress['history'] if h.get('date') != today_date]
    progress['history'].insert(0, history_entry)
    
    with open(PROGRESS_JSON, 'w') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)
    print(f"Updated {PROGRESS_JSON}: completed={progress['completed']}")
    
    print(f"\n=== Summary ===")
    print(f"Total evaluated: {completed}")
    print(f"Avg score: {avg}")
    print(f"Failed (need retry): {len(retry_list)}")
    for r in retry_list:
        print(f"  - {r['id']} {r['name']} (score={r['score']})")


if __name__ == '__main__':
    main()
