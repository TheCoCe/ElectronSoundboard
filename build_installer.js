const MSICreator = require('electron-wix-msi');
const path = require('path');

const APP_DIR = path.resolve(__dirname, './soundboard-win32-x64');
const OUT_DIR = path.resolve(__dirname, './windows_installer');

// Step 1: Instantiate the MSICreator
const msiCreator = new MSICreator.MSICreator({
	appDirectory: APP_DIR,
	outputDirectory: OUT_DIR,

	description: 'A simple, little, electron-based soundboard to play sounds via click or hotkey',
	exe: 'Soundboard',
	name: 'Soundboard',
	author: 'TheCoce',
	version: '0.2.0',

	ui: {
		chooseDirectory: true,
	},
});

// Step 2: Create a .wxs template file
msiCreator.create().then(function () {
	// Step 3: Compile the template to a .msi file
	msiCreator.compile();
});
