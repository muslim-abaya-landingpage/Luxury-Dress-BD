/**
 * একবার চালান: Online Order শীটে I–Q হেডার সেট করবে।
 * Apps Script Editor → FixSheetHeaders → Run → setupOnlineOrderHeadersNow
 */
function setupOnlineOrderHeadersNow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Online Order শীট পাওয়া যায়নি।');
    return;
  }
  var headers = getOnlineOrderExtraHeaders_();
  var headerRange = sheet.getRange(1, 9, 1, headers.length);
  headerRange.setValues([headers]);
  try {
    headerRange
      .setBackground('#f9a825')
      .setFontColor('#111111')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);
  } catch (e) {}
  SpreadsheetApp.getUi().alert('কলাম I–Q হেডার সেট সম্পন্ন।');
}
