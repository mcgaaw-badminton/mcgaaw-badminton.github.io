"""Pin the page clock for the referee tests: they were written for match day 04/11/2026 (T1 = today, T3 = a later day).
Time still runs (timers work); only the date the page sees is shifted. Use: b = freeze(p.chromium.launch())."""
FIX = '2026-11-04T10:00:00+07:00'
JS = ("(()=>{const R=Date,off=R.parse('%s')-R.now();function D(...a){return a.length?new R(...a):new R(R.now()+off)}"
      "D.now=()=>R.now()+off;D.parse=R.parse;D.UTC=R.UTC;D.prototype=R.prototype;window.Date=D;})()") % FIX


def freeze(browser):
    nc, np = browser.new_context, browser.new_page

    def new_context(*a, **k):
        c = nc(*a, **k); c.add_init_script(JS); return c

    def new_page(*a, **k):
        pg = np(*a, **k); pg.add_init_script(JS); return pg

    browser.new_context, browser.new_page = new_context, new_page
    return browser
