var deferred = require('deferred');

module.exports = function (fn, timeout) {
  return function () {
    var def = deferred(), self = this, args = arguments;

    setTimeout(function () {
      var value;
      try {
        value = fn.apply(self, args);
      } catch (e) {
        def.reject(e);
        return;
      }
      def.resolve(value);
    }, timeout);

    return def.promise;
  };
};