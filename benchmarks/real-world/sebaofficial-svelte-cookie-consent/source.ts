		this.save();
	}

	public rejectAll() {
		Object.values(this.choices).forEach((choice) => {
			choice.value = Boolean(choice.mandatory);
		});
