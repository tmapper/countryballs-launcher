const { app, BrowserWindow, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

// >>> BIR KERE DOLDUR: server.json dosyasinin internetteki adresi (herkese acik olmali) <<<
// Ornek: https://raw.githubusercontent.com/KULLANICIADI/REPOADI/main/server.json
const CONFIG_URLS = [
  'https://raw.githubusercontent.com/tmapper/countryballs-config/main/server.json'
];
// server.json okunamazsa ve daha once hic adres kaydedilmediyse kullanilacak yedek adres
const DEFAULT_SERVERS = ['https://countryballs-fallout-y8ud.onrender.com'];

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

async function getList() {
  for (const u of CONFIG_URLS) {
    if (u.includes('KULLANICIADI')) continue; // henuz doldurulmamis
    try {
      const res = await fetchTimeout(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), 5000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const list = clean(j.servers || j.server);
      if (list.length) {
        try { fs.writeFileSync(cacheFile(), JSON.stringify(list)); } catch (e) {}
        return list;
      }
    } catch (e) { /* siradaki adresi dene */ }
  }
  try {
    const c = clean(JSON.parse(fs.readFileSync(cacheFile(), 'utf8')));
    if (c.length) return c;
  } catch (e) {}
  return clean(DEFAULT_SERVERS);
}

// Sunucu uyuyorsa uyanmasini bekler (Render ucretsiz plan). Cevap gelirse true.
async function alive(url) {
  try { await fetchTimeout(url + '/?t=' + Date.now(), 70000); return true; }
  catch (e) { return false; }
}

async function start() {
  if (starting) return;
  starting = true;
  try {
    while (win && !win.isDestroyed()) {
      const list = await getList();
      for (const s of list) {
        if (!win || win.isDestroyed()) return;
        if (await alive(s)) {
          starting = false;
          if (win && !win.isDestroyed()) await win.loadURL(s).catch(() => {});
          return;
        }
      }
      await sleep(5000);
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

  // Oyun sayfasi acilamazsa (internet yok / sunucu degisti) bekleme ekranina don ve bastan dene
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'loading.html'));
    setTimeout(start, 5000);
  });

  // Dis linkleri tarayicida ac
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
