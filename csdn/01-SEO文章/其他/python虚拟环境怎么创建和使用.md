# Python虚拟环境怎么创建和使用？venv完全指南

> Python虚拟环境是避免包版本冲突的标准方法。本文详解venv的创建、激活、使用，以及requirements.txt的导出和安装。

## 为什么需要虚拟环境

不同项目依赖不同版本的包，全局安装会导致版本冲突。虚拟环境让每个项目有独立的Python环境。

## 创建虚拟环境

```bash
# 创建
python -m venv myenv

# Windows激活
myenv\Scripts\activate.bat

# Linux/Mac激活
source myenv/bin/activate
```

## 常用操作

```bash
# 安装包
pip install requests

# 导出依赖
pip freeze > requirements.txt

# 从requirements安装
pip install -r requirements.txt

# 退出虚拟环境
deactivate
```

## 推荐工具：venv + requirements.txt

```bash
# .gitignore中添加
venv/
__pycache__/
*.pyc
```

## 进阶：使用pyenv管理多个Python版本

```bash
# 安装pyenv
brew install pyenv

# 安装特定版本
pyenv install 3.11.0

# 设置全局版本
pyenv global 3.11.0
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
