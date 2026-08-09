/* ============================================================
   FD31 · الإصدار 33.0 — مساعد ذكي فائق + ثلاث أدوات مستقلة
   وحدة معزولة كلياً خارج React
   ============================================================ */
(function () {
  "use strict";
  if (window.__FD31__) return; window.__FD31__ = true;
  /* حارس بصمة GitHub: يضمن sha في أي PUT contents ويعالج 409/422 بإعادة واحدة */
  (function () {
    if (window.__fdShaFix) return; window.__fdShaFix = 1;
    var OF = window.fetch ? window.fetch.bind(window) : null;
    if (!OF) return;
    function isPut(u, o) { return o && String(o.method || "").toUpperCase() === "PUT" && u.indexOf("api.github.com") >= 0 && u.indexOf("/contents/") >= 0 && typeof o.body === "string"; }
    function getSha(u, o) {
      var gu = u.split("?")[0];
      return OF(gu, { headers: o.headers }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) { return (j && j.sha) || null; }).catch(function () { return null; });
    }
    window.fetch = function (u, o) {
      try {
        var us = String(u || "");
        if (isPut(us, o)) {
          var b = null; try { b = JSON.parse(o.body); } catch (e) { }
          if (b && typeof b.content === "string") {
            var run = Promise.resolve(null);
            if (!b.sha) run = getSha(us, o).then(function (s) { if (s) { b.sha = s; o = Object.assign({}, o, { body: JSON.stringify(b) }); } });
            return run.then(function () { return OF(u, o); }).then(function (res) {
              if (res && (res.status === 409 || res.status === 422)) {
                return getSha(us, o).then(function (s2) {
                  if (!s2 || s2 === b.sha) return res;
                  b.sha = s2;
                  return OF(u, Object.assign({}, o, { body: JSON.stringify(b) }));
                });
              }
              return res;
            });
          }
        }
      } catch (e) { }
      return OF(u, o);
    };
  })();


  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var norm = function (s) {
    return String(s == null ? "" : s)
      .replace(/[\u0640\u064B-\u0652]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .replace(/شفروليه/g, "شفرليت").replace(/شيفروليه/g, "شفرليت").replace(/دايهاتسو/g, "ديهاتسو").replace(/تليسكوب/g, "تلسكوب")
      .replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); })
      .toLowerCase().replace(/\s+/g, " ").trim();
  };

  /* ---------- التقويم الهجري ---------- */
  var HMON = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  function gToH(dt) {
    try {
      var p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(dt);
      var g = function (t) { var x = p.find(function (q) { return q.type === t; }); return x ? parseInt(x.value, 10) : 0; };
      var h = { y: g("year"), m: g("month"), d: g("day") };
      if (h.y > 1300 && h.y < 1600) return h;
    } catch (e) { }
    return null;
  }
  var H_NOW = gToH(new Date()) || { y: 1448, m: 2, d: 28 };
  function parseH(s) {
    if (!s) return null;
    var t = String(s).replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); });
    var m = t.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/) || t.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (!m) return null;
    var a = [+m[1], +m[2], +m[3]];
    var h = a[0] > 999 ? { y: a[0], m: a[1], d: a[2] } : { y: a[2], m: a[1], d: a[0] };
    if (h.y >= 1900 && h.y <= 2100) { var g = gToH(new Date(h.y, h.m - 1, h.d)); return g || null; }
    if (h.y < 1300 || h.y > 1600 || h.m < 1 || h.m > 12) return null;
    return h;
  }
  var hSer = function (h) { return h ? Math.round(h.y * 354.367 + (h.m - 1) * 29.53 + h.d) : null; };
  var SER_NOW = hSer(H_NOW);
  var fmtH = function (h) { return h ? h.y + "/" + ("0" + h.m).slice(-2) + "/" + ("0" + h.d).slice(-2) + "هـ" : "—"; };
  function serToH(s) { var y = Math.floor(s / 354.367); var r = s - y * 354.367; var m = Math.floor(r / 29.53) + 1; if (m > 12) m = 12; var d = Math.max(1, Math.round(r - (m - 1) * 29.53)); return { y: y, m: m, d: Math.min(d, 30) }; }

  /* ---------- طبقة البيانات ---------- */
  var DB = null, VEH = [];
  function normDb(j) { if (!j) return null; if (j.vehicles) return j; if (j.db && j.db.vehicles) return j.db; return null; }
  // يقرأ بيانات الأساس الحيّة نفسها: الأساس يحفظ تعديلاته غير المحفوظة في fd_pending_v1
  // وآخر حالة متزامنة في fd_mirror_v1، بينما مفتاح cdfleet::cd-fleet:db مجمّد على البذرة
  // (يُكتب مرة واحدة عند أول تحميل ولا يُحدَّث). لذا نعتمد المرآة/المعلّق (الأحدث زمنياً) أولاً،
  // ثم مفاتيح البذرة كاحتياط أخير — فيتطابق fd31 مع ما يعرضه الأساس تماماً.
  function readLocal() {
    var cands = [];
    function tryKey(k, isSeed) {
      try {
        var raw = localStorage.getItem(k); if (!raw) return;
        var o = JSON.parse(raw);
        var raw_db = (o && o.db && (o.db.vehicles || o.db.length !== undefined)) ? o.db : o;
        var db = normDb(raw_db);
        if (db && (db.vehicles || []).length) cands.push({ db: db, at: (o && o.at) || 0, seed: !!isSeed });
      } catch (e) { }
    }
    try {
      tryKey("fd_pending_v1");   // تعديلات محلية غير محفوظة (الأحدث لدى الأساس)
      tryKey("fd_mirror_v1");    // آخر حالة متزامنة (بيانات الأساس الحيّة)
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/cdfleet.*db$/.test(k) || /cd-fleet:db$/.test(k)) tryKey(k, true); // البذرة المجمّدة
      }
    } catch (e) { }
    if (!cands.length) return null;
    // غير البذرة تُفضَّل على البذرة؛ وبينها الأحدث زمنياً (at)
    cands.sort(function (a, b) {
      if (a.seed !== b.seed) return a.seed ? 1 : -1;
      return (b.at || 0) - (a.at || 0);
    });
    return cands[0].db;
  }
  // إعادة مزامنة VEH من بيانات الأساس الحيّة عند كل عرض (يلتقط تعديلات/مزامنة الأساس)
  function resyncFromBase() {
    try { var lc = readLocal(); if (lc && (lc.vehicles || []).length) { DB = lc; VEH = lc.vehicles || []; } } catch (e) { }
  }
  function loadDB(cb) {
    if (VEH.length) { cb(true); return; }
    // الأولوية: بيانات الأساس الحيّة (المرآة/المعلّق) — هي مصدر الحقيقة الذي يعرضه الأساس
    var local = readLocal();
    if (local && (local.vehicles || []).length) { DB = local; VEH = DB.vehicles || []; cb(true); return; }
    // لا مرآة بعد (تحميل أول قبل أن يزامن الأساس): جرّب data.json ثم البذرة كاحتياط أخير
    var seed = null; try { if (window.__FD31_SEED__) seed = normDb(window.__FD31_SEED__); } catch (e) { }
    var done = false, fin = function (ok) { if (done) return; done = true; cb(ok); };
    try {
      fetch("data.json?fd31=" + Date.now()).then(function (r) { return r.json(); }).then(function (j) {
        var jd = normDb(j) || normDb(j && j.db) || null;
        DB = jd || readLocal() || seed; VEH = DB ? (DB.vehicles || []) : [];
        fin(!!DB);
      }).catch(function () { DB = readLocal() || seed; VEH = DB ? (DB.vehicles || []) : []; fin(!!DB); });
    } catch (e) { DB = readLocal() || seed; VEH = DB ? (DB.vehicles || []) : []; fin(!!DB); }
    setTimeout(function () { if (!done) { var lc = readLocal() || seed; if (lc) { DB = lc; VEH = lc.vehicles || []; fin(true); } } }, 1500);
  }

  /* ---------- الحالات + مجموعاتها ---------- */
  var STATUSES = ["تعمل", "عطلانة", "تم الإصلاح", "تعمل بوجود ملاحظات", "تحت التجهيز والتسليم", "تحت إجراءات الرجيع", "صدر قرار الرجيع"];
  var UP = { "تعمل": 1, "تم الإصلاح": 1, "تعمل بوجود ملاحظات": 1 };
  var REJ = { "تحت إجراءات الرجيع": 1, "صدر قرار الرجيع": 1 };
  // مجموعات المستخدم: يعمل / متعطل / رجيع
  var GROUP = { "تعمل": "يعمل", "تعمل بوجود ملاحظات": "يعمل", "تم الإصلاح": "يعمل", "عطلانة": "متعطل", "تحت التجهيز والتسليم": "متعطل", "تحت إجراءات الرجيع": "رجيع", "صدر قرار الرجيع": "رجيع" };
  var GROUP_ORDER = ["يعمل", "متعطل", "رجيع"];
  var isActive = function (v) { return !REJ[v.status] && v.status !== "تحت التجهيز والتسليم"; };
  var openFaults = function (v) { return (v.faults || []).filter(function (f) { return !(f.repairDate || "").trim(); }); };

  /* ---------- الشُّعب الميدانية ومراكزها ---------- */
  var BRANCHES = {
    "شعبة الشاطئ": ["الشاطي", "الخالديه", "الروضه", "النهضه", "قصر السلام"],
    "شعبة الحمدانية": ["الحمدانيه", "بريمان", "الرحيلي", "الرياض", "ذهبان"],
    "شعبة العزيزية": ["العزيزيه", "الرحاب", "النسيم", "بني مالك", "الاندلس", "مشرفه"],
    "شعبة المروة": ["المروه", "النزهه", "الربوه", "الصفا", "الفيصليه", "البوادي", "التيسير"],
    "شعبة أبحر": ["ابحر", "المحمديه", "دره العروس"],
    "شعبة السالمية": ["السالميه", "النخيل", "السامر", "المنار", "السلامه"],
    "شعبة الجامعة": ["الجامعه", "الروابي", "قويزه", "المنتزهات", "الحرازات الشمالي", "الحرزات الشمالي"],
    "شعبة الصناعية": ["الصناعيه", "المرحله الاولي", "الاسواق الشعبيه", "السنابل"],
    "شعبة خزام": ["خزام", "بترومين", "الوزيريه"],
    "شعبة البغدادية": ["البغداديه", "الحمرا", "باب مكه", "الخاسكيه", "الشرفيه"],
    "شعبة الساحل الجنوبي": ["الساحل الجنوبي", "الكورنيش", "الصناعيه الثانيه", "طريق الساحل", "الخمره", "المستودعات"],
    "شعبة الاسكان": ["الاسكان الجنوبي", "الاسكان", "ام السلم", "الالفيه", "الحرزات الشرقي", "الحرازات الشرقي", "المحاميد"]
  };
  var FIELD_BRANCHES = Object.keys(BRANCHES);
  var KW = []; // [كلمة, شعبة] مرتبة بالأطول أولاً لحل التداخل
  FIELD_BRANCHES.forEach(function (b) { BRANCHES[b].forEach(function (k) { KW.push([k, b]); }); });
  KW.sort(function (a, b) { return b[0].length - a[0].length; });

  function branchOf(unit) {
    var u = norm(unit); if (!u) return null;
    if (/الدعم والاسناد/.test(u)) return "قسم الدعم والإسناد";
    if (/السلامه الميدانيه/.test(u)) return "مراكز السلامة الميدانية";
    if (/المواد الخطره/.test(u)) return "مراكز المواد الخطرة";
    if (/ثول/.test(u)) return "مركز ثول";
    if (/التموين|الشوون الفنيه|التحقيق|المراجعه|الموارد البشريه|الاداريه|ادارة العمليات|المكتب|تطوير/.test(u)) return "جهات إدارية";
    for (var i = 0; i < KW.length; i++) { if (u.indexOf(KW[i][0]) >= 0) return KW[i][1]; }
    return "أخرى: " + (unit || "").trim();
  }
  var isFieldBranch = function (b) { return FIELD_BRANCHES.indexOf(b) >= 0; };

  /* ---------- قاموس الأنواع ---------- */
  var TYPES = [
    { t: ["سلالم", "سلم", "هيدروليك"], m: ["سلالم"], name: "السلالم" },
    { t: ["مزدوج", "مزدوجه", "مزدوجات"], m: ["مزدوج"], name: "المزدوجات" },
    { t: ["وايت", "وايتات"], m: ["وايت"], name: "الوايتات" },
    { t: ["دراجه", "دراجات", "دراجه ناريه", "موتور", "موتوسكل"], m: ["دراجه"], name: "الدراجات النارية" },
    { t: ["سنوركل"], m: ["سنوركل"], name: "السنوركل" },
    { t: ["رافعه", "رافعات", "كرين"], m: ["رافعه"], name: "الرافعات" },
    { t: ["ونش", "سحب"], m: ["ونش"], name: "الونش" },
    { t: ["قلاب", "قلابات"], m: ["قلاب"], name: "القلابات" },
    { t: ["شيول", "غراف", "لودر"], m: ["شيول", "غراف"], name: "الشيول والغراف" },
    { t: ["حفار", "بوكلين"], m: ["حفار", "بوكلين"], name: "الحفارات" },
    { t: ["تنفس", "اسطوانات", "تعبئه"], m: ["تنفس", "تعبئه", "اسطوانات"], name: "آليات التنفس" },
    { t: ["محروقات", "تيدر"], m: ["محروقات", "تيدر"], name: "ناقلات المحروقات" },
    { t: ["حافله", "اتوبيس", "باص"], m: ["حافله", "اتوبيس"], name: "الحافلات" },
    { t: ["اناره", "انار", "اضاءه"], m: ["انار"], name: "سيارات الإنارة" },
    { t: ["زلازل", "زلزال", "هزات"], m: ["الزلازل"], name: "آليات الزلازل" },
    { t: ["مواد خطره", "هازمات", "كيماوي", "تطهير", "زلازل"], m: ["المواد الخطره", "التطهير", "الزلازل", "الصناعيه والمواد"], name: "آليات التدخل النوعي" },
    { t: ["صهريج", "صهاريج"], m: ["صهريج"], name: "الصهاريج" },
    { t: ["اسعاف", "اسعافات"], m: ["اسعاف"], name: "الإسعافات" },
    { t: ["انقاذ", "انقاذات"], m: ["انقاذ"], name: "آليات الإنقاذ" },
    { t: ["اطفاء", "حريق", "حرائق"], m: ["اطفاء", "حرائق"], name: "آليات الإطفاء" },
    { t: ["جيب", "جيبات"], m: ["جيب"], name: "الجيبات" },
    { t: ["ونيت", "بيك اب", "بيكاب"], m: ["ونيت", "بيك"], name: "الونيت" },
    { t: ["صالون"], m: ["صالون"], name: "الصالون" }
  ];
  function typeMatch(v, T) { var s = norm(v.type); return T.m.some(function (mm) { return s.indexOf(mm) >= 0; }); }

  function normPlate(s){ s=String(s==null?"":s); s=s.replace(/[\u0640\u064B-\u0652]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[٠-٩]/g,function(c){return "٠١٢٣٤٥٦٧٨٩".indexOf(c);}); return s.replace(/\s+/g,"").toLowerCase().trim(); }

var SPECIAL = [
    { name: "البروبلين", kws: ["بروبلين","روزنباور"], set: ["اكي1592","اكي1593","اكي1595","اكي1598","اكي8250","اكي8251","اكي8255","اكي8454","الط1977","الط1995","امب1241","امب1858","امب1859","امب1872","امب5814","امط4146","امط4147","امك4421","انب3885","انب3894","انب3896","انب3911","انط2479","انط2482","انط2483","انط2496","انط2497","انط2502","انط2503","انط2504","انع7207","انع8479","انع8482","انع8503","اهس2260","اهس6583","اهس8336","اهس8359","اهس8367","اهس8369","اهس8371","اهم1420","اهم1425","اوس7019","اوس7036","اوس7038","اوس7042","اوع4791","اوم2858","اوم2866","اوم2872","اوم2878","اوم4089","اوم7670","اوم7674","اين2709","اين2713","اين2715","اين2716","اين6642","اين6670","اين6676","باد8319","باد8343","باد8349","باد8359","باد8362","باق1436","باق1438","باق1443","باق5850","باق5860","ببا2185","ببا2192","ببا5669","بحح6276","بحق7138","بحق7141","بحل3070","بحل3085","بحل3087","بحل3138","بحل3161"] },
    { name: "المزدوجات (الكومندر)", kws: ["مزدوج","كومندر"], set: ["اعك7441","اعك7448","اعك7450","اعك7553","اعك7576","امب9496","امط4949","انب3281","انب3286","انط2401","انط2403","انط2404","انط2406","انع8552","انل1469","انل1471","انل4619","انل4628","انل4630","انو5242","انو5250","اهد1272","اهد1273","اهد1274","اهس2217","اهس2233","اهس2235","اوس7235","اوس7237","اوس7247","اوس7259","اوس7260","اوس7261","اوس7262","اوس7263","اوس7266","اوع4404","اوم2884","اوم2889","اوم2890","اوم7633","اوم7634","اوم7638","اين2762","اين2788","اين2795","اين6494","اين6503","اين6521","باد8239","باد8241","باد8252","باد8272","باق5756","باق5871","ببا5040","ببا5913","ببا5992","ببا5997","ببق2256","بدب8021","سلي226","سيط435"] },
    { name: "الآليات النوعية", kws: ["نوعيه"], set: ["اار4625","ارر9193","اصم3047","اصم3546","اصم3985","اصم3992","اعك7362","اقس6823","اقي2545","اقي2546","اقي7557","اقي7558","اكي8267","الط1122","امن7531","امن7536","اهو7367","اوم4965","باد4513","باد8473","باد8505","باق1802","بحق7103","بحق7105","بحق7112","بحق7117","بحن213","بسع2827","بصا2621","بصا2622","بمم335","حاب750","سبي705","صهط219"] },
    { name: "جيب دايهاتسو السلامة", kws: ["جيب ديهاتسو سلامه","جيب سلامه"], set: ["بقد3882","حله6939","حمح4079","حمح4337","حمح4348","حمح4415","حمح4426","حمح4433","حمح4465","حنب9060","حنب9768"] },
    { name: "الديهاتسو المسحوب", kws: ["مسحوب","ملاك جده","دايهاتسو","ديهاتسو"], set: ["حله6927","حله6934","حله6941","حله6965","حله6972","حمح4081","حمح4084","حمح4096","حمح4103","حمح4124","حمح4137","حمح4148","حمح4163","حمح4167","حمح4169","حمح4170","حمح4176","حمح4184","حمح4189","حمح4192","حمح4215","حمح4229","حمح4236","حمح4243","حمح4264","حمح4265","حمح4274","حمح4282","حمح4305","حمح4314","حمح4315","حمح4317","حمح4320","حمح4330","حمح4412","حمح4428","حمح4468","حمح4497","حمح4498","حنب9052","حنب9064","حنب9068","حنب9074","حنب9077","حنب9080"] },
    { name: "وايت المباني العالية", kws: ["مباني عاليه","المباني العاليه"], set: ["بحق7103","بحق7105","بحق7117","بسع2827"] },
    { name: "عربات الحرائق الصناعية", kws: ["حرائق صناعيه","الحرائق الصناعيه","عربات الحرائق","حريق صناعي","حرائق صناعي"], set: ["اقي2545","اقي2546","بصا2621","بصا2622"] },
    { name: "وايتات الصهاريج", kws: ["صهريج","صهاريج"], set: ["اين3851","اين3852","اين3859","اين3860","اين3866","بدق3654","بدق3659","بدق3664","بدق3669"] },
    { name: "وايت الماء (سقيا)", kws: ["وايت ماء","ماء سقيا","سقيا"], set: ["ادم2203","ادم2206","ادم2208","ادم2209","ادم2212","ادم2214","ادم2605","ادم2607","ادم2609","ادم2611","ادم2616","ادم2617","ادم2805","ادم2814","ادم2815","ادم2832","ادم3118","ادم3126","ادم3140","ادم4903","ادم4907","ادم4908","ادم4909","ادم4920","ارا7095","ارا7175","ارا7181","ارا7183","ارا7190","ارا7192","ارا7722","ارح8875","ارر6610","ارر6612","ارر6613","ارل1009","ارل1010","ارل1036","اصم3347","اصم3611","اصم3618","اصم3746","اصم3747","اصم3800","اصم3999","اقي7533","اقي7537","اقي7538","اقي7539","اقي7540","اقي7541","اقي7542","اقي7543","اين3851","اين3852","اين3859","اين3860","اين3866","بدق3654","بدق3659","بدق3664","بدق3669","حسل107","دعب499","دنل656","دنل713","رصس200","رصس605","رصس609","رصس615","سحط156","سقه393","سقه426","سقه681","سوح361","سوح661","سوح662","صكس35","صلا197","صلا596","صهم268"] },
    { name: "سيارات الإنارة", kws: ["انار","اناره","اضاءه"], set: ["اصم3133","الط1009","الط1015","الط1017","الط1018","الط6396","امب1198","امك4028","امم1074","اهم2404","باق1832","باق1840","باق1842","ببا5823"] },
    { name: "السنوركل", kws: ["سنوركل"], set: ["بمم335","حاب750"] },
    { name: "الونش والسحب", kws: ["ونش","سحب"], set: ["اعك7362","الط1122","باد4513","بحق7112"] },
    { name: "الشيول", kws: ["شيول"], set: ["احب1779","ادط6360","ادع2018","اسق2409","اسق2412"] },
    { name: "الإسعاف", kws: ["اسعاف"], set: ["احن6662","ادن5238","ادن5244","ادن5361","ادن8075","اهب4029","اهب4098","اهب4099","اهب4251","بلص9475","هدب284","وصر276","وصر7154","وعح619"] },
    { name: "السلالم", kws: ["سلالم","سلم"], set: ["اار4625","ارر9193","اصم3047","اصم3546","اكي8267","امن7531","امن7536","باد8473","باد8505","باق1802","بحن213","بمم335","حاب750","صهط219"] },
    { name: "الآليات الثقيلة", kws: ["ثقيله","ثقيل"], set: ["ااك5156","ابح6452","اسق2410","اقي7557","اقي7558","اقي7559","اكل2362"] },
    { name: "سيارات الإطفاء الكبيرة", kws: ["اطفاء كبير","اطفاء كبيره"], set: ["ابه9570","ارل2031","اصم3207","اصم3537","اصم3544","اصم3545","اصم3834","اصم3838","اصم3857","اصم3859","اصم3875","اصم3907","اصم3910","اصم3916","اصم3932","اصم3941","اصم3974","ساب513","ساط363","سدق485","سسص808"] },
    { name: "سيارات الإطفاء الصغيرة", kws: ["اطفاء صغير","اطفاء صغيره"], set: ["ارل1850","ارل1863","ارل1868","ارل1870","ارل2032","ارل2033","سسه560"] },
    { name: "الانقاذات", kws: ["انقاذات","الانقاذات","انقاذ","انقاذ مائي","انقاذ بحري","مائي","بحري"], set: ["ابم7388","ابم7397","ابم7402","ابم7403","احع3182","احع3196","احع3209","احع3212","احع3224","اصم3631","اصم3845","اعك7441","اعك7448","اعك7450","اعك7553","اعك7576","اعك7732","اعك7739","امب9496","امط4949","امن8199","امن8209","انب3281","انب3286","انط2401","انط2403","انط2404","انط2406","انط2412","انط2415","انط2419","انط2420","انع8552","انل1469","انل1471","انل4619","انل4628","انل4630","انو5242","انو5250","اهد1272","اهد1273","اهد1274","اهس2217","اهس2233","اهس2235","اوس7235","اوس7237","اوس7247","اوس7259","اوس7260","اوس7261","اوس7262","اوس7263","اوس7266","اوع4404","اوم2884","اوم2889","اوم2890","اوم7633","اوم7634","اوم7638","اين2762","اين2788","اين2795","اين6494","اين6503","اين6521","باد8239","باد8241","باد8252","باد8272","باد8440","باد8450","باد8783","باق1510","باق5756","باق5871","باق5918","ببا2174","ببا2217","ببا5040","ببا5913","ببا5992","ببا5997","ببق2256","بحي8041","بحي8048","بدب8021","دسا420","سسق249","سسق642","سلي226","سيط435","صرك285","صلع255","صلع404","صوع284"] },
    { name: "بيان 186 آلية", kws: ["بيان 186","بيان الاليات","البيان"], set: ["اار4625","ابم7397","احع3196","احع3209","احك4833","احن5467","احن6662","ادع2018","ادم2203","ادم2206","ادم2212","ادم2214","ادم2814","ادم2832","ادم3118","ادم4903","ادم4909","ادم4920","ادن5361","ادن8075","ارا7095","ارا7181","ارا7722","ارح8875","ارر6372","ارر6375","ارر9193","ارل1009","ارل1036","ارل1571","ارل1574","ارل1580","ارل1804","ارل1863","اسق2410","اصط4840","اصم3047","اصم3133","اصم3207","اصم3347","اصم3537","اصم3546","اصم3618","اصم3834","اصم3838","اصم3845","اصم3859","اصم3875","اصم3910","اصم3916","اصم3932","اصم3941","اصم3992","اطا3095","اعا9361","اعا9362","اعا9365","اعك7441","اعك7448","اعك7450","اعك7553","اعك7732","اعك7739","اقس6823","اقي2545","اقي7533","اقي7557","اقي7558","اكب4812","اكي1592","اكي1595","اكي8250","اكي8251","الط1017","الط1977","الط6396","الع1091","امب1858","امط4142","امط4146","امط4147","امط6540","امط6562","امط6567","امك4421","امن8199","امن8209","انب3281","انب3286","انب3894","اند2205","اند4774","انط2406","انط2419","انط2420","انط2479","انط2496","انط2497","انط2502","انط2504","انع7207","انع8479","انل1469","انل1471","انل6414","انل6428","انل6561","انل6579","انل6589","انو1933","انو5242","اهب4029","اهب4251","اهد1272","اهد6188","اهس2818","اهس8336","اهس8359","اهس8367","اهس8369","اهم1425","اهو7367","اوس7036","اوس7038","اوس7235","اوس7237","اوس7247","اوس7266","اوع4404","اوع4791","اوم2858","اوم2866","اوم2878","اوم2884","اوم7634","اون9695","اين3852","اين6494","اين6503","اين6521","باد8239","باد8241","باد8343","باد8450","باق1510","باق1832","باق1842","باق2303","باق5756","باق5918","بحق7103","بحق7112","بحي8041","بدب8021","بدق3669","برق2013","برق2588","بصا2622","بلص9475","بلع5075","حمح4243","حمح4415","حنب9074","حنب9077","دنل713","رصس200","رصس723","سبي705","سحط156","سقه393","صسع452","صلا596","صلع255","صيع924","عصو884","قصن865","كبص194","مني182","نيم736","هاب635","هاب647","هود189","يال48","يال930","يطل622","يمل624"] },
    { name: "المركبات الإدارية", kws: ["اداريه","اداري","مركبات اداريه"], set: ["اار7549","اار7610","اطع6677","اعا9360","اعا9361","اعا9362","اعا9363","اعا9365","اكح9352","الح9004","الح9008","الح9797","الع1060","الع1091","امط6540","امط6561","امط6562","امط6567","انل6409","انل6413","انل6414","انل6428","انل6440","انل6442","انل6448","انل6561","انل6579","انل6589","اهس2816","اهس2818","اون9695","برح4842","برح4843","برق2013","برق2086","برق2588","برك1089","برك1092","برك1095","بعص2226","بقل5954","بقل6487","بقم3231","بقم3255","بقم3263","بقم3283","بقم3402","بقم3406","بقم3410","بقم3412","بقم3822","بقم7027","بقم7190","بلط3883","بلط3933","بلع5074","بلع5075","بلع5287","بلع5289","حاص1801","حاص1839","حاص1845","حاص1931","حاص1955","حاص1965","حاص6676","حاص6683","حاص8038","حاص8140","حاص8260","حاص8294","حاص8337","حبك3857","حبك3869","حبك3872","حبك3873","حعب5575","حعب5678","حير4923","دقه2619","دقه2621","دقه2645","دقه2647","دكن1870","دكن1871","دكن1877","دكن1882","عصو884","قصن865","قصن956","قكك493","قهه205","كبص194","لمل265","مني182","مني672","مني683","مني827","نيم701","نيم736","هاب629","هاب635","هاب647","هود189","يال472","يال48","يال698","يال917","يال930","يطل276","يطل447","يطل622","يمل624"] }
  ];
  var SPECIAL_MAP = {};
  SPECIAL.forEach(function(c){ c.plateSet = {}; c.set.forEach(function(p){ c.plateSet[p]=1; }); });
  function specialMatch(v,c){ return !!c.plateSet[normPlate(v.plate)]; }
