"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_scoring_ends.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import json, threading, http.server, functools
from playwright.sync_api import sync_playwright
SP=SHOTS
API='https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8790),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
official={}
def h(route):
    req=route.request
    if req.method=='POST':
        b=json.loads(req.post_data); official[str(b['pair'])]=b
        body={'ok':True,'a':b['a'],'b':b['b'],'n':len(b['state']['log']),'report':b['report']}
    else: body={'pairs':{k:{'updated':v['updated'],'state':v['state']} for k,v in official.items()}}
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(body))
B='http://127.0.0.1:8790/trong-tai.html'
def toks(pg): return {t['k']:t for t in pg.evaluate("[...document.querySelectorAll('#playCourt .tok')].map(t=>({k:t.dataset.k,x:parseFloat(t.style.left),y:parseFloat(t.style.top),c:t.className}))")}
def zone_of(pg,k):  # tap the box where player k stands, but away from the token itself
    t=toks(pg)[k]; q=('l' if t['x']<50 else 'r')+('t' if t['y']<50 else 'b')
    z=pg.locator('#playCourt .zone.'+q); bb=z.bounding_box(); pg.mouse.click(bb['x']+bb['width']*(0.85 if q[0]=='l' else 0.15)*0+bb['width']*0.5, bb['y']+(bb['height']*0.12 if q[1]=='t' else bb['height']*0.88)); pg.wait_for_timeout(370)
    return q
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in [(360,780),(375,667),(390,844)]:
        ctx=b.new_context(viewport={'width':W,'height':H}); ctx.route(API+'*',h); pg=ctx.new_page()
        pg.goto(B+'#T1/1/vitri'); pg.wait_for_timeout(300); pg.click('#pickLeft [data-left="a"]'); pg.click('#pickServe [data-serve="a"]'); pg.click('#startBtn'); pg.wait_for_timeout(400)
        print(W,H,'play page height', pg.evaluate('document.documentElement.scrollHeight'), 'acts bottom', round(pg.locator('.acts').bounding_box()['y']+pg.locator('.acts').bounding_box()['height']))
        pg.screenshot(path=f'{SP}/p_play_{W}.png'); ctx.close(); official.clear()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); ctx.route(API+'*',h); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(B+'#T1/1/vitri'); pg.wait_for_timeout(300); pg.click('#pickLeft [data-left="a"]'); pg.click('#pickServe [data-serve="a"]'); pg.click('#startBtn'); pg.wait_for_timeout(400)
    print('call at 0-0:', pg.inner_text('#call').replace('\n',' / '), '| hitL exists', pg.locator('#hitL').count())
    q=zone_of(pg,'a1'); lg=pg.evaluate("JSON.parse(localStorage.getItem('gcl-ref-T1')).pairs[0].log"); print('tap box',q,'-> log', lg, '| toast', pg.inner_text('#toastTxt'))
    # score: a gets points alternating players until 15, b gets some
    seq=['a0','b1','a1','b0']*0
    import itertools
    while True:
        sc=pg.evaluate("(()=>{var l=JSON.parse(localStorage.getItem('gcl-ref-T1')).pairs[0].log; var a=l.filter(e=>e.w=='a').length,b=l.length-a; return [a,b]})()")
        if sc[0]==15: break
        zone_of(pg, 'a0' if sc[0]%2 else 'a1')
        if sc[0] in (3,7,11): zone_of(pg,'b0')
    t0=toks(pg); print('before 16: a on left?', t0['a0']['x']<50, t0['a1']['x']<50, 'board L', pg.inner_text('#bL').split('\n')[0])
    zone_of(pg,'a0'); pg.wait_for_timeout(300)
    print('sheet at 16:', pg.is_visible('#sheet'), pg.inner_text('#sheetTitle'), '|', pg.inner_text('#sheetBody'))
    pg.screenshot(path=f'{SP}/p_swap_sheet.png')
    pg.click('#sheetAct .big.ghost'); pg.wait_for_timeout(500)  # undo
    t1=toks(pg); print('after undo: a on left', t1['a0']['x']<50, 'score a', pg.inner_text('#bL .sc'))
    zone_of(pg,'a0'); pg.wait_for_timeout(300); pg.click('#sheetAct .big.pri'); pg.wait_for_timeout(500)
    t2=toks(pg); print('after swap: a on right', t2['a0']['x']>50 and t2['a1']['x']>50, 'b on left', t2['b0']['x']<50, '| board L', pg.inner_text('#bL').split('\n')[0], '| colors a', 's-r' in t2['a0']['c'])
    pg.screenshot(path=f'{SP}/p_after_swap.png')
    zone_of(pg,'b1'); pg.wait_for_timeout(300); print('no second swap sheet:', pg.is_hidden('#sheet'))
    n=0
    while '/ket' not in pg.evaluate('location.hash') and n<40: zone_of(pg,'a1'); n+=1
    pg.wait_for_timeout(1800)
    print('end:', pg.inner_text('#result').replace('\n',' | '))
    st=official['1']['state']['stats']; print('sent stats:', json.dumps(st, ensure_ascii=False))
    lg=official['1']['state']['log']; print('null scorers', sum(1 for e in lg if e['p'] is None), 'rallies', len(lg))
    pg.screenshot(path=f'{SP}/p_end.png', full_page=True)
    pg.click('#nextBtn'); pg.wait_for_timeout(400); print('next ->', pg.evaluate('location.hash'), pg.inner_text('#title'))
    pg.goto(B+'#T1/tong'); pg.wait_for_timeout(400); print('sum:', pg.inner_text('#sum table.sum >> nth=0').replace('\n',' | '))
    pg.goto(B+'#T1/2/vitri'); pg.wait_for_timeout(300); pg.click('#pickLeft [data-left="b"]'); pg.click('#pickServe [data-serve="b"]'); pg.wait_for_timeout(200); pg.screenshot(path=f'{SP}/p_setup_new.png')
    print('errors', errs); b.close()
