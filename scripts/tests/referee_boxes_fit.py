"""Browser test of the referee page (trong-tai.html) against a mocked Apps Script; run after `python scripts/build_site.py`.
Usage: python scripts/tests/referee_boxes_fit.py   (screenshots go to output/test-shots/)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, 'output', 'site')
SHOTS = os.path.join(ROOT, 'output', 'test-shots'); os.makedirs(SHOTS, exist_ok=True)
import threading, http.server, functools, json
from playwright.sync_api import sync_playwright
SP=SHOTS
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8796),functools.partial(type('H',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=SITE))
threading.Thread(target=srv.serve_forever,daemon=True).start()
CHK="""(sel)=>{const out=[];document.querySelectorAll(sel+' .tok').forEach(t=>{const i=t.querySelector('i').getBoundingClientRect(), s=t.querySelector('span').getBoundingClientRect();
 const bx=[...document.querySelectorAll(sel+' .box')].map(b=>b.getBoundingClientRect()).find(b=>i.left+i.width/2>=b.left&&i.left+i.width/2<=b.right&&i.top+i.height/2>=b.top&&i.top+i.height/2<=b.bottom);
 const inside=r=>bx&&r.left>=bx.left-0.5&&r.right<=bx.right+0.5&&r.top>=bx.top-0.5&&r.bottom<=bx.bottom+0.5;
 out.push(t.dataset.k+':'+(inside(i)&&inside(s)?'ok':'OUT'))});return out.join(' ')}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in [(360,780),(375,667),(390,844)]:
        pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=2)
        pg.route('**/macros/**',lambda r:r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"pairs":{}}'))
        pg.goto('http://127.0.0.1:8796/trong-tai.html#T1/1/vitri'); pg.wait_for_timeout(300)
        print(W,'setup blank', pg.evaluate(CHK,'#setupCourt'))
        pg.click('#teamFoot .tchip.s-l'); pg.click('#pickServe [data-serve="a"]'); pg.wait_for_timeout(500)
        print(W,'setup set  ', pg.evaluate(CHK,'#setupCourt'), '| page h', pg.evaluate('document.documentElement.scrollHeight'), '/', H)
        pg.screenshot(path=f'{SP}/q_setup_{W}.png')
        pg.click('#startBtn'); pg.wait_for_timeout(600)
        for k in range(5): pg.click('#playCourt .zone.lt'); pg.wait_for_timeout(380)
        pg.wait_for_timeout(500)
        print(W,'play       ', pg.evaluate(CHK,'#playCourt'), '| page h', pg.evaluate('document.documentElement.scrollHeight'), '/', H, '| court h setup vs play', round(pg.evaluate("document.getElementById('playCourt').getBoundingClientRect().height")))
        pg.screenshot(path=f'{SP}/q_play_{W}.png'); pg.close()
    b.close()
