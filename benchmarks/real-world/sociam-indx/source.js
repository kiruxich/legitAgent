				// this._updateQueue = {};
				// this._deleteQueue = {};
				// this._fetchingQueue = {};
				var rejectAll = function (dL) {	if (dL) { _(dL).values().map(function(d) { d.reject('reset'); });}	};
				rejectAll(this._updateQueue);
				this._updateQueue = {};
				rejectAll(this._deleteQueue);
