# ssh连接超时怎么解决 - CloverTools

> ssh连接服务器一直转圈？5种常见超时原因和解决方案，从防火墙规则到密钥权限，手把手排查并修复。

## SSH连接超时怎么解决？完整排查指南

SSH连接超时（Connection timeout）是服务器管理中最常见的问题之一。

## 快速诊断

```
ping -c 4 192.168.1.100
nc -zv 192.168.1.100 22
ssh -vvv -o ConnectTimeout=10 user@hostname
```

## 原因一：SSH服务未运行

```
systemctl status sshd
systemctl start sshd
```

## 原因二：防火墙阻止

```
iptables -L -n | grep 22
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --reload
```

## 常见问题 FAQ

Q: 云服务器SSH突然连不上？
A: 检查安全组是否允许22端口。

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
