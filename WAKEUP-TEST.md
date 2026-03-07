# 🔔 唤醒测试说明

**创建时间**：2026-03-01 12:40
**目的**：测试小 C 能否在指定时间被唤醒并发送消息

---

## 📋 测试配置

### 测试时间
**每天 12:40** 自动触发

### 测试脚本
**位置**：`/root/clover-wakeup-test.sh`

**Cron 配置**：
```bash
40 12 * * * /root/clover-wakeup-test.sh
```

**日志**：`/root/clover_wakeup_test.log`

---

## 🔧 测试流程

1. **12:40** - Cron 触发脚本
2. 脚本调用 `openclaw system event` 触发心跳
3. OpenClaw 心跳运行（每 60 分钟）
4. 小 C 读取 `HEARTBEAT.md`
5. 小 C 发送消息到钉钉

---

## ✅ 预期结果

**小 C 应该回复**：
- "在的在的！🦀 我一直都在～"
- 或者类似的确认消息

**钉钉应该收到**：
- 小 C 的回复消息
- 包含当前进度和任务提醒

---

## ❌ 如果没收到回复

### 可能原因 1：CLI token 问题
```bash
# 重启 Gateway
openclaw gateway --force
```

### 可能原因 2：心跳未配置
```bash
# 检查心跳配置
openclaw status | grep Heartbeat

# 应该显示：Heartbeat │ 60m (main)
```

### 可能原因 3：Gateway 挂了
```bash
# 检查 Gateway 状态
ps aux | grep openclaw-gateway

# 重启 Gateway
openclaw gateway --force
```

### 可能原因 4：钉钉通道问题
```bash
# 检查钉钉配置
cat ~/.openclaw/openclaw.json | grep -A5 dingtalk
```

---

## 📊 当前配置状态

| 项目 | 状态 |
|------|------|
| 唤醒测试脚本 | ✅ `/root/clover-wakeup-test.sh` |
| Cron 配置 | ✅ 每天 12:40 |
| 心跳配置 | ✅ 60 分钟一次 |
| 钉钉通道 | ✅ 已启用 |
| Gateway | ✅ 运行中 |

---

## 🧪 手动测试

```bash
# 强制触发测试（任何时间）
/root/clover-wakeup-test.sh test

# 查看日志
tail -20 /root/clover_wakeup_test.log
```

---

## 📝 测试记录

| 日期 | 时间 | 结果 | 备注 |
|------|------|------|------|
| 2026-03-01 | 12:40 | ⏳ 待测试 | 第一次配置 |

---

**小 Y，12:40 记得看钉钉消息哦！** 🦀⏰
