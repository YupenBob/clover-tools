import json

with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'r') as f:
    tools = json.load(f)

cat_map = {}
for i, cat in enumerate(tools):
    cat_map[cat['category']] = i

def get_or_create(name):
    if name in cat_map:
        return tools[cat_map[name]]['tools']
    new_cat = {'category': name, 'tools': []}
    tools.append(new_cat)
    cat_map[name] = len(tools) - 1
    return new_cat['tools']

dev = get_or_create('开发工具')

# --- t15: Markdown编辑器 ---
custom_html_md = '<div class="row"><div class="col-md-6 mb-3"><textarea id="md-editor" class="form-control font-monospace" style="min-height:400px" placeholder="# 标题\n\n开始写作..."></textarea></div><div class="col-md-6 mb-3"><div id="md-preview" class="border rounded p-3 bg-white" style="min-height:400px;overflow-y:auto"></div></div></div><div class="mt-2"><button id="md-html-btn" class="btn btn-primary me-2">导出HTML</button><button id="md-copy-btn" class="btn btn-outline-secondary">复制HTML</button></div>'

custom_script_md = """document.getElementById('md-editor').addEventListener('input', function(e) {
    var md = e.target.value;
    var html = '';
    var lines = md.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.match(/^#{1,6}\s/)) {
            var level = line.match(/^#+ /)[0].length - 1;
            var text = line.replace(/^#+ /, '');
            html += '<h' + level + '>' + text + '</h' + level + '>';
        } else if (line.match(/^\*\s/)) {
            if (!html.endsWith('<ul>')) html += '<ul>';
            html += '<li>' + line.replace(/^\*\s/, '') + '</li>';
        } else {
            if (html.endsWith('<ul>')) html = html.slice(0, -5) + '</ul>';
            if (line.trim() === '') { html += '<br>'; }
            else {
                line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
                line = line.replace(/`(.+?)`/g, '<code>$1</code>');
                line = line.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
                html += '<p>' + line + '</p>';
            }
        }
    }
    document.getElementById('md-preview').innerHTML = html;
});
document.getElementById('md-html-btn').addEventListener('click', function() {
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Markdown Export</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;}</style></head><body>' + document.getElementById('md-preview').innerHTML + '</body></html>';
    var blob = new Blob([html], {type: 'text/html'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'markdown-export.html';
    a.click();
});
document.getElementById('md-copy-btn').addEventListener('click', function() {
    navigator.clipboard.writeText(document.getElementById('md-preview').innerHTML);
    alert('HTML已复制到剪贴板');
});"""

dev.append({"name": "Markdown编辑器", "path": "dev-tools/Markdown编辑器.html", "category": "开发工具", "type": "tool-custom", "desc": "在线 Markdown 编辑器，支持实时预览、分栏布局、语法高亮，可导出 HTML 或复制为富文本，适合写作与文档整理。", "keywords": ["Markdown", "Markdown编辑器", "Markdown预览", "MD编辑器", "写作工具"], "title": "Markdown编辑器 - 实时预览写作工具", "description": "在线Markdown编辑器，支持实时预览、语法高亮、分栏布局，可导出HTML，适合写作与文档整理", "icon": "bi bi-markdown", "customHtml": custom_html_md, "customScript": custom_script_md})
print("Added Markdown编辑器")

# --- t16: SQLite查看器 ---
custom_html_sqlite = '<div class="mb-3"><input type="file" id="sqlite-file" accept=".db,.sqlite,.sqlite3" class="form-control"></div><div id="sqlite-tables" class="mb-3"></div><div id="sqlite-content"></div>'

custom_script_sqlite = """document.getElementById('sqlite-file').addEventListener('change', async function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = new Uint8Array(e.target.result);
            initSqlJs({ locateFile: function() { return 'https://sql.js.org/dist/sql-wasm.wasm'; } }).then(function(SQL) {
                var db = new SQL.Database(data);
                var res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
                var tables = res.length > 0 ? res[0].values.map(function(r) { return r[0]; }) : [];
                var html = '<h6>Tables:</h6><div class="list-group">';
                tables.forEach(function(t) { html += '<button class="list-group-item list-group-item-action" onclick="loadTable(\\'' + t + '\\')">' + t + '</button>'; });
                html += '</div>';
                document.getElementById('sqlite-tables').innerHTML = html;
                window.currentDb = db;
                window.loadTable = function(name) {
                    var res = window.currentDb.exec('SELECT * FROM ' + name + ' LIMIT 100');
                    if (res.length === 0) { document.getElementById('sqlite-content').innerHTML = '<div class="text-muted">表为空</div>'; return; }
                    var cols = res[0].columns;
                    var rows = res[0].values;
                    var tableHtml = '<table class="table table-sm table-striped table-bordered"><thead><tr>';
                    cols.forEach(function(c) { tableHtml += '<th>' + c + '</th>'; });
                    tableHtml += '</tr></thead><tbody>';
                    rows.forEach(function(r) { tableHtml += '<tr>'; r.forEach(function(v) { tableHtml += '<td>' + (v !== null ? v : '<span class=text-muted>NULL</span>') + '</td>'; }); tableHtml += '</tr>'; });
                    tableHtml += '</tbody></table><div class="text-muted small mt-2">显示前 ' + rows.length + ' 条</div>';
                    document.getElementById('sqlite-content').innerHTML = tableHtml;
                };
            }).catch(function(err) { document.getElementById('sqlite-tables').innerHTML = '<div class="alert alert-danger">加载失败: ' + err.message + '</div>'; });
        } catch(err) { document.getElementById('sqlite-tables').innerHTML = '<div class="alert alert-danger">错误: ' + err.message + '</div>'; }
    };
    reader.readAsArrayBuffer(file);
});"""

dev.append({"name": "SQLite查看器", "path": "dev-tools/SQLite查看器.html", "category": "开发工具", "type": "tool-custom", "desc": "在线浏览 SQLite 数据库文件，无需安装任何软件。打开 .db/.sqlite/.sqlite3 文件，自动解析表结构与数据，支持查看表数据。", "keywords": ["SQLite", "SQLite查看器", "db文件", "sqlite浏览器", "数据库查看"], "title": "SQLite数据库查看器 - 在线浏览SQLite文件", "description": "在线打开和浏览SQLite数据库文件，无需安装，查看表结构和数据", "icon": "bi bi-database", "customHtml": custom_html_sqlite, "customScript": custom_script_sqlite})
print("Added SQLite查看器")

# --- t17: Javascript格式化 ---
dev.append({"name": "Javascript格式化", "path": "dev-tools/Javascript格式化.html", "category": "开发工具", "type": "formatter", "desc": "在线格式化/压缩 JavaScript 代码，支持一键美化（Pretty Print）与混淆压缩（Minify），并可自定义缩进空格数。", "keywords": ["JS格式化", "JavaScript格式化", "JS压缩", "JavaScript压缩", "JSON格式化"], "title": "JavaScript格式化/压缩工具", "description": "在线格式化（美化）或压缩（混淆）JavaScript代码，支持自定义缩进", "icon": "bi bi-braces", "inputPlaceholder": "输入要格式化的 JS 代码..."})
print("Added Javascript格式化")

with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)
print("Saved t15-t17")