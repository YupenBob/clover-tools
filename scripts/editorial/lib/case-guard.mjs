/**
 * 截图用例静态闸门：模型写的 case 脚本在**主仓权限进程**里执行前，先做语法级禁止项扫描。
 *
 * 这不是完备沙箱（真正的隔离在 capture-child 的 namespace/permission 模型里），
 * 目的是把「明显不该出现在截图用例里的能力」挡在门外：文件系统、子进程、网络、环境变量、动态执行。
 */
import { readFileSync } from 'node:fs';

const FORBIDDEN = [
  { pattern: /\brequire\s*\(/, reason: 'require()' },
  { pattern: /\bimport\s*\(/, reason: '动态 import()' },
  { pattern: /\bprocess\s*\.\s*env\b/, reason: 'process.env' },
  { pattern: /\bprocess\s*\.\s*binding\b/, reason: 'process.binding' },
  { pattern: /\bchild_process\b/, reason: 'child_process' },
  { pattern: /\bnode:(fs|net|http|https|dgram|dns|tls|child_process|worker_threads|cluster|vm)\b/, reason: '危险内置模块' },
  { pattern: /\bnode:(fs|net|http|https)\b/, reason: '危险内置模块' },
  { pattern: /\beval\s*\(/, reason: 'eval()' },
  { pattern: /\bnew\s+Function\s*\(/, reason: 'new Function()' },
  { pattern: /\bglobalThis\s*\.\s*process\b/, reason: 'globalThis.process' },
  { pattern: /\bimport\s*\.\s*meta\b/, reason: 'import.meta（可读 argv/env）' },
  { pattern: /\bfetch\s*\(/, reason: 'fetch()' },
  { pattern: /\bXMLHttpRequest\b/, reason: 'XMLHttpRequest' },
  { pattern: /\bWebSocket\b/, reason: 'WebSocket' },
  { pattern: /\bwriteFile|readFile|createReadStream|createWriteStream/, reason: '文件读写 API' },
];

/** @returns {{ok: boolean, violations: Array<{reason: string, line: number, text: string}>}} */
export function scanCaseSource(source) {
  const violations = [];
  const lines = String(source).split('\n');
  for (const [index, line] of lines.entries()) {
    const stripped = line.replace(/\/\/.*$/, '');
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(stripped)) {
        violations.push({ reason: rule.reason, line: index + 1, text: line.trim().slice(0, 160) });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function scanCaseFile(file) {
  return scanCaseSource(readFileSync(file, 'utf8'));
}
