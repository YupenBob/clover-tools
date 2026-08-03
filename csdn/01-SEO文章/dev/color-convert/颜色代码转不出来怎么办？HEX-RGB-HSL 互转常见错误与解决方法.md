# 颜色代码转不出来怎么办？HEX/RGB/HSL 互转常见错误与解决方法

> 颜色代码转换失败通常是因为格式不支持、范围超限或分隔符错误。本文详解 HEX、RGB、HSL、RGBA 等格式的正确写法，以及互转时常见错误的修复方法。

## 颜色代码转不出来怎么办？HEX/RGB/HSL互转常见错误与解决方法

颜色在Web开发中有多种表示方式：HEX（如#FF5733）、RGB（如rgb(255, 87, 51)）、HSL（如hsl(14, 100%, 60%)）。互转时经常遇到格式解析错误。

## HEX格式的合法写法

```
// 标准6位HEX
#FF5733
// 3位缩写（每两位相同可简写）
#F53  // 展开为 #FF5533
// 带透明度4位/8位
#F5338  // #FF553388
```

## RGB转HEX的正确方法

```javascript
// RGB值范围必须是0-255的整数
function rgbToHex(r, g, b) {
  const toHex = n => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

rgbToHex(255, 87, 51);  // '#ff5733'
```

## HSL转RGB

```javascript
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

hslToRgb(14, 100, 60);  // [255, 87, 51]
```

## 健壮的颜色解析

```javascript
function parseColor(input) {
  const s = input.trim().toLowerCase();
  const hexMatch = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hexMatch) return { hex: '#' + hexMatch[1], format: 'hex' };
  const rgbMatch = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,[^)]+)?\)$/);
  if (rgbMatch) return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3], format: 'rgb' };
  return null;
}

parseColor('#FF5733');  // {hex: '#ff5733', format: 'hex'}
parseColor('rgb(255, 87, 51)');  // {r: 255, g: 87, b: 51, format: 'rgb'}
```

## 常见问题 FAQ

Q: 为什么#FFF和#FFFFFF在程序中处理结果不同？
A: 3位缩写是独立格式，程序需分别实现缩写展开逻辑。

Q: RGBA的alpha值在转换为HEX时如何处理？
A: alpha值0-1转为16进制，如0.5 → 80，0 → 00，1 → FF。

---

## 相关工具推荐

**颜色转换与取色** — HEX、RGB、HSL 互转，取色器实时预览。

在线使用：[颜色转换与取色](https://clovertools.cn/tools/dev/color-convert/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
