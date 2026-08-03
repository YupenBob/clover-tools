# Nginx反向代理怎么配？负载均衡与SSL完整配置指南

> Nginx反向代理是架构中的核心组件。本文讲解反向代理配置、负载均衡策略、SSL证书配置，以及与Docker配合的最佳实践。

## 基础反向代理

```
server {
  listen 80;
  server_name example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 负载均衡

```
upstream backend {
  least_conn;  # 最少连接优先
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
}

server {
  location / {
    proxy_pass http://backend;
  }
}
```

## SSL配置

```
server {
  listen 443 ssl;
  server_name example.com;

  ssl_certificate /etc/ssl/certs/cert.pem;
  ssl_certificate_key /etc/ssl/private/key.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

## WebSocket代理

```
location /ws {
  proxy_pass http://127.0.0.1:8000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
