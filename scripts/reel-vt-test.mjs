/**
 * 转轮 v-t（速度-时间）数据记录脚本
 *
 * 用途：把转盘运动的 时间-速度-位置-模糊 逐帧记录下来，输出 CSV 供研究，
 * 并校验三项运动学指标：
 *   1) 落点精度：回位后与目标行偏差 < 1e-6 px
 *   2) 自然停点：速度归零处 ≡ 目标 ± 随机偏移（过冲/欠冲为概率事件）
 *   3) 速度连续性：相邻帧速度差 < 阈值（转速不忽快忽慢）
 *
 * 用法：node scripts/reel-vt-test.mjs [spinCount]
 * 输出：data/reel-profiles/reel-vt-<时间戳>.csv
 */
import { planReel, reelSample, modSet } from '../src/lib/reel-motion.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spins = Number(process.argv[2] || 5);
const DT_MS = 1000 / 60; // 模拟 60fps 帧间隔
const MAX_FRAME_DV_PX_S = 150; // 每帧速度变化上限（px/s）
const EPS = 1e-6;

const dir = join(root, 'data', 'reel-profiles');
mkdirSync(dir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const file = join(dir, `reel-vt-${ts}.csv`);
const lines = ['trial,t_ms,phase,v_px_s,pos_px,pos_mod,blur'];

let failed = 0;
const summaries = [];

for (let trial = 1; trial <= spins; trial++) {
  const n = 4 + Math.floor(Math.random() * 17);
  const rowH = trial % 2 === 0 ? 60 : 52;
  const centerOffset = rowH === 60 ? 90 : 79;
  const targetIdx = Math.floor(Math.random() * n);
  const plan = planReel({ n, rowH, centerOffset, targetIdx });

  let prevV = 0;
  let maxFrameDv = 0;
  let maxBlur = 0;
  let minBlur = 99;
  let t = 0;
  const end = plan.T2 + plan.TR + 60;
  let lastPhase = '';

  while (t <= end) {
    const s = reelSample(plan, t);
    const vps = s.v * 1000;
    const dv = Math.abs(vps - prevV);
    if (dv > maxFrameDv) maxFrameDv = dv;
    prevV = vps;
    const blur = Math.min(3.5, Math.abs(s.v) / plan.vMax * 3.5);
    maxBlur = Math.max(maxBlur, blur);
    minBlur = Math.min(minBlur, blur);
    if (s.phase !== lastPhase) {
      lines.push([trial, t.toFixed(2), `>${s.phase}`, vps.toFixed(1), s.p.toFixed(2), modSet(s.p, plan.setH).toFixed(2), blur.toFixed(2)].join(','));
      lastPhase = s.phase;
    }
    lines.push([trial, t.toFixed(2), s.phase, vps.toFixed(1), s.p.toFixed(2), modSet(s.p, plan.setH).toFixed(2), blur.toFixed(2)].join(','));
    t += DT_MS;
  }

  const stopMod = modSet(plan.stopAbs, plan.setH);
  const desiredMod = modSet(plan.targetMod + plan.offset, plan.setH);
  const landedMod = modSet(plan.targetAbs, plan.setH);
  const stopErr = Math.abs(stopMod - desiredMod);
  const landErr = Math.abs(landedMod - plan.targetMod);
  const ok = stopErr < EPS && landErr < EPS && maxFrameDv < MAX_FRAME_DV_PX_S;
  if (!ok) failed++;

  summaries.push({
    trial,
    n,
    rowH,
    targetIdx,
    offsetRows: +plan.offsetRows.toFixed(2),
    stopErr: stopErr.toExponential(2),
    landErr: landErr.toExponential(2),
    maxFrameDv: +maxFrameDv.toFixed(1),
    maxBlur: +maxBlur.toFixed(2),
    minBlur: +minBlur.toFixed(2),
    totalMs: Math.round(plan.T2 + plan.TR),
    ok,
  });
}

writeFileSync(file, lines.join('\n') + '\n', 'utf8');

console.log(`已记录 ${spins} 次转动的 v-t 数据 → ${file}`);
console.table(summaries);
if (failed > 0) {
  console.error(`校验失败：${failed}/${spins} 次转动不满足运动学指标`);
  process.exit(1);
}
console.log(`校验通过：${spins}/${spins} 次转动落点精确、停点=目标±随机偏移、帧间速度连续`);
