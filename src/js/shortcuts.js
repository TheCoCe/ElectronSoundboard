const modifiers = [
	'AltLeft',
	'AltRight',
	'ControlLeft',
	'ControlRight',
	'ShiftRight',
	'ShiftLeft',
	'Tab',
	'CapsLock',
];

const shortcutDict = {
	0: '0',
	1: '1',
	2: '2',
	3: '3',
	4: '4',
	5: '5',
	6: '6',
	7: '7',
	8: '8',
	9: '9',
	A: 'A',
	B: 'B',
	C: 'C',
	D: 'D',
	E: 'E',
	F: 'F',
	G: 'G',
	H: 'H',
	I: 'I',
	J: 'J',
	K: 'K',
	L: 'L',
	M: 'M',
	N: 'N',
	O: 'O',
	P: 'P',
	Q: 'Q',
	R: 'R',
	S: 'S',
	T: 'T',
	U: 'U',
	V: 'V',
	W: 'W',
	X: 'X',
	Y: 'Y',
	Z: 'Z',
	F1: '<em>/</em>',
	F2: '<em>0</em>',
	F3: '<em>1</em>',
	F4: '<em>2</em>',
	F5: '<em>3</em>',
	F6: '<em>4</em>',
	F7: '<em>5</em>',
	F8: '<em>6</em>',
	F9: '<em>7</em>',
	F10: '<em>8</em>',
	F11: '<em>9</em>',
	F12: '<em>:</em>',
	Plus: '+',
	Space: '<em>u</em>',
	Tab: '<em>!</em>',
	Capslock: '<em>,</em>',
	Numlock: '<em>º</em>',
	Scrolllock: '<em>w</em>',
	Backspace: '<em>V</em>',
	Delete: '<em>$</em>',
	Insert: '<em>n</em>',
	Return: '<em>W</em>',
	Up: 'Ê',
	Down: 'Ë',
	Left: 'Í',
	Right: 'Î',
	Home: '<em>s</em>',
	PageUp: '<em>o</em>',
	PageDown: '<em>p</em>',
	Esc: '<em>+</em>',
	VolumeUp: '',
	VolumeDown: '',
	VolumeMute: '',
	PrintScreen: '<em>g</em>',
	num0: ' º0 ',
	num1: ' º1 ',
	num2: ' º2 ',
	num3: ' º3 ',
	num4: ' º4 ',
	num5: ' º5 ',
	num6: ' º6 ',
	num7: ' º7 ',
	num8: ' º8 ',
	num9: ' º9 ',
	numdec: ' º, ',
	numadd: ' ºA ',
	numsub: ' º- ',
	nummult: ' º* ',
	numdiv: ' º/ ',
	'#': '#',
	AltLeft: '<em>%</em>',
	AltRight: '<em>T</em>',
	AltGr: '<em>T</em>',
	Alt: '<em>%</em>',
	ControlLeft: '<em>)</em>',
	ControlRight: '<em>)</em>',
	Control: '<em>)</em>',
	CommandOrControl: '<em>)</em>',
	ShiftRight: "<em>'</em>",
	ShiftLeft: "<em>'</em>",
	Shift: "<em>'</em>",
	Super: 'È',
};

const keyCodeToShortcut = {
	Digit0: '0',
	Digit1: '1',
	Digit2: '2',
	Digit3: '3',
	Digit4: '4',
	Digit5: '5',
	Digit6: '6',
	Digit7: '7',
	Digit8: '8',
	Digit9: '9',
	KeyA: 'A',
	KeyB: 'B',
	KeyC: 'C',
	KeyD: 'D',
	KeyE: 'E',
	KeyF: 'F',
	KeyG: 'G',
	KeyH: 'H',
	KeyI: 'I',
	KeyJ: 'J',
	KeyK: 'K',
	KeyL: 'L',
	KeyM: 'M',
	KeyN: 'N',
	KeyO: 'O',
	KeyP: 'P',
	KeyQ: 'Q',
	KeyR: 'R',
	KeyS: 'S',
	KeyT: 'T',
	KeyU: 'U',
	KeyV: 'V',
	KeyW: 'W',
	KeyX: 'X',
	KeyY: 'Y',
	KeyZ: 'Z',
	F1: 'F1',
	F2: 'F2',
	F3: 'F3',
	F4: 'F4',
	F5: 'F5',
	F6: 'F6',
	F7: 'F7',
	F8: 'F8',
	F9: 'F9',
	F10: 'F10',
	F11: 'F11',
	F12: 'F12',
	BracketRight: 'Plus',
	//'Minus': '', //ß
	//'Equal': '', //´
	Space: 'Space',
	Tab: 'Tab',
	CapsLock: 'Capslock',
	NumLock: 'Numlock',
	ScrollLock: 'Scrolllock',
	Backspace: 'Backspace',
	Delete: 'Delete',
	Insert: 'Insert',
	Enter: 'Return',
	ArrowUp: 'Up',
	ArrowDown: 'Down',
	ArrowLeft: 'Left',
	ArrowRight: 'Right',
	Home: 'Home',
	PageUp: 'PageUp',
	PageDown: 'PageDown',
	Escape: 'Esc',
	AudioVolumeUp: 'VolumeUp',
	AudioVolumeDown: 'VolumeDown',
	AudioVolumeMute: 'VolumeMute',
	PrintScreen: 'PrintScreen',
	Numpad0: 'num0',
	Numpad1: 'num1',
	Numpad2: 'num2',
	Numpad3: 'num3',
	Numpad4: 'num4',
	Numpad5: 'num5',
	Numpad6: 'num6',
	Numpad7: 'num7',
	Numpad8: 'num8',
	Numpad9: 'num9',
	NumpadDecimal: 'numdec',
	NumpadAdd: 'numadd',
	NumpadSubtract: 'numsub',
	NumpadMultiply: 'nummult',
	NumpadDivide: 'numdiv',
	Backslash: '#',
	//: '!',
	//: '~',
	//: '$',
	//: '@',
	//: '?',
};

export function formatShortcut(string) {
	var strings = string.split('+');
	var newString = '';

	for (var i = 0; i < strings.length; i++) {
		newString += shortcutDict[strings[i]] ?? strings[i];
		// console.log('Request: ' + strings[i] + ' Got: ' + shortcutDict[strings[i]] ?? strings[i]);
	}

	return newString;
}

export function getShortcutFromKeyCode(keyCode) {
	return keyCodeToShortcut[keyCode];
}

export function isValidShortcutKey(keyCode) {
	return keyCodeToShortcut[keyCode] != undefined;
}

export function isModifier(keyCode) {
	return modifiers.includes(keyCode);
}

export function createShortcut(event) {
	var shortcut = '';

	if (event.getModifierState('Alt')) {
		shortcut += 'Alt+';
	}
	if (event.getModifierState('Control')) {
		shortcut += 'CommandOrControl+';
	}
	if (event.getModifierState('AltGraph')) {
		shortcut += 'AltGr+';
	}
	if (event.getModifierState('Shift')) {
		shortcut += 'Shift+';
	}
	if (event.getModifierState('OS')) {
		shortcut += 'Super+';
	}

	shortcut += getShortcutFromKeyCode(event.code);

	return shortcut;
}
