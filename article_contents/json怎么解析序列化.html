<h1>JSON解析与序列化完全指南：从原理到实战，让数据流动自如</h1>

<p>凌晨两点，你盯着控制台里那个红得刺眼的报错：</p>

<pre><code>SyntaxError: Unexpected token &lt; in JSON at position 0</code></pre>

<p>又来了。接口返回的不是JSON，是一段HTML错误页。你习以为常地复制粘贴，祈祷这次能跑通。</p>

<p>这就是大多数开发者和JSON的关系——每天用，但从来没真正搞懂过它。别担心，这篇文章让你从「会用」升级到「用得明白」。</p>

<h2>一、JSON是什么？为什么开发者离不开它</h2>

<p>JSON（JavaScript Object Notation）是一种轻量级数据交换格式。它不是JavaScript的专属，而是几乎所有语言都能生成和解析的通用格式。你调API、存配置、做微服务通信——JSON无处不在。</p>

<p>它的核心优势：</p>

<ul>
  <li>人类可读，调试友好</li>
  <li>结构简洁，序列化后体积小</li>
  <li>语言无关，跨平台互通</li>
  <li>几乎所有编程语言都有原生或库级支持</li>
</ul>

<p>简单说：JSON就是程序员的事实标准。搞懂它，你的效率会翻倍。</p>

<h2>二、解析（Parsing）：把字符串变成对象</h2>

<h3>JavaScript：JSON.parse()</h3>

<p>最常见的场景：拿到一段JSON字符串，解析成JavaScript对象。</p>

<pre><code>const jsonStr = '{"name": "Alice", "age": 25, "skills": ["Python", "Go"]}';
const obj = JSON.parse(jsonStr);
console.log(obj.name); // "Alice"
console.log(obj.skills[0]); // "Python"</code></pre>

<p>看起来简单，但有三个坑你必须知道：</p>

<h4>坑1：严格模式，不允许尾部逗号</h4>

<pre><code>// 这会报错
JSON.parse('{"name": "Bob",}'); // SyntaxError: Unexpected token }

// 正确写法
JSON.parse('{"name": "Bob"}');</code></pre>

<h4>坑2：属性名必须用双引号</h4>

<pre><code>// 单引号 → 报错
JSON.parse("{'name': 'Carol'}"); // SyntaxError: Unexpected token '

// 正确
JSON.parse('{"name": "Carol"}');</code></pre>

<h4>坑3：undefined和函数会被忽略</h4>

<pre><code>const obj = {
  name: "Dave",
  age: undefined,   // 被忽略
  greet: function() { return "hi"; }, // 被忽略
  active: true
};
const jsonStr = JSON.stringify(obj);
console.log(jsonStr); // {"name":"Dave","active":true}
console.log(JSON.parse(jsonStr).age); // undefined</code></pre>

<h3>Python：json.loads()</h3>

<p>Python中解析JSON用的是<code>json</code>模块的<code>loads()</code>函数（load string）。</p>

<pre><code>import json

json_str = '{"name": "Alice", "age": 25, "skills": ["Python", "Go"]}'
obj = json.loads(json_str)
print(obj["name"])  # Alice
print(obj["skills"][0])  # Python</code></pre>

<p>Python的坑主要在于类型映射：JSON的<code>true/false</code>变成Python的<code>True/False</code>，<code>null</code>变成<code>None</code>。如果你习惯用<code>None</code>做判断，别忘了这一层转换。</p>

<h2>三、序列化（Serialization）：把对象变成字符串</h2>

<h3>JavaScript：JSON.stringify()</h3>

<p>序列化是将对象转换为JSON字符串的过程。</p>

<pre><code>const obj = { name: "Eve", score: 98.5, passed: true };
const jsonStr = JSON.stringify(obj);
console.log(jsonStr);
// {"name":"Eve","score":98.5,"passed":true}</code></pre>

<p><code>JSON.stringify()</code>还支持两个额外的参数：</p>

