#!/usr/bin/env python3
"""
Fix missing TDK (Title/Description/Keywords) in tool pages.
Auto-generates SEO TDK for any file missing them.
"""
import re
from pathlib import Path

BASE = Path('/home/yock/clover-tools-v2/dist/tools')

# Category display names
CAT_NAMES = {
    'code': '在线代码开发工具',
    'encrypt': '在线加密解密工具',
    'json': 'JSON 数据处理工具',
    'life': '生活实用工具',
    'text': '文本处理工具',
    'time': '在线时间日期工具',
}

def auto_tdk(key):
    """Auto-generate description and keywords from path"""
    parts = key.split('/')
    category = parts[0]
    name_raw = parts[1].replace('-', ' ').replace('_', ' ')
    name_title = name_raw.title()
    cat_name = CAT_NAMES.get(category, '在线工具')
    
    # Build description
    desc_templates = [
        f'{name_title}在线工具，无需注册，完全免费。',
    ]
    desc = desc_templates[0]
    
    # Build keywords
    keywords = f'{name_title}，{name_raw}，{cat_name}，在线工具，免费'
    
    return (desc, keywords)


def has_meta_description(content):
    pattern = r'<meta name="description" content="([^"]+)"'
    match = re.search(pattern, content)
    if match:
        content_text = match.group(1)
        if content_text and '{{' not in content_text and len(content_text) > 5:
            return True
    return False


def has_meta_keywords(content):
    pattern = r'<meta name="keywords" content="([^"]+)"'
    match = re.search(pattern, content)
    if match:
        content_text = match.group(1)
        if content_text and '{{' not in content_text and len(content_text) > 3:
            return True
    return False


def inject_tdk(filepath, desc, keywords):
    """Inject description and keywords meta tags"""
    try:
        content = filepath.read_text(encoding='utf-8')
        
        if has_meta_description(content) and has_meta_keywords(content):
            return False, "already has TDK"
        
        if '<meta name="description"' in content:
            content = re.sub(
                r'<meta name="description" content="[^"]*"',
                f'<meta name="description" content="{desc}">',
                content
            )
        else:
            content = re.sub(
                r'(<meta name="viewport"[^>]*>)',
                f'\\1\n  <meta name="description" content="{desc}">',
                content
            )
        
        if '<meta name="keywords"' in content:
            content = re.sub(
                r'<meta name="keywords" content="[^"]*"',
                f'<meta name="keywords" content="{keywords}">',
                content
            )
        else:
            content = re.sub(
                r'(<meta name="description" content="[^"]*">)',
                f'\\1\n  <meta name="keywords" content="{keywords}">',
                content
            )
        
        filepath.write_text(content, encoding='utf-8')
        return True, "injected"
    except Exception as e:
        return False, str(e)


def main():
    fixed = []
    already_ok = []
    skipped = []
    
    for html_file in sorted(BASE.rglob('*.html')):
        relpath = html_file.relative_to(BASE)
        key = str(relpath).replace('\\', '/').replace('.html', '')
        
        if html_file.name == 'index.html':
            continue
        
        content = html_file.read_text(encoding='utf-8')
        
        if has_meta_description(content) and has_meta_keywords(content):
            already_ok.append(key)
            continue
        
        desc, keywords = auto_tdk(key)
        changed, result = inject_tdk(html_file, desc, keywords)
        if changed:
            fixed.append((key, desc[:40]))
        else:
            skipped.append((key, result))
    
    print(f"✅ Fixed: {len(fixed)} files")
    for k, d in fixed[:15]:
        print(f"   - {k}")
    if len(fixed) > 15:
        print(f"   ... and {len(fixed)-15} more")
    
    print(f"\n⚠️  Skipped: {len(skipped)}")
    for k, r in skipped[:5]:
        print(f"   - {k}: {r}")
    if len(skipped) > 5:
        print(f"   ... and {len(skipped)-5} more")
    
    print(f"\n✅ Already OK: {len(already_ok)} files")
    return fixed, already_ok, skipped

if __name__ == '__main__':
    main()
