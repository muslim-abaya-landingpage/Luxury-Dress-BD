(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { range: '30d' };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function money(value) { var n = Number(value); return isFinite(n) ? '৳' + n.toLocaleString('en-US') : '—'; }

  function renderSummary(res) {
    $('acIncome').textContent = money(res.income);
    $('acExpense').textContent = money(res.expense);
    $('acNet').textContent = money(res.net);
    $('acNet').style.color = Number(res.net) < 0 ? '#b91c1c' : '';
  }

  function renderExpenses(list) {
    $('acExpenseRows').innerHTML = list.length ? list.map(function (x) {
      return '<tr><td>' + esc(x.date) + '</td><td>' + esc(x.category) + '</td><td>' + money(x.amount) + '</td><td>' + esc(x.note || '—') + '</td><td>' + esc(x.recordedBy || '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="cm-empty">এই সময়সীমায় কোনো খরচ লেখা হয়নি।</td></tr>';
  }

  function load() {
    $('acLoadState').textContent = 'লোড হচ্ছে…';
    $('acRefresh').disabled = true;
    return MaAdmin.call('AdminAccountingSummary', { Range: state.range }).then(function (res) {
      renderSummary(res);
      renderExpenses(res.expenses || []);
      $('acLoadState').textContent = 'সর্বশেষ ডেটা লোড হয়েছে।';
    }).catch(function (err) {
      $('acLoadState').textContent = 'লোড করা যায়নি: ' + err.message;
    }).finally(function () { $('acRefresh').disabled = false; });
  }

  function saveExpense(ev) {
    ev.preventDefault();
    var date = $('acExpDate').value;
    var category = $('acExpCategory').value;
    var amount = $('acExpAmount').value;
    var note = $('acExpNote').value.trim();
    $('acExpSave').disabled = true;
    $('acExpMessage').textContent = 'সংরক্ষণ হচ্ছে…';
    MaAdmin.call('AdminExpenseSave', { Date: date, Category: category, Amount: amount, Note: note }).then(function () {
      $('acExpMessage').textContent = 'খরচ সংরক্ষিত হয়েছে।';
      $('acExpAmount').value = '';
      $('acExpNote').value = '';
      load();
    }).catch(function (err) {
      $('acExpMessage').textContent = 'সংরক্ষণ হয়নি: ' + err.message;
    }).finally(function () { $('acExpSave').disabled = false; });
  }

  function bind() {
    $('acRange').addEventListener('change', function (e) { state.range = e.target.value; load(); });
    $('acRefresh').addEventListener('click', load);
    $('acExpenseForm').addEventListener('submit', saveExpense);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    var today = new Date();
    $('acExpDate').value = today.toISOString().slice(0, 10);
    MaAdminGuard.require().then(function (session) {
      if (!session) return;
      load();
    }).catch(function () { $('acLoadState').textContent = 'Admin login প্রয়োজন।'; });
  });
})();
