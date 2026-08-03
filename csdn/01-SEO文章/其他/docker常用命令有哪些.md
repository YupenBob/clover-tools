# Docker常用命令有哪些？镜像/容器/网络/数据卷完整指南

> Docker是现代云原生应用的基础。本文整理最常用的Docker命令，覆盖镜像管理、容器操作、数据卷挂载、网络配置等日常开发运维场景。

## 镜像命令

```bash
# 查看本地镜像
docker images

# 拉取镜像
docker pull nginx:latest

# 构建镜像
docker build -t myapp:1.0 .

# 删除镜像
docker rmi nginx:latest

# 清理悬空镜像
docker image prune
```

## 容器命令

```bash
# 运行容器
docker run -d --name web -p 8080:80 nginx

# 常见选项
# -d 后台运行
# --name 给容器命名
# -p 端口映射 主机:容器
# -e 设置环境变量
# -v 挂载数据卷

# 查看运行中的容器
docker ps

# 查看所有容器（包括已停止）
docker ps -a

# 停止/启动容器
docker stop web
docker start web

# 进入容器bash
docker exec -it web bash

# 查看容器日志
docker logs -f web
```

## 数据卷

```bash
# 创建数据卷
docker volume create mydata

# 查看数据卷
docker volume ls

# 挂载数据卷
docker run -v mydata:/data nginx
```

## 清理

```bash
# 删除已停止容器
docker container prune

# 删除所有已停止容器
docker system prune -a

# 清理数据卷
docker volume prune
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
