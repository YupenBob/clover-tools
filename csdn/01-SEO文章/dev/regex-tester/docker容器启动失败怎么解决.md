# docker容器启动失败怎么解决 - CloverTools

> docker run 报错 port already allocated / Exited (1)？6种常见容器启动失败原因和对应解法，附排查命令和日志分析技巧。

## Docker容器启动失败怎么解决？10个真实案例

Docker容器启动失败是高频问题。以下通过10个真实案例帮助你快速排查原因。

## 快速排查命令

```bash
docker ps -a
docker logs <容器ID>
docker inspect <容器ID>
docker stats
```

## 案例一：端口已被占用

```bash
docker run -p 80:80 nginx
# Error: port is already allocated

lsof -i :80
docker run -p 8080:80 nginx
```

## 案例二：镜像不存在

```bash
docker pull nginx:latest
```

## 案例三：权限问题

```
mkdir -p /host/data && chmod 777 /host/data
docker run -u $(id -u):$(id -g) -v /host/data:/container/data nginx
```

## 案例四：OOMKilled（内存不足）

```bash
docker run -m 512m my-app
docker stats
```

## 常见问题 FAQ

Q: 容器一直处于Restarting状态？
A: 用docker logs查看日志，大概率是应用启动脚本错误。

Q: 容器启动后立即退出？
A: 容器前台进程结束后会自动停止。

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
