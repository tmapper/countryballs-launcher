const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// >>> SADECE BU SATIRI DEGISTIR: Render'daki oyun adresin <<<
const GAME_URL = 'https://countryballs-fallout-a96q.onrender.com';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#0c0e14',
    title: 'Countryballs: Fallout Suspects'
  });
  win.maximize();

  // Once "baglaniyor" ekrani, sonra oyun
  win.loadFile(path.join(__dirname, 'loading.html'));
  const tryLoad = () => win.loadURL(GAME_URL);
  setTimeout(tryLoad, 500);

  // Sunucu uyuyorsa ya da internet yoksa 5 sn sonra tekrar dene
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && url === GAME_URL) {
      win.loadFile(path.join(__dirname, 'loading.html'));
      setTimeout(tryLoad, 5000);
    }
  });

  // Dis linkleri tarayicida ac
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
