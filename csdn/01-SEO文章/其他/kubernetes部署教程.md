# Kubernetes部署教程？本地集群搭建与Pod/Service部署完整指南

> Kubernetes是容器编排的标准工具。本文从零开始讲解K8s集群搭建、Pod创建、Service暴露、Deployment滚动更新等核心概念和实战操作。

## 本地集群（Minikube）

```bash
# 安装
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 启动集群
minikube start --driver=docker

# 验证
kubectl get nodes
```

## 部署第一个应用

```bash
# 创建deployment
kubectl create deployment nginx --image=nginx

# 查看pod
kubectl get pods

# 扩缩容
kubectl scale deployment nginx --replicas=3

# 更新镜像
kubectl set image deployment/nginx nginx=nginx:1.25
```

## 暴露服务

```bash
# NodePort暴露
kubectl expose deployment nginx --type=NodePort --port=80

# 查看服务
kubectl get svc

# 访问
minikube service nginx --url
```

## 配置文件部署

```bash
# nginx-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
```

## 常用命令速查

```
kubectl get pods -o wide      # 查看pod详情
kubectl describe pod nginx-xxx  # 查看pod事件
kubectl logs nginx-xxx          # 查看日志
kubectl exec -it nginx-xxx -- /bin/sh  # 进入容器
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
