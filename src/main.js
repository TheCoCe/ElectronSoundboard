/*import installExtension, { REDUX_DEVTOOLS } from 'electron-devtools-installer';*/
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

let mainWindow;

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 600,
		minHeight: 300,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
		},
		show: false,
		frame: false,
		icon: __dirname + '/icons/icon.png',
	});

	mainWindow.loadURL(`file://${__dirname}/index.html`);

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	mainWindow.webContents.on('did-finish-load', () => {
		mainWindow.show();
	});

	mainWindow.webContents.openDevTools();
};

app.on('ready', () => {
	createWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});
