import * as Shortcuts from './shortcuts.js';
import * as Alerts from './alerts.js';

const { BrowserWindow } = require('electron').remote;
const { ipcRenderer, app, remote, Menu, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');
const jsonPath = path.join(__dirname, 'settings.json');
const prompt = require('electron-prompt');
const colorpicker = require('@jaames/iro');

const playercardColors = ['#ffb067', '#ffed86', '#a2dce7', '#f8ccdc'];

const Layout = {
	Default: 'Default',
	List: 'List',
};
let _layout = Layout.Default;

const ViewMode = {
	GroupOverview: 'GroupOverview',
	GroupContent: 'GroupContent',
	Default: 'Default',
};
let _viewMode = ViewMode.Default;

const alerts = new Alerts.AlertsManager();

let contextMenu = undefined;
let _allowMultipleSoundsPlaying = true;
let _autosave = true;

let _currentCardId = undefined;
let _registerShortcut = false;
let _currentGroupId = undefined;
let _currentFilterGroupId = undefined;

let cp;
const colorPickerSize = {
	width: 200,
	widthWithPadding: 220,
};
let _colorPickerTarget = undefined;

let mousePos = {
	x: 0,
	y: 0,
};

let groups = {};
let data = {};

let ID = function () {
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
			try {
				let settings = JSON.parse(fs.readFileSync(jsonPath));
				loadSettings(settings);
				loadSounds(settings);
				loadGroups(settings);
			} catch (error) {
				console.info('Failed to load Settings.json. Creating new Settings.json');
				writeSettingsJSON();
				loadSettings();
			}
		} else if (err.code == 'ENOENT') {
			console.info('Failed to load Settings.json. Creating new Settings.json');
			writeSettingsJSON();
			loadSettings();
		} else {
			console.log(err.message);
		}

		// set up context menu
		buildContextMenu();
		createColorPicker();
	});

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
	document.getElementById('fav-btn').addEventListener('click', (event) => {
		if (_viewMode != ViewMode.GroupOverview && _viewMode != ViewMode.GroupContent) {
			setViewMode(ViewMode.GroupOverview);
		} else {
			setViewMode(ViewMode.Default);
		}
	});

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
			if (_viewMode == ViewMode.Default || _viewMode == ViewMode.GroupContent) {
				document
					.getElementById('cardwidget')
					?.scroll({ top: 0, left: 0, behavior: 'smooth' });
			}

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

	// Group event setup
	document.getElementById('groupreturnbtn').addEventListener('mouseup', (event) => {
		if (_viewMode == ViewMode.GroupContent) {
			setViewMode(ViewMode.GroupOverview);
		} else if (_viewMode == ViewMode.GroupOverview) {
			setViewMode(ViewMode.Default);
		}
	});

	document.onmousedown = function (event) {
		if (event.button == 2 && !_registerShortcut) {
			// console.log('cleared cardId');
			_currentCardId = undefined;
			disableCardContextMenus();
		}
	};

	setViewMode(ViewMode.Default);
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
		if (obj.settings.width != undefined && obj.settings.height != undefined) {
			remote.BrowserWindow.getFocusedWindow().setSize(
				obj.settings.width,
				obj.settings.height
			);
		}
		if (obj.settings.posX != undefined && obj.settings.posY != undefined) {
			remote.BrowserWindow.getFocusedWindow().setPosition(
				obj.settings.posX,
				obj.settings.posY
			);
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

			if (file.hasOwnProperty('path')) {
				let newFile = {
					id: null,
					name: null,
					path: file.path,
					volume: 1,
					shortcut: '',
					color: null,
				};

				if (file.hasOwnProperty('id')) {
					newFile.id = file.id;
				}
				while (newFile.id == null || newFile.id in data) {
					cardId = ID();
				}

				newFile.name = file.hasOwnProperty('name') ? file.name : getNameFromPath(file.path);
				if (file.hasOwnProperty('volume')) newFile.volume = file.volume;
				if (file.hasOwnProperty('color')) newFile.color = file.color;
				if (file.hasOwnProperty('shortcut')) newFile.shortcut = file.shortcut;

				data[newFile.id] = newFile;
				createcard(newFile.id, newFile.name, newFile.path, newFile.volume, newFile.color);
				if (newFile.shortcut.length > 0) addAudioShortcut(newFile.id, newFile.shortcut);

				console.log(newFile.name);
			}
		}
	}
}

