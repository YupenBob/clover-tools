/**
 * Add icon field to each tool in tools.json
 * Uses Bootstrap Icons (free, CDN)
 */
const fs = require('fs');

const tools = JSON.parse(fs.readFileSync('/home/yock/clover-tools-v2/tools.json', 'utf8'));

// Category → Bootstrap Icon mapping
const CATEGORY_ICON_MAP = {
  '格式转换':   'bi bi-file-earning-fill',
  '开发工具':   'bi bi-code-slash',
  '编码/加密':  'bi bi-shield-lock-fill',
  '文本工具':   'bi bi-body-text',
  '时间工具':   'bi bi-clock-fill',
  '生活实用':   'bi bi-house-heart-fill',
  '数学计算':   'bi bi-calculator',
  '网络工具':   'bi bi-globe2',
};

let addedCount = 0;

tools.forEach(cat => {
  const iconClass = CATEGORY_ICON_MAP[cat.category] || 'bi bi-star-fill';
  cat.tools.forEach(tool => {
    if (!tool.icon) {
      tool.icon = iconClass;
      addedCount++;
    }
  });
});

fs.writeFileSync('/home/yock/clover-tools-v2/tools.json', JSON.stringify(tools, null, 2));
console.log(`Added icon to ${addedCount} tools.`);
