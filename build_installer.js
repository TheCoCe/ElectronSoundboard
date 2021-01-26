const MSICreator = require('electron-wix-msi');
const path = require('path');

const APP_DIR = path.resolve(__dirname, 'builds/soundboard-win32-x64');
const OUT_DIR = path.resolve(__dirname, 'builds/windows_installer');

// Step 1: Instantiate the MSICreator
const msiCreator = new MSICreator.MSICreator({
	appDirectory: APP_DIR,
	outputDirectory: OUT_DIR,

	description: 'A simple, little, electron-based soundboard to play sounds via click or hotkey',
	exe: 'Soundboard',
	name: 'Soundboard',
	manufacturer: 'TheCoce',
	version: '0.2.0',
	appIconPath: 'src/icons/soundboard.ico',

	ui: {
		chooseDirectory: true,
	},
});

// Step 2: Create a .wxs template file
msiCreator.create().then(function () {
	// Step 3: Compile the template to a .msi file
	msiCreator.compile();
});
