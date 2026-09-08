		this.inputWithUserKeyEvent = () => {
			document.querySelectorAll('textarea, input[type=text], input[type=email], input[type=number], input[type=password], input[type=tel], input[type=search], input[type=url], input[type=search], input[type=week], input[type=month], input[type=datetime-local]').forEach(element => {
				element.onkeydown = null;
			});
			document.querySelectorAll('textarea, input[type=text], input[type=email], input[type=number], input[type=password], input[type=tel], input[type=search], input[type=url], input[type=search], input[type=week], input[type=month], input[type=datetime-local]').forEach(element => {
				element.oninput = this.inputWithUserKeyListener(function (input) {
