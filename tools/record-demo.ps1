# ===========================================================================
#  录制玩法演示视频
# ===========================================================================
#  用 Chromium 的 DevTools 协议做两件事：
#    1. Page.captureScreenshot 逐帧截图（真实渲染结果，DOM 和 canvas 都在）
#    2. Input.dispatchMouseEvent 真的去点界面上的按钮
#
#  最后把带时间戳的帧重采样成固定帧率，封装成 MJPEG 的 AVI。
#  机器上没有 ffmpeg，所以 AVI 容器是这里手写的（RIFF 结构不复杂）。
#
#  用法（在 nahida-travel 目录下）：
#     powershell -ExecutionPolicy Bypass -File tools\record-demo.ps1
#     powershell -ExecutionPolicy Bypass -File tools\record-demo.ps1 -Fps 12 -Width 1280 -Height 720
#
#  产物：docs\demo.avi
#
#  ── 两个踩过的坑，改这个脚本前先看 ──────────────────────────────────
#  1) 文件必须存成 **带 BOM 的 UTF-8**。Windows PowerShell 5.1 会把没有 BOM 的
#     .ps1 当 ANSI 读，中文全乱，脚本直接语法错误。用 read/write 工具改完记得补。
#  2) 不要用 Page.startScreencast 抓帧 —— 它会自己缩放，拿到的大小和
#     Emulation 设的不一致（实测设 960x540 却给 934x366），视频会被拉变形。
#     Page.captureScreenshot 给的尺寸是准的。
# ===========================================================================

param(
  [int]$Width = 960,
  [int]$Height = 540,
  [int]$Quality = 62,
  [int]$Fps = 8,
  [string]$Out = 'docs\demo.avi',
  [int]$Port = 9334
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$prof = Join-Path $env:TEMP ("cdp_" + [guid]::NewGuid().ToString('N').Substring(0,8))
$frameDir = Join-Path $env:TEMP ("demoframes_" + [guid]::NewGuid().ToString('N').Substring(0,8))
Remove-Item $frameDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $frameDir | Out-Null

$pageUrl = "file:///" + ($root -replace '\\','/') + "/%E5%BC%80%E5%A7%8B%E6%B8%B8%E6%88%8F.html?demo=1"
$outPath = Join-Path $root $Out
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath) | Out-Null

# ---------------------------------------------------------------------------
# 演示脚本：t 是相对开头的秒数
#   cap   = 底部字幕（空串表示清掉）
#   click = 点某个元素：CSS 选择器，或者 @nahida 表示点她本人
#   eval  = 直接跑一段 JS
# ---------------------------------------------------------------------------
$script = @(
  @{ t = 0.5;  cap = '她住在你选的地方' },
  @{ t = 3.5;  cap = '点她一下，她会有反应' },
  @{ t = 3.9;  click = '@nahida' },
  @{ t = 6.5;  cap = '种田、做饭、攒玩具' },
  @{ t = 7.0;  click = '[data-act="modal"][data-arg="toys"]' },
  @{ t = 11.0; eval = 'NT.app.modal=null;NT.app.render()' },
  @{ t = 11.6; cap = '别的角色会自己跑来串门' },
  @{ t = 12.0; eval = 'NT.home.debugAddVisitor(NT.app.save,"paimon",Date.now());NT.app.render()' },
  @{ t = 16.5; cap = '送她出门：选方向、带料理' },
  @{ t = 17.0; click = '[data-act="modal"][data-arg="outdoor"]' },
  @{ t = 21.5; cap = '出发了 —— 旅途里能看到已经发生的事' },
  @{ t = 22.0; eval = 'NT.app.outMode="random";NT.app.outDish="none";NT.app.outRares=[];NT.app.depart()' },
  @{ t = 27.0; cap = '写明还要多久、几点回来，也可以关掉' },
  @{ t = 31.0; eval = 'NT.app.modal=null;NT.app.render()' },
  @{ t = 31.5; cap = '关掉后顶部常驻倒计时，关网页也算数' },
  @{ t = 36.0; cap = '她回来了 —— 带回一张明信片' },
  @{ t = 36.4; eval = 'NT.app.save.activeTrip.dueAt=Date.now()-1;NT.app.settleIfDue();NT.app.render()' },
  @{ t = 42.0; cap = '' }
)
$duration = 43.0