var SPECIAL2 = [
    { name: "سلم 56 متر", kws: ["سلم 56","سلالم 56","56 متر","سلم ٥٦"], set: ["اكي8267"] },
    { name: "سلم 52 متر", kws: ["سلم 52","سلالم 52","52 متر","سلم ٥٢"], set: ["اار4625","ارر9193"] },
    { name: "سلم 32 متر", kws: ["سلم 32","سلالم 32","32 متر","سلم ٣٢"], set: ["اصم3047","امن7531","امن7536","باد8473","باد8505","باق1802"] },
    { name: "سلم 28 متر", kws: ["سلم 28","سلالم 28","28 متر","سلم ٢٨"], set: ["اصم3546","صهط219"] },
    { name: "سلالم بيرس", kws: ["بيرس"], set: ["بحن213"] },
    { name: "صهريج المباني العالية", kws: ["صهريج مباني","صهريج المباني","صهريج المباني العاليه"], set: ["بحق7103","بحق7105","بحق7117","بسع2827"] },
    { name: "عربات تدخل المواد الخطرة", kws: ["تدخل المواد الخطره","عربات المواد الخطره","عربه مواد خطره","حوادث المواد الخطره","عربات التدخل المواد"], set: ["اقس6823","اهو7367","اوم4965","سبي705"] },
    { name: "عربات التدخل في الانهيارات", kws: ["انهيار","انهيارات","الانهيارات"], set: ["اصم3985","اصم3992"] },
    { name: "الرافعات", kws: ["رافعه","رافعات","كرين"], set: ["اقي7557","اقي7558"] }
  ];
  SPECIAL2.forEach(function(c){ c.plateSet = {}; c.set.forEach(function(p){ c.plateSet[p]=1; }); });
  // مرادفات المسميات النوعية (bz/Ez/Gg) للفئات القائمة
  SPECIAL.forEach(function(c){
    if (c.name === "المزدوجات (الكومندر)") c.kws = c.kws.concat(["مزدوجه روزنباور","مزدوجه مرسيدس","الكومندر"]);
    if (c.name === "الانقاذات") c.kws = c.kws.concat(["انقاذ فورد","فورد صغير","فورد كبير","جيب تدخل سريع","جيب خفيف"]);
    if (c.name === "الونش والسحب") c.kws = c.kws.concat(["8*8","ونش 8","سحب 8"]);
  });
  // معدات/فتحات نوعية تُدار كجاهزية مركز لا كنوع آلية (تُشرح ولا تُعدّ كآليات)
  var EQUIP_INFO = [
    { kws: ["التلسكوب","تلسكوب"], name: "التليسكوب", note: "بند جاهزية نوعية يُتابَع لكل مركز ضمن تكميل الآليات النوعية (ليس نوع آلية مستقلاً في السجل). أقرب الآليات: صهاريج المباني العالية والسلالم المرتفعة." },
    { kws: ["اسناد الرغاوي","الرغاوي","رغاوي"], name: "إسناد الرغاوي", note: "بند جاهزية نوعية (رغاوي الإطفاء) يُتابَع لكل مركز، لا نوع آلية مستقل." },
    { kws: ["كمامات","الكمامات","اقنعه"], name: "الكمامات", note: "معدة نوعية تُتابَع كجاهزية مركز، لا نوع آلية." },
    { kws: ["قص الخواتم","اله قص"], name: "آلة قص الخواتم", note: "معدة نوعية (إنقاذ) تُتابَع كجاهزية مركز." },
    { kws: ["مفتاح المصاعد","مصاعد"], name: "مفتاح المصاعد", note: "معدة نوعية تُتابَع كجاهزية مركز (عادي/إلكتروني)." },
    { kws: ["حزام انتشال","انتشال الحيوانات"], name: "حزام انتشال الحيوانات", note: "معدة نوعية تُتابَع كجاهزية مركز." },
    { kws: ["القوارب","قارب","زورق"], name: "القوارب", note: "جاهزية القوارب تُتابَع لكل مركز ساحلي ضمن الجاهزية النوعية، لا ضمن سجل الآليات ذي اللوحات." }
  ];
  function detectEquip(q){ for (var i=0;i<EQUIP_INFO.length;i++){ if (EQUIP_INFO[i].kws.some(function(w){return q.indexOf(w)>=0;})) return EQUIP_INFO[i]; } return null; }


  /* ---------- تحليل الحالات/المجموعات في السؤال ---------- */
  var STATUS_SYN = [
    { s: "عطلانة", re: /عطلان|متعطل|معطل|خربان|واقف|عاطل|معطله|خارج الخدمه/ },
    { s: "تم الإصلاح", re: /تم الاصلاح|مصلحه|مصلح|انصلح|تم اصلاح/ },
    { s: "تعمل بوجود ملاحظات", re: /بملاحظات|بوجود ملاحظ|فيها ملاحظ|عليها ملاحظ|ملاحظات/ },
    { s: "تحت التجهيز والتسليم", re: /تجهيز|تسليم/ },
    { s: "صدر قرار الرجيع", re: /صدر قرار|قرار الرجيع|قرار رجيع/ },
    { s: "تحت إجراءات الرجيع", re: /اجراءات الرجيع|تحت الرجيع|قيد الرجيع/ },
    { s: "تعمل", re: /^تعمل$|تعمل بلا|فعاله|سليمه|سليم/ }
  ];
  function statusesAsked(q) {
    var out = [], seen = {};
    STATUS_SYN.forEach(function (o) { if (o.re.test(q) && !seen[o.s]) { seen[o.s] = 1; out.push(o.s); } });
    return out;
  }
  function groupsAsked(q) {
    var g = [];
    if (/يعمل|الشغال|شغال|شغاله|العامل|عامل|يشتغل|الجاهز|جاهزه|تعمل/.test(q)) g.push("يعمل");
    if (/متعطل|المتعطل|معطل|عطلان|عطل|واقف|خربان|معطله/.test(q) && !/عطل ميكانيك|عطل كهرب|نوع العطل|انواع الاعطال/.test(q)) g.push("متعطل");
    if (/رجيع/.test(q)) g.push("رجيع");
    return g;
  }
  var FT_LIST = ["عطل ميكانيكي", "كهربائي", "بطاريات", "مضخات", "كفرات", "برمجة", "خلل فني", "تجديد ودهان", "حادث مروري"];

  /* ---------- المرشِّح ---------- */
  function parseQuery(q0) {
    var q = norm(q0);
    var F = { special: null, type: null, branch: null, centerKw: null, unitKw: null, model: null, plate: null, ft: null, loc: null, askWhere: false };
    for (var s2 = 0; s2 < SPECIAL2.length; s2++) { if (SPECIAL2[s2].kws.some(function (w) { return q.indexOf(w) >= 0; })) { F.special = SPECIAL2[s2]; break; } }
    if (!F.special) { for (var sp = 0; sp < SPECIAL.length; sp++) { if (SPECIAL[sp].kws.some(function (w) { return q.indexOf(w) >= 0; })) { F.special = SPECIAL[sp]; break; } } }
    if (!F.special) { for (var i = 0; i < TYPES.length; i++) { if (TYPES[i].t.some(function (w) { return q.indexOf(w) >= 0; })) { F.type = TYPES[i]; break; } } }
    if (F.special && F.special.name === "البروبلين" && /مزدوج|كومندر/.test(q)) { var mz = SPECIAL.filter(function (c) { return c.name.indexOf("المزدوجات") === 0; })[0]; if (mz) F.special = mz; }
    for (var j = 0; j < FT_LIST.length; j++) { var key = norm(FT_LIST[j]).replace("عطل ", ""); if (q.indexOf(key) >= 0 && key.length > 2) { F.ft = FT_LIST[j]; break; } }
    // جهات مستقلة بالاسم
    if (/الدعم|الاسناد/.test(q)) F.branch = "قسم الدعم والإسناد";
    else if (/السلامه الميداني/.test(q)) F.branch = "مراكز السلامة الميدانية";
    else if (/المواد الخطره|مواد خطره/.test(q)) F.branch = "مراكز المواد الخطرة";
    else if (/ثول/.test(q)) F.branch = "مركز ثول";
    // مركز محدد (يفصله عن الشعبة)
    if (/مركز/.test(q)) {
      for (var k = 0; k < KW.length; k++) { if (q.indexOf(KW[k][0]) >= 0) { F.centerKw = KW[k][0]; break; } }
    }
    // شعبة (تجميع كامل) — إن لم يُحدَّد مركز
    if (!F.branch && !F.centerKw) {
      for (var m = 0; m < KW.length; m++) { if (q.indexOf(KW[m][0]) >= 0) { F.branch = KW[m][1]; break; } }
    }
    var mc = q.match(/مركز\s+([^\s؟?.,]+(\s*\d+)?(\s*ب)?)/); if (mc && !F.centerKw) F.unitKw = mc[1].trim();
    var my = q.match(/موديل\s*(\d{4})/) || q.match(/(19\d{2}|20\d{2})/); if (my) F.model = my[1];
    var pl = q.match(/(\d{3,4})/); if (pl && !F.model) F.plate = pl[1];
    F.loc = detectLoc(q);
    if (F.loc && F.loc.name === "شركة روزنباور" && F.special && F.special.name === "البروبلين" && q.indexOf("بروبلين") < 0) F.special = null;
    F.askWhere = /اين|وين|مكانها|موقعها|مواقعها|اماكنها|فين|في اي موقع|بأي موقع/.test(q);
    F.dist = /توزيع|توزع|على الشعب|على المراكز|كل شعبه|لكل شعبه|بكل شعبه|في اي شعبه|اي شعبه فيها|حسب الشعب|بالشعب كم|في كل شعبه/.test(q);
    F.gaps = /ينقصها|تفتقر|ما فيها|ما عندها|لا يوجد فيها|بدون|تنقص|ناقص|ما عندهم|من ليس لديه|من لا يملك|تحتاج|يلزمها/.test(q);
    F.equip = detectEquip(q);
    return F;
  }
  function subjectPool(F) {
    return VEH.filter(function (v) {
      if (F.loc && !F.loc.test(v)) return false;
      if (F.special && !specialMatch(v, F.special)) return false;
      if (F.type && !typeMatch(v, F.type)) return false;
      if (F.centerKw && norm(v.unit).indexOf(F.centerKw) < 0) return false;
      if (F.branch && branchOf(v.unit) !== F.branch) return false;
      if (F.unitKw && norm(v.unit).indexOf(norm(F.unitKw)) < 0) return false;
      if (F.model && String(v.model).indexOf(F.model) < 0) return false;
      if (F.ft && !(v.faults || []).some(function (f) { return norm(f.faultType).indexOf(norm(F.ft).replace("عطل ", "")) >= 0; })) return false;
      return true;
    });
  }
  function subjLabel(F) {
    var p = [];
    if (F.special) p.push("تصنيف: " + F.special.name);
    if (F.type) p.push(F.type.name);
    if (F.ft) p.push("سجلها «" + F.ft + "»");
    if (F.centerKw) p.push("مركز " + (F.centerKw));
    else if (F.branch) p.push(F.branch);
    if (F.unitKw) p.push("مركز " + F.unitKw);
    if (F.model) p.push("موديل " + F.model);
    if (F.loc) p.push("في " + F.loc.name);
    return p.length ? p.join(" · ") : "كل الآليات";
  }

  /* ---------- بُعد الموقع (جهات الصيانة / الشُّعب) ---------- */
  function atMaintenance(v) { var L = norm(v.location); return L.indexOf("الصيانه المركزيه") >= 0 || L.indexOf("روزنباور") >= 0 || L.indexOf("ورشه") >= 0; }
  function atBranchLoc(v) { return /^شعبه/.test(norm(v.location)); }
  function detectLoc(q) {
    if (/في روزنباور|بروزنباور|عند روزنباور|لدى روزنباور|موقع روزنباور|ورشه روزنباور|ش روزنباور|صيانه روزنباور/.test(q)) return { name: "شركة روزنباور", test: function (v) { return norm(v.location).indexOf("روزنباور") >= 0; } };
    if (/الورشه الخارجيه|ورشه خارجيه|الورشه/.test(q)) return { name: "الورشة الخارجية", test: function (v) { return norm(v.location).indexOf("ورشه") >= 0; } };
    if (/الصيانه المركزيه|المركزيه/.test(q)) return { name: "الصيانة المركزية", test: function (v) { return norm(v.location).indexOf("الصيانه المركزيه") >= 0; } };
    if (/بالشعب|في الشعب|عند الشعب|لدى الشعب/.test(q)) return { name: "مواقع الشُّعب الميدانية", test: atBranchLoc };
    if (/الصيانه|بالصيانه|في الصيانه|بالورش|في الورش/.test(q)) return { name: "الصيانة (كل جهاتها)", test: atMaintenance };
    return null;
  }
  var LOC_LABELS = [
    ["الصيانة المركزية", function (v) { return norm(v.location).indexOf("الصيانه المركزيه") >= 0; }],
    ["شركة روزنباور", function (v) { return norm(v.location).indexOf("روزنباور") >= 0; }],
    ["الورشة الخارجية", function (v) { return norm(v.location).indexOf("ورشه") >= 0; }]
  ];
  function locBreakdown(pool) {
    var m = {}; pool.forEach(function (v) { var L = (v.location || "").trim() || "غير محدد"; m[L] = (m[L] || 0) + 1; });
    var arr = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    return arr;
  }
  function locBreakdownHtml(pool) {
    var arr = locBreakdown(pool);
    if (!arr.length) return "";
    return "<div style='font-size:11.5px;color:#AEC2DA;margin-top:6px;line-height:1.9'>📍 المواقع: " + arr.slice(0, 8).map(function (x) { return esc(x[0]) + " <b style='color:#DCE7F5'>" + x[1] + "</b>"; }).join(" · ") + (arr.length > 8 ? " …" : "") + "</div>";
  }


  /* ---------- الجاهزية + التبرير ---------- */
  function readinessDetail(pool) {
    var act = 0, up = 0, down = [], notes = [], rej = 0, prep = 0, rep = [];
    pool.forEach(function (v) {
      if (REJ[v.status]) { rej++; return; }
      if (v.status === "تحت التجهيز والتسليم") { prep++; return; }
      act++; if (UP[v.status]) up++;
      if (v.status === "عطلانة") down.push(v);
      else if (v.status === "تعمل بوجود ملاحظات") notes.push(v);
    });
    return { act: act, up: up, down: down, notes: notes, rej: rej, prep: prep, pct: act ? Math.round(up * 100 / act) : 0 };
  }
  function justifyHtml(pool) {
    var d = readinessDetail(pool);
    var plates = d.down.slice(0, 6).map(function (v) { return esc(v.plate || "—"); });
    var parts = [];
    parts.push("نسبة الجاهزية <b>" + d.pct + "٪</b> · إجمالي آليات الجهة " + pool.length + " · جاهزة " + d.up);
    if (d.down.length) parts.push("<span style='color:#FF9AA0'>خفضها " + d.down.length + " عطلانة</span> (لوحات: " + plates.join("، ") + (d.down.length > 6 ? " و+" + (d.down.length - 6) : "") + ")");
    else parts.push("<span style='color:#7FE0BC'>لا توجد عطلانة تخفضها</span>");
    if (d.notes.length) parts.push(d.notes.length + " بملاحظات (تُحتسب جاهزة)");
    if (d.rej || d.prep) parts.push("مستبعد: " + d.rej + " رجيع + " + d.prep + " تجهيز");
    return "<div style='font-size:11.5px;color:#AEC2DA;line-height:1.9;margin-top:6px;border-top:1px dashed rgba(255,255,255,.14);padding-top:6px'>📌 التبرير: " + parts.join(" · ") + "</div>";
  }
  function justifySay(pool) {
    var d = readinessDetail(pool);
    if (!d.down.length) return "النسبة مرتفعة بلا آليات عطلانة، بواقع " + d.up + " جاهزة من إجمالي " + pool.length + " آلية للجهة.";
    return "خفضها " + d.down.length + " آلية عطلانة، من إجمالي " + pool.length + " آلية للجهة، لوحات أبرزها " + d.down.slice(0, 3).map(function (v) { return v.plate; }).join(" و") + ".";
  }

  function groupCounts(pool) { var g = { "يعمل": 0, "متعطل": 0, "رجيع": 0 }; pool.forEach(function (v) { var k = GROUP[v.status] || "متعطل"; g[k]++; }); return g; }
  function statCounts(pool) { var C = {}; STATUSES.forEach(function (s) { C[s] = 0; }); pool.forEach(function (v) { if (C[v.status] == null) C[v.status] = 0; C[v.status]++; }); return C; }

  function vehTable(list, cap) {
    cap = cap || 40;
    var h = '<table class="fd31-table"><tr><th>اللوحة</th><th>النوع</th><th>الجهة</th><th>الحالة</th></tr>';
    list.slice(0, cap).forEach(function (v) { h += "<tr><td>" + esc(v.plate || "—") + "</td><td>" + esc(v.type) + "</td><td>" + esc(v.unit) + "</td><td>" + esc(v.status) + "</td></tr>"; });
    h += "</table>";
    if (list.length > cap) h += '<div style="font-size:11px;color:#9FB4CC;margin-top:5px">عُرض ' + cap + " من أصل " + list.length + "</div>";
    return h;
  }


  /* ---------- اشتقاق التوزيع على الشُّعب + كشف النقص (تكميل نوعي) ---------- */
  var FIELD12 = ["شعبة المروة", "شعبة العزيزية", "شعبة الشاطئ", "شعبة الجامعة", "شعبة الاسكان", "شعبة الساحل الجنوبي", "شعبة الصناعية", "شعبة السالمية", "شعبة الحمدانية", "شعبة خزام", "شعبة البغدادية", "شعبة أبحر"];
  function distributeBranches(pool) {
    var m = {}; pool.forEach(function (v) { var b = branchOf(v.unit) || "جهات أخرى"; m[b] = (m[b] || 0) + 1; });
    var arr = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    return { map: m, arr: arr };
  }
  function distGaps(pool) {
    var d = distributeBranches(pool);
    var have = FIELD12.filter(function (b) { return d.map[b]; });
    var miss = FIELD12.filter(function (b) { return !d.map[b]; });
    return { have: have, miss: miss, map: d.map };
  }
  function distHtml(pool, subjName) {
    var d = distributeBranches(pool), max = d.arr.length ? d.arr[0][1] : 1;
    var rows = d.arr.map(function (x) {
      var w = Math.round(x[1] * 100 / max);
      return "<div style='display:flex;align-items:center;gap:8px;margin:3px 0'><span style='flex:0 0 150px;font-size:12px;color:#DCE7F5'>" + esc(x[0]) + "</span><span class='fd31-bar' style='flex:1'><i style='width:" + w + "%'></i></span><b style='flex:0 0 30px;text-align:left;color:#F5D77A'>" + x[1] + "</b></div>";
    }).join("");
    var g = distGaps(pool);
    var gapLine = g.miss.length ? "<div style='font-size:11.5px;color:#FF9AA0;margin-top:7px;line-height:1.9'>🚫 شُعب ميدانية بلا «" + esc(subjName) + "»: " + g.miss.map(esc).join("، ") + "</div>" : "<div style='font-size:11.5px;color:#7FE0BC;margin-top:7px'>✅ كل الشُّعب الميدانية الـ12 لديها «" + esc(subjName) + "»</div>";
    return "<div style='margin-top:8px'>" + rows + gapLine + "</div>";
  }

  /* ============================================================
     محرك الإجابة الفائق
     ============================================================ */
  function answer(q0) {
    var q = norm(q0), F = parseQuery(q0);
    var asked = statusesAsked(q), gAsked = groupsAsked(q);

    // بند معدة نوعية (تُشرح ولا تُعدّ كآليات)
    if (F.equip && !F.special && !F.type) {
      return { say: F.equip.name + ": " + F.equip.note, html: "<div><b style='color:#F5D77A'>" + esc(F.equip.name) + "</b><div style='font-size:12.5px;color:#AEC2DA;line-height:1.9;margin-top:6px'>ℹ️ " + esc(F.equip.note) + "</div></div>" };
    }

    // اشتقاق التوزيع على الشُّعب / كشف النقص (تكميل نوعي)
    if (F.dist || F.gaps) {
      var dp = subjectPool(F), dl = subjLabel(F);
      if (gAsked.length) dp = dp.filter(function (v) { return gAsked.indexOf(GROUP[v.status]) >= 0; });
      else if (asked.length) dp = dp.filter(function (v) { return asked.indexOf(v.status) >= 0; });
      var g = distGaps(dp);
      var say = "توزيع «" + dl + "» على الشُّعب الميدانية: " + distributeBranches(dp).arr.slice(0, 4).map(function (x) { return x[0] + " " + x[1]; }).join("، ") + (g.miss.length ? "؛ ينقص: " + g.miss.slice(0, 5).join("، ") : "؛ الكل مكتمل") + ".";
      return { say: say, html: "<div><b>توزيع " + esc(dl) + " على الشُّعب الميدانية</b>" + distHtml(dp, dl) + "</div>" };
    }

    var isBranchSubj = !!(F.branch || F.centerKw);

    /* بحث بلوحة */
    if (F.plate && !F.special && !/كم|عدد|نسبه|جاهزيه|اعرض|قائمه|اعلي|اكثر|افضل|اسوا|متوسط|عمر|ترتيب/.test(q)) {
      var hit = VEH.filter(function (v) { return norm(v.plate).replace(/ /g, "").indexOf(F.plate) >= 0; });
      if (hit.length) {
        var v = hit[0], of = openFaults(v);
        return {
          say: "الآلية لوحة " + v.plate + "، " + v.type + "، حالتها " + v.status + "، وتتبع " + v.unit + ".",
          html: "<div><b style='color:#F5D77A'>" + esc(v.type) + "</b><div style='font-size:12.5px;margin-top:6px;line-height:2'>اللوحة: <b>" + esc(v.plate) + "</b> · الموديل: " + esc(v.model) + "<br>الجهة: " + esc(v.unit) + " · الشعبة: <b>" + esc(branchOf(v.unit)) + "</b><br>الموقع: " + esc(v.location) + "<br>الحالة: <b>" + esc(v.status) + "</b> (تصنيف: " + (GROUP[v.status] || "—") + ")" + (of.length ? "<br>أعطال مفتوحة: <b style='color:#FF9AA0'>" + of.length + "</b> (" + esc(of.map(function (f) { return f.faultType; }).join("، ")) + ")" : "") + "</div>" + (hit.length > 1 ? "<div style='font-size:11px;color:#9FB4CC;margin-top:5px'>+" + (hit.length - 1) + " نتيجة مشابهة</div>" : "") + "</div>"
        };
      }
    }

    /* نسبة الجاهزية (مع التبرير الإلزامي) */
    if (/جاهزيه|نسبه/.test(q) && !/اعلي|اكثر|افضل|اسوا|ترتيب/.test(q)) {
      var poolR = (F.type || isBranchSubj || F.model) ? subjectPool(F) : VEH;
      var d = readinessDetail(poolR), lbl = subjLabel(F);
      return {
        say: "نسبة جاهزية " + lbl + " " + d.pct + " بالمئة. " + justifySay(poolR),
        html: "<div>نسبة الجاهزية — <b>" + esc(lbl) + "</b><div class='big'>" + d.pct + "٪</div>" + justifyHtml(poolR) + "</div>"
      };
    }

    /* ترتيب / أعلى / أفضل الشُّعب الميدانية */
    if (/ترتيب|اعلي|اكثر|افضل|اسوا|ادني|الاقل/.test(q)) {
      var R = branchRanking();
      var wantFaults = /اعطال|تعطل/.test(q) && /اكثر|اعلي|كثر/.test(q);
      if (!wantFaults) {
        var asc = /اسوا|ادني|الاقل/.test(q);
        var arr = R.slice(); if (asc) arr = arr.slice().reverse();
        var top = arr.slice(0, 5);
        return {
          say: (asc ? "أدنى" : "أفضل") + " الشُّعب الميدانية: " + top.map(function (b, i) { return (i + 1) + " " + b.name + " جاهزية " + b.pct + " بالمئة"; }).join("، ") + ".",
          html: "<div>" + (asc ? "أدنى" : "أفضل") + " الشُّعب الميدانية (الأقل أعطالاً والأسرع إصلاحاً):" + top.map(function (b, i) { return "<div style='margin-top:7px'><b>" + (i + 1) + ". " + esc(b.name) + "</b> — جاهزية <b style='color:#7FE0BC'>" + b.pct + "٪</b> · أعطال مفتوحة " + b.open + " · متوسط الإصلاح " + (b.rep == null ? "—" : b.rep + "ي") + "<div class='fd31-bar'><i style='width:" + b.pct + "%'></i></div></div>"; }).join("") + "<div style='font-size:11px;color:#9FB4CC;margin-top:8px'>افتح أداة «ترتيب الشُّعب» للوحة الكاملة</div></div>"
        };
      }
      var arr2 = R.slice().sort(function (a, b) { return b.open - a.open; }).slice(0, 5);
      return {
        say: "أكثر الشُّعب أعطالاً مفتوحة: " + arr2.map(function (b) { return b.name + " بـ" + b.open; }).join("، ") + ".",
        html: "<div>أكثر الشُّعب الميدانية أعطالاً مفتوحة:" + arr2.map(function (b) { return "<div style='margin-top:7px'><b>" + esc(b.name) + "</b> — <b style='color:#FF9AA0'>" + b.open + "</b> عطل مفتوح · جاهزية " + b.pct + "٪</div>"; }).join("") + "</div>"
      };
    }

    /* متوسط العمر */
    if (/متوسط|عمر|اعمار/.test(q)) {
      var poolA = subjectPool(F), s = 0, n = 0;
      poolA.forEach(function (v) { var y = parseInt(v.model, 10); if (y > 1980 && y < 2100) { s += 2026 - y; n++; } });
      var avg = n ? (s / n).toFixed(1) : "—", lblA = subjLabel(F);
      return { say: "متوسط عمر " + lblA + " " + avg + " سنة.", html: "<div>متوسط العمر — " + esc(lblA) + "<div class='big'>" + avg + " سنة</div><div style='font-size:12px'>من سنة الموديل لعدد " + n + " آلية</div></div>" };
    }

    var wantList = /اعرض|قائمه|اذكر|بين لي|اطلع|وريني|اعطني/.test(q);

    /* عدّ + تصنيف بالمجموعات + تفصيل بالحالات */
    if (wantList || /كم|عدد|احص|احصائي|تصنيف/.test(q) || F.special || F.type || isBranchSubj || F.model || F.ft || asked.length || gAsked.length) {
      var pool = subjectPool(F), lbl2 = subjLabel(F);

      if (wantList) {
        var listPool = pool;
        if (asked.length) listPool = pool.filter(function (v) { return asked.indexOf(v.status) >= 0; });
        else if (gAsked.length) listPool = pool.filter(function (v) { return gAsked.indexOf(GROUP[v.status]) >= 0; });
        var head = lbl2 + (asked.length ? " (" + asked.join("، ") + ")" : (gAsked.length ? " (" + gAsked.join("، ") + ")" : ""));
        return { say: "وجدت " + listPool.length + " آلية: " + head + ".", html: "<div>القائمة — " + esc(head) + " <b style='color:#F5D77A'>(" + listPool.length + ")</b><div style='margin-top:8px;max-height:300px;overflow:auto'>" + vehTable(listPool) + "</div></div>" };
      }

      var G = groupCounts(pool), C = statCounts(pool), total = pool.length;
      var d2 = readinessDetail(pool);

      // النطق: يجيب المجموعات المطلوبة صراحة
      var sayParts = [];
      if (gAsked.length) gAsked.forEach(function (g) { sayParts.push(g + " " + G[g]); });
      else if (asked.length) asked.forEach(function (st) { sayParts.push(st + " " + (C[st] || 0)); });
      var sayHead = (F.special || F.type || isBranchSubj || F.model || F.ft) ? ("آليات " + lbl2 + " عددها " + total) : ("إجمالي الآليات " + total);
      var say = sayHead + (sayParts.length ? "، منها " + sayParts.join("، ") : "، التصنيف: يعمل " + G["يعمل"] + "، متعطل " + G["متعطل"] + "، رجيع " + G["رجيع"]) + ". نسبة الجاهزية " + d2.pct + " بالمئة.";

      // البطاقة: مجموعات كبيرة + تفصيل الحالات + تبرير الجاهزية
      var groupCard = "<div class='fd31-groups'>" + GROUP_ORDER.map(function (g) {
        var on = (gAsked.length && gAsked.indexOf(g) >= 0);
        return "<div class='fd31-gcell " + (g === "يعمل" ? "up" : g === "متعطل" ? "down" : "rej") + (on ? " on" : "") + "'><div class='gv'>" + G[g] + "</div><div class='gl'>" + g + "</div></div>";
      }).join("") + "</div>";
      var detail = "<div style='font-size:11.5px;color:#9FB4CC;margin-top:8px;line-height:1.9'>التفصيل: " + STATUSES.filter(function (s2) { return C[s2]; }).map(function (s2) { return esc(s2) + " <b style='color:#DCE7F5'>" + C[s2] + "</b>"; }).join(" · ") + "</div>";
      var rdy = "<div style='margin-top:8px;font-size:12px;color:#AEC2DA;text-align:center'>الإجمالي <b>" + total + "</b> · نسبة الجاهزية <b style='color:#7FE0BC'>" + d2.pct + "٪</b></div>";
      var just = isBranchSubj ? justifyHtml(pool) : "";
      var whereHtml = "";
      if (F.askWhere) {
        var wp = pool;
        if (gAsked.length) wp = pool.filter(function (v) { return gAsked.indexOf(GROUP[v.status]) >= 0; });
        else if (asked.length) wp = pool.filter(function (v) { return asked.indexOf(v.status) >= 0; });
        whereHtml = locBreakdownHtml(wp);
        var wl = locBreakdown(wp).slice(0, 4).map(function (x) { return x[0] + " " + x[1]; }).join("، ");
        if (wl) say += " مواقعها: " + wl + ".";
      }
      return { say: say, html: "<div><b>" + esc(lbl2) + "</b>" + groupCard + rdy + detail + just + whereHtml + "</div>" };
    }

    return {
      say: "لم أتبيّن المطلوب، جرّب صياغة أخرى.",
      html: "<div>لم أتبيّن المطلوب بدقة 🤔 — جرّب مثلاً:<div style='font-size:12.5px;line-height:2.2;margin-top:6px'>• كم سلالم تعمل وكم متعطلة؟<br>• نسبة جاهزية شعبة أبحر (مع التبرير)<br>• كم آلية في مركز الروضة؟<br>• أفضل الشُّعب الميدانية<br>• كم البروبلين وكم منها عطلانة؟<br>• أين الآلية 2362؟</div></div>"
    };
  }


  /* ============================================================
     المحرك المركّب: يفهم عدة أسئلة في رسالة واحدة (بنود)
     ============================================================ */
  var GENERIC_HEAD = /اليه|اليات|الاليات|عربه|عربات|سياره|سيارات|مركبه|مركبات|شاحنه|شاحنات|وحده|وحدات|واحده|واحد/;
  function subjOf(F) { return (F.special || F.type || F.branch || F.centerKw) ? { special: F.special, type: F.type, branch: F.branch, centerKw: F.centerKw } : null; }
  function hasSubj(F) { return !!(F.special || F.type || F.branch || F.centerKw); }

  function splitClauses(q0) {
    var q = " " + norm(q0) + " ";
    var idx = [], re = /\s(?:و\s*)?كم\s/g, m;
    while ((m = re.exec(q))) { idx.push(m.index); re.lastIndex = m.index + 1; }
    if (idx.length < 2) return null;
    var prefix = q.slice(0, idx[0]).trim();
    var parts = [];
    for (var i = 0; i < idx.length; i++) { var s = idx[i], e = (i + 1 < idx.length) ? idx[i + 1] : q.length; parts.push(q.slice(s, e).trim()); }
    return { prefix: prefix, parts: parts };
  }

  function clauseResult(rawText, prevSubj) {
    var F = parseQuery(rawText), q = norm(rawText);
    if (!hasSubj(F)) {
      var isGeneric = GENERIC_HEAD.test(q) && !/منها|منهم/.test(q);
      var wantsInherit = /منها|منهم/.test(q) || (!isGeneric && !F.loc);
      if (prevSubj && wantsInherit) { F.special = prevSubj.special; F.type = prevSubj.type; F.branch = prevSubj.branch; F.centerKw = prevSubj.centerKw; }
    }
    var pool = subjectPool(F), lbl = subjLabel(F);
    var gA = groupsAsked(rawText), aA = statusesAsked(rawText);
    var G = groupCounts(pool), C = statCounts(pool);
    var feats = [];
    if (gA.length) gA.forEach(function (g) { feats.push({ label: g, n: G[g], pool: pool.filter(function (v) { return GROUP[v.status] === g; }) }); });
    else if (aA.length) aA.forEach(function (s) { feats.push({ label: s, n: C[s] || 0, pool: pool.filter(function (v) { return v.status === s; }) }); });
    else feats.push({ label: "الإجمالي", n: pool.length, pool: pool });
    var featPool = feats.length === 1 ? feats[0].pool : pool;
    var locHtml = F.askWhere ? locBreakdownHtml(featPool) : "";
    var saySub = feats.map(function (f) { return f.label + " " + f.n; }).join("، ");
    var say = lbl + ": " + saySub + (F.askWhere ? " (المواقع: " + locBreakdown(featPool).slice(0, 3).map(function (x) { return x[0] + " " + x[1]; }).join("، ") + ")" : "");
    return { subj: subjOf(F) || prevSubj, label: lbl, feats: feats, locHtml: locHtml, say: say };
  }

  function multiAnswer(q0) {
    var sp = splitClauses(q0); if (!sp) return null;
    var prevSubj = null;
    if (sp.prefix) { var pf = parseQuery(sp.prefix); if (hasSubj(pf)) prevSubj = subjOf(pf); }
    var rows = [], says = [];
    for (var i = 0; i < sp.parts.length; i++) {
      var r = clauseResult((i === 0 && sp.prefix ? sp.prefix + " " : "") + sp.parts[i], prevSubj);
      prevSubj = r.subj || prevSubj; rows.push(r); says.push(r.say);
    }
    var html = "<div><div style='font-size:12px;color:#F5D77A;font-weight:800;margin-bottom:8px'>🧠 إجابة مركّبة (" + rows.length + " بنود)</div><div class='fd31-multi'>" +
      rows.map(function (r, i) {
        var chips = r.feats.map(function (f) {
          var cls = f.label === "يعمل" ? "up" : ((f.label === "متعطل" || f.label === "عطلانة") ? "down" : (f.label === "رجيع" ? "rej" : "neu"));
          return "<span class='mc-chip " + cls + "'><b>" + f.n + "</b> " + esc(f.label) + "</span>";
        }).join("");
        return "<div class='fd31-mc'><div class='mc-h'><span class='mc-n'>" + (i + 1) + "</span><b>" + esc(r.label) + "</b></div><div class='mc-chips'>" + chips + "</div>" + r.locHtml + "</div>";
      }).join("") + "</div></div>";
    return { say: says.join(" — "), html: html };
  }

  function answerTop(q0) { var t = null; try { t = timeAnswer(q0); } catch (e) { t = null; } if (t) return t; var m = null; try { m = multiAnswer(q0); } catch (e) { m = null; } return m || answer(q0); }

  /* ---------- إحصاء + ترتيب الشُّعب الميدانية ---------- */
  function branchStats(fieldOnly) {
    var B = {};
    VEH.forEach(function (v) {
      var b = branchOf(v.unit); if (!b) return;
      if (fieldOnly && !isFieldBranch(b)) return;
      var o = B[b] || (B[b] = { name: b, total: 0, act: 0, up: 0, down: 0, notes: 0, open: 0, faults: 0, ageSum: 0, ageN: 0, repDays: [], ft: {} });
      o.total++;
      var yr = parseInt(v.model, 10); if (yr > 1980 && yr < 2100) { o.ageSum += (2026 - yr); o.ageN++; }
      (v.faults || []).forEach(function (f) {
        o.faults++;
        var a = hSer(parseH(f.date)), b2 = hSer(parseH(f.repairDate));
        if (a && b2 && b2 >= a) o.repDays.push(b2 - a);
        if (f.faultType) o.ft[f.faultType] = (o.ft[f.faultType] || 0) + 1;
      });
      o.open += openFaults(v).length;
      if (!isActive(v)) return;
      o.act++; if (UP[v.status]) o.up++;
      if (v.status === "عطلانة") o.down++;
      if (v.status === "تعمل بوجود ملاحظات") o.notes++;
    });
    Object.keys(B).forEach(function (k) {
      var o = B[k];
      o.pct = o.act ? Math.round(o.up * 100 / o.act) : 0;
      o.age = o.ageN ? (o.ageSum / o.ageN).toFixed(1) : "—";
      o.rep = o.repDays.length ? Math.round(o.repDays.reduce(function (a, b) { return a + b; }, 0) / o.repDays.length) : null;
      o.openRate = o.total ? o.open / o.total : 0;
      var top = Object.keys(o.ft).sort(function (a, b) { return o.ft[b] - o.ft[a]; })[0];
      o.topFault = top ? (top + " (" + o.ft[top] + ")") : "—";
    });
    return B;
  }
  // ترتيب الشُّعب: أقل الأعطال + أقصر فترة إصلاح
  function branchRanking() {
    var B = branchStats(true);
    var arr = Object.keys(B).map(function (k) { return B[k]; }).filter(function (o) { return o.total >= 1; });
    var reps = arr.map(function (o) { return o.rep == null ? null : o.rep; }).filter(function (x) { return x != null; });
    var medRep = reps.length ? reps.sort(function (a, b) { return a - b; })[Math.floor(reps.length / 2)] : 30;
    var maxOR = Math.max.apply(null, arr.map(function (o) { return o.openRate; }).concat([0.0001]));
    var maxRep = Math.max.apply(null, arr.map(function (o) { return o.rep == null ? medRep : o.rep; }).concat([1]));
    arr.forEach(function (o) {
      var nOpen = o.openRate / maxOR;               // 0..1 (أقل أفضل)
      var nRep = (o.rep == null ? medRep : o.rep) / maxRep; // 0..1 (أقل أفضل)
      o.score = 0.6 * nOpen + 0.4 * nRep;           // أقل = أفضل
    });
    arr.sort(function (a, b) { return a.score - b.score || a.open - b.open || b.pct - a.pct; });
    arr.forEach(function (o, i) { o.rank = i + 1; });
    return arr;
  }

  /* ---------- طباعة رسمية (بلا اسم/رتبة) ---------- */
  function buildReportHtml(title, bodyHtml, opts) {
    opts = opts || {};
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>' +
      '@page{size:A4 ' + (opts.landscape ? "landscape" : "portrait") + ';margin:12mm}' +
      'body{font-family:"Sakkal Majalla","Traditional Arabic",Tahoma,serif;color:#111;margin:0;font-size:14px}' +
      '.doc-h{text-align:center;border-bottom:2.5px double #333;padding-bottom:8px;margin-bottom:14px}' +
      '.doc-h .o{font-size:14px;font-weight:700;line-height:1.8}.doc-h .t{font-size:20px;font-weight:900;margin-top:6px}.doc-h .d{font-size:12px;color:#444;margin-top:3px}' +
      'table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#EEE;border:1px solid #555;padding:6px;font-weight:800}td{border:1px solid #777;padding:5px 7px}' +
      '.sig{display:flex;justify-content:space-between;margin-top:30px;font-size:13px}.sig div{text-align:center;min-width:210px}.sig .ln{border-top:1.5px solid #333;margin-top:34px;padding-top:5px}' +
      '.foot{margin-top:16px;font-size:11px;color:#555;text-align:center;border-top:1px solid #999;padding-top:5px}' + (opts.css || "") +
      '</style></head><body><div class="doc-h"><div class="o">الإدارة العامة للدفاع المدني بمحافظة جدة<br>إدارة العمليات - شعبة الإطفاء والإنقاذ</div>' +
      '<div class="t">' + title + '</div><div class="d">التاريخ: ' + fmtH(H_NOW) + '</div></div>' + bodyHtml +
      '<div class="sig"><div>معد التقرير<div class="ln">&nbsp;</div></div><div>الاعتماد<div class="ln">&nbsp;</div></div></div>' +
      '<div class="foot">صدر آلياً من المنصة الرقمية لجاهزية الآليات والمراكز الميدانية · الإصدار 33.0</div></body></html>';
  }
  function printDoc(title, bodyHtml, opts) {
    var w = null; try { w = window.open("", "_blank"); } catch (e) { }
    if (!w) { alert("تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة"); return; }
    w.document.write(buildReportHtml(title, bodyHtml, opts));
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) { } }, 400);
  }
  // تصدير Word موحّد — يعيد استخدام نفس محتوى أي تقرير/بيانات
  function fd31DocExport(title, bodyHtml, opts, filename) {
    try {
      var html = buildReportHtml(title, bodyHtml, opts);
      var blob = new Blob(["\uFEFF", html], { type: "application/msword;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = String(filename || title).replace(/[\\\/:*?"<>|]/g, "_").slice(0, 80) + ".doc";
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) { } }, 600);
    } catch (e) { alert("تعذّر تصدير Word"); }
  }
  try { window.fd31DocExport = fd31DocExport; } catch (e) { }

  /* ============================================================
     الواجهة
     ============================================================ */
  function overlay(id) { var o = el("div", "fd31-ov"); o.id = id; o.innerHTML = '<i class="fd31-blob b1"></i><i class="fd31-blob b2"></i>'; document.body.appendChild(o); return o; }
  function head(icon, title, sub, onClose) { var h = el("div", "fd31-head", '<span class="ic">' + icon + '</span><div><div class="ttl">' + title + '</div><div class="sub">' + sub + '</div></div><button class="fd31-close" title="إغلاق">✕</button>'); h.querySelector(".fd31-close").onclick = onClose; return h; }
  function openOv(o) { o.classList.add("open"); }
  function closeOv(o) { o.classList.remove("open"); }

  /* ===================== المساعد الذكي (شات فقط) ===================== */
  var aiOv = null;
  function buildAI() {
    if (aiOv) return aiOv;
    aiOv = overlay("fd31-ai");
    aiOv.appendChild(head("🤖", "المساعد الذكي", "يميّز الشُّعب عن مراكزها ويجيب بالتصنيف والتبرير", function () { closeOv(aiOv); }));
    var body = el("div", "fd31-body"); aiOv.appendChild(body);
    body.innerHTML = '<div class="fd31-wrap"><div id="fd31-chat"><div id="fd31-msgs"></div>' +
      '<div id="fd31-hint">اكتب سؤالك بأي صيغة. أمثلة: <span>كم سلالم تعمل وكم متعطلة؟</span> · <span>نسبة جاهزية شعبة أبحر</span> · <span>كم آلية في مركز الروضة؟</span> · <span>كم البروبلين؟</span> · <span>أفضل الشُّعب الميدانية</span></div>' +
      '<div id="fd31-ask"><input id="fd31-q" class="fd31-input" placeholder="مثال: كم آلية تعمل وكم متعطلة في شعبة العزيزية؟">' +
      '<button id="fd31-mic" class="fd31-btn ghost" title="سؤال صوتي">🎙️</button><button id="fd31-send" class="fd31-btn gold">إرسال</button></div></div></div>';
    wireChat();
    return aiOv;
  }
  function wireChat() {
    var msgs = $("#fd31-msgs");
    function push(cls, html) { var m = el("div", "fd31-msg " + cls, html); msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m; }
    push("bot", "<div>مرحباً 👋 — أجيبك فوراً من بيانات <b style='color:#F5D77A'>" + VEH.length + "</b> آلية. أُميّز الشُّعب الميدانية عن المراكز التابعة لها، وأصنّف الحالات إلى <b>يعمل</b> و<b>متعطل</b> و<b>رجيع</b>، وأعرف <b>التصنيف الخاص</b> لصفحة التقارير (البروبلين، المزدوجات، النوعية، الديهاتسو المسحوب، بيان 186…). اسألني بأي صيغة.</div>");
    function go(qtext) {
      var qv = (qtext != null ? qtext : $("#fd31-q").value || "").trim(); if (!qv) return;
      $("#fd31-q").value = ""; push("user", esc(qv));
      setTimeout(function () { var a = answerTop(qv); push("bot", a.html); }, 180);
    }
    $("#fd31-send").onclick = function () { go(); };
    $("#fd31-q").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    $("#fd31-hint").addEventListener("click", function (e) { if (e.target.tagName === "SPAN") go(e.target.textContent.replace(/[؟?]/g, "") + "؟"); });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#fd31-mic");
    if (!SR) { mic.style.opacity = .4; mic.title = "التعرف الصوتي غير متاح بهذا المتصفح"; }
    else mic.onclick = function () { try { var r = new SR(); r.lang = "ar-SA"; r.interimResults = false; mic.classList.add("rec"); r.onresult = function (ev) { go(ev.results[0][0].transcript); }; r.onend = function () { mic.classList.remove("rec"); }; r.onerror = function () { mic.classList.remove("rec"); }; r.start(); } catch (e) { mic.classList.remove("rec"); } };
  }


  /* ===================== الصيانة الوقائية (صفحة داخل التطبيق) ===================== */
  var MAINT_LOGO = "data:image/png;base64,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";
  var MCFG_KEY = "fd31_maint_cfg";
  function mcfg() { var d = { oil: 6, bat: 12, tire: 18, full: 12 }; try { var s = JSON.parse(localStorage.getItem(MCFG_KEY) || "{}"); for (var k in d) if (+s[k] > 0) d[k] = +s[k]; } catch (e) { } return d; }
  function baselineSer(v) { var best = null; (v.faults || []).forEach(function (f) { var s = hSer(parseH(f.repairDate)); if (s && (!best || s > best)) best = s; }); if (!best) { var c = hSer(parseH(v.createdAt)); best = c || (SER_NOW - 300); } return best; }
  function maintRows() {
    var C = mcfg(), rows = [];
    VEH.forEach(function (v) {
      if (REJ[v.status]) return;
      var base = baselineSer(v), age = parseInt(v.model, 10) > 1980 ? (2026 - parseInt(v.model, 10)) : null;
      var tireM = (age != null && age > 10) ? Math.max(6, Math.round(C.tire / 2)) : C.tire;
      [["تغيير زيوت وسوائل", C.oil, "🛢️"], ["فحص وصيانة البطاريات", C.bat, "🔋"], ["فحص واستبدال الكفرات", tireM, "🛞"], ["صيانة دورية شاملة", C.full, "🧰"]].forEach(function (t) {
        var due = base + Math.round(t[1] * 29.53), diff = due - SER_NOW;
        rows.push({ v: v, task: t[0], icon: t[2], due: due, diff: diff, st: diff < 0 ? "متأخرة" : (diff <= 30 ? "قريبة" : "مجدولة") });
      });
    });
    rows.sort(function (a, b) { return a.due - b.due; });
    return rows;
  }
  function renderMaintPage(host) {
    if (!VEH.length) { host.innerHTML = '<div class="fdp-empty">جارِ تحميل البيانات…</div>'; loadDB(function () { renderMaintPage(host); }); return; }
    var C = mcfg(), rows = maintRows();
    var late = rows.filter(function (r) { return r.st === "متأخرة"; });
    var soon = rows.filter(function (r) { return r.st === "قريبة"; });
    var sched = rows.length - late.length - soon.length;
    var branches = {}; rows.forEach(function (r) { branches[branchOf(r.v.unit) || "أخرى"] = 1; });
    host.innerHTML =
      '<div class="fdp">' +
      '<div class="fdp-head"><div class="fdp-title"><span class="fdp-ic fdp-ic-img"><img src="'+MAINT_LOGO+'" alt="شعار الصيانة الوقائية"></span><div><h1>الصيانة الوقائية للآليات</h1><p>خطة استباقية تُحسب من تاريخ آخر إصلاح لكل آلية بتقويم أم القرى — الرجيع مستبعد</p></div></div></div>' +
      '<div class="fdp-kpis">' +
      '<div class="fdp-kpi red"><div class="k-ic">⏰</div><div class="k-n">' + late.length + '</div><div class="k-l">مهمة متأخرة</div></div>' +
      '<div class="fdp-kpi amber"><div class="k-ic">📅</div><div class="k-n">' + soon.length + '</div><div class="k-l">مستحقة خلال 30 يوماً</div></div>' +
      '<div class="fdp-kpi green"><div class="k-ic">✅</div><div class="k-n">' + sched + '</div><div class="k-l">مجدولة لاحقاً</div></div>' +
      '<div class="fdp-kpi blue"><div class="k-ic">🚒</div><div class="k-n">' + new Set(rows.map(function (r) { return r.v.id; })).size + '</div><div class="k-l">آلية مشمولة</div></div>' +
      '</div>' +
      '<div class="fdp-panel"><div class="fdp-panel-h"><h2>⚙️ فترات الصيانة القياسية</h2><span class="fdp-note">بالأشهر الهجرية · تُطبَّق فوراً عند التغيير</span></div>' +
      '<div class="fdp-cfg">' +
      cfgBox("oil", "🛢️", "الزيوت والسوائل", C.oil) + cfgBox("bat", "🔋", "البطاريات", C.bat) +
      cfgBox("tire", "🛞", "الكفرات", C.tire) + cfgBox("full", "🧰", "الصيانة الشاملة", C.full) +
      '</div><div class="fdp-hint">💡 الآليات الأقدم من 10 سنوات تُنصَّف فترة كفراتها تلقائياً</div></div>' +
      '<div class="fdp-panel"><div class="fdp-panel-h"><h2>📋 جدول الاستحقاق</h2>' +
      '<div class="fdp-filters"><select id="fdp-br" class="fdp-sel"><option value="">كل الجهات</option>' + Object.keys(branches).sort().map(function (b) { return '<option>' + b + '</option>'; }).join("") + '</select>' +
      '<select id="fdp-st" class="fdp-sel"><option value="">كل الحالات</option><option>متأخرة</option><option>قريبة</option><option>مجدولة</option></select>' +
      '<button id="fdp-print" class="fdp-btn">🖨️ طباعة الجدول</button><button id="fdp-word" class="fdp-btn">📄 تصدير Word</button></div></div>' +
      '<div id="fdp-tbl" class="fdp-tblwrap"></div></div></div>';
    function cfgApply() {
      var o = {}; ["oil", "bat", "tire", "full"].forEach(function (k) { o[k] = +$("#fdp-c-" + k, host).value || mcfg()[k]; });
      try { localStorage.setItem(MCFG_KEY, JSON.stringify(o)); } catch (e) { }
      renderMaintPage(host);
    }
    ["oil", "bat", "tire", "full"].forEach(function (k) { var inp = $("#fdp-c-" + k, host); if (inp) inp.onchange = cfgApply; });
    function draw() {
      var fb = $("#fdp-br", host).value, fs = $("#fdp-st", host).value;
      var list = rows.filter(function (r) { return (!fb || (branchOf(r.v.unit) || "أخرى") === fb) && (!fs || r.st === fs); });
      var h = '<table class="fdp-table"><thead><tr><th>المهمة</th><th>اللوحة</th><th>النوع</th><th>الجهة</th><th>الاستحقاق</th><th>الحالة</th></tr></thead><tbody>';
      list.slice(0, 400).forEach(function (r) {
        var cls = r.st === "متأخرة" ? "b-red" : (r.st === "قريبة" ? "b-amber" : "b-green");
        var txt = r.st === "متأخرة" ? "متأخرة " + Math.abs(r.diff) + " يوماً" : (r.st === "قريبة" ? "خلال " + r.diff + " يوماً" : "مجدولة");
        h += '<tr><td><span class="fdp-task">' + r.icon + " " + r.task + '</span></td><td class="mono">' + esc(r.v.plate || "—") + '</td><td>' + esc(r.v.type) + '</td><td class="dim">' + esc(r.v.unit) + '</td><td class="mono">' + fmtH(serToH(r.due)) + '</td><td><span class="fdp-badge ' + cls + '">' + txt + '</span></td></tr>';
      });
      h += "</tbody></table>";
      if (list.length > 400) h += '<div class="fdp-more">عُرض 400 من ' + list.length + ' مهمة</div>';
      if (!list.length) h += '<div class="fdp-empty">لا مهام مطابقة للتصفية</div>';
      $("#fdp-tbl", host).innerHTML = h;
    }
    $("#fdp-br", host).onchange = draw; $("#fdp-st", host).onchange = draw;
    function maintReportContent() {
      var fb = $("#fdp-br", host).value, fs = $("#fdp-st", host).value;
      var list = rows.filter(function (r) { return (!fb || (branchOf(r.v.unit) || "أخرى") === fb) && (!fs || r.st === fs); }).filter(function (r) { return fs || r.st !== "مجدولة"; });
      return { title: "جدول الصيانة الوقائية للآليات", body: '<div style="font-size:13px;margin-bottom:8px">' + (fb ? "الجهة: " + fb + " — " : "") + 'المهام المستحقة والمتأخرة وعددها (' + list.length + ')</div><table><tr><th style="width:26px">م</th><th>المهمة</th><th>اللوحة</th><th>النوع</th><th>الجهة</th><th>الاستحقاق</th><th>الموقف</th></tr>' + list.map(function (r, i) { return "<tr><td>" + (i + 1) + "</td><td>" + r.task + "</td><td>" + esc(r.v.plate || "—") + "</td><td>" + esc(r.v.type) + "</td><td>" + esc(r.v.unit) + "</td><td>" + fmtH(serToH(r.due)) + "</td><td>" + (r.st === "متأخرة" ? "متأخرة " + Math.abs(r.diff) + " يوماً" : r.st) + "</td></tr>"; }).join("") + "</table>" };
    }
    $("#fdp-print", host).onclick = function () { var c = maintReportContent(); printDoc(c.title, c.body, {}); };
    var _fdpw = $("#fdp-word", host); if (_fdpw) _fdpw.onclick = function () { var c = maintReportContent(); fd31DocExport(c.title, c.body, {}, c.title); };
    draw();
  }
  function cfgBox(k, ic, lbl, val) { return '<div class="fdp-cbox"><div class="cb-ic">' + ic + '</div><div class="cb-body"><label>' + lbl + '</label><div class="cb-row"><input id="fdp-c-' + k + '" class="fdp-num" type="number" min="1" value="' + val + '"><span>شهر</span></div></div></div>'; }

  /* ===================== الخط الزمني (خانة في صفحة تفاصيل الآلية) ===================== */
  function vehEvents(v) {
    var evs = [];
    evs.push({ s: hSer(parseH(v.createdAt)) || 0, t: "c", h: "دخول سجل المنصة", d: parseH(v.createdAt), x: "أُدرجت الآلية في قاعدة بيانات المنصة" });
    (v.faults || []).forEach(function (f) {
      var fs = hSer(parseH(f.date)), rs = hSer(parseH(f.repairDate));
      evs.push({ s: fs || 1, t: "f", h: "عطل: " + (f.faultType || "غير محدد"), d: parseH(f.date), x: (f.desc ? "الوصف: " + esc(f.desc) : "") + (f.causedBy ? (f.desc ? "<br>" : "") + "الجهة المتسببة: " + esc(f.causedBy) : ""), dur: (rs && fs) ? rs - fs : (fs ? SER_NOW - fs : null), open: !rs });
      if (rs) evs.push({ s: rs, t: "r", h: "إصلاح: " + (f.faultType || ""), d: parseH(f.repairDate), x: "أُغلق العطل وعادت الآلية للخدمة" });
    });
    (v.transfers || []).forEach(function (t) { evs.push({ s: hSer(parseH(t.date || t.at)) || 2, t: "t", h: "نقل بين الجهات", d: parseH(t.date || t.at), x: (t.from ? "من: " + esc(t.from) : "") + (t.to ? (t.from ? "<br>" : "") + "إلى: " + esc(t.to) : "") }); });
    (v.log || []).forEach(function (L) { evs.push({ s: hSer(parseH(L.date || L.at)) || 3, t: "t", h: "تعديل: " + esc(L.field || L.k || "بيان"), d: parseH(L.date || L.at), x: (L.old != null ? "من «" + esc(L.old) + "» " : "") + (L["new"] != null ? "إلى «" + esc(L["new"]) + "»" : "") }); });
    evs.sort(function (a, b) { return a.s - b.s; });
    return evs;
  }
  function renderVehTimeline(host, v) {
    var evs = vehEvents(v);
    var of = openFaults(v), totalFaults = (v.faults || []).length;
    var downDays = 0; (v.faults || []).forEach(function (f) { var a = hSer(parseH(f.date)), b = hSer(parseH(f.repairDate)); if (a && b && b >= a) downDays += (b - a); else if (a && !b) downDays += (SER_NOW - a); });
    host.innerHTML =
      '<div class="fdv">' +
      '<div class="fdv-h"><span class="fdv-ic">🕓</span><h2>الخط الزمني وسيرة الآلية</h2>' +
      '<button class="fdv-print" id="fdv-print">🖨️ طباعة تقرير مفصّل</button><button class="fdv-print fdv-word" id="fdv-word">📄 تصدير Word</button></div>' +
      '<div class="fdv-stats"><div class="fdv-st"><b>' + totalFaults + '</b><span>إجمالي الأعطال</span></div>' +
      '<div class="fdv-st ' + (of.length ? "warn" : "") + '"><b>' + of.length + '</b><span>أعطال مفتوحة</span></div>' +
      '<div class="fdv-st"><b>' + downDays + '</b><span>إجمالي أيام التوقف</span></div>' +
      '<div class="fdv-st"><b>' + evs.length + '</b><span>حدث مسجّل</span></div></div>' +
      '<div class="fdv-chk" id="fdv-chk">⏳ جارِ جلب آخر فحص يومي…</div>' +
      '<div class="fdv-line">' + evs.map(function (e) {
        return '<div class="fdv-ev ' + e.t + '"><div class="fdv-dot"></div><div class="fdv-card"><div class="fdv-date">' + fmtH(e.d) + '</div><div class="fdv-title">' + esc(e.h) + '</div>' + (e.x ? '<div class="fdv-desc">' + e.x + '</div>' : "") + (e.dur != null ? '<span class="fdv-dur ' + (e.open ? "open" : "") + '">' + (e.open ? "متوقفة منذ " + e.dur + " يوماً — مفتوح" : "مدة التوقف " + e.dur + " يوماً") + '</span>' : "") + '</div></div>';
      }).join("") + '</div></div>';
    $("#fdv-print", host).onclick = function () { printVehReport(v); };
    var _fdvw = $("#fdv-word", host); if (_fdvw) _fdvw.onclick = function () { wordVehReport(v); };
    try { loadVehCheckin(v); } catch (e) { }
  }
  function vehReportContent(v) {
    var evs = vehEvents(v), of = openFaults(v);
    var age = parseInt(v.model, 10) > 1980 ? (2026 - parseInt(v.model, 10)) + " سنة" : "—";
    var idRows = [["اللوحة", v.plate || "—"], ["النوع", v.type], ["الموديل", (v.model || "—") + " (العمر " + age + ")"], ["رقم الهيكل", v.chassis || "—"], ["اللون", v.color || "—"], ["الرقم التسلسلي", v.itemNo || "—"], ["الجهة", v.unit], ["الشعبة", branchOf(v.unit) || "—"], ["الموقع", v.location || "—"], ["الحالة الحالية", v.status + " (تصنيف: " + (GROUP[v.status] || "—") + ")"]];
    var idTbl = '<table><tr><th colspan="2" style="background:#DCE3F0">البطاقة التعريفية للآلية</th></tr>' + idRows.map(function (r) { return "<tr><td style='width:32%;font-weight:800;background:#F4F6FB'>" + r[0] + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>";
    var faults = (v.faults || []);
    var fTbl = '<div style="margin-top:12px;font-weight:800;font-size:13px">سجل الأعطال والإصلاحات (' + faults.length + ')</div><table><tr><th style="width:24px">م</th><th>نوع العطل</th><th>تاريخ العطل</th><th>تاريخ الإصلاح</th><th>مدة التوقف</th><th>الجهة المتسببة</th><th>الوصف</th></tr>' + (faults.length ? faults.map(function (f, i) { var a = hSer(parseH(f.date)), b = hSer(parseH(f.repairDate)); var dur = (a && b) ? (b - a) + " يوماً" : (a ? "مفتوح (" + (SER_NOW - a) + "ي)" : "—"); return "<tr><td>" + (i + 1) + "</td><td>" + esc(f.faultType || "—") + "</td><td>" + fmtH(parseH(f.date)) + "</td><td>" + (f.repairDate ? fmtH(parseH(f.repairDate)) : "<b>لم يُصلح</b>") + "</td><td>" + dur + "</td><td>" + esc(f.causedBy || "—") + "</td><td>" + esc(f.desc || "—") + "</td></tr>"; }).join("") : '<tr><td colspan="7" style="text-align:center">لا أعطال مسجّلة</td></tr>') + "</table>";
    var tl = '<div style="margin-top:12px;font-weight:800;font-size:13px">السيرة الزمنية الكاملة</div><table><tr><th style="width:24px">م</th><th style="width:110px">التاريخ</th><th style="width:70px">النوع</th><th>البيان</th></tr>' + evs.map(function (e, i) { var kind = e.t === "f" ? "عطل" : e.t === "r" ? "إصلاح" : e.t === "c" ? "تسجيل" : "حركة"; return "<tr><td>" + (i + 1) + "</td><td>" + fmtH(e.d) + "</td><td>" + kind + "</td><td>" + esc(e.h) + (e.x ? " — " + e.x.replace(/<br>/g, "، ") : "") + (e.dur != null ? " (توقف " + e.dur + " يوماً)" : "") + "</td></tr>"; }).join("") + "</table>";
    var summary = '<div style="margin-top:12px;padding:8px 12px;border:1px solid #999;background:#F4F6FB;font-size:12.5px">الخلاصة: سُجّل لهذه الآلية <b>' + faults.length + '</b> عطلاً، منها <b>' + of.length + '</b> مفتوح حالياً. حالتها الراهنة <b>' + esc(v.status) + '</b>.' + (v.notes ? ' ملاحظات: ' + esc(v.notes) : "") + '</div>';
    return { title: "تقرير مفصّل عن الآلية — " + (v.plate || v.type), body: idTbl + fTbl + tl + summary };
  }
  function printVehReport(v) { var c = vehReportContent(v); printDoc(c.title, c.body, {}); }
  function wordVehReport(v) { var c = vehReportContent(v); fd31DocExport(c.title, c.body, {}, c.title); }


  /* ============================================================
     داشبورد غرفة العمليات — عرض حيّ متحرك في صفحة المؤشرات
     ============================================================ */
  // تخطيط جغرافي تقريبي للشُّعب الـ12 في جدة (شمال↑ جنوب↓ · الساحل غرباً/يساراً)
  var OPS_POS = {
    "أبحر": [168, 46], "الشاطئ": [120, 120], "السالمية": [232, 130], "الحمدانية": [312, 118],
    "المروة": [268, 206], "العزيزية": [212, 262], "الجامعة": [320, 268], "البغدادية": [126, 268],
    "خزام": [186, 340], "الصناعية": [312, 372], "الاسكان": [214, 430], "الساحل الجنوبي": [124, 476]
  };
  function opsBranchFull() {
    return FIELD12.map(function (b) {
      var pool = VEH.filter(function (v) { return branchOf(v.unit) === b; });
      var d = readinessDetail(pool);
      var byType = {}; d.down.forEach(function (v) { var t = v.type || "غير محدد"; byType[t] = (byType[t] || 0) + 1; });
      var worst = "—", wn = 0; Object.keys(byType).forEach(function (t) { if (byType[t] > wn) { wn = byType[t]; worst = t; } });
      var nm = b.replace("شعبة ", "");
      return { name: nm, full: b, total: pool.length, act: d.act, up: d.up, pct: d.pct, down: d.down.length, notes: d.notes.length, rej: d.rej, prep: d.prep, worst: worst, worstN: wn, pos: OPS_POS[nm] || [210, 260], list: pool };
    });
  }
  function opsMapColor(pct) { return pct >= 70 ? "#2FD37F" : (pct >= 50 ? "#E8C561" : "#FF6B72"); }
  function opsMapSVG(brs) {
    var maxAct = Math.max.apply(null, brs.map(function (x) { return x.act; })) || 1;
    // ساحل + عمود طرق يوحي بامتداد المدينة
    var g = '<svg viewBox="0 0 420 540" class="ops-map-svg" preserveAspectRatio="xMidYMid meet">'
      + '<defs><linearGradient id="opsSea" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(38,120,180,.30)"/><stop offset="1" stop-color="rgba(38,120,180,0)"/></linearGradient></defs>'
      + '<rect x="0" y="0" width="86" height="540" fill="url(#opsSea)"/>'
      + '<path d="M86 0 C70 90 96 150 80 230 C64 320 96 400 78 540" fill="none" stroke="rgba(120,190,235,.55)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>'
      + '<text x="30" y="270" class="ops-sea-lbl" transform="rotate(-90 30 270)">البحر الأحمر</text>'
      + '<path d="M170 60 L210 260 L200 430" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="14" stroke-linecap="round"/>'
      + '<text x="360" y="30" class="ops-dir">شمال ↑</text><text x="360" y="524" class="ops-dir">جنوب ↓</text>';
    brs.forEach(function (x, i) {
      var c = opsMapColor(x.pct), r = 17 + Math.round(x.act / maxAct * 12), px = x.pos[0], py = x.pos[1];
      g += '<g class="ops-node" data-b="' + esc(x.name) + '" style="animation-delay:' + (i * 0.05) + 's" tabindex="0" role="button">'
        + '<circle class="ops-node-halo" cx="' + px + '" cy="' + py + '" r="' + (r + 6) + '" fill="' + c + '" opacity="0.14"/>'
        + '<circle class="ops-node-c" cx="' + px + '" cy="' + py + '" r="' + r + '" fill="' + c + '" stroke="rgba(255,255,255,.85)" stroke-width="2"/>'
        + '<text x="' + px + '" y="' + (py + 4) + '" text-anchor="middle" class="ops-node-p">' + x.pct + '</text>'
        + '<text x="' + px + '" y="' + (py + r + 14) + '" text-anchor="middle" class="ops-node-l">' + esc(x.name) + '</text>'
        + '</g>';
    });
    g += '</svg>';
    return g;
  }
  function opsFaultsByMonth(nMax) {
    var m = {};
    VEH.forEach(function (v) { (v.faults || []).forEach(function (f) { var h = parseH(f.date); if (h && h.y && h.m) { var k = h.y + "/" + ("0" + h.m).slice(-2); m[k] = (m[k] || 0) + 1; } }); });
    var keys = Object.keys(m).sort();
    return keys.slice(-(nMax || 12)).map(function (k) { return [k, m[k]]; });
  }
  function opsBranchReadiness() {
    return FIELD12.map(function (b) {
      var pool = VEH.filter(function (v) { return branchOf(v.unit) === b; });
      var d = readinessDetail(pool);
      return { b: b.replace("شعبة ", ""), act: d.act, up: d.up, pct: d.pct, down: d.down.length };
    }).sort(function (x, y) { return y.pct - x.pct; });
  }
  function arcPath(cx, cy, r, a0, a1) {
    function pt(a) { var rad = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; }
    var p0 = pt(a0), p1 = pt(a1), large = (a1 - a0) > 180 ? 1 : 0;
    return "M " + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + " A " + r + " " + r + " 0 " + large + " 1 " + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
  }
  function gaugeSVG(pct, color) {
    var a1 = 30 + pct * 3;
    return '<svg viewBox="0 0 220 214" class="ops-gauge"><path d="' + arcPath(110, 108, 86, 30, 330) + '" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="17" stroke-linecap="round"/>' +
      '<path class="ops-gauge-fill" d="' + arcPath(110, 108, 86, 30, a1) + '" fill="none" stroke="' + color + '" stroke-width="17" stroke-linecap="round" style="filter:drop-shadow(0 0 9px ' + color + ')"/>' +
      '<text x="110" y="116" text-anchor="middle" class="ops-gauge-n" data-count="' + pct + '">0</text>' +
      '<text x="110" y="146" text-anchor="middle" class="ops-gauge-l">٪ الجاهزية العامة</text></svg>';
  }
  function donutSVG(C) {
    var order = ["تعمل", "تم الإصلاح", "تعمل بوجود ملاحظات", "عطلانة", "تحت إجراءات الرجيع", "صدر قرار الرجيع", "تحت التجهيز والتسليم"];
    var col = { "تعمل": "#2FD37F", "تم الإصلاح": "#5FD3A5", "تعمل بوجود ملاحظات": "#E8C561", "عطلانة": "#FF6B72", "تحت إجراءات الرجيع": "#B79CF0", "صدر قرار الرجيع": "#8A79C8", "تحت التجهيز والتسليم": "#63C7C0" };
    var tot = 0; order.forEach(function (s) { tot += (C[s] || 0); }); tot = tot || 1;
    var a = 0, segs = "";
    order.forEach(function (s) { var v = C[s] || 0; if (!v) return; var a1 = a + v / tot * 360; segs += '<path d="' + arcPath(80, 80, 60, a, a1 - 1.2) + '" fill="none" stroke="' + col[s] + '" stroke-width="20"/>'; a = a1; });
    return '<svg viewBox="0 0 160 160" class="ops-donut">' + segs + '<text x="80" y="76" text-anchor="middle" class="ops-donut-n" data-count="' + tot + '">0</text><text x="80" y="96" text-anchor="middle" class="ops-donut-l">آلية</text></svg>';
  }
  function pulseSVG(series) {
    if (!series.length) return '<div class="ops-empty">لا بيانات أعطال مؤرّخة</div>';
    var max = Math.max.apply(null, series.map(function (x) { return x[1]; })) || 1;
    var W = 560, H = 360, n = series.length, step = n > 1 ? W / (n - 1) : W;
    var top = 42, bot = 46;
    var pts = series.map(function (x, i) { return [i * step, (H - bot) - (x[1] / max) * (H - top - bot)]; });
    var d = "M " + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L ");
    var area = d + " L " + W + " " + (H - bot + 4) + " L 0 " + (H - bot + 4) + " Z";
    var labels = series.map(function (x, i) { return '<text x="' + (i * step).toFixed(0) + '" y="' + (H - 12) + '" class="ops-pl-x">' + x[0].slice(2) + '</text>'; }).join("");
    var dots = pts.map(function (p, i) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="#FFB454" class="ops-pl-dot" style="animation-delay:' + (i * 0.06) + 's"/><text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 12).toFixed(1) + '" class="ops-pl-v">' + series[i][1] + '</text>'; }).join("");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ops-pulse" preserveAspectRatio="none"><defs><linearGradient id="opsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,180,84,.42)"/><stop offset="1" stop-color="rgba(255,180,84,0)"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#opsGrad)"/><path class="ops-pl-line" d="' + d + '" fill="none" stroke="#FFB454" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + dots + labels + '</svg>';
  }
  function kpiTile(icon, label, val, cls) {
    return '<div class="ops-kpi ' + cls + '"><div class="ops-kpi-ic">' + icon + '</div><div class="ops-kpi-n" data-count="' + val + '">0</div><div class="ops-kpi-l">' + label + '</div><i class="ops-kpi-glow"></i></div>';
  }
  function opsAnimate(host) {
    host.querySelectorAll("[data-count]").forEach(function (el) {
      var target = +el.getAttribute("data-count") || 0, i = 0, steps = 26;
      if (!target) { el.textContent = "0"; return; }
      var iv = setInterval(function () {
        i++; var p = i / steps, e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e);
        if (i >= steps) { el.textContent = target; clearInterval(iv); }
      }, 34);
    });
  }
  function opsMapIframe() { var f = document.createElement("iframe"); f.src = OPS_MAP_SRC; f.loading = "lazy"; f.setAttribute("referrerpolicy", "no-referrer-when-downgrade"); return f; }
  function opsLazyMap(host) {
    var slot = host.querySelector("#ops-map-slot"); if (!slot) return;
    function load() { if (slot.querySelector("iframe")) return; slot.innerHTML = ""; slot.appendChild(opsMapIframe()); }
    var btn = slot.querySelector(".ph-btn"); if (btn) btn.onclick = load;
    if (typeof window.IntersectionObserver === "function") {
      try { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { load(); io.disconnect(); } }); }, { rootMargin: "120px" }); io.observe(slot); } catch (e) { }
    }
  }
  var OMD_SCOL = { "تعمل": "#2FD37F", "تم الإصلاح": "#5FD3A5", "تعمل بوجود ملاحظات": "#E8C561", "عطلانة": "#FF6B72", "تحت التجهيز والتسليم": "#63C7C0", "تحت إجراءات الرجيع": "#B79CF0", "صدر قرار الرجيع": "#8A79C8" };
  /* بطاقة لمحة الجاهزية العامة — تُستخدم لملء أسفل لوحة تفاصيل الشعبة */
  function snapHTML() {
    var d = readinessDetail(VEH);
    var total = VEH.length, up = d.up, down = (d.down ? d.down.length : 0), pct = d.pct;
    var col = pct >= 70 ? "#37E0A0" : (pct >= 50 ? "#F5B301" : "#FF6B72");
    return '<div class="rs-top"><span class="rs-live"><i></i>مباشر</span><span class="rs-ttl">الجاهزية العامة للآليات</span></div>'
      + '<div class="rs-pct" style="color:' + col + '">' + pct + '<small>٪</small></div>'
      + '<div class="rs-bar"><span style="width:' + pct + '%;background:' + col + '"></span></div>'
      + '<div class="rs-nums"><span><b>' + total + '</b>الإجمالي</span><span><b style="color:#37E0A0">' + up + '</b>جاهزة</span><span><b style="color:#FF8A90">' + down + '</b>متعطلة</span></div>';
  }
  function opsMapDetail(x) {
    if (!x) return '';
    var c = opsMapColor(x.pct);
    var head = '<div class="omd-h"><span class="omd-dot" style="background:' + c + '"></span><b>شعبة ' + esc(x.name) + '</b>'
      + '<span class="omd-pctwrap"><span class="omd-pct" style="color:' + c + '">' + x.pct + '٪</span><span class="omd-pctl">نسبة الجاهزية</span></span>'
      + '<span class="omd-btns"><button class="omd-rep" data-b="' + esc(x.name) + '" title="طباعة التقرير الشامل للشعبة">🖨️ تقرير الشعبة</button><button class="omd-rep omd-repw" data-b="' + esc(x.name) + '" title="تصدير Word">📄</button></span></div>';
    var grid = '<div class="omd-grid">'
      + '<div class="omd-cell"><div class="omd-v">' + x.total + '</div><div class="omd-k">إجمالي آليات الشعبة</div></div>'
      + '<div class="omd-cell"><div class="omd-v" style="color:#5FE3A5">' + x.up + '</div><div class="omd-k">آليات جاهزة</div></div>'
      + '<div class="omd-cell"><div class="omd-v" style="color:#FF8A90">' + x.down + '</div><div class="omd-k">الآليات المتعطلة</div></div>'
      + '<div class="omd-cell"><div class="omd-v" style="color:#F0D58A">' + x.notes + '</div><div class="omd-k">آليات تعمل بوجود ملاحظات</div></div>'
      + '</div>';
    var worst = (x.down ? '<div class="omd-worst">أكثر الأنواع تعطلاً: <b>' + esc(x.worst) + '</b> (' + x.worstN + ' آلية)</div>' : '<div class="omd-worst ok">لا آليات متعطلة في هذه الشعبة ✅</div>');
    // بطاقات شبكية لكل آليات الشعبة (النوع + اللوحة + الحالة) — تملأ الفراغ بذكاء
    var list = (x.list || []).slice().sort(function (a, b) {
      var oa = (a.status === "عطلانة") ? 0 : 1, ob = (b.status === "عطلانة") ? 0 : 1; return oa - ob;
    });
    var cards = list.map(function (v) {
      var sc = OMD_SCOL[(v.status || "").trim()] || "#8A93A3";
      return '<div class="omd-veh" style="border-inline-start-color:' + sc + '">'
        + '<div class="omd-veh-t">' + esc(v.type || "—") + '</div>'
        + '<div class="omd-veh-b"><span class="omd-veh-p">' + esc(v.plate || "—") + '</span>'
        + '<span class="omd-veh-s" style="color:' + sc + '"><i style="background:' + sc + '"></i>' + esc((v.status || "—").trim()) + '</span></div>'
        + '</div>';
    }).join("");
    var vehBox = list.length ? '<div class="omd-veh-h">آليات الشعبة (' + list.length + ') — النوع · اللوحة · الحالة</div><div class="omd-veh-grid">' + cards + '</div>' : "";
    return head + grid + worst + vehBox;
  }
  var LS_COL = { "تعمل": "#1B6E42", "عطلانة": "#B3121C", "تم الإصلاح": "#1F6FB8", "تعمل بوجود ملاحظات": "#8A5D0B", "تحت التجهيز والتسليم": "#12796E", "تحت إجراءات الرجيع": "#5B4B9E", "صدر قرار الرجيع": "#5A6172" };
  function listSummary(host, list, setStatus, curStatus, base) {
    if (!host) return;
    list = list || [];
    var n = list.length;
    if (!n) { host.innerHTML = ""; return; }
    var C = statCounts(list), d = readinessDetail(list);
    base = (base && base.length) ? base : list;
    var Cbase = statCounts(base), baseN = base.length;
    var pctB = function (x) { return baseN ? Math.round(x * 100 / baseN) : 0; };
    // الجهات الظاهرة
    var bmap = {}; list.forEach(function (v) { var b = branchOf(v.unit) || "غير محدد"; bmap[b] = (bmap[b] || 0) + 1; });
    var branches = Object.keys(bmap).map(function (b) { return [b.replace("شعبة ", ""), bmap[b]]; }).sort(function (a, c) { return c[1] - a[1]; });
    // الأنواع الظاهرة
    var tset = {}; list.forEach(function (v) { if (v.type) tset[v.type] = 1; });
    var typeN = Object.keys(tset).length;
    var pct = function (x) { return n ? Math.round(x * 100 / n) : 0; };
    var clickable = (typeof setStatus === "function");
    var active = {}; if (curStatus && curStatus.length) curStatus.forEach(function (s) { active[s] = 1; });
    // عند التفعيل: اعرض كل الحالات السبع (أزرار تبديل تراكمية)؛ وإلا الموجودة فقط
    // الرقائق من القائمة قبل مرشّح الحالة: تختفي الحالات الصفرية، والأعداد/النسب ثابتة لا تتأثر باختيار حالة أخرى
    var chipStatuses = STATUSES.filter(function (s) { return Cbase[s] > 0; });
    var chips = chipStatuses.map(function (s) {
      var c = LS_COL[s] || "#5A6172", on = active[s] ? " on" : "";
      return '<button type="button" class="fdls-chip' + (clickable ? " clk" : "") + on + '" ' + (clickable ? 'data-status="' + esc(s) + '" ' : "") + 'style="border-color:' + c + (active[s] ? '' : '55') + (active[s] ? ';background:' + c + ';color:#fff' : '') + '"><i style="background:' + (active[s] ? '#fff' : c) + '"></i>' + esc(s) + ' <b>' + Cbase[s] + '</b><small' + (active[s] ? ' style="color:rgba(255,255,255,.85)"' : '') + '>' + pctB(Cbase[s]) + '٪</small></button>';
    }).join("");
    var bar = STATUSES.filter(function (s) { return C[s]; }).map(function (s) {
      return '<span style="width:' + pct(C[s]) + '%;background:' + (LS_COL[s] || "#5A6172") + '" title="' + esc(s) + ': ' + C[s] + '"></span>';
    }).join("");
    var brChips = branches.slice(0, 14).map(function (b) {
      return '<span class="fdls-br">' + esc(b[0]) + ' <b>' + b[1] + '</b></span>';
    }).join("") + (branches.length > 14 ? '<span class="fdls-br">+' + (branches.length - 14) + '</span>' : "");
    host.innerHTML =
      '<div class="fdls">' +
      '<div class="fdls-top">' +
      '<div class="fdls-count"><span class="fdls-n">' + n + '</span><span class="fdls-nl">آلية مطابقة للمرشّح</span></div>' +
      '<div class="fdls-ready"><span class="fdls-rp">' + d.pct + '٪</span><span class="fdls-rl">جاهزية المعروض</span></div>' +
      '<div class="fdls-meta"><span>' + branches.length + ' جهة</span><span>' + typeN + ' نوع</span><span>' + d.up + ' جاهزة · ' + d.down.length + ' عطلانة</span></div>' +
      '<button type="button" class="fdls-word" title="تصدير بيانات السجل المعروض إلى Word">📄 تصدير Word</button>' +
      '</div>' +
      '<div class="fdls-bar">' + bar + '</div>' +
      '<div class="fdls-chips">' + chips + '</div>' +
      (branches.length > 1 ? '<div class="fdls-brs"><span class="fdls-brs-h">الجهات الظاهرة:</span>' + brChips + '</div>' : "") +
      (clickable ? '<div class="fdls-hint">' + (curStatus && curStatus.length ? '<button type="button" class="fdls-clear">✕ مسح مرشّحات الحالة</button> ' : '') + 'اختر حالة أو أكثر (تصفية تراكمية) — تُضاف/تُزال دون التأثير على بقية المرشّحات' + '</div>' : "") +
      '</div>';
    var _wb = host.querySelector(".fdls-word");
    if (_wb) _wb.onclick = function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var C2 = statCounts(list), d2 = readinessDetail(list);
      var head = '<div style="font-size:13px;margin-bottom:6px">إجمالي الآليات المعروضة: <b>' + list.length + '</b> · نسبة الجاهزية: <b>' + d2.pct + '٪</b> · جاهزة ' + d2.up + ' · متعطلة ' + d2.down.length + ' · ' + branches.length + ' جهة · ' + typeN + ' نوع</div>';
      var statLine = '<div style="font-size:12px;margin-bottom:8px">توزيع الحالات: ' + STATUSES.filter(function (s) { return C2[s]; }).map(function (s) { return s + " (" + C2[s] + ")"; }).join(" · ") + '</div>';
      var rowsH = list.map(function (v, i) {
        var fa = (v.faults || []), op = fa.filter(function (f) { return !f.repairDate; }).length;
        return "<tr><td>" + (i + 1) + "</td><td>" + esc(v.type || "—") + "</td><td>" + esc(v.plate || "—") + "</td><td>" + esc(v.unit || "—") + "</td><td>" + esc(branchOf(v.unit) || "—") + "</td><td>" + esc(v.location || "—") + "</td><td>" + esc(v.model || "—") + "</td><td>" + esc((v.status || "—").trim()) + "</td><td>" + fa.length + "</td><td>" + op + "</td></tr>";
      }).join("");
      var tbl = '<table><tr><th style="width:26px">م</th><th>النوع</th><th>اللوحة</th><th>الجهة</th><th>الشعبة</th><th>الموقع</th><th>الموديل</th><th>الحالة</th><th>الأعطال</th><th>مفتوحة</th></tr>' + rowsH + "</table>";
      fd31DocExport("سجل الآليات — البيانات المعروضة (" + list.length + ")", head + statLine + tbl, { landscape: true }, "سجل الآليات المعروض");
    };
    if (clickable) {
      host.onclick = function (e) {
        var t = e.target;
        if (t.closest && t.closest(".fdls-word")) return;
        var clr = t.closest ? t.closest(".fdls-clear") : null;
        if (clr) { setStatus([]); return; }
        var chip = t.closest ? t.closest(".fdls-chip[data-status]") : null;
        if (!chip) return;
        var s = chip.getAttribute("data-status");
        var cur = (curStatus || []).slice();
        var idx = cur.indexOf(s);
        if (idx >= 0) cur.splice(idx, 1); else cur.push(s);
        setStatus(cur);
      };
    }
  }
  window.fdListSummary = listSummary;
  function renderOpsDash(host) {
    if (host.querySelector(".ops-wrap") || host.querySelector(".ops-ph-card")) return;
    function go() { if (!host.querySelector(".ops-wrap")) buildOpsDash(host); }
    if (typeof window.IntersectionObserver !== "function") {
      host.innerHTML = '<div class="ops-ph-card"><span class="ops-ph-ic">🛰️</span><div class="ops-ph-t">داشبورد غرفة العمليات جاهز</div><button class="ops-ph-btn" type="button">▶ عرض اللوحة الحيّة</button></div>';
      var b = host.querySelector(".ops-ph-btn"); if (b) b.onclick = go;
      return;
    }
    host.innerHTML = '<div class="ops-ph-card ops-ph-load"><span class="ops-ph-ic">🛰️</span><div class="ops-ph-t">يُحمَّل داشبورد غرفة العمليات…</div></div>';
    try { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); go(); } }); }, { rootMargin: "200px" }); io.observe(host); } catch (e) { go(); }
  }
  function buildOpsDash(host) {
    resyncFromBase(); // اقرأ بيانات الأساس الحيّة (المرآة) لحظة العرض ليتطابق المؤشر مع بقية التطبيق
    if (!VEH.length) { host.innerHTML = '<div class="ops-empty">جارِ تحميل بيانات غرفة العمليات…</div>'; loadDB(function () { if (document.getElementById("fd-ops-dash")) buildOpsDash(host); }); return; }
    var all = VEH, G = groupCounts(all), C = statCounts(all), d = readinessDetail(all);
    var maint = all.filter(atMaintenance).length;
    var br = opsBranchReadiness(), series = opsFaultsByMonth(12), brFull = opsBranchFull();
    var color = d.pct >= 70 ? "#2FD37F" : (d.pct >= 50 ? "#E8C561" : "#FF6B72");
    var now = new Date(), clock = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    var maxBr = br.length ? br[0].pct : 100;
    var medals = ["🥇", "🥈", "🥉"];
    host.innerHTML =
      '<div class="ops-wrap" id="ops-wrap">' +
      '<div class="ops-bar"><div class="ops-live"><span class="ops-dot"></span> مباشر</div>' +
      '<div class="ops-title">مؤشرات الجاهزية الفنية والآلية — الإدارة العامة للدفاع المدني بمحافظة جدة</div>' +
      '<div class="ops-clock"><span id="ops-clock">' + clock + '</span> · ' + fmtH(H_NOW) + '</div>' +
      '<button class="ops-full" id="ops-word" title="تصدير تقرير الجاهزية إلى Word">📄 تصدير Word</button>' +
      '<button class="ops-full" id="ops-full" title="عرض ملء الشاشة للجدران">⛶ شاشة كاملة</button>' +
      '<button class="ops-full" id="ops-mon" title="البيان الشهري الرسمي — طباعة">🗓️ بيان شهري</button>' +
      '<button class="ops-full" id="ops-monw" title="البيان الشهري — Word">🗓️📄</button></div>' +

      '<div class="ops-hero">' +
      '<div class="ops-card ops-glow"><div class="ops-card-h">مؤشر الجاهزية العام</div>' + gaugeSVG(d.pct, color) +
      '<div class="ops-sub">إجمالي الآليات ' + all.length + ' · جاهزة ' + d.up + '</div></div>' +
      '<div class="ops-card"><div class="ops-card-h">توزيع الحالات الفنية</div>' + donutSVG(C) +
      '<div class="ops-legend">' + [["تعمل", "#2FD37F"], ["عطلانة", "#FF6B72"], ["رجيع", "#B79CF0"]].map(function (x) { return '<span><i style="background:' + x[1] + '"></i>' + x[0] + '</span>'; }).join("") + '</div></div>' +
      '<div class="ops-kpis">' +
      kpiTile("🚒", "إجمالي الآليات", all.length, "b") +
      kpiTile("✅", "تعمل الآن", G["يعمل"], "g") +
      kpiTile("🛠️", "عطلانة", C["عطلانة"] || 0, "r") +
      kpiTile("🔧", "في الصيانة", maint, "a") +
      kpiTile("📄", "رجيع", G["رجيع"], "p") +
      kpiTile("📝", "بملاحظات", C["تعمل بوجود ملاحظات"] || 0, "y") +
      '</div></div>' +

      '<div class="ops-grid">' +
      '<div class="ops-card ops-lead"><div class="ops-card-h">🏆 جاهزية الشُّعب الميدانية — لحظياً</div><div class="ops-bars">' +
      br.map(function (x, i) {
        var c = x.pct >= 70 ? "#2FD37F" : (x.pct >= 50 ? "#E8C561" : "#FF6B72");
        return '<div class="ops-brow"><span class="ops-brk">' + (i < 3 ? medals[i] + " " : "") + esc(x.b) + '</span><span class="ops-btrack"><i style="width:' + (x.pct / (maxBr || 1) * 100) + '%;background:linear-gradient(90deg,' + c + '99,' + c + ');animation-delay:' + (i * 0.05) + 's"></i></span><b style="color:' + c + '">' + x.pct + '٪</b></div>';
      }).join("") + '</div></div>' +
      '<div class="ops-card ops-pulse-card"><div class="ops-card-h">📊 مؤشر الأعطال الشهري — آخر ' + series.length + ' أشهر هجرية</div>' + pulseSVG(series) + '</div>' +
      '</div>' +

      '<div class="ops-card ops-map"><div class="ops-card-h">🗺️ خريطة جاهزية الشعب الميدانية — تفاعلية</div>' +
      '<div class="ops-map-wrap"><div class="ops-map-svg-box">' + opsMapSVG(brFull) + '</div>' +
      '<div class="ops-map-detail" id="ops-map-detail">' + opsMapDetail(brFull[0]) + '</div></div>' +
      '<div class="ops-map-legend"><span><i style="background:#2FD37F"></i>جاهزية ≥ 70٪</span><span><i style="background:#E8C561"></i>50–69٪</span><span><i style="background:#FF6B72"></i>أقل من 50٪</span><span class="ops-map-hint">اضغط أي شعبة لعرض تفصيلها · حجم الدائرة = عدد الآليات</span></div></div>' +
      opsExtrasHtml() +
      opsMatrixHtml() +
      opsQualityHtml() +

      '</div>';
    opsAnimate(host);
    (function(){
      var box = host.querySelector(".ops-map-svg-box"), det = host.querySelector("#ops-map-detail");
      if (!box || !det) return;
      var byName = {}; brFull.forEach(function (x) { byName[x.name] = x; });
      function sel(node){ var n = node && node.getAttribute("data-b"); if (!n || !byName[n]) return; det.innerHTML = opsMapDetail(byName[n]); box.querySelectorAll(".ops-node").forEach(function(g){ g.classList.remove("on"); }); node.classList.add("on"); }
      box.addEventListener("click", function(e){ var g = e.target.closest ? e.target.closest(".ops-node") : null; if (g) sel(g); });
      box.addEventListener("keydown", function(e){ if (e.key==="Enter"||e.key===" "){ var g = e.target.closest ? e.target.closest(".ops-node") : null; if (g){ e.preventDefault(); sel(g); } } });
    })();
    var wrap = host.querySelector("#ops-wrap");
    host.querySelector("#ops-full").onclick = function () {
      wrap.classList.toggle("ops-kiosk");
      this.textContent = wrap.classList.contains("ops-kiosk") ? "✕ إغلاق العرض" : "⛶ شاشة كاملة";
    };
    var _ow = host.querySelector("#ops-word");
    if (_ow) _ow.onclick = function () {
      var kpiRows = [["إجمالي الآليات", all.length], ["تعمل الآن", G["يعمل"]], ["عطلانة", C["عطلانة"] || 0], ["في الصيانة", maint], ["رجيع", G["رجيع"]], ["تعمل بوجود ملاحظات", C["تعمل بوجود ملاحظات"] || 0]];
      var kTbl = '<table><tr><th colspan="2" style="background:#DCE3F0">الموقف العام للجاهزية</th></tr><tr><td style="width:60%;font-weight:800;background:#F4F6FB">نسبة الجاهزية العامة</td><td><b>' + d.pct + '٪</b> (' + d.up + ' جاهزة من ' + all.length + ')</td></tr>' + kpiRows.map(function (r) { return "<tr><td style='font-weight:800;background:#F4F6FB'>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</table>";
      var brRows = br.map(function (x, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.b) + "</td><td><b>" + x.pct + "٪</b></td></tr>"; }).join("");
      var brTbl = '<div style="margin-top:12px;font-weight:800;font-size:13px">جاهزية الشُّعب الميدانية (مرتّبة)</div><table><tr><th style="width:26px">م</th><th>الشعبة</th><th>نسبة الجاهزية</th></tr>' + brRows + "</table>";
      fd31DocExport("تقرير جاهزية غرفة العمليات", kTbl + brTbl, {}, "تقرير الجاهزية العام");
    };
    var _mon = host.querySelector("#ops-mon"), _monw = host.querySelector("#ops-monw");
    if (_mon) _mon.onclick = function () { var s = monthlyStatementBody(); printDoc("البيان الشهري للجاهزية والأعطال — شهر " + s.lbl, s.body, {}); };
    if (_monw) _monw.onclick = function () { var s = monthlyStatementBody(); fd31DocExport("البيان الشهري للجاهزية والأعطال — شهر " + s.lbl, s.body, {}, "البيان الشهري"); };
    host.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".omd-rep") : null;
      if (!btn) return;
      var nm = btn.getAttribute("data-b"), x = null;
      brFull.forEach(function (bb) { if (bb.name === nm) x = bb; });
      if (!x) return;
      var body = branchReportBody(x), ttl = "التقرير الشامل لشعبة " + nm;
      if (btn.classList.contains("omd-repw")) fd31DocExport(ttl, body, {}, ttl); else printDoc(ttl, body, {});
    });
    function _bindRep(pid, wid, ttl, bodyFn) {
      var p = host.querySelector(pid), w2 = host.querySelector(wid);
      if (p) p.onclick = function () { printDoc(ttl, bodyFn(), {}); };
      if (w2) w2.onclick = function () { fd31DocExport(ttl, bodyFn(), {}, ttl); };
    }
    _bindRep("#ops-mx-p", "#ops-mx-w", "\u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u0646\u0648\u0639\u064A\u0629 \u0644\u0644\u0634\u064F\u0651\u0639\u0628 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A\u0629", function () { var M = matrixData(); return matrixTable(M, true) + (M.recs.length ? '<div style="margin-top:12px;font-weight:800;font-size:13px">\u062A\u0648\u0635\u064A\u0627\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639</div><ol>' + M.recs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ol>" : ""); });
    _bindRep("#ops-rq-p", "#ops-rq-w", "\u0643\u0634\u0641 \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629 \u2014 \u062C\u0648\u062F\u0629 \u0627\u0644\u0625\u0635\u0644\u0627\u062D", function () { return repeatTable(repeatFaults()); });
    _bindRep("#ops-sla-p", "#ops-sla-w", "\u0645\u062A\u0627\u0628\u0639\u0629 \u0632\u0645\u0646 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u2014 \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u062A\u062C\u0627\u0648\u0632\u0629", slaReportBody);
    try { fillPendingReports(); } catch (e) { }
    if (host._opsClk) clearInterval(host._opsClk);
    host._opsClk = setInterval(function () { var el = document.getElementById("ops-clock"); if (!el) { clearInterval(host._opsClk); return; } var n = new Date(); el.textContent = ("0" + n.getHours()).slice(-2) + ":" + ("0" + n.getMinutes()).slice(-2); }, 30000);
  }

  /* ===================== واجهة: زر المساعد فقط + مراقب الإدماج ===================== */
  function overlay(id) { var o = el("div", "fd31-ov"); o.id = id; o.innerHTML = '<i class="fd31-blob b1"></i><i class="fd31-blob b2"></i>'; document.body.appendChild(o); return o; }
  function head(icon, title, sub, onClose) { var h = el("div", "fd31-head", '<span class="ic">' + icon + '</span><div><div class="ttl">' + title + '</div><div class="sub">' + sub + '</div></div><button class="fd31-close" title="إغلاق">✕</button>'); h.querySelector(".fd31-close").onclick = onClose; return h; }
  function openOv(o) { o.classList.add("open"); }
  function closeOv(o) { o.classList.remove("open"); }

  var aiOv = null;
  function buildAI() {
    if (aiOv) return aiOv;
    aiOv = overlay("fd31-ai");
    aiOv.appendChild(head("🤖", "المساعد الذكي", "يميّز الشُّعب عن مراكزها ويجيب بالتصنيف والتبرير", function () { closeOv(aiOv); }));
    var body = el("div", "fd31-body"); aiOv.appendChild(body);
    body.innerHTML = '<div class="fd31-wrap"><div id="fd31-chat"><div id="fd31-msgs"></div>' +
      '<div id="fd31-hint">اكتب سؤالك بأي صيغة. أمثلة: <span>كم سلالم تعمل وكم متعطلة؟</span> · <span>نسبة جاهزية شعبة أبحر</span> · <span>كم آلية في مركز الروضة؟</span> · <span>كم البروبلين؟</span> · <span>أفضل الشُّعب الميدانية</span></div>' +
      '<div id="fd31-ask"><input id="fd31-q" class="fd31-input" placeholder="مثال: كم آلية تعمل وكم متعطلة في شعبة العزيزية؟">' +
      '<button id="fd31-mic" class="fd31-btn ghost" title="سؤال صوتي">🎙️</button><button id="fd31-send" class="fd31-btn gold">إرسال</button></div></div></div>';
    wireChat();
    return aiOv;
  }
  function wireChat() {
    var msgs = $("#fd31-msgs");
    function push(cls, html) { var m = el("div", "fd31-msg " + cls, html); msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m; }
    push("bot", "<div>مرحباً 👋 — أجيبك فوراً من بيانات <b style='color:#F5D77A'>" + VEH.length + "</b> آلية. أُميّز الشُّعب الميدانية عن مراكزها، وأصنّف الحالات إلى <b>يعمل</b> و<b>متعطل</b> و<b>رجيع</b>، وأعرف <b>التصنيف الخاص</b> لصفحة التقارير (البروبلين، المزدوجات، النوعية، الديهاتسو المسحوب، بيان 186…)، وأُرفق تبريراً لكل نسبة جاهزية.</div>");
    function go(qtext) {
      var qv = (qtext != null ? qtext : $("#fd31-q").value || "").trim(); if (!qv) return;
      $("#fd31-q").value = ""; push("user", esc(qv));
      setTimeout(function () { var a = answerTop(qv); push("bot", a.html); }, 160);
    }
    $("#fd31-send").onclick = function () { go(); };
    $("#fd31-q").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    $("#fd31-hint").addEventListener("click", function (e) { if (e.target.tagName === "SPAN") go(e.target.textContent.replace(/[؟?]/g, "") + "؟"); });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $("#fd31-mic");
    if (!SR) { mic.style.opacity = .4; mic.title = "التعرف الصوتي غير متاح بهذا المتصفح"; }
    else mic.onclick = function () { try { var r = new SR(); r.lang = "ar-SA"; r.interimResults = false; mic.classList.add("rec"); r.onresult = function (ev) { go(ev.results[0][0].transcript); }; r.onend = function () { mic.classList.remove("rec"); }; r.onerror = function () { mic.classList.remove("rec"); }; r.start(); } catch (e) { mic.classList.remove("rec"); } };
  }

  var AI_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l2.2 5.3L20 8l-4.2 3.8L17 18l-5-3-5 3 1.2-6.2L4 8l5.8-.7L12 2z" fill="#3a2e08"/><circle cx="12" cy="12" r="2.2" fill="#fff"/></svg>';
  function openAI() {
    loadDB(function (ok) { buildAI(); if (!ok) { $("#fd31-msgs").innerHTML = '<div class="fd31-msg bot">تعذّر تحميل البيانات — افتح المنصة على الرابط الرسمي.</div>'; } openOv(aiOv); });
  }
  /* يضع زر المساعد داخل القائمة الجانبية أسفلها، فوق زرّي «تحميل index» و«نشر تحديث» بلا تغطية أيّهما */
  function placeRailAI() {
    var rail = document.querySelector(".side-rail"); if (!rail) return;
    var dl = null, pub = null;
    var btns = rail.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i]; if (b.id === "fd31-rail-ai") continue;
      var t = b.textContent || "";
      if (t.indexOf("تحميل index") >= 0) dl = b;
      if ((b.title || "").indexOf("نشر تحديث") >= 0) pub = b;
    }
    var anchor = dl || pub;
    var ai = document.getElementById("fd31-rail-ai");
    if (!ai) {
      ai = el("button", "fd31-rail-ai", '<span class="ric">' + AI_ICON + '</span><span class="rlb">المساعد الذكي</span>');
      ai.id = "fd31-rail-ai"; ai.title = "المساعد الذكي"; ai.type = "button";
      ai.onclick = openAI;
    }
    /* موضع صحيح: قبل زر التحميل/النشر مباشرةً */
    if (anchor) { if (ai.nextSibling !== anchor || ai.parentNode !== rail) rail.insertBefore(ai, anchor); }
    else if (ai.parentNode !== rail) rail.appendChild(ai);
    /* المساعد وحده يدفع المجموعة للأسفل؛ نُبطل دفع زرّي التحميل/النشر لئلا ينفصل عنهما */
    ai.style.marginTop = "auto";
    if (dl) dl.style.marginTop = "0";
    if (pub) pub.style.marginTop = "0";
  }

  /* مراقب الإدماج: يملأ صفحة الصيانة وخانة الخط الزمني عند ظهورهما */
  /* بطاقة لمحة الجاهزية المباشرة — تملأ فراغ القائمة الجانبية بين التبويبات وأزرار الأسفل */
  function placeRailSnap() {
    var rail = document.querySelector(".side-rail"); if (!rail) return;
    if (!VEH.length) { return; }
    var ai = document.getElementById("fd31-rail-ai");
    var d = readinessDetail(VEH);
    var total = VEH.length, up = d.up, down = (d.down ? d.down.length : 0), pct = d.pct;
    var col = pct >= 70 ? "#37E0A0" : (pct >= 50 ? "#F5B301" : "#FF6B72");
    var html = '<div class="rs-top"><span class="rs-live"><i></i>مباشر</span><span class="rs-ttl">جاهزية الآليات</span></div>'
      + '<div class="rs-pct" style="color:' + col + '">' + pct + '<small>٪</small></div>'
      + '<div class="rs-bar"><span style="width:' + pct + '%;background:' + col + '"></span></div>'
      + '<div class="rs-nums"><span><b>' + total + '</b>الإجمالي</span><span><b style="color:#37E0A0">' + up + '</b>جاهزة</span><span><b style="color:#FF8A90">' + down + '</b>متعطلة</span></div>';
    var snap = document.getElementById("fd31-rail-snap");
    if (!snap) { snap = el("div", "fd31-rail-snap", html); snap.id = "fd31-rail-snap"; }
    else if (snap.getAttribute("data-sig") !== (pct + "/" + total + "/" + up + "/" + down)) { snap.innerHTML = html; }
    snap.setAttribute("data-sig", pct + "/" + total + "/" + up + "/" + down);
    /* بعد آخر تبويب وقبل زر المساعد (الذي يدفع مجموعة الأسفل للقاع) */
    if (ai && ai.parentNode === rail) { if (snap.nextSibling !== ai || snap.parentNode !== rail) rail.insertBefore(snap, ai); }
    else if (snap.parentNode !== rail) rail.appendChild(snap);
  }
  function fillMounts() {
    placeRailAI();
    var mp = document.getElementById("fd-maint-page");
    if (mp && !mp.querySelector(".fdp")) { loadDB(function () { if (document.getElementById("fd-maint-page")) renderMaintPage(mp); }); }
    var od = document.getElementById("fd-ops-dash");
    if (od && !od.querySelector(".ops-wrap")) { loadDB(function () { if (document.getElementById("fd-ops-dash")) renderOpsDash(od); }); }
    var vm = document.getElementById("fd-veh-mount");
    if (vm) {
      var vid = vm.getAttribute("data-vid");
      if (vid && vm.getAttribute("data-done") !== vid) {
        loadDB(function () {
          var mount = document.getElementById("fd-veh-mount"); if (!mount) return;
          var v = VEH.filter(function (x) { return String(x.id) === String(vid); })[0];
          if (v) { mount.setAttribute("data-done", vid); renderVehTimeline(mount, v); }
        });
      }
    }
  }
  /* ============================================================
     الجولة الترحيبية — تصميم البطاقة البيضاء السلس (٤ شرائح)، تظهر بعد شاشة الاستهلال لأول زيارة
     ============================================================ */
  var WT_KEY = "fd31_welcome_v1";
  // أيقونة كل شريحة (46px): الأولى إيموجي ترحيب، والبقية أيقونات خطّية بلون الدفاع المدني الأحمر
  function wtIcon(k){
    if (k === 0) return '<span class="fdwt-emoji">\uD83D\uDC4B</span>';
    var svg = function(p){ return '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#B3121C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; };
    if (k === 1) return svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>');            // سجل الآليات
    if (k === 2) return svg('<path d="M22 12A10 10 0 1 1 12 2"/><path d="M12 12l4-4"/><path d="M3 20h5v-5"/><path d="M16 20h5v-4"/>'); // الجاهزية والعمليات
    return svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'); // التقارير
  }
  function wtSlides(){
    return [
      { icon:0, title:"\u0623\u0647\u0644\u0627\u064B \u0628\u0643 \u0641\u064A \u0633\u062C\u0644 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0622\u0644\u064A\u0627\u062A",
        desc:"\u0645\u0646\u0638\u0648\u0645\u0629 \u0631\u0642\u0645\u064A\u0629 \u062D\u064A\u0629 \u0644\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u0645\u062F\u0646\u064A \u0628\u0645\u062D\u0627\u0641\u0638\u0629 \u062C\u062F\u0629 \u2014 \u062A\u0633\u062A\u0639\u0631\u0636 \u0643\u0644 \u0634\u064A\u0621 \u0628\u0634\u0641\u0627\u0641\u064A\u0629 \u0643\u0627\u0645\u0644\u0629." },
      { icon:1, title:"\u0633\u062C\u0644 \u0627\u0644\u0622\u0644\u064A\u0627\u062A",
        desc:"\u0633\u062C\u0644 \u0643\u0627\u0645\u0644 \u0628\u0643\u0644 \u0622\u0644\u064A\u0629: \u0627\u0644\u062D\u0627\u0644\u0629\u060C \u0627\u0644\u0645\u0648\u0642\u0639\u060C \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0648\u062A\u0648\u0627\u0631\u064A\u062E\u0647\u0627\u060C \u0648\u062E\u0637 \u0632\u0645\u0646\u064A \u0644\u0643\u0644 \u0622\u0644\u064A\u0629." },
      { icon:2, title:"\u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A",
        desc:"\u062A\u063A\u0637\u064A\u0629 \u0627\u0644\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A\u0629 \u0644\u062D\u0638\u064A\u0627\u064B\u060C \u0648\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062D\u0648\u0627\u062F\u062B \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0628\u0645\u0624\u0634\u0631\u0627\u062A\u0647\u0627." },
      { icon:3, title:"\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0631\u0633\u0645\u064A\u0629",
        desc:"\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A\u060C \u062A\u0643\u0645\u064A\u0644 \u0627\u0644\u0622\u0644\u064A\u0627\u062A \u0627\u0644\u0646\u0648\u0639\u064A\u060C \u0648\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0634\u0627\u0645\u0644 \u2014 \u062A\u064F\u0628\u0646\u0649 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u064A\u0629." }
    ];
  }
  function startWelcomeTour(){
    if (document.querySelector(".fdwt-ov")) return;
    var slides = wtSlides(), idx = 0;
    var ov = document.createElement("div"); ov.className = "fdwt-ov";
    var dots = slides.map(function(_, i){ return '<span class="fdwt-dot'+(i===0?' on':'')+'"></span>'; }).join("");
    ov.innerHTML =
      '<div class="fdwt-card" role="dialog" aria-modal="true" aria-label="\u0627\u0644\u062C\u0648\u0644\u0629 \u0627\u0644\u062A\u0631\u062D\u064A\u0628\u064A\u0629">'
      + '<div class="fdwt-ic"></div>'
      + '<div class="fdwt-title"></div>'
      + '<div class="fdwt-desc"></div>'
      + '<div class="fdwt-dots">'+dots+'</div>'
      + '<div class="fdwt-nav">'
      +   '<button class="fdwt-skip">\u062A\u062E\u0637\u064A</button>'
      +   '<button class="fdwt-next"></button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    var elIc=ov.querySelector(".fdwt-ic"), elT=ov.querySelector(".fdwt-title"), elD=ov.querySelector(".fdwt-desc");
    var elDots=Array.prototype.slice.call(ov.querySelectorAll(".fdwt-dot")), elNext=ov.querySelector(".fdwt-next");
    function render(){
      var sl=slides[idx];
      // تلاشٍ لطيف للمحتوى عند التنقّل (سلاسة)
      var stage=ov.querySelector(".fdwt-card");
      elIc.innerHTML=wtIcon(sl.icon); elT.textContent=sl.title; elD.textContent=sl.desc;
      elIc.classList.remove("fdwt-fade"); elT.classList.remove("fdwt-fade"); elD.classList.remove("fdwt-fade");
      void elIc.offsetWidth;
      elIc.classList.add("fdwt-fade"); elT.classList.add("fdwt-fade"); elD.classList.add("fdwt-fade");
      elDots.forEach(function(d,i){ d.classList.toggle("on", i===idx); });
      elNext.innerHTML = idx < slides.length-1 ? "\u0627\u0644\u062A\u0627\u0644\u064A \u2190" : "\u0627\u0628\u062F\u0623 \u0627\u0644\u0627\u0633\u062A\u0639\u0631\u0627\u0636 \uD83D\uDE80";
    }
    function close(){
      ov.classList.remove("fdwt-in");
      try{ localStorage.setItem(WT_KEY,"1"); }catch(e){}
      document.removeEventListener("keydown", onKey);
      setTimeout(function(){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); }, 420);
    }
    function next(){ idx < slides.length-1 ? (idx++, render()) : close(); }
    function onKey(e){ if(e.key==="Escape") close(); else if(e.key==="Enter"||e.key==="ArrowLeft") next(); }
    elNext.addEventListener("click", next);
    ov.querySelector(".fdwt-skip").addEventListener("click", close);
    elDots.forEach(function(d,i){ d.addEventListener("click", function(){ idx=i; render(); }); });
    document.addEventListener("keydown", onKey);
    render();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ ov.classList.add("fdwt-in"); }); });
  }
  try { window.fd31Tour = function(){ try{ startWelcomeTour(); }catch(e){} }; } catch(e){}

  // ---- انتظار انتهاء شاشة الاستهلال ثم عرض الجولة لأول زيارة ----
  function wtSplashGone(){
    var sp = document.querySelector(".splash-scr");
    if (!sp) return true;
    var cn = sp.className || "";
    if (/splash-out/.test(cn)) return true;
    var st = null; try { st = window.getComputedStyle(sp); } catch(e){}
    if (st && (st.visibility === "hidden" || parseFloat(st.opacity) === 0 || st.display === "none")) return true;
    return false;
  }
  function initWelcomeTour(){
    try { if (localStorage.getItem(WT_KEY)) return; } catch(e){ return; }
    if (initWelcomeTour._on) return; initWelcomeTour._on = true;
    var tries = 0, sawSplash = false;
    (function chk(){
      tries++;
      var sp = document.querySelector(".splash-scr");
      // شاشة الاستهلال ظاهرة فعلاً (لم تبدأ الاختفاء بعد)
      if (sp && !/splash-out/.test(sp.className)) sawSplash = true;
      var gone = wtSplashGone();
      // انتظرنا ظهور الاستهلال ثم اختفاءه → اعرض الجولة بعد اكتمال التلاشي
      if (sawSplash && gone){
        setTimeout(function(){ try{ startWelcomeTour(); }catch(e){} }, 640);
        return;
      }
      // لم يظهر استهلال إطلاقاً خلال ~3.5s (ربما مُعطّل) → اعرض بأمان
      if (!sawSplash && tries > 24){ try{ startWelcomeTour(); }catch(e){} return; }
      // احتياط نهائي ~11s
      if (tries > 74){ try{ startWelcomeTour(); }catch(e){} return; }
      setTimeout(chk, 150);
    })();
  }


  /* ============================================================
     دفعة 25: قيد المتابعة + مقارنة الفترات + البيان الشهري
     + تقرير الشعبة الشامل + آخر فحص يومي + الأسئلة الزمنية
     ============================================================ */
  var RAW_URL = "https://raw.githubusercontent.com/alsubhi1415-dev/Akram.Su/main/";
  function fetchRaw(file, cb) {
    try {
      fetch(RAW_URL + file + "?t=" + Date.now()).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) {
        var j = null; if (t) { try { j = JSON.parse(t); } catch (e) { } } cb(j);
      }).catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }
  function monthSerRange(off) {
    var y = H_NOW.y, m = H_NOW.m + (off || 0);
    while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
    return [hSer({ y: y, m: m, d: 1 }), hSer({ y: y, m: m, d: 30 }), y, m];
  }
  function mLabel(y, m) { return ("0" + m).slice(-2) + "/" + y + "\u0647\u0640"; }
  function faultsInRange(pool, a, b, useRepair) {
    var out = [];
    pool.forEach(function (v) {
      (v.faults || []).forEach(function (f) {
        var s = hSer(parseH(useRepair ? f.repairDate : f.date));
        if (s && s >= a && s <= b) out.push({ v: v, f: f, s: s });
      });
    });
    return out;
  }
  function followupData() {
    var long = [];
    VEH.forEach(function (v) {
      if (v.status !== "\u0639\u0637\u0644\u0627\u0646\u0629") return;
      var worst = null;
      (v.faults || []).forEach(function (f) { if ((f.repairDate || "").trim()) return; var s = hSer(parseH(f.date)); if (s && (!worst || s < worst)) worst = s; });
      if (worst) { var dd = SER_NOW - worst; if (dd >= 30) long.push({ v: v, d: dd }); }
    });
    long.sort(function (a, b) { return b.d - a.d; });
    var late = maintRows().filter(function (r) { return r.st === "\u0645\u062A\u0623\u062E\u0631\u0629"; });
    return { long: long, late: late };
  }
  function opsExtrasHtml() {
    var fu = followupData();
    var longRows = fu.long.slice(0, 5).map(function (x) {
      return '<div class="ops-fu-row"><span>' + esc(x.v.type || "\u2014") + ' \u2014 ' + esc(x.v.plate || "") + '</span><b style="color:#FF8A90">' + x.d + ' \u064A\u0648\u0645\u0627\u064B</b></div>';
    }).join("") || '<div class="ops-fu-row ok">\u0644\u0627 \u0622\u0644\u064A\u0627\u062A \u0645\u062A\u0648\u0642\u0641\u0629 \u2265 30 \u064A\u0648\u0645\u0627\u064B \u2705</div>';
    var lateRows = fu.late.slice(0, 3).map(function (r) {
      return '<div class="ops-fu-row"><span>' + r.icon + ' ' + esc(r.task) + ' \u2014 ' + esc(r.v.plate || "") + '</span><b style="color:#E8C561">' + Math.abs(r.diff) + ' \u064A\u0648\u0645\u0627\u064B</b></div>';
    }).join("");
    var fuCard =
      '<div class="ops-card"><div class="ops-card-h">\uD83D\uDCCC \u0642\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629</div>' +
      '<div class="ops-fu-chips">' +
      '<span class="ops-fu-chip r">\u0645\u062A\u0648\u0642\u0641\u0629 \u2265 30 \u064A\u0648\u0645\u0627\u064B <b>' + fu.long.length + '</b></span>' +
      '<span class="ops-fu-chip y">\u0635\u064A\u0627\u0646\u0629 \u0645\u062A\u0623\u062E\u0631\u0629 <b>' + fu.late.length + '</b></span>' +
      '<span class="ops-fu-chip b" id="ops-fu-rep">\u0628\u0644\u0627\u063A\u0627\u062A \u0645\u0639\u0644\u0651\u0642\u0629 <b>\u2026</b></span>' +
      '</div>' +
      '<div class="ops-fu-sec">\u0623\u0637\u0648\u0644 \u0627\u0644\u0622\u0644\u064A\u0627\u062A \u062A\u0648\u0642\u0641\u0627\u064B</div>' + longRows +
      (lateRows ? '<div class="ops-fu-sec">\u0623\u0642\u0631\u0628 \u0645\u0647\u0627\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629</div>' + lateRows : '') +
      '</div>';
    var r1 = monthSerRange(0), r0 = monthSerRange(-1);
    var nf1 = faultsInRange(VEH, r1[0], r1[1]).length, nf0 = faultsInRange(VEH, r0[0], r0[1]).length;
    var nr1 = faultsInRange(VEH, r1[0], r1[1], true).length, nr0 = faultsInRange(VEH, r0[0], r0[1], true).length;
    function arrow(cur, prev, goodUp) {
      if (cur === prev) return '<span class="ops-ar s">\u25C6 \u062B\u0627\u0628\u062A</span>';
      var up = cur > prev, good = (up === goodUp);
      return '<span class="ops-ar ' + (good ? "g" : "r") + '">' + (up ? "\u25B2" : "\u25BC") + " " + (prev ? Math.abs(Math.round((cur - prev) / prev * 100)) + "\u066A" : "\u2014") + '</span>';
    }
    var trend = (nf1 < nf0 && nr1 >= nr0) ? '<span class="ops-ar g">\u25B2 \u062A\u062A\u062D\u0633\u0651\u0646</span>'
      : (nf1 > nf0 ? '<span class="ops-ar r">\u25BC \u062A\u062A\u0631\u0627\u062C\u0639</span>' : '<span class="ops-ar s">\u25C6 \u0645\u0633\u062A\u0642\u0631\u0629</span>');
    var cmpCard =
      '<div class="ops-card"><div class="ops-card-h">\uD83D\uDCC8 \u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0641\u062A\u0631\u0627\u062A \u2014 ' + mLabel(r1[2], r1[3]) + ' \u0645\u0642\u0627\u0628\u0644 ' + mLabel(r0[2], r0[3]) + '</div>' +
      '<div class="ops-cmp-row"><span>\u0623\u0639\u0637\u0627\u0644 \u062C\u062F\u064A\u062F\u0629</span><b>' + nf1 + '</b>' + arrow(nf1, nf0, false) + '<i>(\u0627\u0644\u0633\u0627\u0628\u0642 ' + nf0 + ')</i></div>' +
      '<div class="ops-cmp-row"><span>\u0625\u0635\u0644\u0627\u062D\u0627\u062A \u0645\u0646\u062C\u0632\u0629</span><b>' + nr1 + '</b>' + arrow(nr1, nr0, true) + '<i>(\u0627\u0644\u0633\u0627\u0628\u0642 ' + nr0 + ')</i></div>' +
      '<div class="ops-cmp-row big"><span>\u0645\u0624\u0634\u0631 \u0627\u062A\u062C\u0627\u0647 \u0635\u062D\u0629 \u0627\u0644\u0622\u0644\u064A\u0627\u062A</span>' + trend + '</div>' +
      '</div>';
    return '<div class="ops-grid ops-extra">' + fuCard + cmpCard + '</div>';
  }
  function fillPendingReports() {
    fetchRaw("reports.json", function (j) {
      var el2 = document.getElementById("ops-fu-rep"); if (!el2) return;
      var n = 0;
      if (j && j.length) j.forEach(function (r) {
        var dec = ((r && (r.decision || r.status || r.state)) || "").toString();
        if (!/\u0627\u0639\u062A\u0645\u062F|\u0645\u0639\u062A\u0645\u062F|\u0631\u0641\u0636|\u0645\u0631\u0641\u0648\u0636|approved|rejected|closed|done/i.test(dec)) n++;
      });
      el2.innerHTML = '\u0628\u0644\u0627\u063A\u0627\u062A \u0645\u0639\u0644\u0651\u0642\u0629 <b>' + n + '</b>';
    });
  }
  function monthlyStatementBody() {
    var r1 = monthSerRange(0), lbl = mLabel(r1[2], r1[3]);
    var d = readinessDetail(VEH), C = statCounts(VEH);
    var nf = faultsInRange(VEH, r1[0], r1[1]), nr = faultsInRange(VEH, r1[0], r1[1], true);
    var byT = {}; nf.forEach(function (x) { var t = x.f.faultType || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"; byT[t] = (byT[t] || 0) + 1; });
    var byB = {}; nf.forEach(function (x) { var b = branchOf(x.v.unit) || "\u0623\u062E\u0631\u0649"; byB[b] = (byB[b] || 0) + 1; });
    var late = maintRows().filter(function (r) { return r.st === "\u0645\u062A\u0623\u062E\u0631\u0629"; }).length;
    var kT = '<table><tr><th colspan="2" style="background:#DCE3F0">\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u0639\u0627\u0645 \u2014 \u0634\u0647\u0631 ' + lbl + '</th></tr>' +
      [["\u0646\u0633\u0628\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u0629", "<b>" + d.pct + "\u066A</b> (" + d.up + " \u062C\u0627\u0647\u0632\u0629 \u0645\u0646 " + VEH.length + ")"],
      ["\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0622\u0644\u064A\u0627\u062A", VEH.length], ["\u0627\u0644\u0622\u0644\u064A\u0627\u062A \u0627\u0644\u0639\u0637\u0644\u0627\u0646\u0629 \u062D\u0627\u0644\u064A\u0627\u064B", C["\u0639\u0637\u0644\u0627\u0646\u0629"] || 0],
      ["\u0623\u0639\u0637\u0627\u0644 \u0633\u064F\u062C\u0651\u0644\u062A \u062E\u0644\u0627\u0644 \u0627\u0644\u0634\u0647\u0631", nf.length], ["\u0625\u0635\u0644\u0627\u062D\u0627\u062A \u0623\u064F\u0646\u062C\u0632\u062A \u062E\u0644\u0627\u0644 \u0627\u0644\u0634\u0647\u0631", nr.length],
      ["\u0645\u0647\u0627\u0645 \u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629 \u0645\u062A\u0623\u062E\u0631\u0629", late]].map(function (r) { return "<tr><td style='width:60%;font-weight:800;background:#F4F6FB'>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</table>";
    var tT = Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; });
    var tTbl = tT.length ? '<div style="margin-top:12px;font-weight:800;font-size:13px">\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0634\u0647\u0631 \u062D\u0633\u0628 \u0627\u0644\u0646\u0648\u0639</div><table><tr><th>\u0646\u0648\u0639 \u0627\u0644\u0639\u0637\u0644</th><th style="width:80px">\u0627\u0644\u0639\u062F\u062F</th></tr>' + tT.map(function (t) { return "<tr><td>" + esc(t) + "</td><td>" + byT[t] + "</td></tr>"; }).join("") + "</table>" : "";
    var bT = Object.keys(byB).sort(function (a, b) { return byB[b] - byB[a]; }).slice(0, 8);
    var bTbl = bT.length ? '<div style="margin-top:12px;font-weight:800;font-size:13px">\u0623\u0643\u062B\u0631 \u0627\u0644\u062C\u0647\u0627\u062A \u062A\u0633\u062C\u064A\u0644\u0627\u064B \u0644\u0644\u0623\u0639\u0637\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631</div><table><tr><th>\u0627\u0644\u062C\u0647\u0629</th><th style="width:80px">\u0627\u0644\u0623\u0639\u0637\u0627\u0644</th></tr>' + bT.map(function (b) { return "<tr><td>" + esc(b) + "</td><td>" + byB[b] + "</td></tr>"; }).join("") + "</table>" : "";
    return { body: kT + tTbl + bTbl, lbl: lbl };
  }
  function branchReportBody(x) {
    var pool = x.list || [], C = statCounts(pool);
    var kT = '<table><tr><th colspan="2" style="background:#DCE3F0">\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u0639\u0627\u0645 \u0644\u0634\u0639\u0628\u0629 ' + esc(x.name) + '</th></tr>' +
      [["\u0625\u062C\u0645\u0627\u0644\u064A \u0622\u0644\u064A\u0627\u062A \u0627\u0644\u0634\u0639\u0628\u0629", x.total], ["\u0622\u0644\u064A\u0627\u062A \u062C\u0627\u0647\u0632\u0629", x.up], ["\u0627\u0644\u0622\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u062A\u0639\u0637\u0644\u0629", x.down], ["\u062A\u0639\u0645\u0644 \u0628\u0648\u062C\u0648\u062F \u0645\u0644\u0627\u062D\u0638\u0627\u062A", x.notes],
      ["\u0646\u0633\u0628\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629", "<b>" + x.pct + "\u066A</b> \u2014 " + x.up + " \u00F7 (" + x.total + " \u2212 " + (x.rej || 0) + " \u0631\u062C\u064A\u0639 \u2212 " + (x.prep || 0) + " \u062A\u062C\u0647\u064A\u0632)"]].map(function (r) { return "<tr><td style='width:60%;font-weight:800;background:#F4F6FB'>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</table>";
    var sT = '<div style="margin-top:12px;font-weight:800;font-size:13px">\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629</div><table><tr><th>\u0627\u0644\u062D\u0627\u0644\u0629</th><th style="width:80px">\u0627\u0644\u0639\u062F\u062F</th></tr>' + STATUSES.filter(function (s) { return C[s]; }).map(function (s) { return "<tr><td>" + s + "</td><td>" + C[s] + "</td></tr>"; }).join("") + "</table>";
    var down = pool.filter(function (v) { return v.status === "\u0639\u0637\u0644\u0627\u0646\u0629"; });
    var dRows = down.map(function (v, i) {
      var worst = null, ft = "\u2014";
      (v.faults || []).forEach(function (f) { if ((f.repairDate || "").trim()) return; var s = hSer(parseH(f.date)); if (s && (!worst || s < worst)) { worst = s; ft = f.faultType || "\u2014"; } });
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(v.type || "\u2014") + "</td><td>" + esc(v.plate || "\u2014") + "</td><td>" + esc(ft) + "</td><td>" + (worst ? (SER_NOW - worst) + " \u064A\u0648\u0645\u0627\u064B" : "\u2014") + "</td></tr>";
    }).join("");
    var dTbl = down.length ? '<div style="margin-top:12px;font-weight:800;font-size:13px">\u0627\u0644\u0622\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u062A\u0639\u0637\u0644\u0629 (' + down.length + ')</div><table><tr><th style="width:24px">\u0645</th><th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0627\u0644\u0644\u0648\u062D\u0629</th><th>\u0646\u0648\u0639 \u0627\u0644\u0639\u0637\u0644</th><th>\u0645\u062F\u0629 \u0627\u0644\u062A\u0648\u0642\u0641</th></tr>' + dRows + "</table>" : '<div style="margin-top:12px;font-weight:800">\u0644\u0627 \u0622\u0644\u064A\u0627\u062A \u0645\u062A\u0639\u0637\u0644\u0629 \u0641\u064A \u0627\u0644\u0634\u0639\u0628\u0629 \u2705</div>';
    var late = maintRows().filter(function (r) { return r.st === "\u0645\u062A\u0623\u062E\u0631\u0629" && branchOf(r.v.unit) === x.full; }).length;
    var mT = '<div style="margin-top:12px">\u0645\u0647\u0627\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629 \u0644\u0644\u0634\u0639\u0628\u0629: <b>' + late + '</b></div>';
    return kT + sT + dTbl + mT;
  }
  var _CHK_CACHE;
  function loadVehCheckin(v) {
    var box = document.getElementById("fdv-chk"); if (!box) return;
    function show(list) {
      var none = "\uD83D\uDDD3\uFE0F \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u064A\u0648\u0645\u064A: \u0644\u0627 \u0641\u062D\u0635 \u0645\u0633\u062C\u0651\u0644\u0627\u064B \u0628\u0639\u062F \u0644\u0647\u0630\u0647 \u0627\u0644\u0622\u0644\u064A\u0629";
      if (!list || !list.length) { box.innerHTML = none; return; }
      var hit = null;
      list.forEach(function (r) {
        if (!r) return;
        var s = JSON.stringify(r);
        if ((r.id && r.id === v.id) || (r.vid && r.vid === v.id) || (r.plate && v.plate && r.plate === v.plate) || (v.id && s.indexOf('"' + v.id + '"') >= 0)) hit = r;
      });
      if (!hit) { box.innerHTML = none; return; }
      var drv = hit.driver || hit.name || hit.by || "\u2014";
      var dt = hit.date || hit.at || hit.time || "\u2014";
      var okF = (hit.ok === false || hit.notes === true || ((hit.note || hit.msg || "") + "").length > 1);
      box.innerHTML = "\uD83D\uDDD3\uFE0F \u0622\u062E\u0631 \u0641\u062D\u0635 \u064A\u0648\u0645\u064A: " + (okF ? "\u26A0\uFE0F \u0628\u0645\u0644\u0627\u062D\u0638\u0627\u062A" : "\u2705 \u0633\u0644\u064A\u0645") + " \u00B7 \u0627\u0644\u0633\u0627\u0626\u0642: <b>" + esc(String(drv)) + "</b> \u00B7 " + esc(String(dt)) + (hit.num ? " \u00B7 " + esc(String(hit.num)) : "");
    }
    if (_CHK_CACHE !== undefined) { show(_CHK_CACHE); return; }
    fetchRaw("checkins.json", function (j) { _CHK_CACHE = j || []; show(_CHK_CACHE); });
  }
  function detectTime(qn) {
    if (/\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631|\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u062D\u0627\u0644\u064A/.test(qn)) { var r = monthSerRange(0); return { a: r[0], b: r[1], l: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631 (" + mLabel(r[2], r[3]) + ")" }; }
    if (/\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0645\u0627\u0636\u064A|\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0633\u0627\u0628\u0642/.test(qn)) { var r0 = monthSerRange(-1); return { a: r0[0], b: r0[1], l: "\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0645\u0627\u0636\u064A (" + mLabel(r0[2], r0[3]) + ")" }; }
    if (/\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0628\u0648\u0639|\u062E\u0644\u0627\u0644 \u0627\u0644\u0627\u0633\u0628\u0648\u0639|\u0627\u0644\u0627\u0633\u0628\u0648\u0639/.test(qn)) return { a: SER_NOW - 7, b: SER_NOW, l: "\u0647\u0630\u0627 \u0627\u0644\u0623\u0633\u0628\u0648\u0639" };
    if (/(^|\s)\u0627\u0644\u064A\u0648\u0645(\s|$)/.test(qn)) return { a: SER_NOW, b: SER_NOW, l: "\u0627\u0644\u064A\u0648\u0645" };
    return null;
  }
  function timeAnswer(q0) {
    var qn = norm(q0), T = detectTime(qn);
    if (!T) return null;
    var wantRepair = /\u0639\u0627\u062F|\u0631\u062C\u0639|\u0627\u0635\u0644\u062D|\u062A\u0645 \u0627\u0644\u0627\u0635\u0644\u0627\u062D|\u0627\u0646\u062C\u0632/.test(qn);
    var wantFault = /\u0639\u0637\u0644|\u0627\u0639\u0637\u0627\u0644|\u062A\u0639\u0637\u0644/.test(qn);
    if (!wantRepair && !wantFault) return null;
    var F = parseQuery(q0), pool = subjectPool(F), lbl = subjLabel(F);
    var hits = faultsInRange(pool, T.a, T.b, wantRepair);
    var seen = {}, rows = [];
    hits.forEach(function (x) {
      if (wantRepair) { if (seen[x.v.id]) return; seen[x.v.id] = 1; }
      if (rows.length < 8) rows.push("<li>" + esc(x.v.type || "\u2014") + " \u2014 <b>" + esc(x.v.plate || "") + "</b>" + (wantRepair ? "" : " (" + esc(x.f.faultType || "\u2014") + ")") + " \u00B7 " + fmtH(wantRepair ? parseH(x.f.repairDate) : parseH(x.f.date)) + "</li>");
    });
    var n = wantRepair ? Object.keys(seen).length : hits.length;
    var head = wantRepair
      ? "\uD83D\uDD27 <b>" + n + "</b> \u0622\u0644\u064A\u0629 \u0639\u0627\u062F\u062A \u0644\u0644\u0639\u0645\u0644 \u062E\u0644\u0627\u0644 <b>" + T.l + "</b> \u0645\u0646 " + lbl
      : "\u26A0\uFE0F \u0633\u064F\u062C\u0651\u0644 <b>" + n + "</b> \u0639\u0637\u0644\u0627\u064B \u062E\u0644\u0627\u0644 <b>" + T.l + "</b> \u0639\u0644\u0649 " + lbl;
    var byT = {};
    if (!wantRepair) hits.forEach(function (x) { var t = x.f.faultType || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"; byT[t] = (byT[t] || 0) + 1; });
    var bd = Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; }).map(function (t) { return t + " (" + byT[t] + ")"; }).join(" \u00B7 ");
    var _say = wantRepair ? (n + " \u0622\u0644\u064A\u0629 \u0639\u0627\u062F\u062A \u0644\u0644\u0639\u0645\u0644 \u062E\u0644\u0627\u0644 " + T.l) : ("\u0633\u064F\u062C\u0651\u0644 " + n + " \u0639\u0637\u0644\u0627\u064B \u062E\u0644\u0627\u0644 " + T.l);
    return { say: _say, html: "<div>" + head + (bd ? "<div style='font-size:12px;margin-top:5px;opacity:.85'>\u0627\u0644\u062A\u0648\u0632\u064A\u0639: " + bd + "</div>" : "") + (rows.length ? "<ul style='margin:7px 0 0;padding-inline-start:18px'>" + rows.join("") + "</ul>" : "") + "</div>" };
  }

  /* ============================================================
     \u062F\u0641\u0639\u0629 26: \u0627\u0644\u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0646\u0648\u0639\u064A\u0629 \u0644\u0644\u0634\u064F\u0651\u0639\u0628 + \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629
     + \u0645\u062A\u0627\u0628\u0639\u0629 \u0632\u0645\u0646 \u0627\u0644\u0625\u0635\u0644\u0627\u062D + \u0645\u0648\u062C\u0632 \u00AB\u0645\u0646\u0630 \u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629\u00BB
     ============================================================ */
  var CRIT_GROUPS = [
    ["\u0625\u0637\u0641\u0627\u0621", function (t) { return t.indexOf("\u0627\u0637\u0641\u0627\u0621") >= 0; }],
    ["\u0625\u0646\u0642\u0627\u0630", function (t) { return t.indexOf("\u0627\u0646\u0642\u0627\u0630") >= 0; }],
    ["\u0633\u0644\u0627\u0644\u0645", function (t) { return t.indexOf("\u0633\u0644\u0645") >= 0; }],
    ["\u0648\u0627\u064A\u062A\u0627\u062A", function (t) { return t.indexOf("\u0648\u0627\u064A\u062A") >= 0; }],
    ["\u0625\u0633\u0639\u0627\u0641", function (t) { return t.indexOf("\u0627\u0633\u0639\u0627\u0641") >= 0; }],
    ["\u062F\u0631\u0627\u062C\u0627\u062A", function (t) { return t.indexOf("\u062F\u0631\u0627\u062C") >= 0; }]
  ];
  var READY_ST = { "\u062A\u0639\u0645\u0644": 1, "\u062A\u0645 \u0627\u0644\u0625\u0635\u0644\u0627\u062D": 1, "\u062A\u0639\u0645\u0644 \u0628\u0648\u062C\u0648\u062F \u0645\u0644\u0627\u062D\u0638\u0627\u062A": 1 };
  function matrixData() {
    var rows = FIELD12.map(function (b) {
      var pool = VEH.filter(function (v) { return branchOf(v.unit) === b; });
      var cells = CRIT_GROUPS.map(function (g) {
        var n = 0; pool.forEach(function (v) { if (READY_ST[v.status] && g[1](norm(v.type || ""))) n++; });
        return n;
      });
      return { b: b.replace("\u0634\u0639\u0628\u0629 ", ""), cells: cells };
    });
    var recs = [];
    CRIT_GROUPS.forEach(function (g, gi) {
      var zero = rows.filter(function (r) { return r.cells[gi] === 0; });
      if (!zero.length) return;
      var best = rows.slice().sort(function (a, b) { return b.cells[gi] - a.cells[gi]; })[0];
      if (best && best.cells[gi] >= 3) zero.slice(0, 2).forEach(function (z) {
        if (recs.length < 5) recs.push("\u0646\u0642\u0644 \u0622\u0644\u064A\u0629 " + g[0] + " \u062C\u0627\u0647\u0632\u0629 \u0645\u0646 \u0634\u0639\u0628\u0629 " + best.b + " (" + best.cells[gi] + ") \u0625\u0644\u0649 \u0634\u0639\u0628\u0629 " + z.b + " (0)");
      });
    });
    var central = [];
    CRIT_GROUPS.forEach(function (g, gi) { var any = rows.some(function (r) { return r.cells[gi] > 0; }); if (!any) central.push(g[0]); });
    return { rows: rows, recs: recs, central: central };
  }
  function matrixTable(M, forReport) {
    var head = "<tr><th>\u0627\u0644\u0634\u0639\u0628\u0629</th>" + CRIT_GROUPS.map(function (g) { return "<th>" + g[0] + "</th>"; }).join("") + "</tr>";
    var body = M.rows.map(function (r) {
      return "<tr><td style='font-weight:800'>" + esc(r.b) + "</td>" + r.cells.map(function (n) {
        var c = n === 0 ? "#B3121C" : (n === 1 ? "#8A5D0B" : "#1B6E42");
        var bg = forReport ? "" : (n === 0 ? "background:rgba(255,107,114,.14);" : (n === 1 ? "background:rgba(232,197,97,.12);" : "background:rgba(47,211,127,.10);"));
        return "<td style='text-align:center;font-weight:900;color:" + c + ";" + bg + "'>" + n + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return "<table class='ops-mx-t'>" + head + body + "</table>";
  }
  function opsMatrixHtml() {
    var M = matrixData();
    var recs = M.recs.length ? '<div class="ops-mx-recs"><b>\u062A\u0648\u0635\u064A\u0627\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639:</b><ul>' + M.recs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>" : '<div class="ops-mx-recs ok">\u0644\u0627 \u0641\u062C\u0648\u0627\u062A \u062A\u063A\u0637\u064A\u0629 \u0641\u064A \u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u0648\u0632\u0651\u0639\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u064F\u0651\u0639\u0628 \u2705</div>';
    var central = M.central.length ? '<div class="ops-mx-note">\u0645\u0644\u0627\u062D\u0638\u0629: ' + M.central.map(esc).join(' \u00B7 ') + ' \u063A\u064A\u0631 \u0645\u0648\u0632\u0651\u0639\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u064F\u0651\u0639\u0628 \u2014 \u062A\u062A\u0628\u0639 \u0627\u0644\u062F\u0639\u0645 \u0648\u0627\u0644\u0625\u0633\u0646\u0627\u062F \u0645\u0631\u0643\u0632\u064A\u0627\u064B</div>' : '';
    return '<div class="ops-card ops-mx"><div class="ops-card-h">\u1F9ED \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u0646\u0648\u0639\u064A\u0629 \u0644\u0644\u0634\u064F\u0651\u0639\u0628 \u2014 <span style="opacity:.8;font-weight:700">\u0622\u0644\u064A\u0627\u062A \u062C\u0627\u0647\u0632\u0629 \u0645\u0646 \u0643\u0644 \u0646\u0648\u0639 \u062D\u0631\u062C</span>' +
      '<span class="ops-mx-btns"><button class="omd-rep" id="ops-mx-p">\u1F5A8\uFE0F \u0637\u0628\u0627\u0639\u0629</button><button class="omd-rep omd-repw" id="ops-mx-w">\u1F4C4</button></span></div>' +
      '<div class="ops-mx-wrap">' + matrixTable(M) + '</div>' + recs + central + '</div>';
  }
  function repeatFaults() {
    var out = [];
    VEH.forEach(function (v) {
      var fs = (v.faults || []).map(function (f) { return { f: f, a: hSer(parseH(f.date)), r: hSer(parseH(f.repairDate)) }; }).filter(function (x) { return x.a; }).sort(function (x, y) { return x.a - y.a; });
      for (var i = 0; i < fs.length; i++) {
        if (!fs[i].r) continue;
        for (var j = i + 1; j < fs.length; j++) {
          var gap = fs[j].a - fs[i].r;
          if (gap < 0 || gap > 30) continue;
          if (norm(fs[j].f.faultType || "") === norm(fs[i].f.faultType || "")) { out.push({ v: v, first: fs[i].f, again: fs[j].f, gap: gap }); break; }
        }
      }
    });
    out.sort(function (a, b) { return a.gap - b.gap; });
    return out;
  }
  function repeatTable(list, lim) {
    var rows = (lim ? list.slice(0, lim) : list).map(function (x, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.v.type || "\u2014") + "</td><td>" + esc(x.v.plate || "\u2014") + "</td><td>" + esc(x.first.faultType || "\u2014") + "</td><td>" + fmtH(parseH(x.first.repairDate)) + "</td><td style='color:#B3121C;font-weight:900'>" + x.gap + " \u064A\u0648\u0645\u0627\u064B</td><td>" + esc(x.first.causedBy || "\u2014") + "</td></tr>";
    }).join("");
    return "<table><tr><th style='width:24px'>\u0645</th><th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0627\u0644\u0644\u0648\u062D\u0629</th><th>\u0646\u0648\u0639 \u0627\u0644\u0639\u0637\u0644</th><th>\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u0644\u0627\u062D</th><th>\u0639\u0627\u062F \u0627\u0644\u0639\u0637\u0644 \u0628\u0639\u062F</th><th>\u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u062A\u0633\u0628\u0628\u0629</th></tr>" + (rows || "<tr><td colspan='7' style='text-align:center'>\u0644\u0627 \u0623\u0639\u0637\u0627\u0644 \u0645\u062A\u0643\u0631\u0631\u0629 \u2705</td></tr>") + "</table>";
  }
  function opsQualityHtml() {
    var rep = repeatFaults();
    var repRows = rep.slice(0, 6).map(function (x) {
      return '<div class="ops-fu-row"><span>' + esc(x.v.type || "\u2014") + ' \u2014 ' + esc(x.v.plate || "") + ' (' + esc(x.first.faultType || "\u2014") + ')</span><b style="color:#FF8A90">\u0639\u0627\u062F \u0628\u0639\u062F ' + x.gap + ' \u064A\u0648\u0645\u0627\u064B</b></div>';
    }).join("") || '<div class="ops-fu-row ok">\u0644\u0627 \u0623\u0639\u0637\u0627\u0644 \u0645\u062A\u0643\u0631\u0631\u0629 \u062E\u0644\u0627\u0644 30 \u064A\u0648\u0645\u0627\u064B \u0645\u0646 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u2705</div>';
    var slow = [];
    VEH.forEach(function (v) {
      (v.faults || []).forEach(function (f) {
        if ((f.repairDate || "").trim()) return;
        var a = hSer(parseH(f.date)); if (!a) return;
        var dd = SER_NOW - a; if (dd > 14) slow.push({ v: v, f: f, d: dd });
      });
    });
    slow.sort(function (a, b) { return b.d - a.d; });
    var slowRows = slow.slice(0, 6).map(function (x) {
      return '<div class="ops-fu-row"><span>' + esc(x.v.type || "\u2014") + ' \u2014 ' + esc(x.v.plate || "") + ' (' + esc(x.f.faultType || "\u2014") + ')</span><b style="color:#E8C561">' + x.d + ' \u064A\u0648\u0645\u0627\u064B</b></div>';
    }).join("") || '<div class="ops-fu-row ok">\u0644\u0627 \u0623\u0639\u0637\u0627\u0644 \u0645\u0641\u062A\u0648\u062D\u0629 \u0645\u062A\u062C\u0627\u0648\u0632\u0629 14 \u064A\u0648\u0645\u0627\u064B \u2705</div>';
    return '<div class="ops-grid ops-q">' +
      '<div class="ops-card"><div class="ops-card-h">\u1F501 \u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u062A\u0643\u0631\u0631\u0629 \u2014 \u062C\u0648\u062F\u0629 \u0627\u0644\u0625\u0635\u0644\u0627\u062D <b style="color:#FF8A90">' + rep.length + '</b>' +
      '<span class="ops-mx-btns"><button class="omd-rep" id="ops-rq-p">\u1F5A8\uFE0F</button><button class="omd-rep omd-repw" id="ops-rq-w">\u1F4C4</button></span></div>' +
      '<div class="ops-fu-sec">\u0622\u0644\u064A\u0629 \u0623\u064F\u0635\u0644\u062D\u062A \u062B\u0645 \u062A\u0639\u0637\u0644\u062A \u0628\u0646\u0641\u0633 \u0627\u0644\u0646\u0648\u0639 \u062E\u0644\u0627\u0644 \u2264 30 \u064A\u0648\u0645\u0627\u064B</div>' + repRows + '</div>' +
      '<div class="ops-card"><div class="ops-card-h">\u23F1\uFE0F \u0623\u0639\u0637\u0627\u0644 \u0645\u0641\u062A\u0648\u062D\u0629 \u0645\u062A\u062C\u0627\u0648\u0632\u0629 14 \u064A\u0648\u0645\u0627\u064B <b style="color:#E8C561">' + slow.length + '</b>' +
      '<span class="ops-mx-btns"><button class="omd-rep" id="ops-sla-p">\u1F5A8\uFE0F</button><button class="omd-rep omd-repw" id="ops-sla-w">\u1F4C4</button></span></div>' +
      '<div class="ops-fu-sec">\u0645\u0631\u062A\u0628\u0629 \u0628\u0627\u0644\u0623\u0642\u062F\u0645 \u2014 \u0623\u062F\u0627\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u062C\u0647\u0627\u062A \u0627\u0644\u0625\u0635\u0644\u0627\u062D</div>' + slowRows + '</div>' +
      '</div>';
  }
  function slaReportBody() {
    var slow = [];
    VEH.forEach(function (v) { (v.faults || []).forEach(function (f) { if ((f.repairDate || "").trim()) return; var a = hSer(parseH(f.date)); if (!a) return; var dd = SER_NOW - a; if (dd > 14) slow.push({ v: v, f: f, d: dd }); }); });
    slow.sort(function (a, b) { return b.d - a.d; });
    var t1 = "<table><tr><th style='width:24px'>\u0645</th><th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0627\u0644\u0644\u0648\u062D\u0629</th><th>\u0646\u0648\u0639 \u0627\u0644\u0639\u0637\u0644</th><th>\u0645\u0641\u062A\u0648\u062D \u0645\u0646\u0630</th><th>\u0645\u0648\u0642\u0639 \u0627\u0644\u0622\u0644\u064A\u0629</th></tr>" + slow.map(function (x, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.v.type || "\u2014") + "</td><td>" + esc(x.v.plate || "\u2014") + "</td><td>" + esc(x.f.faultType || "\u2014") + "</td><td style='font-weight:900'>" + x.d + " \u064A\u0648\u0645\u0627\u064B</td><td>" + esc(x.v.location || "\u2014") + "</td></tr>"; }).join("") + "</table>";
    var by = {};
    VEH.forEach(function (v) { (v.faults || []).forEach(function (f) { var a = hSer(parseH(f.date)), r = hSer(parseH(f.repairDate)); if (!a || !r || r < a) return; var k = f.causedBy || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"; (by[k] = by[k] || []).push(r - a); }); });
    var ks = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; }).slice(0, 10);
    var t2 = ks.length ? '<div style="margin-top:12px;font-weight:800;font-size:13px">\u0645\u062A\u0648\u0633\u0637 \u0645\u062F\u0629 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u062D\u0633\u0628 \u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u062A\u0633\u0628\u0628\u0629 (\u0627\u0644\u0623\u0639\u0637\u0627\u0644 \u0627\u0644\u0645\u063A\u0644\u0642\u0629)</div><table><tr><th>\u0627\u0644\u062C\u0647\u0629 \u0627\u0644\u0645\u062A\u0633\u0628\u0628\u0629</th><th>\u0639\u062F\u062F \u0627\u0644\u0625\u0635\u0644\u0627\u062D\u0627\u062A</th><th>\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0645\u062F\u0629</th></tr>' + ks.map(function (k) { var arr = by[k], avg = Math.round(arr.reduce(function (s, x) { return s + x; }, 0) / arr.length); return "<tr><td>" + esc(k) + "</td><td>" + arr.length + "</td><td><b>" + avg + " \u064A\u0648\u0645\u0627\u064B</b></td></tr>"; }).join("") + "</table>" : "";
    return t1 + t2;
  }
  /* ---------- \u0645\u0648\u062C\u0632 \u00AB\u0645\u0646\u0630 \u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629\u00BB ---------- */
  var LV_KEY = "fd_lastvisit_v1";
  function visitSnap() {
    var sigs = [], down = [];
    VEH.forEach(function (v) { (v.faults || []).forEach(function (f) { sigs.push(v.id + "|" + (f.date || "")); }); if (v.status === "\u0639\u0637\u0644\u0627\u0646\u0629") down.push(v.id); });
    return { at: Date.now(), sigs: sigs, down: down, pct: readinessDetail(VEH).pct };
  }
  function showVisitBrief() {
    if (!VEH.length || document.querySelector(".fd31-brief")) return;
    var prev = null; try { prev = JSON.parse(localStorage.getItem(LV_KEY) || "null"); } catch (e) { }
    var cur = visitSnap();
    try { localStorage.setItem(LV_KEY, JSON.stringify(cur)); } catch (e) { }
    if (!prev || !prev.sigs || (Date.now() - (prev.at || 0)) < 6 * 3600 * 1000) return;
    var oldSigs = {}; prev.sigs.forEach(function (s) { oldSigs[s] = 1; });
    var newFaults = cur.sigs.filter(function (s) { return !oldSigs[s]; }).length;
    var curDown = {}; cur.down.forEach(function (i2) { curDown[i2] = 1; });
    var returned = (prev.down || []).filter(function (i2) { return !curDown[i2]; }).length;
    var dp = cur.pct - (prev.pct || cur.pct);
    if (!newFaults && !returned && !dp) return;
    var el2 = el("div", "fd31-brief");
    el2.innerHTML = '<b>\u1F4CB \u0645\u0646\u0630 \u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629:</b> ' +
      (newFaults ? '<span class="r">' + newFaults + ' \u0639\u0637\u0644\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B</span>' : '') +
      (returned ? '<span class="g">' + returned + ' \u0622\u0644\u064A\u0629 \u0639\u0627\u062F\u062A \u0644\u0644\u0639\u0645\u0644</span>' : '') +
      (dp ? '<span class="' + (dp > 0 ? "g" : "r") + '">\u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 ' + (dp > 0 ? "\u25B2 +" : "\u25BC ") + dp + '\u066A</span>' : '') +
      '<button class="fd31-brief-x" title="\u0625\u063A\u0644\u0627\u0642">\u2715</button>';
    document.body.appendChild(el2);
    el2.querySelector(".fd31-brief-x").onclick = function () { el2.remove(); };
    setTimeout(function () { if (el2.parentNode) el2.classList.add("hide"); }, 25000);
    setTimeout(function () { if (el2.parentNode) el2.remove(); }, 26000);
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 300); return; }
    placeRailAI();
    fillMounts();
    try { initWelcomeTour(); } catch (e) { }
    if (!VEH.length && !boot._dbTried) { boot._dbTried = true; try { loadDB(function () { setTimeout(function(){ try { showVisitBrief(); } catch (e) { } }, 3500); }); } catch (e) { } } else if (VEH.length) { setTimeout(function(){ try { showVisitBrief(); } catch (e) { } }, 3500); }
    try { new MutationObserver(function () { fillMounts(); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    setInterval(fillMounts, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
