"""Optional real Firefox + Violentmonkey regression. Separate temporary browser profile.

No real API key or live inference: tests actual GM missing-key handling, then mocks only
GM_getValue/GM_xmlhttpRequest inside the installed userscript for answer delivery.
The real extension, sandbox, page injection, DOM bridge, UI, and Tab handler all execute.
"""
import argparse
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

parser = argparse.ArgumentParser()
parser.add_argument("--firefox", required=True, help="Firefox executable, not your existing profile")
parser.add_argument("--geckodriver", required=True)
parser.add_argument("--violentmonkey", required=True, help="Official Violentmonkey XPI")
parser.add_argument("--baseline", help="Optional previous userscript that must reproduce the stuck bridge")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        is_api = self.path.startswith("/api/today")
        body = json.dumps({"prompts": []}) if is_api else (
            '<!doctype html><html><body><div class="ds-card"><div class="rnd">CATEGORY 1</div>'
            '<div class="prompt">Name an English word containing &quot;atter&quot;</div></div>'
            '<input class="ds-input" aria-label="Your answer" maxlength="60"></body></html>'
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json" if is_api else "text/html")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *_):
        pass


def mock_ai(code):
    marker = "(() => {\n  'use strict';"
    assert marker in code
    preamble = """((realGet) => {
  'use strict';
  const GM_getValue = (key, fallback) => key === 'openrouterKey' ? 'test-only-not-a-real-key' : realGet(key, fallback);
  const GM_xmlhttpRequest = details => {
    const body = JSON.parse(details.data);
    if (!body.model.endsWith(':free') || Object.values(body.provider.max_price).some(value => value !== 0)) throw new Error('Non-free routing');
    document.documentElement.setAttribute('data-test-ai-request', 'mocked-free-only');
    setTimeout(() => details.onload({status:200,response:{choices:[{message:{content:JSON.stringify({answers:['attercop','clatterfart','natterjack']})}}]}}), 10);
    return {abort(){}};
  };"""
    code = code.replace(marker, preamble, 1)
    before, after = code.rsplit("})();", 1)
    assert not after.strip()
    return before + "})(GM_getValue);\n"


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}"
options = Options()
options.binary_location = str(Path(args.firefox).resolve())
options.add_argument("-headless")
service = Service(executable_path=str(Path(args.geckodriver).resolve()), service_args=["--allow-system-access"])
driver = None
try:
    driver = webdriver.Firefox(options=options, service=service)
    driver.set_page_load_timeout(15)
    driver.set_script_timeout(15)
    addon = driver.install_addon(str(Path(args.violentmonkey).resolve()), temporary=True)
    driver.set_context("chrome")
    uuids = json.loads(driver.execute_script("return Services.prefs.getStringPref('extensions.webextensions.uuids');"))
    driver.set_context("content")
    extension = "moz-extension://" + uuids[addon]
    print(f"Real Firefox {driver.capabilities['browserVersion']} + Violentmonkey, separate test profile", flush=True)

    def install(code):
        # Violentmonkey's match syntax includes the fixture's explicit nondefault port.
        code = re.sub(r"// @match\s+https://(?:www\.)?krillion\.io/\*", f"// @match        {base}/*", code)
        driver.get(extension + "/options/index.html")
        result = driver.execute_async_script(
            "const code=arguments[0],done=arguments[arguments.length-1];"
            "browser.runtime.sendMessage({cmd:'ParseScript',data:{code,config:{enabled:1}}})"
            ".then(done,e=>done({error:String(e)}));", code,
        )
        assert not result.get("error") and not result.get("errors"), "Userscript installation failed"
        driver.get(base + "/party/KRLP")
        WebDriverWait(driver, 10).until(lambda d: d.execute_script(
            "return !!document.querySelector('#krillion-io-tab-helper')?.shadowRoot.querySelector('.ai');"))

    def ui():
        return driver.execute_script(
            "const r=document.querySelector('#krillion-io-tab-helper').shadowRoot;"
            "return {status:r.querySelector('.ai-status').textContent,pending:r.querySelector('.ai').disabled,"
            "candidates:[...r.querySelectorAll('.candidate')].map(n=>n.textContent)};"
        )

    if args.baseline:
        baseline = Path(args.baseline).read_text()
        # Record only message metadata (never message content or credentials).
        baseline = baseline.replace("window.addEventListener('message', event => {", """window.addEventListener('message', event => {
  try { if (event.data?.from === 'page') document.documentElement.setAttribute('data-test-old-source', JSON.stringify({sameWindow:event.source === window,sourceNull:event.source === null,origin:event.origin})); } catch {}""", 1)
        install(baseline)
        driver.execute_script("document.querySelector('#krillion-io-tab-helper').shadowRoot.querySelector('.ai').click();")
        time.sleep(0.5)
        state = ui()
        print("BASELINE", json.dumps(state), flush=True)
        print("BASELINE WINDOW METADATA", driver.execute_script("return document.documentElement.getAttribute('data-test-old-source');"), flush=True)
        assert state["pending"] and "Connecting" in state["status"], "Baseline did not reproduce missing acknowledgement"

    production = (root / "dist/krillion-io-helper.user.js").read_text()
    install(production)
    driver.execute_script("document.querySelector('#krillion-io-tab-helper').shadowRoot.querySelector('.ai').click();")
    WebDriverWait(driver, 5).until(lambda _: "Set OpenRouter key" in ui()["status"])
    assert not ui()["pending"]
    print("PASS actual GM missing-key request/response; no stuck bridge", flush=True)

    install(mock_ai(production))
    WebDriverWait(driver, 5).until(lambda _: len(ui()["candidates"]) == 3)
    state = ui()
    assert not state["pending"] and all("AI guess ?" in row for row in state["candidates"])
    assert driver.execute_script("return document.documentElement.getAttribute('data-test-ai-request');") == "mocked-free-only"
    field = driver.find_element("css selector", 'input[aria-label="Your answer"]')
    field.click()
    field.send_keys(Keys.TAB)
    assert field.get_attribute("value") == "attercop"
    print("PASS actual Firefox/Violentmonkey: unknown screenshot prompt → mocked free response → 3 unverified candidates → Tab fills attercop", flush=True)
finally:
    if driver:
        driver.quit()
    server.shutdown()
