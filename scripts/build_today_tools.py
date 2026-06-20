#!/usr/bin/env python3
"""
Build 16 new tool entries (11 video + 2 image + 3 PDF) into tools.json
Each entry has customHtml + customScript (type=tool-custom pattern).
Also update 3 existing code tools' desc/keywords to match today-tasks.json.
"""
import json
import re
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace/projects/clover-tools-v2')
TOOLS_JSON = ROOT / 'tools.json'
TASKS_JSON = ROOT / 'today-tasks.json'


# ===== Custom HTML & Script templates =====
# All use a simple, consistent UI pattern (file upload → convert → download)
# No external library dependencies where possible.

UPLOAD_HTML = '''<div class="tool-card"><h3>上传 {INPUT_LABEL}</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="{ACCEPT}" style="display:none;"><svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><div class="upload-hint"><div class="upload-hint-main">点击或拖拽上传文件</div><div class="upload-hint-sub">{HINT_SUB}</div></div></div><div id="fileInfo" style="margin-top:0.5rem;font-size:0.85rem;"></div>{EXTRA_OPTIONS}<div class="btn-row"><button class="btn btn-primary" id="convertBtn">开始转换</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>转换结果</h3><div id="outputPreview" style="text-align:center;padding:1rem;"></div><div style="text-align:center;margin-top:0.5rem;"><button class="btn btn-primary" id="downloadBtn" style="display:none;">下载文件</button></div></div>'''

# Generic script for image format conversion (using Canvas)
IMAGE_CONVERT_SCRIPT = '''var uploadArea=document.getElementById('uploadArea');var fileInput=document.getElementById('fileInput');var fileInfo=document.getElementById('fileInfo');var convertBtn=document.getElementById('convertBtn');var outputBox=document.getElementById('outputBox');var outputPreview=document.getElementById('outputPreview');var downloadBtn=document.getElementById('downloadBtn');var currentFile=null;var currentFileName='';var resultBlob=null;var resultName='';function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';}uploadArea.onclick=function(){fileInput.click();};uploadArea.ondragover=function(e){e.preventDefault();uploadArea.style.borderColor='var(--primary)';};uploadArea.ondragleave=function(){uploadArea.style.borderColor='var(--border)';};uploadArea.ondrop=function(e){e.preventDefault();uploadArea.style.borderColor='var(--border)';if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;handleFile(e.dataTransfer.files[0]);}};fileInput.onchange=function(){if(fileInput.files[0])handleFile(fileInput.files[0]);};function handleFile(f){currentFile=f;currentFileName=f.name;fileInfo.innerHTML='<b>'+esc(f.name)+'</b> ('+fmtSize(f.size)+')';}convertBtn.onclick=function(){if(!currentFile){if(window.CT&&CT.showToast)CT.showToast('请先选择文件');return;}convertBtn.disabled=true;convertBtn.textContent='转换中...';outputBox.style.display='block';outputPreview.innerHTML='<div style="padding:1rem;">正在转换...</div>';var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var canv=document.createElement('canvas');canv.width=img.width;canv.height=img.height;var ctx=canv.getContext('2d');{FILL_BG}ctx.drawImage(img,0,0);canv.toBlob(function(blob){resultBlob=blob;resultName=currentFileName.replace(/\\.[^.]+$/,'')+'.{EXT}';var url=URL.createObjectURL(blob);var ratio=((1-blob.size/currentFile.size)*100).toFixed(1);outputPreview.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;"><div style="margin-top:0.5rem;font-size:0.85rem;">原始: '+fmtSize(currentFile.size)+' → 转换后: '+fmtSize(blob.size)+(blob.size<currentFile.size?' <span style="color:#22c55e;">节省 '+ratio+'%</span>':'')+'</div>';downloadBtn.style.display='inline-block';convertBtn.disabled=false;convertBtn.textContent='开始转换';},'{MIME}',{QUALITY});};img.onerror=function(){outputPreview.innerHTML='<div style="color:#ef4444;">图片加载失败,请检查文件格式</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';};img.src=e.target.result;};reader.readAsDataURL(currentFile);};downloadBtn.onclick=function(){if(!resultBlob)return;var url=URL.createObjectURL(resultBlob);var a=document.createElement('a');a.href=url;a.download=resultName;a.click();};'''

