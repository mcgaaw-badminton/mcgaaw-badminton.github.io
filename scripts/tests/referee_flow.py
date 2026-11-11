"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_flow.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import json, threading, http.server, functools, time
from playwright.sync_api import sync_playwright
from _clock import freeze
SP=SHOTS
API='https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8792),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
official={}; drafts=[]
def h(route):
    req=route.request; time.sleep(.4)
    if req.method=='POST':
        b=json.loads(req.post_data)
        if b.get('draft'): drafts.append(b)
        else: official[str(b['pair'])]={'updated':b['updated'],'state':b['state'],'report':b['report']}
        body={'ok':True,'a':b['a'],'b':b['b'],'n':len(b['state']['log']),'report':b['report']}
    else: body={'pairs':official}
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(body))
def toks(pg,sel='#playCourt'):
    return {t['k']:t for t in pg.evaluate(f"""[...document.querySelectorAll('{sel} .tok')].map(t=>({{k:t.dataset.k, x:parseFloat(t.style.left), y:parseFloat(t.style.top), c:t.className}}))""")}
def tap(pg,sel,wait=380): pg.click(sel); pg.wait_for_timeout(wait)
with sync_playwright() as p:
    b=freeze(p.chromium.launch()); ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); ctx.route(API+'*',h)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('http://127.0.0.1:8792/trong-tai.html'); pg.wait_for_timeout(700); pg.screenshot(path=f'{SP}/s1_list.png')
    tap(pg,'#mlist .row >> nth=0'); pg.screenshot(path=f'{SP}/s2_pairs.png')
    tap(pg,'#plist .row >> nth=0'); print('setup start disabled:', pg.is_disabled('#startBtn'))
    pg.screenshot(path=f'{SP}/s3_setup_empty.png')
    print('still disabled before serve:', pg.is_disabled('#startBtn'))
    tap(pg,'#pickServe [data-serve="a"]',300); pg.screenshot(path=f'{SP}/s4_setup_full.png', full_page=True)
    tap(pg,'#startBtn',600); print('view play, clock', pg.inner_text('#clock'), 'call', pg.inner_text('#call'))
    t=toks(pg); print('pos', {k:(v['x'],v['y'],'S' if ' srv' in v['c'] else 'R' if ' rec' in v['c'] else '') for k,v in t.items()})
    pg.wait_for_timeout(1500); c1=pg.inner_text('#clock')
    tap(pg,'#playCourt .zone.lt'); t=toks(pg); print('A wins:', {k:(v['x'],v['y'],'S' if ' srv' in v['c'] else 'R' if ' rec' in v['c'] else '') for k,v in t.items()}, pg.inner_text('#call'))
    tap(pg,'#playCourt .zone.rt'); t=toks(pg); print('B wins:', {k:(v['x'],v['y'],'S' if ' srv' in v['c'] else 'R' if ' rec' in v['c'] else '') for k,v in t.items()}, pg.inner_text('#call'))
    pg.screenshot(path=f'{SP}/s5_play.png')
    # back to setup: clock must pause
    tap(pg,'#back',500); c_a=pg.evaluate("JSON.parse(localStorage.getItem('gcl-ref-T1')).pairs[0].timer"); print('back to setup, timer paused:', c_a['since'] is None, 'title', pg.inner_text('#title'))
    tap(pg,'#startBtn',500); print('resume -> play, running:', 'run' in pg.get_attribute('#clock','class'))
    # manual end then resume
    tap(pg,'#endBtn',300); print('tie end blocked:', pg.inner_text('#sheetTitle')); tap(pg,'#sheetAct .big.pri',300)
    tap(pg,'#playCourt .zone.lt'); tap(pg,'#endBtn',300); pg.screenshot(path=f'{SP}/s6_endsheet.png'); tap(pg,'#sheetAct .big.pri',1800)
    print('end screen:', pg.inner_text('#result').replace('\n',' '), '|', pg.inner_text('#submit').replace('\n',' '))
    pg.screenshot(path=f'{SP}/s7_end.png')
    tap(pg,'#resumeBtn',500); print('resumed: running', 'run' in pg.get_attribute('#clock','class'), 'manualEnd', pg.evaluate("JSON.parse(localStorage.getItem('gcl-ref-T1')).pairs[0].manualEnd"))
    while '/ket' not in pg.evaluate('location.hash'): (pg.click('#sheetAct .big.pri') if pg.is_visible('#sheet') else pg.click('#playCourt .zone.lt')); pg.wait_for_timeout(360)
    pg.wait_for_timeout(2500)
    print('auto end at 31:', pg.inner_text('#title'), '|', pg.inner_text('#submit').replace('\n',' '))
    print('official sheet pair1:', official['1']['state']['log'][-1], len(official['1']['state']['log']))
    tap(pg,'#nextBtn',500); print('next ->', pg.inner_text('#title'))
    # demo mode
    pg.goto('http://127.0.0.1:8792/trong-tai.html#'); pg.wait_for_timeout(500); print('list live:', pg.inner_text('#mlist').replace(chr(10),' | ')); pg.goto('http://127.0.0.1:8792/trong-tai.html#T3'); pg.wait_for_timeout(400); print('T3 link in live ->', pg.inner_text('#title')); tap(pg,'#modePick [data-mode="demo"]',300)
    pg.screenshot(path=f'{SP}/s8_demo.png')
    tap(pg,'#mlist .row >> nth=1'); tap(pg,'#plist .row >> nth=0')
    for s in ['#teamFoot .tchip.s-l','#pickServe [data-serve="b"]']: tap(pg,s,150)
    tap(pg,'#startBtn',400); n0=len(official)
    while '/ket' not in pg.evaluate('location.hash'): (pg.click('#sheetAct .big.pri') if pg.is_visible('#sheet') else pg.click('#playCourt .zone.rt')); pg.wait_for_timeout(360)
    pg.wait_for_timeout(2000)
    print('demo end:', pg.inner_text('#submit').replace('\n',' '), '| drafts', len(drafts), drafts[-1]['draft'] if drafts else None, drafts[-1]['report'] if drafts else None, '| official rows unchanged', len(official)==n0)
    print('errors', errs)
    b.close()
srv.shutdown()
