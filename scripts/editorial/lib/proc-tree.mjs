/**
 * 进程清理工具：runner 超时/异常后的「零残留」收口。
 *
 * 设计前提（2026-11-20 实测）：
 * - 本机 /sys/fs/cgroup 不可写，无法用 cgroup 承载整次调用；
 * - 但 rootless PID namespace 可用（`unshare -Urpf --mount-proc --kill-child=SIGKILL`），
 *   因此 supervisor 把整次外部调用放进独立 namespace：namespace 的 PID 1 死掉，内核会清空该 namespace 内全部进程；
 * - 保底：再按「工作目录/打开的文件/命令行」扫 /proc，杀掉仍指向本次 attempt 目录的进程。
 */
import { readdirSync, readFileSync, readlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SIGNAL_GRACE_MS = 5000;

function readStat(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    const fields = stat.slice(close + 2).split(' ');
    // fields[0]=state, [1]=ppid, [2]=pgrp, [3]=session, [19]=starttime（自开机起的时钟滴答数）
    return {
      ppid: Number(fields[1]),
      pgrp: Number(fields[2]),
      session: Number(fields[3]),
      state: fields[0],
      startTicks: Number(fields[19]),
    };
  } catch {
    return null;
  }
}

/** 读取进程的启动滴答数（用于区分「本次调用之后才出现的进程」与「既有进程」）。 */
export function readStartTicks(pid) {
  return readStat(pid)?.startTicks ?? 0;
}

function readCmdline(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
  } catch {
    return '';
  }
}

function readCwd(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return '';
  }
}

function readOpenFiles(pid) {
  const dir = `/proc/${pid}/fd`;
  const out = [];
  try {
    for (const fd of readdirSync(dir)) {
      try {
        out.push(readlinkSync(join(dir, fd)));
      } catch {
        // 进程可能已退出
      }
    }
  } catch {
    // 无权限或已退出
  }
  return out;
}

function listPids() {
  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .filter((pid) => pid !== process.pid);
}

/** 找出「仍可能属于本次调用」的进程：cwd / 打开的文件 / 命令行 指向 marker 路径。 */
export function findRelatedPids(marker, { extraPids = [], minStartTicks = 0 } = {}) {
  const related = [];
  for (const pid of listPids()) {
    if (extraPids.includes(pid)) {
      related.push({ pid, reason: 'tracked' });
      continue;
    }
    const stat = readStat(pid);
    if (!stat || stat.state === 'Z') continue;
    // 只处理「本次调用开始之后才启动」的进程，避免把调用者的 shell/父进程误杀
    if (stat.startTicks < minStartTicks) continue;
    const cmd = readCmdline(pid);
    if (cmd.includes(marker)) {
      related.push({ pid, reason: 'cmdline' });
      continue;
    }
    const cwd = readCwd(pid);
    if (cwd && cwd.startsWith(marker)) {
      related.push({ pid, reason: 'cwd' });
      continue;
    }
    const files = readOpenFiles(pid);
    if (files.some((entry) => entry.startsWith(marker))) related.push({ pid, reason: 'open-fd' });
  }
  return related;
}

function signal(pid, sig) {
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
}

function alive(pid) {
  const stat = readStat(pid);
  if (!stat) return false;
  return stat.state !== 'Z';
}

/** 向进程组发送信号（--kill-child 的 unshare 作为组长时可用负 PID）。 */
export function signalGroup(pgid, sig) {
  try {
    process.kill(-pgid, sig);
    return true;
  } catch {
    return signal(pgid, sig);
  }
}

/**
 * 硬清理：先 TERM，宽限后 KILL，最后按 marker 扫 /proc 兜底。
 * @returns {Promise<{killed: Array<{pid:number,reason:string}>, survivors: Array<{pid:number,reason:string}>}>}
 */
export async function killEverything({ pid, pgid, marker, graceMs = SIGNAL_GRACE_MS, extraPids = [], minStartTicks = 0 }) {
  const killed = [];
  if (pgid) signalGroup(pgid, 'SIGTERM');
  else if (pid) signal(pid, 'SIGTERM');

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    const pending = [pid, ...findRelatedPids(marker, { minStartTicks }).map((entry) => entry.pid)].filter(Boolean);
    if (pending.every((candidate) => !alive(candidate))) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (pgid) signalGroup(pgid, 'SIGKILL');
  else if (pid) signal(pid, 'SIGKILL');

  for (const entry of findRelatedPids(marker, { extraPids, minStartTicks })) {
    if (alive(entry.pid)) {
      signal(entry.pid, 'SIGKILL');
      killed.push(entry);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  const survivors = findRelatedPids(marker, { extraPids, minStartTicks }).filter((entry) => alive(entry.pid));
  return { killed, survivors };
}

/** 目录是否为空（用于确认 attempt 目录没有残留写入进程仍在跑时不需要）。 */
export function pathExists(target) {
  return existsSync(target);
}
