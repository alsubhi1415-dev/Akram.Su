/* منصة جاهزية الآليات — استقبال تحديثات الجهات (Google Apps Script)
   يُلصق في مشروع Apps Script مرتبط بورقة Google ثم يُنشر كتطبيق ويب: تنفيذ باسمي، الوصول: أي شخص.
   الورقة responses تُنشأ تلقائياً. الرمز السري (للجلب الكامل من المنصة) يُحفظ في خصائص المشروع تحت TOKEN (يُضبط بتشغيل setToken مرة واحدة). */
var SHEET = "responses";
var COLS = ["ts", "week", "unitKey", "unitName", "plate", "vid", "ans", "same", "noteType", "noteText", "noteDate", "faultType", "faultDesc", "faultLoc", "faultDate", "toUnit", "toDate", "reason", "use", "user", "added", "receipt", "ua"];

function setToken() { /* شغّله مرة واحدة من المحرر بعد تعديل القيمة */
  PropertiesService.getScriptProperties().setProperty("TOKEN", "غيّر-هذا-الرمز-ثم-انسخه-إلى-إعدادات-المنصة");
}
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function weekOf_(d) { /* الأسبوع يبدأ الأحد: تاريخ الأحد بصيغة YYYY-MM-DD بتوقيت الرياض */
  var tz = "Asia/Riyadh"; var dow = +Utilities.formatDate(d, tz, "u"); /* 1=الاثنين … 7=الأحد */
  var back = dow === 7 ? 0 : dow; var s = new Date(d.getTime() - back * 864e5);
  return Utilities.formatDate(s, tz, "yyyy-MM-dd");
}
function rows_() {
  var sh = sheet_(); var v = sh.getDataRange().getValues(); var H = v[0]; var R = [];
  for (var i = 1; i < v.length; i++) { var o = {}; for (var j = 0; j < H.length; j++) o[H[j]] = v[i][j]; if (o.ts instanceof Date) o.ts = o.ts.toISOString(); R.push(o); }
  return R;
}
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var rows = body.rows || []; if (!rows.length) return out_({ ok: false, reason: "empty" });
    var now = new Date(); var week = weekOf_(now);
    var unitKey = String(body.unitKey || rows[0].unitKey || "").slice(0, 40);
    var receipt = week.slice(5).replace("-", "") + "-" + unitKey.toUpperCase().slice(0, 6) + "-" + rows.length + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
    var sh = sheet_(); var ua = String((e.parameter && e.parameter.ua) || body.ua || "").slice(0, 120);
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      rows.forEach(function (r) {
        var o = { ts: now, week: week, unitKey: unitKey, unitName: body.unitName || "", receipt: receipt, ua: ua };
        COLS.forEach(function (c) { if (o[c] === undefined) o[c] = r[c] === undefined || r[c] === null ? "" : String(r[c]).slice(0, 300); });
        sh.appendRow(COLS.map(function (c) { return o[c]; }));
      });
    } finally { lock.releaseLock(); }
    return out_({ ok: true, receipt: receipt, n: rows.length, week: week });
  } catch (err) { return out_({ ok: false, reason: String(err) }); }
}
function doGet(e) {
  try {
    var p = e.parameter || {};
    if (p.ping) return out_({ ok: true, week: weekOf_(new Date()) });
    var R = rows_();
    if (p.unit) { /* آخر إجابة لكل لوحة لهذه الجهة + ما قيل إنه سُلّم إليها */
      var last = {}; var incoming = {};
      R.forEach(function (r) {
        if (r.unitKey === p.unit) { if (!last[r.plate] || String(r.ts) > String(last[r.plate].ts)) last[r.plate] = r; }
        if (r.ans === "notours" && r.toUnit === p.unit) { if (!incoming[r.plate] || String(r.ts) > String(incoming[r.plate].ts)) incoming[r.plate] = r; }
      });
      return out_({ ok: true, week: weekOf_(new Date()), last: last, incoming: incoming });
    }
    if (p.all) {
      var tok = PropertiesService.getScriptProperties().getProperty("TOKEN") || "";
      if (!tok || p.token !== tok) return out_({ ok: false, reason: "token" });
      var since = String(p.since || ""); var L = since ? R.filter(function (r) { return String(r.ts) > since; }) : R;
      return out_({ ok: true, week: weekOf_(new Date()), n: L.length, rows: L });
    }
    return out_({ ok: false, reason: "params" });
  } catch (err) { return out_({ ok: false, reason: String(err) }); }
}