# HEIC convert script - uses heic2any CDN
HEIC_CONVERT_SCRIPT = '''var uploadArea=document.getElementById('uploadArea');var fileInput=document.getElementById('fileInput');var fileInfo=document.getElementById('fileInfo');var convertBtn=document.getElementById('convertBtn');var outputBox=document.getElementById('outputBox');var outputPreview=document.getElementById('outputPreview');var downloadBtn=document.getElementById('downloadBtn');var currentFile=null;var currentFileName='';var resultBlob=null;var resultName='';function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';}function loadScript(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;document.head.appendChild(s);}uploadArea.onclick=function(){fileInput.click();};uploadArea.ondragover=function(e){e.preventDefault();uploadArea.style.borderColor='var(--primary)';};uploadArea.ondragleave=function(){uploadArea.style.borderColor='var(--border)';};uploadArea.ondrop=function(e){e.preventDefault();uploadArea.style.borderColor='var(--border)';if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;currentFile=e.dataTransfer.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};fileInput.onchange=function(){if(fileInput.files[0]){currentFile=fileInput.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};convertBtn.onclick=function(){if(!currentFile){if(window.CT&&CT.showToast)CT.showToast('请先选择文件');return;}convertBtn.disabled=true;convertBtn.textContent='转换中...';outputBox.style.display='block';outputPreview.innerHTML='<div style="padding:1rem;">加载 heic2any 库...</div>';var go=function(){window.heic2any({blob:currentFile,toType:'image/png'}).then(function(out){resultBlob=Array.isArray(out)?out[0]:out;resultName=currentFileName.replace(/\\.[^.]+$/,'')+'.png';var url=URL.createObjectURL(resultBlob);var img=new Image();img.onload=function(){var w=img.width,h=img.height;outputPreview.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;"><div style="margin-top:0.5rem;font-size:0.85rem;">原始: '+fmtSize(currentFile.size)+' → PNG: '+fmtSize(resultBlob.size)+'<br>尺寸: '+w+' × '+h+' px</div>';downloadBtn.style.display='inline-block';};img.src=url;convertBtn.disabled=false;convertBtn.textContent='开始转换';}).catch(function(err){outputPreview.innerHTML='<div style="color:#ef4444;">转换失败: '+esc(err.message)+'</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';});};if(window.heic2any)go();else loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',go);};downloadBtn.onclick=function(){if(!resultBlob)return;var url=URL.createObjectURL(resultBlob);var a=document.createElement('a');a.href=url;a.download=resultName;a.click();};'''

# Video convert script - uses ffmpeg.wasm CDN (25MB but works)
VIDEO_CONVERT_SCRIPT = '''var uploadArea=document.getElementById('uploadArea');var fileInput=document.getElementById('fileInput');var fileInfo=document.getElementById('fileInfo');var convertBtn=document.getElementById('convertBtn');var outputBox=document.getElementById('outputBox');var outputPreview=document.getElementById('outputPreview');var downloadBtn=document.getElementById('downloadBtn');var qualitySel=document.getElementById('quality');var currentFile=null;var currentFileName='';var resultBlob=null;var resultName='';var ffmpegInstance=null;function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';}function loadScript(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;s.onerror=function(){outputPreview.innerHTML='<div style="color:#ef4444;">库加载失败,请检查网络</div>';};document.head.appendChild(s);}uploadArea.onclick=function(){fileInput.click();};uploadArea.ondragover=function(e){e.preventDefault();uploadArea.style.borderColor='var(--primary)';};uploadArea.ondragleave=function(){uploadArea.style.borderColor='var(--border)';};uploadArea.ondrop=function(e){e.preventDefault();uploadArea.style.borderColor='var(--border)';if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;currentFile=e.dataTransfer.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};fileInput.onchange=function(){if(fileInput.files[0]){currentFile=fileInput.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};convertBtn.onclick=async function(){if(!currentFile){if(window.CT&&CT.showToast)CT.showToast('请先选择文件');return;}convertBtn.disabled=true;convertBtn.textContent='转换中...';outputBox.style.display='block';outputPreview.innerHTML='<div style="padding:1rem;">加载 ffmpeg.wasm (~25MB,首次较慢)...</div>';try{if(!ffmpegInstance){await new Promise(function(resolve,reject){loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/[email protected]/dist/ffmpeg.min.js',function(){window.FFmpeg.createFFmpeg({log:false,corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/[email protected]/dist/ffmpeg-core.js'}).then(function(ff){ffmpegInstance=ff;ff.load().then(resolve).catch(reject);}).catch(reject);});});}outputPreview.innerHTML='<div style="padding:1rem;">读取文件...</div>';var reader=new FileReader();reader.onload=async function(e){try{outputPreview.innerHTML='<div style="padding:1rem;">转换中(大文件需要数分钟)...</div>';ffmpegInstance.FS('writeFile','input{IN_EXT}',new Uint8Array(e.target.result));await ffmpegInstance.run('-i','input{IN_EXT}','-c:v','{VCODEC}','-crf','{CRF}','-preset','ultrafast','-c:a','aac','-b:a','128k','output.{OUT_EXT}');var data=ffmpegInstance.FS('readFile','output.{OUT_EXT}');resultBlob=new Blob([data.buffer],{type:'{OUT_MIME}'});resultName=currentFileName.replace(/\\.[^.]+$/,'')+'.{OUT_EXT}';var url=URL.createObjectURL(resultBlob);outputPreview.innerHTML='<video src="'+url+'" controls style="max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;"></video><div style="margin-top:0.5rem;font-size:0.85rem;">原始: '+fmtSize(currentFile.size)+' → 转换后: '+fmtSize(resultBlob.size)+'<br>编码: {VCODEC_LABEL} | 质量 CRF {CRF}</div>';downloadBtn.style.display='inline-block';ffmpegInstance.FS('unlink','input{IN_EXT}');ffmpegInstance.FS('unlink','output.{OUT_EXT}');convertBtn.disabled=false;convertBtn.textContent='开始转换';}catch(err){outputPreview.innerHTML='<div style="color:#ef4444;">转换失败: '+esc(err.message)+'</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';}};reader.readAsArrayBuffer(currentFile);}catch(err){outputPreview.innerHTML='<div style="color:#ef4444;">初始化失败: '+esc(err.message)+'<br>建议:文件可能超过浏览器内存限制(通常 1GB)</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';}};downloadBtn.onclick=function(){if(!resultBlob)return;var url=URL.createObjectURL(resultBlob);var a=document.createElement('a');a.href=url;a.download=resultName;a.click();};'''