function loadGroups(obj) {
	if (obj.hasOwnProperty('groups')) {
		let groupsObj = obj.groups;

		for (const key in groupsObj) {
			if (Object.hasOwnProperty.call(groupsObj, key)) {
				const group = groupsObj[key];
				// a single group object = {"_sajz2bfgb":{"name":"test","files":[{"cardId":"_ff422g3gu"},{"cardID":"_ff422g3gu"}]}

				if (group.hasOwnProperty('files') && group.files.length > 0) {
					let newGroup = {
						name: group.hasOwnProperty('name') ? group.name : 'MISSING',
						files: [],
					};

					for (let i = 0; i < groupsObj[key].files.length; i++) {
						const file = groupsObj[key].files[i];
						if (file !== '' && file !== null) {
							newGroup.files.push(file);
						}
					}

					groups[key] = newGroup;

					createGroupCard(key, newGroup.name);

					if (group.hasOwnProperty('background')) {
						setGroupBackground(key, group.background);
					}
				}
			}
		}
	}
}

export function writeSettingsJSON(sync = false) {
	try {
		var obj = {
			settings: '',
			files: [],
			groups: [],
		};

		obj.settings = serializeSettings();
		obj.files = serializeAudioFiles();
		obj.groups = serializeGroups();

		const new_settings_json = JSON.stringify(obj);

		if (sync) {
			try {
				fs.writeFileSync(jsonPath, new_settings_json, 'utf8');
			} catch (err) {
				console.log(`Error writing savefile: ${err}`);
			}
		} else {
			fs.writeFile(jsonPath, new_settings_json, 'utf8', (err) => {
				if (err) {
					console.log(`Error writing savefile: ${err}`);
				} else {
					console.log(`Savefile written successfully!`);
				}
			});
		}
	} catch (error) {
		console.log(error);
	}
}

function serializeAudioFiles() {
	let audioFiles = [];

	for (const key in data) {
		if (Object.hasOwnProperty.call(data, key)) {
			const file = data[key];
			let curFile = {
				id: key,
				name: file.name,
				path: file.path,
				volume: file.volume,
				shortcut: file.shortcut,
				color: file.color,
			};

			audioFiles.push(curFile);
		}
	}

	return audioFiles;
}

function serializeGroups() {
	//TODO: validation: don't save empty groups without any files?
	return groups;
}

function serializeSettings() {
	let bounds = remote.getCurrentWindow().getBounds();

	let settings = {
		layout: _layout,
		allowMultipleSoundsPlaying: _allowMultipleSoundsPlaying,
		autosave: _autosave,
		width: bounds.width,
		height: bounds.height,
		posX: bounds.x,
		posY: bounds.y,
	};

	return settings;
}

