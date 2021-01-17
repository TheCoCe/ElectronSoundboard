import * as Shortcuts from './shortcuts.js';

const { BrowserWindow } = require('electron').remote;
const { ipcRenderer, app, remote, dialog, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');
const directoryPath = path.join(__dirname, '/audio');
const jsonPath = path.join(__dirname, 'settings.json');
const contextMenu = new remote.Menu();

const playercardColors = ['#ffb067', '#ffed86', '#a2dce7', '#f8ccdc'];

const Layout = {
	Default: 'Default',
	List: 'List',
};
var _layout = Layout.Default;

var _allowMultipleSoundsPlaying = true;
var _autosave = true;
var currentCardId = undefined;
var _registerShortcut = false;

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
	try {
		var obj = JSON.parse(fs.readFileSync(jsonPath));
		loadSettings(obj);
		loadSounds(obj);

		// set up context menu
		createContextMenu();

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
	} catch (error) {
		console.log(error);
	}
}

function loadSettings(obj) {
	if (obj.hasOwnProperty('settings')) {
		if (obj.settings.layout != undefined) {
			setLayout(obj.settings.layout);
		}
		if (obj.settings.allowMultipleSoundsPlaying != undefined) {
			setMultipleSoundsPlaying(obj.settings.allowMultipleSoundsPlaying);
		}
		if (obj.settings.autosave != undefined) {
			setAutosave(obj.settings.autosave);
		}
	} else {
		console.warn("Couldn't load settings from JSON: missing 'settings' property");
	}
}

function loadSounds(obj) {
	if (obj.hasOwnProperty('files')) {
		for (var i = 0; i < obj.files.length; i++) {
			let unicardID = ID();
			let cardname = obj.files[i].name;
			let path = obj.files[i].path;
			let volume = obj.files[i].volume;
			let shortcut = obj.files[i].shortcut;

			createcard(unicardID, cardname, path, volume);
			if (shortcut && shortcut.length > 0) {
				addAudioShortcut(unicardID, shortcut);
			}

			console.log(obj.files[i].name);
		}
	}
}

function writeAudioJSON() {
	try {
		var files = document.getElementsByClassName('playercard');

		var new_json = {
			settings: {
				layout: _layout,
				allowMultipleSoundsPlaying: _allowMultipleSoundsPlaying,
				autosave: _autosave,
			},
			files: [],
		};

		for (var i = 0; i < files.length; i++) {
			var name = files[i].getElementsByClassName('playercardnametext')[0].innerHTML;
			var volume = files[i].getElementsByClassName('volumeslider')[0].value;
			var id = files[i].id;
			var audio = document.getElementById(id + 'audiosource');
			var path = audio.getAttribute('src');
			var shortcut = files[i].hasAttribute('shortcut')
				? files[i].getAttribute('shortcut')
				: '';

			let curFile = {
				name: name,
				path: path,
				volume: volume / 100.0,
				shortcut: shortcut,
			};

			new_json.files.push(curFile);
		}

		const data = JSON.stringify(new_json);

		fs.writeFile(jsonPath, data, 'utf8', (err) => {
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

function removeCard(CardIDRC) {
	var audioSourceElement = document.getElementById(CardIDRC + 'audiosource');
	var audioFilePath = audioSourceElement.getAttribute('src');
	var fileName = path.basename(audioFilePath.toString());
	var fullPath = directoryPath + '/' + fileName;
	var cardElement = document.getElementById(CardIDRC);

	let removeCardConfirmData = {
		data: 1,
	};

	// ipcRenderer.send('backendrequest-DeleteConfirm', removeCardConfirmData);

	// ipcRenderer.on('frontendrequest-DeleteConfirmed', (event, arg) => {
	// 	if (arg.rdata == 1) {
	// 		cardElement.style.display = 'none';

	// 		// fs.unlink(fullPath, (err) => {
	// 		// 	if (err) {
	// 		// 		return console.log(err);
	// 		// 	}
	// 		// });
	// 	}
	// });

	cardElement.remove();

	if (_autosave) {
		writeAudioJSON();
	}
}

function createcard(cardID, filename, audiopath, volume = 1.0) {
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
		playercardColors[Math.floor(Math.random() * playercardColors.length)];

	playercard.onmouseenter = function () {
		if (!_registerShortcut) {
			currentCardId = playercard.getAttribute('id');
			console.log('entered: ' + currentCardId);
			if (contextMenu != undefined) {
				contextMenu.getMenuItemById('setShortcut').enabled = true;
				contextMenu.getMenuItemById('removeShortcut').enabled = true;
			}
		}
	};

	playercard.onmouseleave = function () {
		if (!_registerShortcut) {
			console.log('left');
			currentCardId = undefined;
			if (contextMenu != undefined) {
				contextMenu.getMenuItemById('setShortcut').enabled = false;
				contextMenu.getMenuItemById('removeShortcut').enabled = false;
			}
		}
	};

	// audioname
	playercard.append(playercardname);
	playercardname.setAttribute('class', 'playercardname');
	playercardname.append(playercardnametext);
	playercardnametext.innerHTML = filename;
	playercardnametext.setAttribute('class', 'playercardnametext');

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
		console.log('Remove card clicked: ${cardID}');
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
	//TODO: timereseticon.setAttribute('onclick', )

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
	source.setAttribute('type', 'audio/mpeg');
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
			writeAudioJSON();
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
			var playercard = document.getElementById(currentCardId);
			if (playercard) playercard.style.border = '';
		} else if (!Shortcuts.isModifier(event.code) && Shortcuts.isValidShortcutKey(event.code)) {
			addAudioShortcut(currentCardId, Shortcuts.createShortcut(event));
			_registerShortcut = false;
		}
	} else if (event.code == 'KeyS' && event.ctrlKey) {
		writeAudioJSON();
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

	if (_autosave) writeAudioJSON();
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

	if (_autosave) writeAudioJSON();
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
				writeAudioJSON();
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
				var playercard = document.getElementById(currentCardId);
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
				if (currentCardId) removeAudioShortcut(currentCardId);
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
	for (const f of files) {
		var unicardID = ID();
		var cardname = f.name;
		cardname = cardname.replace('.mp3', '');
		createcard(unicardID, cardname, f.path);
		if (_autosave) writeAudioJSON();
	}
}

function addFilesFromPaths(filePaths) {
	filePaths.forEach((path) => {
		var unicardID = ID();
		var cardname = path.replace(/^.*[\\\/]/, '').split('.')[0];
		createcard(unicardID, cardname, path);
		if (_autosave) writeAudioJSON();
	});
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