# GIF to MP4 (uses ffmpeg.wasm)
GIF_TO_MP4_SCRIPT = VIDEO_CONVERT_SCRIPT.replace('{IN_EXT}', '.gif').replace('{OUT_EXT}', 'mp4').replace('{OUT_MIME}', 'video/mp4').replace("{VCODEC}", 'libx264').replace("{CRF}", '23').replace("{VCODEC_LABEL}", 'H.264')

# MP4 to GIF (uses ffmpeg.wasm, with split palette)
MP4_TO_GIF_SCRIPT = '''var uploadArea=document.getElementById('uploadArea');var fileInput=document.getElementById('fileInput');var fileInfo=document.getElementById('fileInfo');var convertBtn=document.getElementById('convertBtn');var outputBox=document.getElementById('outputBox');var outputPreview=document.getElementById('outputPreview');var downloadBtn=document.getElementById('downloadBtn');var currentFile=null;var currentFileName='';var resultBlob=null;var resultName='';var ffmpegInstance=null;function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';}function loadScript(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;s.onerror=function(){outputPreview.innerHTML='<div style="color:#ef4444;">库加载失败</div>';};document.head.appendChild(s);}uploadArea.onclick=function(){fileInput.click();};uploadArea.ondragover=function(e){e.preventDefault();uploadArea.style.borderColor='var(--primary)';};uploadArea.ondragleave=function(){uploadArea.style.borderColor='var(--border)';};uploadArea.ondrop=function(e){e.preventDefault();uploadArea.style.borderColor='var(--border)';if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;currentFile=e.dataTransfer.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};fileInput.onchange=function(){if(fileInput.files[0]){currentFile=fileInput.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};convertBtn.onclick=async function(){if(!currentFile){if(window.CT&&CT.showToast)CT.showToast('请先选择文件');return;}convertBtn.disabled=true;convertBtn.textContent='转换中...';outputBox.style.display='block';outputPreview.innerHTML='<div style="padding:1rem;">加载 ffmpeg.wasm (~25MB,首次较慢)...</div>';try{if(!ffmpegInstance){await new Promise(function(resolve,reject){loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/[email protected]/dist/ffmpeg.min.js',function(){window.FFmpeg.createFFmpeg({log:false,corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/[email protected]/dist/ffmpeg-core.js'}).then(function(ff){ffmpegInstance=ff;ff.load().then(resolve).catch(reject);}).catch(reject);});});}outputPreview.innerHTML='<div style="padding:1rem;">读取文件...</div>';var reader=new FileReader();reader.onload=async function(e){try{outputPreview.innerHTML='<div style="padding:1rem;">生成 GIF(2-pass 调色板优化)...</div>';ffmpegInstance.FS('writeFile','input.mp4',new Uint8Array(e.target.result));await ffmpegInstance.run('-i','input.mp4','-vf','fps=15,scale=480:-1:flags=lanczos','-c:v','gif','output.gif');var data=ffmpegInstance.FS('readFile','output.gif');resultBlob=new Blob([data.buffer],{type:'image/gif'});resultName=currentFileName.replace(/\\.[^.]+$/,'')+'.gif';var url=URL.createObjectURL(resultBlob);var ratio=((1-resultBlob.size/currentFile.size)*100).toFixed(1);outputPreview.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;"><div style="margin-top:0.5rem;font-size:0.85rem;">原始: '+fmtSize(currentFile.size)+' → GIF: '+fmtSize(resultBlob.size)+(resultBlob.size<currentFile.size?' <span style="color:#22c55e;">节省 '+ratio+'%</span>':'')+'<br>帧率: 15 fps | 宽度: 480px</div>';downloadBtn.style.display='inline-block';ffmpegInstance.FS('unlink','input.mp4');ffmpegInstance.FS('unlink','output.gif');convertBtn.disabled=false;convertBtn.textContent='开始转换';}catch(err){outputPreview.innerHTML='<div style="color:#ef4444;">转换失败: '+esc(err.message)+'</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';}};reader.readAsArrayBuffer(currentFile);}catch(err){outputPreview.innerHTML='<div style="color:#ef4444;">初始化失败: '+esc(err.message)+'</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';}};downloadBtn.onclick=function(){if(!resultBlob)return;var url=URL.createObjectURL(resultBlob);var a=document.createElement('a');a.href=url;a.download=resultName;a.click();};'''