function removeCard(cardId) {
	// delete file from groups
	for (const key in groups) {
		if (Object.hasOwnProperty.call(groups, key)) {
			const group = groups[key];
			let idx = group.files.indexOf(cardId);
			if (idx != -1) {
				group.files.splice(idx, 1);
				updateGroupCardDisplay(key);
			}
		}
	}

	var cardElement = document.getElementById(cardId);
	if (cardElement) cardElement.remove();

	if (cardId in data) {
		removeAudioShortcut(cardId);
		delete data[cardId];
	}

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
			id: element.id,
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
		let playercard = document.getElementById(element.id);
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

	playercard.oncontextmenu = function () {
		if (!_registerShortcut) {
			_currentCardId = cardID;
			// console.log(`Context cardID: ${cardID}`);
			enableCardContextMenus();
			setGroupContextMenusCheckedState(_currentCardId);
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
	shortcutLable.classList.add('hidden-element');
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
			// console.log('volume = 0 event');
			var volume = volumecontrolslider.getAttribute('volume');
			audioelement.volume = volume;
			volumecontrolslider.value = volume * 100;
			volumeIcon.setAttribute('class', 'fa fa-volume-down');
		} else {
			// console.log('other event');
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
				playercard.classList.add('playing');
				playIcon.setAttribute('class', 'fas fa-pause');
			} else if (audioelement.currentTime == audioelement.duration || audioelement.paused) {
				playercard.classList.remove('playing');
				playIcon.setAttribute('class', 'fas fa-play');
			}
		}

		durationelement.innerHTML = curtime + ' / ' + totaltime;
	};

	volumecontrolslider.oninput = function () {
		let volume = this.value / 100;
		audioelement.volume = volume;
		data[cardID].volume = volume;
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
				playercardcontainer.classList.remove('pwlayoutList');
				playercardcontainer.classList.add('pwlayoutDefault');

				document.getElementById('layout-icon')?.setAttribute('class', 'Fas fa-th-list');
				break;
			}
			case Layout.List: {
				_layout = Layout.List;
				playercardcontainer.classList.remove('pwlayoutDefault');
				playercardcontainer.classList.add('pwlayoutList');

				document.getElementById('layout-icon')?.setAttribute('class', 'Fas fa-th');
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
			document.getElementById(_currentCardId)?.classList.remove('shortcut-register');
			document.removeEventListener('keydown', handleShortcuts);
			alerts.clearMessage();
		} else if (!Shortcuts.isModifier(event.code) && Shortcuts.isValidShortcutKey(event.code)) {
			addAudioShortcut(_currentCardId, Shortcuts.createShortcut(event));
			_registerShortcut = false;
			document.removeEventListener('keydown', handleShortcuts);
			alerts.clearMessage();
		}
	}
}

function addAudioShortcut(cardID, accelerator) {
	let playercard = document.getElementById(cardID);
	removeAudioShortcut(cardID);

	data[cardID].shortcut = accelerator;

	let audio = document.getElementById(cardID + 'audio');
	if (playercard && audio) {
		remote.globalShortcut.register(accelerator, () => {
			if (!_registerShortcut) {
				audio.currentTime = 0;
				playAudio(audio);
			}
		});
		playercard.classList.remove('shortcut-register');
	}

	let shortcutLable = document.getElementById(cardID + 'shortcutLable');
	if (shortcutLable) {
		shortcutLable.classList.remove('hidden-element');
		shortcutLable.innerHTML = Shortcuts.formatShortcut(accelerator);
	}

	if (_autosave) writeSettingsJSON();
}

function removeAudioShortcut(cardID) {
	if (data[cardID] && data[cardID].shortcut.length > 0) {
		if (remote.globalShortcut.isRegistered(data[cardID].shortcut)) {
			remote.globalShortcut.unregister(data[cardID].shortcut);
		}
		data[cardID].shortcut = '';
	}

	document.getElementById(cardID + 'shortcutLable')?.classList.add('hidden-element');

	if (_autosave) writeSettingsJSON();
}

