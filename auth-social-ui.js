/* Shared accessible status for the optional social-auth providers. */
(function (g) {
  "use strict";
  var node = g.document.getElementById("maSocialStatus");
  var states = { google: "disabled", facebook: "disabled" };
  function refresh() {
    if (!node) return;
    var unavailable = Object.keys(states).filter(function (provider) { return states[provider] === "disabled"; });
    var loading = Object.keys(states).filter(function (provider) { return states[provider] === "loading"; });
    node.classList.remove("is-error", "is-pending");
    if (loading.length) {
      node.textContent = "Loading " + loading.map(function (p) { return p === "google" ? "Google" : "Facebook"; }).join(" and ") + " sign-in…";
      node.classList.add("is-pending");
      return;
    }
    if (!unavailable.length) {
      node.textContent = "";
      return;
    }
    var names = unavailable.map(function (p) { return p === "google" ? "Google" : "Facebook"; });
    node.textContent = names.join(" and ") + " sign-in " + (names.length === 1 ? "is" : "are") + " not configured. Email sign-in is available.";
  }
  g.MaSocialUI = {
    setProviderState: function (provider, state) {
      if (Object.prototype.hasOwnProperty.call(states, provider)) states[provider] = state;
      refresh();
    },
    message: function (text, kind) {
      if (!node) return;
      node.textContent = text || "";
      node.classList.toggle("is-error", kind === "error");
      node.classList.toggle("is-pending", kind === "pending");
    }
  };
  refresh();
})(window);