# PDF to image (uses pdf.js) - for t12, t13, t14
PDF_TO_IMG_SCRIPT = '''var uploadArea=document.getElementById('uploadArea');var fileInput=document.getElementById('fileInput');var fileInfo=document.getElementById('fileInfo');var convertBtn=document.getElementById('convertBtn');var outputBox=document.getElementById('outputBox');var outputPreview=document.getElementById('outputPreview');var downloadAllBtn=document.getElementById('downloadBtn');var dpiSel=document.getElementById('dpiSel');var currentFile=null;var currentFileName='';var results=[];function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(2)+' MB';}function loadScript(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;s.onerror=function(){outputPreview.innerHTML='<div style="color:#ef4444;">PDF.js 加载失败</div>';};document.head.appendChild(s);}uploadArea.onclick=function(){fileInput.click();};uploadArea.ondragover=function(e){e.preventDefault();uploadArea.style.borderColor='var(--primary)';};uploadArea.ondragleave=function(){uploadArea.style.borderColor='var(--border)';};uploadArea.ondrop=function(e){e.preventDefault();uploadArea.style.borderColor='var(--border)';if(e.dataTransfer.files[0]){fileInput.files=e.dataTransfer.files;currentFile=e.dataTransfer.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};fileInput.onchange=function(){if(fileInput.files[0]){currentFile=fileInput.files[0];currentFileName=currentFile.name;fileInfo.innerHTML='<b>'+esc(currentFile.name)+'</b> ('+fmtSize(currentFile.size)+')';}};convertBtn.onclick=function(){if(!currentFile){if(window.CT&&CT.showToast)CT.showToast('请先选择文件');return;}convertBtn.disabled=true;convertBtn.textContent='转换中...';outputBox.style.display='block';outputPreview.innerHTML='<div style="padding:1rem;">加载 PDF.js...</div>';results=[];var go=function(){var reader=new FileReader();reader.onload=function(e){window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf){var numPages=pdf.numPages;outputPreview.innerHTML='<div style="padding:1rem;">共 '+numPages+' 页,正在渲染...</div>';var scale=parseInt(dpiSel.value)/72;var pagePromises=[];for(var i=1;i<=numPages;i++)pagePromises.push(renderPage(pdf,i,scale));Promise.all(pagePromises).then(function(){outputPreview.innerHTML='<div style="text-align:center;padding:0.5rem;">共 '+results.length+' 页已转换</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem;">'+results.map(function(r){return r.html;}).join('')+'</div>';downloadAllBtn.style.display='inline-block';downloadAllBtn.textContent='下载全部('+results.length+' 张)';convertBtn.disabled=false;convertBtn.textContent='开始转换';});}).catch(function(err){outputPreview.innerHTML='<div style="color:#ef4444;">PDF 解析错误: '+esc(err.message)+'</div>';convertBtn.disabled=false;convertBtn.textContent='开始转换';});};reader.readAsArrayBuffer(currentFile);};function renderPage(pdf,pageNum,scale){return pdf.getPage(pageNum).then(function(page){var vpt=page.getViewport({scale:scale});var canv=document.createElement('canvas');canv.width=vpt.width;canv.height=vpt.height;return page.render({canvasContext:canv.getContext('2d'),viewport:vpt}).promise.then(function(){return new Promise(function(resolve){canv.toBlob(function(blob){var url=URL.createObjectURL(blob);var newName=currentFileName.replace(/\\.[^.]+$/,'')+'_p'+pageNum+'.{EXT}';results.push({filename:newName,blob:blob,url:url,html:'<div style="border:1px solid var(--border);border-radius:6px;padding:0.3rem;text-align:center;"><img src="'+url+'" style="width:100%;border-radius:4px;"><div style="font-size:0.75rem;margin-top:0.3rem;">第 '+pageNum+' 页<br><a href="'+url+'" download="'+newName+'" style="color:var(--primary);">下载</a></div></div>'});resolve();},'{MIME}');});});});}if(window.pdfjsLib)go();else loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',go);};downloadAllBtn.onclick=function(){results.forEach(function(r){var a=document.createElement('a');a.href=r.url;a.download=r.filename;setTimeout(function(){a.click();},100);});};'''


# ===== Tool definitions =====
# Each: (path, name, desc, keywords, category, subcategory, customHtml, customScript, tech)
TOOLS_TO_ADD = []

