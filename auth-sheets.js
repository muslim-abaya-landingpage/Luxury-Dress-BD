/**
 * @deprecated — auth-api.js (MaAuth) ব্যবহার করুন
 */
(function (global) {
  if (global.MaAuth) {
    global.AuthSheets = {
      submitRegister: function (d) {
        return global.MaAuth.register(d);
      },
      submitLogin: function (d) {
        return global.MaAuth.login({ login: d.login, password: d.password });
      }
    };
  }
})(window);
