var Immutable = require('immutable');
var _localStorage = require('./lib/localStorage');

var ImmutableStoreMixin = {
  state: Immutable.OrderedMap(),
  init: function() {
    // Update state with cached data
    var nextState = this._getCachedState();

    if (nextState) {
      this.setState(nextState);
    }
  },
  _fromJSOrdered: function(js) {
    return typeof js !== 'object' || js === null ? js :
      Array.isArray(js) ?
        Immutable.Seq(js).map(this._fromJSOrdered).toList() :
        Immutable.Seq(js).map(this._fromJSOrdered).toOrderedMap();
  },
  _mergeIntoCollectionWith: function(collection, merger, iters) {
    iters = iters.filter(x => x.size !== 0);
    if (iters.length === 0) {
      return collection;
    }
    if (collection.size === 0 && !collection.__ownerID && iters.length === 1) {
      return collection.constructor(iters[0]);
    }
    return collection.withMutations(collection => {
      var mergeIntoMap = merger ?
        (value, key) => {
          collection.update(key, {}, existing =>
              existing === {} ? value : merger(existing, value, key)
          );
        } :
        (value, key) => {
          collection.set(key, value);
        }
      for (var ii = 0; ii < iters.length; ii++) {
        iters[ii].forEach(mergeIntoMap);
      }
    });
  },
  _mergeIntoMapWith: function(map, merger, iterables) {
    var iters = [];
    for (var ii = 0; ii < iterables.length; ii++) {
      var value = iterables[ii];
      var iter = Immutable.Iterable.Keyed(value);
      if (!Immutable.Iterable.isIterable(value)) {
        iter = iter.map(v => this._fromJSOrdered(v));
      }
      iters.push(iter);
    }
    return this._mergeIntoCollectionWith(map, merger, iters);
  },
  setState: function(nextState, option) {
    if (!nextState) { return null; }

    var triggerUpdate;
    var cb;

    var optionType = typeof option;

    if (optionType === 'boolean') {
      triggerUpdate = option;
      var _err = new Error('ImmutableStoreMixin.setState:: `triggerUpdate`, will be depracated in future release.');
      console.warn(_err.stack);
    }
    else {
      cb = option;
    }

    var _targetState = this._mergeIntoMapWith(this.state, undefined, [nextState]);

    if (_targetState !== this.state) {
      this.state = _targetState;

      if (triggerUpdate !== false) {
        this.trigger();
        this._updateLocalStorage();
      }

      // Trigger callback if it is passed in
      if (cb) {
        return cb();
      }
    }
  },
  get: function(key) {
    if (this.onFirstRequest && !this._ImmutableStoreMixinRequested) {
      this._ImmutableStoreMixinRequested = true;
      this.onFirstRequest();
    }

    return this.state.get(key);
  },
  _updateLocalStorage: function() {
    if (!this.localStorageKey) {
      // Don't save state unless we need too
      return null;
    }

    var _stateString;

    if (this.stateToString) {
      // Custom conversion to string
      _stateString = this.stateToString(this.state);

      if (!_stateString) {
        var err = new Error('`stateToString()` must return a valid JSON string');
        console.warn(err.stack);
        return null;
      }
    }
    else {
      _stateString = JSON.stringify(this.state.toJS());
    }

    _localStorage.setItem(this.localStorageKey, _stateString);
  },
  _getCachedState: function() {
    if (!this.localStorageKey) {
      // Don't get state unless we need too
      return null;
    }

    var _stateString = _localStorage.getItem(this.localStorageKey);

    if (!_stateString || _stateString === '') {
      return null;
    }

    var _cachedState;

    if (this.stateFromString) {
      _cachedState = this.stateFromString(_stateString);

      if (!_cachedState) {
        var err = new Error('`stateFromString()` must return a Immutable.Map');
        console.warn(err.stack);
        return null;
      }
    }
    else {
      var _cachedJSON = JSON.parse(_stateString);
      _cachedState = Immutable.fromJS(_cachedJSON);
    }

    return _cachedState;
  }
};

module.exports = ImmutableStoreMixin;