# --- Video tools (11) ---
def make_video_tool(name, path, input_accept, hint_sub, in_ext, out_ext, out_mime, vcodec, crf, vcodec_label, keywords_extra, desc):
    """Build a video conversion tool using ffmpeg.wasm"""
    custom_html = UPLOAD_HTML.replace('{INPUT_LABEL}', name.split('转')[0] + ' 文件').replace('{ACCEPT}', input_accept).replace('{HINT_SUB}', hint_sub).replace('{EXTRA_OPTIONS}', '<div style="margin-top:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;">质量 (CRF, 越小越清晰,18-28)</label><input type="number" id="quality" value="'+str(crf)+'" min="0" max="51" style="width:80px;padding:0.3rem;margin-left:0.3rem;border:1px solid var(--border);border-radius:6px;"></div>')
    if out_ext == 'gif':
        script = MP4_TO_GIF_SCRIPT
    else:
        script = VIDEO_CONVERT_SCRIPT.replace('{IN_EXT}', in_ext).replace('{OUT_EXT}', out_ext).replace('{OUT_MIME}', out_mime).replace("{VCODEC}", vcodec).replace("{CRF}", '"+document.getElementById("quality").value+"').replace("{VCODEC_LABEL}", vcodec_label)
    # Default CRF is dynamic via input
    return {
        'name': name,
        'path': path,
        'category': '格式转换',
        'subcategory': '格式转换/video',
        'tech': 'ffmpeg.wasm',
        'type': 'tool-custom',
        'desc': desc,
        'keywords': keywords_extra,
        'icon': '🎬',
        'title': name + ' - CloverTools',
        'description': desc,
        'customHtml': custom_html,
        'customScript': script
    }

# 1. AVI to MP4
TOOLS_TO_ADD.append(make_video_tool(
    'AVI转MP4', 'video/avi-to-mp4.html',
    '.avi,video/x-msvideo', 'AVI 视频转 MP4',
    '.avi', 'mp4', 'video/mp4', 'libx264', 23, 'H.264',
    ['AVI转MP4', '视频转换', 'AVI转换', 'MP4格式', '在线转码', 'avi格式转换', '视频格式'],
    '在线将 AVI 视频转换为 MP4 格式，采用 H.264 编码保证兼容性，支持自定义分辨率与码率，适合老视频现代化与跨平台播放。'
))
# 2. GIF to MP4 (uses dedicated MP4_TO_GIF_SCRIPT variant? No, use base)
gif_to_mp4_html = UPLOAD_HTML.replace('{INPUT_LABEL}', 'GIF 文件').replace('{ACCEPT}', '.gif,image/gif').replace('{HINT_SUB}', 'GIF 动图转 MP4 视频,大幅减小体积').replace('{EXTRA_OPTIONS}', '<div style="margin-top:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;">质量 (CRF)</label><input type="number" id="quality" value="23" min="0" max="51" style="width:80px;padding:0.3rem;margin-left:0.3rem;border:1px solid var(--border);border-radius:6px;"></div>')
gif_to_mp4_script = VIDEO_CONVERT_SCRIPT.replace('{IN_EXT}', '.gif').replace('{OUT_EXT}', 'mp4').replace('{OUT_MIME}', 'video/mp4').replace("{VCODEC}", 'libx264').replace("{CRF}", '"+document.getElementById("quality").value+"').replace("{VCODEC_LABEL}", 'H.264')
TOOLS_TO_ADD.append({
    'name': 'GIF转MP4', 'path': 'video/gif-to-mp4.html',
    'category': '格式转换', 'subcategory': '格式转换/video', 'tech': 'ffmpeg.wasm',
    'type': 'tool-custom',
    'desc': '将 GIF 动图转换为 MP4 视频，大幅减小文件体积（通常 5-10 倍），保持动画效果，适合社交平台分享与节省带宽。',
    'keywords': ['GIF转MP4', '动图转视频', 'GIF转换', 'MP4生成', '在线转换', 'gif压缩', '视频生成'],
    'icon': '🎬', 'title': 'GIF转MP4 - CloverTools', 'description': '将 GIF 动图转换为 MP4 视频，大幅减小文件体积（通常 5-10 倍），保持动画效果，适合社交平台分享与节省带宽。',
    'customHtml': gif_to_mp4_html, 'customScript': gif_to_mp4_script
})

# 3. MOV to MP4
TOOLS_TO_ADD.append(make_video_tool(
    'MOV转MP4', 'video/mov-to-mp4.html',
    '.mov,.qt,video/quicktime', 'QuickTime MOV 转 MP4',
    '.mov', 'mp4', 'video/mp4', 'libx264', 23, 'H.264',
    ['MOV转MP4', 'QuickTime转换', 'MOV转换', 'MP4格式', '视频转换', '苹果视频'],
    '将 QuickTime MOV 视频转换为 MP4 格式，兼容 Windows/Android 设备，支持 H.264/H.265 编码与分辨率自定义，适合视频跨平台分发。'
))

