# Vue3和Vue2区别是什么？Composition API完全指南

> Vue3是Vue2的重大升级，引入了Composition API、Proxy响应式系统等众多新特性。本文对比Vue2和Vue3的核心区别，以及如何迁移Vue2项目到Vue3。

## 响应式系统升级

```javascript
// Vue2: Object.defineProperty（需要defineProperty）
// Vue3: Proxy（更强大，原生支持数组）

// Vue3可以直接监听数组变化
const state = reactive({
  count: 0,
  list: []
});
state.list.push(1);  // Vue3可以监听到
```

## Composition API vs Options API

```javascript
// Vue3 Composition API
setup() {
  const count = ref(0);
  const double = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  return { count, double, increment };
}
```

## 生命周期变化

```
Vue2                Vue3 (setup内)
beforeCreate         not needed
created              not needed
beforeMount          onBeforeMount
mounted              onMounted
beforeUpdate         onBeforeUpdate
updated              onUpdated
beforeDestroy        onBeforeUnmount
destroyed            onUnmounted
```

## Teleport（传送门）

```
<Teleport to="body">
  <Modal v-if="show" />
</Teleport>
```

## Suspense异步组件

```
<Suspense>
  <template #default>
    <AsyncComponent />
  </template>
  <template #fallback>
    <Loading />
  </template>
</Suspense>
```

## 迁移建议

- 新项目直接用Vue3
- Vue2项目可以逐步迁移（支持共存）
- composition-api插件可以让Vue2用Composition API

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
