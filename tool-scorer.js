#!/usr/bin/env node
/**
 * tool-scorer.js
 * 根据 SEO 优先 + 竞品为辅的原则，为每日工具生成评分排序
 * 
 * 评分维度：
 * 1. searchVolume (高/中/低) - 搜索量，代表 SEO 价值
 * 2. static (true/false) - 是否纯前端可实现
 * 3. difficulty (easy/medium/hard) - 难度，影响生产速度
 * 4. category - 不同分类优先级不同
 * 
 * 输出：今日建议工具列表（Top N）
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const COMPETITOR_FILE = path.join(__dirname, 'competitor-tools.json');
const TOOLS_FILE = path.join(__dirname, 'tools.json');
const PROGRESS_FILE = '/root/.openclaw/workspace/projects/clover-tools-v2/progress-clover-tools-v2.json';
const OUTPUT_FILE = path.join(__dirname, 'today-recommended-tools.json');

const TOP_N = 20; // 每日生成数量

// ============ 分类权重 ============
// 优先级：开发工具 > 文本工具 > 编码/加密 > 格式转换 > 生活实用 > 网络工具 > 数学计算 > 时间工具
const CATEGORY_WEIGHTS = {
  '开发工具': 10,
  '文本工具': 9,
  '编码/加密': 8,
  '格式转换': 7,
  '生活实用': 6,
  '网络工具': 5,
  '数学计算': 4,
  '时间工具': 3,
  'other': 2,
};

// ============ 搜索量权重 ============
const SEARCH_VOLUME_WEIGHTS = {
  'high': 100,
  'medium': 50,
  'low': 10,
  'unknown': 5,
};

// ============ 难度权重（越简单越高优先级）============
const DIFFICULTY_WEIGHTS = {
  'easy': 10,
  'medium': 5,
  'hard': 2,
  'unknown': 3,
};

// ============ 工具类型权重（越高越靠前）============
const TOOL_TYPE_WEIGHTS = {
  'formatter': 8,   // 格式化 - 高频
  'converter': 8,   // 转换器 - 高频
  'generator': 7,   // 生成器 - 高频
  'encoder': 7,     // 编码器 - 高频
  'calculator': 6, // 计算器 - 中频
  'decoder': 6,     // 解码器 - 中频
  'query': 5,      // 查询类
  'validate': 5,   // 校验类
  'diff': 4,       // 对比类
  'parse': 4,      // 解析类
  'minify': 4,     // 压缩类
  'other': 3,
};

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 主评分函数
 * score = searchVolumeWeight * categoryWeight * staticMultiplier * difficultyWeight
 * - static=true → 纯前端，乘以 1.2（优先）
 * - static=false → 需后端，乘以 0.6（降低）
 */
function scoreTool(tool, category) {
  const searchVolume = SEARCH_VOLUME_WEIGHTS[tool.searchVolume] || SEARCH_VOLUME_WEIGHTS['unknown'];
  const categoryWeight = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS['other'];
  const difficulty = DIFFICULTY_WEIGHTS[tool.difficulty] || DIFFICULTY_WEIGHTS['unknown'];
  
  const staticMultiplier = tool.static ? 1.2 : 0.6;
  
  // 工具类型权重
  const toolType = tool.type || 'other';
  const typeWeight = TOOL_TYPE_WEIGHTS[toolType] || TOOL_TYPE_WEIGHTS['other'];
  
  const score = searchVolume * categoryWeight * staticMultiplier * difficulty * typeWeight;
  
  return {
    score,
    breakdown: {
      searchVolume: tool.searchVolume || 'unknown',
      category,
      static: tool.static,
      difficulty: tool.difficulty || 'unknown',
      type: toolType,
    }
  };
}

/**
 * 获取已收录工具名（用于排除）
 */
function getExistingToolNames() {
  try {
    const tools = loadJSON(TOOLS_FILE);
    return new Set(tools.map(t => t.name));
  } catch (e) {
    console.warn('无法读取 tools.json:', e.message);
    return new Set();
  }
}

/**
 * 获取今日已完成的工具名（用于排除）
 */
