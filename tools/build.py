import base64, json, os, sys
import subprocess
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(root, 'assets')
# the terrain tiles are baked from the level files first
subprocess.run(['node', os.path.join(root, 'tools/bake_levels.cjs')], check=True)
assets = {
 'idle': 'animations/player/movement/IdleSheet__r2c12__96x96.png',
 'run': 'animations/player/movement/RunSheet__r1c10__48x48.png',
 'jump': 'animations/player/movement/JumpSheet__r1c12__48x48.png',
 'fall': 'animations/player/movement/FallSheet__r2c6__48x48.png',
 'roll': 'animations/player/movement/Roll__r1c4__48x48.png',
 'wall': 'animations/player/movement/WallSlide__r1c3__96x96.png',
 'death': 'animations/player/movement/DeathSheet__r1c7__48x48.png',
 'tether': 'animations/objects/Tether__r1c24__48x48.png',
 'voidBody': 'animations/void/body__r1c1__48x48.png',
 'voidFace': 'animations/void/face__r1c1__48x48.png',
 'orb': 'animations/buzzer/OrbIdle__r1c8__48x48.png',
 'g255_orb': 'guardian/g255_orb.png',
 'g255_body': 'guardian/g255_body.png',
 'g255_eyes': 'guardian/g255_eyes.png',
}
data = {k: 'data:image/png;base64,' + base64.b64encode(open(os.path.join(A, v), 'rb').read()).decode() for k, v in assets.items()}
# the ten SEEKER NET seekers that can wake as the companion
seekers = json.load(open(os.path.join(A, 'seeker/seekers.json')))
for q in seekers:
    data['seeker%d' % q['id']] = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(A, 'seeker/seeker%d.png' % q['id']), 'rb').read()).decode()
# terrain: the ice-biome tileset and each level's baked tiles (node tools/bake_levels.cjs)
data['tiles'] = json.load(open(os.path.join(root, 'tools/ice_tiling.json')))['main']['image']
for n in range(1, 10):
    tp = os.path.join(root, 'build/terrain%d.png' % n)
    if os.path.exists(tp):
        data['terrain%d' % n] = 'data:image/png;base64,' + base64.b64encode(open(tp, 'rb').read()).decode()
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
import glob
lv_files = sorted(glob.glob(os.path.join(root, 'build/level[0-9].json')), key=lambda p: int(os.path.basename(p)[5:-5]))
levels = '[' + ','.join(open(p).read().strip() for p in lv_files) + ']'
print('levels', [os.path.basename(p) for p in lv_files])
html = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Dweller</title>
<meta name="description" content="Stay in the shadow. Reach the rainbow crystal. A dark side-scroller set in The Seeker universe.">
<meta property="og:type" content="website">
<meta property="og:title" content="Dweller">
<meta property="og:description" content="Stay in the shadow. Reach the rainbow crystal. A dark side-scroller set in The Seeker universe.">
<meta property="og:image" content="https://johnnydebtt.github.io/DWELLER-2.0/dist/preview.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://johnnydebtt.github.io/DWELLER-2.0/dist/preview.png">
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#07070c;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
canvas{position:fixed;inset:0;display:block;image-rendering:pixelated;image-rendering:crisp-edges;background:#000}
#loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#8a919e;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.3em;text-transform:uppercase;pointer-events:none}
#err{display:none;position:fixed;left:8px;right:8px;bottom:8px;max-height:40vh;overflow:auto;white-space:pre-wrap;background:#200;color:#fcc;font:12px ui-monospace,monospace;padding:8px;border-radius:4px;z-index:9}
#touch{position:fixed;inset:0;pointer-events:none;display:none;z-index:5}
body.touch.playing #touch{display:block}
#tbE{display:none}
body.cmp #tbE{display:flex}
.tb{position:absolute;pointer-events:auto;display:flex;align-items:center;justify-content:center;color:#cfd8e0;background:rgba(40,48,60,.38);border:2px solid rgba(160,180,200,.35);border-radius:50%;font:700 18px ui-monospace,Menlo,monospace;touch-action:none;-webkit-tap-highlight-color:transparent}
.tb.on{background:rgba(185,168,123,.5);border-color:rgba(230,215,170,.8)}
#tbL{left:calc(14px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:74px;height:74px}
#tbR{left:calc(104px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:74px;height:74px}
#tbJ{right:calc(14px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom));width:88px;height:88px;font-size:15px}
#tbD{right:calc(112px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom));width:64px;height:64px;font-size:12px}
#tbE{right:calc(30px + env(safe-area-inset-right));bottom:calc(132px + env(safe-area-inset-bottom));width:58px;height:58px;font-size:11px;color:#bfeee4;border-color:rgba(93,170,153,.6)}
#tbP{right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));width:40px;height:40px;font-size:14px}
</style></head>
<body>
<!--
 DWELLER - a six-level side-scroller. Code: MIT OR Apache-2.0. Music and sound: generated live in the browser in the Seeker's 48 Hz tuning.
 Includes or adapts assets from The Seeker by The Seeker contributors, licensed CC BY 4.0:
 https://creativecommons.org/licenses/by/4.0/
 Original project: https://github.com/TheSeekerGame/the-seeker
 The companion is one of ten SEEKER NET seekers (#1895, 2, 7, 11, 13, 14, 15, 25, 29, 78; https://github.com/TheSeekerGame/collections), drawn from their layers.
 Changes were made where applicable (re-lit, recoloured, re-sliced for a low-resolution renderer).
-->
<canvas id="c"></canvas>
<div id="touch"></div>
<div id="loading">loading</div>
<div id="err"></div>
<script>window.DWELLER_ASSETS=%ASSETS%;window.DWELLER_LEVELS=%LEVELS%;window.DWELLER_SEEKERS=%SEEKERS%;</script>
<script>%SIM%</script>
<script>%RENDER%</script>
<script>%AUDIO%</script>
<script>%MAIN%</script>
</body></html>'''
out = (html.replace('%ASSETS%', json.dumps(data)).replace('%LEVELS%', levels).replace('%SEEKERS%', json.dumps([dict(id=q['id'], cw=q['cw'], name=q['name']) for q in seekers]))
       .replace('%SIM%', rd('src/sim.js')).replace('%RENDER%', rd('src/render.js'))
       .replace('%AUDIO%', rd('src/audio.js')).replace('%MAIN%', rd('src/main.js')))
p = os.path.join(root, 'dist/dweller.html')
open(p, 'w', encoding='utf-8').write(out)
print('wrote', p, len(out) // 1024, 'KB')
