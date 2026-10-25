// tailor-measure-bd \u2014 headless-Chrome smoke test via raw CDP (no deps).
// Run: node tests/smoke.js   (uses /opt/meta-chromium/chrome)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = '/opt/meta-chromium/chrome';
const DIR = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(DIR, 'index.html');

let pass = 0, fail = 0;
function check(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, label, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await fn()) return true; } catch (e) {}
    await sleep(200);
  }
  throw new Error('timeout waiting for ' + label);
}

async function main() {
  const port = 19500 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tmb-smoke-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  const errors = [];
  const httpReqs = [];
  try {
    await waitFor(async () => {
      const r = await fetch('http://127.0.0.1:' + port + '/json/version');
      return r.ok;
    }, 'chrome debug port');
    const put = await fetch('http://127.0.0.1:' + port + '/json/new?' + new URLSearchParams({ url: URL }), { method: 'PUT' });
    const created = await put.json();
    if (!created || !created.webSocketDebuggerUrl) throw new Error('no debug target (PUT status ' + put.status + ')');
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    let loadResolver = null;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails.exception));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('console.error: ' + JSON.stringify(msg.params.args));
      } else if (msg.method === 'Network.requestWillBeSent') {
        const u = msg.params.request.url || '';
        if (u.startsWith('http://') || u.startsWith('https://')) httpReqs.push(u);
      } else if (msg.method === 'Page.loadEventFired' && loadResolver) {
        const f = loadResolver; loadResolver = null; f();
      }
    };
    function send(method, params) {
      return new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP timeout ' + method)); } }, 20000);
      });
    }
    async function ev(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Page.navigate', { url: URL });
    await new Promise((res) => { loadResolver = res; setTimeout(res, 5000); });
    await sleep(800);

    // Initial state: EN title, empty list, zero stats
    check(await ev(`document.querySelector('h1').textContent === 'Tailor Measure BD'`), 'EN title');
    check(await ev(`document.getElementById('list').textContent.includes('No customers yet')`), 'empty state shown');
    check(await ev(`document.getElementById('statCustomers').textContent === '0'`), 'stat customers 0');

    // Validation: submit empty form -> error shown, no card created
    await ev(`document.getElementById('custForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
    await sleep(300);
    check(await ev(`document.getElementById('formError').textContent.length > 0`), 'error on empty submit');
    check(await ev(`document.querySelectorAll('#list .card').length === 0`), 'no card after invalid submit');

    // Add customer: Rahim, Panjabi, price 5000, advance 2000, length 42, delivery 2026-10-30
    await ev(`(function(){
      document.getElementById('fName').value='Rahim Uddin';
      document.getElementById('fPhone').value='01712345678';
      document.getElementById('fGarment').value='Panjabi';
      document.getElementById('fPrice').value='5000';
      document.getElementById('fAdvance').value='2000';
      document.getElementById('fDeliveryDate').value='2026-10-30';
      document.querySelector('[data-measure="length"]').value='42';
      document.querySelector('[data-measure="chest"]').value='40';
      return true;})()`);
    await ev(`document.getElementById('custForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`);
    await sleep(400);
    check(await ev(`document.querySelectorAll('#list .card').length === 1`), 'card created after valid submit');
    check(await ev(`document.querySelector('#list .card').textContent.includes('Rahim Uddin')`), 'card shows name');
    check(await ev(`document.querySelector('#list .card').textContent.includes('3,000.00')`), 'due 3,000.00 shown');
    check(await ev(`document.getElementById('statCustomers').textContent === '1'`), 'stat customers 1');
    check(await ev(`document.getElementById('statActive').textContent === '1'`), 'stat active 1');

    // Move to next stage: Pending -> Cutting
    await ev(`document.querySelector('#list .card [data-act="next"]').click()`);
    await sleep(300);
    check(await ev(`document.querySelector('#list .card .status').textContent === 'Cutting'`), 'status moved to Cutting');

    // Search filter: non-matching query hides card, clearing restores
    await ev(`(function(){var s=document.getElementById('searchInput'); s.value='zzz-no-match'; s.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`);
    await sleep(300);
    check(await ev(`document.querySelectorAll('#list .card').length === 0`), 'search hides non-match');
    await ev(`(function(){var s=document.getElementById('searchInput'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`);
    await sleep(300);
    check(await ev(`document.querySelectorAll('#list .card').length === 1`), 'search clear restores card');

    // BN toggle -> Bengali title + Bengali digits on due amount
    await ev(`document.getElementById('langBtn').click()`);
    await sleep(300);
    check(await ev(`document.querySelector('h1').textContent === '\u099f\u09c7\u0987\u09b2\u09b0 \u09ae\u09c7\u099c\u09be\u09b0\u09ae\u09c7\u09a8\u09cd\u099f \u09ac\u09bf\u09a1\u09bf'`), 'BN title after toggle');
    check(await ev(`document.querySelector('#list .card').textContent.includes('\u09e9,\u09e6\u09e6\u09e6.\u09e6\u09e6')`), 'BN digits due amount');

    // Reload persistence: BN lang + card persist
    loadResolver = null;
    const reloaded = new Promise((res) => { loadResolver = res; setTimeout(res, 5000); });
    await send('Page.navigate', { url: URL });
    await reloaded;
    await sleep(800);
    check(await ev(`document.querySelector('h1').textContent === '\u099f\u09c7\u0987\u09b2\u09b0 \u09ae\u09c7\u099c\u09be\u09b0\u09ae\u09c7\u09a8\u09cd\u099f \u09ac\u09bf\u09a1\u09bf'`), 'BN lang persists after reload');
    check(await ev(`document.querySelectorAll('#list .card').length === 1`), 'card persists after reload');

    // 390px mobile: no horizontal overflow
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    check(await ev(`document.documentElement.scrollWidth <= 391`), '390px no horizontal overflow');

    check(errors.length === 0, '0 console/page errors (got: ' + JSON.stringify(errors) + ')');
    check(httpReqs.length === 0, 'zero http(s) requests (got: ' + JSON.stringify(httpReqs) + ')');

    ws.close();
    console.log(pass + '/' + (pass + fail) + ' smoke checks passed');
    if (fail > 0) process.exitCode = 1;
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
}
main().catch((e) => { console.error('SMOKE HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