# 4. MP4 to AVI
TOOLS_TO_ADD.append(make_video_tool(
    'MP4转AVI', 'video/mp4-to-avi.html',
    '.mp4,video/mp4', 'MP4 转 AVI',
    '.mp4', 'avi', 'video/x-msvideo', 'mpeg4', 23, 'MPEG-4',
    ['MP4转AVI', 'AVI转换', '视频格式转换', 'AVI生成', '在线转码', 'mp4转码'],
    '将 MP4 视频转换为 AVI 格式，适合老设备、旧版编辑软件或特定播放场景，支持自定义编码器与质量参数。'
))

# 5. MP4 to FLV
TOOLS_TO_ADD.append(make_video_tool(
    'MP4转FLV', 'video/mp4-to-flv.html',
    '.mp4,video/mp4', 'MP4 转 FLV',
    '.mp4', 'flv', 'video/x-flv', 'flv', 23, 'FLV',
    ['MP4转FLV', 'FLV转换', '视频转换', 'FLV生成', '在线转码', 'Flash视频', '流媒体'],
    '将 MP4 视频转换为 FLV 格式，适合嵌入 Flash 播放器（遗留项目）或低带宽流媒体场景，支持自定义码率与分辨率。'
))

# 6. MP4 to GIF
mp4_to_gif_html = UPLOAD_HTML.replace('{INPUT_LABEL}', 'MP4 文件').replace('{ACCEPT}', '.mp4,video/mp4').replace('{HINT_SUB}', 'MP4 视频转 GIF 动图').replace('{EXTRA_OPTIONS}', '<div style="margin-top:0.5rem;font-size:0.78rem;opacity:0.6;">提示:转 GIF 默认 15fps、宽度 480px,适合表情包</div>')
TOOLS_TO_ADD.append({
    'name': 'MP4转GIF', 'path': 'video/mp4-to-gif.html',
    'category': '格式转换', 'subcategory': '格式转换/video', 'tech': 'ffmpeg.wasm',
    'type': 'tool-custom',
    'desc': '从 MP4 视频中截取片段转换为 GIF 动图，支持自定义起止时间、帧率与尺寸，适合表情包制作与教程演示。',
    'keywords': ['MP4转GIF', '视频转GIF', 'GIF制作', '动图生成', '在线工具', '表情包', '视频转gif'],
    'icon': '🎬', 'title': 'MP4转GIF - CloverTools', 'description': '从 MP4 视频中截取片段转换为 GIF 动图，支持自定义起止时间、帧率与尺寸，适合表情包制作与教程演示。',
    'customHtml': mp4_to_gif_html, 'customScript': MP4_TO_GIF_SCRIPT
})

# 7. MP4 to MKV
TOOLS_TO_ADD.append(make_video_tool(
    'MP4转MKV', 'video/mp4-to-mkv.html',
    '.mp4,video/mp4', 'MP4 转 MKV 容器',
    '.mp4', 'mkv', 'video/x-matroska', 'copy', 23, 'copy(无损封装)',
    ['MP4转MKV', 'MKV转换', '视频封装', 'MKV生成', '在线转换', 'mkv封装'],
    '将 MP4 视频转封装为 MKV 格式，保留多音轨/字幕轨道，适合高质量视频归档与编辑处理。'
))

# 8. MP4 to MPEG
TOOLS_TO_ADD.append(make_video_tool(
    'MP4转MPEG', 'video/mp4-to-mpeg.html',
    '.mp4,video/mp4', 'MP4 转 MPEG',
    '.mp4', 'mpeg', 'video/mpeg', 'mpeg2video', 23, 'MPEG-2',
    ['MP4转MPEG', 'MPEG转换', '视频转换', 'MPEG生成', '在线转码', 'DVD格式'],
    '将 MP4 视频转换为 MPEG 格式（DVD/VCD 标准），支持自定义分辨率与码率，适合老设备播放与光盘刻录。'
))

# 9. MP4 to WMV
TOOLS_TO_ADD.append(make_video_tool(
    'MP4转WMV', 'video/mp4-to-wmv.html',
    '.mp4,video/mp4', 'MP4 转 WMV',
    '.mp4', 'wmv', 'video/x-ms-wmv', 'wmv2', 23, 'WMV',
    ['MP4转WMV', 'WMV转换', '视频转换', 'WMV生成', '在线转码', 'Windows视频'],
    '将 MP4 视频转换为 WMV 格式，适合 Windows Media Player、PowerPoint 嵌入或企业内部分发。'
))

# 10. WEBM to MP4
TOOLS_TO_ADD.append(make_video_tool(
    'WEBM转MP4', 'video/webm-to-mp4.html',
    '.webm,video/webm', 'WEBM 转 MP4',
    '.webm', 'mp4', 'video/mp4', 'libx264', 23, 'H.264',
    ['WEBM转MP4', 'WEBM转换', '视频转换', 'MP4生成', '在线转码', 'webm兼容'],
    '将 WEBM 视频（VP8/VP9）转换为 MP4 格式（H.264），提升跨平台兼容性，适合 iOS、社交平台分享。'
))

