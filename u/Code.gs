/* منصة جاهزية الآليات — استقبال تحديثات الجهات (Google Apps Script)
   يُلصق في مشروع Apps Script مرتبط بورقة Google ثم يُنشر كتطبيق ويب: تنفيذ باسمي، الوصول: أي شخص.
   الورقة responses تُنشأ تلقائياً. الرمز السري (للجلب الكامل من المنصة) يُحفظ في خصائص المشروع تحت TOKEN (يُضبط بتشغيل setToken مرة واحدة). */
var SHEET = "responses";
var COLS = ["ts", "week", "unitKey", "unitName", "by", "plate", "vid", "ans", "same", "noteType", "noteText", "noteDate", "faultType", "faultDesc", "faultLoc", "faultDate", "toUnit", "toDate", "reason", "use", "user", "added", "receipt", "ua"];
var MAX_ROWS = 80; /* سقف الصفوف في الإرسال الواحد */

function setToken() { /* شغّله مرة واحدة من المحرر بعد تعديل القيمتين، وانسخهما إلى إعدادات المنصة */
  var P = PropertiesService.getScriptProperties();
  P.setProperty("TOKEN", "غيّر-هذا-الرمز-السري-للجلب");          /* الرمز السري للجلب الكامل من المنصة */
  P.setProperty("UNIT_SECRET", "غيّر-هذا-السر-لروابط-الجهات");    /* السر الذي تُشتق منه مفاتيح روابط الجهات (k) */
}
/* مفتاح الجهة = أول 8 خانات من SHA-256(السر|مفتاح الجهة) — يُحسب هنا وفي المنصة بالطريقة نفسها، ولا يظهر السر في أي ملف عام */
function unitToken_(unit) {
  var sec = PropertiesService.getScriptProperties().getProperty("UNIT_SECRET") || "";
  var dig = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sec + "|" + unit, Utilities.Charset.UTF_8);
  var hex = ""; for (var i = 0; i < 4; i++) { var b = (dig[i] + 256) % 256; hex += (b < 16 ? "0" : "") + b.toString(16); }
  return hex;
}
function unitOk_(unit, k) { var sec = PropertiesService.getScriptProperties().getProperty("UNIT_SECRET") || ""; if (!sec) return true; /* قبل ضبط السر: مفتوح */ return !!unit && String(k || "") === unitToken_(unit); }
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
    if (rows.length > MAX_ROWS) return out_({ ok: false, reason: "toomany" });
    var now = new Date(); var week = weekOf_(now);
    var unitKey = String(body.unitKey || rows[0].unitKey || "").slice(0, 40);
    if (!unitOk_(unitKey, body.k)) return out_({ ok: false, reason: "key" });
    var by = String(body.by || "").slice(0, 80); if (!by) return out_({ ok: false, reason: "by" });
    var receipt = week.slice(5).replace("-", "") + "-" + unitKey.toUpperCase().slice(0, 6) + "-" + rows.length + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
    var sh = sheet_(); var ua = String((e.parameter && e.parameter.ua) || body.ua || "").slice(0, 120);
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      rows.forEach(function (r) {
        var o = { ts: now, week: week, unitKey: unitKey, unitName: body.unitName || "", by: by, receipt: receipt, ua: ua };
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
    if (p.unit) { /* آخر إجابة لكل لوحة لهذه الجهة + ما قيل إنه سُلّم إليها + هل أُرسل تحديث هذا الأسبوع */
      if (!unitOk_(p.unit, p.k)) return out_({ ok: false, reason: "key" });
      var last = {}; var incoming = {}; var wk = weekOf_(new Date()); var weekSub = null;
      R.forEach(function (r) {
        if (r.unitKey === p.unit) { if (!last[r.plate] || String(r.ts) > String(last[r.plate].ts)) last[r.plate] = r; if (r.week === wk && (!weekSub || String(r.ts) > String(weekSub.ts))) weekSub = { ts: r.ts, by: r.by, receipt: r.receipt }; }
        if (r.ans === "notours" && r.toUnit === p.unit) { if (!incoming[r.plate] || String(r.ts) > String(incoming[r.plate].ts)) incoming[r.plate] = r; }
      });
      return out_({ ok: true, week: wk, last: last, incoming: incoming, weekSub: weekSub });
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