Write-Host "启动 Edge ..."
$proc = Start-Process -FilePath $edge -PassThru -ArgumentList @(
  '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars','--no-first-run',
  '--disable-extensions','--mute-audio',
  "--remote-debugging-port=$Port","--user-data-dir=$prof",
  "--window-size=$($Width+40),$($Height+140)", $pageUrl
)
Start-Sleep -Seconds 5

$ws = $null
$ct = [System.Threading.CancellationToken]::None
$buf = New-Object byte[] 8388608
$frames = New-Object System.Collections.ArrayList
$stepIdx = 0
$t0 = $null
$cmdId = 100
$evalErrors = 0

function Send-Cdp($id, $method, $params) {
  $obj = @{ id = $id; method = $method }
  if ($params) { $obj.params = $params }
  $json = $obj | ConvertTo-Json -Compress -Depth 10
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(15000) | Out-Null
}

function Read-Cdp([int]$timeoutMs) {
  $ms = New-Object System.IO.MemoryStream
  do {
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $task = $ws.ReceiveAsync($seg, $ct)
    if (-not $task.Wait($timeoutMs)) { $ms.Dispose(); return $null }
    $ms.Write($buf, 0, $task.Result.Count)
  } while (-not $task.Result.EndOfMessage)
  $txt = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
  $ms.Dispose()
  return $txt
}

# 等某条 id 的回复。**截图命令的回复和别的消息会交错**，
# 所以不能"读一条就当它是回复"，要按 id 匹配。
function Wait-Id([int]$id, [int]$timeoutMs) {
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  while ((Get-Date) -lt $deadline) {
    $left = [int](($deadline - (Get-Date)).TotalMilliseconds)
    if ($left -le 0) { break }
    $msg = Read-Cdp ([Math]::Min($left, 800))
    if (-not $msg) { continue }
    if ($msg -match ('"id":' + $id + '[,}]')) { return $msg }
  }
  return $null
}

function Click-Selector([string]$sel, [int]$id) {
  if ($sel -eq '@nahida') {
    $js = "JSON.stringify((function(){var g=document.getElementById('stage');if(!g)return null;" +
          "var r=g.getBoundingClientRect();var a=NT.app._anim||{x:0.5,y:0.9};" +
          "return [r.left+r.width*a.x, r.top+r.height*(a.y-0.14)];})())"
  } else {
    $s = $sel | ConvertTo-Json -Compress
    $js = "JSON.stringify((function(){var e=document.querySelector($s);if(!e)return null;" +
          "var r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})())"
  }
  Send-Cdp $id 'Runtime.evaluate' @{ expression = $js; returnByValue = $true }
  $resp = Wait-Id $id 5000
  if (-not $resp) { Write-Warning "点 $sel 没响应"; return }
  if ($resp -notmatch '\[([\d\.\-]+),([\d\.\-]+)\]') { Write-Warning "点不到 $sel"; return }
  $cx = [double]$matches[1]; $cy = [double]$matches[2]
  Send-Cdp ($id + 1) 'Input.dispatchMouseEvent' @{ type='mouseMoved'; x=$cx; y=$cy }
  Send-Cdp ($id + 2) 'Input.dispatchMouseEvent' @{ type='mousePressed'; x=$cx; y=$cy; button='left'; clickCount=1 }
  Send-Cdp ($id + 3) 'Input.dispatchMouseEvent' @{ type='mouseReleased'; x=$cx; y=$cy; button='left'; clickCount=1 }
}

function Run-Eval([string]$expr, [int]$id) {
  Send-Cdp $id 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true }
  $resp = Wait-Id $id 5000
  if ($resp -and $resp -match '"exceptionDetails"') {
    $script:evalErrors++
    Write-Warning ("eval 出错: " + $expr)
  }
}

try {
  $targets = (Invoke-WebRequest "http://127.0.0.1:$Port/json" -UseBasicParsing -TimeoutSec 10).Content | ConvertFrom-Json
  $page = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like '*%E5%BC%80%E5%A7%8B*' } | Select-Object -First 1
  if (-not $page) { throw "找不到游戏页面" }
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait(10000) | Out-Null
  Write-Host "已连接: $($ws.State)"

  Send-Cdp 1 'Page.enable' $null
  Send-Cdp 2 'Runtime.enable' $null
  Send-Cdp 3 'Emulation.setDeviceMetricsOverride' @{
    width = $Width; height = $Height; deviceScaleFactor = 1; mobile = $false
  }
  [void](Wait-Id 3 4000)
  Start-Sleep -Milliseconds 600

  $setup = @'
