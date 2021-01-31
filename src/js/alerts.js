class Queue {
	constructor() {
		this.elements = [];
	}

	enqueue(element) {
		this.elements.push(element);
	}

	dequeue() {
		return this.elements.shift();
	}

	isEmpty() {
		return this.elements.length == 0;
	}

	peek() {
		return !this.isEmpty() ? this.elements[0] : undefined;
	}

	length() {
		return this.elements.length;
	}

	clear() {
		this.elements.length = 0;
	}
}

export const AlertType = {
	Warning: 'Warning',
	Info: 'Info',
	Error: 'Error',
};

export class AlertsManager {
	constructor() {
		this.queue = new Queue();

		let alertDiv = document.createElement('div');
		alertDiv.classList.add('alert');

		let alertIcon = document.createElement('span');
		alertIcon.setAttribute('class', 'fas fa-info-circle');
		alertDiv.appendChild(alertIcon);

		let alertMessage = document.createElement('span');
		alertMessage.classList.add('message');
		alertDiv.appendChild(alertMessage);

		document.body.appendChild(alertDiv);

		this.alertDiv = alertDiv;
		this.alertIcon = alertIcon;
		this.alertMessage = alertMessage;

		this.messageVisible = false;

		this.currentTimeout = undefined;

		/*
		<div class="alert">
			<span class="fas fa-exclamation-circle"></span>
			<span class="msg">Warning: This is a warning alert!</span>
			// <div class="close-btn">
			// 	<span class="fas fa-times"></span>
			// </div>
		</div>
		*/
	}

	addMessage(type, message, time = 3000) {
		let _message = {
			type: type,
			message: message,
			time: time,
		};
		this.queue.enqueue(_message);

		this.#tryShowNextMessage();
	}

	info(message, time = 3000) {
		let _message = {
			type: AlertType.Info,
			message: message,
			time: time,
		};
		this.queue.enqueue(_message);

		this.#tryShowNextMessage();
	}

	warn(message, time = 3000) {
		let _message = {
			type: AlertType.Warning,
			message: message,
			time: time,
		};
		this.queue.enqueue(_message);

		this.#tryShowNextMessage();
	}

	error(message, time = 3000) {
		let _message = {
			type: AlertType.Error,
			message: message,
			time: time,
		};
		this.queue.enqueue(_message);

		this.#tryShowNextMessage();
	}

	clearMessages() {
		this.queue.clear();

		this.alertDiv.classList.remove('showAlert');
	}

	showPersistentMessage(type, message) {
		clearTimeout(this.currentTimeout);

		this.alertDiv.classList.remove('show');
		this.alertDiv.classList.add('hide');

		if (this.messageVisible) {
			this.currentTimeout = setTimeout(() => {
				this.messageVisible = false;
				this.alertDiv.classList.remove('showAlert');

				this.#showMessage(type, message, 0, true);
			}, 500);
		} else {
			this.#showMessage(type, message, 0, true);
		}
	}

	clearMessage() {
		clearTimeout(this.currentTimeout);

		// Hide message
		this.alertDiv.classList.remove('show');
		this.alertDiv.classList.add('hide');
		// Wait until the message hide animation is finished before tyring to show the next message
		this.currentTimeout = setTimeout(() => {
			this.messageVisible = false;
			this.alertDiv.classList.remove('showAlert');
			if (!this.queue.isEmpty()) this.#showNextMessage();
		}, 500);
	}

	#tryShowNextMessage() {
		if (!this.messageVisible) {
			this.#showNextMessage();
		}
	}

	#showNextMessage() {
		if (this.queue.isEmpty()) return;
		let _message = this.queue.dequeue();
		this.#showMessage(_message.type, _message.message, _message.time);
	}

	#showMessage(type, message, time, persistent = false) {
		switch (type) {
			case AlertType.Info: {
				this.alertIcon.setAttribute('class', 'fas fa-info-circle');
				this.alertDiv.classList.remove('warning');
				this.alertDiv.classList.remove('error');
				this.alertDiv.classList.add('info');
				break;
			}
			case AlertType.Warning: {
				this.alertIcon.setAttribute('class', 'fas fa-exclamation-circle');
				this.alertDiv.classList.remove('info');
				this.alertDiv.classList.remove('error');
				this.alertDiv.classList.add('warning');
				break;
			}
			case AlertType.Error: {
				this.alertIcon.setAttribute('class', 'fas fa-exclamation-triangle');
				this.alertDiv.classList.remove('info');
				this.alertDiv.classList.remove('warning');
				this.alertDiv.classList.add('error');
			}
		}

		this.alertMessage.innerHTML = message;
		this.alertDiv.classList.add('showAlert');
		this.alertDiv.classList.remove('hide');
		this.alertDiv.classList.add('show');

		this.messageVisible = true;

		if (!persistent) {
			this.currentTimeout = setTimeout(() => {
				// Hide message
				this.alertDiv.classList.remove('show');
				this.alertDiv.classList.add('hide');
				// Wait until the message hide animation is finished before tyring to show the next message
				this.currentTimeout = setTimeout(() => {
					this.messageVisible = false;
					this.alertDiv.classList.remove('showAlert');
					if (!this.queue.isEmpty()) this.#showNextMessage();
				}, 500);
			}, time);
		}
	}
}
