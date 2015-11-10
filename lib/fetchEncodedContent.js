'use strict';

var request = require('request'),
    iconv = require('iconv-lite'),
    BufferHelper = require('bufferhelper'),
    deferred = require('deferred'),
    promisify = deferred.promisify

module.exports = function (url,encoding) {
  var def = deferred()
  var req = request(url, {timeout: 10000, pool: false});
  req.setMaxListeners(50);
  req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36')
  req.setHeader('accept', 'text/html,application/xhtml+xml');

  req.on('error', function(err) {
    console.log(err);
  });
  req.on('response', function(res) {
    var bufferHelper = new BufferHelper();
    res.on('data', function (chunk) {
      bufferHelper.concat(chunk);
    });
    res.on('end',function(){
      var result = iconv.decode(bufferHelper.toBuffer(),encoding);
      def.resolve(result);
    });
  });
  req.on('clientError', function (err) {
    def.reject(err);
  });
  req.on('timeout', function (err) {
    def.reject(err);
  });
  return def.promise;
}