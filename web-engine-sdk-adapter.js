(function () {
  "use strict";

  function safe(callback) {
    if (typeof callback !== "function") return;
    try { callback.apply(null, Array.prototype.slice.call(arguments, 1)); }
    catch (error) { setTimeout(function () { throw error; }, 0); }
  }

  function reward(callback) {
    var operation = typeof window.showRewardedAd === "function"
      ? window.showRewardedAd(function () { safe(callback, true); })
      : Promise.resolve().then(function () { safe(callback, true); return true; });
    return Promise.resolve(operation).then(function () { return true; });
  }

  function interstitial(callback) {
    var operation = window.PokiSDK && typeof window.PokiSDK.commercialBreak === "function"
      ? window.PokiSDK.commercialBreak()
      : Promise.resolve(true);
    return Promise.resolve(operation).then(function () { safe(callback); return true; });
  }

  function patchGameBridge() {
    var bridge = window.gamebridge = window.gamebridge || {};
    bridge.ready = true;
    bridge.showStart = bridge.showStart || function () {};
    bridge.showNext = bridge.showNext || function () {};
    bridge.showBrowse = bridge.showBrowse || function () {};
    bridge.showPause = bridge.showPause || function () {};
    bridge.roundStart = bridge.roundStart || function () {};
    bridge.showPreroll = function (callback) { interstitial(function () { safe(callback, { breakStatus: "viewed" }); }); };
    bridge.showAd = function (callback) { interstitial(function () { safe(callback, { breakStatus: "viewed" }); }); };
    bridge.showReward = function (success, error, complete) {
      return reward(function () {
        safe(success, true);
        safe(complete, { breakStatus: "viewed" });
      }).catch(function () {
        safe(error, false);
        safe(complete, { breakStatus: "error" });
        return false;
      });
    };
  }

  function patchGameApi() {
    var api = window.GameAPI = window.GameAPI || {};
    api.GameBreak = api.GameBreak || {};
    api.GameBreak.request = function (pause, resume) {
      safe(pause);
      return interstitial(resume);
    };
    api.loadAPI = function (callback) {
      safe(callback, api);
      return Promise.resolve(api);
    };
    window.GameBreak = window.GameBreak || api.GameBreak;
  }

  function runAdBreak(options) {
    options = options || {};
    safe(options.beforeAd);
    var rewarded = /reward/i.test(String(options.type || options.name || options.format || ""));
    var operation = rewarded ? reward(options.reward) : interstitial();
    return Promise.resolve(operation).then(function () {
      safe(options.afterAd);
      safe(options.adViewed);
      safe(options.adBreakDone, {
        breakType: options.type || "next",
        breakName: options.name || "game",
        breakFormat: rewarded ? "reward" : "interstitial",
        breakStatus: "viewed"
      });
      return true;
    });
  }

  function patchAdBreak() {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = runAdBreak;
    window.adConfig = function (options) {
      safe(options && options.onReady);
      return Promise.resolve();
    };
  }

  function createSdkHandler() {
    return {
      trigger: function (event, options) {
        options = options || {};
        if (/reward/i.test(event)) return reward(options.callback);
        if (event === "save") {
          try { localStorage.setItem(options.key || "gameData", options.value || ""); safe(options.callback, null); }
          catch (error) { safe(options.callback, error); }
          return;
        }
        if (event === "restore") {
          var value = null;
          try { value = localStorage.getItem(options.key || "gameData"); }
          catch (_) {}
          safe(options.callback, null, value === null ? "null" : value);
          return;
        }
        safe(options.callback, true);
      }
    };
  }

  function patchAzerion() {
    window.sgSdk = window.sgSdk || {};
    window.sgSdk.initialize = function (modules, config, callback) {
      var settings = { config: { env: { locale: "en" } } };
      var handler = createSdkHandler();
      setTimeout(function () { safe(callback, null, settings, handler); }, 0);
      return Promise.resolve(handler);
    };
  }

  function patchCpmstar() {
    window.cpmstarAPI = window.cpmstarAPI || function (request) {
      var api = {
        game: {
          setContentID: function () {},
          setTarget: function () {},
          createInterstitial: function (options) {
            options = options || {};
            safe(options.onAdOpened);
            return interstitial(options.onAdClosed);
          }
        }
      };
      if (typeof request === "function") {
        safe(request, api);
      } else if (request && /interstitial/i.test(String(request.kind || ""))) {
        safe(request.onAdOpened);
        interstitial(request.onAdClosed).catch(request.fail || function () {});
      }
      return api;
    };
  }

  function ensure() {
    patchGameBridge();
    patchGameApi();
    patchAdBreak();
    patchAzerion();
    patchCpmstar();
  }

  ensure();
  var wrapperStarted = false;
  var attempts = 0;
  var timer = setInterval(function () {
    ensure();
    if (!wrapperStarted && typeof window.onWrapperReady === "function") {
      wrapperStarted = true;
      safe(window.onWrapperReady);
    }
    attempts++;
    if (attempts >= 120) clearInterval(timer);
  }, 100);
})();
