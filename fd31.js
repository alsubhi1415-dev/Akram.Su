/* ============================================================
   FD31 · الإصدار 31.0 — مساعد ذكي فائق + ثلاث أدوات مستقلة
   وحدة معزولة كلياً خارج React
   ============================================================ */
(function () {
  "use strict";
  if (window.__FD31__) return; window.__FD31__ = true;

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
  function readLocal() {
    var best = null, bestN = -1;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^cdfleet.*db$/.test(k)) {
          try { var d = normDb(JSON.parse(localStorage.getItem(k))); if (d && (d.vehicles || []).length > bestN) { best = d; bestN = (d.vehicles || []).length; } } catch (e2) { }
        }
      }
    } catch (e) { }
    return best;
  }
  function loadDB(cb) {
    if (VEH.length) { cb(true); return; }
    var local = readLocal();
    var done = false, fin = function (ok) { if (done) return; done = true; cb(ok); };
    // نوفّق بين النسخة المحلية وdata.json ونعتمد الأكبر (الأحدث/الأشمل)
    try {
      fetch("data.json?fd31=" + Date.now()).then(function (r) { return r.json(); }).then(function (j) {
        var jd = normDb(j) || normDb(j && j.db) || null;
        var ln = local ? (local.vehicles || []).length : -1;
        var jn = jd ? (jd.vehicles || []).length : -1;
        var pick = (jn >= ln) ? jd : local;
        DB = pick || local || jd; VEH = DB ? (DB.vehicles || []) : [];
        fin(!!DB);
      }).catch(function () { DB = local; VEH = local ? (local.vehicles || []) : []; fin(!!local); });
    } catch (e) { DB = local; VEH = local ? (local.vehicles || []) : []; fin(!!local); }
    // لو تأخّر الجلب، اعتمد المحلي مؤقتاً بعد مهلة قصيرة
    setTimeout(function () { if (!done && local) { DB = local; VEH = local.vehicles || []; fin(true); } }, 1500);
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

  function answerTop(q0) { var m = null; try { m = multiAnswer(q0); } catch (e) { m = null; } return m || answer(q0); }

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
  function printDoc(title, bodyHtml, opts) {
    opts = opts || {};
    var w = null; try { w = window.open("", "_blank"); } catch (e) { }
    if (!w) { alert("تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة"); return; }
    w.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>' +
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
      '<div class="foot">صدر آلياً من المنصة الرقمية لجاهزية الآليات والمراكز الميدانية · الإصدار 31.0</div></body></html>');
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) { } }, 400);
  }

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
      '<div class="fdp-head"><div class="fdp-title"><span class="fdp-ic">🛠️</span><div><h1>الصيانة الوقائية للآليات</h1><p>خطة استباقية تُحسب من تاريخ آخر إصلاح لكل آلية بتقويم أم القرى — الرجيع مستبعد</p></div></div></div>' +
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
      '<button id="fdp-print" class="fdp-btn">🖨️ طباعة الجدول</button></div></div>' +
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
    $("#fdp-print", host).onclick = function () {
      var fb = $("#fdp-br", host).value, fs = $("#fdp-st", host).value;
      var list = rows.filter(function (r) { return (!fb || (branchOf(r.v.unit) || "أخرى") === fb) && (!fs || r.st === fs); }).filter(function (r) { return fs || r.st !== "مجدولة"; });
      printDoc("جدول الصيانة الوقائية للآليات", '<div style="font-size:13px;margin-bottom:8px">' + (fb ? "الجهة: " + fb + " — " : "") + 'المهام المستحقة والمتأخرة وعددها (' + list.length + ')</div><table><tr><th style="width:26px">م</th><th>المهمة</th><th>اللوحة</th><th>النوع</th><th>الجهة</th><th>الاستحقاق</th><th>الموقف</th></tr>' + list.map(function (r, i) { return "<tr><td>" + (i + 1) + "</td><td>" + r.task + "</td><td>" + esc(r.v.plate || "—") + "</td><td>" + esc(r.v.type) + "</td><td>" + esc(r.v.unit) + "</td><td>" + fmtH(serToH(r.due)) + "</td><td>" + (r.st === "متأخرة" ? "متأخرة " + Math.abs(r.diff) + " يوماً" : r.st) + "</td></tr>"; }).join("") + "</table>", {});
    };
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
      '<button class="fdv-print" id="fdv-print">🖨️ طباعة تقرير مفصّل</button></div>' +
      '<div class="fdv-stats"><div class="fdv-st"><b>' + totalFaults + '</b><span>إجمالي الأعطال</span></div>' +
      '<div class="fdv-st ' + (of.length ? "warn" : "") + '"><b>' + of.length + '</b><span>أعطال مفتوحة</span></div>' +
      '<div class="fdv-st"><b>' + downDays + '</b><span>إجمالي أيام التوقف</span></div>' +
      '<div class="fdv-st"><b>' + evs.length + '</b><span>حدث مسجّل</span></div></div>' +
      '<div class="fdv-line">' + evs.map(function (e) {
        return '<div class="fdv-ev ' + e.t + '"><div class="fdv-dot"></div><div class="fdv-card"><div class="fdv-date">' + fmtH(e.d) + '</div><div class="fdv-title">' + esc(e.h) + '</div>' + (e.x ? '<div class="fdv-desc">' + e.x + '</div>' : "") + (e.dur != null ? '<span class="fdv-dur ' + (e.open ? "open" : "") + '">' + (e.open ? "متوقفة منذ " + e.dur + " يوماً — مفتوح" : "مدة التوقف " + e.dur + " يوماً") + '</span>' : "") + '</div></div>';
      }).join("") + '</div></div>';
    $("#fdv-print", host).onclick = function () { printVehReport(v); };
  }
  function printVehReport(v) {
    var evs = vehEvents(v), of = openFaults(v);
    var age = parseInt(v.model, 10) > 1980 ? (2026 - parseInt(v.model, 10)) + " سنة" : "—";
    var idRows = [["اللوحة", v.plate || "—"], ["النوع", v.type], ["الموديل", (v.model || "—") + " (العمر " + age + ")"], ["رقم الهيكل", v.chassis || "—"], ["اللون", v.color || "—"], ["الرقم التسلسلي", v.itemNo || "—"], ["الجهة", v.unit], ["الشعبة", branchOf(v.unit) || "—"], ["الموقع", v.location || "—"], ["الحالة الحالية", v.status + " (تصنيف: " + (GROUP[v.status] || "—") + ")"]];
    var idTbl = '<table><tr><th colspan="2" style="background:#DCE3F0">البطاقة التعريفية للآلية</th></tr>' + idRows.map(function (r) { return "<tr><td style='width:32%;font-weight:800;background:#F4F6FB'>" + r[0] + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>";
    var faults = (v.faults || []);
    var fTbl = '<div style="margin-top:12px;font-weight:800;font-size:13px">سجل الأعطال والإصلاحات (' + faults.length + ')</div><table><tr><th style="width:24px">م</th><th>نوع العطل</th><th>تاريخ العطل</th><th>تاريخ الإصلاح</th><th>مدة التوقف</th><th>الجهة المتسببة</th><th>الوصف</th></tr>' + (faults.length ? faults.map(function (f, i) { var a = hSer(parseH(f.date)), b = hSer(parseH(f.repairDate)); var dur = (a && b) ? (b - a) + " يوماً" : (a ? "مفتوح (" + (SER_NOW - a) + "ي)" : "—"); return "<tr><td>" + (i + 1) + "</td><td>" + esc(f.faultType || "—") + "</td><td>" + fmtH(parseH(f.date)) + "</td><td>" + (f.repairDate ? fmtH(parseH(f.repairDate)) : "<b>لم يُصلح</b>") + "</td><td>" + dur + "</td><td>" + esc(f.causedBy || "—") + "</td><td>" + esc(f.desc || "—") + "</td></tr>"; }).join("") : '<tr><td colspan="7" style="text-align:center">لا أعطال مسجّلة</td></tr>') + "</table>";
    var tl = '<div style="margin-top:12px;font-weight:800;font-size:13px">السيرة الزمنية الكاملة</div><table><tr><th style="width:24px">م</th><th style="width:110px">التاريخ</th><th style="width:70px">النوع</th><th>البيان</th></tr>' + evs.map(function (e, i) { var kind = e.t === "f" ? "عطل" : e.t === "r" ? "إصلاح" : e.t === "c" ? "تسجيل" : "حركة"; return "<tr><td>" + (i + 1) + "</td><td>" + fmtH(e.d) + "</td><td>" + kind + "</td><td>" + esc(e.h) + (e.x ? " — " + e.x.replace(/<br>/g, "، ") : "") + (e.dur != null ? " (توقف " + e.dur + " يوماً)" : "") + "</td></tr>"; }).join("") + "</table>";
    var summary = '<div style="margin-top:12px;padding:8px 12px;border:1px solid #999;background:#F4F6FB;font-size:12.5px">الخلاصة: سُجّل لهذه الآلية <b>' + faults.length + '</b> عطلاً، منها <b>' + of.length + '</b> مفتوح حالياً. حالتها الراهنة <b>' + esc(v.status) + '</b>.' + (v.notes ? ' ملاحظات: ' + esc(v.notes) : "") + '</div>';
    printDoc("تقرير مفصّل عن الآلية — " + (v.plate || v.type), idTbl + fTbl + tl + summary, {});
  }


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
    return '<svg viewBox="0 0 220 160" class="ops-gauge"><path d="' + arcPath(110, 120, 84, 30, 330) + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="16" stroke-linecap="round"/>' +
      '<path class="ops-gauge-fill" d="' + arcPath(110, 120, 84, 30, a1) + '" fill="none" stroke="' + color + '" stroke-width="16" stroke-linecap="round" style="filter:drop-shadow(0 0 8px ' + color + ')"/>' +
      '<text x="110" y="116" text-anchor="middle" class="ops-gauge-n" data-count="' + pct + '">0</text>' +
      '<text x="110" y="140" text-anchor="middle" class="ops-gauge-l">٪ الجاهزية العامة</text></svg>';
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
    var W = 560, H = 120, n = series.length, step = n > 1 ? W / (n - 1) : W;
    var pts = series.map(function (x, i) { return [i * step, H - 12 - (x[1] / max) * (H - 30)]; });
    var d = "M " + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L ");
    var area = d + " L " + W + " " + H + " L 0 " + H + " Z";
    var labels = series.map(function (x, i) { return '<text x="' + (i * step).toFixed(0) + '" y="' + (H - 1) + '" class="ops-pl-x">' + x[0].slice(2) + '</text>'; }).join("");
    var dots = pts.map(function (p, i) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.2" fill="#FFB454" class="ops-pl-dot" style="animation-delay:' + (i * 0.06) + 's"/><text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 8).toFixed(1) + '" class="ops-pl-v">' + series[i][1] + '</text>'; }).join("");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ops-pulse" preserveAspectRatio="none"><defs><linearGradient id="opsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,180,84,.42)"/><stop offset="1" stop-color="rgba(255,180,84,0)"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#opsGrad)"/><path class="ops-pl-line" d="' + d + '" fill="none" stroke="#FFB454" stroke-width="2.5" stroke-linecap="round"/>' + dots + labels + '</svg>';
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
  function opsMapDetail(x) {
    if (!x) return '';
    var c = opsMapColor(x.pct);
    var head = '<div class="omd-h"><span class="omd-dot" style="background:' + c + '"></span><b>شعبة ' + esc(x.name) + '</b>'
      + '<span class="omd-pctwrap"><span class="omd-pct" style="color:' + c + '">' + x.pct + '٪</span><span class="omd-pctl">نسبة الجاهزية</span></span></div>';
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
      '</div>' +
      '<div class="fdls-bar">' + bar + '</div>' +
      '<div class="fdls-chips">' + chips + '</div>' +
      (branches.length > 1 ? '<div class="fdls-brs"><span class="fdls-brs-h">الجهات الظاهرة:</span>' + brChips + '</div>' : "") +
      (clickable ? '<div class="fdls-hint">' + (curStatus && curStatus.length ? '<button type="button" class="fdls-clear">✕ مسح مرشّحات الحالة</button> ' : '') + 'اختر حالة أو أكثر (تصفية تراكمية) — تُضاف/تُزال دون التأثير على بقية المرشّحات' + '</div>' : "") +
      '</div>';
    if (clickable) {
      host.onclick = function (e) {
        var t = e.target;
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
      '<button class="ops-full" id="ops-full" title="عرض ملء الشاشة للجدران">⛶ شاشة كاملة</button></div>' +

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
  function boot() {
    if (!document.body) { setTimeout(boot, 300); return; }
    placeRailAI();
    fillMounts();
    try { new MutationObserver(function () { fillMounts(); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    setInterval(fillMounts, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
