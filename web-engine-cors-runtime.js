(function () {
  "use strict";

  if (!window.HTMLImageElement || window.__webEngineCorsRuntime) return;
  window.__webEngineCorsRuntime = true;

  function isCrossOrigin(value) {
    try {
      var url = new URL(String(value), document.baseURI);
      return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  function prepare(image, value) {
    if (isCrossOrigin(value)) image.crossOrigin = "anonymous";
  }

  var prototype = window.HTMLImageElement.prototype;
  var source = Object.getOwnPropertyDescriptor(prototype, "src");
  if (source && source.get && source.set && source.configurable) {
    Object.defineProperty(prototype, "src", {
      configurable: source.configurable,
      enumerable: source.enumerable,
      get: source.get,
      set: function (value) {
        prepare(this, value);
        return source.set.call(this, value);
      }
    });
  }

  var setAttribute = prototype.setAttribute;
  prototype.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === "src") prepare(this, value);
    return setAttribute.call(this, name, value);
  };
})();
