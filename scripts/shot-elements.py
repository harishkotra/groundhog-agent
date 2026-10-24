"""Element-level screenshots for layout review."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    pg.goto("http://127.0.0.1:8787/", wait_until="networkidle")
    pg.wait_for_timeout(1000)

    pg.locator(".hero").screenshot(path="/tmp/el-hero.png")
    cards = pg.locator(".task-card")
    for i in range(cards.count()):
        cards.nth(i).screenshot(path=f"/tmp/el-task{i}.png")
    pg.locator(".inspector").screenshot(path="/tmp/el-inspector.png")
    pg.locator(".explain").screenshot(path="/tmp/el-explain.png")
    pg.locator(".runner").screenshot(path="/tmp/el-runner.png")
    pg.locator(".foot").screenshot(path="/tmp/el-foot.png")

    # sanity checks on the DOM, not the pixels
    print("task cards:", cards.count())
    print("bars:", pg.locator(".fp-bar").count())
    print("empty bars:", pg.locator(".fp-bar:empty").count())
    widths = pg.evaluate(
        """Array.from(document.querySelectorAll('.task-card')).map(c =>
             Array.from(c.querySelectorAll('.fp-bar')).map(b => Math.round(b.getBoundingClientRect().width)))"""
    )
    print("bar widths:", widths)
    print("overflow-x:", pg.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
    b.close()
