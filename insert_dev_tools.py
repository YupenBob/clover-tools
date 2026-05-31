import json

# Load tools.json
with open('tools.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Load new tools definitions
with open('new_dev_tools_defs.json', 'r', encoding='utf-8') as f:
    new_tools = json.load(f)

# Find 开发工具 category index
dev_cat_idx = None
for i, cat in enumerate(data):
    if cat['category'] == '开发工具':
        dev_cat_idx = i
        break

print(f"Found 开发工具 at index {dev_cat_idx}")

if dev_cat_idx is None:
    print("ERROR: 开发工具 category not found!")
    exit(1)

# Get existing tool paths
existing_paths = set(t['path'] for t in data[dev_cat_idx]['tools'])
print(f"Existing develop tools: {len(existing_paths)}")

# Filter out tools that already exist
to_add = [t for t in new_tools if t['path'] not in existing_paths]
print(f"New tools to add: {len(to_add)}")

if to_add:
    data[dev_cat_idx]['tools'] = data[dev_cat_idx]['tools'] + to_add
    
    with open('tools.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully added {len(to_add)} tools")
else:
    print("No new tools to add - all already exist")

print(f"New total in 开发工具: {len(data[dev_cat_idx]['tools'])} tools")

# Verify the new tools have customHtml and customScript
print("\nVerifying new tools have customHtml and customScript:")
for t in to_add:
    has_html = 'customHtml' in t
    has_script = 'customScript' in t
    print(f"  {t['path']}: customHtml={has_html}, customScript={has_script}")