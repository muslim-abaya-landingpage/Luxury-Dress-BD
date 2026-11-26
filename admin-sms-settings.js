(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function render(res) {
    var s = res.settings || {};
    $('smsEnabled').checked = !!s.enabled;
    $('smsProvider').value = s.provider || '';
    $('smsSenderId').value = s.senderId || '';
    $('smsApiUrl').value = s.apiUrl || '';
    $('smsApiKey').value = '';
    $('smsKeyHint').textContent = res.hasKey ? ('বর্তমান Key: ' + (s.apiKeyHint || '•••সংরক্ষিত')) : 'কোনো Key সংরক্ষিত নেই।';
  }

  function load() {
    $('smsMessage').textContent = 'লোড হচ্ছে…';
    return MaAdmin.call('AdminSmsSettingsGet', {}).then(function (res) {
      render(res);
      $('smsMessage').textContent = '';
    }).catch(function (err) {
      $('smsMessage').textContent = 'লোড করা যায়নি: ' + err.message;
    });
  }

  function save(ev) {
    ev.preventDefault();
    $('smsSave').disabled = true;
    $('smsMessage').textContent = 'সংরক্ষণ হচ্ছে…';
    MaAdmin.call('AdminSmsSettingsSave', {
      Enabled: $('smsEnabled').checked ? '1' : '0',
      Provider: $('smsProvider').value.trim(),
      SenderId: $('smsSenderId').value.trim(),
      ApiUrl: $('smsApiUrl').value.trim(),
      ApiKey: $('smsApiKey').value
    }).then(function (res) {
      render(res);
      $('smsMessage').textContent = 'সংরক্ষিত হয়েছে।';
    }).catch(function (err) {
      $('smsMessage').textContent = 'সংরক্ষণ হয়নি: ' + err.message;
    }).finally(function () { $('smsSave').disabled = false; });
  }

  function bind() {
    $('smsForm').addEventListener('submit', save);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    MaAdminGuard.require().then(function (session) {
      if (!session) return;
      load();
    }).catch(function () { $('smsMessage').textContent = 'Admin login প্রয়োজন।'; });
  });
})();
