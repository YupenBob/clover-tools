# Python虚拟环境怎么创建？venv/Conda完全指南

> Python项目需要隔离的依赖环境，避免版本冲突。本文讲解venv、Conda两种虚拟环境管理方案，以及如何用pip和poetry管理依赖包。

## venv（Python内置）

```bash
# 创建虚拟环境
python -m venv myenv

# 激活（Windows）
myenv\Scripts\activate

# 激活（Mac/Linux）
source myenv/bin/activate

# 退出
deactivate
```

## Conda

```bash
# 创建环境
conda create --name myenv python=3.11

# 激活
conda activate myenv

# 退出
conda deactivate

# 查看所有环境
conda env list

# 删除环境
conda env remove --name myenv
```

## pip使用

```bash
# 安装包
pip install requests

# 导出依赖
pip freeze > requirements.txt

# 从文件安装
pip install -r requirements.txt

# 升级包
pip install --upgrade requests
```

## poetry（现代方案）

```bash
# 初始化项目
poetry init
poetry add requests

# 安装依赖（按pyproject.toml）
poetry install

# 更新依赖
poetry update
```

## .gitignore模板

```bash
# venvenv/

# conda
env/

# Poetry
poetry.lock
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
