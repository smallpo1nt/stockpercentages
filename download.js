'use strict';

var request = require('request'),
    iconv = require('iconv-lite'),
    delay = require('./lib/delay'),
    BufferHelper = require('bufferhelper'),
    deferred = require('deferred'),
    promisify = deferred.promisify,
    fetchEncodedContent = require('./lib/fetchEncodedContent'),
    stocks = require('./data/stocks.json'),
    stocksWithId = require('./data/stocks-with-ids.json'),
    fs = require('fs'),
    writeFile = promisify(fs.writeFile),
    readDir = promisify(fs.readdir);

var readFile = function (url, encoding) {
  var def = deferred();
  fs.readFile(url, encoding, function (err, data) {
    if (err) {
      def.reject(err);
    } else {
      def.resolve(data);
    }
  });
  return def.promise
}

/**
 * This constructs the URL by a stock id and id.
 * @param stockid: string
 * @param id: string
 * @return string
 */
function makeurl(stockid,id) {
  return "http://vip.stock.finance.sina.com.cn/corp/view/vISSUE_"+
         "MarketBulletinDetail.php?stockid=" + stockid + "&id=" + id;
}

/**
 * This looks up a stock's id in Google.
 * @param stockid: String
 * @return Promise({stockid: String, id: String})
 */
function findStockInGoogle(stockid) {

  // Search for 'stockid 首次公开发行股票上市公告 新浪'
  var url = "https://www.google.ch/search?q="+stockid+
            "+%E9%A6%96%E6%AC%A1%E5%85%AC%E5%BC%80%E5%8F%91%E8%A1"+
            "%8C%E8%82%A1%E7%A5%A8%E4%B8%8A%E5%B8%82%E5%85%AC%E5%"+
            "91%8A+%E6%96%B0%E6%B5%AA";

  return fetchEncodedContent(url,'utf8').then(function (body) {
    var match = body.match(/stockid=([0-9]+)&amp;id=([0-9]+)/);

    if (!match)
      throw "No Google result for '" + stockid + "'.";
    else if (match[1] != stockid)
      throw "Wrong Google result for '"+stockid+"', got '"+match[1]+"'.";
    else
      return {stockid: match[1], id: match[2]}
  })

}

/**
 * Construct a list of at most 20 numbers starting from pos
 * @param pos: integer
 * @return array(float)
 */
function extractNumbersAfter(pos, body) {
  var re = /\s([0-9]{1,2}(?:\.[0-9]{1,5}|%))/g;
  re.lastIndex = pos;
  // Construct a list of at most 20 numbers starting from 前十名股东
  // Quit if the gap is bigger than 500 characters.
  var match, i = 0, nums = [], lastIndex = re.lastIndex,
      last = 100000, cur = 0;
  while((match = re.exec(body)) && i < 20) {
    cur = parseFloat(match[1]);
    if (re.lastIndex - lastIndex > 500) break;
    if (cur <= last) {
      last = cur;
      lastIndex = re.lastIndex;
      nums.push(cur);
      i++;
    }
  }
  return nums;
}

/**
 * This gets all percentages for a stock
 * @param stock: {stockid: string, id: string}
 * Return Promise(array(float))
 */
function getPercentages(stock) {
  var url = makeurl(stock.stockid, stock.id),
      fname = "files/"+stock.stockid+".html";
  return readFile(fname,"utf-8").then(function (body) {
    // Find top 10 position
    var top10pos = body.indexOf('前十名股东');
    if (top10pos < 0) top10pos = body.indexOf('前10');
    if (top10pos < 0) throw "No occurence of '前十名股东' or '前10'.";

    var nums = extractNumbersAfter(top10pos, body);
    // Evaluate the resulting list of nums
    if (nums.length < 10)
      throw "Less than 10 decreasing numbers found.";
    else if (nums.length > 0)
      return nums;
  });
}

/**
 * Print the line and handle errors
 * @param stock: {stockid: string, id: string}
 * @return Promise(void)
 */
function printLine(stock) {
  return getPercentages(stock)
    .then(function (nums) {
      console.log(stock.stockid + "\t" + nums.join("\t"))
    }, function (err) {
      console.error(stock.stockid + "\tERROR: " + err);
    });
}

/**
 * Read all IDs from Google and save them without processing
 * Needs stronger delay policy, since google servers are fast
 * and well protected against over-use, so I add a 500ms delay
 * to every request.
 */
function printIds(stockid) {
  var find = delay(findStockInGoogle, 500);
  return find(stockid)
    .then(function (a) {
      console.log(a)
    }, function (err) {
      console.error(stockid + "\tERROR: " + err);
    });
}

/**
 * Download a stocks page
 * @param stock: {stockid: string, id: string}
 * @return Promise(void)
 */
function downloadPage(stock) {

  var url = makeurl(stock.stockid, stock.id),
      fname = "files/"+stock.stockid+".html";

  return writeFile(fname,fetchEncodedContent(url, 'GBK')).done();
}



/**
 * Run the code fr each stock
 */
// deferred.map(stocks, deferred.gate(printIds,1)).done();
deferred.map(stocksWithId, deferred.gate(printLine,10)).done();



// deferred.map(stocksWithId, deferred.gate(downloadPage,2)).done();



