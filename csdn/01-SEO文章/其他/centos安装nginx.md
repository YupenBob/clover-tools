# CentOS安装Nginx？yum/源码编译完整指南

> CentOS系统如何安装Nginx？本文对比yum安装和源码编译两种方式，以及安装后的基本配置、开机启动设置和常见问题处理。

## yum安装（Nginx官方源）

```bash
# 安装yum-utils
sudo yum install yum-utils

# 创建repo文件
sudo vi /etc/yum.repos.d/nginx.repo
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=0
enabled=1

# 安装
sudo yum install nginx

# 启动
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 源码编译安装（最新版本）

```bash
# 安装依赖
sudo yum install gcc pcre pcre-devel zlib zlib-devel openssl openssl-devel

# 下载源码
wget http://nginx.org/download/nginx-1.26.0.tar.gz
tar -zxvf nginx-1.26.0.tar.gz
cd nginx-1.26.0

# 编译配置
./configure --prefix=/usr/local/nginx \
  --with-http_ssl_module \
  --with-http_v2_module \
  --with-http_gzip_static_module

# 编译安装
make && sudo make install
```

## 防火墙配置

```
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 验证安装

```
nginx -v
curl localhost  # 显示Welcome to nginx页面
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
