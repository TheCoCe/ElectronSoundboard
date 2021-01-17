/*import installExtension, { REDUX_DEVTOOLS } from 'electron-devtools-installer';*/
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// if (require('electron-squirrel-startup')) {
// 	app.quit();
// }

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

function copyFile(selectedFilePath) {
	const fileName = path.basename(selectedFilePath.toString());

	fs.copyFile(selectedFilePath, __dirname + '/audio/' + fileName, (err) => {
		if (err) {
			console.log(err);
		}
	});
}

ipcMain.on('backendrequest-DeleteConfirm', (event, arg) => {
	function deleteFileConfirm() {
		const deleteConfirm = dialog.showMessageBoxSync(mainWindow, {
			type: 'warning',
			buttons: ['Cancel', 'OK'],
			defaultId: 0,
			message: 'Are you sure you want to remove this Card?',
			detail: 'This cannot be undone.',
		});

		if (!deleteConfirm) {
			return;
		}

		if (deleteConfirm == 1) {
			deleteFileConfirmed();
		}
	}

	if (arg.data == 1) {
		deleteFileConfirm();
	}

	function deleteFileConfirmed() {
		let removeCardConfirmedData = {
			rdata: 1,
		};

		event.sender.send('frontendrequest-DeleteConfirmed', removeCardConfirmedData);
	}
});
