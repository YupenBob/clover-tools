#!/usr/bin/env python3
import re, json

with open('generator.js', 'r') as f:
    content = f.read()

# Find buildToolScript function
scripts_match = re.search(r"function buildToolScript\(tool\) \{([\s\S]*?)^\}", content, re.MULTILINE)
if scripts_match:
    scripts_body = scripts_match.group(1)
    script_keys = re.findall(r"'([^']+)':", scripts_body)
    # Filter to only the ones that are inside the scripts object (not nested)
    print(f'Script keys in buildToolScript: {len(script_keys)}')
else:
    script_keys = []
    print('Could not find buildToolScript')

# Find buildToolContentHtml function  
contents_match = re.search(r"function buildToolContentHtml\(tool\) \{([\s\S]*?)^\}", content, re.MULTILINE)
if contents_match:
    contents_body = contents_match.group(1)
    content_keys = re.findall(r"'([^']+)':", contents_body)
    print(f'Content keys in buildToolContentHtml: {len(content_keys)}')
else:
    content_keys = []
    print('Could not find buildToolContentHtml')

with open('tools.json', 'r') as f:
    tools_data = json.load(f)

all_tools = []
for cat in tools_data:
    for tool in cat['tools']:
        all_tools.append(tool['path'].replace('.html', ''))

print(f'Total tools in tools.json: {len(all_tools)}')

# Find tools without script entries
missing_scripts = [t for t in all_tools if t not in script_keys]
print(f'Missing script entries: {len(missing_scripts)}')
if missing_scripts:
    print('Missing tools (first 30):', missing_scripts[:30])

# Find tools without content entries
missing_contents = [t for t in all_tools if t not in content_keys]
print(f'Missing content entries: {len(missing_contents)}')
if missing_contents:
    print('Missing content (first 30):', missing_contents[:30])