function getTodayCompletedToolNames() {
  try {
    const progress = loadJSON(PROGRESS_FILE);
    const today = new Date().toISOString().split('T')[0];
    
    // 从 history 里找今天的记录
    const todayHistory = progress.history?.filter(h => h.date === today);
    const todayTools = new Set();
    
    for (const record of todayHistory) {
      if (record.passed) {
        for (const name of record.passed) {
          todayTools.add(name);
        }
      }
    }
    
    console.log(`📅 今日已完成工具: ${todayTools.size} 个`);
    return todayTools;
  } catch (e) {
    console.warn('无法读取 progress 文件:', e.message);
    return new Set();
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始分析竞品工具数据...\n');
  
  const competitor = loadJSON(COMPETITOR_FILE);
  const existingTools = getExistingToolNames();
  const todayCompleted = getTodayCompletedToolNames();
  
  // 1. 从 priorityList 获取高 SEO 价值工具
  const priorityList = competitor.priorityList || [];
  console.log(`📊 priorityList: ${priorityList.length} 个工具`);
  
  // 2. 从 categories.missing 获取所有缺失工具
  const allMissing = [];
  for (const [category, info] of Object.entries(competitor.categories || {})) {
    const missing = info.missing || [];
    for (const tool of missing) {
      if (!existingTools.has(tool.name)) {
        allMissing.push({ ...tool, _category: category });
      }
    }
  }
  console.log(`📊 全部缺失工具: ${allMissing.length} 个（去重前）`);
  
  // 去重（priorityList 和 categories.missing 可能有重叠）
  const priorityNames = new Set(priorityList.map(t => t.name));
  const uniqueMissing = allMissing.filter(t => !priorityNames.has(t.name));
  
  // 3. 合并评分
  const allCandidates = [];
  
  // priorityList 工具（带 searchVolume）
  for (const tool of priorityList) {
    if (existingTools.has(tool.name) || todayCompleted.has(tool.name)) continue;
    
    const category = tool.category?.split('/')[0] || 'other';
    const { score, breakdown } = scoreTool(tool, category);
    
    allCandidates.push({
      name: tool.name,
      category,
      source: tool.source || 'priorityList',
      desc: tool.desc || '',
      searchVolume: tool.searchVolume || 'unknown',
      static: tool.static ?? null,
      difficulty: tool.difficulty || null,
      tech: tool.tech || '',
      reason: tool.reason || '',
      score,
      breakdown,
    });
  }
  
  // categories.missing 工具（不带 searchVolume，用 unknown）
  for (const tool of uniqueMissing) {
    if (todayCompleted.has(tool.name)) continue;
    const category = tool._category;
    const { score, breakdown } = scoreTool(tool, category);
    
    allCandidates.push({
      name: tool.name,
      category,
      source: 'categories.missing',
      desc: tool.desc || '',
      searchVolume: 'unknown',
      static: tool.static ?? null,
      difficulty: tool.difficulty || null,
      tech: tool.tech || '',
      reason: tool.reason || '',
      score,
      breakdown,
    });
  }
  
  console.log(`📊 候选工具总数: ${allCandidates.length} 个`);
  
  // 4. 排序
  allCandidates.sort((a, b) => b.score - a.score);
  
  // 5. 取 Top N
  const topTools = allCandidates.slice(0, TOP_N);
  
  // 6. 分类统计
  const byCategory = {};
  for (const tool of topTools) {
    if (!byCategory[tool.category]) byCategory[tool.category] = 0;
    byCategory[tool.category]++;
  }
  
  // 7. 输出
  console.log('\n🏆 今日推荐工具（Top 20）：');
  console.log('=' .repeat(60));
  
  for (let i = 0; i < topTools.length; i++) {
    const t = topTools[i];
    console.log(`${i+1}. [${t.category}] ${t.name}`);
    console.log(`   SEO价值:${t.searchVolume} | 纯前端:${t.static} | 难度:${t.difficulty || '?'} | 分数:${t.score}`);
    if (t.tech) console.log(`   技术:${t.tech}`);
    console.log();
  }
  
  console.log('\n📦 分类分布：');
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${count}个`);
  }
  
  // 8. 保存结果
  const output = {
    date: new Date().toISOString().split('T')[0],
    totalCandidates: allCandidates.length,
    topTools,
    summary: {
      byCategory,
      total: topTools.length,
    }
  };
  
  saveJSON(OUTPUT_FILE, output);
  console.log(`\n💾 结果已保存: ${OUTPUT_FILE}`);
  
  return output;
}

main();