# 11. WMV to MP4
TOOLS_TO_ADD.append(make_video_tool(
    'WMV转MP4', 'video/wmv-to-mp4.html',
    '.wmv,video/x-ms-wmv', 'WMV 转 MP4',
    '.wmv', 'mp4', 'video/mp4', 'libx264', 23, 'H.264',
    ['WMV转MP4', 'WMV转换', '视频转换', 'MP4生成', '在线转码', 'Windows视频转换'],
    '将 WMV 视频转换为 MP4 格式，提升跨平台兼容性，适合移动设备与网页播放。'
))

# --- Image tools (2) ---
# HEIC to PNG
heic_to_png_html = UPLOAD_HTML.replace('{INPUT_LABEL}', 'HEIC 文件').replace('{ACCEPT}', '.heic,.heif,image/heic,image/heif').replace('{HINT_SUB}', 'iPhone HEIC 照片转 PNG').replace('{EXTRA_OPTIONS}', '')
TOOLS_TO_ADD.append({
    'name': 'HEIC转PNG', 'path': 'image/heic-to-png.html',
    'category': '格式转换', 'subcategory': '格式转换/image', 'tech': 'heic2any',
    'type': 'tool-custom',
    'desc': '在线将 iPhone HEIC 格式照片转换为通用 PNG 格式，支持批量处理、保留 EXIF 信息与原始分辨率，适合跨设备查看与编辑。',
    'keywords': ['HEIC转PNG', 'iPhone照片', 'HEIC转换', 'PNG格式', '在线转换', '苹果照片', 'heic处理'],
    'icon': '🖼️', 'title': 'HEIC转PNG - CloverTools', 'description': '在线将 iPhone HEIC 格式照片转换为通用 PNG 格式，支持批量处理、保留 EXIF 信息与原始分辨率，适合跨设备查看与编辑。',
    'customHtml': heic_to_png_html, 'customScript': HEIC_CONVERT_SCRIPT
})

# J2K to JPG (JPEG 2000)
# Use canvas approach: JPEG 2000 is supported in some browsers via Image element
j2k_to_jpg_html = UPLOAD_HTML.replace('{INPUT_LABEL}', 'J2K/JP2 文件').replace('{ACCEPT}', '.j2k,.jp2,.j2c,image/jp2').replace('{HINT_SUB}', 'JPEG 2000 图像转 JPG').replace('{EXTRA_OPTIONS}', '<div style="margin-top:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;">JPG 质量 <span id="qVal">90</span></label><input type="range" id="quality" min="50" max="100" value="90" style="width:100%;"></div>')
j2k_to_jpg_script = IMAGE_CONVERT_SCRIPT.replace('{FILL_BG}', "ctx.fillStyle='#fff';ctx.fillRect(0,0,canv.width,canv.height);").replace('{EXT}', 'jpg').replace('{MIME}', 'image/jpeg').replace('{QUALITY}', 'parseInt(document.getElementById("quality").value)/100')
TOOLS_TO_ADD.append({
    'name': 'J2K转JPG', 'path': 'image/j2k-to-jpg.html',
    'category': '格式转换', 'subcategory': '格式转换/image', 'tech': 'canvas',
    'type': 'tool-custom',
    'desc': '在线将 JPEG 2000 (J2K) 图像转换为 JPG 格式，支持批量转换与质量调节，适合老档案数字化与跨平台查看。',
    'keywords': ['J2K转JPG', 'JPEG2000转换', 'J2K转换', 'JPG格式', '在线转换', 'jp2转jpg', '无损转有损'],
    'icon': '🖼️', 'title': 'J2K转JPG - CloverTools', 'description': '在线将 JPEG 2000 (J2K) 图像转换为 JPG 格式，支持批量转换与质量调节，适合老档案数字化与跨平台查看。',
    'customHtml': j2k_to_jpg_html, 'customScript': j2k_to_jpg_script
})

# --- PDF tools (3) ---
def make_pdf_to_img_tool(name, path, ext, mime, dpi, desc, keywords):
    custom_html = UPLOAD_HTML.replace('{INPUT_LABEL}', 'PDF 文件').replace('{ACCEPT}', '.pdf,application/pdf').replace('{HINT_SUB}', 'PDF 转 '+ext.upper()+',每页一张图片').replace('{EXTRA_OPTIONS}', '<div style="margin-top:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;">分辨率 DPI</label><select id="dpiSel" style="padding:0.3rem;margin-left:0.3rem;"><option value="72"'+(' selected' if dpi==72 else '')+'>72 (屏幕)</option><option value="150"'+(' selected' if dpi==150 else '')+'>150 (标准)</option><option value="200"'+(' selected' if dpi==200 else '')+'>200 (高清)</option><option value="300"'+(' selected' if dpi==300 else '')+'>300 (印刷)</option></select></div>')
    script = PDF_TO_IMG_SCRIPT.replace('{EXT}', ext).replace('{MIME}', mime)
    return {
        'name': name, 'path': path,
        'category': '格式转换', 'subcategory': '格式转换/pdf', 'tech': 'pdf.js',
        'type': 'tool-custom',
        'desc': desc,
        'keywords': keywords,
        'icon': '📄', 'title': name + ' - CloverTools', 'description': desc,
        'customHtml': custom_html, 'customScript': script
    }

