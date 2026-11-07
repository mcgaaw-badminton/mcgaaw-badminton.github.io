"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_final.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import json, threading, http.server, functools
from playwright.sync_api import sync_playwright
SP=SHOTS
API='https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8798),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
official={}; finals=[]; logrows=[]
# Turnstile is on (config/site.json protect.turnstile_sitekey since v1.23.1): stub the widget so the Chốt passes without Cloudflare
TS_STUB = "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('test-token')},50)}};"

def h(route):
    req=route.request; url=req.url
    if req.method=='POST':
        b=json.loads(req.post_data)
        if b.get('final'):
            finals.append(b); body={'ok':True,'final':True,'match':b['match'],'report':b['report']}
        else:
            official[str(b['pair'])]=b; logrows.append((b['pair'],b['a'],b['b']))
            body={'ok':True,'a':b['a'],'b':b['b'],'n':len(b['state']['log']),'report':b['report']}
    elif 'ref=all' in url: body={'matches':{},'finals':({finals[-1]['match']:{'report':finals[-1]['report'],'pairs':finals[-1]['pairs']}} if finals else {})}
    else: body={'pairs':{k:{'updated':v['updated'],'state':v['state']} for k,v in official.items()}}
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(body))
B='http://127.0.0.1:8798/trong-tai.html'
def play_pair(pg,k,win_lt=True):
    pg.goto(B+f'#T1/{k}/vitri'); pg.wait_for_timeout(300)
    pg.click('#pickServe [data-serve="a"]'); pg.click('#startBtn'); pg.wait_for_timeout(300)
    n=0
    while '/ket' not in pg.evaluate('location.hash') and n<90:
        if pg.is_visible('#sheet'): pg.click('#sheetAct .big.pri')
        else: pg.click('#playCourt .zone.lt' if n%4 else '#playCourt .zone.rb')
        pg.wait_for_timeout(355); n+=1
    pg.wait_for_timeout(1300)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); ctx.route(API+'*',h); ctx.route('https://challenges.cloudflare.com/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=TS_STUB)); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    for k in range(1,5): play_pair(pg,k)
    pg.goto(B+'#T1'); pg.wait_for_timeout(400); print('4/5 done, final box:', repr(pg.inner_text('#pairFinal')))
    pg.click('#plist .abs[data-abs="4"]'); pg.wait_for_timeout(300); print('pair5 absent, final box:', repr(pg.inner_text('#pairFinal')))
    pg.click('#plist .abs[data-abs="4"]'); pg.wait_for_timeout(300)
    play_pair(pg,5)
    pg.click('#nextBtn'); pg.wait_for_timeout(400); print('after 5/5 next ->', pg.inner_text('#title'), '| sum final btn:', pg.locator('#sum .final-btn').count())
    pg.goto(B+'#T1'); pg.wait_for_timeout(400); print('pairs final box:', repr(pg.inner_text('#pairFinal')), '| pairs page h', pg.evaluate('document.documentElement.scrollHeight'))
    pg.screenshot(path=f'{SP}/f_pairs_ready.png')
    pg.click('#pairFinal .final-btn'); pg.wait_for_timeout(300); print('confirm:', pg.inner_text('#sheetBody').replace('\n',' | '))
    pg.click('#sheetAct .big.pri'); pg.wait_for_timeout(1500)
    print('after final:', pg.inner_text('#pairFinal').replace('\n',' | '), '| finals posted', len(finals), finals[-1]['pairs'], len(finals[-1]['players']))
    pg.screenshot(path=f'{SP}/f_pairs_final.png')
    pg.goto(B); pg.wait_for_timeout(300); print('match list:', pg.inner_text('#mlist .row >> nth=0').replace('\n',' '))
    # edit after final: change scorer of the last rally of pair 1
    pg.goto(B+'#T1/1/cacdiem'); pg.wait_for_timeout(400); pg.click('#log .lg >> nth=0'); pg.wait_for_timeout(300)
    pg.click('#sheetBody .wp[aria-pressed="false"] >> nth=0'); pg.wait_for_timeout(600)
    pg.goto(B+'#T1'); pg.wait_for_timeout(400); print('after edit:', pg.inner_text('#pairFinal').replace('\n',' | '))
    pg.click('#pairFinal .final-btn'); pg.wait_for_timeout(300); pg.click('#sheetAct .big.pri'); pg.wait_for_timeout(1500)
    print('re-final:', pg.inner_text('#pairFinal').replace('\n',' | ')[:80], '| finals posted', len(finals), '| log rows', len(logrows))
    pg.goto(B+'#T1/tong'); pg.wait_for_timeout(400); print('sum final box:', pg.inner_text('#sum .finalbox')[:70])
    # demo mode: no final button
    pg.goto(B); pg.wait_for_timeout(300); pg.click('#modePick [data-mode="demo"]'); pg.goto(B+'#T1'); pg.wait_for_timeout(300); print('demo final box empty:', pg.inner_text('#pairFinal')=='')
    print('errors', errs); b.close()
