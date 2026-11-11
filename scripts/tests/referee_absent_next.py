"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_absent_next.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import json, threading, http.server, functools
from playwright.sync_api import sync_playwright
from _clock import freeze
SP=SHOTS
API='https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8797),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
official={}
def h(route):
    req=route.request
    if req.method=='POST':
        b=json.loads(req.post_data); official[str(b['pair'])]=b
        body={'ok':True,'a':b['a'],'b':b['b'],'n':len(b['state']['log']),'report':b['report']}
    else: body={'pairs':{k:{'updated':v['updated'],'state':v['state']} for k,v in official.items()}}
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(body))
B='http://127.0.0.1:8797/trong-tai.html'
with sync_playwright() as p:
    b=freeze(p.chromium.launch())
    for W,H in [(390,844),(360,780)]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2); ctx.route(API+'*',h); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto(B+'#T1'); pg.wait_for_timeout(400)
        pg.click('#plist .abs[data-abs="1"]'); pg.wait_for_timeout(500)
        print(W,'pair2 absent:', pg.inner_text('#plist .row >> nth=1').replace('\n',' '), '| sent', official.get('2',{}).get('state',{}).get('absent'))
        pg.screenshot(path=f'{SP}/r_pairs_{W}.png'); print(W,'pairs page h', pg.evaluate('document.documentElement.scrollHeight'),'/',H)
        pg.goto(B+'#T1/2/vitri'); pg.wait_for_timeout(300); print(W,'direct link to absent ->', pg.evaluate('location.hash'), pg.inner_text('#title'))
        pg.click('#plist .rowlink >> nth=0'); pg.wait_for_timeout(300)
        pg.click('#pickServe [data-serve="a"]'); pg.click('#startBtn'); pg.wait_for_timeout(400)
        n=0
        while '/ket' not in pg.evaluate('location.hash') and n<80:
            if pg.is_visible('#sheet'): pg.click('#sheetAct .big.pri')
            else: pg.click('#playCourt .zone.lt' if n%5 else '#playCourt .zone.rb')
            pg.wait_for_timeout(360); n+=1
        pg.wait_for_timeout(1500)
        print(W,'end page h', pg.evaluate('document.documentElement.scrollHeight'),'/',H, '| next btn', pg.inner_text('#nextBtn'), 'bottom', round(pg.locator('#resumeBtn').bounding_box()['y']+pg.locator('#resumeBtn').bounding_box()['height']))
        pg.screenshot(path=f'{SP}/r_end_{W}.png')
        pg.click('#nextBtn'); pg.wait_for_timeout(400); print(W,'next ->', pg.evaluate('location.hash'), pg.inner_text('#title'), '| back label', pg.inner_text('#backTxt'), '| sheet?', pg.is_visible('#sheet'))
        pg.click('#plist .abs[data-abs="1"]'); pg.wait_for_timeout(300); print(W,'unmark ->', pg.inner_text('#plist .row >> nth=1').replace('\n',' '))
        pg.click('#plist .abs[data-abs="2"]'); pg.wait_for_timeout(300)
        pg.click('#toSum'); pg.wait_for_timeout(300); print(W,'sum rows:', pg.inner_text('#sum table.sum >> nth=0').replace('\n',' | ')[:260])
        pg.click('#back'); pg.wait_for_timeout(300); pg.click('#back'); pg.wait_for_timeout(300); print(W,'back x2 ->', pg.inner_text('#title'), '| list:', pg.inner_text('#mlist .row >> nth=0').replace('\n',' '))
        print(W,'errors', errs); ctx.close(); official.clear()
    b.close()