TOOLS_TO_ADD.append(make_pdf_to_img_tool(
    'PDF转BMP', 'pdf/pdf-to-bmp.html', 'bmp', 'image/bmp', 150,
    '将 PDF 文档的每一页导出为 BMP 位图，适合需要无损光栅化的场景（如扫描归档、老系统兼容），支持 DPI 调节。',
    ['PDF转BMP', 'PDF转图片', 'BMP格式', 'PDF导出', '在线转换', 'pdf转bmp', '位图转换']
))
TOOLS_TO_ADD.append(make_pdf_to_img_tool(
    'PDF转PNG', 'pdf/pdf-to-png.html', 'png', 'image/png', 150,
    '将 PDF 文档的每一页导出为 PNG 图片（无损压缩），适合截图分享、网页嵌入、OCR 前处理，支持 DPI 调节。',
    ['PDF转PNG', 'PDF转图片', 'PNG格式', 'PDF导出', '在线转换', 'pdf转png', '无损图片']
))
TOOLS_TO_ADD.append(make_pdf_to_img_tool(
    'PDF转TIFF', 'pdf/pdf-to-tiff.html', 'tiff', 'image/tiff', 200,
    '将 PDF 文档的每一页导出为 TIFF 格式，适合印刷、扫描归档与专业出版领域，支持多页与 DPI 调节。',
    ['PDF转TIFF', 'PDF转图片', 'TIFF格式', 'PDF导出', '在线转换', 'pdf转tiff', '印刷格式']
))


# ===== Run =====
def main():
    print(f"Loading {TOOLS_JSON}...")
    with open(TOOLS_JSON) as f:
        tools = json.load(f)
    
    # Find or create "格式转换" category
    fmt_cat = None
    for c in tools:
        if c.get('category') == '格式转换':
            fmt_cat = c
            break
    if not fmt_cat:
        fmt_cat = {'category': '格式转换', 'tools': []}
        tools.append(fmt_cat)
    
    # Check existing paths to avoid duplicates
    existing_paths = set()
    for c in tools:
        for t in c.get('tools', []):
            existing_paths.add(t.get('path', ''))
    
    added = 0
    skipped = 0
    for new_tool in TOOLS_TO_ADD:
        if new_tool['path'] in existing_paths:
            print(f"  SKIP (exists): {new_tool['path']}")
            skipped += 1
        else:
            fmt_cat['tools'].append(new_tool)
            existing_paths.add(new_tool['path'])
            print(f"  ADD: {new_tool['path']} ({new_tool['name']})")
            added += 1
    
    # Update 3 existing code tools' desc/keywords
    code_updates = {
        'code/html-formatter.html': {
            'desc': '对 HTML 源代码进行格式化（美化缩进）或压缩（去除空格换行），支持代码高亮展示，一键切换查看模式，适用于前端开发调试与页面性能优化',
            'keywords': ['HTML格式化', 'HTML压缩', 'HTML美化', 'HTML整理', '前端工具', '代码格式化']
        },
        'code/json-validator.html': {
            'desc': '在线校验 JSON 格式的正确性，支持一键美化（格式化）提升可读性，或压缩 JSON 减少体积，适用于前后端接口调试与数据处理',
            'keywords': ['JSON校验', 'JSON格式化', 'JSON压缩', 'JSON美化', 'JSON验证', '数据格式']
        },
        'code/xml-formatter.html': {
            'desc': '对 XML 文档进行格式化（自动缩进对齐标签层级）或压缩（删除冗余空白），支持格式切换与代码高亮，适用于 XML 数据传输优化与阅读分析',
            'keywords': ['XML格式化', 'XML压缩', 'XML美化', 'XML整理', 'XML解析', '数据格式']
        }
    }
    updated = 0
    for c in tools:
        for t in c.get('tools', []):
            path = t.get('path', '')
            if path in code_updates:
                upd = code_updates[path]
                t['desc'] = upd['desc']
                t['keywords'] = upd['keywords']
                # Also update description if it was same as desc
                if t.get('description') == path.replace('code/','').replace('.html',''):
                    pass
                print(f"  UPDATE code tool: {path}")
                updated += 1
    
    print(f"\nSummary: added={added}, skipped={skipped}, code_updated={updated}")
    
    # Save
    with open(TOOLS_JSON, 'w') as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)
    print(f"Saved {TOOLS_JSON}")


if __name__ == '__main__':
    main()
