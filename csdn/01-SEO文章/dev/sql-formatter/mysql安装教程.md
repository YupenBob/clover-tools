# MySQL安装教程？Windows/Mac/Linux完整安装指南

> MySQL是最流行的开源关系型数据库。本文讲解在Windows、Mac、Linux三大平台上安装MySQL的完整步骤，以及安装后的初始配置和远程连接设置。

## Linux（Ubuntu/Debian）

```
sudo apt update
sudo apt install mysql-server

# 启动服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation
```

## Mac（Homebrew）

```
brew install mysql

# 启动服务
brew services start mysql

# 无密码登录（本地开发）
mysql -u root
```

## Windows

```bash
# 下载MSI安装包：dev.mysql.com/downloads/mysql
# 双击安装，记住root密码
# 配置环境变量 PATH 加入 MySQL bin 目录
```

## 初始配置

```bash
# 登录MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE myapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建用户
CREATE USER 'app'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON myapp.* TO 'app'@'localhost';
FLUSH PRIVILEGES;
```

## 远程连接配置

```bash
# 编辑配置文件
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# 注释掉这行（允许远程连接）
# bind-address = 127.0.0.1

# 重启
sudo systemctl restart mysql
```

---

## 相关工具推荐

**SQL 格式化** — SQL 语句美化缩进，支持多种方言。

在线使用：[SQL 格式化](https://clovertools.cn/tools/dev/sql-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
