# SSH连接失败排查步骤？从网络到配置的系统性排查指南

> SSH连接失败是服务器管理中最常见的问题之一。本文从网络连通性、端口检查、密钥配置、防火墙4个维度提供系统性排查步骤。

## SSH连接失败排查流程图

按以下顺序逐个检查，通常能覆盖90%以上的问题：

1. 网络层：ping服务器IP，检查是否通
2. 端口层：nc -zv host 22，检查端口是否开放
3. 服务层：sshd是否运行，systemctl status sshd
4. 认证层：密钥权限是否正确，~/.ssh/权限应为600
5. 日志层：tail -f /var/log/auth.log查看具体报错

## 常见错误与修复

### Connection refused

```bash
# 检查sshd是否运行
sudo systemctl status ssh
sudo systemctl enable ssh
sudo systemctl start ssh
```

### Permission denied (publickey)

```bash
# 检查密钥权限
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

### Connection timeout

通常是防火墙问题，检查云服务器安全组是否开放22端口。

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
