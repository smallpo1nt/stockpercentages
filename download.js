'use strict';

var request = require('request'),
    iconv = require('iconv-lite'),
    BufferHelper = require('bufferhelper'),
    deferred = require('deferred'),
    promisify = deferred.promisify,
    fetchEncodedContent = require('./lib/fetchEncodedContent'),
    stocks = require('./data/stocks.json');

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
  var re = / ([0-9]{1,2}\.[0-9]{1,5})/g;
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
  var url = makeurl(stock.stockid, stock.id);
  return fetchEncodedContent(url, 'GBK').then(function (body) {
    // Find top 10 position
    var top10pos = body.indexOf('前十名股东');
    if (top10pos < 0) throw "No occurence of '前十名股东'.";

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
 * @param stockid: integer
 * @return Promise(void)
 */
function printLine(stockid) {
  return findStockInGoogle(stockid)
    .then(getPercentages)
    .then(function (nums) {
      console.log(stockid + "\t" + nums.join("\t"))
    }, function (err) {
      console.error(stockid + "\tERROR: " + err);
    });
}

/**
 * Limit the number of concurrent queries to 3
 */
var printLineGate = deferred.gate(printLine,3);

/**
 * Run the code
 */
deferred.map(stocks, printLineGate).done();