window.__cap=function(t){var d=document.getElementById('__cap');
if(!d){d=document.createElement('div');d.id='__cap';
d.style.cssText='position:fixed;left:50%;bottom:5%;transform:translateX(-50%);z-index:99999;'
+'background:rgba(12,11,9,.86);color:#f2ecdc;padding:.55em 1.5em;border-radius:999px;'
+'font:600 24px/1.5 system-ui,"Microsoft YaHei",sans-serif;white-space:nowrap;'
+'box-shadow:0 8px 30px rgba(0,0,0,.65);opacity:0;transition:opacity .35s;pointer-events:none';
document.body.appendChild(d);}
d.textContent=t;d.style.opacity=t?'1':'0';};
'@
  Send-Cdp 4 'Runtime.evaluate' @{ expression = $setup }
  [void](Wait-Id 4 4000)

  Write-Host "开始录制（$duration 秒）..."
  $t0 = Get-Date
  while ($true) {
    $elapsed = ((Get-Date) - $t0).TotalSeconds
    if ($elapsed -ge $duration) { break }

    while ($stepIdx -lt $script.Count -and $script[$stepIdx].t -le $elapsed) {
      $st = $script[$stepIdx]
      $cmdId += 10
      if ($st.ContainsKey('cap')) {
        Run-Eval ("__cap(" + ($st.cap | ConvertTo-Json -Compress) + ")") $cmdId
      }
      if ($st.ContainsKey('eval')) {
        Run-Eval $st.eval $cmdId
      }
      if ($st.ContainsKey('click')) {
        Click-Selector $st.click $cmdId
      }
      $stepIdx++
    }

    $cmdId++
    Send-Cdp $cmdId 'Page.captureScreenshot' @{ format = 'jpeg'; quality = $Quality }
    $resp = Wait-Id $cmdId 8000
    if ($resp) {
      $obj = $resp | ConvertFrom-Json
      $b64 = $obj.result.data
      if ($b64) {
        $idx = $frames.Count
        $f = Join-Path $frameDir ("f{0:D5}.jpg" -f $idx)
        [System.IO.File]::WriteAllBytes($f, [Convert]::FromBase64String($b64))
        [void]$frames.Add(@{ t = ((Get-Date) - $t0).TotalSeconds; path = $f })
      }
    }
  }
  Write-Host "采到 $($frames.Count) 张原始帧（eval 出错 $evalErrors 次）"
}
finally {
  if ($ws) { try { $ws.Dispose() } catch {} }
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $edge } | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
}

if ($frames.Count -lt 2) { throw "帧太少（$($frames.Count)），录制失败" }

# 实际帧尺寸（以第一帧为准，避免 AVI 头和真实画面比例不符导致画面被拉变形）
Add-Type -AssemblyName System.Drawing
$probe = [System.Drawing.Image]::FromFile($frames[0].path)
$vidW = $probe.Width; $vidH = $probe.Height
$probe.Dispose()
Write-Host "帧尺寸: ${vidW}x${vidH}（设定值 ${Width}x${Height}）"

Write-Host "重采样到 $Fps fps ..."
$totalFrames = [int]($duration * $Fps)
$picked = New-Object System.Collections.ArrayList
$cursor = 0
for ($i = 0; $i -lt $totalFrames; $i++) {
  $tt = $i / $Fps
  while ($cursor + 1 -lt $frames.Count -and $frames[$cursor + 1].t -le $tt) { $cursor++ }
  [void]$picked.Add($frames[$cursor].path)
}
Write-Host "输出 $($picked.Count) 帧"

Write-Host "封装 AVI ..."
$jpegs = @()
foreach ($p in $picked) { $jpegs += ,([System.IO.File]::ReadAllBytes($p)) }

$fs = [System.IO.File]::Create($outPath)
$bw = New-Object System.IO.BinaryWriter($fs)
# 注意开头的逗号：不加的话 PowerShell 会把 byte[] 拆开逐字节输出成 Object[]，
# BinaryWriter 就收不到正确的四字符码，写出来的 AVI 头部是坏的。
function FourCC([string]$s) { ,([System.Text.Encoding]::ASCII.GetBytes($s)) }

