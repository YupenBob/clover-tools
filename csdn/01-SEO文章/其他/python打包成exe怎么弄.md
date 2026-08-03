# Python打包成exe怎么弄？PyInstaller/Freeze最全指南

> Python程序如何打包成Windows可执行文件exe？本文对比PyInstaller、Nuitka、cx_Freeze等工具，详解打包配置、常见错误处理和多文件打包方法。

## PyInstaller最简打包

```bash
pip install pyinstaller
pyinstaller --onefile your_script.py
```

## 常见配置

```
--onefile 打包成单个exe
--noconsole 无黑窗口（GUI应用）
--icon=app.ico 设置图标
--name MyApp 指定输出名字
--add-data "src;dest" 添加额外文件
```

## spec文件配置（高级）

```
a = Analysis(['app.py'])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts,
  a.binaries, a.datas,
  name='MyApp',
  icon='app.ico',
  console=False)
```

## 常见错误

### 找不到模块

```
pyinstaller --hidden-import=requests app.py
```

### 打包后太大

```
pyinstaller --exclude-module=tkinter --onefile app.py
```

## Nuitka（编译成C，性能更好）

```bash
pip install nuitka
python -m nuitka --standalone --onefile app.py
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
