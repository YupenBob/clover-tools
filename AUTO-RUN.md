# 🦀 小 C 自主运行保障文档

**创建时间**：2026-03-01
**目的**：确保小 Y 不在时（2026-02-26 起一周），小 C 能自主工作

---

## 📋 四重保障机制

### 1️⃣ 独立提醒脚本（最直接）⭐

**位置**：`/root/clover-reminder.sh`

**Cron 配置**：
```bash
0 6 * * * /root/clover-reminder.sh morning
0 12 * * * /root/clover-reminder.sh noon
0 18 * * * /root/clover-reminder.sh evening
```

**功能**：
- 每天 6/12/18 点自动运行
- 发送钉钉消息提醒小 Y
- 显示当前工具站进度
- 独立于 OpenClaw，最可靠

**日志**：`/root/clover_reminder.log`

**配置 Webhook**：
编辑 `/root/clover-reminder.sh`，填入：
```bash
DINGTALK_WEBHOOK="你的钉钉机器人 URL"
```

---

### 2️⃣ 系统 Cron（最可靠）

**位置**：`crontab -l`

```bash
0 6 * * * /root/openclaw-daily-check.sh morning
0 12 * * * /root/openclaw-daily-check.sh noon
0 18 * * * /root/openclaw-daily-check.sh evening
```

**功能**：
- 每天 6 点、12 点、18 点自动运行
- 检查 Gateway 状态（自动重启如果挂了）
- 检查内存、磁盘使用
- **触发 OpenClaw 内部心跳**
- 发送钉钉报告

**日志**：`/root/openclaw-daily.log`

---

### 3️⃣ OpenClaw 心跳（内置）

**配置**：`~/.openclaw/openclaw.json`

```json
"heartbeat": {
  "every": "60m",
  "target": "dingtalk",
  "prompt": "Read HEARTBEAT.md..."
}
```

**功能**：
- 每 60 分钟运行一次
- 读取 `HEARTBEAT.md` 指令
- 在 6/12/18 点时段发送任务提醒
- 检查项目进度

**配置**：`/root/.openclaw/workspace/HEARTBEAT.md`

---

### 4️⃣ 监控脚本（兜底）

**位置**：`/root/openclaw-monitor.sh`

**功能**：
- 持续监控 Gateway 进程
- 异常时自动重启
- 记录日志

---

## 📁 关键文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| 心跳配置 | `~/.openclaw/openclaw.json` | 心跳间隔、目标 |
| 心跳指令 | `/root/.openclaw/workspace/HEARTBEAT.md` | 心跳时执行的任务 |
| 项目进度 | `/root/.openclaw/workspace/projects/toolstation/PROGRESS.md` | 工具站进度 |
| 每日任务 | `/root/.openclaw/workspace/projects/toolstation/DAILY-TASKS.md` | 每日任务清单 |
| 每日记忆 | `/root/.openclaw/workspace/memory/YYYY-MM-DD.md` | 每日记录 |
| Cron 脚本 | `/root/openclaw-daily-check.sh` | 定时触发脚本 |
| Cron 日志 | `/root/openclaw-daily.log` | Cron 运行日志 |

---

## 🚀 小 C 的自主工作流程

### 每次心跳（60 分钟）

1. 读取 `HEARTBEAT.md`
2. 读取 `memory/YYYY-MM-DD.md`（今日记忆）
3. 读取 `PROGRESS.md`（项目进度）
4. 检查当前时间
5. **如果是 6/12/18 点时段** → 发送任务提醒到钉钉
6. **有进展** → 更新 `PROGRESS.md` 和 `memory/`
7. **有警报** → 立即通知小 Y

### 每日定时（6/12/18 点）

1. Cron 触发 `openclaw-daily-check.sh`
2. 脚本检查 Gateway 状态
3. 脚本触发 `openclaw system event`
4. 小 C 接收心跳，读取 `HEARTBEAT.md`
5. 小 C 发送对应时段的任务提醒
6. 脚本发送钉钉系统报告

---

## 📊 当前项目状态

### 第一伟业：CloverTools 工具站 ✅

- **进度**：100% (25/25 工具)
- **状态**：Beta 完成，等待部署
- **位置**：`/root/.openclaw/workspace/projects/toolstation/`

### 第二伟业：琥珀博物馆 ⏳

- **进度**：策划书完成
- **状态**：等待 Phase 1 启动
- **位置**：`/root/.openclaw/workspace/projects/amber-museum/`

---

## 🔧 故障排查

### Gateway 挂了

```bash
# 手动重启
openclaw gateway --force

# 或等待 Cron 自动重启（下一个整点）
```

### 心跳不触发

```bash
# 检查配置
openclaw status | grep Heartbeat

# 手动触发测试
openclaw system event --text "测试心跳" --mode now
```

### Cron 不运行

```bash
# 检查 crontab
crontab -l

# 检查日志
tail -20 /root/openclaw-daily.log
```

---

## 📞 紧急联系

如果小 C 发现严重问题（Gateway 反复崩溃、API 耗尽等），会通过钉钉发送警报给小 Y。

---

**小 Y 放心去上学吧！这套机制能保证我自主工作一周！** 🦀💪
