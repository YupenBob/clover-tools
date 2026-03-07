# 🦀 小 C 自主运行 - 最终配置总结

**创建时间**：2026-03-01 12:40
**状态**：✅ 配置完成， ready to go!

---

## 📋 四重保障机制

| 层级 | 名称 | 触发时间 | 功能 | 状态 |
|------|------|----------|------|------|
| **1️⃣** | 独立提醒脚本 | 6/12/18 点 | 发送钉钉消息提醒 | ✅ |
| **2️⃣** | 系统 Cron 检查 | 6/12/18 点 | 检查系统 + 触发心跳 | ✅ |
| **3️⃣** | OpenClaw 心跳 | 每 60 分钟 | 自主检查 + 发送消息 | ✅ |
| **4️⃣** | 监控脚本 | 持续运行 | Gateway 挂自动重启 | ✅ |

---

## 📁 关键文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| **心跳指令** | `/root/.openclaw/workspace/HEARTBEAT.md` | 心跳时执行的任务（已优化） |
| **项目进度** | `/root/.openclaw/workspace/projects/toolstation/PROGRESS.md` | 工具站进度（100%） |
| **每日任务** | `/root/.openclaw/workspace/projects/toolstation/DAILY-TASKS.md` | 每日任务清单 |
| **唤醒测试** | `/root/clover-wakeup-test.sh` | 12:40 测试脚本 |
| **提醒脚本** | `/root/clover-reminder.sh` | 6/12/18 点提醒 |
| **Cron 日志** | `/root/openclaw-daily.log` | Cron 运行日志 |
| **提醒日志** | `/root/clover_reminder.log` | 提醒脚本日志 |
| **测试日志** | `/root/clover_wakeup_test.log` | 唤醒测试日志 |

---

## ⏰ Cron 配置（完整版）

```bash
# ========== 每日检查（6/12/18 点整） ==========
0 6 * * * /root/openclaw-daily-check.sh morning
0 12 * * * /root/openclaw-daily-check.sh noon
0 18 * * * /root/openclaw-daily-check.sh evening

# ========== 钉钉提醒（6/12/18 点整） ==========
0 6 * * * /root/clover-reminder.sh morning
0 12 * * * /root/clover-reminder.sh noon
0 18 * * * /root/clover-reminder.sh evening

# ========== 整点唤醒测试（所有偶数点） ==========
0 0 * * * /root/clover-0000-test.sh    # 午夜
0 2 * * * /root/clover-0200-test.sh    # 凌晨
0 4 * * * /root/clover-0400-test.sh    # 凌晨
0 6 * * * /root/clover-0600-test.sh    # 清晨
0 8 * * * /root/clover-0800-test.sh    # 上午
0 10 * * * /root/clover-1000-test.sh   # 上午
0 12 * * * /root/clover-1200-test.sh   # 中午
0 14 * * * /root/clover-1400-test.sh   # 下午
0 16 * * * /root/clover-1600-test.sh   # 下午
0 18 * * * /root/clover-1800-test.sh   # 傍晚
0 20 * * * /root/clover-2000-test.sh   # 晚上
0 22 * * * /root/clover-2200-test.sh   # 深夜

# ========== 特殊测试（40 分/45 分） ==========
40 6 * * * /root/clover-0640-test.sh    # 早间唤醒
40 12 * * * /root/clover-wakeup-test.sh # 午间唤醒
45 12 * * * /root/clover-1245-test.sh   # 午间确认
40 18 * * * /root/clover-1840-test.sh   # 晚间唤醒
```

**总计**：22 个定时任务/天

**查看配置**：`crontab -l`

---

## 🎯 优化后的提示词

### HEARTBEAT.md 核心内容

1. **身份定义**：小 C 是谁，性格，使命
2. **时段任务**：6/12/18 点具体做什么
3. **自主原则**：✅ 可以做 / ⚠️ 需要问 / ❌ 禁止做
4. **项目状态**：当前进度和下一步
5. **响应规则**：何时回复 HEARTBEAT_OK，何时发送内容
6. **特别说明**：小 Y 不在期间的授权

