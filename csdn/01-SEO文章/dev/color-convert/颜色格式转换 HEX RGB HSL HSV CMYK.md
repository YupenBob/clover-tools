# 颜色格式转换完全指南 - HEX RGB HSL HSV CMYK 互转

> 详解 HEX、RGB、RGBA、HSL、HSV、CMYK 等颜色格式的含义与转换公式，附在线工具实测对比和代码示例。

## 什么是颜色格式？

在前端开发、UI设计和图像处理中，我们经常需要在 HEX、RGB、HSL、HSV、CMYK 等颜色格式之间切换。理解每种格式的原理，能帮你更精准地控制颜色。

## 主流颜色格式详解

### HEX（十六进制）

用6位十六进制数表示颜色，如 #FF5733。优点是简洁，CSS 中最常用。缺点是不直观，难以手动调整亮度或饱和度。

### RGB / RGBA

三通道表示：红(0-255)、绿(0-255)、蓝(0-255)。rgba(255, 87, 51, 0.5) 额外支持透明度。适合需要精确控制色彩的程序化场景。

### HSL / HSLA

色相(Hue 0-360°)、饱和度(Saturation 0-100%)、亮度(Lightness 0-100%)。更符合人类对颜色的直观感知，调色时比 RGB 更容易。

### HSV / HSB

色相、饱和度、明度(Value/Brightness)。与 HSL 类似，但明度计算方式不同，HSV 的纯色更亮，适合选色器实现。

### CMYK

印刷专用：青(C)、品(M)、黄(Y)、黑(K)。四通道叠色，数值 0-100%。屏幕显示用 RGB，打印输出用 CMYK。

## 转换公式

以下是核心转换逻辑的 JavaScript 实现：

```javascript
// RGB to HEX
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

// RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [h*360, s*100, l*100];
}
```

## 常见问题

Q: HEX 和 RGB 哪个更好？
CSS 使用场景选 HEX，程序化处理选 RGB，数据传输选 HEX。

Q: 为什么同一颜色在不同软件里显示不一样？
色彩管理模式不同（sRGB vs Adobe RGB），建议统一使用 sRGB 标准。

Q: HSV 和 HSL 选哪个？
做选色器用 HSV 更直观；做色彩搭配用 HSL 更符合直觉。

## 在线工具实测

使用 CloverTools 颜色格式转换 可视化转换，支持 HEX/RGB/HSL/HSV/CMYK 同时显示，复制任意格式的代码。

---

## 相关工具推荐

**颜色转换与取色** — HEX、RGB、HSL 互转，取色器实时预览。

在线使用：[颜色转换与取色](https://clovertools.cn/tools/dev/color-convert/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
