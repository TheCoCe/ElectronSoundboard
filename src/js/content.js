import * as Shortcuts from './shortcuts.js';

const { BrowserWindow } = require('electron').remote;
const { ipcRenderer, app, remote } = require('electron');
const fs = require('fs');
const path = require('path');
const jsonPath = path.join(__dirname, 'settings.json');
const contextMenu = new remote.Menu();
const prompt = require('electron-prompt');
const colorpicker = require('@jaames/iro');

const playercardColors = ['#ffb067', '#ffed86', '#a2dce7', '#f8ccdc'];

const Layout = {
	Default: 'Default',
	List: 'List',
};
var _layout = Layout.Default;

var _allowMultipleSoundsPlaying = true;
var _autosave = true;
var _currentCardId = undefined;
var _registerShortcut = false;
var cp;
const colorPickerSize = {
	width: 200,
	widthWithPadding: 220,
};
let _colorPickerTarget = undefined;
var mousePos = {
	x: 0,
	y: 0,
};

var data = {};

var ID = function () {
	return '_' + Math.random().toString(36).substr(2, 9);
};

// init and loading
document.onreadystatechange = () => {
	if (document.readyState == 'complete') {
		init();
	}
};

function init() {
	fs.stat(jsonPath, (err, stat) => {
		if (err == null) {
			let settings = JSON.parse(fs.readFileSync(jsonPath));
			loadSettings(settings);
			loadSounds(settings);
		} else if (err.code == 'ENOENT') {
			console.info('Failed to load Settings.json. Creating new Settings.json');
			writeSettingsJSON();
			loadSettings();
		} else {
			console.log(err.message);
		}
	});

	// set up context menu
	createContextMenu();
	createColorPicker();

	// set up events
	document.addEventListener('drop', (event) => {
		event.preventDefault();
		event.stopPropagation();

		addFiles(event.dataTransfer.files);
	});

	document.addEventListener('dragover', (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	document.getElementById('layout-btn').addEventListener('click', switchLayout);
	document.addEventListener('keydown', handleShortcuts);
	document.getElementById('stopsoundtoggle').addEventListener('change', (event) => {
		if (event.target.checked) {
			_allowMultipleSoundsPlaying = true;
		} else {
			_allowMultipleSoundsPlaying = false;
		}
	});

	document.getElementById('autosavetoggle').addEventListener('change', (event) => {
		if (event.target.checked) {
			_autosave = true;
		} else {
			_autosave = false;
		}
	});

	document.getElementById('searchbar').addEventListener('input', (event) => {
		if (event.target.value != '') {
			search(event.target.value);
			document.body.scroll({ top: 0, left: 0, behavior: 'smooth' });
			event.target.setAttribute('open', 'true');
		} else {
			event.target.setAttribute('open', 'false');

			var playercards = document.getElementsByClassName('playercard');
			for (const playercard of playercards) {
				playercard.style.order = '';
			}
		}
	});

	document.onmousemove = function (event) {
		mousePos.x = event.pageX;
		mousePos.y = event.pageY;
	};
}

function loadSettings(obj = undefined) {
	if (obj != undefined && obj.hasOwnProperty('settings')) {
		if (obj.settings.layout != undefined) {
			_layout = obj.settings.layout;
		}
		if (obj.settings.allowMultipleSoundsPlaying != undefined) {
			_allowMultipleSoundsPlaying = obj.settings.allowMultipleSoundsPlaying;
		}
		if (obj.settings.autosave != undefined) {
			_autosave = obj.settings.autosave;
		}
	} else {
		console.warn(
			"Couldn't load settings from Settings.json: missing 'settings' property. Using default settings."
		);
	}
	setLayout(_layout);
	setMultipleSoundsPlaying(_allowMultipleSoundsPlaying);
	setAutosave(_autosave);
}

function loadSounds(obj) {
	if (obj.hasOwnProperty('files')) {
		for (var i = 0; i < obj.files.length; i++) {
			let file = obj.files[i];

			let cardID = '';
			do {
				cardID = ID();
			} while (cardID in data);
			Object.assign(file, {
				cardID: cardID,
			});

			let cardname = obj.files[i].name;
			let path = obj.files[i].path;
			let volume = obj.files[i].volume;
			let shortcut = obj.files[i].shortcut;
			let color = obj.files[i].color;

			data[cardID] = file;

			createcard(cardID, cardname, path, volume, color);
			if (shortcut && shortcut.length > 0) {
				addAudioShortcut(cardID, shortcut);
			}

			console.log(obj.files[i].name);
		}
	}
}

function writeSettingsJSON() {
	try {
		var obj = {
			settings: {
				layout: _layout,
				allowMultipleSoundsPlaying: _allowMultipleSoundsPlaying,
				autosave: _autosave,
			},
			files: [],
		};

		obj.files = serializeAudioFiles();

		const new_settings_json = JSON.stringify(obj);

		fs.writeFile(jsonPath, new_settings_json, 'utf8', (err) => {
			if (err) {
				console.log(`Error writing savefile: ${err}`);
			} else {
				console.log(`Savefile written successfully!`);
			}
		});
	} catch (error) {
		console.log(error);
	}
}

function serializeAudioFiles() {
	var files = document.getElementsByClassName('playercard');
	let audioFiles = [];

	for (var i = 0; i < files.length; i++) {
		var name = files[i].getElementsByClassName('playercardnametext')[0].innerHTML;
		var volume = files[i].getElementsByClassName('volumeslider')[0].value;
		var id = files[i].id;
		var audio = document.getElementById(id + 'audiosource');
		var path = audio.getAttribute('src');
		var shortcut = files[i].hasAttribute('shortcut') ? files[i].getAttribute('shortcut') : '';

		let curFile = {
			name: name,
			path: path,
			volume: volume / 100.0,
			shortcut: shortcut,
		};

		curFile.color = data[id]?.color;

		audioFiles.push(curFile);
	}

	return audioFiles;
}

function removeCard(cardID) {
	var cardElement = document.getElementById(cardID);
	if (cardElement) cardElement.remove();
	if (cardID in data) delete data[cardID];

	if (_autosave) {
		writeSettingsJSON();
	}
}

function search(string) {
	var searchTerm = string.toLowerCase();
	var results = [];

	var words = searchTerm.split(' ').filter((i) => i); // filter to remove empty elements

	for (const key in data) {
		const element = data[key];

		var result = {
			cardID: element.cardID,
			name: element.name,
			matches: 0,
		};
		var cardname = element.name.toLowerCase();
		var matchFound = false;

		for (let j = 0; j < words.length; j++) {
			if (cardname.includes(words[j])) {
				matchFound = true;
				let wordIndex = cardname.indexOf(words[j]);
				result.matches += wordIndex;
			} else {
				result.matches += 99;
			}
		}
		if (matchFound) results.push(result);
	}

	results.sort((a, b) => {
		return a.matches - b.matches;
	});

	var playercards = document.getElementsByClassName('playercard');
	for (const playercard of playercards) {
		playercard.style.order = '';
	}

	for (let index = 0; index < results.length; index++) {
		const element = results[index];
		let playercard = document.getElementById(element.cardID);
		if (playercard) {
			playercard.style.order = -results.length + index;
		}
	}
}

function createcard(cardID, filename, audiopath, volume = 1.0, color = undefined) {
	var parentlocation = document.getElementById('cardwidget');
	var audioID = cardID + 'audio';
	var timeID = cardID + 'time';
	var audiosourceID = cardID + 'audiosource';
	var removeCardFunction = "removeCard('" + cardID + "')";
	var playercard = document.createElement('div');
	var shortcutwrapper = document.createElement('div');
	var shortcutLable = document.createElement('p');
	var audio = document.createElement('audio');
	var source = document.createElement('source');
	var volumecontrol = document.createElement('div');
	var inputAudioSlider = document.createElement('input');
	var stop = document.createElement('div');
	var stopicon = document.createElement('i');
	var deletecard = document.createElement('div');
	var deletecardicon = document.createElement('i');
	var timeremaining = document.createElement('div');
	var time = document.createElement('p');
	var playercardname = document.createElement('div');
	var playercardnametext = document.createElement('p');

	parentlocation.append(playercard);
	playercard.setAttribute('id', cardID);
	playercard.setAttribute('class', 'playercard');
	playercard.style.backgroundColor =
		color != undefined
			? color
			: playercardColors[Math.floor(Math.random() * playercardColors.length)];

	playercard.onmouseenter = function () {
		if (!_registerShortcut) {
			_currentCardId = playercard.getAttribute('id');
			if (contextMenu != undefined) {
				enableCardContextMenus();
			}
		}
	};

	playercard.onmouseleave = function () {
		if (!_registerShortcut) {
			_currentCardId = undefined;
			if (contextMenu != undefined) {
				disableCardContextMenus();
			}
		}
	};

	// audioname
	playercard.append(playercardname);
	playercardname.setAttribute('class', 'playercardname');
	playercardname.append(playercardnametext);
	playercardnametext.innerHTML = filename;
	playercardnametext.setAttribute('class', 'playercardnametext');
	playercardnametext.setAttribute('id', cardID + 'playercardnametext');

	// shortcut
	playercard.append(shortcutwrapper);
	shortcutwrapper.setAttribute('class', 'shortcutwrapper');

	shortcutwrapper.append(shortcutLable);
	shortcutLable.setAttribute('class', 'shortcutlable');
	shortcutLable.setAttribute('id', cardID + 'shortcutLable');

	// controlswrapper
	var controlDiv = document.createElement('div');
	controlDiv.setAttribute('class', 'controlswrapper');
	playercard.append(controlDiv);

	var buttonWrapperDiv = document.createElement('div');
	controlDiv.append(buttonWrapperDiv);
	buttonWrapperDiv.setAttribute('class', 'buttonwrapper');

	// delete button
	buttonWrapperDiv.append(deletecard);
	deletecard.setAttribute('class', 'deletecard');
	deletecard.append(deletecardicon);
	deletecardicon.setAttribute('class', 'fas fa-trash');
	deletecardicon.onclick = function () {
		disableCardContextMenus();
		removeCard(cardID);
	};

	// audiocontrol wrapper
	var audiocontrolwrapper = document.createElement('div');
	audiocontrolwrapper.setAttribute('class', 'audiocontrolwrapper');
	controlDiv.append(audiocontrolwrapper);

	// playbutton
	var play = document.createElement('div');
	audiocontrolwrapper.append(play);
	play.setAttribute('class', 'play');
	play.setAttribute('id', cardID + 'play');
	var playIcon = document.createElement('i');
	play.append(playIcon);
	playIcon.setAttribute('class', 'fas fa-play');

	// timereset button
	audiocontrolwrapper.append(stop);
	stop.setAttribute('class', 'stop');
	stop.setAttribute('id', cardID + stop);
	stop.append(stopicon);
	stopicon.setAttribute('class', 'fa fa-stop');

	// volume
	audiocontrolwrapper.append(volumecontrol);
	volumecontrol.setAttribute('class', 'volumecontrol');

	var volumeIconDiv = document.createElement('div');
	volumeIconDiv.setAttribute('class', 'volumeicondiv');
	volumecontrol.append(volumeIconDiv);

	var volumeIcon = document.createElement('i');
	volumeIconDiv.append(volumeIcon);
	volumeIcon.setAttribute('class', 'fa fa-volume-down');

	volumecontrol.append(inputAudioSlider);
	inputAudioSlider.setAttribute('type', 'range');
	inputAudioSlider.setAttribute('min', '0');
	inputAudioSlider.setAttribute('max', '100');
	inputAudioSlider.setAttribute('value', '100');
	inputAudioSlider.setAttribute('class', 'volumeslider');
	inputAudioSlider.setAttribute('volume', 1);
	inputAudioSlider.setAttribute('id', cardID + 'volume');

	// time remaining
	audiocontrolwrapper.append(timeremaining);
	timeremaining.setAttribute('class', 'timeremaining');
	timeremaining.append(time);
	time.setAttribute('id', timeID);

	// audio
	playercard.append(audio);
	audio.setAttribute('id', audioID);
	audio.setAttribute('class', 'audio');
	audio.setAttribute('preload', 'auto');

	audio.append(source);
	source.setAttribute('src', audiopath);
	source.setAttribute('type', 'audio/' + getAudioFileTypeFromPath(audiopath));
	source.setAttribute('id', audiosourceID);

	// Audio Stuff

	var audioelement = audio;
	var durationelement = document.getElementById(cardID + 'time');
	var volumecontrolslider = document.getElementById(cardID + 'volume');

	volumecontrolslider.value = volume * 100;
	audioelement.volume = volume;

	volumeIcon.onclick = function (e) {
		if (audioelement.volume == 0) {
			console.log('volume = 0 event');
			var volume = volumecontrolslider.getAttribute('volume');
			audioelement.volume = volume;
			volumecontrolslider.value = volume * 100;
			volumeIcon.setAttribute('class', 'fa fa-volume-down');
		} else {
			console.log('other event');
			var volume = audioelement.volume;
			volumecontrolslider.setAttribute('volume', volume);
			audioelement.volume = 0;
			volumecontrolslider.value = 0;
			volumeIcon.setAttribute('class', 'fa fa-volume-off');
		}
	};

	stop.onclick = function (e) {
		if (!audioelement.paused) {
			pauseAudio(audioelement);
		}
		audioelement.currentTime = 0;
	};

	play.onclick = function (e) {
		audioelement.paused ? playAudio(audioelement) : pauseAudio(audioelement);
	};

	playercard.onclick = function (e) {
		if (e.target == playercard) {
			audioelement.currentTime = 0;
			if (audioelement.paused) {
				playAudio(audioelement);
			} else {
				pauseAudio(audioelement);
			}
		}
	};

	playercard.ondblclick = function (e) {
		if (e.target == playercard) {
			if (!audioelement.paused) {
				audioelement.currentTime = 0;
				playAudio(audioelement);
			}
		}
	};

	audioelement.onloadedmetadata = function () {
		var curtime;
		var totaltime;

		if (Math.round(audioelement.currentTime) < 10) {
			curtime = '0:0' + Math.round(audioelement.currentTime);
		} else if (Math.round(audioelement.currentTime) > 9) {
			curtime = '0:' + Math.round(audioelement.currentTime);
		}

		if (Math.round(audioelement.duration) < 10) {
			totaltime = '0:0' + Math.round(audioelement.duration);
		} else if (Math.round(audioelement.duration) > 9) {
			totaltime = '0:' + Math.round(audioelement.duration);
		}

		durationelement.innerHTML = curtime + ' / ' + totaltime;
	};

	audioelement.ontimeupdate = function () {
		var curtime;
		var totaltime;

		if (Math.round(audioelement.currentTime) < 10) {
			curtime = '0:0' + Math.round(audioelement.currentTime);
		} else if (Math.round(audioelement.currentTime) > 9) {
			curtime = '0:' + Math.round(audioelement.currentTime);
		}

		if (Math.round(audioelement.duration) < 10) {
			totaltime = '0:0' + Math.round(audioelement.duration);
		} else if (Math.round(audioelement.duration) > 9) {
			totaltime = '0:' + Math.round(audioelement.duration);
		}

		if (!_registerShortcut) {
			if (!audioelement.paused && audioelement.currentTime < audioelement.duration) {
				playercard.style.border = 'solid 2px #32d74b';
				playIcon.setAttribute('class', 'fas fa-pause');
			} else if (audioelement.currentTime == audioelement.duration || audioelement.paused) {
				playercard.style.border = '';
				playIcon.setAttribute('class', 'fas fa-play');
			}
		}

		durationelement.innerHTML = curtime + ' / ' + totaltime;
	};

	volumecontrolslider.oninput = function () {
		audioelement.volume = this.value / 100;
		if (audioelement.volume == 0) {
			volumeIcon.setAttribute('class', 'fa fa-volume-off');
		} else {
			volumeIcon.setAttribute('class', 'fa fa-volume-down');
		}
	};

	volumecontrolslider.onmouseup = function () {
		if (_autosave) {
			writeSettingsJSON();
		}
	};
}

function switchLayout() {
	switch (_layout) {
		case Layout.Default:
			setLayout(Layout.List);
			break;
		case Layout.List:
			setLayout(Layout.Default);
			break;
		default:
			break;
	}
}

function setLayout(layout) {
	var playercardcontainer = document.getElementById('cardwidget');
	if (playercardcontainer) {
		switch (layout) {
			case Layout.Default: {
				_layout = Layout.Default;
				playercardcontainer.style.flexDirection = '';
				var layoutIcon = document.getElementById('layout-icon');
				if (layoutIcon) {
					layoutIcon.setAttribute('class', 'Fas fa-th-list');
				}
				break;
			}
			case Layout.List: {
				_layout = Layout.List;
				playercardcontainer.style.flexDirection = 'column';
				var layoutIcon = document.getElementById('layout-icon');
				if (layoutIcon) {
					layoutIcon.setAttribute('class', 'Fas fa-th');
				}
				break;
			}
			default:
				break;
		}
	}
}

function handleShortcuts(event) {
	if (_registerShortcut) {
		if (
			event.code == 'Escape' ||
			event.code == 'Pause' ||
			event.code == 'Backspace' ||
			event.code == 'Delete'
		) {
			_registerShortcut = false;
			var playercard = document.getElementById(_currentCardId);
			if (playercard) playercard.style.border = '';
		} else if (!Shortcuts.isModifier(event.code) && Shortcuts.isValidShortcutKey(event.code)) {
			addAudioShortcut(_currentCardId, Shortcuts.createShortcut(event));
			_registerShortcut = false;
		}
	} else if (event.code == 'KeyS' && event.ctrlKey) {
		writeSettingsJSON();
	} else if (event.code == 'KeyO' && event.ctrlKey) {
		openFile();
	}
}

function addAudioShortcut(cardID, accelerator) {
	var playercard = document.getElementById(cardID);
	removeAudioShortcut(cardID);

	var audio = document.getElementById(cardID + 'audio');
	if (playercard && audio) {
		playercard.setAttribute('shortcut', accelerator);

		remote.globalShortcut.register(accelerator, () => {
			audio.currentTime = 0;
			playAudio(audio);
		});
		playercard.style.border = '';
	}

	var shortcutLable = document.getElementById(cardID + 'shortcutLable');
	if (shortcutLable) {
		shortcutLable.style.visibility = 'visible';
		shortcutLable.innerHTML = Shortcuts.formatShortcut(accelerator);
	}

	if (_autosave) writeSettingsJSON();
}

function removeAudioShortcut(cardID) {
	var playercard = document.getElementById(cardID);
	if (playercard && playercard.hasAttribute('shortcut')) {
		var shortcut = playercard.getAttribute('shortcut');
		playercard.removeAttribute('shortcut');
		if (remote.globalShortcut.isRegistered(shortcut)) {
			remote.globalShortcut.unregister(shortcut);
		}
	}

	var shortcutLable = document.getElementById(cardID + 'shortcutLable');
	if (shortcutLable) {
		shortcutLable.style.visibility = 'hidden';
		shortcutLable.innerHTML = '';
	}

	if (_autosave) writeSettingsJSON();
}

function createContextMenu() {
	contextMenu.append(
		new remote.MenuItem({
			label: 'Add Files',
			accelerator: 'CommandOrControl+O',
			id: 'addFiles',
			click() {
				openFile();
			},
		})
	);

	contextMenu.append(
		new remote.MenuItem({
			label: 'Save',
			accelerator: 'CommandOrControl+S',
			id: 'save',
			click() {
				writeSettingsJSON();
			},
		})
	);

	contextMenu.append(
		new remote.MenuItem({
			label: 'Rename',
			id: 'rename',
			//accelerator: '',
			click() {
				rename(_currentCardId);
			},
		})
	);

	contextMenu.append(
		new remote.MenuItem({
			label: 'Set Card Color',
			id: 'color',
			//accelerator: '',
			click() {
				_colorPickerTarget = _currentCardId;
				showColorPicker();
			},
		})
	);

	contextMenu.append(
		new remote.MenuItem({
			label: 'Set Shortcut',
			id: 'setShortcut',
			//accelerator: '',
			click() {
				_registerShortcut = true;
				var playercard = document.getElementById(_currentCardId);
				if (playercard) {
					playercard.style.border = 'solid 2px #ffb327';
				}
			},
		})
	);

	contextMenu.append(
		new remote.MenuItem({
			label: 'Remove Shortcut',
			id: 'removeShortcut',
			//accelerator: '',
			click() {
				if (_currentCardId) removeAudioShortcut(_currentCardId);
			},
		})
	);

	contextMenu.getMenuItemById('removeShortcut').enabled = false;
	contextMenu.getMenuItemById('setShortcut').enabled = false;

	document.addEventListener('contextmenu', function (e) {
		contextMenu.popup(BrowserWindow.getFocusedWindow());
	});
}

function openFile() {
	const files = remote.dialog
		.showOpenDialog(BrowserWindow.getFocusedWindow(), {
			properties: ['openFile', 'multiSelections'],
			filters: [{ name: 'Audio files (*.mp3)', extensions: ['mp3'] }],
		})
		.then((result) => {
			addFilesFromPaths(result.filePaths);
		})
		.catch((err) => {
			console.log(err);
		});

	if (!files) return;
}

function addFiles(files) {
	let filepaths = [];

	for (const f of files) {
		filepaths.push(f.path);
	}

	addFilesFromPaths(filepaths);
}

function addFilesFromPaths(filePaths) {
	filePaths.forEach((path) => {
		if (!validFile(path)) return;

		var cardID = '';
		do {
			cardID = ID();
		} while (cardID in data);
		var cardname = path.replace(/^.*[\\\/]/, '').split('.')[0];
		cardname = cardname.replace(/-|_|\+|\* /g, ' ');

		let newFile = {
			cardID: cardID,
			name: cardname,
			path: path,
			volume: 1,
			shortcut: '',
			color: playercardColors[Math.floor(Math.random() * playercardColors.length)],
		};

		data[cardID] = newFile;

		createcard(cardID, cardname, path, newFile.volume, newFile.color);
	});

	if (_autosave) writeSettingsJSON();
}

function setMultipleSoundsPlaying(multiplePlaying) {
	_allowMultipleSoundsPlaying = multiplePlaying;
	var toggle = document.getElementById('stopsoundtoggle');
	if (toggle) {
		toggle.checked = multiplePlaying;
	}
}

function setAutosave(autosave) {
	_autosave = autosave;
	var toggle = document.getElementById('autosavetoggle');
	if (toggle) {
		toggle.checked = autosave;
	}
}

function playAudio(audio) {
	if (!_allowMultipleSoundsPlaying) {
		stopAllSounds();
	}
	audio.play();
}

function pauseAudio(audio) {
	audio.pause();
}

function stopAllSounds() {
	var audioElements = document.getElementsByClassName('audio');
	console.log('Found ' + audioElements.length + ' audioelements');

	for (let index = 0; index < audioElements.length; index++) {
		if (!audioElements[index].paused) {
			audioElements[index].currentTime = 0;
			audioElements[index].pause();
		}
	}
}

function validFile(path) {
	let allowedExtensions = /(\.mp3|\.wav|\.ogg)$/i;
	if (allowedExtensions.exec(path)) {
		return true;
	}
	return false;
}

function getAudioFileTypeFromPath(path) {
	let extension = getExtension(path);

	switch (extension) {
		case 'mp3':
			return 'mpeg';
		case 'ogg':
			return 'ogg';
		case 'wav':
			return 'wav';
		default:
			return '';
	}
}

function getExtension(path) {
	var basename = path.split(/[\\/]/).pop(), // extract file name from full path ...
		// (supports `\\` and `/` separators)
		pos = basename.lastIndexOf('.'); // get last position of `.`

	if (basename === '' || pos < 1)
		// if file name is empty or ...
		return ''; //  `.` not found (-1) or comes first (0)

	return basename.slice(pos + 1); // extract extension ignoring `.`
}

function rename(cardID) {
	prompt({
		title: 'Cardname',
		label: 'New card name:',
		value: document.getElementById(cardID + 'playercardnametext')?.innerHTML,
		type: 'input',
		height: 180,
	})
		.then((value) => {
			if (value && value.length > 0) {
				if (cardID in data) {
					data[cardID].name = value;
				}
				var playercardName = document.getElementById(cardID + 'playercardnametext');
				if (playercardName) {
					playercardName.innerHTML = value;
				}
				if (_autosave) writeSettingsJSON();
			}
		})
		.catch(console.error);
}

function createColorPicker() {
	cp = new colorpicker.ColorPicker('#colorpicker', {
		width: colorPickerSize.width,
	});

	let colorPicker = document.getElementById('colorpicker');
	if (colorPicker) colorPicker.style.visibility = 'hidden';

	let ok = document.getElementById('colorpickerok');
	if (ok) {
		ok.onclick = (event) => {
			setCardColor(_colorPickerTarget, cp.color.hexString);
			hideColorPicker();
		};
	}
	let cancle = document.getElementById('colorpickercancle');
	if (cancle) {
		cancle.onclick = (event) => {
			hideColorPicker();
		};
	}
}

function showColorPicker() {
	let colorPicker = document.getElementById('colorpicker');
	if (colorPicker) {
		if (data[_colorPickerTarget] && data[_colorPickerTarget].color) {
			cp.color.hexString = data[_colorPickerTarget].color;
		}

		colorPicker.style.visibility = 'visible';

		const width =
			window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		const height =
			window.innerHeight ||
			document.documentElement.clientHeight ||
			document.body.clientHeight;

		colorPicker.style.left =
			mousePos.x > width - colorPickerSize.widthWithPadding
				? mousePos.x - colorPickerSize.widthWithPadding
				: mousePos.x;

		colorPicker.style.top = mousePos.y > height - 320 ? mousePos.y - 320 : mousePos.y;
	}
}

function hideColorPicker() {
	let colorPicker = document.getElementById('colorpicker');
	if (colorPicker) {
		colorPicker.style.visibility = 'hidden';
	}
	_colorPickerTarget = undefined;
}

function setCardColor(cardID, color) {
	let playercard = document.getElementById(cardID);
	if (playercard) {
		playercard.style.background = color;
		data[cardID].color = color;
		if (_autosave) writeSettingsJSON();
	}
}

function enableCardContextMenus() {
	contextMenu.getMenuItemById('setShortcut').enabled = true;
	contextMenu.getMenuItemById('removeShortcut').enabled = true;
	contextMenu.getMenuItemById('rename').enabled = true;
	contextMenu.getMenuItemById('color').enabled = true;
}

function disableCardContextMenus() {
	contextMenu.getMenuItemById('setShortcut').enabled = false;
	contextMenu.getMenuItemById('removeShortcut').enabled = false;
	contextMenu.getMenuItemById('rename').enabled = false;
	contextMenu.getMenuItemById('color').enabled = false;
}
