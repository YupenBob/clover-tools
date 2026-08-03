# React Hooks怎么用？useState/useEffect/useCallback/useMemo完全指南

> React Hooks是函数组件的核心能力。本文详解最常用的useState、useEffect、useCallback、useMemo四个Hook，通过实例讲解正确用法和性能优化技巧。

## useState状态管理

```javascript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

## useEffect副作用

```javascript
useEffect(() => {
  // 组件挂载时执行
  const timer = setInterval(() => tick(), 1000);

  // 返回清理函数（组件卸载时执行）
  return () => clearInterval(timer);
}, []);  // 空依赖 = 只执行一次
```

## useCallback缓存函数

```javascript
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);  // 依赖数组

// 父组件传入时，避免子组件不必要的重渲染
<Child onClick={handleClick} />
```

## useMemo缓存计算结果

```javascript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);  // 依赖变化时重新计算
```

## 自定义Hook

```javascript
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