<h4>第二个参数：过滤器和格式化</h4>

<pre><code>const obj = { name: "Frank", age: 30, password: "secret123" };

// 只保留指定字段
const filtered = JSON.stringify(obj, ["name", "age"]);
console.log(filtered); // {"name":"Frank","age":30}

// 用函数自定义处理
const custom = JSON.stringify(obj, (key, value) => {
  if (key === "password") return undefined; // 排除密码字段
  return value;
});
console.log(custom); // {"name":"Frank","age":30}</code></pre>

<h4>第三个参数：缩进美化</h4>

<pre><code>const obj = { name: "Grace", city: "Beijing" };

// 用空格缩进（2个空格）
console.log(JSON.stringify(obj, null, 2));
// {
//   "name": "Grace",
//   "city": "Beijing"
// }

// 用制表符缩进
console.log(JSON.stringify(obj, null, "\t"));
// {
//     "name": "Grace",
//     "city": "Beijing"
// }</code></pre>

<p>注意：格式化输出只适合调试和日志，生产环境传输应使用无缩进的最小化格式，否则徒增网络开销。</p>

<h3>Python：json.dumps()</h3>

<pre><code>import json

obj = {"name": "Grace", "city": "Beijing", "score": 98.5}
json_str = json.dumps(obj)
print(json_str)  # {"name": "Grace", "city": "Beijing", "score": 98.5}

# 美化输出（indent参数）
print(json.dumps(obj, indent=2, ensure_ascii=False))
# {
#   "name": "Grace",
#   "city": "Beijing",
#   "score": 98.5
# }

# 排除某个字段
obj.pop("score", None)
print(json.dumps(obj))  # {"name": "Grace", "city": "Beijing"}</code></pre>

<p><code>ensure_ascii=False</code>在处理中文时是必须的，否则中文会被转义为<code>\u4e2d...</code>的形式，可读性大幅下降。</p>

<h2>四、实战技巧：处理复杂场景</h2>

<h3>1. 深拷贝：比Object.assign更安全</h3>

<pre><code>// Object.assign是浅拷贝，嵌套对象会共享引用
const original = { user: { name: "Henry", scores: [90, 85] } };
const shallow = Object.assign({}, original);
shallow.user.name = "Hank";
console.log(original.user.name); // "Hank" — 原对象被改了！

// JSON.stringify + JSON.parse 实现深拷贝
const deep = JSON.parse(JSON.stringify(original));
deep.user.name = "Hank";
console.log(original.user.name); // "Henry" — 安全</code></pre>

<p>注意：这种方法无法拷贝函数、<code>undefined</code>、<code>Symbol</code>等特殊值。如果你的对象包含这些类型，需要用专门的深拷贝库（如lodash的<code>cloneDeep</code>）。</p>

<h3>2. 处理日期对象</h3>

<pre><code>// 日期对象序列化后变成字符串，反序列化后还是字符串
const event = { title: "Conference", date: new Date("2026-05-10") };
const str = JSON.stringify(event);
console.log(str); // {"title":"Conference","date":"2026-05-10T00:00:00.000Z"}

const parsed = JSON.parse(str);
console.log(parsed.date); // "2026-05-10T00:00:00.000Z" — 是字符串，不是Date对象

// 如需还原为Date对象，自定义reviver函数
const restored = JSON.parse(str, (key, value) => {
  if (key === "date") return new Date(value);
  return value;
});
console.log(restored.date instanceof Date); // true</code></pre>

<h3>3. 循环引用的处理</h3>

<pre><code>// 直接序列化包含循环引用的对象会报错
const obj = { name: "Iris" };
obj.self = obj;
try {
  JSON.stringify(obj);
} catch (e) {
  console.log(e.message); // "Converting circular structure to JSON"
}

