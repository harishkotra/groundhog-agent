"""Screenshot the running app and report console errors. Local verification only."""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/groundhog-full.png"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.screenshot(path=OUT, full_page=True)
    print("height:", page.evaluate("document.body.scrollHeight"))
    print("title:", page.title())
    print("text sample:", page.inner_text(".verdict-card")[:300].replace("\n", " | "))
    print("console:", errors[:10] or "clean")
    browser.close()
print("saved", OUT)
