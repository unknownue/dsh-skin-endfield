// Fetch rendered HTML of SPA pages via Chrome DevTools Protocol (no external deps; Node >= 22).
// Usage: node cdp-fetch.mjs <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'E:\\Workspace\\tmp\\endfield-refs\\raw\\rendered';
mkdirSync(outDir, { recursive: true });

const PAGES = [
  { name: 'news-list-en', url: 'https://endfield.gryphline.com/en-us/news' },
  { name: 'news-list-cn', url: 'https://endfield.hypergryph.com/news' },
  { name: 'special-frontier', url: 'https://endfield.gryphline.com/special/over-the-frontier' },
  { name: 'home-en', url: 'https://endfield.gryphline.com/en-us' },
];

const PORT = 9333;
const chrome = spawn('chrome', [
  `--remote-debugging-port=${PORT}`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=E:\\Workspace\\tmp\\endfield-refs\\_cdp-profile',
  '--window-size=1600,1200',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: true });
chrome.stdout.on('data', () => {});
chrome.stderr.on('data', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('devtools endpoint never came up');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const myId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(myId, { resolve, reject });
        ws.send(JSON.stringify({ id: myId, method, params, ...(sessionId ? { sessionId } : {}) }));
        setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error(`timeout ${method}`)); } }, 45000);
      });
    },
    on(fn) { listeners.push(fn); },
  };
}

const main = async () => {
  const ver = await waitForDevtools();
  console.log('devtools up:', ver.Browser);
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const c = cdp(ws);

  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });

  const requests = [];
  c.on((msg) => {
    if (msg.method === 'Network.requestWillBeSent') {
      requests.push({ url: msg.params.request.url, type: msg.params.type, method: msg.params.request.method });
    }
  });

  await c.send('Page.enable', {}, sessionId);
  await c.send('Runtime.enable', {}, sessionId);
  await c.send('Network.enable', {}, sessionId);

  const summary = [];
  for (const p of PAGES) {
    requests.length = 0;
    console.log(`\n== ${p.name} <= ${p.url}`);
    await c.send('Page.navigate', { url: p.url }, sessionId);
    await sleep(9000);
    const { result } = await c.send('Runtime.evaluate', {
      expression: `(() => ({ html: document.documentElement.outerHTML, text: document.body.innerText.slice(0,20000),
        links: [...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h&&!/^#/.test(h)),
        imgs: [...document.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(Boolean) }))()`,
      returnByValue: true, awaitPromise: false,
    }, sessionId);
    const v = result.value ?? {};
    writeFileSync(join(outDir, `${p.name}.html`), v.html ?? '', 'utf8');
    writeFileSync(join(outDir, `${p.name}.txt`), v.text ?? '', 'utf8');
    writeFileSync(join(outDir, `${p.name}.links.txt`), (v.links ?? []).join('\n'), 'utf8');
    writeFileSync(join(outDir, `${p.name}.imgs.txt`), (v.imgs ?? []).join('\n'), 'utf8');
    const xhr = requests.filter((r) => r.type === 'XHR' || r.type === 'Fetch').map((r) => `${r.method} ${r.url}`);
    writeFileSync(join(outDir, `${p.name}.xhr.txt`), xhr.join('\n'), 'utf8');
    const docs = requests.filter((r) => r.type === 'Document' || r.type === 'Script').map((r) => r.url);
    writeFileSync(join(outDir, `${p.name}.reqs.txt`), requests.map((r) => `${r.type}\t${r.method}\t${r.url}`).join('\n'), 'utf8');
    console.log(`   html=${(v.html ?? '').length}B text=${(v.text ?? '').length}B links=${(v.links ?? []).length} imgs=${(v.imgs ?? []).length} xhr=${xhr.length} reqs=${requests.length}`);
    summary.push({ name: p.name, html: (v.html ?? '').length, links: (v.links ?? []).length, imgs: (v.imgs ?? []).length, xhr });
  }

  writeFileSync(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  ws.close();
  chrome.kill();
  console.log('\n=== cdp fetch done ===');
};

main().catch((e) => { console.error('FAILED:', e.message); try { chrome.kill(); } catch {} process.exit(1); });
