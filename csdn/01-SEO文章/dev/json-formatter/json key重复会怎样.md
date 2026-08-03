# JSON key重复会怎样？解析行为与正确处理方案

> JSON中存在重复的key是一个容易被忽视但可能导致隐蔽Bug的问题。本文深入解析不同编程语言对重复key的处理方式，以及如何正确检测和修复重复key。

## JSON Key重复的完整解析

JSON规范明确指出对象中的key应该是唯一的，但实际开发中由于数据来源不可控或拼接错误，重复key的情况并不罕见。了解不同语言的处理方式，可以避免因此产生的隐蔽Bug。

### 一、JSON规范怎么说

根据RFC 8259规范，对象中的key应该是唯一的。规范使用的是"SHOULD"而非"MUST"，因此部分解析器对重复key较为宽容。

### 二、不同语言的处理方式

**JavaScript（V8引擎）：**
```javascript
const jsonStr = '{"name": "Alice", "name": "Bob"}';
const obj = JSON.parse(jsonStr);
console.log(obj.name); // "Bob" — 后面的值覆盖前面的
```
结论：**后面的key-value对会覆盖前面的**，只保留最后一个值。

**Python（json库）：**
```python
import json
json_str = '{"name": "Alice", "name": "Bob"}'
obj = json.loads(json_str)
print(obj)  # {'name': 'Bob'} — 同样保留最后一个
```

**Go（encoding/json）：**
```go
var result map[string]interface{}
err := json.Unmarshal([]byte(`{"name":"Alice","name":"Bob"}`), &result)
fmt.Println(result["name"]) // Bob
```

**Java（Gson）：**
```java
String json = "{\"name\":\"Alice\",\"name\":\"Bob\"}";
Gson gson = new Gson();
Map<String, Object> map = gson.fromJson(json, Map.class);
System.out.println(map.get("name")); // Bob
```

### 三、为什么重复Key很危险

**1. 不可预测的行为**
不同库、不同版本处理方式可能不同。

**2. 隐式的状态覆盖**
```javascript
const userData = '{"role": "user", "permissions": ["read"], "role": "admin"}';
// 本意是添加admin角色，但实际role变成"admin"，"user"角色丢失！
```

**3. 序列化不一致**
```javascript
const obj = {"name": "Alice"};
obj.name = "Bob";
obj["name"] = "Charlie";
JSON.stringify(obj); // '{"name":"Charlie"}' — 丢失了中间状态
```

### 四、如何检测和修复重复Key

**Python检测脚本：**
```python
import json
from collections import Counter

def find_duplicate_keys(json_str: str):
    data = json.loads(json_str)
    keys = []

    def flatten_keys(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                full_path = f"{path}.{k}" if path else k
                keys.append(full_path)
                flatten_keys(v, full_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                flatten_keys(item, f"{path}[{i}]")

    flatten_keys(data)
    counts = Counter(keys)
    return [(k, c) for k, c in counts.items() if c > 1]

duplicates = find_duplicate_keys('{"name":"A","name":"B","data":{"x":1,"x":2}}')
print(duplicates)  # [('name', 2), ('data.x', 2)]
```

**自动修复重复Key：**
```javascript
function removeDuplicateKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(removeDuplicateKeys);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, removeDuplicateKeys(v)])
        );
    }
    return obj;
}
```

### 五、最佳实践

1. **数据源验证**：从API或文件读取JSON时，先用验证器检查key唯一性
2. **Schema验证**：使用JSON Schema的 `additionalProperties: false` 防止未知key
3. **日志警告**：解析时发现重复key主动记录警告日志
4. **数据清洗**：ETL流程中加入重复key检测步骤

重复key问题虽小，但可能造成严重的数据错误，建议在CI流程中加入JSON校验步骤！

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
