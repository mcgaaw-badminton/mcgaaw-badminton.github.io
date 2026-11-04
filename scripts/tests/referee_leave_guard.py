"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_leave_guard.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import json, threading, http.server, functools
from playwright.sync_api import sync_playwright
SP=SHOTS
API='https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8791),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
official={}; posts=[]
def h(route):
    req=route.request
    if req.method=='POST':
        b=json.loads(req.post_data); posts.append((b['pair'],b['a'],b['b'],len(b['state']['log']))); official[str(b['pair'])]={'updated':b['updated'],'state':b['state'],'a':b['a'],'b':b['b']}
        body={'ok':True,'a':b['a'],'b':b['b'],'n':len(b['state']['log']),'report':b['report']}
    else: body={'pairs':official}
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(body))
B='http://127.0.0.1:8791/trong-tai.html'
def pair(pg): return pg.evaluate("JSON.parse(localStorage.getItem('gcl-ref-T1')).pairs[0]")
def c(pg,s,w=250): pg.click(s); pg.wait_for_timeout(w)
with sync_playwright() as p:
    b=p.chromium.launch()
    for (W,H) in [(390,844),(360,780),(375,667)]:
        ctx=b.new_context(viewport={'width':W,'height':H}); ctx.route(API+'*',lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"pairs":{}}'))
        pg=ctx.new_page(); pg.goto(B+'#T1/1/vitri'); pg.wait_for_timeout(300); c(pg,'#pickServe [data-serve="a"]')
        print(W,H,'setup page height', pg.evaluate('document.documentElement.scrollHeight'), 'start btn bottom', round(pg.locator('#startBtn').bounding_box()['y']+pg.locator('#startBtn').bounding_box()['height']))
        pg.screenshot(path=f'{SP}/z_setup_{W}.png'); ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); ctx.route(API+'*',h)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(B+'#T1/1/vitri'); pg.wait_for_timeout(400)
    print('default far', pair(pg)['setup']['far'], 'serve step on', 'off' not in pg.get_attribute('#step3','class'))
    c(pg,'#setupCourt .tok[data-k="a1"] i'); print('tap a1 swaps:', pair(pg)['setup']['far'])
    c(pg,'#pickServe [data-serve="b"]'); print('posts after positions only:', posts)
    c(pg,'#back',400); print('leave sheet:', pg.is_visible('#sheet'), pg.inner_text('#sheetTitle'), '| hash', pg.evaluate('location.hash'))
    c(pg,'#sheetAct .big.danger',500); print('after không lưu:', pg.evaluate('location.hash'), pair(pg)['setup'], '| pairs row:', pg.inner_text('#plist .row >> nth=0').replace('\n',' '))
    c(pg,'#plist .row >> nth=0',400); print('re-enter blank:', pair(pg)['setup']['left'])
    # unchanged visit: no prompt
    c(pg,'#back',400); print('unchanged leave -> no sheet:', pg.is_hidden('#sheet'), pg.evaluate('location.hash'))
    # real scoring, save and exit
    c(pg,'#plist .row >> nth=0',400); c(pg,'#pickServe [data-serve="a"]'); c(pg,'#startBtn',400)
    for s in ['#playCourt .zone.lt','#playCourt .zone.lt','#playCourt .zone.rt']: c(pg,s,380)
    pg.wait_for_timeout(800); print('team progress:', pg.inner_text('#bL .tprog'), pg.get_attribute('#bL .prog i','style'))
    pg.screenshot(path=f'{SP}/z_play.png')
    c(pg,'#back',400); print('back to setup (same pair) no sheet:', pg.is_hidden('#sheet'))
    for _ in range(4):
        if pg.is_visible("#sheet"): break
        pg.go_back(); pg.wait_for_timeout(400)
    print("phone back leaving pair -> sheet:", pg.is_visible("#sheet"), pg.evaluate("location.hash"))
    c(pg,'#sheetAct .big.pri',500); print('saved & left:', pg.evaluate('location.hash'), pg.inner_text('#plist .row >> nth=0').replace('\n',' '), '| bar', pg.get_attribute('#plist .row >> nth=0 >> .prog i','style'))
    pg.screenshot(path=f'{SP}/z_pairs.png')
    # second visit: add 2 points then leave without saving -> back to 2-1 and the sheet gets 2-1 again
    c(pg,'#plist .row >> nth=0',400); c(pg,'#playCourt .zone.rt',380); c(pg,'#playCourt .zone.rt',380); pg.wait_for_timeout(800); print('sheet now', official['1']['a'], official['1']['b'])
    c(pg,'#back',300); c(pg,'#back',400); print('sheet text:', pg.inner_text('#sheetBody'))
    c(pg,'#sheetAct .big.danger',1500); r=pair(pg); print('restored log len', len(r['log']), '| sheet row', official['1']['a'], official['1']['b'], len(official['1']['state']['log']))
    # finish a pair and go next: no prompt
    c(pg,'#plist .row >> nth=0',400)
    while '/ket' not in pg.evaluate('location.hash'): (pg.click('#sheetAct .big.pri') if pg.is_visible('#sheet') else pg.click('#playCourt .zone.lt')); pg.wait_for_timeout(360)
    pg.wait_for_timeout(1500); c(pg,'#nextBtn',500); print('next after done -> no sheet:', pg.is_hidden('#sheet'), pg.evaluate('location.hash'))
    pg.goto(B); pg.wait_for_timeout(400); print('match row bar:', pg.get_attribute('#mlist .row >> nth=0 >> .prog i','style'), pg.inner_text('#mlist .row >> nth=0').replace('\n',' '))
    pg.screenshot(path=f'{SP}/z_list.png')
    print('errors', errs); b.close()
