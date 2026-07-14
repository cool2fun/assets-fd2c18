(function () {
  "use strict";

  var state = window.__constructSdkState = window.__constructSdkState || {
    rewardRequests: 0,
    rewardGrants: 0,
    interstitialRequests: 0,
    events: []
  };

  function record(name, detail) {
    state.events.push({ name: name, detail: detail || "", at: Date.now() });
    if (state.events.length > 100) state.events.shift();
  }

  function safe(callback) {
    if (typeof callback === "function") {
      try { callback(); } catch (error) { setTimeout(function () { throw error; }, 0); }
    }
  }

  function patchHistory() {
    ["replaceState", "pushState"].forEach(function (name) {
      var current = history[name];
      if (!current || current.__constructPatched) return;
      var nativeMethod = current.bind(history);
      var wrapped = function () {
        try { return nativeMethod.apply(history, arguments); } catch (_) { return undefined; }
      };
      wrapped.__constructPatched = true;
      history[name] = wrapped;
    });
  }

  function patchOrientation() {
    if (!screen.orientation) return;
    try {
      screen.orientation.lock = function () { return Promise.resolve(); };
      screen.orientation.unlock = function () {};
    } catch (_) {}
  }

  function grantReward(source, callback) {
    state.rewardRequests++;
    record("reward-request", source);
    return new Promise(function (resolve) {
      setTimeout(function () {
        state.rewardGrants++;
        record("reward-granted", source);
        safe(callback);
        window.dispatchEvent(new CustomEvent("construct-reward-granted", { detail: { source: source } }));
        resolve(true);
      }, 20);
    });
  }

  function finishInterstitial(source, callback) {
    state.interstitialRequests++;
    record("interstitial", source);
    return new Promise(function (resolve) {
      setTimeout(function () { safe(callback); resolve(true); }, 20);
    });
  }

  function patchPoki() {
    var sdk = window.PokiSDK = window.PokiSDK || {};
    sdk.__constructPatched = true;
    sdk.init = sdk.init || function () { return Promise.resolve(); };
    sdk.initWithVideoHB = sdk.init;
    sdk.setDebug = sdk.setDebug || function () {};
    sdk.setDebugTouchOverlayController = sdk.setDebugTouchOverlayController || function () {};
    sdk.gameLoadingStart = sdk.gameLoadingStart || function () {};
    sdk.gameLoadingProgress = sdk.gameLoadingProgress || function () {};
    sdk.gameLoadingFinished = sdk.gameLoadingFinished || function () {};
    sdk.gameplayStart = sdk.gameplayStart || function () {};
    sdk.gameplayStop = sdk.gameplayStop || function () {};
    sdk.commercialBreak = function () { return finishInterstitial("poki"); };
    sdk.rewardedBreak = function () { return grantReward("poki"); };
    sdk.displayAd = function () { return Promise.resolve(true); };
    sdk.destroyAd = function () {};
    sdk.happyTime = sdk.happyTime || function () {};
    sdk.isAdBlocked = function () { return false; };
    sdk.getURLParam = sdk.getURLParam || function () { return ""; };
  }

  function makeYsdk(value) {
    var ysdk = value || {};
    ysdk.environment = ysdk.environment || {
      app: { id: "offline" },
      browser: { lang: "en" },
      i18n: { lang: "en", tld: "com" },
      payload: ""
    };
    ysdk.features = ysdk.features || {};
    ysdk.features.LoadingAPI = ysdk.features.LoadingAPI || { ready: function () {} };
    ysdk.features.GameplayAPI = ysdk.features.GameplayAPI || { start: function () {}, stop: function () {} };
    ysdk.features.GamesAPI = ysdk.features.GamesAPI || {
      getAllGames: function () { return Promise.resolve([]); },
      getGameByID: function () { return Promise.resolve({}); }
    };
    ysdk.onEvent = ysdk.onEvent || function () {};
    ysdk.on = ysdk.on || function () {};
    ysdk.serverTime = ysdk.serverTime || function () { return Date.now(); };
    ysdk.getFlags = ysdk.getFlags || function () { return Promise.resolve({}); };
    ysdk.dispatchEvent = ysdk.dispatchEvent || function () {};
    ysdk.openAuthDialog = ysdk.openAuthDialog || function () { return Promise.resolve(); };
    ysdk.EVENTS = ysdk.EVENTS || {
      HISTORY_BACK: "HISTORY_BACK",
      ACCOUNT_SELECTION_DIALOG_CLOSED: "ACCOUNT_SELECTION_DIALOG_CLOSED",
      ACCOUNT_SELECTION_DIALOG_OPENED: "ACCOUNT_SELECTION_DIALOG_OPENED"
    };
    ysdk.deviceInfo = ysdk.deviceInfo || {
      isMobile: function () { return false; },
      isTablet: function () { return false; },
      isDesktop: function () { return true; },
      isTV: function () { return false; },
      type: "desktop"
    };
    ysdk.feedback = ysdk.feedback || {
      canReview: function () { return Promise.resolve({ value: false }); },
      requestReview: function () { return Promise.resolve({ feedbackSent: false }); }
    };
    ysdk.shortcut = ysdk.shortcut || {
      canShowPrompt: function () { return Promise.resolve({ canShow: false }); },
      showPrompt: function () { return Promise.resolve({ outcome: "rejected" }); }
    };
    ysdk.adv = ysdk.adv || {};
    ysdk.adv.showFullscreenAdv = function (options) {
      var callbacks = options && options.callbacks || {};
      safe(callbacks.onOpen);
      return finishInterstitial("yandex", function () {
        if (typeof callbacks.onClose === "function") callbacks.onClose(true);
      });
    };
    ysdk.adv.showRewardedVideo = function (options) {
      var callbacks = options && options.callbacks || {};
      safe(callbacks.onOpen);
      return grantReward("yandex", callbacks.onRewarded).then(function () {
        safe(callbacks.onClose);
        return true;
      });
    };
    ysdk.adv.showBannerAdv = ysdk.adv.showBannerAdv || function () {};
    ysdk.adv.hideBannerAdv = ysdk.adv.hideBannerAdv || function () {};
    ysdk.getPlayer = ysdk.getPlayer || function () {
      return Promise.resolve({
        getMode: function () { return "lite"; },
        getName: function () { return "Player"; },
        getPhoto: function () { return ""; },
        getUniqueID: function () { return "offline"; },
        getData: function () { return Promise.resolve({}); },
        setData: function () { return Promise.resolve(); },
        getStats: function () { return Promise.resolve({}); },
        setStats: function () { return Promise.resolve(); },
        incrementStats: function () { return Promise.resolve(); }
      });
    };
    ysdk.getPayments = ysdk.getPayments || function () {
      return Promise.resolve({
        getCatalog: function () { return Promise.resolve([]); },
        getPurchases: function () { return Promise.resolve([]); },
        purchase: function () { return Promise.resolve(); },
        consumePurchase: function () { return Promise.resolve(); }
      });
    };
    ysdk.getLeaderboards = ysdk.getLeaderboards || function () {
      return Promise.resolve({
        getLeaderboardEntries: function () { return Promise.resolve({ entries: [] }); },
        getLeaderboardDescription: function () { return Promise.resolve({}); },
        setLeaderboardScore: function () { return Promise.resolve(); }
      });
    };
    ysdk.isAvailableMethod = ysdk.isAvailableMethod || function () { return Promise.resolve(false); };
    return ysdk;
  }

  function patchYandex() {
    window.Ya = window.Ya || {};
    window.Ya.Context = window.Ya.Context || {};
    window.Ya.Context.AdvManager = window.Ya.Context.AdvManager || {
      render: function () { return Promise.resolve(); },
      destroy: function () {}
    };
    window.ym = window.ym || function () {};
    window.yandexContextAsyncCallbacks = window.yandexContextAsyncCallbacks || [];
    var current = window.YaGames;
    if (current && current.__constructPatched) return;
    var nativeInit = current && typeof current.init === "function" ? current.init.bind(current) : null;
    window.YaGames = {
      __constructPatched: true,
      init: function () {
        var result;
        try { result = nativeInit ? nativeInit() : Promise.resolve({}); }
        catch (_) { result = Promise.resolve({}); }
        return Promise.resolve(result).catch(function () { return {}; }).then(function (ysdk) {
          ysdk = makeYsdk(ysdk);
          window.ysdk = ysdk;
          return ysdk;
        });
      }
    };
    if (window.ysdk) window.ysdk = makeYsdk(window.ysdk);
  }

  function eventEmitter(target) {
    if (target.__constructEmitter && typeof target.on === "function" && typeof target._emit === "function") return target;
    var listeners = {};
    target.__constructEmitter = true;
    var nativeOn = typeof target.on === "function" ? target.on.bind(target) : null;
    target.on = function (name, callback) {
      (listeners[name] = listeners[name] || []).push(callback);
      if (nativeOn) {
        try { nativeOn(name, callback); } catch (_) {}
      }
      return target;
    };
    target.off = target.off || function (name, callback) {
      listeners[name] = (listeners[name] || []).filter(function (item) { return item !== callback; });
      return target;
    };
    target._emit = function (name, value) {
      (listeners[name] || []).slice().forEach(function (callback) { safe(function () { callback(value); }); });
    };
    return target;
  }

  function patchPlaygama() {
    var quietCallbacks = window.__WEB_ENGINE_SLUG__ === "geometry-arrow-2";
    var bridge = window.bridge || window.playgamaBridge || window.PlayGamaBridge;
    if (quietCallbacks) return;
    if (!bridge) bridge = {};
    if (!quietCallbacks) bridge = eventEmitter(bridge);
    bridge.initialize = function () {
      patchPlaygama();
      return Promise.resolve();
    };
    bridge.EVENT_NAME = bridge.EVENT_NAME || {
      BANNER_STATE_CHANGED: "banner_state_changed",
      INTERSTITIAL_STATE_CHANGED: "interstitial_state_changed",
      REWARDED_STATE_CHANGED: "rewarded_state_changed"
    };
    bridge.BANNER_STATE = bridge.BANNER_STATE || {
      LOADING: "loading",
      SHOWN: "shown",
      HIDDEN: "hidden",
      FAILED: "failed"
    };
    bridge.INTERSTITIAL_STATE = bridge.INTERSTITIAL_STATE || {
      LOADING: "loading",
      OPENED: "opened",
      CLOSED: "closed",
      FAILED: "failed"
    };
    bridge.REWARDED_STATE = bridge.REWARDED_STATE || {
      LOADING: "loading",
      OPENED: "opened",
      REWARDED: "rewarded",
      CLOSED: "closed",
      FAILED: "failed"
    };
    bridge.PLATFORM_MESSAGE = bridge.PLATFORM_MESSAGE || {
      GAME_READY: "game_ready",
      IN_GAME_LOADING_STARTED: "in_game_loading_started",
      IN_GAME_LOADING_STOPPED: "in_game_loading_stopped",
      GAMEPLAY_STARTED: "gameplay_started",
      GAMEPLAY_STOPPED: "gameplay_stopped",
      PLAYER_GOT_ACHIEVEMENT: "player_got_achievement"
    };
    bridge.platform = bridge.platform || { id: "playgama", language: "en" };
    bridge.game = quietCallbacks ? (bridge.game || {}) : eventEmitter(bridge.game || {});
    if (quietCallbacks) {
      bridge.game.on = bridge.game.on || function () { return bridge.game; };
      bridge.game.off = bridge.game.off || function () { return bridge.game; };
    }
    bridge.game.setLoadingProgress = bridge.game.setLoadingProgress || function () {};
    bridge.game.start = bridge.game.start || function () {};
    bridge.game.pause = bridge.game.pause || function () {};
    bridge.game.resume = bridge.game.resume || function () {};
    bridge.advertisement = quietCallbacks ? (bridge.advertisement || {}) : eventEmitter(bridge.advertisement || {});
    if (quietCallbacks) {
      bridge.advertisement.on = bridge.advertisement.on || function () { return bridge.advertisement; };
      bridge.advertisement.off = bridge.advertisement.off || function () { return bridge.advertisement; };
    }
    var ads = bridge.advertisement;
    ads.isRewardedAvailable = true;
    ads.isRewardedSupported = true;
    ads.isFullscreenAvailable = true;
    ads.isInterstitialSupported = true;
    ads.showInterstitial = function () {
      if (!quietCallbacks) ads._emit("interstitial_state_changed", "opened");
      return finishInterstitial("playgama", function () {
        if (!quietCallbacks) ads._emit("interstitial_state_changed", "closed");
      });
    };
    ads.showRewarded = function (options) {
      if (!quietCallbacks) ads._emit("rewarded_state_changed", "opened");
      return grantReward("playgama", function () {
        if (!quietCallbacks) ads._emit("rewarded_state_changed", "rewarded");
        if (options && typeof options.afterClose === "function") options.afterClose(true);
      }).then(function () {
        if (!quietCallbacks) ads._emit("rewarded_state_changed", "closed");
        return true;
      });
    };
    ads.showFullscreen = ads.showInterstitial;
    window.bridge = window.playgamaBridge = window.PlayGamaBridge = bridge;
  }

  function fireGd(name) {
    var options = window.GD_OPTIONS;
    if (options && typeof options.onEvent === "function") {
      try { options.onEvent({ name: name }); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent(name));
  }

  function patchGameDistribution() {
    var sdk = window.gdsdk = window.gdsdk || {};
    sdk.__constructPatched = true;
    sdk.AdType = sdk.AdType || { Interstitial: 0, Rewarded: 1, Display: 2 };
    sdk.preloadAd = function () { return Promise.resolve(); };
    sdk.showAd = function (type) {
      var rewarded = type === 1 || /reward/i.test(String(type));
      fireGd("SDK_GAME_PAUSE");
      return (rewarded ? grantReward("gamedistribution", function () {
        fireGd("SDK_REWARDED_WATCH_COMPLETE");
      }) : finishInterstitial("gamedistribution")).then(function () {
        fireGd("SDK_GAME_START");
        return true;
      });
    };
    setTimeout(function () { fireGd("SDK_READY"); }, 0);
  }

  function patchCrazyGames() {
    var root = window.CrazyGames = window.CrazyGames || {};
    root.SDK = root.SDK || {};
    root.SDK.game = root.SDK.game || { loadingStart: function () {}, loadingStop: function () {}, gameplayStart: function () {}, gameplayStop: function () {}, happytime: function () {} };
    root.SDK.ad = root.SDK.ad || {};
    root.SDK.ad.requestAd = function (type, callbacks) {
      callbacks = callbacks || {};
      safe(callbacks.adStarted);
      var rewarded = /reward/i.test(String(type));
      return (rewarded ? grantReward("crazygames") : finishInterstitial("crazygames")).then(function () {
        safe(callbacks.adFinished);
        return true;
      });
    };
  }

  function patchY8() {
    window.ID = window.ID || {};
    window.ID.isVisible = window.ID.isVisible || function () { return true; };
    window.ID.init = window.ID.init || function () {};
    window.ID.login = window.ID.login || function (callback) { safe(callback); };
    window.ID.register = window.ID.register || function (callback) { safe(callback); };
    window.ID.api = window.ID.api || function (route, method, data, callback) { safe(function () { callback({}); }); };
    window.ID.submit_image = window.ID.submit_image || function (image, callback) { safe(function () { callback({}); }); };
    window.ID.Event = window.ID.Event || { subscribe: function () {} };
    window.ID.Protection = window.ID.Protection || {
      isBlacklisted: function (callback) { safe(function () { callback(false); }); },
      isSponsor: function (callback) { safe(function () { callback(false); }); }
    };
    window.ID.GameAPI = window.ID.GameAPI || {};
    window.ID.GameAPI.GameBreak = window.ID.GameAPI.GameBreak || {};
    window.ID.GameAPI.GameBreak.request = function (pause, resume) {
      safe(pause);
      return finishInterstitial("y8", resume);
    };
    window.ID.GameAPI.Leaderboards = window.ID.GameAPI.Leaderboards || {
      list: function () { return []; },
      save: function (score, callback) { safe(function () { callback({}); }); }
    };
    window.ID.GameAPI.Achievements = window.ID.GameAPI.Achievements || {
      list: function () { return []; },
      save: function (achievement, callback) { safe(function () { callback({}); }); }
    };
  }

  function patchLisSdkValue(sdk) {
    if (!sdk || typeof sdk !== "object") return sdk;
    sdk.adv = sdk.adv || {};
    sdk.adv.interstitial = sdk.adv.interstitial || {};
    sdk.adv.rewarded = sdk.adv.rewarded || {};
    sdk.adv.interstitial.supported = true;
    sdk.adv.rewarded.supported = true;
    sdk.adv.interstitial.show = function (options) {
      options = options || {};
      safe(options.onOpen);
      return finishInterstitial("lissdk", options.onClose);
    };
    sdk.adv.rewarded.show = function (options) {
      options = options || {};
      safe(options.onOpen);
      return grantReward("lissdk").then(function () {
        if (typeof options.onClose === "function") options.onClose(true);
        return true;
      });
    };
    return sdk;
  }

  function patchLisSdk() {
    patchLisSdkValue(window.sdk);
    var lis = window.LisSDK;
    if (!lis || typeof lis.init !== "function" || lis.init.__constructPatched) return;
    var nativeInit = lis.init.bind(lis);
    var wrapped = function () {
      var result;
      try { result = nativeInit.apply(lis, arguments); }
      catch (_) { result = Promise.resolve({}); }
      return Promise.resolve(result).then(patchLisSdkValue);
    };
    wrapped.__constructPatched = true;
    lis.init = wrapped;
  }

  function patchAliases() {
    var aliases = ["showRewardedAd", "ShowRewardedAd", "showRewardedVideo", "ShowRewardedVideo"];
    aliases.forEach(function (name) {
      if (typeof window[name] !== "function") {
        window[name] = function (callback) { return grantReward("generic", function () { if (typeof callback === "function") callback(true); }); };
      }
    });
  }

  function ensure() {
    patchHistory();
    patchOrientation();
    patchPoki();
    patchYandex();
    patchPlaygama();
    patchGameDistribution();
    patchCrazyGames();
    patchY8();
    patchLisSdk();
    patchAliases();
  }

  window.__constructRewardAudit = function () {
    var before = state.rewardGrants;
    var playgamaReward = window.__WEB_ENGINE_SLUG__ === "geometry-arrow-2"
      ? grantReward("playgama-audit")
      : window.bridge.advertisement.showRewarded();
    return Promise.all([
      window.PokiSDK.rewardedBreak(),
      window.YaGames.init().then(function (ysdk) { return ysdk.adv.showRewardedVideo({ callbacks: {} }); }),
      playgamaReward,
      window.gdsdk.showAd(window.gdsdk.AdType.Rewarded),
      new Promise(function (resolve) { window.CrazyGames.SDK.ad.requestAd("rewarded", { adFinished: resolve }); })
    ]).then(function () {
      return { before: before, after: state.rewardGrants, granted: state.rewardGrants - before };
    });
  };

  ensure();
  var attempts = 0;
  var timer = setInterval(function () {
    ensure();
    attempts++;
    if (attempts >= 80) clearInterval(timer);
  }, 250);
})();
