const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// --- 1. FONCTION DE CRÉATION DE LA FENÊTRE ---
function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            // Désactive le preload si tu ne l'utilises pas pour éviter les erreurs
            // preload: path.join(__dirname, 'preload.js'), 
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Décommente ça pour debugger plus vite
}

// --- 2. GESTION DU PONT (IPC) ---
// On enregistre le handler dès le début
ipcMain.handle('open-kit-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Sélectionne ton kit JSON',
        properties: ['openFile'],
        filters: [{ name: 'JSON Audio Kit', extensions: ['json'] }]
    });

    if (canceled || filePaths.length === 0) {
        return null;
    }
    
    return filePaths[0]; // Renvoie le chemin complet bien propre
});

// --- 3. CYCLE DE VIE DE L'APP ---
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});