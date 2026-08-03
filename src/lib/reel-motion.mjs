/**
 * 老虎机转轮运动规划（单一事实来源：页面 + 测试脚本共用）
 *
 * 设计要点（用户方案）：
 * - 转速曲线全程连续：匀加速启动 → 匀速快转 → 匀减速到 0 → 小段 easeInOut 回位，
 *   任意时刻速度不跳变（不忽快忽慢）。
 * - 从一开始就按目标解出快转时长，保证自然停点 ≡ 目标 ± 随机偏移（mod 一组）。
 * - 过冲/欠冲是概率事件：每次随机偏移 [-0.6, +1.2] 行，随后回位精确到目标行。
 */

export const FAST_ROWS_PER_SEC = 14; // 快转速度（行/秒）
export const ACCEL_MS = 300; // 匀加速启动段
export const DECEL_MS = 1100; // 匀减速时长
export const ROLLBACK_MS = 320; // 回位时长
export const MIN_FAST_MS = 500; // 快转最短时长

/**
 * 规划一次转轮运动。
 * @param {{n:number,rowH:number,centerOffset:number,targetIdx:number,rand?:()=>number}} opts
 * @returns {{n,rowH,setH,centerOffset,targetIdx,targetMod,offset,offsetRows,vMax,aUp,a,start,Tacc,T_fastEnd,T1,T2,TR,stopAbs,targetAbs}}
 */
export function planReel({ n, rowH, centerOffset, targetIdx, rand = Math.random }) {
  const setH = n * rowH;
  const targetMod = (((targetIdx * rowH - centerOffset) % setH) + setH) % setH;
  const offsetRows = rand() * 1.8 - 0.6; // [-0.6, +1.2] 行：欠冲/过冲概率事件
  const offset = offsetRows * rowH;
  const speedF = 0.92 + rand() * 0.16; // 快转速度 ±8%
  const vMax = (FAST_ROWS_PER_SEC * rowH * speedF) / 1000; // px/ms
  const aUp = vMax / ACCEL_MS; // 匀加速
  const a = vMax / DECEL_MS; // 匀减速
  const accelDist = 0.5 * vMax * ACCEL_MS; // 加速段距离
  const decelDist = (vMax * vMax) / (2 * a); // = vMax*DECEL_MS/2
  const start = rand() * setH;
  const desiredMod = (((targetMod + offset) % setH) + setH) % setH;
  // 快转时长：使 总距离(start→自然停) ≡ desiredMod (mod setH)
  let T1 = ((((desiredMod - start - accelDist - decelDist) % setH) + setH) % setH) / vMax;
  const oneSetFast = setH / vMax;
  if (T1 < MIN_FAST_MS) T1 += oneSetFast;
  const Tacc = ACCEL_MS;
  const T_fastEnd = Tacc + T1;
  const T2 = T_fastEnd + DECEL_MS;
  const TR = ROLLBACK_MS;
  const stopAbs = start + accelDist + vMax * T1 + decelDist; // 自然停点（速度归零处）
  const targetAbs = stopAbs - offset; // 回位后的精确落点
  return { n, rowH, setH, centerOffset, targetIdx, targetMod, offset, offsetRows, vMax, aUp, a, start, Tacc, T_fastEnd, T1, T2, TR, stopAbs, targetAbs };
}

/**
 * 采样时刻 t（ms）的位置/速度/阶段。
 * @returns {{p:number,v:number,phase:'ramp'|'fast'|'decel'|'rollback'|'done'}}
 */
export function reelSample(plan, t) {
  const { vMax, aUp, a, start, Tacc, T_fastEnd, T2, TR, stopAbs, targetAbs } = plan;
  if (t < Tacc) {
    return { p: start + 0.5 * aUp * t * t, v: aUp * t, phase: 'ramp' };
  }
  if (t < T_fastEnd) {
    return { p: start + 0.5 * vMax * Tacc + vMax * (t - Tacc), v: vMax, phase: 'fast' };
  }
  if (t <= T2) {
    const tau = t - T_fastEnd;
    return {
      p: start + 0.5 * vMax * Tacc + vMax * (T_fastEnd - Tacc) + vMax * tau - 0.5 * a * tau * tau,
      v: vMax - a * tau,
      phase: 'decel',
    };
  }
  if (t <= T2 + TR) {
    const s = (t - T2) / TR;
    const e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
    const slope = s < 0.5 ? 4 * s : 4 * (1 - s);
    return {
      p: stopAbs + (targetAbs - stopAbs) * e,
      v: ((targetAbs - stopAbs) / TR) * slope,
      phase: 'rollback',
    };
  }
  return { p: targetAbs, v: 0, phase: 'done' };
}

/** 位置对一组高度取模（内容按组重复，渲染用） */
export function modSet(p, setH) {
  return ((p % setH) + setH) % setH;
}
