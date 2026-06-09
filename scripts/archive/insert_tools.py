import json

# Load existing tools.json
with open('tools.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Load new tools
with open('new_develop_tools.json', 'r', encoding='utf-8') as f:
    new_tools = json.load(f)

# Find 开发工具 category
dev_cat = None
for cat in data:
    if cat['category'] == '开发工具':
        dev_cat = cat
        break

if dev_cat is None:
    print("ERROR: 开发工具 category not found!")
    exit(1)

print(f"Current 开发工具 count: {len(dev_cat['tools'])}")

# Insert new tools
dev_cat['tools'].extend(new_tools)

print(f"New 开发工具 count: {len(dev_cat['tools'])}")

# Save
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Successfully added {len(new_tools)} tools to 开发工具")
print("Verifying...")

# Verify
with open('tools.json', 'r', encoding='utf-8') as f:
    verify = json.load(f)
    
dev_cat_v = next((c for c in verify if c['category'] == '开发工具'), None)
print(f"Verified count: {len(dev_cat_v['tools'])}")

# List the new tools
print("\nNew tools added:")
for t in new_tools:
    print(f"  - {t['name']} ({t['path']})")