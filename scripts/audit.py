from playwright.sync_api import sync_playwright

JS_FONTS = "({inter: document.fonts.check('14px Inter'), mono: document.fonts.check('12px IBM Plex Mono')})"
JS_CLIP = """(() => {
  const w = window.innerWidth;
  return Array.from(document.querySelectorAll('body *')).filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > w + 1 || r.left < -1);
  }).map((e) => e.className).slice(0, 8);
})()"""
JS_SECTIONS = "Array.from(document.querySelectorAll('section')).map(s => s.className)"

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    pg.goto("http://127.0.0.1:8787/", wait_until="networkidle")
    pg.wait_for_timeout(1200)
    print("fonts:", pg.evaluate(JS_FONTS))
    print("sections:", pg.evaluate(JS_SECTIONS))
    print("clipped:", pg.evaluate(JS_CLIP))
    print("matrix cells:", pg.locator(".matrix-cell").count())
    print("diff lines:", pg.locator(".diff-line").count())
    print("tools:", pg.locator(".patch-meta .meta-val").nth(4).inner_text())
    print("title:", pg.locator(".patch-title").inner_text().replace("\n", " | "))
    print("footer:", pg.locator(".foot").inner_text().replace("\n", " | "))
    print("task scores:", [t.replace("\n", " ") for t in pg.locator(".task-score").all_inner_texts()])
    b.close()