function buildContextMenu() {
	const menuTemplate = [
		{
			label: 'Stop all Sounds',
			accelerator: 'MediaStop',
			id: 'stopAllSounds',
			click() {
				stopAllSounds();
			},
		},
		{
			label: 'Add Files',
			accelerator: 'CommandOrControl+O',
			id: 'addFiles',
			click() {
				openFile();
			},
		},
		{
			label: 'Save',
			accelerator: 'CommandOrControl+S',
			id: 'save',
			click() {
				writeSettingsJSON();
			},
		},
		{
			label: 'Rename',
			id: 'rename',
			accelerator: 'F2',
			click() {
				if (_currentCardId) rename(_currentCardId);
				else if (_currentGroupId) renameGroup(_currentGroupId);
			},
		},
		{
			type: 'separator',
		},
		{
			label: 'Set Color',
			id: 'color',
			//accelerator: '',
			click() {
				_colorPickerTarget = _currentCardId;
				showColorPicker();
			},
		},
		{
			label: 'Set Shortcut',
			id: 'setShortcut',
			//accelerator: '',
			click() {
				_registerShortcut = true;
				disableCardContextMenus();
				document.getElementById(_currentCardId)?.classList.add('shortcut-register');
				document.addEventListener('keydown', handleShortcuts);
				alerts.showPersistentMessage(
					Alerts.AlertType.Warning,
					"Waiting for Shortcut... <em>'Esc'</em> to cancel"
				);
			},
		},
		{
			label: 'Remove Shortcut',
			id: 'removeShortcut',
			//accelerator: '',
			click() {
				if (_currentCardId) removeAudioShortcut(_currentCardId);
			},
		},
		{
			label: 'Remove from Group',
			id: 'removeFromGroup',
			//accelerator: '',
			click() {
				if (_currentCardId) removeFileFromGroup(_currentFilterGroupId, _currentCardId);
			},
		},
		{
			type: 'separator',
		},
		{
			label: 'Create Group',
			id: 'createGroup',
			accelerator: 'CommandOrControl+G',
			click() {
				createGroup(_currentCardId);
			},
		},
		{
			label: 'Remove Group',
			id: 'removeGroup',
			//accelerator: '',
			click() {
				if (_currentGroupId) removeGroup(_currentGroupId);
			},
		},
		{
			label: 'Set Background',
			id: 'setBackground',
			//accelerator: '',
			click() {
				if (_currentGroupId) {
					openGroupBackground(_currentGroupId);
				}
			},
		},
		{
			label: 'Remove Background',
			id: 'removeBackground',
			//accelerator: '',
			click() {
				if (_currentGroupId) {
					removeGroupBackground(_currentGroupId);
				}
			},
		},
		{
			label: 'Grouplist',
			id: 'group',
			submenu: [],
		},
	];

	contextMenu = remote.Menu.buildFromTemplate(menuTemplate);
	remote.Menu.setApplicationMenu(contextMenu);

	let groupMenu = contextMenu.getMenuItemById('group');
	for (const key in groups) {
		if (Object.hasOwnProperty.call(groups, key)) {
			const group = groups[key];
			groupMenu.submenu.append(
				new remote.MenuItem({
					label: group.name,
					id: key,
					type: 'checkbox',
					click() {
						addOrRemoveFileFromGroup(key, _currentCardId);
					},
				})
			);
		}
	}

	document.addEventListener('contextmenu', function (e) {
		if (!_registerShortcut) {
			contextMenu.popup(BrowserWindow.getFocusedWindow());
		}
	});

	contextMenu.addListener('menu-will-show', (event) => {
		// console.log('menu-will-show cardID: ' + _currentCardId);
		if (_currentCardId) {
			contextMenu.getMenuItemById('group').enabled = true;
		} else {
			contextMenu.getMenuItemById('group').enabled = false;
		}
	});

	// disable all card specific options at init
	disableCardContextMenus();
	disableGroupContextMenus();
}

function openGroupBackground(groupId) {
	const files = remote.dialog
		.showOpenDialog(BrowserWindow.getFocusedWindow(), {
			properties: ['openFile'],
			filters: [{ name: 'Image files (*.png)', extensions: ['png'] }],
		})
		.then((result) => {
			if (result.filePaths.length > 0) {
				let filePath = result.filePaths[0].replace(/\\/g, '/');
				setGroupBackground(groupId, filePath);
			}
		})
		.catch((err) => {
			console.log(err);
		});

	if (!files) return;
}

function setGroupBackground(groupId, background) {
	let group = document.getElementById(groupId);
	if (group) {
		group.style.backgroundImage = 'url(' + background + ')';
		groups[groupId].background = background;
	}
	if (_autosave) writeSettingsJSON();
}

