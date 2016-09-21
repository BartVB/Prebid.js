var bidfactory = require('../bidfactory.js');
var bidmanager = require('../bidmanager.js');
var adloader = require('../adloader.js');
var utils = require('../utils.js');

/**
 * Adapter for requesting ads from OpenX without using RTB.
 * This adapter assumes a flat CPM per ad unit when an ad is returned.
 *
 * @param {Object} options - Configuration options for OpenX
 * @param {string} options.pageURL - Current page URL to send with bid request
 * @param {string} options.refererURL - Referer URL to send with bid request
 * @param {float}  options.unit_cpm - Flat CPM for ad unit
 * @param {int} options.unit - Auid of ad unit, from OpenX inventory
 *
 * @returns {{callBids: _callBids}}
 * @constructor
 */
var OpenxFlatAdapter = function OpenxFlatAdapter(options) {

  var opts = options || {};
  var scriptUrl;
  var bids;
  var auids = [];

  function _callBids(params) {
    bids = params.bids || [];
    for (var i = 0; i < bids.length; i++) {
      var bid = bids[i];
      //load page options from bid request
      if (bid.params.pageURL) {
        opts.pageURL = bid.params.pageURL;
      }
      if (bid.params.refererURL) {
        opts.refererURL = bid.params.refererURL;
      }
      if (bid.params.jstag_url) {
        scriptUrl = bid.params.jstag_url;
      }
      if (bid.params.pgid) {
        opts.pgid = bid.params.pgid;
      }
      auids.push(bid.params.unit);
    }

    var requestUrl = _getRequestUrl(scriptUrl, auids);
    utils.logMessage('Sending openxFlat request: ' + requestUrl);
    adloader.loadScript(requestUrl);
  }

  $$PREBID_GLOBAL$$.OpenxCbHandler = function (response) {
    for (var i = 0; i < bids.length; i++) {
      var bid = bids[i];
      var auid = parseInt(bid.params.unit);
      var bidResponse = _getResponseByAuid(response, auid);
      var adResponse = {};

      if (bidResponse.is_fallback === 0) {
        adResponse = bidfactory.createBid(1);
        adResponse.bidderCode = bid.bidder;
        adResponse.cpm = bid.params.unit_cpm;
        adResponse.ad = bidResponse.html;
        adResponse.width = bidResponse.creative[0].width;
        adResponse.height = bidResponse.creative[0].height;
        bidmanager.addBidResponse(bid.placementCode, adResponse);
      } else {
        // Indicate an ad was not returned
        adResponse = bidfactory.createBid(2);
        adResponse.bidderCode = bid.bidder;
        bidmanager.addBidResponse(bid.placementCode, adResponse);
      }
    }

    // Fire OpenX pixels
    (new Image()).src = response.ads.pixels;
  };

  function _getResponseByAuid(response, auid) {
    for (var i = 0; i < response.ads.ad.length; i++) {
      if (response.ads.ad[i].adunitid === auid) {
        return response.ads.ad[i];
      }
    }
    return false;
  }

  function _getRequestUrl(scriptURL, auids) {
    var requestURL = 'http://uk-ads.openx.net/w/1.0/arj?'; // scriptURL + '?';
    var queryParameters = [];

    var args = {
      callback: 'pbjs.OpenxCbHandler',  // TODO: Deal with rename of pbjs global
      auid: auids.join(','),
      res: screen.width + "x" + screen.height + "x" + screen.colorDepth,
      ch: document.charset || document.characterSet,
      tz: (new Date()).getTimezoneOffset(),
      ju: 'http://www.bokt.nl/'  // TODO: Make this a setting and default to page URL host
    };

    // Use utils.tryAppendQueryString()
    for (var p in args)
      if (args.hasOwnProperty(p)) {
        queryParameters.push(encodeURIComponent(p) + "=" + encodeURIComponent(args[p]));
      }
    return requestURL + queryParameters.join("&");
  }

  return {
    callBids: _callBids
  };
};

module.exports = OpenxFlatAdapter;