// 解决方案：用 replacer 过滤或使用库
const safeObj = JSON.stringify(obj, (key, value) => {
  if (value === obj) return "[Circular]";
  return value;
});
console.log(safeObj); // {"name":"Iris","self":"[Circular]"}</code></pre>

<h3>4. 大数字精度丢失问题</h3>

<pre><code>// JavaScript中Number类型的安全整数范围：-2^53+1 到 2^53-1
// 超过这个范围的数字会丢失精度
const bigNum = { id: 9007199254740993 }; // 2^53+1
console.log(JSON.parse(JSON.stringify(bigNum)).id); // 9007199254740992 — 精度丢失！

// 解决方案：用字符串传递大数字，或使用专门的bigint库</code></pre>

<h2>五、常见错误与解决方案</h2>

<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      <th>错误信息</th>
      <th>原因</th>
      <th>解决方式</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>Unexpected token in JSON</code></td>
      <td>字符串包含非法字符或格式错误</td>
      <td>检查JSON有效性，用工具格式化验证</td>
    </tr>
    <tr>
      <td><code>Unexpected end of JSON input</code></td>
      <td>字符串被截断，或为空</td>
      <td>检查接口响应是否完整，body是否为空</td>
    </tr>
    <tr>
      <td><code>Expected ',' or '}'</code></td>
      <td>少了逗号或多了逗号</td>
      <td>逐行检查JSON结构</td>
    </tr>
    <tr>
      <td><code>Unexpected character in JSON</code></td>
      <td>属性名用了单引号或未加引号</td>
      <td>属性名必须用双引号包裹</td>
    </tr>
    <tr>
      <td><code>Converting circular structure to JSON</code></td>
      <td>对象存在循环引用</td>
      <td>用replacer过滤或移除循环引用</td>
    </tr>
    <tr>
      <td>BOM头导致的解析错误</td>
      <td>UTF-8文件带BOM头</td>
      <td>保存文件时选择「UTF-8 无BOM」格式</td>
    </tr>
    <tr>
      <td>中文字符变成Unicode转义</td>
      <td>未设置<code>ensure_ascii=False</code>（Python）</td>
      <td><code>json.dumps(obj, ensure_ascii=False)</code></td>
    </tr>
  </tbody>
</table>

<h2>六、推荐工具：用在线JSON格式化器省时间</h2>

<p>手动处理JSON太累了？善用工具能让你事半功倍。</p>

<p>如果你需要一个能实时校验、格式化、美化的JSON工具，我常用 <a href="https://tools.xsanye.cn/tools/json/formatter.html" target="_blank" rel="noopener">CloverTools JSON Formatter</a>。它能帮你：</p>

<ul>
  <li>秒级解析并美化任意JSON字符串</li>
  <li>快速定位语法错误位置</li>
  <li>压缩JSON（去除空格，用于生产环境传输）</li>
  <li>在格式化与压缩之间一键切换</li>
</ul>

<p>地址：<strong>https://tools.xsanye.cn/tools/json/formatter.html</strong></p>

<p>写代码时我习惯浏览器开一个标签页，接口返回的JSON直接丢进去格式化，省去本地跑脚本的麻烦。</p>

<h2>七、总结</h2>

<p>JSON的解析和序列化看似基础，但细节坑不少：</p>

<ul>
  <li><strong>解析</strong>时注意格式严格性，双引号、禁止尾部逗号</li>
  <li><strong>序列化</strong>时注意大数字精度、循环引用、日期对象</li>
  <li><strong>调试</strong>时善用在线工具，格式化输出大幅提升可读性</li>
  <li><strong>生产</strong>时使用压缩格式，减少传输体积</li>
</ul>

<p>把这些细节变成肌肉记忆，下次遇到JSON报错时，你就不用再靠运气了。</p>

<p>工具地址再放一次：<a href="https://tools.xsanye.cn/tools/json/formatter.html" target="_blank" rel="noopener">https://tools.xsanye.cn/tools/json/formatter.html</a> — 用起来，效率翻倍。</p>