function removeGroupBackground(groupId) {
	let group = document.getElementById(groupId);
	if (group) {
		group.style.backgroundImage = '';
		groups[groupId].background = '';
	}
	if (_autosave) writeSettingsJSON();
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
		var cardname = getNameFromPath(path);

		let newFile = {
			id: cardID,
			name: cardname,
			path: path,
			volume: 1,
			shortcut: '',
			color: playercardColors[Math.floor(Math.random() * playercardColors.length)],
		};

		data[cardID] = newFile;

		createcard(cardID, cardname, path, newFile.volume, newFile.color);

		if (_viewMode == ViewMode.GroupContent && _currentFilterGroupId) {
			addFileToGroup(_currentFilterGroupId, cardID);
		}
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
	// console.log('Found ' + audioElements.length + ' audioelements');

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

function getNameFromPath(path) {
	var cardname = path.replace(/^.*[\\\/]/, '').split('.')[0];
	cardname = cardname.replace(/-|_|\+|\* /g, ' ');
	return cardname;
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
		borderWidth: 2,
		borderColor: '#fff',
	});

	document.getElementById('colorpicker')?.classList.add('hidden-element');

	let colorpickerbuttons = document.createElement('div');
	colorpickerbuttons.setAttribute('class', 'colorpickerbuttons');

	let cpDiv = document.getElementById('colorpicker');
	cpDiv.append(colorpickerbuttons);
	cpDiv.onclick = function (event) {
		event.stopPropagation();
	};

	let apply = document.createElement('p');
	colorpickerbuttons.append(apply);
	apply.setAttribute('class', 'colorpickerapply');
	apply.innerHTML = 'Apply';
	apply.onclick = (event) => {
		setCardColor(_colorPickerTarget, cp.color.hexString);
		hideColorPicker();
	};

	let cancle = document.createElement('p');
	colorpickerbuttons.append(cancle);
	cancle.setAttribute('class', 'colorpickercancle');
	cancle.innerHTML = 'Cancel';
	cancle.onclick = (event) => {
		hideColorPicker();
	};

	// Setup click outside event
	window.addEventListener('click', function (e) {
		if (colorPickerVisible() && !document.getElementById('colorpicker').contains(e.target)) {
			hideColorPicker();
		}
	});
}

function showColorPicker() {
	let colorPicker = document.getElementById('colorpicker');
	if (colorPicker) {
		if (data[_colorPickerTarget] && data[_colorPickerTarget].color) {
			cp.color.hexString = data[_colorPickerTarget].color;
		}

		colorPicker.classList.remove('hidden-element');

		let width =
			window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
		let height =
			window.innerHeight ||
			document.documentElement.clientHeight ||
			document.body.clientHeight;

		let footer = document.getElementById('footer');
		height -= footer.offsetHeight;

		const cpHeight = colorPicker.offsetHeight;
		const cpWidth = colorPicker.offsetWidth;

		colorPicker.style.left =
			mousePos.x > width - cpWidth
				? mousePos.x - (cpWidth - (width - mousePos.x))
				: mousePos.x;
		colorPicker.style.top =
			mousePos.y > height - cpHeight
				? mousePos.y - (cpHeight - (height - mousePos.y))
				: mousePos.y;
	}
}

function hideColorPicker() {
	document.getElementById('colorpicker')?.classList.add('hidden-element');
	_colorPickerTarget = undefined;
}

function colorPickerVisible() {
	return document.getElementById('colorpicker')?.style.display == 'none' ? true : false;
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
	contextMenu.getMenuItemById('group').enabled = true;
	if (_currentFilterGroupId) contextMenu.getMenuItemById('removeFromGroup').enabled = true;
}

function disableCardContextMenus() {
	contextMenu.getMenuItemById('setShortcut').enabled = false;
	contextMenu.getMenuItemById('removeShortcut').enabled = false;
	contextMenu.getMenuItemById('rename').enabled = false;
	contextMenu.getMenuItemById('color').enabled = false;
	contextMenu.getMenuItemById('group').enabled = false;
	contextMenu.getMenuItemById('removeFromGroup').enabled = false;
}

function createGroup(cardId = undefined) {
	prompt({
		title: 'Groupname',
		label: 'New group name:',
		value: 'Group name',
		type: 'input',
		height: 180,
	})
		.then((value) => {
			if (value && value.length > 0) {
				let groupId = ID();
				let group = {
					name: value,
					files: [],
				};

				groups[groupId] = group;
				let groupMenu = contextMenu.getMenuItemById('group');
				groupMenu.submenu.append(
					new remote.MenuItem({
						label: value,
						id: groupId,
						type: 'checkbox',
						click() {
							addOrRemoveFileFromGroup(groupId, _currentCardId);
						},
					})
				);

				createGroupCard(groupId, value);
				alerts.info(`Successfully created Group '${value}'`, 2000);

				if (cardId) {
					// add file to the newly created group
					groups[groupId].files.push(cardId);
					updateGroupCardDisplay(groupId);
					let cardName = data[cardId] ? data[cardId].name : 'file';
					alerts.info(
						`Added <em>'${cardName}'</em> to <em>'${groups[groupId].name}'</em>`,
						2000
					);
				}
				// if (_viewMode != ViewMode.GroupContent) setViewMode(ViewMode.GroupContent, groupId);

				if (_autosave) writeSettingsJSON();
			}
		})
		.catch(console.error);
}

