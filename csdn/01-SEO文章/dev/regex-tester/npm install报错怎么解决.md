# npm install报错怎么解决 - CloverTools

> npm install 报错 EACCES / ECONNREFUSED / ETARGET？5种常见报错详解，附缓存清理、版本锁定、网络代理完整解决方案。

## npm install报错怎么解决？常见错误与解决方案

npm install是Node.js项目中最常用的命令，但各种报错让人头疼。

## 错误一：网络问题

```bash
npm config set registry https://registry.npmmirror.com
npm install -g cnpm --registry=https://registry.npmmirror.com
```

## 错误二：权限问题

```bash
# 不要用sudo，使用nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

## 错误三：版本冲突

```bash
npm install --legacy-peer-deps
```

## 错误四：缓存问题

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 常见问题 FAQ

Q: npm install特别慢？
A: 切换到国内镜像。

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