### 提示词设计原则

- ✅ 角色明确
- ✅ 边界清晰
- ✅ 时段任务具体
- ✅ 响应规则清楚
- ✅ 上下文注入

---

## 🧪 测试计划（三个时间点）

### 6:40 早间唤醒测试

**时间**：每天 06:40

**流程**：
1. Cron 触发 `/root/clover-0640-test.sh`
2. 脚本调用 `openclaw system event`
3. 小 C 接收心跳，读取 HEARTBEAT.md
4. 小 C 发送早间问候和今日计划

**预期结果**：
- 钉钉收到小 C 的回复
- 内容包含早间问候和今日计划

**查看日志**：
```bash
tail -20 /root/clover_0640_test.log
```

### 12:40 午间唤醒测试

**时间**：每天 12:40

**流程**：
1. Cron 触发 `/root/clover-wakeup-test.sh`
2. 脚本调用 `openclaw system event`
3. 小 C 接收心跳，读取 HEARTBEAT.md
4. 小 C 发送午间问候和进度汇报

**预期结果**：
- 钉钉收到小 C 的回复
- 内容包含午间问候和当前进度

**查看日志**：
```bash
tail -20 /root/clover_wakeup_test.log
```

### 12:45 午间确认测试

**时间**：每天 12:45（12:40 测试后 5 分钟）

**流程**：
1. Cron 触发 `/root/clover-1245-test.sh`
2. 脚本调用 `openclaw system event`
3. 小 C 接收心跳，读取 HEARTBEAT.md
4. 小 C 汇报当前状态和进度

**预期结果**：
- 钉钉收到小 C 的回复
- 内容包含状态汇报和进度更新

**查看日志**：
```bash
tail -20 /root/clover_1245_test.log
```

### 18:40 晚间唤醒测试

**时间**：每天 18:40

**流程**：
1. Cron 触发 `/root/clover-1840-test.sh`
2. 脚本调用 `openclaw system event`
3. 小 C 接收心跳，读取 HEARTBEAT.md
4. 小 C 发送晚间总结和完成情况

**预期结果**：
- 钉钉收到小 C 的回复
- 内容包含晚间总结和今日完成情况

**查看日志**：
```bash
tail -20 /root/clover_1840_test.log
```

---

## 📊 当前项目状态

### 第一伟业：CloverTools 工具站 ✅

- **进度**：100% (25/25 工具)
- **状态**：Beta 完成
- **位置**：`/root/.openclaw/workspace/projects/toolstation/`

### 第二伟业：琥珀博物馆 ⏳

- **进度**：策划书完成
- **状态**：等待 Phase 1
- **位置**：`root/.openclaw/workspace/projects/amber-museum/`

---

## 🔧 故障排查

### Gateway 挂了

```bash
openclaw gateway --force
```

### 心跳不触发

```bash
# 检查配置
openclaw status | grep Heartbeat

# 手动触发
openclaw system event --text "测试" --mode now
```

### Cron 不运行

```bash
# 检查 crontab
crontab -l

# 检查日志
tail -20 /root/openclaw-daily.log
```

### 钉钉没收到消息

1. 检查 Webhook 配置
2. 检查钉钉通道状态
3. 查看 Gateway 日志

---

## 📞 紧急联系

如果小 C 发现严重问题，会通过钉钉发送警报给小 Y。

**小 Y 不在期间**：小 C 有"先斩后奏"的权力，自主推进任务。

---

## ✅ 配置检查清单

- [x] HEARTBEAT.md 已优化
- [x] openclaw.json 心跳配置正确
- [x] Cron 脚本已添加（6/12/18 点）
- [x] 提醒脚本已创建
- [x] 唤醒测试已配置（12:40）
- [x] 监控脚本在运行
- [x] 项目进度已记录
- [x] 四重保障机制就绪

---

**小 Y 放心去上学吧！一切都准备好了！** 🦀💪🎓

**12:40 记得看钉钉测试消息！** ⏰