function removeGroup(groupId) {
	if (groupId in groups) {
		let groupcard = document.getElementById(groupId);
		if (groupcard) groupcard.remove();
		delete groups[groupId];
		// rebuild the context menu to remove the invalid group submenus
		buildContextMenu();
		if (_autosave) writeSettingsJSON();
	}
}

function addOrRemoveFileFromGroup(groupId, cardId) {
	if (groupId in groups) {
		if (groups[groupId].files.includes(cardId)) {
			removeFileFromGroup(groupId, cardId);
		} else {
			addFileToGroup(groupId, cardId);
		}
	}
}

function addFileToGroup(groupId, cardId) {
	if (groupId in groups) {
		let files = groups[groupId].files;

		if (!files.includes(cardId)) {
			groups[groupId].files.push(cardId);
			updateGroupCardDisplay(groupId);

			let cardName = data[cardId] ? data[cardId].name : 'file';
			alerts.info(`Added <em>'${cardName}'</em> to <em>'${groups[groupId].name}'</em>`, 2000);
		} else {
			alerts.warn(
				`Group <em>'${groups[groupId].name}'</em> already includes this audio file`,
				2000
			);
		}

		if (_autosave) writeSettingsJSON();
	}
}

function removeFileFromGroup(groupId, cardId) {
	if (groupId in groups) {
		let files = groups[groupId].files;

		let index = files.indexOf(cardId);
		if (index != -1) {
			files.splice(index, 1);
			// update cards if one was removed from the group
			if (_viewMode == ViewMode.GroupContent) filterCardsByGroupId(groupId);
			updateGroupCardDisplay(groupId);
			alerts.info(`Removed audio file from '${groups[groupId].name}'`, 2000);
		}

		if (_autosave) writeSettingsJSON();
	}
}

function createGroupCard(groupId, name) {
	let groupwrapper = document.getElementById('groupwrapper');

	let groupitem = document.createElement('div');
	groupwrapper.append(groupitem);
	groupitem.setAttribute('class', 'groupitem');
	groupitem.setAttribute('id', groupId);
	groupitem.style.backgroundColor =
		playercardColors[Math.floor(Math.random() * playercardColors.length)];

	groupitem.onclick = function (event) {
		setViewMode(ViewMode.GroupContent, groupId);
	};

	groupitem.onmouseenter = function (event) {
		_currentGroupId = groupId;
		enableGroupContextMenus();
	};

	groupitem.onmouseleave = function (event) {
		_currentGroupId = undefined;
		disableGroupContextMenus();
	};

	let groupnametext = document.createElement('p');
	groupitem.append(groupnametext);
	groupnametext.setAttribute('class', 'groupnamewrappertext');
	groupnametext.setAttribute('id', groupId + 'nametext');
	groupnametext.innerHTML = name;

	let elementCount = document.createElement('p');
	groupitem.append(elementCount);
	elementCount.setAttribute('class', 'groupelementcount');
	elementCount.setAttribute('id', groupId + 'elementCount');
	elementCount.innerHTML = groups[groupId].files.length;
}

function renameGroup(groupId) {
	prompt({
		title: 'Groupname',
		label: 'New group name:',
		value: groupId in groups ? groups[groupId].name : 'Group name',
		type: 'input',
		height: 180,
	})
		.then((value) => {
			if (value && value.length > 0) {
				if (groupId in groups) {
					groups[groupId].name = value;
					updateGroupCardDisplay(groupId);
					// rebuild the context menu to update the group texts
					buildContextMenu();
				}

				if (_autosave) writeSettingsJSON();
			}
		})
		.catch(console.error);
}