$movData = New-Object System.IO.MemoryStream
$mw = New-Object System.IO.BinaryWriter($movData)
$indexEntries = New-Object System.Collections.ArrayList
$maxFrame = 0
foreach ($j in $jpegs) {
  if ($j.Length -gt $maxFrame) { $maxFrame = $j.Length }
  $off = [int]$movData.Position + 4
  $mw.Write((FourCC '00dc')); $mw.Write([int]$j.Length); $mw.Write($j)
  if ($j.Length % 2 -eq 1) { $mw.Write([byte]0) }
  [void]$indexEntries.Add(@{ off = $off; size = $j.Length })
}
$mw.Flush()
$movBytes = $movData.ToArray()

$usPerFrame = [int](1000000 / $Fps)

$avih = New-Object System.IO.MemoryStream
$aw = New-Object System.IO.BinaryWriter($avih)
$aw.Write([int]$usPerFrame); $aw.Write([int]($maxFrame * $Fps)); $aw.Write([int]0)
$aw.Write([int]0x10); $aw.Write([int]$jpegs.Count); $aw.Write([int]0); $aw.Write([int]1)
$aw.Write([int]$maxFrame); $aw.Write([int]$vidW); $aw.Write([int]$vidH)
$aw.Write([int]0); $aw.Write([int]0); $aw.Write([int]0); $aw.Write([int]0)
$aw.Flush(); $avihBytes = $avih.ToArray()

$strh = New-Object System.IO.MemoryStream
$sw = New-Object System.IO.BinaryWriter($strh)
$sw.Write((FourCC 'vids')); $sw.Write((FourCC 'MJPG'))
$sw.Write([int]0); $sw.Write([int]0); $sw.Write([int]0); $sw.Write([int]0)
$sw.Write([int]1); $sw.Write([int]$Fps)
$sw.Write([int]0); $sw.Write([int]$jpegs.Count)
$sw.Write([int]$maxFrame); $sw.Write([int]-1); $sw.Write([int]0)
$sw.Write([int]0); $sw.Write([int]0); $sw.Write([int]$vidW); $sw.Write([int]$vidH)
$sw.Flush(); $strhBytes = $strh.ToArray()

$strf = New-Object System.IO.MemoryStream
$fw = New-Object System.IO.BinaryWriter($strf)
$fw.Write([int]40); $fw.Write([int]$vidW); $fw.Write([int]$vidH)
$fw.Write([int16]1); $fw.Write([int16]24); $fw.Write((FourCC 'MJPG'))
$fw.Write([int]($vidW * $vidH * 3)); $fw.Write([int]0); $fw.Write([int]0); $fw.Write([int]0); $fw.Write([int]0)
$fw.Flush(); $strfBytes = $strf.ToArray()

$bw.Write((FourCC 'RIFF')); $bw.Write([int]0); $bw.Write((FourCC 'AVI '))
$bw.Write((FourCC 'LIST')); $bw.Write([int](4 + 8 + $avihBytes.Length + 8 + 8 + $strhBytes.Length + 8 + $strfBytes.Length))
$bw.Write((FourCC 'hdrl'))
$bw.Write((FourCC 'avih')); $bw.Write([int]$avihBytes.Length); $bw.Write($avihBytes)
$bw.Write((FourCC 'LIST')); $bw.Write([int](4 + 8 + $strhBytes.Length + 8 + $strfBytes.Length))
$bw.Write((FourCC 'strl'))
$bw.Write((FourCC 'strh')); $bw.Write([int]$strhBytes.Length); $bw.Write($strhBytes)
$bw.Write((FourCC 'strf')); $bw.Write([int]$strfBytes.Length); $bw.Write($strfBytes)
$bw.Write((FourCC 'LIST')); $bw.Write([int](4 + $movBytes.Length)); $bw.Write((FourCC 'movi')); $bw.Write($movBytes)
$bw.Write((FourCC 'idx1')); $bw.Write([int](16 * $indexEntries.Count))
foreach ($e in $indexEntries) {
  $bw.Write((FourCC '00dc')); $bw.Write([int]0x10); $bw.Write([int]$e.off); $bw.Write([int]$e.size)
}
$totalLen = [int]$fs.Length
$bw.Flush()
$fs.Position = 4; $bw.Write([int]($totalLen - 8))
$bw.Flush(); $fs.Close()

Remove-Item $frameDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host ("完成: {0}" -f $outPath)
Write-Host ("  {0}x{1}  {2} fps  {3:N1} 秒  {4:N1} MB" -f $vidW, $vidH, $Fps, $duration, ((Get-Item $outPath).Length / 1MB))
