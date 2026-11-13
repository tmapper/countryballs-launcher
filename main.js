const { app, BrowserWindow, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

// server.json adresi (GitHub raw + jsDelivr yedek)
const CONFIG_URLS = [
  'https://raw.githubusercontent.com/tmapper/countryballs-config/main/server.json',
  'https://cdn.jsdelivr.net/gh/tmapper/countryballs-config@main/server.json'
];
const DEFAULT_SERVERS = ['https://countryballs-fallout-cv96.onrender.com'];

let win = null;
let starting = false;

const cacheFile = () => path.join(app.getPath('userData'), 'servers.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (l) => (Array.isArray(l) ? l : [l])
  .map((s) => String(s || '').trim().replace(/\/+$/, '')).filter(Boolean);

async function fetchTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await net.fetch(url, { signal: ctl.signal, cache: 'no-store' }); }
  finally { clearTimeout(t); }
}

async function getList(forceRemote) {
  for (const u of CONFIG_URLS) {
    if (u.includes('KULLANICIADI')) continue;
    try {
      const res = await fetchTimeout(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), 8000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const list = clean(j.servers || j.server);
      if (list.length) {
        try { fs.writeFileSync(cacheFile(), JSON.stringify(list)); } catch (e) {}
        return list;
      }
    } catch (e) { /* siradaki */ }
  }
  if (!forceRemote) {
    try {
      const c = clean(JSON.parse(fs.readFileSync(cacheFile(), 'utf8')));
      if (c.length) return c;
    } catch (e) {}
  }
  return clean(DEFAULT_SERVERS);
}

async function alive(url) {
  try {
    const res = await fetchTimeout(url + '/?t=' + Date.now(), 70000);
    return res && res.status >= 200 && res.status < 500;
  } catch (e) { return false; }
}

async function start() {
  if (starting) return;
  starting = true;
  let attempts = 0;
  try {
    while (win && !win.isDestroyed()) {
      attempts++;
      const list = await getList(attempts > 1 && attempts % 3 === 0);
      for (const s of list) {
        if (!win || win.isDestroyed()) return;
        if (await alive(s)) {
          starting = false;
          if (win && !win.isDestroyed()) await win.loadURL(s).catch(() => {});
          return;
        }
      }
      try { fs.unlinkSync(cacheFile()); } catch (e) {}
      await sleep(4000);
    }
  } finally { starting = false; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#0c0e14',
    title: 'Countryballs: Fallout Suspects'
  });
  win.maximize();

  win.loadFile(path.join(__dirname, 'loading.html'));
  setTimeout(start, 500);

  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'loading.html'));
    setTimeout(start, 3000);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