function updateGroupCardDisplay(groupId) {
	let nameElement = document.getElementById(groupId + 'nametext');
	if (nameElement) nameElement.innerHTML = groups[groupId].name;
	let countElement = document.getElementById(groupId + 'elementCount');
	if (countElement) countElement.innerHTML = groups[groupId].files.length;
}

function setViewMode(viewMode, groupId = undefined) {
	let groupwrapper = document.getElementById('groupwrapper');
	let cardwrapper = document.getElementById('cardwidget');
	let groupheader = document.getElementById('groupheader');
	let groupheadername = document.getElementById('groupheadername');

	switch (viewMode) {
		case ViewMode.Default: {
			_viewMode = ViewMode.Default;
			_currentFilterGroupId = undefined;
			groupwrapper.classList.add('hidden-element');
			cardwrapper.classList.remove('hidden-element');
			groupheader.classList.add('hidden-element');

			// groupwrapper.style.display = 'none';
			// cardwrapper.style.display = 'flex';
			// groupheader.style.display = 'none';
			setCardDisplay(false);
			document.getElementById('fav-icon').setAttribute('class', 'fas fa-star');
			break;
		}
		case ViewMode.GroupOverview: {
			_viewMode = ViewMode.GroupOverview;
			_currentFilterGroupId = undefined;

			groupwrapper.classList.remove('hidden-element');
			cardwrapper.classList.add('hidden-element');
			groupheader.classList.remove('hidden-element');

			// groupwrapper.style.display = 'flex';
			// cardwrapper.style.display = 'none';
			// groupheader.style.display = 'block';
			groupheadername.innerHTML = 'Groups';
			document.getElementById('fav-icon').setAttribute('class', 'fas fa-compact-disc');
			break;
		}
		case ViewMode.GroupContent: {
			if (groupId != undefined) {
				_viewMode = ViewMode.GroupContent;
				_currentFilterGroupId = groupId;

				groupwrapper.classList.add('hidden-element');
				groupheader.classList.remove('hidden-element');
				cardwrapper.classList.remove('hidden-element');

				// groupwrapper.style.display = 'none';
				// groupheader.style.display = 'block';
				// cardwrapper.style.display = 'flex';
				groupheadername.innerHTML = groups[groupId].name;
				document.getElementById('fav-icon').setAttribute('class', 'fas fa-compact-disc');
				filterCardsByGroupId(groupId);
			}
			break;
		}
	}
}

function filterCardsByGroupId(groupId) {
	const group = groups[groupId];
	setCardDisplay(true);

	for (let i = 0; i < group.files.length; i++) {
		document.getElementById(group.files[i])?.classList.remove('hidden-element');
	}
}

function setCardDisplay(hidden = true) {
	let files = document.getElementsByClassName('playercard');
	for (let i = 0; i < files.length; i++) {
		const element = files[i];
		if (hidden) element.classList.add('hidden-element');
		else element.classList.remove('hidden-element');
		// element.style.display = display;
	}
}

function enableGroupContextMenus() {
	contextMenu.getMenuItemById('rename').enabled = true;
	contextMenu.getMenuItemById('removeGroup').enabled = true;
	contextMenu.getMenuItemById('setBackground').enabled = true;
	contextMenu.getMenuItemById('removeBackground').enabled = true;
}

function disableGroupContextMenus() {
	contextMenu.getMenuItemById('rename').enabled = false;
	contextMenu.getMenuItemById('removeGroup').enabled = false;
	contextMenu.getMenuItemById('setBackground').enabled = false;
	contextMenu.getMenuItemById('removeBackground').enabled = false;
}

function setGroupContextMenusCheckedState(cardId) {
	const curContextMenu = remote.Menu.getApplicationMenu();

	for (const key in groups) {
		if (Object.hasOwnProperty.call(groups, key)) {
			let item = curContextMenu.getMenuItemById(key);
			if (item) {
				if (groups[key].files.includes(cardId)) {
					item.checked = true;
				} else {
					item.checked = false;
				}
			}
		}
	}
}

export function getAutosaveEnabled() {
	return _autosave;
}
