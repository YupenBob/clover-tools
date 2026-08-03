# https证书过期怎么检查 - CloverTools

> SSL证书过期导致网站打不开？3种方法快速检查证书状态，自动续期 Let's Encrypt 证书的完整操作，附常见踩坑点。

## HTTPS证书过期怎么检查？完整指南

HTTPS证书过期会导致浏览器显示安全警告，影响用户体验和SEO排名。

## 使用OpenSSL检查

```
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -dates
```

## 使用Python批量检查

```python
import ssl, socket
from datetime import datetime

def check_cert_expiry(hostname, port=443):
    ctx = ssl.create_default_context()
    with socket.create_connection((hostname, port)) as sock:
        with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            expiry = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
            return (expiry - datetime.utcnow()).days
```

## 常见问题 FAQ

Q: HTTPS证书过期了会怎样？
A: 现代浏览器会显示安全警告，用户无法继续访问。

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
