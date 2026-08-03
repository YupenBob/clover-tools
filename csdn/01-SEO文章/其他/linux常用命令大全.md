# Linux常用命令大全？系统管理文件操作网络诊断完整指南

> 本文整理了最常用的Linux命令分类速查表：文件操作、目录管理、权限设置、进程管理、网络诊断、磁盘查看等，每个命令附带实际例子。

## 文件操作

```
ls -la  # 列出所有文件（含隐藏）
cp file1 file2  # 复制文件
mv file1 file2  # 移动/重命名
rm file  # 删除文件
find / -name "*.log"  # 搜索文件
```

## 目录管理

```
cd /path  # 进入目录
mkdir -p dir1/dir2  # 递归创建
rm -rf dir  # 删除目录及内容
pwd  # 显示当前路径
```

## 权限管理

```
chmod 755 file  # 修改权限
chown user:group file  # 修改所有者
ls -la  # 查看权限详情
```

## 进程管理

```
ps aux | grep node  # 查看进程
kill -9 PID  # 强制终止进程
top  # 实时查看资源占用
htop  # 更友好的进程查看
```

## 网络诊断

```
ping google.com
curl -v url
netstat -tlnp | grep 8080
tcpdump -i eth0 port 80
```

## 磁盘与内存

```
df -h  # 查看磁盘空间
du -sh *  # 查看目录大小
free -h  # 查看内存使用
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
