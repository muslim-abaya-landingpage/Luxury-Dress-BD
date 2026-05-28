/**
 * শুধু এই ফাইল ADD করুন (পুরনো Code.gs মুছবেন না)
 * Apps Script → + → Script → নাম: Fix-doGet → নিচের কোড পেস্ট → Save → Deploy New version
 */
function doGet(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    if (String(p.RecordType || '') === 'AuthVerify' && p.Token) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: 'AUTH_FULL_SCRIPT_NEEDED' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {}
  return ContentService.createTextOutput('Muslim Abaya API OK').setMimeType(ContentService.MimeType.TEXT);
}
