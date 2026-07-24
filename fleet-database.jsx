import { useState, useEffect, useRef, useMemo } from "react";

// بصمة كلمة سر المحررين (SHA-256) — تُستخدم للواجهة ولرمز الكتابة السحابي
const PW_HASH = "6346fc1b001a16dd9e1e8b172d33847c99e6016733cb2fde11baf8d107b364ce";
// بصمة كلمة سر المشرف (صلاحية سجل الآليات — أعلى من المحرر)
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ROLE_KEY = "cdfleet_role_hash";

// SHA-256 خفيفة تعمل في كل البيئات (بما فيها فتح الملف محلياً)
function sha256(ascii) {
  function rr(v, c) { return (v >>> c) | (v << (32 - c)); }
  const mathPow = Math.pow, maxWord = mathPow(2, 32);
  let result = "", words = [], asciiBitLength = ascii.length * 8;
  let hash = [], k = [], primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (w[i] = i < 16 ? w[i] : (w[i - 16]
            + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++)
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  return result;
}
// كلمة السر قد تكون عربية/يونيكود — نحولها UTF-8 أولاً
function pwHash(p) {
  try {
    const bytes = unescape(encodeURIComponent(p));
    return sha256(bytes);
  } catch { return ""; }
}
function getStoredRole() {
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    if (v === OWNER_HASH) return "owner";
    if (v === PW_HASH) return "editor";
    return "viewer";
  } catch { return "viewer"; }
}


// تحديث أسماء المراكز المخزنة سابقاً للمسميات المعتمدة
const CENTER_RENAMES = {
  "مركز خزام 2 ( مدائن الفهد )": "مركز خزام 2 ( الخاسكية )",
  "مركز خزام 3 ( الكندرة )": "مركز خزام 3 ( الوزيرية )",
  "مركز خزام 4 ( المصفاة )": "مركز خزام 4 ( بترومين )",
  "مركز بلد 4 ( الخاسكية )": "مركز بلد 4 ( الاندلس )",
  "مركز بترومين": "مركز خزام 4 ( بترومين )",
};
function migrateDb(d) {
  if (!d) return d;
  const fix = (obj) => {
    if (!obj) return obj;
    let changed = false;
    const out = {};
    for (const k in obj) {
      const nk = CENTER_RENAMES[k] || k;
      if (nk !== k) changed = true;
      if (out[nk] === undefined) out[nk] = obj[k];
    }
    return changed ? out : obj;
  };
  const eq = d.equipReadiness || {};
  return {
    ...d,
    centerReadiness: fix(d.centerReadiness),
    priorityData: fix(d.priorityData),
    equipReadiness: { ...eq, ringCutter: fix(eq.ringCutter), elevatorKey: fix(eq.elevatorKey), elevatorKeyE: fix(eq.elevatorKeyE), animalStrap: fix(eq.animalStrap), dual: fix(eq.dual) },
  };
}

// ====== سجل ربط أعمدة التقرير الأسبوعي (باللوحات) ======
const WEEKLY_COLS = [{"name": "سيارة إطفاء كبيرة", "plates": ["اصم3859", "سسص808", "ساط363", "ابه9570", "سدق485", "اصم3545", "اصم3834", "اصم3838", "اصم3932", "اصم3857", "اصم3537", "اصم3910", "اصم3974", "اصم3544", "اصم3207", "اصم3907", "اصم3941", "اصم3875", "اصم3916", "ارل2031", "ساب513"]}, {"name": "سيارة إطفاء صغير", "plates": ["ارل2032", "ارل2033", "ارل1850", "ارل1868", "سسه560", "ارل1870", "ارل1863"]}, {"name": "سيارة انقاذ", "plates": ["باق5918", "اعك7739", "باق1510", "اعك7732", "باد8440", "ببا2217", "بحي8048", "باد8783", "باد8450", "بحي8041", "ببا2174", "صوع284", "ابم7403", "احع3212", "ابم7402", "دسا420", "سسق642", "اصم3631", "سسق249", "احع3196", "اصم3845", "صلع404", "ابم7397", "صرك285", "ابم7388", "احع3182", "احع3209", "احع3224", "انط2420", "انط2412", "انط2419", "امن8199", "امن8209", "صلع255", "انط2415"]}, {"name": "آلية إطفاء وانقاذ مزدوجة", "plates": ["اوع4404", "اعك7441", "اوس7235", "بدب8021", "اوس7266", "اين6494", "باد8239", "ببا5913", "اعك7553", "انب3286", "اعك7448", "اين6503", "انل4630", "اوم7633", "اوس7261", "انط2401", "ببق2256", "امط4949", "اوس7262", "انل4619", "اهس2233", "اوس7260", "اهد1272", "اوم7634", "اين6521", "اهس2217", "انط2404", "باد8252", "انو5242", "اعك7576", "اين2788", "باد8241", "اين2795", "اوس7237", "باق5871", "اوس7247", "باد8272", "انل1471", "انط2406", "اهد1274", "اوس7259", "ببا5997", "اين2762", "انع8552", "اوم2884", "باق5756", "انل4628", "انل1469", "اعك7450", "ببا5040", "انب3281", "اوم2890", "ببا5992", "اوم2889", "اوم7638", "انو5250", "اهد1273", "انط2403", "اوس7263", "اهس2235", "سلي226", "امب9496", "سيط435"]}, {"name": "وايت روزنباور بروبلين مطور", "plates": ["بحل3087", "اكي8250", "اوم4089", "انع8482", "انب3911", "انط2502", "بحل3070", "امب1241", "انط2483", "امب1872", "اوم7674", "اهس6583", "باد8362", "انب3894", "اين2716", "انع8503", "بحل3161", "باق1436", "اين6676", "اين6670", "انط2503", "اكي1598", "اكي8255", "باد8359", "اكي8454", "انط2482", "اين6642", "اوم2872", "اوس7019", "اكي1592", "اهس2260", "انط2496", "الط1995", "انع8479", "اهم1425", "انع7207", "امب5814", "انب3896", "بحل3138", "اكي8251", "اكي1593", "اوس7038", "اوس7042", "انط2497", "اهس8359", "اهس8367", "اهم1420", "امط4147", "اين2715", "ببا2192", "اهس8369", "اوم2866", "اوع4791", "اكي1595", "انط2479", "امك4421", "باد8349", "الط1977", "امب1858", "اوس7036", "ببا2185", "انط2504", "اهس8336", "باد8343", "امط4146", "اوم2878", "اوم2858", "ببا5669", "اهس8371", "باق1438", "بحل3085", "امب1859", "انب3885", "اوم7670", "اين2713", "باق5850", "باق1443", "اين2709", "باق5860", "بحق7141", "بحق7138", "بحح6276", "باد8319"]}, {"name": "انقاذ جبلي تويوتا شاص", "plates": []}, {"name": "اسعاف", "plates": ["بلص9475", "هدب284", "وصر7154", "وعح619", "وصر276", "احن6662", "اهب4029", "اهب4251", "اهب4099", "اهب4098", "ادن5244", "ادن5361", "ادن8075", "ادن5238"]}, {"name": "سيارة ادارية", "plates": ["اهس2818", "اهس2816", "اون9695", "لمل265", "امط6540", "الع1091", "كبص194", "هود189", "حعب5678", "حعب5575", "امط6567", "الح9797", "يال930", "يال917", "هاب647", "اار7610", "الع1060", "مني827", "الح9008", "اار7549", "قصن956", "الح9004", "قصن865", "يال48", "مني182", "قهه205", "يال472", "اعا9361", "يطل276", "هاب629", "دقه2647", "قكك493", "دكن1882", "دكن1877", "دكن1871", "دقه2621", "دقه2645", "دكن1870", "دقه2619", "حاص1845", "بقم7027", "حاص1955", "حاص8038", "حبك3873", "حاص1801", "حاص1839", "حاص8140", "بقم3822", "بقم3263", "حاص6683", "بقم3255", "بقم7190", "حاص8337", "حبك3872", "حبك3857", "حبك3869", "حاص6676", "بقل6487", "حاص8294", "حاص1931", "حاص8260", "بقم3412", "حاص1965", "بقم3410", "بقل5954", "بقم3283", "بقم3402", "بقم3231", "بقم3406", "بلط3883", "انل6414", "نيم736", "اعا9360", "برك1092", "اعا9362", "مني672", "بلع5289", "انل6428", "انل6413", "اطع6677", "انل6442", "يال698", "بلع5287", "برق2588", "بلع5075", "انل6448", "برق2013", "اعا9365", "انل6561", "امط6562", "انل6589", "هاب635", "يطل622", "يمل624", "انل6579", "انل6440", "عصو884", "امط6561", "بلع5074", "يطل447", "برق2086", "برك1095", "اكح9352", "برح4842", "انل6409", "برك1089", "نيم701", "مني683", "اعا9363", "بلط3933", "برح4843", "بعص2226", "حير4923"]}, {"name": "جيب دايهاتسو سلامة", "plates": ["بقد3882", "حنب9768", "حمح4348", "حمح4337", "حمح4433", "حمح4415", "حمح4079", "حنب9060", "حمح4426", "حله6939", "حمح4465"]}, {"name": "سيارة انارة", "plates": ["امم1074", "الط6396", "الط1017", "باق1842", "اصم3133", "باق1832", "امب1198", "الط1018", "الط1015", "الط1009", "امك4028", "اهم2404", "ببا5823", "باق1840"]}, {"name": "سلالم", "plates": ["صهط219", "اصم3546", "بحن213", "امن7536", "امن7531", "باق1802", "باد8505", "باد8473", "اصم3047", "اار4625", "ارر9193", "اكي8267"]}, {"name": "سنوركل", "plates": ["حاب750", "بمم335"]}, {"name": "اليات ثقيلة", "plates": ["اكل2362", "اسق2410", "ابح6452", "اقي7559", "اقي7558", "اقي7557", "ااك5156"]}, {"name": "اطفاء الحرائق الصناعية", "plates": ["اقي2545", "اقي2546", "بصا2622"]}, {"name": "ونش سحب", "plates": ["باد4513", "بحق7112", "الط1122", "اعك7362"]}, {"name": "وايت المباني العالية", "plates": ["بسع2827", "بحق7105", "بحق7103", "بحق7117"]}, {"name": "وايت ماء", "plates": ["بدق3669", "بدق3654", "بدق3664", "بدق3659", "ارل1009", "ارا7181", "ارا7175", "ارا7183", "ارا7095", "صهم268", "اصم3347", "ارح8875", "ارا7722", "ارل1036", "ارل1010", "صلا596", "ارا7192", "ارر6612", "اصم3800", "رصس605", "ارر6613", "ادم3126", "صلا197", "ادم4920", "ارا7190", "اصم3618", "ارر6610", "سوح661", "دعب499", "سوح662", "سقه681", "حسل107", "سقه393", "سوح361", "ادم4903", "سقه426", "ادم4909", "سحط156", "ادم2805", "صكس35", "رصس615", "اصم3746", "رصس609", "اصم3999", "اصم3611", "ادم2617", "اقي7543", "ادم2209", "اقي7538", "ادم2208", "اقي7540", "دنل656", "اقي7542", "اقي7539", "ادم3140", "ادم2609", "ادم2607", "ادم2212", "رصس200", "ادم4908", "اقي7537", "اصم3747", "ادم2605", "ادم2611", "ادم2814", "ادم2815", "ادم4907", "ادم2203", "ادم2214", "اقي7541", "ادم2616", "ادم2832", "اقي7533", "ادم2206", "دنل713", "ادم3118", "اين3852", "اين3851", "اين3866", "اين3859", "اين3860"]}, {"name": "وايت جبلي", "plates": []}, {"name": "شيول", "plates": ["احب1779", "اسق2409", "اسق2412", "ادع2018", "ادط6360"]}, {"name": "دراجة نارية", "plates": ["هح565", "هح564", "صا661", "صا159", "حح919", "حح654", "قب605", "قب615", "قب613", "صا647", "صا194", "قب688", "صا238", "صا133", "صا179", "قب678", "قب639", "صا178", "صا156", "صا175", "قب628", "صا605", "هب769", "صا263", "قب657", "هب723", "صا451", "قب670", "قب675", "صا286", "قب579", "حح933", "حح692", "لا3586", "لا3585", "قب3657", "قب3658"], "noPlateTypes": ["دراجة نارية (4*4) للبحث والانقاذ", "دراجة نارية ذات 4 كفرات مزودة بجهاز اطفاء بالرغوة كبير"]}];

const WEEKLY_STATUS = {
  rejee: ["تحت إجراءات الرجيع", "صدر قرار الرجيع"],
  broken: ["عطلانة", "تحت التجهيز والتسليم"],
  ok: ["تعمل", "تعمل بوجود ملاحظات", "تم الإصلاح"],
};
// تصنيف الآلية لعمود التقرير الأسبوعي (وإلا: أخرى)
function weeklyColOf(v) {
  const np = normPlate(v.plate);
  const t = (v.type || "").trim();
  for (const c of WEEKLY_COLS) {
    if (c.plates.includes(np)) return c.name;
    if (c.noPlateTypes && (np === "بدون" || np === "") && c.noPlateTypes.includes(t)) return c.name;
  }
  return "اخرى";
}

// ====== المزامنة عبر GitHub (المستودع نفسه قاعدة البيانات) ======
const GH = { owner: "alsubhi1415-dev", repo: "Akram.Su", path: "data.json", branch: "main" };
const GH_API = "https://api.github.com/repos/" + GH.owner + "/" + GH.repo + "/contents/" + GH.path;
const _cid = Math.random().toString(36).slice(2, 10);
const b64enc = (s) => btoa(unescape(encodeURIComponent(s)));
const b64dec = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
// تشفير رمز الربط بمفتاح مشتق من كلمة السر (يفك على جهاز من يملكها فقط)
function xorHex(text, keyHex) {
  let out = "";
  let ks = "";
  let ctr = 0;
  while (ks.length < text.length * 2) { ks += sha256(keyHex + ":" + ctr); ctr++; }
  for (let n = 0; n < text.length; n++) {
    const b = text.charCodeAt(n) ^ parseInt(ks.substr(n * 2, 2), 16);
    out += (b < 16 ? "0" : "") + b.toString(16);
  }
  return out;
}
function xorUnhex(hex, keyHex) {
  try {
    let ks = "";
    let ctr = 0;
    while (ks.length < hex.length) { ks += sha256(keyHex + ":" + ctr); ctr++; }
    let out = "";
    for (let n = 0; n < hex.length / 2; n++) {
      out += String.fromCharCode(parseInt(hex.substr(n * 2, 2), 16) ^ parseInt(ks.substr(n * 2, 2), 16));
    }
    return out;
  } catch { return ""; }
}
const RAW = "https://raw.githubusercontent.com/" + GH.owner + "/" + GH.repo + "/" + GH.branch + "/";
const VER_PATH = "ver.json";
const API_BASE = "https://api.github.com/repos/" + GH.owner + "/" + GH.repo + "/contents/";
// قراءة المؤشر: الواجهة الرسمية أولاً (طازجة دائماً، والـ304 لا يُحتسب)، والخام احتياط عند تجاوز الحصة
async function readVer(token, st) {
  try {
    const h = { Accept: "application/vnd.github.raw" };
    if (token) h.Authorization = "Bearer " + token;
    if (st.etagV) h["If-None-Match"] = st.etagV;
    const r = await fetch(API_BASE + VER_PATH + "?ref=" + GH.branch, { headers: h, cache: "no-store" });
    if (r.status === 304) return { unchanged: true };
    if (r.status === 404) return { missing: true };
    if (r.status === 403 || r.status === 429) throw new Error("rate");
    if (!r.ok) throw new Error("ver " + r.status);
    st.etagV = r.headers.get("ETag");
    return { fresh: true, ver: JSON.parse(await r.text()) };
  } catch (e) {
    // احتياط الخام (قد يتأخر دقائق بسبب كاش الشبكة لكنه لا يتوقف أبداً)
    const r2 = await fetch(RAW + VER_PATH + "?nc=" + Date.now(), { cache: "no-store", headers: st.etagRV ? { "If-None-Match": st.etagRV } : {} });
    if (r2.status === 304) return { unchanged: true };
    if (r2.status === 404) return { missing: true };
    if (!r2.ok) throw e;
    st.etagRV = r2.headers.get("ETag");
    return { fresh: false, ver: await r2.json() };
  }
}
async function readData(token, wantRev) {
  try {
    const h = { Accept: "application/vnd.github.raw" };
    if (token) h.Authorization = "Bearer " + token;
    const r = await fetch(API_BASE + GH.path + "?ref=" + GH.branch, { headers: h, cache: "no-store" });
    if (r.status === 403 || r.status === 429) throw new Error("rate");
    if (!r.ok) throw new Error("data " + r.status);
    return await r.text();
  } catch (e) {
    const r2 = await fetch(RAW + GH.path + "?nc=" + encodeURIComponent(wantRev), { cache: "no-store" });
    if (!r2.ok) throw e;
    return await r2.text();
  }
}
// الكتابة عبر واجهة GitHub الرسمية (برمز الربط)
async function ghGetSha(token, path) {
  const r = await fetch("https://api.github.com/repos/" + GH.owner + "/" + GH.repo + "/contents/" + path + "?ref=" + GH.branch, {
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token },
  });
  if (r.status === 404) return null;
  if (r.status === 401 || r.status === 403) throw new Error("gh-auth");
  if (!r.ok) throw new Error("gh-sha " + r.status);
  return (await r.json()).sha;
}
async function ghPutFile(token, path, text, sha, msg) {
  const body = { message: msg, content: b64enc(text), branch: GH.branch };
  if (sha) body.sha = sha;
  const r = await fetch("https://api.github.com/repos/" + GH.owner + "/" + GH.repo + "/contents/" + path, {
    method: "PUT",
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 401 || r.status === 403) throw new Error("gh-auth");
  if (r.status === 409 || r.status === 422) throw new Error("gh-conflict");
  if (!r.ok) throw new Error("gh-write " + r.status);
  const j = await r.json();
  return j.content && j.content.sha;
}
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

// ====== الثوابت ======
const STATUSES = [
  "تعمل", "عطلانة", "تم الإصلاح", "تعمل بوجود ملاحظات",
  "تحت التجهيز والتسليم", "تحت إجراءات الرجيع", "صدر قرار الرجيع",
];
// خيار مجمّع في فلتر الحالة الفنية بصفحة التقارير: يضم الحالات الجاهزة للعمل
const READY_GROUP = "مجموعة الآليات الجاهزة للعمل";
const READY_STATUSES = ["تعمل", "تم الإصلاح", "تعمل بوجود ملاحظات"];

const STATUS_COLORS = {
  "تعمل": { bg: "#E5F3EB", text: "#1E6B44", dot: "#2E9E63" },
  "عطلانة": { bg: "#FBE9EA", text: "#8F1C22", dot: "#C4353C" },
  "تم الإصلاح": { bg: "#E4F1F7", text: "#1F5A7A", dot: "#2E8BB8" },
  "تعمل بوجود ملاحظات": { bg: "#FDF3E1", text: "#8A5A0B", dot: "#E8A33D" },
  "تحت التجهيز والتسليم": { bg: "#E2F2F0", text: "#0B5A52", dot: "#12897C" },
  "تحت إجراءات الرجيع": { bg: "#EEEAF6", text: "#4E3D80", dot: "#7A64B8" },
  "صدر قرار الرجيع": { bg: "#E3E5E9", text: "#4A5160", dot: "#8B93A3" },
};
const TYPE_SUGGESTIONS = [
  "مضخة إطفاء", "سلم آلي", "رافعة", "صهريج مياه", "إنقاذ", "إسعاف",
  "دينا", "وايت", "باص", "سيارة قيادة", "دراجة نارية", "شيول", "ونش",
];
const FAULT_TYPES = [
  "عطل ميكانيكي", "كهربائي", "بطاريات", "مضخات", "كفرات", "برمجة",
  "خلل فني", "تجديد ودهان", "حادث مروري", "أخرى",
];
const STORAGE_KEY = "cd-fleet:db";

// ====== خريطة الشعب الميدانية ومراكزها ======
// التجميع الإحصائي يتم على مستوى الشعبة؛ كل مركز يُنسب لشعبته تلقائياً مهما اختلفت صيغة كتابته
// الجهات المستقلة (السلامة الميدانية، المواد الخطرة، التموين، ثول، قسم الدعم والإسناد) تبقى بذاتها
function normU(s) {
  return (s || "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();
}
const BRANCH_RULES = [
  // جهات مستقلة تُعرض باسمها كما هو (الأسبقية لها قبل مطابقة الشعب)
  { name: "__self__", test: ["السلامه الميدانيه"] },
  { name: "__self__", test: ["التدخل في المواد الخطره"] },
  { name: "شعبة التموين والمستودعات", test: ["التموين والمستودعات"] },
  { name: "قسم الدعم والإسناد", test: ["الدعم والاسناد", "قسم الاسناد"] },
  { name: "مركز ثول", test: ["قصر الجزيره", "مجد 2"] },
  { name: "__self__", test: ["ثول"] },
  // الأنماط الأكثر تحديداً قبل العامة لمنع التداخل
  { name: "شعبة الساحل الجنوبي", test: ["الصناعيه الثانيه", "الساحل الجنوبي", "بالكورنيش", "بطريق الساحل", "بالخمره", "بالمستودعات", "جنوب 1", "جنوب 2", "جنوب 3", "جنوب 4", "جنوب 5"] },
  { name: "شعبة البغدادية", test: ["اسكان الشرفيه", "البغداديه", "بالحمراء", "باب مكه", "بالخاسكيه", "بالشرفيه", "بلد 1", "بلد 2", "بلد 3", "بلد 4", "بلد 5"] },
  { name: "شعبة الاسكان", test: ["الاسكان الجنوبي", "ام السلم", "بالالفيه", "الحرزات الشرقي", "الحرازات الشرقي", "بالمحاميد", "اسكان"] },
  { name: "شعبة الجامعة", test: ["الجامعه", "بالروابي", "قويزه", "المنتزهات", "الحرازات الشمالي", "الحرزات الشمالي", "شرق 1", "شرق 2", "شرق 3", "شرق 4", "شرق 5"] },
  { name: "شعبة الشاطئ", test: ["الشاطئ", "الخالديه", "بالروضه", "النهضه", "قصر السلام", "غرب 1", "غرب 2", "غرب 3", "غرب 4", "مجد 1", "مجد 3"] },
  { name: "شعبة الحمدانية", test: ["الحمدانيه", "بريمان", "الرحيلي", "ذهبان", "بحي الرياض", "شمال 1", "شمال 2", "شمال 3", "شمال 4", "شمال 5"] },
  { name: "شعبة العزيزية", test: ["العزيزيه", "الرحاب", "النسيم", "بني مالك", "الاندلس", "وسط 1", "وسط 2", "وسط 3", "وسط 4", "وسط 5"] },
  { name: "شعبة المروة", test: ["المروه", "النزهه", "الربوه", "بالصفا", "الفيصليه", "صفا 1", "صفا 2", "صفا 3", "صفا 4", "صفا 5"] },
  { name: "شعبة أبحر", test: ["ابحر", "المحمديه", "دره العروس"] },
  { name: "شعبة السالمية", test: ["السالميه", "سالميه", "النخيل", "السامر", "المنار"] },
  { name: "شعبة الصناعية", test: ["الصناعيه", "السنابل", "الاسواق الشعبيه", "المرحله الاولي", "صناعيه"] },
  { name: "شعبة خزام", test: ["خزام", "بترومين", "مدائن الفهد", "الكندره", "المصفاه"] },
];
function unifyUnit(u) {
  const s = normU(u);
  if (!s) return "غير محدد";
  for (const r of BRANCH_RULES) {
    if (r.test.some((t) => s.includes(t))) {
      return r.name === "__self__" ? (u || "").replace(/\s+/g, " ").trim() : r.name;
    }
  }
  return (u || "").replace(/\s+/g, " ").trim();
}
const LOGO_KEY = "cd-fleet:logo";

// ====== الشعار الرسمي (مضمّن من الصورة المرفوعة) ======
const DEFAULT_LOGO = "data:image/png;base64,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";

// ====== صورة خلفية الشريط العلوي ======
const HEADER_BG = "data:image/jpeg;base64,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";

// ====== التوقيع الإلكتروني لمعد التقرير (يُضمَّن عند رفع الصورة) ======
const SIGNATURE_IMG = "data:image/png;base64,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";

// ====== البيانات الأولية المحقونة من ملف الإكسل (639 آلية) ======
const SEED_DB = {"vehicles": [{"id": "v_2_اكل2362", "type": "تيدر نقل محروقات صناعه وطنيه", "plate": "ا ك ل 2362", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1112700020001", "chassis": "JAMLP3457B7P02403", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "قاطرة المحروقات الاسناد", "faults": [{"_id": 2000, "faultType": "عطل ميكانيكي", "date": "1447/12/25", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "الدسك والصحن والحذاف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_3_اسق2410", "type": "جرافة تركتر كبير", "plate": "ا س ق 2410", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1109700010001", "chassis": "48W14586", "color": "رسمية - اصفر", "model": "1976", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 3000, "faultType": "عطل ميكانيكي", "date": "1447/08/20", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "مسامير الجنزير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_4_ابح6452", "type": "حفار ودقاق بوكلين", "plate": "ا ب ح 6452", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1110700010001", "chassis": "200L35354", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_5_اقي7559", "type": "حواس", "plate": "ا ق ى 7559", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1111700030001", "chassis": "N6M430345", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_6_بدون", "type": "دراجة نارية (4*4) للبحث والانقاذ", "plate": "بدون", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1306700020001", "chassis": "JKAVFDG14FB508540", "color": "غير مخصصة", "model": "بدون", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 6000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_7_بدون", "type": "دراجة نارية (4*4) للبحث والانقاذ", "plate": "بدون", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1306700020001", "chassis": "JKAVFDG19FB508551", "color": "غير مخصصة", "model": "بدون", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 7000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_8_بدون", "type": "دراجة نارية ذات 4 كفرات مزودة بجهاز اطفاء بالرغوة كبير", "plate": "بدون", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1306700010002", "chassis": "WR9KLM1PN3MX", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة البغدادية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 8000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_9_بدون", "type": "دراجة نارية ذات 4 كفرات مزودة بجهاز اطفاء بالرغوة كبير", "plate": "بدون", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1306700010002", "chassis": "WR9KLM1PN3MH", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة أبحر", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 9000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_10_هح565", "type": "دراجة نارية مزودة بجهاز اطفاء بالرغوة يدوي متنقل نوع BMW", "plate": "ه ح 565", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1306700010001", "chassis": "WB104300XCZW46665", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة البغدادية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 10000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_11_هح564", "type": "دراجة نارية مزودة بجهاز اطفاء بالرغوة يدوي متنقل نوع BMW", "plate": "ه ح 564", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1306700010001", "chassis": "WB104300CZW52145", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة أبحر", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 11000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_12_صا661", "type": "دراجة نارية ياماها 250", "plate": "ص ا 661", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1303700010001", "chassis": "JYA4TN00000014030", "color": "رسمية - اخضر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 12000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/03", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_13_صا159", "type": "دراجة نارية ياماها 250", "plate": "ص ا 159", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN00000014185", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الإسكان الجنوبي", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 13000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_14_حح919", "type": "دراجة نارية ياماها 250", "plate": "ح ح 919", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN0073A014493", "color": "رسمية - اخضر", "model": "2011", "location": "شعبة الإسكان الجنوبي", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 14000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_15_حح654", "type": "دراجة نارية ياماها 250", "plate": "ح ح 654", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN00X3A014567", "color": "رسمية - اخضر", "model": "2011", "location": "شعبة الإسكان الجنوبي", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 15000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_16_قب605", "type": "دراجة نارية ياماها 250", "plate": "ق ب 605", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014064", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة البغدادية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 16000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_17_قب615", "type": "دراجة نارية ياماها 250", "plate": "ق ب 615", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1303700010001", "chassis": "JYA4TN00000014032", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 17000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_18_قب613", "type": "دراجة نارية ياماها 250", "plate": "ق ب 613", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1303700010001", "chassis": "JYA4TN00000014052", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 18000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_19_صا647", "type": "دراجة نارية ياماها 250", "plate": "ص ا 647", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1303700010001", "chassis": "JYA4TN00000014145", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 19000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_20_صا194", "type": "دراجة نارية ياماها 250", "plate": "ص ا 194", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014036", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 20000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_21_قب688", "type": "دراجة نارية ياماها 250", "plate": "ق ب 688", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014152", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 21000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_22_صا238", "type": "دراجة نارية ياماها 250", "plate": "ص ا 238", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014207", "color": "رسمية - اخضر", "model": "2010", "location": "الصيانة المركزية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 6-2-1448 ولم ترفع متعطله", "faults": [{"_id": 22000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/08", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_23_صا133", "type": "دراجة نارية ياماها 250", "plate": "ص ا 133", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014272", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 23000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_24_صا179", "type": "دراجة نارية ياماها 250", "plate": "ص ا 179", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1303700010001", "chassis": "JYA4TN00000014225", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة خزام", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 24000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_25_قب678", "type": "دراجة نارية ياماها 250", "plate": "ق ب 678", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1303700010001", "chassis": "JYA4TN00000014301", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة خزام", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 25000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_26_قب639", "type": "دراجة نارية ياماها 250", "plate": "ق ب 639", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1303700010001", "chassis": "JYA4TN00000014302", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة خزام", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 26000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_27_صا178", "type": "دراجة نارية ياماها 250", "plate": "ص ا 178", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN00000014182", "color": "رسمية - اخضر", "model": "2010", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 27000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_28_صا156", "type": "دراجة نارية ياماها 250", "plate": "ص ا 156", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN00000014210", "color": "رسمية - اخضر", "model": "2010", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 28000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_29_صا175", "type": "دراجة نارية ياماها 250", "plate": "ص ا 175", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1303700010001", "chassis": "JYA4TN00000014215", "color": "رسمية - اخضر", "model": "2010", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 29000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_30_قب628", "type": "دراجة نارية ياماها 250", "plate": "ق ب 628", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014283", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة السالمية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 30000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_31_صا605", "type": "دراجة نارية ياماها 250", "plate": "ص ا 605", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1303700010001", "chassis": "JYA4TN0000013903", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة السالمية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 31000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_32_هب769", "type": "دراجة نارية ياماها 250", "plate": "ه ب 769", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1303700010001", "chassis": "JYA4TN0013A014392", "color": "رسمية - اخضر", "model": "2011", "location": "شعبة السالمية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 32000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_33_صا263", "type": "دراجة نارية ياماها 250", "plate": "ص ا 263", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1303700010001", "chassis": "JYA4TN00000014227", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 33000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_34_قب657", "type": "دراجة نارية ياماها 250", "plate": "ق ب 657", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1303700010001", "chassis": "JYA4TN00000014279", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 34000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_35_هب723", "type": "دراجة نارية ياماها 250", "plate": "ه ب 723", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1303700010001", "chassis": "JYA4TN0033A014572", "color": "رسمية - اخضر", "model": "2011", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 35000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_36_صا451", "type": "دراجة نارية ياماها 250", "plate": "ص ا 451", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1303700010001", "chassis": "JYA4TN00000013926", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 36000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_37_قب670", "type": "دراجة نارية ياماها 250", "plate": "ق ب 670", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014123", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 37000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_38_قب675", "type": "دراجة نارية ياماها 250", "plate": "ق ب 675", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1303700010001", "chassis": "JYA4TN00000014161", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 38000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_39_صا286", "type": "دراجة نارية ياماها 250", "plate": "ص ا 286", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1303700010001", "chassis": "JYA4TN00000014139", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 39000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_40_قب579", "type": "دراجة نارية ياماها 250", "plate": "ق ب 579", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1303700010001", "chassis": "JYA4TN00000014297", "color": "رسمية - اخضر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 40000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_41_حح933", "type": "دراجة نارية ياماها 250", "plate": "ح ح 933", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1303700010001", "chassis": "JYA4TN0023A014417", "color": "رسمية - اخضر", "model": "2011", "location": "شعبة المروة", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 41000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_42_حح692", "type": "دراجة نارية ياماها 250", "plate": "ح ح 692", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1303700010001", "chassis": "JYA4TN0043A014497", "color": "رسمية - اخضر", "model": "2011", "location": "شعبة أبحر", "status": "عطلانة", "notes": "تاريخ ادارج العطل وليس تاريخ العطل نفسه", "faults": [{"_id": 42000, "faultType": "أخرى", "date": "1447/09/01", "repairDate": "", "causedBy": "", "desc": "تحتاج الى صيانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_43_لا3586", "type": "دراجة نارية ياماها 900 (ثلاث كفرات)", "plate": "ل ا 3586", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1303700020001", "chassis": "JYARN84Y1PA000306", "color": "رسمية - اصفر", "model": "2023", "location": "شعبة البغدادية", "status": "تعمل", "notes": "تم تغيير الزيوت بتاريخ 13-11-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_44_لا3585", "type": "دراجة نارية ياماها 900 (ثلاث كفرات)", "plate": "ل ا 3585", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1303700020001", "chassis": "JYARN84Y0PA000314", "color": "رسمية - اصفر", "model": "2023", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_45_اقي7558", "type": "رافعة 160 طن", "plate": "ا ق ى 7558", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1107700010002", "chassis": "WFN5RUDR172029185", "color": "رسمية - اصفر", "model": "2007", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 45000, "faultType": "عطل ميكانيكي", "date": "1441/11/19", "repairDate": "", "causedBy": "", "desc": "تهريب في زيت الذراع الايسر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_46_اقي7557", "type": "رافعة 50 طن", "plate": "ا ق ى 7557", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1107700010001", "chassis": "JTX4255A660DC0024", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد 12 يوم الإصلاح السابق", "faults": [{"_id": 46000, "faultType": "أخرى", "date": "1447/11/02", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تحتاج طقم كلتش + فحمات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_47_ااك5156", "type": "رافعة شوكية", "plate": "ا ا ك 5156", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1107700010003", "chassis": "84184", "color": "رسمية - اصفر", "model": "1975", "location": "", "status": "تعمل", "notes": "لدى الصيانة المركزية", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_48_باق5918", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ا ق 5918", "unit": "مركز الدفاع المدني بالأسكان الجنوبي", "itemNo": "1102700020004", "chassis": "1FD8W3H65FEB41200", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 48000, "faultType": "أخرى", "date": "1448/01/23", "repairDate": "1448/01/24", "causedBy": "مركز اسكان 1 ( الاسكان الجنوبي )", "desc": "تهريب ماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_49_اعك7739", "type": "سيارات انقاذ صغيرة فورد", "plate": "ا ع ك 7739", "unit": "مركز الدفاع المدني بالسنابل", "itemNo": "1102700020004", "chassis": "1FD8W3H67DEB64460", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 23-11-1447", "faults": [{"_id": 49000, "faultType": "أخرى", "date": "1447/11/23", "repairDate": "1447/11/25", "causedBy": "صناعية 5", "desc": "الرديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_50_باق1510", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ا ق 1510", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1102700020004", "chassis": "1FD8W3H69FEB41068", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "شعبة العزيزية", "faults": [{"_id": 50000, "faultType": "عطل ميكانيكي", "date": "1446/02/18", "repairDate": "", "causedBy": "صفا 2", "desc": "عطل في الجيربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_51_اعك7732", "type": "سيارات انقاذ صغيرة فورد", "plate": "ا ع ك 7732", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1102700020004", "chassis": "1FD8W3H63DEB64553", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 51000, "faultType": "عطل ميكانيكي", "date": "1447/07/28", "repairDate": "", "causedBy": "شمال 1", "desc": "عطل بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_52_باد8440", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ا د 8440", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700020004", "chassis": "1FD8W3H6XFEB41189", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 52000, "faultType": "عطل ميكانيكي", "date": "1447/09/09", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "صوت في البكرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_53_ببا2217", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ب ا 2217", "unit": "مركز الدفاع المدني بالحمراء", "itemNo": "1102700020004", "chassis": "1FD8W3H66FEB41108", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 53000, "faultType": "أخرى", "date": "1448/01/24", "repairDate": "", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "تهريب من علبة الدركسون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_54_بحي8048", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ح ى 8048", "unit": "مركز الدفاع المدني بالخزام", "itemNo": "1102700020004", "chassis": "1FD8W3H65HEC25343", "color": "رسمية - اصفر", "model": "2017", "location": "شعبة خزام", "status": "عطلانة", "notes": "", "faults": [{"_id": 54000, "faultType": "عطل ميكانيكي", "date": "1447/11/21", "repairDate": "1447/11/17", "causedBy": "خزام 1", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_55_باد8783", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ا د 8783", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1102700020004", "chassis": "1FD8W3H62FEB41171", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_56_باد8450", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ا د 8450", "unit": "مركز الدفاع المدني بالجامعة", "itemNo": "1102700020004", "chassis": "1FD8W3H68FEB41109", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "شرق4", "faults": [{"_id": 56000, "faultType": "عطل ميكانيكي", "date": "1446/06/22", "repairDate": "", "causedBy": "شرق 4", "desc": "عطل في الجربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_57_بحي8041", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ح ى 8041", "unit": "مركز الدفاع المدني بقويزة", "itemNo": "1102700020004", "chassis": "1FD8W3H69HEC25328", "color": "رسمية - اصفر", "model": "2017", "location": "شعبة الجامعة", "status": "تعمل بوجود ملاحظات", "notes": "تم تفعليه برغم من الأعطال حتى يتم طلب الالية للإصلاح", "faults": [{"_id": 57000, "faultType": "عطل ميكانيكي", "date": "1447/05/22", "repairDate": "", "causedBy": "شرق 3", "desc": "تهريب زيت دركسون من العلبه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_58_ببا2174", "type": "سيارات انقاذ صغيرة فورد", "plate": "ب ب ا 2174", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1102700020004", "chassis": "1FD8W3H64FEB41074", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الحمدانية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_59_صوع284", "type": "سيارات انقاذ كبيرة جمس", "plate": "ص و ع 284", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010001", "chassis": "1GDJK33U96F153606", "color": "رسمية - اصفر", "model": "2006", "location": "الصيانة المركزية", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 59000, "faultType": "أخرى", "date": "1447/06/19", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_60_ابم7403", "type": "سيارات انقاذ كبيرة جمس", "plate": "ا ب م 7403", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010001", "chassis": "1FDWW37Y98EB05376", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 60000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_61_احع3212", "type": "سيارات انقاذ كبيرة جمس", "plate": "ا ح ع 3212", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010001", "chassis": "1FDWW37YX8EB05399", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 61000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_62_ابم7402", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ب م 7402", "unit": "مركز الدفاع المدني بالروضة", "itemNo": "1102700010004", "chassis": "1FDWW37Y48EB05401", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "تالفة", "faults": [{"_id": 62000, "faultType": "حادث مروري", "date": "1436/01/01", "repairDate": "", "causedBy": "مركز غرب 3 ( الروضة )", "desc": "رجيع وتالفة من قبل عام 1436 — الإصلاح: حادث مروري قديم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_63_دسا420", "type": "سيارات انقاذ كبيرة فورد", "plate": "د س ا 420", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "LFDWW37S42EC63112", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "س س أ 4201", "faults": [{"_id": 63000, "faultType": "أخرى", "date": "1447/06/18", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_64_سسق642", "type": "سيارات انقاذ كبيرة فورد", "plate": "س س ق 642", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1102700010004", "chassis": "1FDWW37S23EC54071", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 64000, "faultType": "أخرى", "date": "1445/02/10", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "الادراج الجانبية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_65_اصم3631", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ص م 3631", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37S53EC54047", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 65000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_66_سسق249", "type": "سيارات انقاذ كبيرة فورد", "plate": "س س ق 249", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37S63EC54073", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 66000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_67_احع3196", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ح ع 3196", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1102700010004", "chassis": "1FDWW37Y78EB05408", "color": "رسمية - اصفر", "model": "2008", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 67000, "faultType": "أخرى", "date": "1447/06/20", "repairDate": "", "causedBy": "شعبة السالمية", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_68_اصم3845", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ص م 3845", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1102700010004", "chassis": "1FDWW3HY6AEA69487", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 68000, "faultType": "أخرى", "date": "1448/01/21", "repairDate": "1448/01/20", "causedBy": "وسط 2", "desc": "ارتجاج وحذفه + الانوار + الكفرات + والمكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_69_صلع404", "type": "سيارات انقاذ كبيرة فورد", "plate": "ص ل ع 404", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37YX6EC99655", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 69000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_70_ابم7397", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ب م 7397", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37Y88EB05370", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 70000, "faultType": "أخرى", "date": "1445/02/10", "repairDate": "", "causedBy": "", "desc": "الادارج الجانبية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_71_صرك285", "type": "سيارات انقاذ كبيرة فورد", "plate": "ص ر ك 285", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37Y27EA42734", "color": "رسمية - اصفر", "model": "2007", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 71000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_72_ابم7388", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ب م 7388", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37Y88EB05353", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 72000, "faultType": "عطل ميكانيكي", "date": "1445/09/02", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "حرارة + تهريب مياه + سمكرة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_73_احع3182", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ح ع 3182", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1102700010004", "chassis": "1FDWW37Y28EB05381", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 73000, "faultType": "أخرى", "date": "1443/02/25", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "الادراج"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_74_احع3209", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ح ع 3209", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1102700010004", "chassis": "1FDWW37Y58EB05374", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 74000, "faultType": "أخرى", "date": "1444/08/05", "repairDate": "", "causedBy": "", "desc": "الادراج +السفتي +الونان+الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_75_احع3224", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ح ع 3224", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1102700010004", "chassis": "1FDWW37Y48EB05382", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 75000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_76_انط2420", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ن ط 2420", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1102700010004", "chassis": "1FD8W3H64CEB64480", "color": "رسمية - اصفر", "model": "2012", "location": "مركز ثول", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 76000, "faultType": "عطل ميكانيكي", "date": "1447/05/11", "repairDate": "1447/11/12", "causedBy": "مركز ثول", "desc": "تهريب زيت من باكم الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_77_انط2412", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ن ط 2412", "unit": "مركز الدفاع المدني بالربوة", "itemNo": "1102700010004", "chassis": "1FD8W3H63CEB64499", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة المروة", "status": "عطلانة", "notes": "", "faults": [{"_id": 77000, "faultType": "أخرى", "date": "1447/10/06", "repairDate": "", "causedBy": "صفا 3", "desc": "انقطاع السير وتهريب الماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_78_انط2419", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ن ط 2419", "unit": "مركز الدفاع المدني بالنزهة", "itemNo": "1102700010004", "chassis": "1FD8W3H67CEB64487", "color": "رسمية - اصفر", "model": "2012", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 78000, "faultType": "أخرى", "date": "1448/01/26", "repairDate": "1447/12/25", "causedBy": "صفا 2", "desc": "تهريب في تانكي البنزين"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_79_امن8199", "type": "سيارات انقاذ كبيرة فورد", "plate": "أ م ن 8199", "unit": "مركز الدفاع المدني بحى المنار", "itemNo": "1102700010004", "chassis": "1FD8W3H65CEB64472", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة السالمية", "status": "عطلانة", "notes": "تم الاستلام واتضح وجود عطل جديد بنفس يوم الاستلام", "faults": [{"_id": 79000, "faultType": "أخرى", "date": "1448/01/24", "repairDate": "1448/01/23", "causedBy": "سالمية 5", "desc": "اقمشة ومقصات والونان"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_80_امن8209", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا م ن 8209", "unit": "مركز الدفاع المدني بحي النهضة", "itemNo": "1102700010004", "chassis": "1FD8W3H61CEB64484", "color": "رسمية - اصفر", "model": "2012", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 80000, "faultType": "عطل ميكانيكي", "date": "1447/02/13", "repairDate": "", "causedBy": "غرب 3", "desc": "ضعف في الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_81_صلع255", "type": "سيارات انقاذ كبيرة فورد", "plate": "ص ل ع 255", "unit": "مركز الدفاع المدني بقصر الجزيرة بثول", "itemNo": "1102700010004", "chassis": "1FDWW37Y16EC99611", "color": "رسمية - اصفر", "model": "2006", "location": "مركز ثول", "status": "تحت إجراءات الرجيع", "notes": "بديل من ثول", "faults": [{"_id": 81000, "faultType": "عطل ميكانيكي", "date": "1445/02/26", "repairDate": "", "causedBy": "مجد 2", "desc": "عطل بالجيربوكس — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_82_انط2415", "type": "سيارات انقاذ كبيرة فورد", "plate": "ا ن ط 2415", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1102700010004", "chassis": "1FD8W3H6XCEB64502", "color": "رسمية - اصفر", "model": "2012", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 82000, "faultType": "عطل ميكانيكي", "date": "1446/03/13", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "خلط ماء مع الزيت"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_83_بلص9475", "type": "سيارة اسعاف صالون جمس", "plate": "ب ل ص 9475", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1104700010001", "chassis": "3GKFK16T05G272258", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 83000, "faultType": "أخرى", "date": "1447/05/04", "repairDate": "1447/11/05", "causedBy": "شعبة الاسكان", "desc": "بطاريات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_84_هدب284", "type": "سيارة اسعاف صالون جمس", "plate": "ه د ب 284", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700010001", "chassis": "3GKFK16T95G271948", "color": "رسمية - اصفر", "model": "2005", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 84000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_85_وصر7154", "type": "سيارة اسعاف صالون جمس", "plate": "و ص ر 7154", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700010001", "chassis": "1GKFK16T36J177919", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_86_وعح619", "type": "سيارة اسعاف صالون جمس", "plate": "و ع ح 619", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700010001", "chassis": "1Gkfk16t36j176505", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 86000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_87_وصر276", "type": "سيارة اسعاف صالون جمس", "plate": "و ص ر 276", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1104700010001", "chassis": "1GKFK16T06J174136", "color": "رسمية - اصفر", "model": "2006", "location": "مركز ثول", "status": "تحت إجراءات الرجيع", "notes": "مركز ثول", "faults": [{"_id": 87000, "faultType": "كهربائي", "date": "1447/04/16", "repairDate": "", "causedBy": "ثول", "desc": "اعطال كهربائية — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_88_احن6662", "type": "سيارة اسعاف صالون فورد", "plate": "أ ح ن 6662", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1104700010004", "chassis": "1fmnu41s64eb04093", "color": "رسمية - اصفر", "model": "2004", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 88000, "faultType": "أخرى", "date": "1447/12/25", "repairDate": "1448/01/17", "causedBy": "شمال 3", "desc": "ارتفاع درجة الحرارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_89_اهب4029", "type": "سيارة اسعاف فان جمس", "plate": "ا ه ب 4029", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1104700020001", "chassis": "1GTW78CG5C1197663", "color": "رسمية - اصفر وابيض", "model": "2012", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "", "faults": [{"_id": 89000, "faultType": "أخرى", "date": "1447/12/29", "repairDate": "1447/11/06", "causedBy": "شرق 1", "desc": "تسريب فريون والمكيف لايعمل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_90_اهب4251", "type": "سيارة اسعاف فان جمس", "plate": "ا ه ب 4251", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1104700020001", "chassis": "1GTW78CG0C1193679", "color": "رسمية - اصفر وابيض", "model": "2012", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تم تغيير الاقمشة واتضح وجود التماس كهربائي بالماكينة", "faults": [{"_id": 90000, "faultType": "كهربائي", "date": "1447/01/30", "repairDate": "", "causedBy": "وسط 1", "desc": "التماس كهربائي في الكابينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_91_اهب4099", "type": "سيارة اسعاف فان جمس", "plate": "ا ه ب 4099", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1104700020001", "chassis": "1GTW78CG8C1192215", "color": "رسمية - اصفر وابيض", "model": "2012", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_92_اهب4098", "type": "سيارة اسعاف فان جمس", "plate": "ا ه ب 4098", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1104700020001", "chassis": "1GTW78CG2C1195465", "color": "رسمية - اصفر وابيض", "model": "2012", "location": "شعبة المروة", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_93_ادن5244", "type": "سيارة اسعاف فان فورد", "plate": "ا د ن 5244", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1104700020004", "chassis": "1FDSS34P98DB11903", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "الجهة الاسناد", "faults": [{"_id": 93000, "faultType": "عطل ميكانيكي", "date": "1445/10/25", "repairDate": "", "causedBy": "خزام 1", "desc": "اعطال ميكانيكية وكهرباء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_94_ادن5361", "type": "سيارة اسعاف فان فورد", "plate": "ا د ن 5361", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700020004", "chassis": "1FDSS34p38DB11900", "color": "رسمية - اصفر", "model": "2008", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 16-11-1447", "faults": [{"_id": 94000, "faultType": "كهربائي", "date": "1445/02/24", "repairDate": "", "causedBy": "", "desc": "اسلاك الظفيرة +تغيير الكفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_95_ادن8075", "type": "سيارة اسعاف فان فورد", "plate": "ا د ن 8075", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700020004", "chassis": "1FDSS34P38DB11914", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 95000, "faultType": "بطاريات", "date": "1447/04/23", "repairDate": "", "causedBy": "", "desc": "سحب كهرباء وبطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_96_ادن5238", "type": "سيارة اسعاف فان فورد", "plate": "ا د ن 5238", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1104700020004", "chassis": "1fDSS34p78db11916", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 96000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_97_اقي2545", "type": "سيارة اطفاء حرائق صناعية روزنباور", "plate": "أ ق ي 2545", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1101700010006", "chassis": "44KFT64819WZ21491", "color": "رسمية - اصفر", "model": "2009", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "لم يتم الاستلام بتاريخ 24-12-1447 لوجود نفس العطل", "faults": [{"_id": 97000, "faultType": "مضخات", "date": "1447/05/14", "repairDate": "", "causedBy": "صناعية 1", "desc": "المضخة والمؤشرات للماء والرغاوي لاتعمل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_98_اقي2546", "type": "سيارة اطفاء حرائق صناعية روزنباور", "plate": "ا ق ى 2546", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1101700040008", "chassis": "44KFT64849WZ21498", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 98000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/23", "causedBy": "مركز جنوب 1 ( الكورنيش )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_99_ارل2032", "type": "سيارة اطفاء صغيرة فورد", "plate": "ا ر ل 2032", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700020004", "chassis": "1FDXW47F42EC40118", "color": "رسمية - اصفر", "model": "2002", "location": "الصيانة المركزية", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 99000, "faultType": "أخرى", "date": "1445/06/18", "repairDate": "", "causedBy": "خزام 2", "desc": "تهريب ديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_100_ارل2033", "type": "سيارة اطفاء صغيرة فورد", "plate": "أ ر ل 2033", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700020004", "chassis": "1FDXW47F82EC63093", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 100000, "faultType": "أخرى", "date": "1447/02/18", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_101_ارل1850", "type": "سيارة اطفاء صغيرة فورد", "plate": "أ ر ل 1850", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700020004", "chassis": "1FDXW47P33EC54019", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 101000, "faultType": "أخرى", "date": "1447/01/08", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "رجه في السيارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_102_ارل1868", "type": "سيارة اطفاء صغيرة فورد", "plate": "ا ر ل 1868", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700020004", "chassis": "1FDXW4TP84EB32418", "color": "رسمية - اصفر", "model": "2004", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 102000, "faultType": "أخرى", "date": "1447/09/06", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متنوعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_103_سسه560", "type": "سيارة اطفاء صغيرة فورد", "plate": "س س ه 560", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700020004", "chassis": "1FDXW47P54EC84043", "color": "رسمية - اصفر", "model": "2004", "location": "الصيانة المركزية", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 103000, "faultType": "أخرى", "date": "1447/06/19", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_104_ارل1870", "type": "سيارة اطفاء صغيرة فورد", "plate": "ا ر ل 1870", "unit": "مركز الدفاع المدني ببترومين", "itemNo": "1101700020004", "chassis": "1FDXW47P54EB32425", "color": "رسمية - اصفر", "model": "2004", "location": "الصيانة المركزية", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 104000, "faultType": "كهربائي", "date": "1446/04/17", "repairDate": "", "causedBy": "صناعية 4", "desc": "عطل كهربائي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_105_ارل1863", "type": "سيارة اطفاء صغيرة فورد", "plate": "ا ر ل 1863", "unit": "مركز الدفاع المدني بحي البوادي", "itemNo": "1101700020004", "chassis": "1FDXW47P43EC54014", "color": "رسمية - اصفر", "model": "2003", "location": "شعبة المروة", "status": "صدر قرار الرجيع", "notes": "بديل من الاسناد --خزام 2", "faults": [{"_id": 105000, "faultType": "كهربائي", "date": "1445/02/08", "repairDate": "", "causedBy": "شعبة الإسكان الجنوبي", "desc": "عطل في الكهرباء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_106_اصم3859", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3859", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1101700010006", "chassis": "44KFT4281AWZ21745", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "طلبت لشركة روزنباور بتاريخ 9-11-1447 ولم ترفع متعطله - معاودة التعطل بعد يوم واحد من الإصلاح السابق", "faults": [{"_id": 106000, "faultType": "عطل ميكانيكي", "date": "1447/12/29", "repairDate": "1447/12/28", "causedBy": "مركز صفا 3 ( الربوة )", "desc": "كومبرسر تعبأة الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_107_سسص808", "type": "سيارة اطفاء كبيره روزنباور", "plate": "س س ص 808", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT42853WZ19922", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 107000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_108_ساط363", "type": "سيارة اطفاء كبيره روزنباور", "plate": "س ا ط 363", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT42883WZ20126", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 108000, "faultType": "مضخات", "date": "1442/03/30", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "المضخة + يحتاج الى تجديد"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_109_ابه9570", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ب ه 9570", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44kft42893wz20135", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 109000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_110_سدق485", "type": "سيارة اطفاء كبيره روزنباور", "plate": "س د ق 485", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1101700010006", "chassis": "44KFT42804WZ20266", "color": "رسمية - اصفر", "model": "2004", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 110000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_111_اصم3545", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3545", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT42826WZ20806", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 111000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_112_اصم3834", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3834", "unit": "قسم الدعم والاسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT4288AWZ21757", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "تتابع من شعبة الجامعة -الجهة الاسناد", "faults": [{"_id": 112000, "faultType": "حادث مروري", "date": "1446/03/12", "repairDate": "1448/01/29", "causedBy": "وسط 5", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_113_اصم3838", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3838", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT4287AWZ21801", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 113000, "faultType": "مضخات", "date": "1447/01/28", "repairDate": "", "causedBy": "", "desc": "عطل في البرايمر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_114_اصم3932", "type": "سيارة اطفاء كبيره روزنباور", "plate": "أ ص م 3932", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT4282AWZ21771", "color": "رسمية - اصفر", "model": "2010", "location": "ش روزنباور", "status": "عطلانة", "notes": "تم اصلاح عطل الكهرباء بتاريخ 23-11-1447", "faults": [{"_id": 114000, "faultType": "كهربائي", "date": "1448/01/29", "repairDate": "1448/01/23", "causedBy": "شمال2", "desc": "الانوار الامامية عطلانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_115_اصم3857", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3857", "unit": "مركز الدفاع المدني بالبغدادية", "itemNo": "1101700010006", "chassis": "44KFT4287AWZ21782", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 115000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/21", "causedBy": "مركز بلد 2 ( البغدادية )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_116_اصم3537", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3537", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1101700010006", "chassis": "44KFT42846WZ20824", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 116000, "faultType": "مضخات", "date": "1447/04/08", "repairDate": "", "causedBy": "", "desc": "مفتاح المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_117_اصم3910", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3910", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1101700010006", "chassis": "44KFT4281AWZ21759", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة السالمية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 16-11-1447", "faults": [{"_id": 117000, "faultType": "عطل ميكانيكي", "date": "1447/06/05", "repairDate": "", "causedBy": "مركز سالمية 4 ( السامر )", "desc": "تهريب من علبة الدركسون + بطاريات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_118_اصم3974", "type": "سيارة اطفاء كبيره روزنباور", "plate": "أ ص م 3974", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "44KFT4281AWZ21793", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 118000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_119_اصم3544", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3544", "unit": "مركز الدفاع المدني بالسنابل", "itemNo": "1101700010006", "chassis": "44KFT42894WZ20430", "color": "رسمية - اصفر", "model": "2004", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 119000, "faultType": "عطل ميكانيكي", "date": "1446/03/05", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "طرمبة الديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_120_اصم3207", "type": "سيارة اطفاء كبيره روزنباور", "plate": "أ ص م 3207", "unit": "مركز الدفاع المدني بالربوة", "itemNo": "1101700010006", "chassis": "44KFT428XAWZ21792", "color": "رسمية - اصفر", "model": "2010", "location": "ش روزنباور", "status": "عطلانة", "notes": "", "faults": [{"_id": 120000, "faultType": "عطل ميكانيكي", "date": "1447/03/19", "repairDate": "", "causedBy": "صفا 2", "desc": "عطل في الجيربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_121_اصم3907", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3907", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1101700010006", "chassis": "44KFT4284AWZ21741", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "تعمل انقاذ خفيف صفا 2", "faults": [{"_id": 121000, "faultType": "عطل ميكانيكي", "date": "1448/01/20", "repairDate": "1447/11/26", "causedBy": "مركز صفا 4 ( الصفا )", "desc": "ماتعشق - فصلة جميع العدادات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_122_اصم3941", "type": "سيارة اطفاء كبيره روزنباور", "plate": "أ ص م 3941", "unit": "مركز الدفاع المدني بالسامر", "itemNo": "1101700010006", "chassis": "44KFT4286AWZ21773", "color": "رسمية - اصفر", "model": "2010", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "بديل من الاسناد", "faults": [{"_id": 122000, "faultType": "عطل ميكانيكي", "date": "1444/09/22", "repairDate": "", "causedBy": "سالمية 4", "desc": "دودة الدركسون + 6 كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_123_اصم3875", "type": "سيارة اطفاء كبيره روزنباور", "plate": "ا ص م 3875", "unit": "مركز الدفاع المدني بالسنابل", "itemNo": "1101700010006", "chassis": "44KFT428XAWZ21758", "color": "رسمية - اصفر", "model": "2010", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 123000, "faultType": "عطل ميكانيكي", "date": "1446/12/15", "repairDate": "", "causedBy": "صناعية 5", "desc": "تهريب بالرديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_124_اصم3916", "type": "سيارة اطفاء كبيره روزنباور", "plate": "أ ص م 3916", "unit": "مركز الدفاع المدني بالنزهة", "itemNo": "1101700010006", "chassis": "44KFT4288AWZ21774", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "", "faults": [{"_id": 124000, "faultType": "عطل ميكانيكي", "date": "1448/02/01", "repairDate": "1448/01/08", "causedBy": "صفا 2", "desc": "تهريب زيت من المكينة وعطل دعست البنزين"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_125_ارل2031", "type": "سيارة اطفاء كبيره فورد", "plate": "ا ر ل 2031", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1101700010004", "chassis": "1FDXW47F12EC32090", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 125000, "faultType": "أخرى", "date": "1443/08/11", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "تهريب زيوت"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_126_ساب513", "type": "سيارة اطفاء كبيره مرسيدس", "plate": "س ا ب 513", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010005", "chassis": "14943943", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 126000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: معاملتها لدى مراقبة المخزون بالمديرية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_127_اوع4404", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و ع 4404", "unit": "مركز الدفاع المدني بالحمراء", "itemNo": "1101700010006", "chassis": "54F2AA501EWE10370", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 127000, "faultType": "عطل ميكانيكي", "date": "1447/12/17", "repairDate": "1447/10/24", "causedBy": "مركز شمال 2 ( بريمان )", "desc": "أصوات بالهوبات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_128_اعك7441", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ع ك 7441", "unit": "مركز الدفاع المدني بالشاطئ", "itemNo": "1101700010006", "chassis": "54F2AA509DWE10289", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 128000, "faultType": "برمجة", "date": "1447/12/29", "repairDate": "1448/01/02", "causedBy": "غرب 1", "desc": "برمجة المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_129_اوس7235", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7235", "unit": "مركز الدفاع المدني بالفيصلية", "itemNo": "1101700010006", "chassis": "54F2AA500DWE10343", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 129000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/11", "causedBy": "صفا 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_130_بدب8021", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب د ب 8021", "unit": "مركز الدفاع المدني بباب مكة", "itemNo": "1101700010006", "chassis": "54F2AA500GWE11383", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "معاودة تعطل الالية بعد 18 أيام من الإصلاح السابق- طلبت للصيانة بتاريخ 6-11-1447 ولم ترفع متعطله", "faults": [{"_id": 130000, "faultType": "كهربائي", "date": "1447/11/12", "repairDate": "1447/11/18", "causedBy": "بلد 3", "desc": "عطل كهربائي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_131_اوس7266", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7266", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1101700010006", "chassis": "54F2AA508DWE10297", "color": "رسمية - اصفر", "model": "2013", "location": "مركز ثول", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 131000, "faultType": "أخرى", "date": "1447/08/23", "repairDate": "1447/11/12", "causedBy": "مركز ثول", "desc": "قطع في هواء الخاص بالبريك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_132_اين6494", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 6494", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1101700010006", "chassis": "54F2AA507FWE11010", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "عليها حادث بتاريخ 8-9-1445 - طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 132000, "faultType": "عطل ميكانيكي", "date": "1447/05/25", "repairDate": "", "causedBy": "صفا 1", "desc": "القماش ماسك في الهوب الخلفي يمين (فرامل)"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_133_باد8239", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا د 8239", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1101700010006", "chassis": "54F2AA501FWE11052", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 133000, "faultType": "عطل ميكانيكي", "date": "1447/08/14", "repairDate": "", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "تهريب زيت الدفرنس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_134_ببا5913", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ب ا 5913", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1101700010006", "chassis": "54F2AA500FWE11141", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "بطارية بتاريخ 21-1-1448", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_135_اعك7553", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ع ك 7553", "unit": "مركز الدفاع المدني بالصفا", "itemNo": "1101700010006", "chassis": "54F2AA50XDWE10267", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة المروة", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد 3 أيام من الإصلاح", "faults": [{"_id": 135000, "faultType": "أخرى", "date": "1447/10/10", "repairDate": "", "causedBy": "صفا 4", "desc": "تهريب الديزل وذراع الدركسون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_136_انب3286", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "أ ن ب 3286", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700030006", "chassis": "54F2AA507CWE10032", "color": "رسمية - اصفر", "model": "2012", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 136000, "faultType": "عطل ميكانيكي", "date": "1446/03/01", "repairDate": "", "causedBy": "", "desc": "الغمارة لاترتفع"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_137_اعك7448", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ع ك 7448", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "54F2AA507DWE10288", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد 6 أيام بنفس العطل تقريبا", "faults": [{"_id": 137000, "faultType": "عطل ميكانيكي", "date": "1447/12/01", "repairDate": "1447/11/24", "causedBy": "شعبة الحمدانية", "desc": "عطل بالدركسون والاذرعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_138_اين6503", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 6503", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "54F2AA501EWE10692", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الصناعية", "status": "عطلانة", "notes": "معاودة التعطل خلال فترة الضمان", "faults": [{"_id": 138000, "faultType": "عطل ميكانيكي", "date": "1448/02/06", "repairDate": "1448/01/28", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_139_انل4630", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ل 4630", "unit": "مركز الدفاع المدني بالألفية", "itemNo": "1101700010006", "chassis": "54F2AA507CWE10127", "color": "رسمية - اصفر", "model": "2012", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تعمل انقاذ فقط المضخة عطلانة - طلبت للصيانة بتاريخ 6-11-1447", "faults": [{"_id": 139000, "faultType": "مضخات", "date": "1447/10/28", "repairDate": "", "causedBy": "مركز اسكان 3 ( الالفية )", "desc": "المضخة عطلانة + عطل بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_140_اوم7633", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 7633", "unit": "مركز الدفاع المدني بالأندلس", "itemNo": "1101700010006", "chassis": "54F2AA506EWE10641", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة العزيزية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_141_اوس7261", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7261", "unit": "مركز الدفاع المدني بالجامعة", "itemNo": "1101700010006", "chassis": "54F2AA508DWE10302", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "لم يتم رفع عطله بالقروب", "faults": [{"_id": 141000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/13", "causedBy": "شعبة الجامعة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_142_انط2401", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ط 2401", "unit": "مركز الدفاع المدني بالحمدانية", "itemNo": "1101700030006", "chassis": "54F2AA500CWE10034", "color": "رسمية - اصفر", "model": "2012", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_143_ببق2256", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ب ق 2256", "unit": "مركز الدفاع المدني بالخاسكية", "itemNo": "1101700010006", "chassis": "54F2AA50XFWE11194", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "طلبت للصيانة ولم ترفع متعطلة بقروب الأعطال 17-8-1447", "faults": [{"_id": 143000, "faultType": "أخرى", "date": "", "repairDate": "1447/11/03", "causedBy": "خزام 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_144_امط4949", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا م ط 4949", "unit": "مركز الدفاع المدني بالخالدية", "itemNo": "1101700010006", "chassis": "54F2AA500CWE10082", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "يوجد عليها حادث بتاريخ 25-12-1445 وتم إصلاحه", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_145_اوس7262", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7262", "unit": "مركز الدفاع المدني بالخمرة", "itemNo": "1101700010006", "chassis": "54F2AA503DWE10305", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 145000, "faultType": "أخرى", "date": "1447/12/13", "repairDate": "1447/11/09", "causedBy": "جنوب 4", "desc": "المروحة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_146_انل4619", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ل 4619", "unit": "مركز الدفاع المدني بالروابي", "itemNo": "1101700010006", "chassis": "54F2AA500DWE10147", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "", "faults": [{"_id": 146000, "faultType": "أخرى", "date": "1448/01/27", "repairDate": "", "causedBy": "مركز شرق 2 ( الروابي )", "desc": "ارتفاع درجة الحرارة وانقطاع السير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_147_اهس2233", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه س 2233", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1101700010006", "chassis": "54F2AA508DWE10221", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة السالمية", "status": "عطلانة", "notes": "", "faults": [{"_id": 147000, "faultType": "أخرى", "date": "1447/12/04", "repairDate": "1447/10/22", "causedBy": "سالمية 1", "desc": "مايعبي هواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_148_اوس7260", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7260", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700010006", "chassis": "54F2AA501DWE10299", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 148000, "faultType": "أخرى", "date": "1448/01/23", "repairDate": "1447/06/24", "causedBy": "شعبة العزيزية / مركز الرحاب", "desc": "اعطال متنوعه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_149_اهد1272", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه د 1272", "unit": "مركز الدفاع المدني بابحرالشمالية", "itemNo": "1101700010006", "chassis": "54F2AA508DWE10185", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة أبحر", "status": "عطلانة", "notes": "", "faults": [{"_id": 149000, "faultType": "عطل ميكانيكي", "date": "1448/02/06", "repairDate": "1446/06/15", "causedBy": "شعبة أبحر / مركز أبحر الشمالية", "desc": "عطل بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_150_اوم7634", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 7634", "unit": "مركز الدفاع المدني بالاسواق الشعبية", "itemNo": "1101700010006", "chassis": "54F2AA506EWE10638", "color": "رسمية - اصفر", "model": "2014", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 150000, "faultType": "عطل ميكانيكي", "date": "1446/12/16", "repairDate": "", "causedBy": "صناعية 3", "desc": "ارتفاع حرارة المحرك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_151_اين6521", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 6521", "unit": "مركز الدفاع المدني بالأسكان الجنوبي", "itemNo": "1101700010006", "chassis": "54F2AA501FWE11018", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 151000, "faultType": "خلل فني", "date": "1447/06/20", "repairDate": "", "causedBy": "إسكان 1", "desc": "عطل بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_152_اهس2217", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه س 2217", "unit": "مركز الدفاع المدني بالصناعية الثانية", "itemNo": "1101700010006", "chassis": "54F2AA503DWE10207", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 152000, "faultType": "بطاريات", "date": "1448/01/11", "repairDate": "1448/01/13", "causedBy": "مركز جنوب 2 ( الصناعية الثانية )", "desc": "بطاريات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_153_انط2404", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ط 2404", "unit": "مركز الدفاع المدني بالمحاميد", "itemNo": "1101700030006", "chassis": "54F2AA506CWE10037", "color": "رسمية - اصفر", "model": "2012", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_154_باد8252", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا د 8252", "unit": "مركز الدفاع المدني بالمحمدية", "itemNo": "1101700010006", "chassis": "54F2AA502FWE11058", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 154000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/04", "causedBy": "ابحر 3", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_155_انو5242", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن و 5242", "unit": "مركز الدفاع المدني بالحرزات الشرقي", "itemNo": "1101700010006", "chassis": "54F2AA502DWE10165", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الإسكان الجنوبي", "status": "عطلانة", "notes": "إسكان 4", "faults": [{"_id": 155000, "faultType": "عطل ميكانيكي", "date": "1447/05/01", "repairDate": "", "causedBy": "شعبة الإسكان الجنوبي", "desc": "عطل في السست الامامية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_156_اعك7576", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ع ك 7576", "unit": "مركز الدفاع المدني بالمروة", "itemNo": "1101700010006", "chassis": "54F2AA501DWE10271", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 156000, "faultType": "عطل ميكانيكي", "date": "1447/11/12", "repairDate": "1447/06/19", "causedBy": "شعبة المروة / مركز المروة", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_157_اين2788", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 2788", "unit": "مركز الدفاع المدني بالمستودعات", "itemNo": "1101700010006", "chassis": "54F2AA502EWE10703", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "تم اصلاح عطل بالسفتي بتاريخ 24-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_158_باد8241", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا د 8241", "unit": "مركز الدفاع المدني بالخزام", "itemNo": "1101700010006", "chassis": "54F2AA505FWE11054", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "الجهة شعبة خزام", "faults": [{"_id": 158000, "faultType": "حادث مروري", "date": "1445/12/02", "repairDate": "1448/01/29", "causedBy": "صفا 2", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_159_اين2795", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 2795", "unit": "مركز الدفاع المدني بإسكان الشرفية", "itemNo": "1101700010006", "chassis": "54F2AA508FWE11002", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 159000, "faultType": "كهربائي", "date": "1447/11/17", "repairDate": "1447/11/20", "causedBy": "بلد 5", "desc": "عطل في زر التشغيل - الكهرباء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_160_اوس7237", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7237", "unit": "مركز الدفاع المدني بالرحاب", "itemNo": "1101700010006", "chassis": "54F2AA501DWE10318", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 160000, "faultType": "عطل ميكانيكي", "date": "1448/02/01", "repairDate": "1448/02/01", "causedBy": "وسط 1", "desc": "الفرامل وخزان الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_161_باق5871", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا ق 5871", "unit": "مركز الدفاع المدني بأم السلم", "itemNo": "1101700010006", "chassis": "54F2AA507FWE11086", "color": "رسمية - اصفر", "model": "2015", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_162_اوس7247", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7247", "unit": "مركز الدفاع المدني بالروضة", "itemNo": "1101700010006", "chassis": "54F2AA503DWE10336", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 162000, "faultType": "عطل ميكانيكي", "date": "1447/02/29", "repairDate": "", "causedBy": "مجد 1", "desc": "عطل في كمبروسر الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_163_باد8272", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا د 8272", "unit": "مركز الدفاع المدني بالصناعية", "itemNo": "1101700010006", "chassis": "54F2AA503FWE11036", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الصناعية", "status": "عطلانة", "notes": "", "faults": [{"_id": 163000, "faultType": "عطل ميكانيكي", "date": "1447/10/12", "repairDate": "", "causedBy": "مركز صناعية 5 ( السنابل )", "desc": "طرمبة المويه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_164_انل1471", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ل 1471", "unit": "مركز الدفاع المدني بالعزيزية", "itemNo": "1101700010006", "chassis": "54F2AA503CWE10108", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "لم يتم الاستلام بتاريخ 22-12-1447 لوجود عطل جديد - تاريخ الإصلاح هو تاريخ التبلغ بانه تم اصلاح العطل السابق", "faults": [{"_id": 164000, "faultType": "كهربائي", "date": "1447/12/22", "repairDate": "1447/12/29", "causedBy": "وسط 2", "desc": "السفتي والتجهيزات الأمنية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_165_انط2406", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ط 2406", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1101700030006", "chassis": "54F2AA50XCWE10039", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "تعطل الالية بعد الاستلام من الصيانة خلال يوم واحد", "faults": [{"_id": 165000, "faultType": "عطل ميكانيكي", "date": "1447/05/29", "repairDate": "", "causedBy": "جنوب 1", "desc": "تأخر تبديل نمر+المضخة لاتعمل+الغمارة تحتاج تثبيت"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_166_اهد1274", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه د 1274", "unit": "مركز الدفاع المدني بحى المنار", "itemNo": "1101700010006", "chassis": "54F2AA503DWE10191", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "تعمل انقاذ فقط المضخة عطلانة - تم الإصلاح الذاتي من قبل الشعبة", "faults": [{"_id": 166000, "faultType": "عطل ميكانيكي", "date": "1448/02/03", "repairDate": "1448/02/04", "causedBy": "سالمية 5", "desc": "تهريب من المضخة والمكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_167_اوس7259", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7259", "unit": "مركز الدفاع المدني بحى النخيل", "itemNo": "1101700010006", "chassis": "54F2AA509DWE10325", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة السالمية", "status": "تعمل بوجود ملاحظات", "notes": "تعمل انقاذ فقط - تم الإصلاح ذاتيا من الشعبة", "faults": [{"_id": 167000, "faultType": "أخرى", "date": "1447/11/17", "repairDate": "1448/02/04", "causedBy": "مركز سالمية 2 ( النخيل )", "desc": "تهريب هواء في باكم الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_168_ببا5997", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ب ا 5997", "unit": "مركز الدفاع المدني بحي التيسير", "itemNo": "1101700010006", "chassis": "54F2AA50XFWE11129", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 168000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/03", "causedBy": "سالمية 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_169_اين2762", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ى ن 2762", "unit": "مركز الدفاع المدني بالمرحلة الاولى", "itemNo": "1101700010006", "chassis": "54F2AA505FWE11006", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 169000, "faultType": "عطل ميكانيكي", "date": "1447/09/10", "repairDate": "", "causedBy": "مركز صناعية 5 ( السنابل )", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_170_انع8552", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ع 8552", "unit": "مركز الدفاع المدني بحي السلامة", "itemNo": "1101700030006", "chassis": "54F2AA50XCWE10106", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 170000, "faultType": "أخرى", "date": "1447/12/08", "repairDate": "1447/12/08", "causedBy": "مركز وسط 5 ( الاندلس )", "desc": "شريحة الديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_171_اوم2884", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 2884", "unit": "مركز الدفاع المدني بأبحر الجنوبية", "itemNo": "1101700010006", "chassis": "54F2AA504EWE10623", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة أبحر", "status": "عطلانة", "notes": "", "faults": [{"_id": 171000, "faultType": "حادث مروري", "date": "1445/06/17", "repairDate": "", "causedBy": "ابحر 1", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_172_باق5756", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ا ق 5756", "unit": "مركز الدفاع المدني ببريمان", "itemNo": "1101700010006", "chassis": "54F2AA508FWE11078", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 172000, "faultType": "عطل ميكانيكي", "date": "1447/07/04", "repairDate": "", "causedBy": "شمال2", "desc": "ضعف بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_173_انل4628", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ل 4628", "unit": "مركز الدفاع المدني بحى الحرازات الشمالي", "itemNo": "1101700010006", "chassis": "54F2AA504CWE10134", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 173000, "faultType": "خلل فني", "date": "1447/09/21", "repairDate": "1447/11/21", "causedBy": "شرق 5", "desc": "لاتقبل دعسة الديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_174_انل1469", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ل 1469", "unit": "مركز الدفاع المدني بحى بني مالك", "itemNo": "1101700010006", "chassis": "54F2AA503CWE10125", "color": "رسمية - اصفر", "model": "2012", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد 3 أيام من الإصلاح - طلبت للصيانة بتاريخ 6-11-1447", "faults": [{"_id": 174000, "faultType": "أخرى", "date": "1447/09/12", "repairDate": "", "causedBy": "وسط 4", "desc": "خزانات الهواء + حساس كهرباء +اقمشة فرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_175_اعك7450", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ع ك 7450", "unit": "مركز الدفاع المدني بحي الرياض", "itemNo": "1101700010006", "chassis": "54F2AA507DWE10274", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 175000, "faultType": "عطل ميكانيكي", "date": "1446/10/09", "repairDate": "", "causedBy": "شمال 4", "desc": "عطل الباكم الخلفي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_176_ببا5040", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ب ا 5040", "unit": "مركز الدفاع المدني بحي النسيم", "itemNo": "1101700010006", "chassis": "54F2AA509FWE11154", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-10-1447 ولم ترفع متعطلة - لم يتم الاستلام لعدم اصلاح العطل في تاريخ 26-10-1447", "faults": [{"_id": 176000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/28", "causedBy": "مركز وسط 3 ( النسيم )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_177_انب3281", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "أ ن ب 3281", "unit": "مركز الدفاع المدني بمخطط الرحيلي", "itemNo": "1101700030006", "chassis": "54F2AA50XCWE10025", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "تم استلام الالية من الصيانة 12-5-1447 واتضح استمرار الأعطال", "faults": [{"_id": 177000, "faultType": "عطل ميكانيكي", "date": "1446/07/09", "repairDate": "", "causedBy": "شمال 3", "desc": "خلط مويه مع الزيت"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_178_اوم2890", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 2890", "unit": "مركز الدفاع المدني بحي المنتزهات", "itemNo": "1101700010006", "chassis": "54F2AA501EWE10627", "color": "رسمية - اصفر", "model": "2014", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تم الإصلاح ذاتيا من الفرقة", "faults": [{"_id": 178000, "faultType": "عطل ميكانيكي", "date": "1447/12/20", "repairDate": "1447/11/29", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_179_ببا5992", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ب ب ا 5992", "unit": "مركز الدفاع المدني بحي الوزيرية", "itemNo": "1101700010006", "chassis": "54F2AA501FWE11116", "color": "رسمية - اصفر", "model": "2015", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_180_اوم2889", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 2889", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1101700010006", "chassis": "54F2AA500EWE10621", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 12-10-1447 ولم ترفع متعطله", "faults": [{"_id": 180000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/13", "causedBy": "ابحر 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_181_اوم7638", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و م 7638", "unit": "مركز الدفاع المدني بحي مشرفة", "itemNo": "1101700010006", "chassis": "54F2AA500EWE10652", "color": "رسمية - اصفر", "model": "2014", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_182_انو5250", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن و 5250", "unit": "مركز الدفاع المدني بدرة العروس", "itemNo": "1101700010006", "chassis": "54F2AA500DWE10178", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_183_اهد1273", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه د 1273", "unit": "مركز الدفاع المدني بذهبان", "itemNo": "1101700010006", "chassis": "54F2AA503DWE10188", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 183000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/01", "causedBy": "شمال 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_184_انط2403", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ن ط 2403", "unit": "مركز الدفاع المدني بطريق الساحل", "itemNo": "1101700030006", "chassis": "54F2AA501CWE10043", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 28-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_185_اوس7263", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا و س 7263", "unit": "مركز الدفاع المدني بقصر السلام", "itemNo": "1101700010006", "chassis": "54F2AA509DWE10308", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "غرب 3 الروضة", "faults": [{"_id": 185000, "faultType": "كهربائي", "date": "1448/01/11", "repairDate": "1448/01/13", "causedBy": "مركز غرب 3 ( الروضة )", "desc": "التماس كهربائي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_186_اهس2235", "type": "سيارة اطفاء وانقاذ مزدوجة روزنباور", "plate": "ا ه س 2235", "unit": "مركز الدفاع المدني بقويزة", "itemNo": "1101700010006", "chassis": "54F2AA506DWE10203", "color": "رسمية - اصفر", "model": "2013", "location": "ش روزنباور", "status": "عطلانة", "notes": "", "faults": [{"_id": 186000, "faultType": "أخرى", "date": "1448/02/05", "repairDate": "1448/01/04", "causedBy": "مركز شرق 3 ( قويزة )", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_187_سلي226", "type": "سيارة اطفاء وانقاذ مزدوجه مرسيدس", "plate": "س ل ى 226", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1101700030005", "chassis": "WDB9300143K949693", "color": "رسمية - اصفر", "model": "2004", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 187000, "faultType": "أخرى", "date": "1445/05/13", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "تهريب لي الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_188_امب9496", "type": "سيارة اطفاء وانقاذ مزدوجه مرسيدس", "plate": "ا م ب 9496", "unit": "مركز الدفاع المدني بقصر الجزيرة بثول", "itemNo": "1101700030005", "chassis": "WDAYHCAA3CL616897", "color": "رسمية - اصفر", "model": "2012", "location": "مركز ثول", "status": "تم الإصلاح", "notes": "تم الإصلاح من قبل المركز", "faults": [{"_id": 188000, "faultType": "أخرى", "date": "1447/11/04", "repairDate": "1447/11/04", "causedBy": "مركز ثول", "desc": "تهريب هواء من لي مقعد السائق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_189_سيط435", "type": "سيارة اطفاء وانقاذ مزدوجه مرسيدس", "plate": "س ى ط 435", "unit": "مركز الدفاع المدني بقصر الجزيرة بثول", "itemNo": "1101700030005", "chassis": "WDB9300141K843650", "color": "رسمية - اصفر", "model": "2003", "location": "مركز ثول", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 189000, "faultType": "أخرى", "date": "1440/02/28", "repairDate": "", "causedBy": "مجد 2", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_190_امم1074", "type": "سيارة انارة", "plate": "ا م م 1074", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700080001", "chassis": "1FDTF4HY1CEB64437", "color": "رسمية - اصفر", "model": "2012", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 190000, "faultType": "عطل ميكانيكي", "date": "1447/10/17", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "بستم تثبيت قاعدة الارجل الخلفية للانارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_191_الط6396", "type": "سيارة انارة", "plate": "ا ل ط 6396", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1fdtf4hy5bec59128", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 191000, "faultType": "كهربائي", "date": "1447/02/09", "repairDate": "1447/11/19", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "التماس كهربائي في السيارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_192_الط1017", "type": "سيارة انارة", "plate": "ا ل ط 1017", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1fdtf4hy2bec59121", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 192000, "faultType": "خلل فني", "date": "1447/06/13", "repairDate": "1447/11/12", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "عامود الانارة الأيمن"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_193_باق1842", "type": "سيارة انارة", "plate": "ب ا ق 1842", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1FDTF4HY7FEB64284", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 193000, "faultType": "عطل ميكانيكي", "date": "1447/08/24", "repairDate": "1448/01/10", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "خلل في العامود الايسر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_194_اصم3133", "type": "سيارة انارة", "plate": "ا ص م 3133", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700080001", "chassis": "1gd3k2bk6af119036", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 194000, "faultType": "حادث مروري", "date": "1446/04/27", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_195_باق1832", "type": "سيارة انارة", "plate": "ب ا ق 1832", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700080001", "chassis": "1FDTF4HY5FEB64249", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل بوجود ملاحظات", "notes": "", "faults": [{"_id": 195000, "faultType": "كهربائي", "date": "1446/04/06", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "عطل حساس القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_196_امب1198", "type": "سيارة انارة", "plate": "ا م ب 1198", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1FDTF4HY7BEC59227", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_197_الط1018", "type": "سيارة انارة", "plate": "ا ل ط 1018", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1fdtf4hy0bec59117", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 197000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/22", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_198_الط1015", "type": "سيارة انارة", "plate": "ا ل ط 1015", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1fdtf4hy5bec59114", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_199_الط1009", "type": "سيارة انارة", "plate": "ا ل ط 1009", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1fdtf4hy6bec59123", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 199000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/27", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_200_امك4028", "type": "سيارة انارة", "plate": "ا م ك 4028", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1FDTF4HY1CEB64423", "color": "رسمية - اصفر", "model": "2012", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 200000, "faultType": "حادث مروري", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: حادث مروري بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_201_اهم2404", "type": "سيارة انارة", "plate": "ا ه م 2404", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1FDTF4HY9DEB65160", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_202_ببا5823", "type": "سيارة انارة", "plate": "ب ب ا 5823", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700080001", "chassis": "1FDTF4HY3FEB64234", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 202000, "faultType": "كهربائي", "date": "1447/11/12", "repairDate": "1447/11/18", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تغيير لمبات كشافات البرج"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_203_باق1840", "type": "سيارة انارة", "plate": "ب ا ق 1840", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700080001", "chassis": "1FDTF4HY8FEB64309", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_204_الط1006", "type": "سيارة بمروحة لدفع الهواء وطرد الدخان", "plate": "ا ل ط 1006", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700090001", "chassis": "1fduf5ht2bec59229", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "تم الإصلاح من قبل الشعبة - طلبت للصيانة بتاريخ 6-11-1447 ولم ترفع متعطله", "faults": [{"_id": 204000, "faultType": "أخرى", "date": "1447/11/06", "repairDate": "1447/11/12", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "فلاتر ديزل + خرطوش محرك خلفي+تشحيم+لي ديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_205_امط4142", "type": "سيارة تعبئة اجهزة التنفس مرسيدس", "plate": "ا م ط 4142", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700140001", "chassis": "1fvacycs8chbu9888", "color": "رسمية - اصفر", "model": "2012", "location": "ش روزنباور", "status": "عطلانة", "notes": "", "faults": [{"_id": 205000, "faultType": "أخرى", "date": "1447/02/17", "repairDate": "", "causedBy": "", "desc": "صيانة شاملة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_206_اهع9736", "type": "سيارة جمس رسمي لنقل اسطوانات التنفس", "plate": "ا ه ع 9736", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1105700160001", "chassis": "1GT019CG6DF238481", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447", "faults": [{"_id": 206000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/21", "causedBy": "مركز خزام 1 ( خزام )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_207_اقس1679", "type": "سيارة جمس رسمي لنقل اسطوانات التنفس", "plate": "ا ق س 1679", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1105700160001", "chassis": "1gt3kzbg0af107697", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "كمامات الصفا", "faults": [{"_id": 207000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/11", "causedBy": "مركز صفا 3 ( الربوة )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_208_اهس2818", "type": "سيارة جيب 2 باب تويوتا رسمي", "plate": "أ ه س 2818", "unit": "شعبة التحقيق", "itemNo": "1204700010002", "chassis": "JTEFJ71J630002827", "color": "رسمية - اصفر", "model": "2003", "location": "إدارة العمليات", "status": "تم الإصلاح", "notes": "متوقف بالإدارة", "faults": [{"_id": 208000, "faultType": "أخرى", "date": "1447/06/23", "repairDate": "1448/01/10", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_209_اهس2816", "type": "سيارة جيب 2 باب تويوتا رسمي", "plate": "ا ه س 2816", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1204700010002", "chassis": "JTEFJ71J330003336", "color": "رسمية - اخضر", "model": "2003", "location": "الصيانة المركزية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_210_اون9695", "type": "سيارة جيب 2 باب تويوتا رسمي", "plate": "ا و ن 9695", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700010002", "chassis": "JTEFJ71J330003532", "color": "رسمية - اخضر", "model": "2003", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 13-10-1447+جيب سريع وسط", "faults": [{"_id": 210000, "faultType": "عطل ميكانيكي", "date": "1447/07/09", "repairDate": "", "causedBy": "وسط 1", "desc": "في الاقمشه والهوبات الكفر الأيمن"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_211_لمل265", "type": "سيارة جيب 2 باب تويوتا رسمي", "plate": "ل م ل 265", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1204700010002", "chassis": "jtefj71j830003445", "color": "رسمية - اصفر", "model": "2003", "location": "شعبة الصناعية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_212_امط6540", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا م ط 6540", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1204700010003", "chassis": "JN8BY14Y06X525619", "color": "رسمية - اصفر", "model": "2006", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 212000, "faultType": "عطل ميكانيكي", "date": "1446/09/03", "repairDate": "", "causedBy": "إسكان 1", "desc": "تهريب في ماء الرديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_213_الع1091", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ل ع 1091", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700010003", "chassis": "JN8BY14YX9X539595", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "بديل من الشعبة", "faults": [{"_id": 213000, "faultType": "أخرى", "date": "1446/08/05", "repairDate": "", "causedBy": "شمال 1", "desc": "ارتفاع درجة الحرارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_214_كبص194", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ك ب ص 194", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700010003", "chassis": "JN8BY14Y12X446440", "color": "رسمية - اخضر", "model": "2002", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "تم اصلاح العطل السابق وتبقى تغيير للكفرات - مع مصور شمال", "faults": [{"_id": 214000, "faultType": "كفرات", "date": "1447/11/16", "repairDate": "1447/12/25", "causedBy": "شمال 1", "desc": "كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_215_هود189", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ه و د 189", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700010003", "chassis": "JN8BY14Y45X521068", "color": "رسمية - اخضر", "model": "2005", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 215000, "faultType": "عطل ميكانيكي", "date": "1447/06/16", "repairDate": "", "causedBy": "شمال 1", "desc": "الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_216_حعب5678", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ح ع ب 5678", "unit": "شعبة التموين والمستودعات", "itemNo": "1204700010003", "chassis": "JN8FY1JY3FX005856", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "جيب ضابط خفر في شعبة الشاطئ", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_217_حعب5575", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ح ع ب 5575", "unit": "شعبة التموين والمستودعات", "itemNo": "1204700010003", "chassis": "JN8FY1JY4FX006059", "color": "رسمية - اصفر", "model": "2015", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "مخصص للمهمات وحازم وهمام (مسلم حاليا مع شعبة العلاقات)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_218_امط6567", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا م ط 6567", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1204700010003", "chassis": "JN8BY14Y46X526868", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "مصور الساحل الجنوبي", "faults": [{"_id": 218000, "faultType": "بطاريات", "date": "1447/04/25", "repairDate": "1447/01/10", "causedBy": "شعبة الساحل / مركز طريق الساحل", "desc": "بطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_219_الح9797", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "أ ل ح 9797", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1204700010003", "chassis": "JN8BY14Y09X539685", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "جيب ضابط خفر شرق", "faults": [{"_id": 219000, "faultType": "أخرى", "date": "1447/12/16", "repairDate": "1447/06/24", "causedBy": "شرق 1", "desc": "ارتفاع درجة الحرارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_220_يال930", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ي أ ل 930", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1204700010003", "chassis": "JN8BY14Y88X536418", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة البغدادية", "status": "عطلانة", "notes": "", "faults": [{"_id": 220000, "faultType": "أخرى", "date": "1447/12/23", "repairDate": "1447/08/28", "causedBy": "بلد 1", "desc": "تهريب ليات الرديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_221_يال917", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ى ا ل 917", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1204700010003", "chassis": "JN8BY14Y78X536474", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة خزام", "status": "تعمل", "notes": "بحاجة الى دهان كامل", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_222_هاب647", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ه ا ب 647", "unit": "مركز الدفاع المدني بحى النخيل", "itemNo": "1204700010003", "chassis": "JN8BY14Y75X521226", "color": "رسمية - اخضر", "model": "2005", "location": "الصيانة المركزية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447 تم اصلاح عطل ومتبقي عطل اخر", "faults": [{"_id": 222000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/24", "causedBy": "سالمية 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_223_اار7610", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ا ر 7610", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1204700010003", "chassis": "JN8BY14Y38X536861", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "مصور الساحل الجنوبي", "faults": [{"_id": 223000, "faultType": "أخرى", "date": "1447/11/24", "repairDate": "", "causedBy": "مركز جنوب 1 ( الكورنيش )", "desc": "ارتفاع في الحرارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_224_الع1060", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ل ع 1060", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700010003", "chassis": "JN8BY14Y29X539588", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "مصور الشاطئ", "faults": [{"_id": 224000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/06", "causedBy": "غرب 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_225_مني827", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "م ن ى 827", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700010003", "chassis": "JN8BY14Y35X520333", "color": "رسمية - اخضر", "model": "2005", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_226_الح9008", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ل ح 9008", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1204700010003", "chassis": "JN8BY14Y79X539540", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 226000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/19", "causedBy": "صناعية 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_227_اار7549", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ا ر 7549", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1204700010003", "chassis": "JN8BY14Y98X536895", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 227000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/15", "causedBy": "شعبة الصناعية", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_228_قصن956", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ق ص ن 956", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700010003", "chassis": "JN8BY14Y62X445610", "color": "رسمية - اخضر", "model": "2002", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "بطارية + مكيف + تجديد دهان + تهريب بالمحرك ( سريع وسط )", "faults": [{"_id": 228000, "faultType": "أخرى", "date": "1447/12/18", "repairDate": "1447/12/17", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "تهريب ماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_229_الح9004", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "أ ل ح 9004", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1204700010003", "chassis": "JN8BY14Y69X539559", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "مصور الصفا - والقارب", "faults": [{"_id": 229000, "faultType": "عطل ميكانيكي", "date": "1448/02/05", "repairDate": "1448/02/06", "causedBy": "مركز صفا 1 ( المروة )", "desc": "انقطاع السير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_230_قصن865", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ق ص ن 865", "unit": "مركز الدفاع المدني بالربوة", "itemNo": "1204700010003", "chassis": "JN8BY14Y52X445601", "color": "رسمية - اخضر", "model": "2002", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 230000, "faultType": "حادث مروري", "date": "1447/02/02", "repairDate": "", "causedBy": "صفا 1", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_231_يال48", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ي أ ل 48", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1204700010003", "chassis": "JN8BY14Y68X536465", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة السالمية", "status": "تعمل بوجود ملاحظات", "notes": "اصلاح جزئي", "faults": [{"_id": 231000, "faultType": "أخرى", "date": "1447/11/13", "repairDate": "1447/11/12", "causedBy": "مركز سالمية 1 ( السالمية )", "desc": "تهريب علبة الدركسون - السفتي - النور الامامي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_232_مني182", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "م ن ى 182", "unit": "مركز الدفاع المدني بالصناعية", "itemNo": "1204700010003", "chassis": "JN8BY14Y95X520398", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "انقاذ خفيف صناعية 2", "faults": [{"_id": 232000, "faultType": "عطل ميكانيكي", "date": "1447/01/10", "repairDate": "1447/11/18", "causedBy": "صناعية 1", "desc": "لا يقبل التعشيق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_233_قهه205", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ق ه ه 205", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700010003", "chassis": "jn8by14y22x445684", "color": "غير مخصصة", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "لجنة المخالفات مع الخثلان", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_234_يال472", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ى ا ل 472", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700010003", "chassis": "JN8BY14Y18X536423", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 234000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/23", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_235_اعا9361", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ا ع ا 9361", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700010003", "chassis": "JN8BY14Y1YX430859", "color": "رسمية - اخضر", "model": "2000", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "حوش الرجيع", "faults": [{"_id": 235000, "faultType": "عطل ميكانيكي", "date": "1445/04/21", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "اعطال بالمكينة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_236_يطل276", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ي ط ل 276", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700010003", "chassis": "JN8BY14Y38X536701", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "مساند لدى المروة", "faults": [{"_id": 236000, "faultType": "بطاريات", "date": "1447/11/26", "repairDate": "1447/11/27", "causedBy": "مركز صفا 1 ( المروة )", "desc": "بطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_237_هاب629", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ه أ ب 629", "unit": "قسم تطوير الموارد البشرية", "itemNo": "1204700010003", "chassis": "JN8BY14Y65X521105", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة المروة / مركز الربوة", "status": "تعمل بوجود ملاحظات", "notes": "التدريب على راس العمل المقدم فيصل المنصور", "faults": [{"_id": 237000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "", "desc": "عطل بالتكييف + إطارات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_238_دقه2647", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ق ه 2647", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1204700010003", "chassis": "JN8FY1JY0LX018785", "color": "رسمية - اصفر", "model": "2020", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "سلم للاسناد ومن الاسناد سلم للحمايةالمدنية نقيب مهند حجازي", "faults": [{"_id": 238000, "faultType": "حادث مروري", "date": "1447/05/01", "repairDate": "1448/02/01", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_239_قكك493", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "ق ك ك 493", "unit": "مركز الدفاع المدني بحى المنار", "itemNo": "1204700010003", "chassis": "JN8BY14Y52X445548", "color": "رسمية - اصفر", "model": "2002", "location": "شعبة السالمية", "status": "عطلانة", "notes": "", "faults": [{"_id": 239000, "faultType": "أخرى", "date": "1447/12/20", "repairDate": "", "causedBy": "مركز سالمية 5 ( المنار )", "desc": "حرارة وخرطوش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_240_دكن1882", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ك ن 1882", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1204700010003", "chassis": "JN8FY1JY0LX018771", "color": "رسمية - اصفر", "model": "2020", "location": "إدارة العمليات", "status": "تم الإصلاح", "notes": "الالية عند التحقيق - تم طلب الالية للصيانة بتاريخ 27-8-1447 بدون ان ترفع متعطله", "faults": [{"_id": 240000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/02", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_241_دكن1877", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ك ن 1877", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700010003", "chassis": "JN8FY1JY5LX018796", "color": "رسمية - اصفر", "model": "2020", "location": "إدارة العمليات", "status": "تعمل", "notes": "سلم للتدريب", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_242_دكن1871", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ك ن 1871", "unit": "مركز الدفاع المدني بحي الوزيرية", "itemNo": "1204700010003", "chassis": "JN8FY1JY1LX018746", "color": "رسمية - اصفر", "model": "2020", "location": "شعبة خزام", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_243_دقه2621", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ق ه 2621", "unit": "مركز التدخل في المواد الخطرة ببريمان", "itemNo": "1204700010003", "chassis": "JN8FY1JY1LX018830", "color": "رسمية - اصفر", "model": "2020", "location": "شعبة الحمدانية", "status": "تعمل بوجود ملاحظات", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_244_دقه2645", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ق ه 2645", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700010003", "chassis": "JN8FY1JY9LX018784", "color": "رسمية - اصفر", "model": "2020", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "تاريخ تقريبي", "faults": [{"_id": 244000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "", "causedBy": "", "desc": "الدينمو + كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_245_دكن1870", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ك ن 1870", "unit": "مركز الدفاع المدني بالرحاب", "itemNo": "1204700010003", "chassis": "JN8FY1JY7LX018833", "color": "رسمية - اصفر", "model": "2020", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_246_دقه2619", "type": "سيارة جيب 2 باب نيسان رسمي", "plate": "د ق ه 2619", "unit": "مركز الدفاع المدني بالعزيزية", "itemNo": "1204700010003", "chassis": "JN8FY1JY8LX018758", "color": "رسمية - اصفر", "model": "2020", "location": "شعبة العزيزية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_247_حاص1845", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1845", "unit": "المكتب", "itemNo": "1204700020002", "chassis": "JTMJU09J9D4072737", "color": "رسمية - اصفر", "model": "2013", "location": "المكتب", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_248_بقم7027", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 7027", "unit": "مركز الدفاع المدني بإسكان الشرفية", "itemNo": "1204700020002", "chassis": "JTMDU09JB4040605", "color": "رسمية - اصفر", "model": "2011", "location": "", "status": "تعمل", "notes": "مسلمة لادارة العمليات (العقيد مجاهد)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_249_حاص1955", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1955", "unit": "شعبة التحقيق", "itemNo": "1204700020002", "chassis": "JTMJU09J1D4071579", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 13-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_250_حاص8038", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 8038", "unit": "شعبة التموين والمستودعات", "itemNo": "1204700020002", "chassis": "JTMJU09J9D4072690", "color": "رسمية - اصفر", "model": "2013", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "لدى الشؤون الإدارية", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_251_حبك3873", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ب ك 3873", "unit": "شعبة التموين والمستودعات", "itemNo": "1204700020002", "chassis": "JTMJU09J9D4074357", "color": "رسمية - اصفر", "model": "2013", "location": "إدارة العمليات", "status": "تعمل", "notes": "العمليات / العقيد ماجد القاضي", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_252_حاص1801", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1801", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1204700020002", "chassis": "JTMJU09J0D4072819", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_253_حاص1839", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1839", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1204700020002", "chassis": "JTMJU09J4D4073049", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "التدخل السريع الإسكان الجنوبي", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_254_حاص8140", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 8140", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1204700020002", "chassis": "JTMJU09J9D4072155", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الجامعة", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_255_بقم3822", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3822", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700020002", "chassis": "JTMDU09J7B4040931", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "جيب التدخل السريع الحمدانية", "faults": [{"_id": 255000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/14", "causedBy": "شمال 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_256_بقم3263", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3263", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700020002", "chassis": "JTMDU09J3B4040361", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة الحمدانية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_257_حاص6683", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 6683", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1204700020002", "chassis": "JTMJU09J4D4072225", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة خزام", "status": "تعمل", "notes": "بحاجة الى دهان كامل", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_258_بقم3255", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3255", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1204700020002", "chassis": "JTMDU09J0B4040415", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_259_بقم7190", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 7190", "unit": "شعبة الدفاع المدني الميدانية بالسالمية", "itemNo": "1204700020002", "chassis": "4040871", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة السالمية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_260_حاص8337", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 8337", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700020002", "chassis": "JTMJU09J0D4070181", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 24-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_261_حبك3872", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ب ك 3872", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700020002", "chassis": "JTMJU09J0D4074747", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "التدخل السريع شعبة الشاطئ", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_262_حبك3857", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ب ك 3857", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1204700020002", "chassis": "JTMJU09JXD4074139", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الصناعية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_263_حبك3869", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ب ك 3869", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020002", "chassis": "JTMJU09J4D4074380", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "جيب التدخل السريع العزيزية", "faults": [{"_id": 263000, "faultType": "أخرى", "date": "1447/12/08", "repairDate": "1448/01/10", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "تهريب بالاديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_264_حاص6676", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 6676", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020002", "chassis": "JTMJU09J9D4071474", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة العزيزية", "status": "تعمل بوجود ملاحظات", "notes": "كثرة الملاحظات وقدم الموديل", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_265_بقل6487", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق ل 6487", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1204700020002", "chassis": "JTMDU09J2B4040304", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_266_حاص8294", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 8294", "unit": "شعبة المراجعة الداخلية", "itemNo": "1204700020002", "chassis": "JTMJU09J8D4071904", "color": "رسمية - اصفر", "model": "2013", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "تم سحبه الى التموين بتوجيه سعادة مدير الإدارة", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_267_حاص1931", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1931", "unit": "شعبة الموارد البشرية", "itemNo": "1204700020002", "chassis": "JTMJU09J8D4072597", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الموارد البشرية", "status": "تعمل", "notes": "جيب مدير الموارد", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_268_حاص8260", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 8260", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700020002", "chassis": "JTMJU09J8D4072566", "color": "رسمية - اصفر", "model": "2013", "location": "إدارة العمليات", "status": "تعمل", "notes": "الحماية المدنية العجلاني", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_269_بقم3412", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3412", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1204700020002", "chassis": "JTMDU09J2B4040688", "color": "رسمية - اصفر", "model": "2011", "location": "الصيانة المركزية", "status": "تعمل", "notes": "طلبت للصيانة ولم ترفع متعطله 17-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_270_حاص1965", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ح ا ص 1965", "unit": "مركز الدفاع المدني بالمروة", "itemNo": "1204700020002", "chassis": "JTMJU09J8D4072700", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة المروة", "status": "تعمل بوجود ملاحظات", "notes": "جيب التدخل السريع المروة", "faults": [{"_id": 270000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز صفا 3 ( الربوة )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_271_بقم3410", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3410", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1204700020002", "chassis": "JTMDU09J8B4041103", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل بوجود ملاحظات", "notes": "بطارية", "faults": [{"_id": 271000, "faultType": "أخرى", "date": "1447/06/26", "repairDate": "", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_272_بقل5954", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق ل 5954", "unit": "مركز الدفاع المدني بالجامعة", "itemNo": "1204700020002", "chassis": "JTMDU09J9B4040056", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "جيب التدخل السريع الجامعة", "faults": [{"_id": 272000, "faultType": "كفرات", "date": "1448/01/15", "repairDate": "1447/12/17", "causedBy": "مركز شرق 1 ( الجامعة )", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_273_بقم3283", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3283", "unit": "مركز الدفاع المدني بحى الحرازات الشمالي", "itemNo": "1204700020002", "chassis": "JTMDU09J3B4040540", "color": "رسمية - اصفر", "model": "2011", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "التموين (مهام -حازم)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_274_بقم3402", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3402", "unit": "مركز الدفاع المدني بالخزام", "itemNo": "1204700020002", "chassis": "JTMDU09J1B4041119", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة خزام", "status": "تعمل", "notes": "جيب التدخل السريع خزام سلمت لشعبة خزام", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_275_بقم3231", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3231", "unit": "مركز الدفاع المدني بأبحر الجنوبية", "itemNo": "1204700020002", "chassis": "JTMDU09J3B4040411", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "جيب التدخل السريع ابحر نقلت بقرار مدير الإدارة الى شعبة ابحر", "faults": [{"_id": 275000, "faultType": "عطل ميكانيكي", "date": "1447/10/14", "repairDate": "1447/12/25", "causedBy": "مركز ابحر 1 ( ابحر الجنوبية )", "desc": "هوبات + باكم + تهريب الكليبر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_276_بقم3406", "type": "سيارة جيب 4 باب تويوتا رسمي", "plate": "ب ق م 3406", "unit": "مركز الدفاع المدني بالبغدادية", "itemNo": "1204700020002", "chassis": "JTMDU09J2B4040805", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة البغدادية", "status": "تعمل بوجود ملاحظات", "notes": "جيب التدخل السريع البغدادية تغيير الرديتر والمكيف والفرامل والسفتي عطلان والاقمشة", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_277_بكك7525", "type": "سيارة جيب 4 باب تويوتا مدني", "plate": "ب ك ك 7525", "unit": "ادارة العمليات", "itemNo": "1204700020005", "chassis": "JTMDU09J1B4042622", "color": "ابيض - مدنية", "model": "2011", "location": "إدارة العمليات", "status": "تعمل", "notes": "العقيد ماجد القاضي", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_278_حنب9074", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9074", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3013078", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "مصور الإسكان", "faults": [{"_id": 278000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/05", "causedBy": "شعبة الاسكان", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_279_حمح4243", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4243", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3013429", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "لدى شعبة العزيزية - مصور وسط", "faults": [{"_id": 279000, "faultType": "حادث مروري", "date": "1447/11/27", "repairDate": "1447/10/13", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_280_بقد3882", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ب ق د 3882", "unit": "إدارة الشؤون الإدارية", "itemNo": "1204700020009", "chassis": "JD2GJ5226B1121079", "color": "رسمية - اصفر", "model": "2011", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "للبريد واعمال إدارية", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_281_حنب9768", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9768", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5223G3013109", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة العزيزية", "status": "صدر قرار الرجيع", "notes": "تاريخ تقريبي", "faults": [{"_id": 281000, "faultType": "عطل ميكانيكي", "date": "1447/08/01", "repairDate": "", "causedBy": "", "desc": "جيربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_282_حمح4348", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4348", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3012874", "color": "رسمية - اصفر", "model": "2016", "location": "مركز ثول", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_283_حله6972", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6972", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3013450", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "طلبت للصيانة بتاريخ 21-10-1447 بدون ان ترفع متعطله", "faults": [{"_id": 283000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/04", "causedBy": "", "desc": "مكيف متعطل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_284_حمح4192", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4192", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5223G3013014", "color": "رسمية - اصفر", "model": "2016", "location": "الصيانة المركزية", "status": "تعمل بوجود ملاحظات", "notes": "تم طلب الالية للصيانة بتاريخ 21-10-1447 بدون ان ترفع متعطله", "faults": [{"_id": 284000, "faultType": "حادث مروري", "date": "1446/07/19", "repairDate": "", "causedBy": "", "desc": "حادث مروري 19-7-1446"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_285_حمح4189", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4189", "unit": "مركز السلامة الميدانية بالإسكان الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3012500", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "تم طلب الالية للصيانة بتاريخ 27-8-1447 بدون ان ترفع متعطله", "faults": [{"_id": 285000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/04", "causedBy": "", "desc": "مكيف متعطل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_286_حمح4169", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4169", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3013001", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "مركز سلامة الساحل الجنوبي - طلبت للصيانة بتاريخ 21-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_287_حمح4215", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4215", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1204700020009", "chassis": "JD2GJ5228G3013557", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 287000, "faultType": "بطاريات", "date": "1446/03/01", "repairDate": "", "causedBy": "", "desc": "بطارية + كفرات + السفتي لايعمل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_288_حنب9068", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9068", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3013495", "color": "رسمية - اصفر", "model": "2016", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "مصور شمال - طلبت للصيانه ولم ترفع متعطله 21-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_289_حمح4330", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4330", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3012745", "color": "رسمية - اصفر", "model": "2016", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 21-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_290_حمح4315", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4315", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3012507", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "اقمشة +كومبرسر+تغيير زيوت", "faults": [{"_id": 290000, "faultType": "أخرى", "date": "1446/04/26", "repairDate": "", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_291_حمح4412", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4412", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3012829", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الحمدانية", "status": "تعمل", "notes": "مصور شمال + تم تسليمه لادارة خليص", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_292_حمح4317", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4317", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3012958", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "بطارية +المكيف+امشة", "faults": [{"_id": 292000, "faultType": "أخرى", "date": "1446/02/10", "repairDate": "", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_293_حمح4264", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4264", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3013173", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "طلبت للصيانه ولم ترفع متعطلة 21-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_294_حمح4170", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4170", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3013015", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة خزام", "status": "تعمل", "notes": "شعبة خزام", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_295_حنب9064", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9064", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1204700020009", "chassis": "JD2GJ5226G3013198", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 21-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_296_حمح4337", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4337", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3012531", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "صدر قرار الرجيع", "notes": "احيلت للرجيع بتاريخ 26-7-1446 قرار رقم 247523", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_297_حمح4148", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4148", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5228G3013106", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_298_حمح4433", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4433", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ5229G3012904", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "صدر قرار الرجيع", "notes": "احيلت للرجيع بتاريخ 3-4-1447 رقم 60", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_299_حمح4184", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4184", "unit": "مركز السلامة الميدانية بالساحل الجنوبي", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3012393", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_300_حمح4415", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4415", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1204700020009", "chassis": "JD2GJ5220G3013021", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة العزيزية", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 300000, "faultType": "عطل ميكانيكي", "date": "1447/03/28", "repairDate": "", "causedBy": "وسط 1", "desc": "عدم تغيير النمر + لمبة القير — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_301_حمح4320", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4320", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1204700020009", "chassis": "JD2GJ5222G3012579", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_302_حمح4124", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4124", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1204700020009", "chassis": "JD2GJ5229G3013616", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "إدارة السلامة", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_303_حنب9052", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9052", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3013159", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "مصور غرب", "faults": [{"_id": 303000, "faultType": "أخرى", "date": "", "repairDate": "1447/06/10", "causedBy": "شعبة الشاطئ", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_304_حمح4236", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4236", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1204700020009", "chassis": "JD2GJ5222G3013098", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "طلبت للصيانة بتاريخ 21-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_305_حمح4163", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4163", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3012986", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_306_حمح4081", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4081", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1204700020009", "chassis": "JD2GJ5226G3012794", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "طلبت للصيانة بتاريخ 21-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_307_حمح4079", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4079", "unit": "مركز السلامة الميدانية بالصناعية", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3012528", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 307000, "faultType": "حادث مروري", "date": "1446/09/23", "repairDate": "", "causedBy": "", "desc": "حادث مروري — الإصلاح: لدى مركز سلامة الصناعية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_308_حمح4428", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4428", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1204700020009", "chassis": "JD2GJ5222G3012887", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل بوجود ملاحظات", "notes": "علبة الدركسون والمساحات والاطارات والمكيف", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_309_حمح4137", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4137", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3013166", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة المروة", "status": "تعمل بوجود ملاحظات", "notes": "الكفرات والمساحات - مصور الصفا", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_310_حنب9060", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9060", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3013636", "color": "رسمية - اصفر", "model": "2016", "location": "الشؤون الإدارية", "status": "صدر قرار الرجيع", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_311_حمح4265", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4265", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1204700020009", "chassis": "JD2GJ5220G3013715", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_312_حمح4167", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4167", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3012401", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_313_حله6941", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6941", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3013516", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_314_حمح4176", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4176", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1204700020009", "chassis": "JD2GJ5228G3012554", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_315_حمح4314", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4314", "unit": "مركز السلامة الميدانية بأبحر", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3012488", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_316_حله6927", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6927", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1204700020009", "chassis": "JD2GJ5220G3013133", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 316000, "faultType": "بطاريات", "date": "1447/05/01", "repairDate": "", "causedBy": "", "desc": "بطارية + كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_317_حمح4305", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4305", "unit": "مركز السلامة الميدانية بالبغدادية", "itemNo": "1204700020009", "chassis": "JD2GJ5226G3012956", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 317000, "faultType": "حادث مروري", "date": "1447/06/05", "repairDate": "", "causedBy": "", "desc": "حادث مروري + كفرات + بطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_318_حمح4229", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4229", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3013600", "color": "رسمية - اصفر", "model": "2016", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 21-10-1447", "faults": [{"_id": 318000, "faultType": "أخرى", "date": "1447/08/01", "repairDate": "", "causedBy": "", "desc": "عطل بالمكيف وتغيير كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_319_حمح4468", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4468", "unit": "مركز السلامة الميدانية بالجامعة", "itemNo": "1204700020009", "chassis": "JD2GJ5228G3012795", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "يتبع لسلامة الجامعة", "faults": [{"_id": 319000, "faultType": "أخرى", "date": "1447/08/01", "repairDate": "1447/11/06", "causedBy": "", "desc": "عطل بالمكيف وتغيير كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_320_حمح4426", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4426", "unit": "مركز السلامة الميدانية بالحمدانية", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3012492", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "بطارية +اقمشة+كومبرسر", "faults": [{"_id": 320000, "faultType": "عطل ميكانيكي", "date": "1446/02/10", "repairDate": "", "causedBy": "", "desc": "جيربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_321_حنب9077", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9077", "unit": "مركز السلامة الميدانية بالخزام", "itemNo": "1204700020009", "chassis": "JD2GJ5229G3013213", "color": "رسمية - اصفر", "model": "2016", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تعطلت الالية وهي في استلام التحقيق + مسلمة لشعبة خزام", "faults": [{"_id": 321000, "faultType": "عطل ميكانيكي", "date": "1446/10/26", "repairDate": "", "causedBy": "خزام 1", "desc": "المكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_322_حمح4096", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4096", "unit": "مركز السلامة الميدانية بالسالمية", "itemNo": "1204700020009", "chassis": "JD2GJ5220G3012421", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 322000, "faultType": "عطل ميكانيكي", "date": "1447/09/22", "repairDate": "", "causedBy": "وسط 1", "desc": "الاقمشة والهوبات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_323_حمح4274", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4274", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3013433", "color": "رسمية - اصفر", "model": "2016", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 21-10-1447", "faults": [{"_id": 323000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "", "causedBy": "", "desc": "بطارية + كفرات +مكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_324_حمح4497", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4497", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1204700020009", "chassis": "JD2GJ5221G3013660", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "تاريخ تقريبي", "faults": [{"_id": 324000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "", "causedBy": "", "desc": "عطل كهربائي +بطارية +كفرات+مكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_325_حمح4498", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4498", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1204700020009", "chassis": "JD2GJ5225G3013242", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "تاريخ تقريبي", "faults": [{"_id": 325000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "", "causedBy": "", "desc": "بطارية + كفرات + مكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_326_حمح4084", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4084", "unit": "مركز السلامة الميدانية بالشاطئ", "itemNo": "1204700020009", "chassis": "JD2GJ5226G3012360", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "تاريخ تقريبي", "faults": [{"_id": 326000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "", "causedBy": "", "desc": "بطارية + كفرات + مكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_327_حله6934", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6934", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5222G3013179", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 327000, "faultType": "عطل ميكانيكي", "date": "1446/08/01", "repairDate": "", "causedBy": "", "desc": "عطل ميكانيكي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_328_حله6939", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6939", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5224G3013328", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 328000, "faultType": "عطل ميكانيكي", "date": "1446/04/19", "repairDate": "", "causedBy": "", "desc": "عطل بالماكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_329_حمح4103", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4103", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5226G3013122", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 329000, "faultType": "أخرى", "date": "1447/04/01", "repairDate": "", "causedBy": "", "desc": "عطل بالدينمو"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_330_حمح4465", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4465", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5227G3012982", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 330000, "faultType": "أخرى", "date": "1447/01/12", "repairDate": "", "causedBy": "", "desc": "بطارية + اقمشة + فرامل + كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_331_حنب9080", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ن ب 9080", "unit": "مركز السلامة الميدانية بالعزيزية", "itemNo": "1204700020009", "chassis": "JD2GJ5229G3013728", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 331000, "faultType": "بطاريات", "date": "1447/04/01", "repairDate": "", "causedBy": "", "desc": "بطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_332_حمح4282", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح م ح 4282", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1204700020009", "chassis": "JD2GJ5223G3013756", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 332000, "faultType": "عطل ميكانيكي", "date": "1447/04/01", "repairDate": "", "causedBy": "", "desc": "صعوبة تحريك الدركسون واصوات بالمكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_333_حله6965", "type": "سيارة جيب 4 باب ديهاتسو رسمي", "plate": "ح ل ه 6965", "unit": "مركز السلامة الميدانية بالمروة", "itemNo": "1204700020009", "chassis": "JD2GJ522XG3013401", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "عطلانة", "notes": "", "faults": [{"_id": 333000, "faultType": "بطاريات", "date": "1447/04/01", "repairDate": "", "causedBy": "", "desc": "البطارية والمساحات والكفرات والتكييف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_334_بلط3883", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ط 3883", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700020003", "chassis": "JN8FY15Y4CX590307", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة المروة", "status": "تعمل", "notes": "مسلم لادارة السلامة ( العقيد مجاهد ) - الان موجود مع تدخل الصفا (المواد الخطرة)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_335_انل6414", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6414", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1204700020003", "chassis": "JN6BY11Y39X518178", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة خزام", "status": "عطلانة", "notes": "", "faults": [{"_id": 335000, "faultType": "أخرى", "date": "1446/04/12", "repairDate": "", "causedBy": "خزام 1", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_336_نيم736", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ن ى م 736", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1204700020003", "chassis": "JN6BY11YX6X510803", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "عند الاستلام اتضح حاجة الالية لبطارية ولايوجد بطاريات بالصيانة", "faults": [{"_id": 336000, "faultType": "بطاريات", "date": "1448/01/03", "repairDate": "1448/01/17", "causedBy": "شعبة الساحل / مركز الكورنيش الجنوبي", "desc": "بطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_337_اعا9360", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ع ا 9360", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1204700020003", "chassis": "JN8BY15Y62X480131", "color": "رسمية - اخضر", "model": "2002", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-10-1447 ولم ترفع متعطله + كانت تعمل بملاحظات", "faults": [{"_id": 337000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/17", "causedBy": "شعبة البغدادية", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_338_برك1092", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ك 1092", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1204700020003", "chassis": "JN8FY15Y0AX581293", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة البغدادية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_339_اعا9362", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ع ا 9362", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1204700020003", "chassis": "JN17AS761Z0400608", "color": "رسمية - اخضر", "model": "1998", "location": "شعبة الجامعة", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 339000, "faultType": "أخرى", "date": "1446/11/26", "repairDate": "", "causedBy": "شرق 1", "desc": "عدة اعطال — الإصلاح: لدى الشؤون الإدارية العقيد محمد"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_340_مني672", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "م ن ى 672", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1204700020003", "chassis": "JN6BY11Y45X507085", "color": "رسمية - اخضر", "model": "2005", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "انقاذ مائي", "faults": [{"_id": 340000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/06", "causedBy": "شعبة الجامعة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_341_بلع5289", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ع 5289", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1204700020003", "chassis": "JN8FY15Y9CX590299", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الجامعة", "status": "تعمل", "notes": "حادث مروري مع المقدم خالد البلوي بتاريخ 6-11-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_342_انل6428", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6428", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020003", "chassis": "JN6BY11Y79X518118", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تم الإبلاغ عن العطل بخطاب + تم التحديث بالتعميم + جيب المصور - معاودة نفس العطل تقريبا خلال 20 يوم فقط فترة الضمان", "faults": [{"_id": 342000, "faultType": "أخرى", "date": "1448/01/14", "repairDate": "1447/12/25", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "سير وخرطوش رديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_343_انل6413", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6413", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1204700020003", "chassis": "JN6BY11YX9X518095", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة المروة", "status": "عطلانة", "notes": "", "faults": [{"_id": 343000, "faultType": "عطل ميكانيكي", "date": "1447/08/23", "repairDate": "", "causedBy": "صفا 1", "desc": "كلتش + عوامة بنزين + كفرات + تهريب زيوت"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_344_اطع6677", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "أ ط ع 6677", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700020003", "chassis": "JBY8BY15YX2XY8000Y", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 344000, "faultType": "أخرى", "date": "1447/06/23", "repairDate": "", "causedBy": "شعبة الحمدانية", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_345_انل6442", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "أ ن ل 6442", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1204700020003", "chassis": "JN6BY11Y39X518181", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "جيب مصور خزام", "faults": [{"_id": 345000, "faultType": "كهربائي", "date": "1447/12/18", "repairDate": "1447/12/17", "causedBy": "مركز خزام 1 ( خزام )", "desc": "السلف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_346_يال698", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ى ا ل 698", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1204700020003", "chassis": "JN6BY11Y58X516527", "color": "رسمية - اخضر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "حوش الستين", "faults": [{"_id": 346000, "faultType": "أخرى", "date": "1441/02/17", "repairDate": "", "causedBy": "خزام 1", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_347_بلع5287", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ع 5287", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1204700020003", "chassis": "JN8FY15YXCX590196", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "مكلف في مهمة مجد 3 (داخل قصر السلام)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_348_برق2588", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ق 2588", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020003", "chassis": "JN8FY15YXAX581298", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "المكيف", "faults": [{"_id": 348000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/13", "causedBy": "وسط 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_349_بلع5075", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ع 5075", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1204700020003", "chassis": "JN8FY15Y3CX590282", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 349000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/14", "causedBy": "شعبة المروة / مركز المروة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_350_انل6448", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6448", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700020003", "chassis": "JN6BY11Y99X518136", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة العزيزية", "status": "تعمل بوجود ملاحظات", "notes": "ارتفاع درجة الحرارة + باكم + علبة الكلتش", "faults": [{"_id": 350000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/22", "causedBy": "وسط 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_351_برق2013", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ق 2013", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1204700020003", "chassis": "JN8FY15Y1AX581304", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة المروة", "status": "عطلانة", "notes": "جيب اداري", "faults": [{"_id": 351000, "faultType": "كفرات", "date": "1448/02/05", "repairDate": "1447/11/09", "causedBy": "شعبة المروة / مركز المروة", "desc": "الكفرات تالفة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_352_اعا9365", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ع ا 9365", "unit": "شعبة الشؤون الفنية", "itemNo": "1204700020003", "chassis": "jn6by11y45x507233", "color": "رسمية - اخضر", "model": "2005", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "متعطل ومسلم للتموين", "faults": [{"_id": 352000, "faultType": "عطل ميكانيكي", "date": "1447/07/02", "repairDate": "1448/01/15", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "عطل بالمحرك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_353_انل6561", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6561", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700020003", "chassis": "JN6BY11Y69X518210", "color": "رسمية - اصفر", "model": "2009", "location": "الشؤون الإدارية", "status": "عطلانة", "notes": "متعطل ومسلم للتموين - تم الاشعار بالإصلاح 25-10-1447 الساعه 11.30", "faults": [{"_id": 353000, "faultType": "أخرى", "date": "1448/01/15", "repairDate": "1447/10/25", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "البوابة يطفي ويشتغل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_354_امط6562", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا م ط 6562", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700020003", "chassis": "JN8BY15Y36X510157", "color": "رسمية - اصفر", "model": "2006", "location": "الشؤون الإدارية", "status": "عطلانة", "notes": "متعطل ومسلم للتموين - تم اصلاح بعض الأعطال ولم يتم اصلاح العطل الأساسي", "faults": [{"_id": 354000, "faultType": "عطل ميكانيكي", "date": "1447/07/02", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "عطل بالمحرك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_355_انل6589", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6589", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700020003", "chassis": "JN6BY11Y69X518272", "color": "رسمية - اصفر", "model": "2009", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "عليه حادث مروري بتاريخ 16-4-1446", "faults": [{"_id": 355000, "faultType": "عطل ميكانيكي", "date": "1447/03/19", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "تهريب زيت من علبة الدركسون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_356_هاب635", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ه أ ب 635", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700020003", "chassis": "JN6BY11Y16X511158", "color": "رسمية - اصفر", "model": "2006", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "متعطل ومسلم للتموين", "faults": [{"_id": 356000, "faultType": "عطل ميكانيكي", "date": "1447/07/02", "repairDate": "1448/01/15", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "عطل بالمحرك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_357_يطل622", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ى ط ل 622", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700020003", "chassis": "jn6by38x516672", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "تم الاشعار بالإصلاح 25-10-1447", "faults": [{"_id": 357000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/25", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_358_يمل624", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ى م ل 624", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1204700020003", "chassis": "JN6BY11Y18X516699", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "تدخل الصناعية", "faults": [{"_id": 358000, "faultType": "عطل ميكانيكي", "date": "1447/11/29", "repairDate": "1448/01/15", "causedBy": "صناعية 1", "desc": "سير المكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_359_انل6579", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6579", "unit": "مركز الدفاع المدني بالسامر", "itemNo": "1204700020003", "chassis": "JN6BY11Y19X518230", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "جيب يعمل انقاذ خفيف شمال 2", "faults": [{"_id": 359000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/01", "causedBy": "سالمية 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_360_انل6440", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6440", "unit": "مركز التدخل في المواد الخطرة ببريمان", "itemNo": "1204700020003", "chassis": "JN6BY11Y39X518147", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة المروة", "status": "عطلانة", "notes": "تدخل الصفا", "faults": [{"_id": 360000, "faultType": "عطل ميكانيكي", "date": "1447/09/26", "repairDate": "", "causedBy": "شعبة المروة", "desc": "صحن الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_361_عصو884", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ع ص و 884", "unit": "مركز الدفاع المدني بالسنابل", "itemNo": "1204700020003", "chassis": "JN8BY15Y21X462157", "color": "رسمية - اصفر", "model": "2001", "location": "شعبة الصناعية", "status": "عطلانة", "notes": "معاودة التعطل خلال فترة الضمان", "faults": [{"_id": 361000, "faultType": "أخرى", "date": "1448/02/02", "repairDate": "1448/01/15", "causedBy": "شعبة الصناعية / مركز السنابل", "desc": "الرديتر + طرمبة المويه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_362_امط6561", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "أ م ط 6561", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1204700020003", "chassis": "JN8BY15Y56X510175", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة أبحر", "status": "عطلانة", "notes": "طلبت للصيانة ولم ترفع بقروب الأعطال 17-8-1447", "faults": [{"_id": 362000, "faultType": "أخرى", "date": "1448/01/28", "repairDate": "1447/09/01", "causedBy": "مركز ابحر 3 ( المحمدية )", "desc": "ارتفاع درجة الحرارة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_363_بلع5074", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ع 5074", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1204700020003", "chassis": "JN8FY15Y5CX590140", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة أبحر", "status": "تعمل", "notes": "طلبت للصيانة ولم ترفع بقروب الأعطال 20-8-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_364_يطل447", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ى ط ل 447", "unit": "شعبة الموارد البشرية", "itemNo": "1204700010003", "chassis": "jn6by11y58x516656", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة الموارد البشرية", "status": "تعمل", "notes": "جيب الشرطة العسكرية", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_365_برق2086", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ق 2086", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700020003", "chassis": "JN8FY15Y1AX581559", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة الحمدانية", "status": "تعمل", "notes": "انقاذ خفيف شمال 4", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_366_برك1095", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ك 1095", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700020003", "chassis": "581324", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "حوش الرجيع", "faults": [{"_id": 366000, "faultType": "حادث مروري", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_367_اكح9352", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "أ ك ح 9352", "unit": "مركز التدخل في المواد الخطرة بالميناء", "itemNo": "1204700020003", "chassis": "JN8BY15Y52X480072", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "تدخل الصناعية -- تم طلب الالية للصيانة بتاريخ 27-8-1447 بدون ان ترفع متعطله - تاريخ الإصلاح هو تاريخ الإبلاغ", "faults": [{"_id": 367000, "faultType": "كهربائي", "date": "1447/12/22", "repairDate": "1447/11/25", "causedBy": "", "desc": "امبيرات عداد الطبلون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_368_برح4842", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ح 4842", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1204700020003", "chassis": "JN8FY15Y0AX581567", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة الصناعية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_369_انل6409", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ن ل 6409", "unit": "مركز التدخل في المواد الخطرة بالميناء", "itemNo": "1204700020003", "chassis": "JN6BY11Y89X518144", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "تم طلب الالية للصيانة بتاريخ 4-11-1447 بدون ان ترفع متعطله", "faults": [{"_id": 369000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/02", "causedBy": "شعبة الاسكان", "desc": "عطل بالمكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_370_برك1089", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ك 1089", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1204700020003", "chassis": "JN8FY15Y4AX581314", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة السالمية", "status": "عطلانة", "notes": "مسلم لشعبة السالمية (جيب التدخل السريع بالسالمية)", "faults": [{"_id": 370000, "faultType": "عطل ميكانيكي", "date": "1447/11/15", "repairDate": "1447/10/20", "causedBy": "شعبة السالمية", "desc": "تهريب رديتر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_371_نيم701", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ن ى م 701", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1204700020003", "chassis": "JN6BY11Y96X511070", "color": "رسمية - اخضر", "model": "2006", "location": "مركز ثول", "status": "عطلانة", "notes": "", "faults": [{"_id": 371000, "faultType": "عطل ميكانيكي", "date": "1447/12/03", "repairDate": "", "causedBy": "مركز ثول", "desc": "فرامل +تهريب زيت المكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_372_مني683", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "م ن ى 683", "unit": "مركز الدفاع المدني بالحرزات الشرقي", "itemNo": "1204700020003", "chassis": "JN6BY11Y55X507080", "color": "رسمية - اخضر", "model": "2005", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 372000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/24", "causedBy": "إسكان 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_373_اعا9363", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ا ع ا 9363", "unit": "مركز الدفاع المدني ببترومين", "itemNo": "1204700020003", "chassis": "JN6BY11Y85X507090", "color": "رسمية - اخضر", "model": "2005", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "تم الاصلا ح من قبل الفرقة", "faults": [{"_id": 373000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/29", "causedBy": "شعبة المروة / مركز الربوة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_374_بلط3933", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ل ط 3933", "unit": "مركز الدفاع المدني بالصناعية", "itemNo": "1204700020003", "chassis": "JN8FY15Y5CX590235", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الصناعية", "status": "تعمل بوجود ملاحظات", "notes": "مسلمة لشعبة الصناعية (جيب التدخل السريع الصناعية)", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_375_برح4843", "type": "سيارة جيب 4 باب نيسان رسمي", "plate": "ب ر ح 4843", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1204700020003", "chassis": "JN8FY15Y0AX581553", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة الساحل الجنوبي", "status": "تعمل بوجود ملاحظات", "notes": "جيب التدخل السريع الساحل الجنوبي", "faults": [{"_id": 375000, "faultType": "أخرى", "date": "1447/11/25", "repairDate": "1447/10/26", "causedBy": "مركز جنوب 5 ( المستودعات )", "desc": "تهريب بنزين من التانكي + عطل العوامه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_376_احك4833", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "أ ح ك 4833", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1204700030001", "chassis": "JTFLJ71JX88016351", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تم الإبلاغ عن العطل بخطاب", "faults": [{"_id": 376000, "faultType": "أخرى", "date": "1447/08/09", "repairDate": "", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_377_اصط5111", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ص ط 5111", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1204700030001", "chassis": "JTFLJ71J298018130", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 377000, "faultType": "عطل ميكانيكي", "date": "1447/11/03", "repairDate": "", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "عطل بالكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_378_اصط4840", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ص ط 4840", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700030001", "chassis": "jtflj71j698018387", "color": "رسمية - اصفر", "model": "2009", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 378000, "faultType": "أخرى", "date": "1445/04/07", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "عطل في مفتاح البودرة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_379_اعل7710", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ع ل 7710", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1204700030001", "chassis": "JTFLU73JXA4512736", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة الصناعية", "status": "تعمل بوجود ملاحظات", "notes": "ملاحظة بالانوار الخلفية", "faults": [{"_id": 379000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/07", "causedBy": "صناعية 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_380_اند2205", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ن د 2205", "unit": "شعبة التموين والمستودعات", "itemNo": "1204700030001", "chassis": "JTFLU71J6D4310886", "color": "رسمية - اصفر", "model": "2013", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "متعطله بالتموين", "faults": [{"_id": 380000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "1447/11/10", "causedBy": "الشؤون الإدارية", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_381_اعل7432", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ع ل 7432", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1204700030001", "chassis": "JTFLU73J3A4511881", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_382_انح4752", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ن ح 4752", "unit": "شعبة الشؤون الفنية", "itemNo": "1204700030001", "chassis": "JTFLU71JXD4310745", "color": "رسمية - اصفر", "model": "2013", "location": "الشؤون الفنية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_383_احك4846", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ح ك 4846", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1204700030001", "chassis": "JTFLJ1J188016304", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 383000, "faultType": "أخرى", "date": "", "repairDate": "1447/06/25", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_384_احك4168", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ح ك 4168", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700030001", "chassis": "jtflj71j788016534", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_385_اصط5186", "type": "سيارة جيب شاص تويوتا رسمي", "plate": "ا ص ط 5186", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1204700030001", "chassis": "jtflj71jx98018182", "color": "رسمية - اصفر", "model": "2009", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 385000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/06", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_386_ارل2735", "type": "سيارة جيب شاص نيسان رسمي", "plate": "ا ر ل 2735", "unit": "شعبة الدفاع المدني الميدانية بالسالمية", "itemNo": "1204700030002", "chassis": "JN6BY15Y62A501314", "color": "رسمية - زيتي", "model": "2002", "location": "شعبة السالمية", "status": "عطلانة", "notes": "ممنوع من السير باللون الأخضر من الامن والحماية", "faults": [{"_id": 386000, "faultType": "أخرى", "date": "1446/01/15", "repairDate": "", "causedBy": "شعبة السالمية", "desc": "دهان وكفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_387_رلص23", "type": "سيارة جيب شاص نيسان رسمي", "plate": "ر ل ص 23", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700030002", "chassis": "jn6by1sy12a500961", "color": "رسمية - اصفر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "حوش الستين", "faults": [{"_id": 387000, "faultType": "عطل ميكانيكي", "date": "1445/04/21", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "عطل في المكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_388_سقع638", "type": "سيارة جيب شاص نيسان رسمي", "plate": "س ق ع 638", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1204700030002", "chassis": "jn6by15y43a501927", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_389_ارر6375", "type": "سيارة حافلة ( اتوبيس ) صغير نيسان", "plate": "ا ر ر 6375", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1206700030002", "chassis": "jn6aw12s12z005341", "color": "رسمية - اخضر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447", "faults": [{"_id": 389000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/24", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_390_اين6829", "type": "سيارة حافلة ( اتوبيس ) كبيرة رسمية هونداي", "plate": "ا ى ن 6829", "unit": "شعبة التموين والمستودعات", "itemNo": "1206700010008", "chassis": "KMJKG18B5FC912155", "color": "رسمية - اصفر وابيض", "model": "2015", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_391_اوم4965", "type": "سيارة خفيفة للتدخل في الحوادث الصناعية والمواد الخطرة", "plate": "ا و م 4965", "unit": "مركز التدخل في المواد الخطرة ببريمان", "itemNo": "1105700150011", "chassis": "WDAX01931EN149807", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "تدخل بريمان", "faults": [{"_id": 391000, "faultType": "أخرى", "date": "1447/01/01", "repairDate": "1448/01/16", "causedBy": "شعبة المروة", "desc": "ليات الهواء - المكيف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_392_بدق3669", "type": "سيارة رآس تريلا سكس افيكو (صهريج)", "plate": "ب د ق 3669", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1207700040004", "chassis": "WJMS3TSE5JC386907", "color": "رسمية - اصفر", "model": "2018", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 392000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/15", "causedBy": "صناعية 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_393_بدق3654", "type": "سيارة رآس تريلا سكس افيكو (صهريج)", "plate": "ب د ق 3654", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1207700040004", "chassis": "WJMS3TSE7JC386908", "color": "رسمية - اصفر", "model": "2018", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_394_بدق3664", "type": "سيارة رآس تريلا سكس افيكو (صهريج)", "plate": "ب د ق 3664", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1207700040004", "chassis": "WJMS3TSE5JC386499", "color": "رسمية - اصفر", "model": "2018", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_395_بدق3659", "type": "سيارة رآس تريلا سكس افيكو (صهريج)", "plate": "ب د ق 3659", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1207700040004", "chassis": "WJMS3TSE7JC386763", "color": "رسمية - اصفر", "model": "2018", "location": "شعبة العزيزية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_396_باص9514", "type": "سيارة رآس تريلا سكس فولفو", "plate": "ب ا ص 9514", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1207700040008", "chassis": "YV2RSW0D6F0930183", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_397_اند4774", "type": "سيارة رآس تريلا سكس مان", "plate": "ا ن د 4774", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1207700040006", "chassis": "WMA26WZZ6DM613818", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "اللوبد - معاودة التعطل بعد الإصلاح الأول بتاريخ 10-11-1447 أي بعد 20 يوم خلال مدة الضمان", "faults": [{"_id": 397000, "faultType": "عطل ميكانيكي", "date": "1447/12/01", "repairDate": "1447/11/10", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب هواء من الباكم (الفرامل)"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_398_رصس601", "type": "سيارة رآس تريلا سكس مرسيدس", "plate": "ر ص س 601", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1207700040001", "chassis": "34301454800927", "color": "رسمية - اصفر", "model": "1981", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 398000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_399_صهط219", "type": "سيارة سلالم 28 متر", "plate": "ص ه ط 219", "unit": "شعبة الدفاع المدني الميدانية بالعزيزية", "itemNo": "1105700010001", "chassis": "WJMA1VRM004312828", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "تعمل انقاذ فقط", "faults": [{"_id": 399000, "faultType": "عطل ميكانيكي", "date": "1448/01/22", "repairDate": "1447/11/18", "causedBy": "وسط 1", "desc": "قطع في واير قفل الدفرنس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_400_اكع1641", "type": "سيارة سلالم 28 متر", "plate": "ا ك ع 1641", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700010001", "chassis": "WJMAIVRM004312280", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "( سلالم الطائف)", "faults": [{"_id": 400000, "faultType": "أخرى", "date": "1448/01/02", "repairDate": "1448/01/15", "causedBy": "شعبة الشاطئ", "desc": "اعطال متعدده"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_401_اصم3546", "type": "سيارة سلالم 28 متر", "plate": "أ ص م 3546", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700010001", "chassis": "WJMA1VRM004313301", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الشاطئ", "status": "تعمل بوجود ملاحظات", "notes": "متواجد بمجد 1 القصر - تعمل انقاذ فقط", "faults": [{"_id": 401000, "faultType": "أخرى", "date": "1448/01/27", "repairDate": "1447/09/07", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب ماء من خرطوم السلم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_402_بحن213", "type": "سيارة سلالم 28 متر (بيرس)", "plate": "ب ح ن 213", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700010001", "chassis": "4P1GT02S9WA000835", "color": "رسمية - اصفر", "model": "1998", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "بيرس", "faults": [{"_id": 402000, "faultType": "أخرى", "date": "1445/03/14", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_403_امن7536", "type": "سيارة سلالم 32 متر", "plate": "ا م ن 7536", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1105700010006", "chassis": "WDAYHCAA2CL672703", "color": "رسمية - اصفر", "model": "2012", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_404_امن7531", "type": "سيارة سلالم 32 متر", "plate": "أ م ن 7531", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1105700010006", "chassis": "WDAYHCAA8CL676030", "color": "رسمية - اصفر", "model": "2012", "location": "ش روزنباور", "status": "صدر قرار الرجيع", "notes": "رجيييييع", "faults": [{"_id": 404000, "faultType": "حادث مروري", "date": "1442/10/20", "repairDate": "", "causedBy": "شرق 2", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_405_باق1802", "type": "سيارة سلالم 32 متر", "plate": "ب ا ق 1802", "unit": "شعبة الدفاع المدني الميدانية بالحمدانية", "itemNo": "1105700010004", "chassis": "WDAYHCAA8FL911305", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "تم تسليمها لشعبة البغدادية بتاريخ 12-10-1447", "faults": [{"_id": 405000, "faultType": "كهربائي", "date": "1447/11/08", "repairDate": "1447/11/09", "causedBy": "مركز بلد 5 ( الشرفية )", "desc": "انقطاع الكهرباء عن السلة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_406_باد8505", "type": "سيارة سلالم 32 متر", "plate": "ب ا د 8505", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1105700010004", "chassis": "WDAYHCAA6FL910556", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "متواجدة بغرب 1 32 متر", "faults": [{"_id": 406000, "faultType": "خلل فني", "date": "1448/01/23", "repairDate": "1447/11/27", "causedBy": "مركز غرب 1 ( الشاطئ )", "desc": "عطل في طرمبات السله"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_407_باد8473", "type": "سيارة سلالم 32 متر", "plate": "ب ا د 8473", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1105700010004", "chassis": "WDAYHCAA2FL910554", "color": "رسمية - اصفر", "model": "2015", "location": "", "status": "تعمل", "notes": "32 متر", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_408_اصم3047", "type": "سيارة سلالم 32 متر", "plate": "ا ص م 3047", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1105700010006", "chassis": "WDAYHCAA8AL480005", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "سلمت لابحر من الشاطئ", "faults": [{"_id": 408000, "faultType": "أخرى", "date": "1447/07/01", "repairDate": "1447/11/06", "causedBy": "ابحر 1", "desc": "حساس التكايه الخلفيه اليمنى"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_409_اار4625", "type": "سيارة سلالم 52 متر", "plate": "ا ا ر 4625", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1105700010002", "chassis": "WJME2NST20C184936", "color": "رسمية - اصفر", "model": "2008", "location": "شعبة الشاطئ", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 409000, "faultType": "حادث مروري", "date": "1446/07/27", "repairDate": "", "causedBy": "غرب 1", "desc": "عطل في السلة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_410_ارر9193", "type": "سيارة سلالم 52 متر", "plate": "ا ر ر 9193", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700010002", "chassis": "WJME2NST20C185158", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "معاودة التعطل خلال فترة الضمان", "faults": [{"_id": 410000, "faultType": "أخرى", "date": "1448/01/09", "repairDate": "1447/12/25", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_411_اكي8267", "type": "سيارة سلالم 56 متر", "plate": "أ ك ي 8267", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1105700010005", "chassis": "WDB9301451L434755", "color": "رسمية - اصفر", "model": "2009", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 411000, "faultType": "أخرى", "date": "1448/01/23", "repairDate": "1447/12/16", "causedBy": "بلد 5", "desc": "تعليق في السله اثناء الفرد"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_412_حاب750", "type": "سيارة سنوركل", "plate": "ح ا ب 750", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700020001", "chassis": "4EN3AAA82W1008818", "color": "رسمية - اصفر", "model": "1998", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 412000, "faultType": "أخرى", "date": "1444/09/07", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_413_بمم335", "type": "سيارة سنوركل", "plate": "ب م م 335", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700020001", "chassis": "4EN3AAA81W1008812", "color": "رسمية - اصفر", "model": "1998", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 413000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_414_بحو4377", "type": "سيارة شفرليت رسمية للأخلاء الطبي", "plate": "ب ح و 4377", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700190001", "chassis": "1GCPY9EH3KZ276844", "color": "رسمية - اصفر", "model": "2019", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_415_باق2320", "type": "سيارة شفروليه رسمي لنقل اسطوانات التنفس", "plate": "ب ا ق 2320", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700160002", "chassis": "1GCOC9EG9FZ513348", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_416_باق2303", "type": "سيارة شفروليه رسمي لنقل اسطوانات التنفس", "plate": "ب ا ق 2303", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700160002", "chassis": "1GCOC9EG0FZ513433", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 416000, "faultType": "أخرى", "date": "1447/06/04", "repairDate": "1447/12/17", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "باب الادراج وطقم كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_417_بعص2226", "type": "سيارة صالون رسميه شفرليت", "plate": "ب ع ص 2226", "unit": "ادارة العمليات", "itemNo": "1203700010002", "chassis": "1GNSK6E01BR240713", "color": "رسمية - اخضر", "model": "2011", "location": "إدارة العمليات", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 25-12-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_418_حير4923", "type": "سيارة صالون رسميه شفرليت", "plate": "ح ى ر 4923", "unit": "المكتب", "itemNo": "1203700010002", "chassis": "1GNSK7ECXGR206146", "color": "رسمية - اخضر", "model": "2016", "location": "المكتب", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_419_قدا294", "type": "سيارة صغيرة رسمية شفرليت", "plate": "ق د ا 294", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1202700010001", "chassis": "6g1hk53f62l798995", "color": "رسمية - اخضر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "حوش النهضة", "faults": [{"_id": 419000, "faultType": "أخرى", "date": "1447/06/25", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_420_اعا9366", "type": "سيارة صغيرة رسمية شفرليت", "plate": "ا ع ا 9366", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1202700010001", "chassis": "6g1hk53fx2l801428", "color": "رسمية - اخضر", "model": "2002", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "حوش الستين", "faults": [{"_id": 420000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_421_اصم3816", "type": "سيارة غرفة عمليات ميدانية", "plate": "ا ص م 3816", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700030001", "chassis": "343603155023285", "color": "رسمية - اصفر", "model": "1982", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "تم الإصلاح بتاريخ 12-5-1447", "faults": [{"_id": 421000, "faultType": "أخرى", "date": "1445/07/24", "repairDate": "1447/05/12", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_422_اكب4812", "type": "سيارة فان افيكو رسمي للتجهيزات الفنية لوحدة الغواصين", "plate": "ا ك ب 4812", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700100001", "chassis": "ZCFC50AD4B5836876", "color": "رسمية - اصفر", "model": "2010", "location": "ورشة خارجية", "status": "عطلانة", "notes": "بديل من الشعبة", "faults": [{"_id": 422000, "faultType": "أخرى", "date": "1446/05/29", "repairDate": "", "causedBy": "شعبة الجامعة", "desc": "تأخير في التشغيل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_423_اعل3235", "type": "سيارة فان افيكو رسمي للتجهيزات الفنية لوحدة الغواصين", "plate": "ا ع ل 3235", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700100001", "chassis": "ZCFC50A21A5805438", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "ابحر 2", "faults": [{"_id": 423000, "faultType": "أخرى", "date": "", "repairDate": "1447/06/19", "causedBy": "شعبة أبحر", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_424_باح2731", "type": "سيارة فان افيكو رسمي للتجهيزات الفنية لوحدة الغواصين", "plate": "ب ا ح 2731", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1105700100001", "chassis": "ZCFC50AY6FD540305", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 424000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/13", "causedBy": "بلد 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_425_انو1933", "type": "سيارة فان مصندق افيكو رسمي مزودة بروبوت للتدخل في المواد الخطرة", "plate": "ا ن و 1933", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1205700030009", "chassis": "ZCFC50AD2D5941113", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "الحماية - تدخل الإسكان - تم اصلاح جزء من الأعطال (الدينمو)", "faults": [{"_id": 425000, "faultType": "أخرى", "date": "1446/09/02", "repairDate": "1447/11/27", "causedBy": "شعبة الإسكان الجنوبي", "desc": "المكيف + قزاز الأبواب"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_426_اهد6188", "type": "سيارة فان مصندق جمس رسمي", "plate": "ا ه د 6188", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1205700030007", "chassis": "1GTW78CG0D1123987", "color": "ابيض - مدنية", "model": "2013", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "لدى التموين - تاريخ اصلاح تقريبي", "faults": [{"_id": 426000, "faultType": "أخرى", "date": "1448/01/10", "repairDate": "1448/01/13", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_427_بسا6369", "type": "سيارة فورد رسمية لنقل التجهيزات الفنية لفرق المواد الخطرة", "plate": "ب س ا 6369", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1105700200001", "chassis": "1FDBF2B60KEF45587", "color": "رسمية - اصفر", "model": "2019", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_428_ارل1580", "type": "سيارة قلاب عادي مرسيدس", "plate": "ا ر ل 1580", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1207700050001", "chassis": "3460315525822", "color": "رسمية - اصفر", "model": "1983", "location": "الشؤون الإدارية", "status": "عطلانة", "notes": "لدى التموين", "faults": [{"_id": 428000, "faultType": "بطاريات", "date": "1447/02/13", "repairDate": "", "causedBy": "", "desc": "بطاريات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_429_ارل1570", "type": "سيارة قلاب عادي مرسيدس", "plate": "ا ر ل 1570", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1207700050001", "chassis": "VIN025815", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_430_ارل1574", "type": "سيارة قلاب عادي مرسيدس", "plate": "ا ر ل 1574", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1207700050001", "chassis": "VIN925943", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 430000, "faultType": "أخرى", "date": "1447/02/02", "repairDate": "1448/01/13", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_431_ارل1571", "type": "سيارة قلاب عادي مرسيدس", "plate": "ا ر ل 1571", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1207700050001", "chassis": "VIN025814", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 431000, "faultType": "أخرى", "date": "1447/02/02", "repairDate": "", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_432_باص5056", "type": "سيارة قيادة عمليات ميدانية افيكو", "plate": "ب ا ص 5056", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700030002", "chassis": "ZCF1TMD8D2611929", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_433_ارر6372", "type": "سيارة لوري سكس مرسيدس", "plate": "ا ر ر 6372", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1207700020001", "chassis": "39904755346001", "color": "رسمية - غير مخصصة", "model": "1989", "location": "الشؤون الإدارية", "status": "عطلانة", "notes": "لدى التموين", "faults": [{"_id": 433000, "faultType": "أخرى", "date": "1448/01/14", "repairDate": "1447/11/10", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_434_ارل1804", "type": "سيارة لوري عادي مرسيدس", "plate": "ا ر ل 1804", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1207700010001", "chassis": "43700855346031", "color": "رسمية - زيتي", "model": "1989", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "لدى التموين", "faults": [{"_id": 434000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "1447/11/11", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_435_رصس723", "type": "سيارة لوري عادي مرسيدس", "plate": "ر ص س 723", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1207700010001", "chassis": "34631154799996", "color": "رسمية - زيتي", "model": "1981", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "لدى التموين", "faults": [{"_id": 435000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_436_اطا3095", "type": "سيارة نقل ثلاجة ايسوزو", "plate": "ا ط ا 3095", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1208700040004", "chassis": "JAMKP34H597P04523", "color": "رسمية - اصفر", "model": "2009", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "لدى التموين", "faults": [{"_id": 436000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "1448/01/10", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_437_ارل1875", "type": "سيارة نقل سطحة ايسوزو", "plate": "ا ر ل 1875", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1208700020004", "chassis": "JALK6A13957100181", "color": "رسمية - اخضر", "model": "2005", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_438_احن5467", "type": "سيارة نقل عفش ايسوزو", "plate": "ا ح ن 5467", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1208700030004", "chassis": "JAMLP34GX87P10005", "color": "رسمية - اصفر", "model": "2008", "location": "الشؤون الإدارية", "status": "تم الإصلاح", "notes": "لدى التموين", "faults": [{"_id": 438000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "1447/11/10", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_439_باد4513", "type": "سيارة ونش سحب مرسيدس سكس", "plate": "ب ا د 4513", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1209700010004", "chassis": "WDASHAAA3FL921086", "color": "رسمية - اصفر", "model": "2015", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "تم اصلاح عطل الكفرات", "faults": [{"_id": 439000, "faultType": "عطل ميكانيكي", "date": "1448/02/06", "repairDate": "1447/05/15", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "تهريب ليات الهيدروليك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_440_بحق7112", "type": "سيارة ونش سحب مرسيدس سكس", "plate": "ب ح ق 7112", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1209700010004", "chassis": "WDASHAAA9G0043070", "color": "رسمية - اصفر", "model": "2016", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "قسم الدعم والاسناد", "faults": [{"_id": 440000, "faultType": "عطل ميكانيكي", "date": "1448/02/05", "repairDate": "1447/09/26", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب زيت الهيدروليك"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_441_الط1122", "type": "سيارة ونش سحب مرسيدس سكس", "plate": "ا ل ط 1122", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1209700010004", "chassis": "WDASHAAA4BL590254", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "عاود نفس العطل بعد حوالي الشهر من الإصلاح السابق", "faults": [{"_id": 441000, "faultType": "أخرى", "date": "1447/12/18", "repairDate": "1447/11/12", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "كسر في بوم الرفع"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_442_اعك7362", "type": "سيارة ونش سحب مرسيدس سكس", "plate": "ا ع ك 7362", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1209700010004", "chassis": "WDASHAAA7DL778589", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 442000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/29", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_443_اسل6378", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "أ س ل 6378", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1205700010001", "chassis": "1GTEK14V05E247556", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447 - تاريخ ابلاغ الإصلاح 25-11-1447", "faults": [{"_id": 443000, "faultType": "عطل ميكانيكي", "date": "1447/04/13", "repairDate": "1447/11/25", "causedBy": "مركز خزام 1 ( خزام )", "desc": "عطل بالكلتش والكفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_444_ارل4471", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ا ر ل 4471", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1205700010001", "chassis": "3GTEK14V86G231132", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "حوش الستين", "faults": [{"_id": 444000, "faultType": "أخرى", "date": "1447/08/01", "repairDate": "", "causedBy": "شعبة خزام", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_445_ارل4461", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ا ر ل 4461", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1205700010001", "chassis": "1GTEK14VX6E213996", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 445000, "faultType": "أخرى", "date": "", "repairDate": "1447/06/26", "causedBy": "غرب 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_446_صعس432", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ص ع س 432", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1205700010001", "chassis": "1gtek14v76e216225", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "جمس طفايات البودرة", "faults": [{"_id": 446000, "faultType": "عطل ميكانيكي", "date": "1447/10/14", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_447_ادح5005", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "أ د ح 5005", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1205700010001", "chassis": "1GTEK19C98Z251027", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "سيارة الملاية", "faults": [{"_id": 447000, "faultType": "أخرى", "date": "1447/09/15", "repairDate": "1447/11/05", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تلف افياش الانوار + عطل في تماتيك المراوح + ماس بالانوار"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_448_صاط257", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ص ا ط 257", "unit": "قسم تطوير الموارد البشرية", "itemNo": "1205700010001", "chassis": "3GTEK14V86G230000", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة المروة / مركز الربوة", "status": "عطلانة", "notes": "قسم التدريب على راس العمل", "faults": [{"_id": 448000, "faultType": "أخرى", "date": "1447/06/01", "repairDate": "", "causedBy": "", "desc": "بطارية + إطارات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_449_ارل4459", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "أ ر ل 4459", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1205700010001", "chassis": "1GTEK14V26E221235", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة المروة", "status": "تعمل بوجود ملاحظات", "notes": "كفرات + المكيف", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_450_احو5225", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ا ح و 5225", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1205700010001", "chassis": "1gtek19c58z228067", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_451_اقس1685", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ا ق س 1685", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1205700010001", "chassis": "1gt3kzbg0af106520", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 8-1-1448 ولم ترفع متعطله", "faults": [{"_id": 451000, "faultType": "أخرى", "date": "1448/01/07", "repairDate": "1448/01/10", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "مساعدات + تغيير مقصات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_452_اقي2947", "type": "سيارة ونيت (بيك أب) جمس رسمي", "plate": "ا ق ى 2947", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1205700010001", "chassis": "1GT229CG6BZ133604", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_453_صسع452", "type": "سيارة ونيت (بيك أب) شفرليت رسمي", "plate": "ص س ع 452", "unit": "شعبة التموين والمستودعات", "itemNo": "1205700010002", "chassis": "MPADL34P36H540848", "color": "رسمية - اخضر", "model": "2006", "location": "الشؤون الإدارية", "status": "عطلانة", "notes": "لدى التموين", "faults": [{"_id": 453000, "faultType": "أخرى", "date": "1447/07/02", "repairDate": "", "causedBy": "", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_454_صسع576", "type": "سيارة ونيت (بيك أب) شفرليت رسمي", "plate": "ص س ع 576", "unit": "إدارة الشؤون الإدارية", "itemNo": "1205700010002", "chassis": "MPADL34P56H562883", "color": "رسمية - اخضر", "model": "2006", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 28-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_455_ارر6371", "type": "سيارة ونيت (بيك أب) نيسان رسمي", "plate": "ا ر ر 6371", "unit": "شعبة الدفاع المدني الميدانية بالجامعة", "itemNo": "1205700020004", "chassis": "jn6by1sy02a501308", "color": "رسمية - اخضر", "model": "2002", "location": "شعبة الجامعة", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_456_ردو16", "type": "سيارة ونيت (بيك أب) نيسان رسمي", "plate": "ر د و 16", "unit": "شعبة الدفاع المدني الميدانية بالساحل الجنوبي", "itemNo": "1205700020004", "chassis": "JN6AD21S62X073711", "color": "رسمية - اخضر", "model": "2002", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_457_اطم8910", "type": "سيارة ونيت مصندق تويوتا رسمي", "plate": "ا ط م 8910", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1205700040001", "chassis": "MR0AX12G990023887", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "متوقف ومهمل", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_458_اطم8599", "type": "سيارة ونيت مصندق تويوتا رسمي", "plate": "ا ط م 8599", "unit": "شعبة الدفاع المدني الميدانية بالبغدادية", "itemNo": "1205700040001", "chassis": "MR0AX12G690029579", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة البغدادية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_459_اده3702", "type": "سيارة ونيت مصندق تويوتا رسمي", "plate": "ا د ه 3702", "unit": "شعبة الشؤون الفنية", "itemNo": "1205700040001", "chassis": "80020279", "color": "رسمية - اصفر", "model": "2008", "location": "الشؤون الفنية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_460_احو6691", "type": "سيارة ونيت مصندق تويوتا رسمي", "plate": "أ ح و 6691", "unit": "شعبة الشؤون الفنية", "itemNo": "1205700040001", "chassis": "MR0AX12G880018159", "color": "رسمية - اصفر", "model": "2008", "location": "الشؤون الفنية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_461_ارح5046", "type": "سيارة ونيت مصندق تويوتا رسمي", "plate": "ا ر ح 5046", "unit": "شعبة الشؤون الفنية", "itemNo": "1205700040001", "chassis": "MR0AX12GX90022814", "color": "رسمية - اصفر", "model": "2009", "location": "الشؤون الفنية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_462_سبي705", "type": "شاحنة التدخل في المواد الصناعية والمواد الخطرة", "plate": "س ب ى 705", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1105700150003", "chassis": "WDB9301635K985692", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "مركز التدخل بالمواد الخطرة بالاسكان", "faults": [{"_id": 462000, "faultType": "أخرى", "date": "1447/07/16", "repairDate": "1447/11/04", "causedBy": "إسكان 1", "desc": "البساتم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_463_اصم3985", "type": "شاحنة لأعمال التدخل والانقاذ في حوادث الزلازل", "plate": "أ ص م 3985", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700150001", "chassis": "WDAJ01933BN141645", "color": "رسمية - اصفر", "model": "2010", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 463000, "faultType": "أخرى", "date": "1447/09/09", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب زيت المكينة وتحتاج طقم كفرات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_464_اصم3992", "type": "شاحنة لأعمال التدخل والانقاذ في حوادث الزلازل", "plate": "أ ص م 3992", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1105700150001", "chassis": "WDJA01932BN141507", "color": "رسمية - اصفر", "model": "2010", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "انهيارات البلد - معاودة التعطل بعد 4 أيام من الإصلاح", "faults": [{"_id": 464000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/26", "causedBy": "بلد 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_465_صيع924", "type": "شاحنة مخصصة لأعمال التطهير", "plate": "ص ى ع 924", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1105700150004", "chassis": "zcfc5090005612684", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "ليست الية نوعية حسب الإفادة عربة تجهيزات فنية", "faults": [{"_id": 465000, "faultType": "عطل ميكانيكي", "date": "1445/01/15", "repairDate": "", "causedBy": "", "desc": "طرمبة الديزل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_466_اهو7367", "type": "شاحنة مخصصة لأعمال التطهير", "plate": "ا ه و 7367", "unit": "مركز التدخل في المواد الخطرة ببريمان", "itemNo": "1105700150004", "chassis": "WDB9301635L779819", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "الحماية - تدخل الصفا - طلبت للصيانة بتاريخ 22-12-1447", "faults": [{"_id": 466000, "faultType": "أخرى", "date": "1445/09/21", "repairDate": "1447/11/27", "causedBy": "شعبة المروة", "desc": "تهريب خزان الماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_467_بسع2827", "type": "عربة اطفاء مطورة (15)م3 مجهزة بمضخة وقاذف ( مباني عالية )", "plate": "ب س ع 2827", "unit": "مركز الدفاع المدني بالخالدية", "itemNo": "1101700010008", "chassis": "YV2XS02D3MA869545", "color": "رسمية - اصفر", "model": "2021", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_468_اقس6823", "type": "عربة التطهير", "plate": "ا ق س 6823", "unit": "مركز التدخل في المواد الخطرة بالصناعية", "itemNo": "1105700150012", "chassis": "YV2XS02D4MA876732", "color": "رسمية - اصفر", "model": "2021", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "طلبت للصيانة يوم الاثنين بتاريخ 28-8-1447", "faults": [{"_id": 468000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/28", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_469_بدون", "type": "عربة روبوت اطفاء بملحقاتها", "plate": "بدون", "unit": "قسم تطوير الموارد البشرية", "itemNo": "1101700010009", "chassis": "PC81JL00023", "color": "غير مخصصة", "model": "بدون", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 469000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/18", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_470_بصا2622", "type": "عربة للحرائق الصناعية مع برج تلسكوبي", "plate": "ب ص ا 2622", "unit": "شعبة الدفاع المدني الميدانية بالصناعية", "itemNo": "1101700040006", "chassis": "YV2XS02D7MA869886", "color": "رسمية - اصفر", "model": "2021", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "لجاهزة بوجود ملاحظات ولا ا تتحرك الا بأمر مدير الإدارة ومدير العمليات", "faults": [{"_id": 470000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/21", "causedBy": "صناعية 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_471_احب1779", "type": "غراف شيول كبير", "plate": "ا ح ب 1779", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1108700010001", "chassis": "CAT0980HKJMS04267", "color": "رسمية - اصفر", "model": "2008", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_472_اسق2409", "type": "غراف شيول وسط", "plate": "ا س ق 2409", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1108700020001", "chassis": "1359", "color": "رسمية - اصفر", "model": "1980", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 472000, "faultType": "أخرى", "date": "1442/05/27", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متنوعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_473_اسق2412", "type": "غراف شيول وسط", "plate": "ا س ق 2412", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1108700020001", "chassis": "60474", "color": "رسمية - اصفر", "model": "1980", "location": "شعبة الحمدانية / مركز ذهبان", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 473000, "faultType": "أخرى", "date": "1442/05/27", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متنوعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_474_ادع2018", "type": "غراف شيول وسط", "plate": "ا د ع 2018", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1108700020001", "chassis": "90C51512", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 474000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/20", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_475_ادط6360", "type": "غراف شيول وسط", "plate": "ا د ط 6360", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1108700020001", "chassis": "90C51506", "color": "رسمية - اصفر", "model": "2015", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_476_ارل1009", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ل 1009", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDB9301635L020794", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447", "faults": [{"_id": 476000, "faultType": "عطل ميكانيكي", "date": "1447/08/06", "repairDate": "1448/01/03", "causedBy": "مركز اسكان 3 ( الالفية )", "desc": "عطل بالجيربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_477_ارا7181", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ا 7181", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDAJHCAB69L377675", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "تم استلام الالية بعد اصلاح العطل السابق واتضح بان الكفرات متهالكة", "faults": [{"_id": 477000, "faultType": "أخرى", "date": "1448/01/19", "repairDate": "1448/01/24", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "مايعبي هواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_478_ارا7175", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "أ ر أ 7175", "unit": "مركز الدفاع المدني بالربوة", "itemNo": "1106700020010", "chassis": "WDAKHCABX9L372947", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة المروة", "status": "عطلانة", "notes": "", "faults": [{"_id": 478000, "faultType": "كفرات", "date": "1447/12/03", "repairDate": "1447/08/14", "causedBy": "مركز صفا 1 ( المروة )", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_479_ارا7183", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ا 7183", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDAKHCAB69L381015", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 479000, "faultType": "عطل ميكانيكي", "date": "1447/10/01", "repairDate": "", "causedBy": "شعبة الحمدانية", "desc": "لايقبل التعشيق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_480_ارا7095", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ا 7095", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDAKHCAB49L381014", "color": "رسمية - اصفر", "model": "2009", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل بوجود ملاحظات", "notes": "تعطل لدى شعبة العزيزية - طلبت للصيانة بتاريخ 24-10-1447 تم الإبلاغ عن عطل ضعف المضخة بتاريخ 25-11-1447 بعد اصلاح عطل الجربوكس", "faults": [{"_id": 480000, "faultType": "أخرى", "date": "1447/11/25", "repairDate": "", "causedBy": "وسط 1", "desc": "ضعف في دفع المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_481_صهم268", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ص ه م 268", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1106700020010", "chassis": "WDB9301635L162534", "color": "رسمية - اصفر", "model": "2007", "location": "مركز ثول", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد 8 أيام من الإصلاح", "faults": [{"_id": 481000, "faultType": "عطل ميكانيكي", "date": "1447/12/06", "repairDate": "1447/11/28", "causedBy": "ثول", "desc": "صحن الكلتش + المضخه عطلانة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_482_اصم3347", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ص م 3347", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1106700020010", "chassis": "WDB9301635L108402", "color": "رسمية - اصفر", "model": "2007", "location": "مركز ثول", "status": "عطلانة", "notes": "", "faults": [{"_id": 482000, "faultType": "أخرى", "date": "1447/08/10", "repairDate": "", "causedBy": "مركز ثول", "desc": "اعطال متعدده"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_483_ارح8875", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ح 8875", "unit": "مركز الدفاع المدني ببترومين", "itemNo": "1106700020010", "chassis": "WDAKHCAB69L381113", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "تم استلامها من الصيانة والكفر مبنشر - مركز بترومين", "faults": [{"_id": 483000, "faultType": "عطل ميكانيكي", "date": "1447/11/23", "repairDate": "1448/01/14", "causedBy": "خزام 1", "desc": "عطل بالقير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_484_ارا7722", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ا 7722", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDAKHCAB89L381016", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة أبحر", "status": "عطلانة", "notes": "معاودة التعطل خلال فترة الضمان", "faults": [{"_id": 484000, "faultType": "عطل ميكانيكي", "date": "1447/11/04", "repairDate": "1447/10/14", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_485_ارل1036", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ل 1036", "unit": "مركز الدفاع المدني بالمرحلة الاولى", "itemNo": "1106700020010", "chassis": "WDB9301635L016110", "color": "رسمية - اصفر", "model": "2006", "location": "الصيانة المركزية", "status": "تحت التجهيز والتسليم", "notes": "لم يتم الاستلام بعد اصلاح العطل لوجود عطل بالمضخه", "faults": [{"_id": 485000, "faultType": "عطل ميكانيكي", "date": "1448/01/24", "repairDate": "", "causedBy": "صناعية 2", "desc": "المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_486_ارل1010", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ل 1010", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020010", "chassis": "WDB9301635L020761", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-1-1448 ولم ترفع متعطله", "faults": [{"_id": 486000, "faultType": "أخرى", "date": "1448/01/15", "repairDate": "1448/01/21", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "عطل فني"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_487_صلا596", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ص ل ا 596", "unit": "مركز الدفاع المدني بالسامر", "itemNo": "1106700020010", "chassis": "WDB9301635L016108", "color": "رسمية - اصفر", "model": "2006", "location": "شعبة الصناعية", "status": "عطلانة", "notes": "تعمل تغطية بشكل مؤقت في صناعية 3 بالملاحظات ولم يتم إصلاحها من الصيانة", "faults": [{"_id": 487000, "faultType": "أخرى", "date": "1447/07/11", "repairDate": "", "causedBy": "صناعية 3", "desc": "ضعف ضغط المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_488_ارا7192", "type": "وايت سكس اكتروس بمضخه وقاذف", "plate": "ا ر ا 7192", "unit": "مركز الدفاع المدني بحى النخيل", "itemNo": "1106700020010", "chassis": "WDAKHCAB59L380244", "color": "رسمية - اصفر", "model": "2009", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 488000, "faultType": "مضخات", "date": "1447/12/08", "repairDate": "1448/01/29", "causedBy": "مركز سالمية 5 ( المنار )", "desc": "تهريب ماء من المضخه"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_489_ارر6612", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ر ر 6612", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "3430315491460", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 489000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_490_اصم3800", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ص م 3800", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "34303154941459", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 490000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_491_رصس605", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ر ص س 605", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "34303154942627", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 491000, "faultType": "أخرى", "date": "1442/12/22", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متنوعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_492_ارر6613", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ر ر 6613", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "343031540941074", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 492000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_493_ادم3126", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا د م 3126", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "34600155951192", "color": "رسمية - اصفر", "model": "1993", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 493000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_494_بحل3087", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ل 3087", "unit": "شعبة الدفاع المدني الميدانية بالشاطئ", "itemNo": "1106700020003", "chassis": "WDAKHAAA3G0039225", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "مجد 3 قصر السلام", "faults": [{"_id": 494000, "faultType": "أخرى", "date": "1447/10/10", "repairDate": "1447/11/10", "causedBy": "مركز مجد 3", "desc": "تهريب هواء في الأسطوانة وعطل بالكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_495_اكي8250", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 8250", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA9BL560179", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 495000, "faultType": "عطل ميكانيكي", "date": "1446/06/16", "repairDate": "", "causedBy": "", "desc": "ذراع الشيال"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_496_صلا197", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ص ل ا 197", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "WDB9301635L015690", "color": "رسمية - اصفر", "model": "2006", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 496000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_497_اوم4089", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 4089", "unit": "مركز الدفاع المدني بالاسواق الشعبية", "itemNo": "1106700020003", "chassis": "WDAKHAAA0EL861766", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-1-1448 ولم ترفع متعطله", "faults": [{"_id": 497000, "faultType": "أخرى", "date": "1448/01/16", "repairDate": "1448/01/28", "causedBy": "مركز صناعية 3 ( الاسواق الشعبية )", "desc": "كابينة المضخة + الاداراج الجانبية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_498_انع8482", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ع 8482", "unit": "مركز الدفاع المدني بالألفية", "itemNo": "1106700020003", "chassis": "WDAKAAA4DL732525", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الإسكان الجنوبي", "status": "عطلانة", "notes": "حدوث تلفيات بسبب البنشر", "faults": [{"_id": 498000, "faultType": "كفرات", "date": "1448/01/20", "repairDate": "1447/08/22", "causedBy": "مركز اسكان 3 ( الالفية )", "desc": "بنشر + تلف الجنط + كسر قربة الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_499_انب3911", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ب 3911", "unit": "مركز الدفاع المدني بالأندلس", "itemNo": "1106700020003", "chassis": "WDAKHAAA5DL713403", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "طلبت للصيانة ولم ترفع متعطلة بقروب الأعطال 13-1-1448", "faults": [{"_id": 499000, "faultType": "عطل ميكانيكي", "date": "1448/01/14", "repairDate": "1448/01/17", "causedBy": "مركز بلد 4 ( الاندلس )", "desc": "القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_500_انط2502", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ط 2502", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "WDAKHAAA6DL716861", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 500000, "faultType": "عطل ميكانيكي", "date": "1447/02/06", "repairDate": "1447/11/30", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "بواكم الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_501_ادم4920", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ د م 4920", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "WDB9500135K765118", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 501000, "faultType": "خلل فني", "date": "1447/08/24", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "عصا القير وتنسيم هواء من احد الخزانات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_502_بحل3070", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ل 3070", "unit": "مركز الدفاع المدني بالحرزات الشرقي", "itemNo": "1106700020003", "chassis": "WDAKHAAA2G0038034", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "اصلاح ذاتي للبنشر من قبل الشعبة للمرة الثالثة - طلبت للصيانة بتاريخ 13-1-1448 ولم ترفع متعطله", "faults": [{"_id": 502000, "faultType": "أخرى", "date": "1447/11/01", "repairDate": "1448/01/16", "causedBy": "إسكان 4", "desc": "كسر بالرفرف الخلفي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_503_امب1241", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ب 1241", "unit": "مركز الدفاع المدني بالحمدانية", "itemNo": "1106700020003", "chassis": "WDAKHAAA9CL631866", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "ملاحظة في الالية مع استمرار عملها في مركز شمال 5", "faults": [{"_id": 503000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/29", "causedBy": "شمال 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_504_انط2483", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ط 2483", "unit": "مركز الدفاع المدني بالحمراء", "itemNo": "1106700020003", "chassis": "WDAKHAAA7DL727268", "color": "رسمية - اصفر", "model": "2013", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_505_امب1872", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ب 1872", "unit": "مركز الدفاع المدني بالخالدية", "itemNo": "1106700020003", "chassis": "WDAKHAAA0CL632999", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "معاودة عطل البواكم في نفس الشهر", "faults": [{"_id": 505000, "faultType": "أخرى", "date": "1447/12/25", "repairDate": "1447/12/04", "causedBy": "غرب 2", "desc": "البواكم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_506_اوم7674", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 7674", "unit": "مركز الدفاع المدني بالخمرة", "itemNo": "1106700020003", "chassis": "WDAKHAAA5EL866669", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "تم طلبه للصيانة مرة أخرى بتاريخ 27-8-1447 ولم يرفع متعطل", "faults": [{"_id": 506000, "faultType": "كهربائي", "date": "1448/01/10", "repairDate": "1447/11/27", "causedBy": "مركز جنوب 4 ( الخمرة )", "desc": "خلل في الكهرباء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_507_اهس6583", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 6583", "unit": "مركز الدفاع المدني بالربوة", "itemNo": "1106700020003", "chassis": "WDAKHAAA3DL772417", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 507000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/13", "causedBy": "صفا 3", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_508_ارا7190", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ر ا 7190", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHCABX9L372950", "color": "رسمية - اصفر", "model": "2009", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 508000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_509_باد8362", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا د 8362", "unit": "مركز الدفاع المدني بالروابي", "itemNo": "1106700020003", "chassis": "WDAKHAAA1FL914556", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 509000, "faultType": "أخرى", "date": "", "repairDate": "1447/07/26", "causedBy": "شرق 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_510_انب3894", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ب 3894", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700020003", "chassis": "WDAKHAAA2DL713777", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "الاسناد", "faults": [{"_id": 510000, "faultType": "أخرى", "date": "1447/08/17", "repairDate": "", "causedBy": "شمال 5", "desc": "دودة الدركسون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_511_اين2716", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 2716", "unit": "مركز الدفاع المدني بابحرالشمالية", "itemNo": "1106700020003", "chassis": "WDAKHAAA8FL902839", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "تم الإصلاح من قبل الفرقة", "faults": [{"_id": 511000, "faultType": "كفرات", "date": "1447/10/18", "repairDate": "1447/11/04", "causedBy": "مركز ابحر 2 ( ابحر الشمالية )", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_512_انع8503", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ع 8503", "unit": "مركز الدفاع المدني بالشاطئ", "itemNo": "1106700020003", "chassis": "WDAKHAAA3DL708264", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "استلمت متعطله تهريب بالجربوكس بعد اصلاح العطل السابق", "faults": [{"_id": 512000, "faultType": "عطل ميكانيكي", "date": "1448/01/24", "repairDate": "1447/10/18", "causedBy": "غرب 1", "desc": "تهريب بالجربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_513_اصم3618", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ص م 3618", "unit": "مركز الدفاع المدني بالاسواق الشعبية", "itemNo": "1106700020003", "chassis": "3430154805270", "color": "رسمية - اصفر", "model": "1983", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "يوجد بديل من الشعبة", "faults": [{"_id": 513000, "faultType": "عطل ميكانيكي", "date": "1446/08/05", "repairDate": "1448/01/24", "causedBy": "صناعية 3", "desc": "عطل في القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_514_بحل3161", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ل 3161", "unit": "مركز الدفاع المدني بالصفا", "itemNo": "1106700020003", "chassis": "WDAKHAAA4G0038827", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة المروة", "status": "عطلانة", "notes": "", "faults": [{"_id": 514000, "faultType": "عطل ميكانيكي", "date": "1448/02/05", "repairDate": "1447/12/04", "causedBy": "مركز صفا 1 ( المروة )", "desc": "قماش خلفي يسار"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_515_باق1436", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا ق 1436", "unit": "مركز الدفاع المدني بالصفا", "itemNo": "1106700020003", "chassis": "WDAKHAAA1FL946682", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "طلبت للصيانة ولم ترفع متعطلة بقروب الأعطال 17-8-1447", "faults": [{"_id": 515000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/21", "causedBy": "صفا 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_516_اين6676", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 6676", "unit": "مركز الدفاع المدني بالصناعية", "itemNo": "1106700020003", "chassis": "WDAKHAAA0FL905914", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الصناعية", "status": "تعمل", "notes": "", "faults": [{"_id": 516000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز صناعية 1 ( الصناعية )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_517_اين6670", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 6670", "unit": "مركز الدفاع المدني بالأسكان الجنوبي", "itemNo": "1106700020003", "chassis": "WDAKHAAA8FL906227", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 517000, "faultType": "كفرات", "date": "1447/11/06", "repairDate": "1447/11/12", "causedBy": "مركز اسكان 1 ( الاسكان الجنوبي )", "desc": "بنشر كفر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_518_انط2503", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ط 2503", "unit": "مركز الدفاع المدني بالصناعية الثانية", "itemNo": "1106700020003", "chassis": "WDAKHAAA0DL716855", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "", "faults": [{"_id": 518000, "faultType": "عطل ميكانيكي", "date": "1447/12/01", "repairDate": "1447/06/04", "causedBy": "جنوب 2", "desc": "الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_519_اكي1598", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 1598", "unit": "مركز الدفاع المدني بالعزيزية", "itemNo": "1106700020003", "chassis": "WDAKHAAA4BL565872", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "تأمين الغمارة + الفرامل + حذفيه اثناء استخدام الفرمل + تهريب زيت الدركسون + يد باب الراكب + وزن الجزء الخلفي + خلط ماء مع الرغوة", "faults": [{"_id": 519000, "faultType": "أخرى", "date": "1447/11/23", "repairDate": "1447/11/26", "causedBy": "مركز وسط 2 ( العزيزية )", "desc": "أعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_520_اكي8255", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ك ي 8255", "unit": "مركز الدفاع المدني بالجامعة", "itemNo": "1106700020003", "chassis": "WDAKHAAA5BL560180", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 12-11-1447 - تم اصلاح عطل الجربوكس واتضح وجود عطل بالاذرعة والرمانات", "faults": [{"_id": 520000, "faultType": "عطل ميكانيكي", "date": "1447/09/21", "repairDate": "1448/01/13", "causedBy": "شرق 1", "desc": "اعطال في الاذرعة والرمانات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_521_باد8359", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا د 8359", "unit": "مركز الدفاع المدني بالمحمدية", "itemNo": "1106700020003", "chassis": "WDAKHAAA2FL906983", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 521000, "faultType": "كفرات", "date": "1447/12/02", "repairDate": "1447/12/03", "causedBy": "مركز ابحر 3 ( المحمدية )", "desc": "بنشر كفرين"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_522_اكي8454", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ك ي 8454", "unit": "مركز الدفاع المدني بالمروة", "itemNo": "1106700020003", "chassis": "WDAKHAAA4BL564463", "color": "رسمية - اصفر", "model": "2011", "location": "الصيانة المركزية", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 6-2-1448 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_523_انط2482", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ط 2482", "unit": "مركز الدفاع المدني بإسكان الشرفية", "itemNo": "1106700020003", "chassis": "WDAKHAAA0DL719092", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 523000, "faultType": "عطل ميكانيكي", "date": "1447/12/08", "repairDate": "1448/01/06", "causedBy": "بلد 5", "desc": "القير مايعشق للريوس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_524_اين6642", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 6642", "unit": "مركز الدفاع المدني بأبحر الجنوبية", "itemNo": "1106700020003", "chassis": "WDAKHAAA4FL905916", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_525_اوم2872", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 2872", "unit": "مركز الدفاع المدني بأم السلم", "itemNo": "1106700020003", "chassis": "WDAKHAAA7EL858766", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "طلبت للصيانة بتاريخ 17-10-1447 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_526_اوس7019", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و س 7019", "unit": "مركز الدفاع المدني بالروضة", "itemNo": "1106700020003", "chassis": "WDAKHAAA1EL830249", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "مطلوبة للصيانة 17-10-1447", "faults": [{"_id": 526000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/25", "causedBy": "مركز مجد 1 ( قصر السلام )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_527_اكي1592", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 1592", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA9BL566712", "color": "رسمية - اصفر", "model": "2011", "location": "مركز ثول", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447", "faults": [{"_id": 527000, "faultType": "أخرى", "date": "1447/08/10", "repairDate": "1447/11/05", "causedBy": "مركز وسط 1 ( الرحاب )", "desc": "كلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_528_اهس2260", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 2260", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1106700020003", "chassis": "WDAKHAAAXDL758319", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "تواريخ تقريبية", "faults": [{"_id": 528000, "faultType": "عطل ميكانيكي", "date": "1447/12/04", "repairDate": "1447/12/10", "causedBy": "مركز سالمية 1 ( السالمية )", "desc": "صحن الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_529_انط2496", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ط 2496", "unit": "مركز الدفاع المدني بالسالمية", "itemNo": "1106700020003", "chassis": "WDAKHAAA5DL716852", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 529000, "faultType": "حادث مروري", "date": "1441/08/29", "repairDate": "", "causedBy": "سالمية 1", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_530_الط1995", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ل ط 1995", "unit": "مركز الدفاع المدني بالسامر", "itemNo": "1106700020003", "chassis": "WDAKHAAAXCL599137", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة السالمية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 12-11-1447 - عند الاستلام بتاريخ 24-11-1447 اتضح وجود بنشر ثلاث كفرات ولم يتم الاستلام", "faults": [{"_id": 530000, "faultType": "عطل ميكانيكي", "date": "1448/01/29", "repairDate": "1447/11/24", "causedBy": "مركز سالمية 4 ( السامر )", "desc": "تهريب زيت من علبة الكلتش"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_531_انع8479", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ع 8479", "unit": "مركز الدفاع المدني بالسنابل", "itemNo": "1106700020003", "chassis": "WDAKHAAA6DL710655", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 24-10-1447", "faults": [{"_id": 531000, "faultType": "عطل ميكانيكي", "date": "1447/06/24", "repairDate": "", "causedBy": "صناعية 5", "desc": "جربوكس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_532_اهم1425", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه م 1425", "unit": "مركز الدفاع المدني بالخزام", "itemNo": "1106700020003", "chassis": "WDAKHAAA2EL799237", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة خزام", "status": "عطلانة", "notes": "معاودة تعطل الالية بعد يوم واحد من الإصلاح", "faults": [{"_id": 532000, "faultType": "أخرى", "date": "1447/11/13", "repairDate": "1447/11/12", "causedBy": "خزام 1", "desc": "الادراج الخلفية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_533_انع7207", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ع 7207", "unit": "مركز الدفاع المدني بحي الرياض", "itemNo": "1106700020003", "chassis": "WDAKHAAA3DL739059", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-10-1447 - معاودة التعطل بعد 9 أيام من الإصلاح السابق - تم تسجيل حادث مروري على الالية بتاريخ 27-1-1448", "faults": [{"_id": 533000, "faultType": "عطل ميكانيكي", "date": "1447/10/26", "repairDate": "1448/01/13", "causedBy": "شمال 4", "desc": "تهريب هواء والبواكم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_534_امب5814", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ب 5814", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1106700020003", "chassis": "WDAKHAAA1DL691819", "color": "رسمية - اصفر", "model": "2013", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 534000, "faultType": "عطل ميكانيكي", "date": "1447/10/14", "repairDate": "", "causedBy": "جنوب 1", "desc": "اقمشة + هوبات+مقصات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_535_انب3896", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ب 3896", "unit": "مركز الدفاع المدني بحى الحرازات الشمالي", "itemNo": "1106700020003", "chassis": "WDAKHAAA6DL715791", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "في شرق 5 - طلبت للصيانة بتاريخ 12-11-1447", "faults": [{"_id": 535000, "faultType": "أخرى", "date": "1447/10/26", "repairDate": "1448/01/13", "causedBy": "شرق 1", "desc": "تهريب ماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_536_بحل3138", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ل 3138", "unit": "مركز الدفاع المدني بحى الحرازات الشمالي", "itemNo": "1106700020003", "chassis": "WDAKHAAA6G0038036", "color": "رسمية - اصفر", "model": "2016", "location": "", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_537_اكي8251", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 8251", "unit": "مركز الدفاع المدني بالروضة", "itemNo": "1106700020003", "chassis": "WDAKHAAA9BL560389", "color": "رسمية - اصفر", "model": "2011", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "معاودة تعطل الالية بنفس العطل السابق القير بعد 13 يوم من الإصلاح السابق", "faults": [{"_id": 537000, "faultType": "عطل ميكانيكي", "date": "1447/11/11", "repairDate": "1447/11/12", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_538_اكي1593", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 1593", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700020003", "chassis": "WDAKHAAA7BL566711", "color": "رسمية - اصفر", "model": "2011", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 538000, "faultType": "كهربائي", "date": "1447/12/03", "repairDate": "1448/01/14", "causedBy": "مركز شمال 4 ( الرياض )", "desc": "الالية لاتشتغل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_539_اوس7038", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و س 7038", "unit": "مركز الدفاع المدني بالبغدادية", "itemNo": "1106700020003", "chassis": "WDAKHAAA2EL792238", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-10-1447", "faults": [{"_id": 539000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/26", "causedBy": "بلد 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_540_اوس7042", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و س 7042", "unit": "مركز الدفاع المدني بحى النخيل", "itemNo": "1106700020003", "chassis": "WDAKHAAA2EL797195", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "طلبت للصيانة ولم ترفع متعطله 19-10-1447 - تم الاستلام 20-10-1447", "faults": [{"_id": 540000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/13", "causedBy": "سالمية 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_541_انط2497", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ط 2497", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1106700020003", "chassis": "WDAKHAAA7DL716853", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "", "faults": [{"_id": 541000, "faultType": "حادث مروري", "date": "1439/08/01", "repairDate": "", "causedBy": "جنوب 1", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_542_اهس8359", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 8359", "unit": "مركز الدفاع المدني بالخاسكية", "itemNo": "1106700020003", "chassis": "WDAKHAAA1DL764543", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 542000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/29", "causedBy": "خزام 2", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_543_اهس8367", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 8367", "unit": "مركز الدفاع المدني بالرحاب", "itemNo": "1106700020003", "chassis": "WDAKHAAA0DL765733", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 2-1-1448 ولم ترفع متعطله", "faults": [{"_id": 543000, "faultType": "أخرى", "date": "1448/01/02", "repairDate": "1448/01/08", "causedBy": "وسط 1", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_544_اهم1420", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه م 1420", "unit": "مركز الدفاع المدني بحى بني مالك", "itemNo": "1106700020003", "chassis": "WDAKHAAA5EL788653", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة العزيزية", "status": "عطلانة", "notes": "معاودة العطل بعد يوم واحد", "faults": [{"_id": 544000, "faultType": "عطل ميكانيكي", "date": "1448/01/03", "repairDate": "1448/01/02", "causedBy": "مركز وسط 4 ( بني مالك )", "desc": "ليات القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_545_امط4147", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ط 4147", "unit": "مركز الدفاع المدني بالروابي", "itemNo": "1106700020003", "chassis": "WDAKHAAA5CL631864", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "", "faults": [{"_id": 545000, "faultType": "كفرات", "date": "1447/12/13", "repairDate": "1447/09/05", "causedBy": "شرق 2", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_546_اين2715", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 2715", "unit": "مركز الدفاع المدني بحي البوادي", "itemNo": "1106700020003", "chassis": "WDAKHAAA5FL901700", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "تم اصلاح عطل الدينمو والبطاريات بتاريخ 10-5-1447", "faults": [{"_id": 546000, "faultType": "أخرى", "date": "1447/04/12", "repairDate": "1447/05/10", "causedBy": "صفا 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_547_ببا2192", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ب ا 2192", "unit": "مركز الدفاع المدني بحي التيسير", "itemNo": "1106700020003", "chassis": "WDAKHAAA5FL947365", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة السالمية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_548_اهس8369", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 8369", "unit": "مركز الدفاع المدني بالعزيزية", "itemNo": "1106700020003", "chassis": "WDAKHAAA7DL766569", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 548000, "faultType": "أخرى", "date": "1447/12/02", "repairDate": "1447/12/08", "causedBy": "وسط 2", "desc": "قفل البكرة + بواكم + حساس فحمة الفرامل+مكينة زجاج يسار"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_549_اوم2866", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 2866", "unit": "مركز الدفاع المدني بأبحر الجنوبية", "itemNo": "1106700020003", "chassis": "WDAKHAAA5EL851640", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة أبحر", "status": "عطلانة", "notes": "بعد الإصلاح بيوم واحد تم معاودة عطل الالية كفرات", "faults": [{"_id": 549000, "faultType": "عطل ميكانيكي", "date": "1448/01/14", "repairDate": "1448/01/13", "causedBy": "ابحر 3", "desc": "فصله بالعشيق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_550_اوع4791", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و ع 4791", "unit": "مركز الدفاع المدني بالفيصلية", "itemNo": "1106700020003", "chassis": "WDAKHAAA7EL836041", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 2-1-1448 ولم ترفع متعطله", "faults": [{"_id": 550000, "faultType": "أخرى", "date": "", "repairDate": "1448/01/06", "causedBy": "صفا 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_551_اكي1595", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ك ى 1595", "unit": "مركز الدفاع المدني بالمرحلة الاولى", "itemNo": "1106700020003", "chassis": "WDAKHAAA2BL566714", "color": "رسمية - اصفر", "model": "2011", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 13-10-1447", "faults": [{"_id": 551000, "faultType": "أخرى", "date": "1446/04/19", "repairDate": "", "causedBy": "صناعية 2", "desc": "عطل في الادراج"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_552_انط2479", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ط 2479", "unit": "مركز الدفاع المدني بالمروة", "itemNo": "1106700020003", "chassis": "WDAKHAAA9DL719091", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "لم الاستلام لوجود اعطال لم يتم إصلاحها 12-11-1447", "faults": [{"_id": 552000, "faultType": "عطل ميكانيكي", "date": "1447/03/30", "repairDate": "1448/01/22", "causedBy": "صفا 5", "desc": "تهريب هواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_553_امك4421", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ك 4421", "unit": "مركز الدفاع المدني بالمحاميد", "itemNo": "1106700020003", "chassis": "WDAKHAAA8CL671632", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 553000, "faultType": "أخرى", "date": "", "repairDate": "1447/11/03", "causedBy": "إسكان 5", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_554_باد8349", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا د 8349", "unit": "مركز الدفاع المدني بحي السلامة", "itemNo": "1106700020003", "chassis": "WDAKHAAA1FL930224", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 554000, "faultType": "أخرى", "date": "1447/01/01", "repairDate": "1448/01/02", "causedBy": "وسط 5", "desc": "كويلات البطارية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_555_الط1977", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ل ط 1977", "unit": "مركز الدفاع المدني بالمستودعات", "itemNo": "1106700020003", "chassis": "WDAKHAAA8CL599136", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "مركز جنوب 5 المستودعات", "faults": [{"_id": 555000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/25", "causedBy": "شعبة الساحل / مركز الخمرة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_556_امب1858", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ م ب 1858", "unit": "مركز الدفاع المدني ببريمان", "itemNo": "1106700020003", "chassis": "WDAKHAAA5CL633727", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الحمدانية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 556000, "faultType": "عطل ميكانيكي", "date": "1447/03/15", "repairDate": "1447/11/12", "causedBy": "شمال2", "desc": "تعليق بالتعشيق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_557_اوس7036", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و س 7036", "unit": "مركز الدفاع المدني بحى السلامة", "itemNo": "1106700020003", "chassis": "WDAKHAAA3EL799084", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة خزام", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 557000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/07", "causedBy": "خزام 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_558_ببا2185", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ب ا 2185", "unit": "مركز الدفاع المدني بحي المنتزهات", "itemNo": "1106700020003", "chassis": "WDAKHAAA0FL947418", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "", "faults": [{"_id": 558000, "faultType": "كفرات", "date": "1448/02/04", "repairDate": "1448/01/08", "causedBy": "شرق 4", "desc": "بنشر كفر خلفي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_559_انط2504", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "أ ن ط 2504", "unit": "مركز الدفاع المدني بذهبان", "itemNo": "1106700020003", "chassis": "WDAKHAAA8DL716859", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "اتضح وجود عطل جديد عند استلام الالية بتاريخ 20-11-1447 معاودة تعطل الالية بعد الإصلاح بفترة قصيرة", "faults": [{"_id": 559000, "faultType": "أخرى", "date": "1448/01/11", "repairDate": "1448/01/06", "causedBy": "مركز شمال 1 ( الحمدانية )", "desc": "جلدة موزع بلف الهواء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_560_اهس8336", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 8336", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1106700020003", "chassis": "WDAKHAAA7DL772825", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 560000, "faultType": "حادث مروري", "date": "1442/04/02", "repairDate": "", "causedBy": "ثول", "desc": "حادث مروري — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_561_باد8343", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا د 8343", "unit": "مركز الدفاع المدني بطريق الساحل", "itemNo": "1106700020003", "chassis": "WDAKHAAA2FL921404", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "يوجد بديل من الاسناد", "faults": [{"_id": 561000, "faultType": "حادث مروري", "date": "1442/11/18", "repairDate": "", "causedBy": "جنوب 1", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_562_امط4146", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ط 4146", "unit": "مركز الدفاع المدني بمخطط الرحيلي", "itemNo": "1106700020003", "chassis": "WDAKHAAA0CL632520", "color": "رسمية - اصفر", "model": "2012", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-2-1448", "faults": [{"_id": 562000, "faultType": "عطل ميكانيكي", "date": "1446/05/21", "repairDate": "", "causedBy": "شمال 3", "desc": "عطل بالدينمو"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_563_اوم2878", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 2878", "unit": "مركز الدفاع المدني بحى المنار", "itemNo": "1106700020003", "chassis": "WDAKHAAA4EL857560", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة السالمية", "status": "تم الإصلاح", "notes": "تم الاستلام واتضح وجود العطل الجديد بنفس اليوم - طلبت للصيانة بتاريخ 17-11-1447 ولم ترفع متعطله", "faults": [{"_id": 563000, "faultType": "كفرات", "date": "1447/11/24", "repairDate": "1447/12/03", "causedBy": "سالمية 5", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_564_اوم2858", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 2858", "unit": "مركز الدفاع المدني بحي مشرفة", "itemNo": "1106700020003", "chassis": "WDAKHAAA4EL854870", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 564000, "faultType": "عطل ميكانيكي", "date": "1447/11/18", "repairDate": "1447/12/03", "causedBy": "غرب 2", "desc": "عطل في القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_565_ببا5669", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ب ا 5669", "unit": "مركز الدفاع المدني بحي النسيم", "itemNo": "1106700020003", "chassis": "WDAKHAAA3FL913845", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة العزيزية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 565000, "faultType": "كفرات", "date": "1447/11/26", "repairDate": "1447/11/26", "causedBy": "مركز وسط 3 ( النسيم )", "desc": "بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_566_اهس8371", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ه س 8371", "unit": "مركز الدفاع المدني بحي النهضة", "itemNo": "1106700020003", "chassis": "WDAKHAAAXDL768039", "color": "رسمية - اصفر", "model": "2013", "location": "شعبة الشاطئ", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 24-8-1447 بدون عطل مرفوع", "faults": [{"_id": 566000, "faultType": "أخرى", "date": "", "repairDate": "1447/08/16", "causedBy": "غرب 4", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_567_باق1438", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا ق 1438", "unit": "مركز الدفاع المدني بحي الوزيرية", "itemNo": "1106700020003", "chassis": "WDAKHAAA6FL946676", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة خزام", "status": "تعمل بوجود ملاحظات", "notes": "يعمل تغذية فقط", "faults": [{"_id": 567000, "faultType": "مضخات", "date": "1448/01/13", "repairDate": "1448/01/24", "causedBy": "مركز خزام 1 ( خزام )", "desc": "تهريب بالمضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_568_بحل3085", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ل 3085", "unit": "مركز الدفاع المدني بحي الوزيرية", "itemNo": "1106700020003", "chassis": "WDAKHAAA7G0039227", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة خزام", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_569_امب1859", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا م ب 1859", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700020003", "chassis": "WDAKHAAA4CL633461", "color": "رسمية - اصفر", "model": "2012", "location": "شعبة الساحل الجنوبي", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_570_انب3885", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ن ب 3885", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "WDAKHAAA3DL714811", "color": "رسمية - اصفر", "model": "2013", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "سعيد العمري", "faults": [{"_id": 570000, "faultType": "حادث مروري", "date": "1444/04/07", "repairDate": "", "causedBy": "شعبة الشاطئ", "desc": "حادث مروري — الإصلاح: حادث مروري بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_571_اوم7670", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا و م 7670", "unit": "مركز الدفاع المدني بدرة العروس", "itemNo": "1106700020003", "chassis": "WDAKHAAA0EL867373", "color": "رسمية - اصفر", "model": "2014", "location": "شعبة أبحر", "status": "عطلانة", "notes": "تعطل خلال نفس يوم الاستلام", "faults": [{"_id": 571000, "faultType": "أخرى", "date": "1448/01/24", "repairDate": "1448/01/23", "causedBy": "ابحر 4", "desc": "الباكم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_572_اين2713", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 2713", "unit": "مركز الدفاع المدني بقصر الجزيرة بثول", "itemNo": "1106700020003", "chassis": "WDAKHAAA5FL900997", "color": "رسمية - اصفر", "model": "2015", "location": "مركز ثول", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_573_باق5850", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا ق 5850", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA2FL935545", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 13-1-1448 ولم ترفع متعطله", "faults": [{"_id": 573000, "faultType": "كفرات", "date": "1448/01/17", "repairDate": "1448/01/23", "causedBy": "مركز بلد 3 ( باب مكة )", "desc": "تلفيات بنشر"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_574_باق1443", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا ق 1443", "unit": "مركز الدفاع المدني بقصر السلام", "itemNo": "1106700020003", "chassis": "WDAKHAAA2FL946674", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "", "faults": [{"_id": 574000, "faultType": "عطل ميكانيكي", "date": "1448/02/03", "repairDate": "", "causedBy": "مركز مجد 1 ( قصر السلام )", "desc": "تهريب في علبة الدركسون"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_575_اين2709", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ا ى ن 2709", "unit": "مركز الدفاع المدني بقويزة", "itemNo": "1106700020003", "chassis": "WDAKHAAA4FL899342", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الجامعة", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 20-1-1448 ولم ترفع متعطله", "faults": [{"_id": 575000, "faultType": "أخرى", "date": "", "repairDate": "1448/01/24", "causedBy": "شعبة الجامعة", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_576_باق5860", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا ق 5860", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA7FL946069", "color": "رسمية - اصفر", "model": "2015", "location": "إدارة العمليات", "status": "تعمل", "notes": "متواجد لدى قسم التدريب على راس العمل", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_577_بحق7141", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ق 7141", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA3G0006113", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الساحل الجنوبي", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 577000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/13", "causedBy": "مركز جنوب 3 ( طريق الساحل )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_578_بحق7138", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ق 7138", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA8G0005037", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_579_بحح6276", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ح ح 6276", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700020003", "chassis": "WDAKHAAA9GL983559", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة الشاطئ", "status": "تعمل", "notes": "تم طلب الالية بتاريخ 7-1-1448 ولم ترفع متعطله", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_580_باد8319", "type": "وايت سكس مرسيدس بمضخه وقاذف", "plate": "ب ا د 8319", "unit": "مركز الدفاع المدني بالصناعية", "itemNo": "1106700020003", "chassis": "WDAKHAAAXFL918184", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 24-10-1447 ولم ترفع متعطله", "faults": [{"_id": 580000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/26", "causedBy": "", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_581_بحق7105", "type": "وايت سكس مرسيدس بمضخه وقاذف ( مباني عالية )", "plate": "ب ح ق 7105", "unit": "مركز الدفاع المدني بالبغدادية", "itemNo": "1106700020003", "chassis": "WDAKHAAA6G0000144", "color": "رسمية - اصفر", "model": "2016", "location": "شعبة البغدادية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_582_بحق7103", "type": "وايت سكس مرسيدس بمضخه وقاذف ( مباني عالية )", "plate": "ب ح ق 7103", "unit": "مركز الدفاع المدني بالشاطئ", "itemNo": "1106700020003", "chassis": "WDAKHAAA4G0028122", "color": "رسمية - اصفر", "model": "2016", "location": "ش روزنباور", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 13-10-1447", "faults": [{"_id": 582000, "faultType": "مضخات", "date": "1447/02/16", "repairDate": "", "causedBy": "غرب 1", "desc": "ضعف في المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_583_بحق7117", "type": "وايت سكس مرسيدس بمضخه وقاذف ( مباني عالية )", "plate": "ب ح ق 7117", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700020003", "chassis": "WDAKHAAA9G0000140", "color": "رسمية - اصفر", "model": "2016", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_584_ارر6610", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "ا ر ر 6610", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010010", "chassis": "wdb6560115k333208", "color": "رسمية - اصفر", "model": "1998", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 584000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_585_سوح661", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س و ح 661", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010010", "chassis": "WDB9500131K797526", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 585000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_586_دعب499", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "د ع ب 499", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010010", "chassis": "wdb9500131k798353", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 586000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_587_سوح662", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س و ح 662", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010010", "chassis": "WDB9500131K799363", "color": "رسمية - اصفر", "model": "2003", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 587000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_588_سقه681", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س ق ه 681", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700010010", "chassis": "WDB9300131K919555", "color": "رسمية - اصفر", "model": "2005", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 588000, "faultType": "تجديد ودهان", "date": "1442/06/03", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "يحتاج الى غيار الغمارة وتجديد التانكي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_589_حسل107", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "ح س ل 107", "unit": "مركز الدفاع المدني بالحمراء", "itemNo": "1106700010010", "chassis": "WDB9500131K798003", "color": "رسمية - اصفر", "model": "2003", "location": "شعبة البغدادية", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 589000, "faultType": "مضخات", "date": "1444/04/24", "repairDate": "", "causedBy": "بلد 1", "desc": "المضخة + اعطال ميكانيكية"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_590_سقه393", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س ق ه 393", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010010", "chassis": "WDB9300131K913344", "color": "رسمية - اصفر", "model": "2004", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "اتضح وجود اعطال جديدة بعد الاستلام بتاريخ 28-12-1447", "faults": [{"_id": 590000, "faultType": "أخرى", "date": "1447/12/28", "repairDate": "1447/12/27", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب ديزل + وتهريب من المضخة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_591_سوح361", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س و ح 361", "unit": "مركز الدفاع المدني بالحمدانية", "itemNo": "1106700010010", "chassis": "WDB9500131K798212", "color": "رسمية - اصفر", "model": "2003", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 591000, "faultType": "عطل ميكانيكي", "date": "1447/09/15", "repairDate": "", "causedBy": "مركز شمال 3 ( الرحيلي )", "desc": "موزع الباكم"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_592_ادم4903", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "أ د م 4903", "unit": "مركز الدفاع المدني بالخاسكية", "itemNo": "1106700010010", "chassis": "WDB9500135K76011", "color": "رسمية - اصفر", "model": "2002", "location": "شعبة خزام", "status": "عطلانة", "notes": "استلمت واتضح بوجود تهريب بتانكي الماء بتاريخ 28-12-1447", "faults": [{"_id": 592000, "faultType": "أخرى", "date": "1447/08/17", "repairDate": "", "causedBy": "خزام 4", "desc": "تهريب تانكي الماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_593_سقه426", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س ق ه 426", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700010010", "chassis": "wdb9300131k918229", "color": "رسمية - اصفر", "model": "2005", "location": "شعبة الصناعية", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 593000, "faultType": "أخرى", "date": "1447/11/11", "repairDate": "1447/11/12", "causedBy": "شعبة الصناعية", "desc": "تهريب من ماسورة الخزان"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_594_ادم4909", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "أ د م 4909", "unit": "مركز الدفاع المدني بباب مكة", "itemNo": "1106700010010", "chassis": "WDB9500135K760137", "color": "رسمية - اصفر", "model": "2002", "location": "الصيانة المركزية", "status": "عطلانة", "notes": "", "faults": [{"_id": 594000, "faultType": "أخرى", "date": "1447/03/16", "repairDate": "", "causedBy": "بلد 3", "desc": "اعطال متعددة+صدأ بالتانكي"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_595_سحط156", "type": "وايت عادي اكتروس بمضخه وقاذف", "plate": "س ح ط 156", "unit": "مركز الدفاع المدني بحي الرياض", "itemNo": "1106700010010", "chassis": "WDB9500131K814822", "color": "رسمية - اصفر", "model": "2003", "location": "شعبة الحمدانية", "status": "عطلانة", "notes": "", "faults": [{"_id": 595000, "faultType": "عطل ميكانيكي", "date": "1446/10/22", "repairDate": "", "causedBy": "شمال 3", "desc": "عطل في الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_596_ادم2805", "type": "وايت عادي مرسيدس بمضخة", "plate": "ا د م 2805", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1106700010002", "chassis": "WDB34600155750633", "color": "رسمية - اصفر", "model": "1992", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 596000, "faultType": "عطل ميكانيكي", "date": "1447/09/07", "repairDate": "1447/12/04", "causedBy": "مركز جنوب 4 ( الخمرة )", "desc": "عطل في القير"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_597_صكس35", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ص ك س 35", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "634631156798605", "color": "رسمية - اصفر", "model": "1981", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 597000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_598_رصس615", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ر ص س 615", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "3403155025828", "color": "رسمية - اصفر", "model": "1982", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 598000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_599_اصم3746", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ص م 3746", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34603155025357", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 599000, "faultType": "أخرى", "date": "1447/06/12", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_600_رصس609", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ر ص س 609", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34603154914465", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 600000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_601_اصم3999", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ص م 3999", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34603L55025355", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 601000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_602_اصم3611", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ص م 3611", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "3463L55023683", "color": "رسمية - اصفر", "model": "1983", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 602000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_603_ادم2617", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2617", "unit": "شعبة الدفاع المدني الميدانية بالإسكان الجنوبي", "itemNo": "1106700010003", "chassis": "34600152717337", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الإسكان الجنوبي", "status": "تعمل", "notes": "طلبت للصيانة ولم ترفع متعطله 28-10-1447", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_604_اقي7543", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "أ ق ي 7543", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34600155361082", "color": "رسمية - اصفر", "model": "1988", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 604000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_605_ادم2209", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2209", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "346001417089", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 605000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_606_اقي7538", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7538", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "3460315502549", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 606000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_607_ادم2208", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2208", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "34600155386726", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "غرب 2 - تم طلبه للصيانة بتاريخ 13-10-1447 - مسجل عليه حادث مروري بتاريخ 26-5-1444", "faults": [{"_id": 607000, "faultType": "أخرى", "date": "", "repairDate": "1447/10/19", "causedBy": "شعبة الشاطئ", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_608_اقي7540", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7540", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34600155417059", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 608000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_609_دنل656", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "د ن ل 656", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34600155424078", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 609000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_610_اقي7542", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7542", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "38671055346001", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 610000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_611_اقي7539", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "أ ق ي 7539", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "42405655346001", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 611000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_612_ادم3140", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 3140", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "34600155505125", "color": "رسمية - اصفر", "model": "1990", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 612000, "faultType": "أخرى", "date": "", "repairDate": "", "causedBy": "مركز الدعم والاسناد الأول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_613_ادم2609", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2609", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "34600152717342", "color": "رسمية - اصفر", "model": "1991", "location": "الشؤون الإدارية", "status": "تعمل", "notes": "حوش النهضة الرجيع", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_614_ادم2607", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2607", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "34600152728921", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الحمدانية", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_615_ادم2212", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2212", "unit": "شعبة الدفاع المدني الميدانية بالسالمية", "itemNo": "1106700010003", "chassis": "WDB34600152728925", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة السالمية", "status": "عطلانة", "notes": "طلبت للصيانة 12-11-1447", "faults": [{"_id": 615000, "faultType": "عطل ميكانيكي", "date": "1447/12/08", "repairDate": "1447/11/16", "causedBy": "سالمية 5", "desc": "لايقبل التعشيق"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_616_رصس200", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ر ص س 200", "unit": "قسم الدعم والاسناد الأول", "itemNo": "1106700010003", "chassis": "34631154808228", "color": "رسمية - اصفر", "model": "1981", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "شعبة العزيزية", "faults": [{"_id": 616000, "faultType": "مضخات", "date": "1447/04/08", "repairDate": "", "causedBy": "وسط 5", "desc": "مضخة وتجديد"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_617_ادم4908", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "أ د م 4908", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "WDB9500135K739995", "color": "رسمية - اصفر", "model": "2002", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 6-11-1447 ولم ترفع متعطله", "faults": [{"_id": 617000, "faultType": "عطل ميكانيكي", "date": "1447/12/02", "repairDate": "1447/11/30", "causedBy": "مركز جنوب 1 ( الكورنيش )", "desc": "نظام نقل الحركة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_618_اقي7537", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7537", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1106700010003", "chassis": "WDB34300155900033", "color": "رسمية - اصفر", "model": "1992", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 618000, "faultType": "أخرى", "date": "1447/09/20", "repairDate": "", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب زيت المكينة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_619_اصم3747", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "أ ص م 3747", "unit": "مركز الدفاع المدني بالألفية", "itemNo": "1106700010003", "chassis": "34303154941458", "color": "رسمية - اصفر", "model": "1983", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 20-1-1448 ولم ترفع متعطله", "faults": [{"_id": 619000, "faultType": "أخرى", "date": "", "repairDate": "1448/01/24", "causedBy": "مركز اسكان 4 ( الحزرات الشرقي )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_620_ادم2605", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2605", "unit": "مركز الدفاع المدني بالبحارة بثول", "itemNo": "1106700010003", "chassis": "WDB34600152728951", "color": "رسمية - اصفر", "model": "1991", "location": "مركز ثول", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 620000, "faultType": "أخرى", "date": "", "repairDate": "1447/06/13", "causedBy": "ثول", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_621_ادم2611", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2611", "unit": "مركز الدفاع المدني بالحرزات الشرقي", "itemNo": "1106700010003", "chassis": "34600152728919", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الإسكان الجنوبي", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 19-10-1447 ولم ترفع متعطله - تم الاستلام 20-10-1447", "faults": [{"_id": 621000, "faultType": "أخرى", "date": "1447/12/18", "repairDate": "1447/12/18", "causedBy": "مركز اسكان 1 ( الاسكان الجنوبي )", "desc": "تهريب ماء"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_622_ادم2814", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2814", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "34600152717359", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الشاطئ", "status": "عطلانة", "notes": "تم انهاء الإجراءات المالية بتاريخ 7-1-1448", "faults": [{"_id": 622000, "faultType": "حادث مروري", "date": "1447/05/12", "repairDate": "", "causedBy": "غرب 2", "desc": "حادث مروري"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_623_ادم2815", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2815", "unit": "مركز الدفاع المدني بالكورنيش الجنوبي", "itemNo": "1106700010003", "chassis": "34600155905199", "color": "رسمية - اصفر", "model": "1992", "location": "شعبة الساحل الجنوبي", "status": "صدر قرار الرجيع", "notes": "", "faults": [{"_id": 623000, "faultType": "أخرى", "date": "1447/02/26", "repairDate": "", "causedBy": "جنوب 1", "desc": "اعطال متنوعة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_624_ادم4907", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 4907", "unit": "مركز الدفاع المدني بالنزهة", "itemNo": "1106700010003", "chassis": "WDB9500135K760166", "color": "رسمية - اصفر", "model": "2002", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "طلبت للصيانة بتاريخ 28-10-1447 ولم ترفع متعطله", "faults": [{"_id": 624000, "faultType": "أخرى", "date": "", "repairDate": "1447/11/10", "causedBy": "مركز صفا 2 ( النزهة )", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_625_ادم2203", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2203", "unit": "شعبة الدفاع المدني الميدانية بالمروة", "itemNo": "1106700010003", "chassis": "34600155410132", "color": "رسمية - اصفر", "model": "1989", "location": "شعبة المروة", "status": "تم الإصلاح", "notes": "معاودة تعطل الالية بعد 15 يوم من الإصلاح", "faults": [{"_id": 625000, "faultType": "خلل فني", "date": "1447/09/22", "repairDate": "1448/01/17", "causedBy": "مركز شمال 3 ( الرحيلي )", "desc": "تهريب هواء وثقل بالفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_626_ادم2214", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2214", "unit": "مركز الدفاع المدني ببترومين", "itemNo": "1106700010003", "chassis": "WDB34600152728889", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة خزام", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 17-10-1447 - معاودة تعطل الالية بعد يومين من الاستلام + معودة العطل للمرة الثانية بعد الإصلاح بعد 6 أيام الإصلاح - معاودة التعطل للمرة الثالثة بعد يوم من الاصلاح", "faults": [{"_id": 626000, "faultType": "أخرى", "date": "1447/11/26", "repairDate": "1447/11/25", "causedBy": "خزام 4", "desc": "عطل في طفاية التشغيل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_627_اقي7541", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7541", "unit": "مركز الدفاع المدني بقويزة", "itemNo": "1106700010003", "chassis": "55503855346001", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الجامعة", "status": "عطلانة", "notes": "طلبت للصيانة بتاريخ 12-11-1447 - تم اصلاح ارتفاع الحرارة واتضح وجود عطل في باكم الفرامل", "faults": [{"_id": 627000, "faultType": "أخرى", "date": "1447/09/21", "repairDate": "", "causedBy": "شرق 4", "desc": "باكم الفرامل"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_628_ادم2616", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2616", "unit": "مركز الدفاع المدني بحي المنتزهات", "itemNo": "1106700010003", "chassis": "WDB34600152728988", "color": "رسمية - اصفر", "model": "1991", "location": "شعبة الجامعة", "status": "تحت إجراءات الرجيع", "notes": "", "faults": [{"_id": 628000, "faultType": "أخرى", "date": "1442/12/07", "repairDate": "", "causedBy": "شرق 5", "desc": "اعطال متنوعة — الإصلاح: بدون إجراءات"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_629_ادم2832", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2832", "unit": "قسم الدعم والإسناد الأول", "itemNo": "1106700010003", "chassis": "WDB34600155905228", "color": "رسمية - اصفر", "model": "1992", "location": "شعبة البغدادية", "status": "تم الإصلاح", "notes": "تم استلامها من الصيانه واتضح بوجود اعطال لم يتم إصلاحها - طلبت للصيانة بتاريخ 28-10-1447", "faults": [{"_id": 629000, "faultType": "أخرى", "date": "1447/08/13", "repairDate": "1447/11/04", "causedBy": "بلد 2", "desc": "تهريب المضخة والمحابس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_630_اقي7533", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا ق ى 7533", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "33208955346001", "color": "رسمية - اصفر", "model": "1988", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 630000, "faultType": "أخرى", "date": "1448/01/16", "repairDate": "1447/09/20", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "اعطال متعددة"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_631_ادم2206", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 2206", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "34600155417060", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "عطلانة", "notes": "", "faults": [{"_id": 631000, "faultType": "أخرى", "date": "1447/12/04", "repairDate": "1447/09/06", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "تهريب هواء من الباكم (الفرامل)"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_632_دنل713", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "د ن ل 713", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "40402055346001", "color": "رسمية - اصفر", "model": "1989", "location": "مركز الدعم والاسناد الأول والثاني والثالث", "status": "تم الإصلاح", "notes": "", "faults": [{"_id": 632000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/20", "causedBy": "قسم الاسناد الاول والثاني والثالث", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_633_ادم3118", "type": "وايت عادي مرسيدس بمضخة وقاذف", "plate": "ا د م 3118", "unit": "قسم الدعم والإسناد الثاني", "itemNo": "1106700010003", "chassis": "2592", "color": "رسمية - اصفر", "model": "1993", "location": "شعبة أبحر", "status": "تم الإصلاح", "notes": "سلم الى بلد 2 - طلبت للصيانة بتاريخ 22-12-1447 ولم ترفع متعطله", "faults": [{"_id": 633000, "faultType": "أخرى", "date": "", "repairDate": "1447/09/07", "causedBy": "إسكان 1", "desc": "غير موصوف"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_634_اين3852", "type": "وايت ماء سقيا سكس مان (صهريج)", "plate": "ا ى ن 3852", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1201700020002", "chassis": "RS076WZZXFD008481", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة أبحر", "status": "عطلانة", "notes": "صهريج ابحر - تم الاستلام بتاريخ 3-1-1448 ومازالت الالية متعطلة", "faults": [{"_id": 634000, "faultType": "أخرى", "date": "1446/04/03", "repairDate": "", "causedBy": "ابحر 1", "desc": "تهريب مويه من محبس الخزان"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_635_اين3851", "type": "وايت ماء سقيا سكس مان (صهريج)", "plate": "ا ى ن 3851", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1201700020002", "chassis": "RS076WZZ1FD008479", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الجامعة", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_636_اين3866", "type": "وايت ماء سقيا سكس مان (صهريج)", "plate": "ا ى ن 3866", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1201700020002", "chassis": "RS076WZZ5FD008467", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الصناعية", "status": "تعمل بوجود ملاحظات", "notes": "تاريخ الرفع 28-5-1447", "faults": [{"_id": 636000, "faultType": "تجديد ودهان", "date": "", "repairDate": "", "causedBy": "صناعية 1", "desc": "صدأ وتآكل داخل الخزان"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_637_اين3859", "type": "وايت ماء سقيا سكس مان (صهريج)", "plate": "ا ى ن 3859", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1201700020002", "chassis": "RS076WZZ7FD008471", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة الساحل الجنوبي", "status": "عطلانة", "notes": "جنوب 1", "faults": [{"_id": 637000, "faultType": "كفرات", "date": "1448/02/02", "repairDate": "1447/12/08", "causedBy": "مركز جنوب 1 ( الكورنيش )", "desc": "تلف احد كفرات الراس"}], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_638_اين3860", "type": "وايت ماء سقيا سكس مان (صهريج)", "plate": "ا ى ن 3860", "unit": "قسم الدعم والإسناد الثالث", "itemNo": "1201700020002", "chassis": "RS076WZZ9FD008472", "color": "رسمية - اصفر", "model": "2015", "location": "شعبة المروة", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_639_قب3657", "type": "دراجة نارية ياماها 900 (ثلاث كفرات)", "plate": "ق ب 3657", "unit": "شعبة الدفاع المدني الميدانية بأبحر", "itemNo": "1306700010007", "chassis": "JYARN84Y5PA000325", "color": "رسمية - اصفر", "model": "2023", "location": "شعبة أبحر", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}, {"id": "v_640_قب3658", "type": "دراجة نارية ياماها 900 (ثلاث كفرات)", "plate": "ق ب 3658", "unit": "شعبة الدفاع المدني الميدانية بالخزام", "itemNo": "1306700010007", "chassis": "JYARN84Y6PA000317", "color": "رسمية - اصفر", "model": "2023", "location": "شعبة خزام", "status": "تعمل", "notes": "", "faults": [], "transfers": [], "createdAt": "2026-07-20"}]};

const emptyVehicle = () => ({
  id: "v_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
  type: "", plate: "", unit: "", itemNo: "", chassis: "",
  color: "", model: "", location: "", status: "تعمل", notes: "",
  faults: [], transfers: [],
  createdAt: new Date().toISOString().slice(0, 10),
});

const fmtDate = (d) => (d ? d : "—");

// ====== التقويم الهجري ======
const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

function todayHijri() {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      day: "numeric", month: "numeric", year: "numeric",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return { d: parseInt(get("day")), m: parseInt(get("month")), y: parseInt(get("year")) };
  } catch { return { d: 1, m: 1, y: 1448 }; }
}

// القيمة تُخزَّن بصيغة "1448/01/22" لتسهيل الترتيب الزمني
function hijriDisplay(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("/").map((x) => parseInt(x));
  if (!y || !m || !d) return str;
  return `${d} ${HIJRI_MONTHS[m - 1] || m} ${y}هـ`;
}

function HijriDateInput({ value, onChange, required }) {
  const t = todayHijri();
  const parsed = value ? value.split("/").map((x) => parseInt(x)) : [];
  const [y, m, d] = [parsed[0] || "", parsed[1] || "", parsed[2] || ""];

  // الحقول الإلزامية تبدأ بتاريخ اليوم الهجري تلقائياً
  useEffect(() => {
    if (required && !value) {
      onChange(`${t.y}/${String(t.m).padStart(2, "0")}/${String(t.d).padStart(2, "0")}`);
    }
  }, []);

  const emit = (ny, nm, nd) => {
    if (ny && nm && nd) onChange(`${ny}/${String(nm).padStart(2, "0")}/${String(nd).padStart(2, "0")}`);
    else onChange("");
  };
  const years = [];
  for (let yy = t.y + 1; yy >= t.y - 20; yy--) years.push(yy);
  const selStyle = { ...inputStyle, padding: "10px 6px", flex: 1, minWidth: 0 };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select style={selStyle} value={d} onChange={(e) => emit(y || t.y, m || t.m, parseInt(e.target.value) || "")}>
        <option value="">اليوم</option>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((dd) => <option key={dd} value={dd}>{dd}</option>)}
      </select>
      <select style={{ ...selStyle, flex: 1.6 }} value={m} onChange={(e) => emit(y || t.y, parseInt(e.target.value) || "", d || t.d)}>
        <option value="">الشهر</option>
        {HIJRI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select style={selStyle} value={y} onChange={(e) => emit(parseInt(e.target.value) || "", m || t.m, d || t.d)}>
        <option value="">السنة</option>
        {years.map((yy) => <option key={yy} value={yy}>{yy}هـ</option>)}
      </select>
      {!required && value && (
        <button onClick={() => onChange("")} title="مسح التاريخ" style={{ background: "none", border: "none", color: "#8B93A3", cursor: "pointer", fontSize: 15, fontFamily: "inherit", padding: 2 }}>✕</button>
      )}
    </div>
  );
}

async function loadDB() {
  // إن وُجدت بيانات محفوظة سابقاً تُستخدم هي؛ وإلا تُحقن بيانات ملف الإكسل تلقائياً
  try {
    const r = await window.storage.get(STORAGE_KEY);
    if (r) {
      const db = JSON.parse(r.value);
      if (db && Array.isArray(db.vehicles) && db.vehicles.length > 0) return db;
    }
  } catch {}
  const db = { vehicles: SEED_DB.vehicles };
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
  return db;
}
async function saveDB(db) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(db)); } catch (e) { console.error(e); }
}

// ====== مكونات صغيرة ======
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["صدر قرار الرجيع"];
  return (
    <span style={{
      background: c.bg, color: c.text, borderRadius: 20, padding: "3px 12px",
      fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#3A4152" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  border: "1.5px solid #C9CDD6", borderRadius: 10, padding: "10px 12px",
  fontSize: 14, fontFamily: "inherit", background: "#F4F5F7", color: "#1B2130",
  outline: "none", width: "100%", boxSizing: "border-box",
};

function KPI({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#F4F5F7", borderRadius: 14, padding: "16px 18px", flex: "1 1 140px",
      border: "1px solid #D9DCE2", borderTop: `4px solid ${color}`, minWidth: 130,
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#141A28", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5A6172", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#8B93A3", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatCard({ title, entries, accent }) {
  const top = entries[0];
  // العرض يقاس على أكبر قيمة معروضة (لا الأولى) كي لا تنفجر أشرطة قوائم الأقل
  const max = Math.max(1, ...entries.slice(0, 5).map(([, n]) => n));
  return (
    <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#5A6172", marginBottom: 10 }}>{title}</div>
      {!top ? (
        <div style={{ color: "#8B93A3", fontSize: 13 }}>لا توجد أعطال مسجلة بعد.</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: "1px dashed #D9DCE2" }}>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: accent }}>{top[0]}</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, background: "#E5E8EC", borderRadius: 14, padding: "2px 12px", whiteSpace: "nowrap" }}>{top[1]} عطل</span>
          </div>
          {entries.slice(1, 5).map(([k, n]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
                <span style={{ color: "#3A4152" }}>{k}</span><span style={{ color: "#8B93A3" }}>{n}</span>
              </div>
              <div style={{ background: "#E3E5E9", borderRadius: 5, height: 6 }}>
                <div style={{ width: Math.max((n / max) * 100, 4) + "%", background: accent, opacity: 0.55, height: "100%", borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ====== الشعار ======
function Logo({ logoSrc, onUpload }) {
  const fileRef = useRef(null);
  return (
    <div
      onClick={() => fileRef.current?.click()}
      title="اضغط لرفع الشعار الرسمي"
      className="hdr-logo"
      style={{
        width: 88, height: 66, borderRadius: 12, cursor: "pointer", flexShrink: 0, marginRight: -6,
        background: "#F4F5F7",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.35)",
      }}
    >
      <img src={logoSrc || DEFAULT_LOGO} alt="شعار الدفاع المدني" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3, boxSizing: "border-box" }} />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => onUpload(reader.result);
          reader.readAsDataURL(f);
        }} />
    </div>
  );
}

// ====== نموذج إضافة/تعديل آلية ======
function VehicleForm({ initial, onSave, onCancel }) {
  const [v, setV] = useState(initial);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const valid = v.plate.trim() && v.type.trim() && v.unit.trim();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
      <Field label="نوع الآلية *">
        <input style={inputStyle} list="type-suggestions" value={v.type} onChange={(e) => set("type", e.target.value)} placeholder="مثال: مضخة إطفاء" />
        <datalist id="type-suggestions">{TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field label="رقم اللوحة *"><input style={inputStyle} value={v.plate} onChange={(e) => set("plate", e.target.value)} placeholder="مثال: د م 1234" /></Field>
      <Field label="جهة الآلية *"><input style={inputStyle} value={v.unit} onChange={(e) => set("unit", e.target.value)} placeholder="مثال: مركز دفاع مدني ..." /></Field>
      <Field label="رقم الصنف"><input style={inputStyle} value={v.itemNo} onChange={(e) => set("itemNo", e.target.value)} /></Field>
      <Field label="رقم الشاصية"><input style={inputStyle} value={v.chassis} onChange={(e) => set("chassis", e.target.value)} /></Field>
      <Field label="اللون"><input style={inputStyle} value={v.color} onChange={(e) => set("color", e.target.value)} placeholder="مثال: أحمر" /></Field>
      <Field label="الموديل"><input style={inputStyle} value={v.model} onChange={(e) => set("model", e.target.value)} placeholder="مثال: 2020" /></Field>
      <Field label="موقع تواجد الآلية الحالي"><input style={inputStyle} value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="مثال: ورشة الصيانة المركزية" /></Field>
      <Field label="حالة الآلية الفنية">
        <select style={inputStyle} value={v.status} onChange={(e) => set("status", e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <div style={{ gridColumn: "1/-1" }}>
        <Field label="ملاحظات">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={v.notes}
            onChange={(e) => set("notes", e.target.value)} placeholder="اكتب أي ملاحظات نصية عن الآلية..." />
        </Field>
      </div>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, justifyContent: "flex-start" }}>
        <button disabled={!valid} onClick={() => onSave(v)} style={{
          background: valid ? "#9E1B22" : "#C9CCD4", color: "#fff", border: "none", borderRadius: 10,
          padding: "11px 26px", fontSize: 15, fontWeight: 800, cursor: valid ? "pointer" : "not-allowed", fontFamily: "inherit",
        }}>حفظ الآلية</button>
        <button onClick={onCancel} style={{
          background: "#F4F5F7", color: "#3A4152", border: "1.5px solid #C9CDD6", borderRadius: 10,
          padding: "11px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>إلغاء</button>
      </div>
    </div>
  );
}

// ====== سجل عام (أعطال / تنقلات) ======
function LogSection({ title, items, fields, onAdd, onDelete, emptyMsg, accent, sortKey }) {
  const [draft, setDraft] = useState({});
  const [open, setOpen] = useState(false);
  const reset = () => { setDraft({}); setOpen(false); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#141A28" }}>{title}</h4>
        <button onClick={() => setOpen(!open)} style={{
          background: open ? "#E3E5E9" : accent, color: open ? "#3A4152" : "#fff", border: "none",
          borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }}>{open ? "إغلاق" : "+ إضافة"}</button>
      </div>
      {open && (
        <div style={{ background: "#E9EBEF", border: "1px solid #D9DCE2", borderRadius: 12, padding: 14, marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label + (f.req ? " *" : "")}>
              {f.hijri ? (
                <HijriDateInput value={draft[f.key] || ""} required={!!f.req}
                  onChange={(val) => setDraft((p) => ({ ...p, [f.key]: val }))} />
              ) : f.options ? (
                <select style={inputStyle} value={draft[f.key] || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}>
                  <option value="">— اختر —</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.textarea ? (
                <textarea
                  disabled={f.requiresKey && !(draft[f.requiresKey] || "").trim()}
                  style={{
                    ...inputStyle, minHeight: 60, resize: "vertical",
                    ...(f.requiresKey && !(draft[f.requiresKey] || "").trim()
                      ? { background: "#EEEFF2", cursor: "not-allowed", borderStyle: "dashed" } : {}),
                  }}
                  value={draft[f.key] || ""}
                  placeholder={f.requiresKey && !(draft[f.requiresKey] || "").trim() ? (f.lockedPh || f.ph || "") : (f.ph || "")}
                  onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <input style={inputStyle} type={f.type || "text"} value={draft[f.key] || ""} placeholder={f.ph || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))} />
              )}
            </Field>
          ))}
          <div style={{ gridColumn: "1/-1" }}>
            <button onClick={() => { if (fields.some((f) => f.req && !(draft[f.key] || "").trim())) return; onAdd({ ...draft, _id: Date.now() }); reset(); }}
              style={{ background: "#141A28", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              تسجيل
            </button>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <div style={{ color: "#8B93A3", fontSize: 13, padding: "10px 0" }}>{emptyMsg}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...items].sort((a, b) => (b[sortKey] || "").localeCompare(a[sortKey] || "")).map((it) => (
            <div key={it._id} style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "6px 16px" }}>
                {fields.map((f) => (
                  <div key={f.key}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8B93A3", display: "block" }}>{f.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1B2130" }}>{f.hijri ? hijriDisplay(it[f.key]) : (it[f.key] || "—")}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => onDelete(it._id)} title="حذف" style={{ background: "none", border: "none", color: "#C4353C", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", alignSelf: "flex-start" }}>حذف</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== حقول سجل الأعطال ======
const FAULT_FIELDS = [
  { key: "faultType", label: "نوع العطل", options: FAULT_TYPES, req: true },
  { key: "date", label: "تاريخ العطل (هجري)", hijri: true, req: true },
  { key: "repairDate", label: "تاريخ الإصلاح (هجري)", hijri: true },
  { key: "causedBy", label: "الجهة المتسببة بالعطل", ph: "اختياري" },
  { key: "desc", label: "وصف العطل", ph: "وصف تفصيلي للعطل", req: true, textarea: true, requiresKey: "faultType", lockedPh: "اختر نوع العطل أولاً لتفعيل هذه الخانة" },
];
const TRANSFER_FIELDS = [
  { key: "date", label: "تاريخ النقل (هجري)", hijri: true, req: true },
  { key: "from", label: "من جهة", req: true },
  { key: "to", label: "إلى جهة", req: true },
  { key: "reason", label: "سبب النقل", ph: "اختياري" },
];

// ====== صفحة تفاصيل الآلية ======
function VehicleDetail({ vehicle, onUpdate, onDelete, onBack }) {
  const [tab, setTab] = useState("faults");
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const v = vehicle;

  const mutate = (key, fn) => onUpdate({ ...v, [key]: fn(v[key]) });

  const info = [
    ["نوع الآلية", v.type], ["رقم اللوحة", v.plate], ["جهة الآلية", v.unit],
    ["رقم الصنف", v.itemNo || "—"], ["رقم الشاصية", v.chassis || "—"],
    ["اللون", v.color || "—"], ["الموديل", v.model || "—"],
    ["الموقع الحالي", v.location || "—"], ["تاريخ الإضافة", v.createdAt],
  ];

  const openFaults = v.faults.filter((f) => !f.repairDate).length;

  const tabs = [
    { id: "faults", label: `سجل الأعطال والإصلاحات (${v.faults.length})` },
    { id: "transfers", label: `مسار التنقل بين الجهات (${v.transfers.length})` },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#9E1B22", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
        → العودة لسجل الآليات
      </button>

      <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 22, marginBottom: 16 }}>
        {editing ? (
          <VehicleForm initial={v} onCancel={() => setEditing(false)} onSave={(nv) => { onUpdate(nv); setEditing(false); }} />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#141A28" }}>{v.type} — {v.plate}</div>
                <div style={{ fontSize: 14, color: "#5A6172", marginTop: 3 }}>
                  {v.unit}{v.location ? " · الموقع الحالي: " + v.location : ""}
                  {openFaults > 0 && <span style={{ color: "#8F1C22", fontWeight: 800 }}> · أعطال قائمة: {openFaults}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusBadge status={v.status} />
                <select value={v.status} onChange={(e) => onUpdate({ ...v, status: e.target.value })}
                  style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => setEditing(true)} style={{ background: "#141A28", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>تعديل البيانات</button>
                {confirmDel ? (
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <button onClick={() => onDelete(v.id)} style={{ background: "#C4353C", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>تأكيد الحذف</button>
                    <button onClick={() => setConfirmDel(false)} style={{ background: "#E3E5E9", color: "#3A4152", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>تراجع</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDel(true)} style={{ background: "#F4F5F7", color: "#C4353C", border: "1.5px solid #F0C7C9", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>حذف</button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
              {info.map(([k, val]) => (
                <div key={k} style={{ background: "#E9EBEF", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8B93A3", marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1B2130" }}>{val}</div>
                </div>
              ))}
            </div>
            {v.notes && (
              <div style={{ marginTop: 12, fontSize: 13.5, color: "#5A6172", background: "#FBF9F2", border: "1px solid #EFE8D4", borderRadius: 10, padding: "10px 14px", whiteSpace: "pre-wrap" }}>
                <b style={{ color: "#8A5A0B" }}>ملاحظات:</b> {v.notes}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? "#9E1B22" : "#fff", color: tab === t.id ? "#fff" : "#3A4152",
            border: tab === t.id ? "none" : "1.5px solid #C9CDD6", borderRadius: 10, padding: "9px 18px",
            fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 20 }}>
        {tab === "faults" && (
          <LogSection title="سجل الأعطال والإصلاحات" accent="#C4353C" items={v.faults} sortKey="date"
            emptyMsg="لا توجد أعطال مسجلة على هذه الآلية."
            fields={FAULT_FIELDS}
            onAdd={(it) => mutate("faults", (a) => [...a, it])}
            onDelete={(id) => mutate("faults", (a) => a.filter((x) => x._id !== id))}
          />
        )}
        {tab === "transfers" && (
          <LogSection title="مسار التنقل بين الجهات" accent="#1F4E8C" items={v.transfers} sortKey="date"
            emptyMsg="لم تُنقل هذه الآلية بين الجهات بعد."
            fields={TRANSFER_FIELDS}
            onAdd={(it) => onUpdate({ ...v, transfers: [...v.transfers, it], unit: it.to || v.unit })}
            onDelete={(id) => mutate("transfers", (a) => a.filter((x) => x._id !== id))}
          />
        )}
      </div>
    </div>
  );
}

// ====== الداشبورد التفاعلي ======
const VIVID = ["#FF5D73", "#FFB800", "#00C48C", "#00A8E8", "#7C5CFF", "#FF7A00", "#E8336D", "#12B8A6", "#8AC926", "#FFD166"];
const STATUS_VIVID = {
  "تعمل": "#00C48C", "عطلانة": "#FF5D73", "تم الإصلاح": "#00A8E8",
  "تعمل بوجود ملاحظات": "#FFB800", "تحت التجهيز والتسليم": "#12B8A6",
  "تحت إجراءات الرجيع": "#7C5CFF", "صدر قرار الرجيع": "#94A3B8",
};

function ChartCard({ title, icon, grad, children }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 20, overflow: "hidden", width: "100%",
      boxShadow: "0 12px 34px rgba(20,26,40,0.08)", border: "1px solid #E7E9EE",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ height: 4, background: grad }} />
      <div style={{ padding: "15px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #F0F1F5" }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, background: grad, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          boxShadow: "0 4px 12px rgba(20,26,40,0.2)", flexShrink: 0,
        }}>{icon}</span>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1B2130" }}>{title}</span>
      </div>
      <div style={{ padding: "16px 18px 18px", flex: 1 }}>{children}</div>
    </div>
  );
}

const ttStyle = {
  contentStyle: { fontFamily: "'Tajawal',sans-serif", borderRadius: 12, border: "1px solid #D9DCE2", boxShadow: "0 6px 18px rgba(0,0,0,0.1)", fontWeight: 700, fontSize: 13, direction: "rtl" },
};
const tick = { fontFamily: "'Tajawal',sans-serif", fontSize: 11.5, fontWeight: 700, fill: "#3A4152" };


// ====== إحصائية عمر التوقف: الآليات الأطول تعطلاً بالأيام من تواريخ أعطالها الهجرية ======
function DowntimeCard({ vehicles }) {
  const t = todayHijri();
  const dayNum = (s) => {
    const m = String(s || "").match(/(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!m) return null;
    return (+m[1]) * 354.367 + ((+m[2]) - 1) * 29.53 + (+m[3]);
  };
  const todayNum = t.y * 354.367 + (t.m - 1) * 29.53 + t.d;
  const BR = ["عطلانة", "تحت التجهيز والتسليم"];
  const data = useMemo(() => {
    const rows = [];
    vehicles.forEach((v) => {
      if (!BR.includes((v.status || "").trim())) return;
      const open = (v.faults || []).filter((f) => !f.repairDate).map((f) => ({ f, n: dayNum(f.date) })).filter((x) => x.n);
      if (!open.length) return;
      open.sort((a, b) => a.n - b.n);
      const days = Math.max(1, Math.round(todayNum - open[0].n));
      rows.push({ v, f: open[0].f, days });
    });
    rows.sort((a, b) => b.days - a.days);
    const bands = [
      { k: "أكثر من سنة", min: 355, c: "#7A1016", list: [] },
      { k: "من 6 أشهر إلى سنة", min: 178, c: "#B3121C", list: [] },
      { k: "من 3 إلى 6 أشهر", min: 89, c: "#D97706", list: [] },
      { k: "من شهر إلى 3 أشهر", min: 30, c: "#E3A008", list: [] },
      { k: "أقل من شهر", min: 0, c: "#5A6172", list: [] },
    ];
    rows.forEach((r) => { bands.find((b) => r.days >= b.min).list.push(r); });
    return { rows, bands };
  }, [vehicles]);
  const fmt = (d) => d >= 355 ? `${(d / 354.367).toFixed(1)} سنة` : d >= 30 ? `${Math.round(d / 29.53)} أشهر` : `${d} يوماً`;
  const top = data.rows.slice(0, 15);
  const [openBand, setOpenBand] = useState(null);
  return (
    <ChartCard title="أطول الآليات توقفاً بسبب الأعطال" icon="⏳" grad="linear-gradient(90deg, #7A1016, #E3A008)">
      {data.rows.length === 0 ? (
        <div style={{ padding: 20, fontWeight: 700, color: "#5A6172" }}>لا توجد آليات متوقفة حالياً.</div>
      ) : (
        <div style={{ padding: "14px 18px 18px" }}>
          {/* شرائح التصنيف الزمني — انقر أي شريحة لعرض آلياتها */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            {data.bands.map((b) => (
              <div key={b.k} onClick={() => setOpenBand(openBand === b.k ? null : b.k)} style={{
                cursor: "pointer", background: openBand === b.k ? b.c : "#F4F5F7", color: openBand === b.k ? "#fff" : "#141A28",
                border: `2px solid ${b.c}`, borderRadius: 12, padding: "7px 13px", fontSize: 12.5, fontWeight: 800,
              }}>
                {b.k}: <span style={{ color: openBand === b.k ? "#fff" : b.c }}>{b.list.length}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "#8B93A3", fontWeight: 700, marginBottom: 10 }}>
            الأقدم توقفاً: {data.rows[0].v.type} — {data.rows[0].v.plate} ({fmt(data.rows[0].days)}) · إجمالي المتوقفة {data.rows.length} آلية
          </div>
          {openBand && (
            <div style={{ background: "#F9FAFB", border: "1px solid #E7E9EE", borderRadius: 14, padding: "10px 12px", marginBottom: 12, maxHeight: 300, overflowY: "auto" }}>
              {(data.bands.find((b) => b.k === openBand)?.list || []).map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 2px", borderBottom: "1px solid #EEF0F4", fontSize: 12, fontWeight: 700 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.v.type} — {r.v.plate} <span style={{ color: "#8B93A3" }}>· {r.v.unit || ""}</span></span>
                  <b style={{ color: "#9E1B22", flexShrink: 0 }}>{r.days} يوماً ({fmt(r.days)})</b>
                </div>
              ))}
            </div>
          )}
          {/* أطول 15 آلية — أعمدة أفقية ملونة بحسب شريحتها */}
          <ResponsiveContainer width="100%" height={Math.max(300, top.length * 26)}>
            <BarChart data={top.map((r) => ({ name: `${r.v.plate}`, days: r.days, type: r.v.type, unit: r.v.unit, desc: r.f.desc || r.f.faultType || "", band: data.bands.find((b) => r.days >= b.min).c }))}
              layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 11, fontWeight: 800 }} />
              <Tooltip formatter={(v) => [v + " يوماً", "مدة التوقف"]}
                labelFormatter={(l, p) => p && p[0] ? `${p[0].payload.type} — ${l} · ${p[0].payload.unit || ""}${p[0].payload.desc ? " · " + p[0].payload.desc : ""}` : l} />
              <Bar dataKey="days" radius={[0, 8, 8, 0]}>
                <LabelList dataKey="days" position="left" style={{ fontSize: 11, fontWeight: 800, fill: "#141A28" }} formatter={(v) => v + " يوم"} />
                {top.map((r, i) => <Cell key={i} fill={data.bands.find((b) => r.days >= b.min).c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function InteractiveDashboard({ vehicles, counts, faultStats, centerReadiness, equip, supportCounts, prio, prioWeights }) {
  const statusData = STATUSES.map((s) => ({ name: s, value: counts[s] || 0 })).filter((d) => d.value > 0);

  // ====== إحصائيات صفحة الجاهزية (قراءة فقط) ======
  const rdy = useMemo(() => {
    const cr = centerReadiness || {}, eq = equip || {};
    // توزيع المراكز على المستويات + تفصيل كل شعبة
    let g = 0, y = 0, r = 0;
    const branchRows = MANUAL_CENTERS.map(({ branch, centers }) => {
      let bg = 0, by = 0, br = 0;
      centers.forEach((c) => {
        const lv = fullCenterStatus(c, cr[c], eq).level;
        if (lv === "green") { bg++; g++; } else if (lv === "yellow") { by++; y++; } else { br++; r++; }
      });
      return { name: branch.replace("شعبة ", "").replace("مركز ", ""), "مكتملة": bg, "ناقصة": by, "عجز كامل": br };
    });
    const total = g + y + r;
    // بوصلة التغطية: أخطر المراكز
    const compass = buildCompass(cr, prio || {}, prioWeights || { inc: 50, den: 25, fac: 25 });
    const topRisk = compass.filter((x) => x.risk > 0).slice(0, 10)
      .map((x) => ({ name: x.name.replace("مركز ", "").replace(/\s*\(.*\)\s*/, ""), "عجز التغطية": x.risk }));
    const totalRisk = compass.reduce((a, x) => a + x.risk, 0);
    // الإسناد
    const sc = supportCounts || {};
    let sg = 0, sy = 0, sr = 0;
    SUPPORT_SLOTS.forEach(([k, , multi]) => {
      const lv = supportLevel(sc[k] || 0, multi);
      if (lv === "green") sg++; else if (lv === "yellow") sy++; else sr++;
    });
    // تغطية المعدات النوعية
    const ring = MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => (eq.ringCutter || {})[c])).length;
    const elev = MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => (eq.elevatorKey || {})[c])).length;
    return {
      g, y, r, total, pct: total ? Math.round((g / total) * 100) : 0,
      branchRows, topRisk, totalRisk,
      support: [{ name: "جاهزة", value: sg }, { name: "الحد الأدنى", value: sy }, { name: "متعطلة كلياً", value: sr }],
      supportReady: sg, ring, elev,
    };
  }, [centerReadiness, equip, supportCounts, prio, prioWeights]);

  const readyPct = counts.total
    ? Math.round(((counts["تعمل"] + counts["تم الإصلاح"] + counts["تعمل بوجود ملاحظات"]) / counts.total) * 100) : 0;

  const monthMap = Object.fromEntries(faultStats.byMonth);
  const monthData = HIJRI_MONTHS.map((m) => ({ name: m, "عدد الأعطال": monthMap[m] || 0 }));

  const ftypeData = faultStats.byFType.map(([name, value], i) => ({ name, value, fill: VIVID[i % VIVID.length] }));
  // عطلانة حالياً حسب الجهة (لا السجل التاريخي)
  const unitFaultData = useMemo(() => {
    const m = {};
    vehicles.forEach((v) => { if (v.status === "عطلانة") { const u = unifyUnit(v.unit); m[u] = (m[u] || 0) + 1; } });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, v]) => ({ name, "عطلانة حالياً": v }));
  }, [vehicles]);
  // الأكثر أعطالاً خلال 12 شهراً هجرياً ماضية (من سجلات الأعطال المؤرخة)
  const unit12mData = useMemo(() => {
    const t = todayHijri();
    const nowIdx = t.y * 12 + (t.m - 1);
    const m = {};
    vehicles.forEach((v) => (v.faults || []).forEach((f) => {
      const [fy, fm] = (f.date || "").split("/").map((x) => parseInt(x));
      if (!fy || !fm) return;
      const idx = fy * 12 + (fm - 1);
      if (idx <= nowIdx && idx > nowIdx - 12) {
        const u = unifyUnit(v.unit);
        m[u] = (m[u] || 0) + 1;
      }
    }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, v]) => ({ name, "أعطال 12 شهراً": v }));
  }, [vehicles]);
  const typeFaultData = faultStats.byVType.slice(0, 8).map(([name, v]) => ({ name, "الأعطال": v }));
  const modelFaultData = faultStats.byModel.slice(0, 10).map(([name, v]) => ({ name, "الأعطال": v }));

  const unitVehicles = {};
  vehicles.forEach((v) => { const u = unifyUnit(v.unit); unitVehicles[u] = (unitVehicles[u] || 0) + 1; });
  const unitData = Object.entries(unitVehicles).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value], i) => ({ name, value, fill: VIVID[i % VIVID.length] }));

  const kpis = [
    { label: "إجمالي الآليات", value: counts.total, grad: "linear-gradient(135deg,#1F4E8C,#00A8E8)", icon: "🚒" },
    { label: "تعمل", value: counts["تعمل"], grad: "linear-gradient(135deg,#00875A,#00C48C)", icon: "✅" },
    { label: "عطلانة", value: counts["عطلانة"], grad: "linear-gradient(135deg,#C4353C,#FF5D73)", icon: "⚠️" },
    { label: "تم الإصلاح", value: counts["تم الإصلاح"], grad: "linear-gradient(135deg,#1F5A7A,#38BDF8)", icon: "🔧" },
    { label: "بوجود ملاحظات", value: counts["تعمل بوجود ملاحظات"], grad: "linear-gradient(135deg,#B45309,#FFB800)", icon: "📋" },
    { label: "تحت التجهيز والتسليم", value: counts["تحت التجهيز والتسليم"], grad: "linear-gradient(135deg,#0B5A52,#12B8A6)", icon: "📦" },
    { label: "إجراءات الرجيع", value: counts["تحت إجراءات الرجيع"], grad: "linear-gradient(135deg,#4E3D80,#7C5CFF)", icon: "↩️" },
    { label: "صدر قرار الرجيع", value: counts["صدر قرار الرجيع"], grad: "linear-gradient(135deg,#475569,#94A3B8)", icon: "🗄️" },
  ];

  return (
    <div>
      {/* شريط المؤشرات الملونة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 12, maxWidth: 980, margin: "0 auto 18px", width: "100%" }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: k.grad, borderRadius: 18, padding: "16px 14px", color: "#fff",
            boxShadow: "0 8px 20px rgba(20,26,40,0.15)", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: -14, top: -14, fontSize: 58, opacity: 0.18 }}>{k.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, opacity: 0.95 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980, margin: "0 auto", width: "100%" }}>
        {/* الحالة الفنية - دونات */}
        <ChartCard title="توزيع الحالة الفنية" icon="🎯" grad="linear-gradient(120deg,#9E1B22,#FF5D73)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} cornerRadius={6}>
                {statusData.map((d) => <Cell key={d.name} fill={STATUS_VIVID[d.name] || "#94A3B8"} />)}
              </Pie>
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "'Tajawal',sans-serif", fontSize: 12, fontWeight: 700 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <DowntimeCard vehicles={vehicles} />

        {/* عداد الجاهزية */}
        <ChartCard title="نسبة الجاهزية التشغيلية" icon="⚡" grad="linear-gradient(120deg,#00875A,#00C48C)">
          <ResponsiveContainer width="100%" height={320}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: readyPct, fill: "url(#readyGrad)" }]} startAngle={225} endAngle={-45}>
              <defs>
                <linearGradient id="readyGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00C48C" /><stop offset="100%" stopColor="#00A8E8" />
                </linearGradient>
              </defs>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={14} background={{ fill: "#E7E9EE" }} />
              <text x="50%" y="47%" textAnchor="middle" style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 44, fontWeight: 800, fill: "#00875A" }}>{readyPct}%</text>
              <text x="50%" y="60%" textAnchor="middle" style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 700, fill: "#5A6172" }}>تعمل + تم الإصلاح + بملاحظات</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* أنواع الأعطال - فطيرة */}
        <ChartCard title="توزيع الأعطال حسب النوع" icon="🔩" grad="linear-gradient(120deg,#B45309,#FFB800)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={ftypeData} dataKey="value" nameKey="name" outerRadius={95} cornerRadius={4} paddingAngle={2} label={{ fontFamily: "'Tajawal',sans-serif", fontSize: 11, fontWeight: 700 }} />
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "'Tajawal',sans-serif", fontSize: 11.5, fontWeight: 700 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* الأعطال عبر الأشهر الهجرية */}
        <ChartCard title="الأعطال عبر الأشهر الهجرية" icon="🌙" grad="linear-gradient(120deg,#4E3D80,#7C5CFF)" span>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.85} /><stop offset="100%" stopColor="#7C5CFF" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" />
              <XAxis dataKey="name" tick={tick} interval={0} angle={-25} height={58} textAnchor="end" />
              <YAxis tick={tick} allowDecimals={false} orientation="right" />
              <Tooltip {...ttStyle} />
              <Area type="monotone" dataKey="عدد الأعطال" stroke="#7C5CFF" strokeWidth={3} fill="url(#mGrad)" dot={{ r: 4, fill: "#7C5CFF" }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* أكثر الجهات آليات عطلانة حالياً */}
        <ChartCard title="أكثر الجهات آليات عطلانة (حالياً)" icon="🏢" grad="linear-gradient(120deg,#C4353C,#FF7A00)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={unitFaultData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E5E9" horizontal={false} />
              <XAxis type="number" tick={tick} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={tick} width={118} />
              <Tooltip {...ttStyle} />
              <Bar dataKey="عطلانة حالياً" radius={[0, 8, 8, 0]}>
                {unitFaultData.map((_, i) => <Cell key={i} fill={VIVID[i % VIVID.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* الأكثر أعطالاً خلال 12 شهراً */}
        <ChartCard title="الأكثر أعطالاً خلال الـ12 شهراً الماضية" icon="📅" grad="linear-gradient(120deg,#7A3E9D,#C13584)">
          {unit12mData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", fontSize: 13, fontWeight: 700, color: "#5A6172" }}>
              لا أعطال مؤرخة ضمن الاثني عشر شهراً الماضية
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={unit12mData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5E9" horizontal={false} />
                <XAxis type="number" tick={tick} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={tick} width={118} />
                <Tooltip {...ttStyle} />
                <Bar dataKey="أعطال 12 شهراً" radius={[0, 8, 8, 0]}>
                  {unit12mData.map((_, i) => <Cell key={i} fill={VIVID[(i + 3) % VIVID.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* أكثر أنواع الآليات أعطالاً */}
        <ChartCard title="أكثر أنواع الآليات أعطالاً" icon="🚛" grad="linear-gradient(120deg,#1F4E8C,#00A8E8)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={typeFaultData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" horizontal={false} />
              <XAxis type="number" tick={tick} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ ...tick, fontSize: 10.5 }} width={150} orientation="right" />
              <Tooltip {...ttStyle} />
              <Bar dataKey="الأعطال" radius={[8, 0, 0, 8]} barSize={18}>
                {typeFaultData.map((_, i) => <Cell key={i} fill={VIVID[(i + 3) % VIVID.length]} />)}
                <LabelList dataKey="الأعطال" position="left" style={{ ...tick, fill: "#141A28" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* الموديلات الأكثر تعطلاً */}
        <ChartCard title="الموديلات الأكثر تعطلاً" icon="📅" grad="linear-gradient(120deg,#0B5A52,#12B8A6)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={modelFaultData} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" vertical={false} />
              <XAxis dataKey="name" tick={tick} interval={0} />
              <YAxis tick={tick} allowDecimals={false} orientation="right" />
              <Tooltip {...ttStyle} />
              <Bar dataKey="الأعطال" radius={[8, 8, 0, 0]} barSize={26}>
                {modelFaultData.map((_, i) => <Cell key={i} fill={VIVID[(i + 5) % VIVID.length]} />)}
                <LabelList dataKey="الأعطال" position="top" style={{ ...tick, fill: "#141A28" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* توزيع الآليات حسب الجهات */}
        <ChartCard title="توزيع الآليات حسب الجهات (الأعلى عدداً)" icon="🗂️" grad="linear-gradient(120deg,#E8336D,#FF5D73)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={unitData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={92} paddingAngle={2} cornerRadius={5} />
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "'Tajawal',sans-serif", fontSize: 10.5, fontWeight: 700 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ====== قسم الجاهزية الميدانية — يتغذى من صفحة الجاهزية مباشرة ====== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 980, margin: "28px auto 14px", width: "100%" }}>
        <div style={{ width: 5, height: 26, borderRadius: 4, background: "linear-gradient(180deg,#9E1B22,#E8A33D)" }} />
        <span style={{ fontSize: 16.5, fontWeight: 800, color: "#141A28" }}>الجاهزية الميدانية</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#8B93A3" }}>مباشرةً من تعبئتك في صفحة الجاهزية</span>
      </div>

      {/* عدادات الجاهزية */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, maxWidth: 980, margin: "0 auto 18px", width: "100%" }}>
        {[
          { label: "مراكز مكتملة الجاهزية", value: rdy.g + " / " + rdy.total, grad: "linear-gradient(135deg,#00875A,#00C48C)", icon: "🛡" },
          { label: "نقص متطلبات (صفراء)", value: rdy.y, grad: "linear-gradient(135deg,#B45309,#FFB800)", icon: "⚠" },
          { label: "عجز كامل (حمراء)", value: rdy.r, grad: "linear-gradient(135deg,#9E1B22,#FF5D73)", icon: "🚨" },
          { label: "مؤشر عجز التغطية", value: rdy.totalRisk, grad: "linear-gradient(135deg,#3B2E77,#7C5CFF)", icon: "📉" },
          { label: "أنواع الإسناد الجاهزة", value: rdy.supportReady + " / " + SUPPORT_SLOTS.length, grad: "linear-gradient(135deg,#075985,#00A8E8)", icon: "🚛" },
          { label: "تغطية قص الخواتم · المصاعد", value: rdy.ring + " · " + rdy.elev + " من " + MANUAL_CENTERS.length, grad: "linear-gradient(135deg,#701A43,#E8336D)", icon: "🧰" },
        ].map((k) => (
          <div key={k.label} style={{
            background: k.grad, borderRadius: 18, padding: "16px 14px", color: "#fff",
            boxShadow: "0 8px 20px rgba(20,26,40,0.15)", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", left: -14, top: -14, fontSize: 58, opacity: 0.18 }}>{k.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, opacity: 0.95 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980, margin: "0 auto", width: "100%" }}>
        {/* عداد الجاهزية الدائري */}
        <ChartCard title="الجاهزية الميدانية" icon="🛡" grad="linear-gradient(120deg,#00875A,#00C48C)">
          <ResponsiveContainer width="100%" height={320}>
            <RadialBarChart innerRadius="62%" outerRadius="95%" startAngle={220} endAngle={-40}
              data={[{ name: "الجاهزية", value: rdy.pct, fill: rdy.pct >= 70 ? "#00C48C" : rdy.pct >= 40 ? "#FFB800" : "#FF5D73" }]}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "#E3E5E9" }} />
              <text x="50%" y="47%" textAnchor="middle" style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 34, fontWeight: 800, fill: "#141A28" }}>{rdy.pct}%</text>
              <text x="50%" y="60%" textAnchor="middle" style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 12, fontWeight: 700, fill: "#5A6172" }}>مراكز مكتملة الجاهزية</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* جاهزية الشعب — أعمدة مكدسة */}
        <ChartCard title="خريطة جاهزية الشعب" icon="🗺" grad="linear-gradient(120deg,#1F4E8C,#00A8E8)" span>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rdy.branchRows} margin={{ top: 8, left: 4, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E5E9" vertical={false} />
              <XAxis dataKey="name" tick={tick} interval={0} angle={-30} textAnchor="end" height={62} />
              <YAxis tick={tick} allowDecimals={false} />
              <Tooltip {...ttStyle} />
              <Legend wrapperStyle={{ fontFamily: "'Tajawal',sans-serif", fontWeight: 700, fontSize: 12 }} />
              <Bar dataKey="مكتملة" stackId="a" fill="#00C48C" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ناقصة" stackId="a" fill="#FFB800" />
              <Bar dataKey="عجز كامل" stackId="a" fill="#FF5D73" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* أخطر المراكز تغطوياً */}
        <ChartCard title="أعلى 10 مراكز في عجز التغطية" icon="📉" grad="linear-gradient(120deg,#3B2E77,#7C5CFF)" span={rdy.topRisk.length > 5}>
          {rdy.topRisk.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", fontSize: 13, fontWeight: 700, color: "#5A6172" }}>
              لا عجز في التغطية حالياً — إما التغطية مكتملة أو لم تُغذَّ بيانات الأهمية بعد في تبويب التغطية الميدانية
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rdy.topRisk} layout="vertical" margin={{ right: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5E9" horizontal={false} />
                <XAxis type="number" tick={tick} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={tick} width={125} />
                <Tooltip {...ttStyle} />
                <Bar dataKey="عجز التغطية" radius={[0, 8, 8, 0]}>
                  {rdy.topRisk.map((e, i) => (
                    <Cell key={i} fill={e["عجز التغطية"] >= 45 ? "#FF5D73" : e["عجز التغطية"] >= 20 ? "#FFB800" : "#00C48C"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* جاهزية الإسناد — دونات */}
        <ChartCard title="جاهزية قسم الدعم والإسناد" icon="🚛" grad="linear-gradient(120deg,#075985,#00A8E8)">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={rdy.support.filter((x) => x.value > 0)} dataKey="value" nameKey="name"
                innerRadius={58} outerRadius={88} paddingAngle={3}
                label={({ name, value }) => name + " " + value} labelLine={false}
                style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 11.5, fontWeight: 800 }}>
                {rdy.support.filter((x) => x.value > 0).map((e, i) => (
                  <Cell key={i} fill={e.name === "جاهزة" ? "#00C48C" : e.name === "الحد الأدنى" ? "#FFB800" : "#FF5D73"} />
                ))}
              </Pie>
              <Tooltip {...ttStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ====== فلتر متعدد الاختيارات ======
// يتيح تحديد أكثر من قيمة معاً (موديلات، شعب، أنواع...)؛ التحديد الفارغ يعني "الكل"
function MultiSelect({ label, options, values, onChange, flex }) {
  const [open, setOpen] = useState(false);
  const [q2, setQ2] = useState("");
  const shown = options.filter((o) => !q2 || String(o).includes(q2));
  const toggle = (o) => (values.includes(o) ? onChange(values.filter((x) => x !== o)) : onChange([...values, o]));
  const summary = values.length === 0 ? "الكل" : values.length === 1 ? values[0] : values.length + " محدد";
  return (
    <div style={{ position: "relative", flex: flex || "1 1 150px", minWidth: 0 }}>
      <button onClick={() => setOpen(!open)} style={{
        ...inputStyle, cursor: "pointer", display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 6, textAlign: "right",
        borderColor: values.length ? "#9E1B22" : "#C9CDD6",
        background: values.length ? "#FDF6F6" : "#fff",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
          {label}: <span style={{ color: values.length ? "#9E1B22" : "#1B2130" }}>{summary}</span>
        </span>
        <span style={{ fontSize: 9, color: "#8B93A3" }}>▼</span>
      </button>
      {open && (
        <>
          <div onClick={() => { setOpen(false); setQ2(""); }} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: "100%", width: "max-content",
            maxWidth: "min(320px, calc(100vw - 28px))", background: "#F4F5F7", border: "1.5px solid #C9CDD6", borderRadius: 12,
            maxHeight: 300, overflowY: "auto", zIndex: 60, boxShadow: "0 12px 28px rgba(20,26,40,0.14)",
          }}>
            <div style={{ position: "sticky", top: 0, background: "#F4F5F7", padding: "8px 10px", borderBottom: "1px solid #E6E8EC", zIndex: 1 }}>
              {options.length > 8 && (
                <input value={q2} onChange={(e) => setQ2(e.target.value)} placeholder="🔍 بحث في القائمة..."
                  style={{ ...inputStyle, padding: "7px 10px", fontSize: 12.5, marginBottom: 7 }} />
              )}
              <div onClick={() => onChange([])} style={{ fontSize: 12.5, fontWeight: 800, color: "#9E1B22", cursor: "pointer" }}>
                ✕ مسح التحديد (عرض الكل)
              </div>
            </div>
            {shown.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "#8B93A3" }}>لا توجد نتائج</div>
            ) : shown.map((o) => (
              <label key={o} style={{
                display: "flex", gap: 9, alignItems: "center", padding: "8px 12px", fontSize: 13,
                fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #ECEEF1",
                background: values.includes(o) ? "#FDF6F6" : "#fff",
              }}>
                <input type="checkbox" checked={values.includes(o)} onChange={() => toggle(o)}
                  style={{ accentColor: "#9E1B22", width: 15, height: 15, flexShrink: 0 }} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ====== منتقي نوع الآلية بقائمة قابلة للتمرير ======
function TypeSearchPicker({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value === "الكل" ? "" : value);
  useEffect(() => { setText(value === "الكل" ? "" : value); }, [value]);
  const filtered = options.filter((o) => !text || o.includes(text));
  return (
    <div style={{ position: "relative", flex: "1 1 190px" }}>
      <input style={inputStyle} placeholder="🔍 البحث بنوع الآلية..." value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() === "" ? "الكل" : e.target.value);
          setOpen(true);
        }} />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, background: "#F4F5F7",
          border: "1.5px solid #C9CDD6", borderRadius: 12, maxHeight: 280, overflowY: "auto",
          zIndex: 60, boxShadow: "0 12px 28px rgba(20,26,40,0.14)",
        }}>
          <div onMouseDown={() => { onChange("الكل"); setText(""); setOpen(false); }}
            style={{ padding: "9px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#9E1B22", borderBottom: "1px solid #E6E8EC", position: "sticky", top: 0, background: "#F4F5F7" }}>
            ✕ عرض الكل (إلغاء الترشيح)
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "#8B93A3" }}>لا يوجد نوع مطابق</div>
          ) : filtered.map((o) => (
            <div key={o}
              onMouseDown={() => { onChange(o); setText(o); setOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EEF0F3")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#F4F5F7")}
              style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #ECEEF1" }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== التصنيفات الخاصة: مجموعات آليات تُضم معاً بحسب النوع أو أرقام لوحات محددة ======
function normPlate(p) {
  return (p || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, "");
}
const CUSTOM_GROUPS = [
  {
    name: "وايتات البروبلين",
    // 83 وايت سكس مرسيدس بمضخة وقاذف محددة بأرقام لوحاتها
    plates: ["اكي1592", "اكي1593", "اكي1595", "اكي1598", "اكي8250", "اكي8251", "اكي8255", "اكي8454", "الط1977", "الط1995", "امب1241", "امب1858", "امب1859", "امب1872", "امب5814", "امط4146", "امط4147", "امك4421", "انب3885", "انب3894", "انب3896", "انب3911", "انط2479", "انط2482", "انط2483", "انط2496", "انط2497", "انط2502", "انط2503", "انط2504", "انع7207", "انع8479", "انع8482", "انع8503", "اهس2260", "اهس6583", "اهس8336", "اهس8359", "اهس8367", "اهس8369", "اهس8371", "اهم1420", "اهم1425", "اوس7019", "اوس7036", "اوس7038", "اوس7042", "اوع4791", "اوم2858", "اوم2866", "اوم2872", "اوم2878", "اوم4089", "اوم7670", "اوم7674", "اين2709", "اين2713", "اين2715", "اين2716", "اين6642", "اين6670", "اين6676", "باد8319", "باد8343", "باد8349", "باد8359", "باد8362", "باق1436", "باق1438", "باق1443", "باق5850", "باق5860", "ببا2185", "ببا2192", "ببا5669", "بحح6276", "بحق7138", "بحق7141", "بحل3070", "بحل3085", "بحل3087", "بحل3138", "بحل3161"],
  },
  {
    name: "المزدوجات",
    // 63 سيارة إطفاء وإنقاذ مزدوجة (60 روزنباور + 3 مرسيدس) محددة بأرقام لوحاتها
    plates: ["اعك7441", "اعك7448", "اعك7450", "اعك7553", "اعك7576", "امب9496", "امط4949", "انب3281", "انب3286", "انط2401", "انط2403", "انط2404", "انط2406", "انع8552", "انل1469", "انل1471", "انل4619", "انل4628", "انل4630", "انو5242", "انو5250", "اهد1272", "اهد1273", "اهد1274", "اهس2217", "اهس2233", "اهس2235", "اوس7235", "اوس7237", "اوس7247", "اوس7259", "اوس7260", "اوس7261", "اوس7262", "اوس7263", "اوس7266", "اوع4404", "اوم2884", "اوم2889", "اوم2890", "اوم7633", "اوم7634", "اوم7638", "اين2762", "اين2788", "اين2795", "اين6494", "اين6503", "اين6521", "باد8239", "باد8241", "باد8252", "باد8272", "باق5756", "باق5871", "ببا5040", "ببا5913", "ببا5992", "ببا5997", "ببق2256", "بدب8021", "سلي226", "سيط435"],
  },
  {
    name: "بيان 186 آلية",
    // بيان مختار من 186 آلية متعددة الأنواع محددة بأرقام لوحاتها (تتداخل مع تصنيفات أخرى)
    plates: ["اار4625", "ابم7397", "احع3196", "احع3209", "احك4833", "احن5467", "احن6662", "ادع2018", "ادم2203", "ادم2206", "ادم2212", "ادم2214", "ادم2814", "ادم2832", "ادم3118", "ادم4903", "ادم4909", "ادم4920", "ادن5361", "ادن8075", "ارا7095", "ارا7181", "ارا7722", "ارح8875", "ارر6372", "ارر6375", "ارر9193", "ارل1009", "ارل1036", "ارل1571", "ارل1574", "ارل1580", "ارل1804", "ارل1863", "اسق2410", "اصط4840", "اصم3047", "اصم3133", "اصم3207", "اصم3347", "اصم3537", "اصم3546", "اصم3618", "اصم3834", "اصم3838", "اصم3845", "اصم3859", "اصم3875", "اصم3910", "اصم3916", "اصم3932", "اصم3941", "اصم3992", "اطا3095", "اعا9361", "اعا9362", "اعا9365", "اعك7441", "اعك7448", "اعك7450", "اعك7553", "اعك7732", "اعك7739", "اقس6823", "اقي2545", "اقي7533", "اقي7557", "اقي7558", "اكب4812", "اكي1592", "اكي1595", "اكي8250", "اكي8251", "الط1017", "الط1977", "الط6396", "الع1091", "امب1858", "امط4142", "امط4146", "امط4147", "امط6540", "امط6562", "امط6567", "امك4421", "امن8199", "امن8209", "انب3281", "انب3286", "انب3894", "اند2205", "اند4774", "انط2406", "انط2419", "انط2420", "انط2479", "انط2496", "انط2497", "انط2502", "انط2504", "انع7207", "انع8479", "انل1469", "انل1471", "انل6414", "انل6428", "انل6561", "انل6579", "انل6589", "انو1933", "انو5242", "اهب4029", "اهب4251", "اهد1272", "اهد6188", "اهس2818", "اهس8336", "اهس8359", "اهس8367", "اهس8369", "اهم1425", "اهو7367", "اوس7036", "اوس7038", "اوس7235", "اوس7237", "اوس7247", "اوس7266", "اوع4404", "اوع4791", "اوم2858", "اوم2866", "اوم2878", "اوم2884", "اوم7634", "اون9695", "اين3852", "اين6494", "اين6503", "اين6521", "باد8239", "باد8241", "باد8343", "باد8450", "باق1510", "باق1832", "باق1842", "باق2303", "باق5756", "باق5918", "بحق7103", "بحق7112", "بحي8041", "بدب8021", "بدق3669", "برق2013", "برق2588", "بصا2622", "بلص9475", "بلع5075", "حمح4243", "حمح4415", "حنب9074", "حنب9077", "دنل713", "رصس200", "رصس723", "سبي705", "سحط156", "سقه393", "صسع452", "صلا596", "صلع255", "صيع924", "عصو884", "قصن865", "كبص194", "مني182", "نيم736", "هاب635", "هاب647", "هود189", "يال48", "يال930", "يطل622", "يمل624"],
  },
  {
    name: "الانقاذات",
    // 98 آلية إنقاذ: انقاذ صغيرة فورد، انقاذ كبيرة فورد وجمس، والمزدوجات روزنباور ومرسيدس
    plates: ["ابم7388", "ابم7397", "ابم7402", "ابم7403", "احع3182", "احع3196", "احع3209", "احع3212", "احع3224", "اصم3631", "اصم3845", "اعك7441", "اعك7448", "اعك7450", "اعك7553", "اعك7576", "اعك7732", "اعك7739", "امب9496", "امط4949", "امن8199", "امن8209", "انب3281", "انب3286", "انط2401", "انط2403", "انط2404", "انط2406", "انط2412", "انط2415", "انط2419", "انط2420", "انع8552", "انل1469", "انل1471", "انل4619", "انل4628", "انل4630", "انو5242", "انو5250", "اهد1272", "اهد1273", "اهد1274", "اهس2217", "اهس2233", "اهس2235", "اوس7235", "اوس7237", "اوس7247", "اوس7259", "اوس7260", "اوس7261", "اوس7262", "اوس7263", "اوس7266", "اوع4404", "اوم2884", "اوم2889", "اوم2890", "اوم7633", "اوم7634", "اوم7638", "اين2762", "اين2788", "اين2795", "اين6494", "اين6503", "اين6521", "باد8239", "باد8241", "باد8252", "باد8272", "باد8440", "باد8450", "باد8783", "باق1510", "باق5756", "باق5871", "باق5918", "ببا2174", "ببا2217", "ببا5040", "ببا5913", "ببا5992", "ببا5997", "ببق2256", "بحي8041", "بحي8048", "بدب8021", "دسا420", "سسق249", "سسق642", "سلي226", "سيط435", "صرك285", "صلع255", "صلع404", "صوع284"],
  },
  {
    name: "الآليات النوعية",
    // 34 آلية نوعية: رافعات، سلالم (28-56م)، سنوركل، حرائق صناعية، مواد خطرة، زلازل، تطهير، أوناش، مباني عالية
    plates: ["اار4625", "ارر9193", "اصم3047", "اصم3546", "اصم3985", "اصم3992", "اعك7362", "اقس6823", "اقي2545", "اقي2546", "اقي7557", "اقي7558", "اكع1641", "اكي8267", "الط1122", "امن7531", "امن7536", "اهو7367", "اوم4965", "باد4513", "باد8473", "باد8505", "باق1802", "بحق7103", "بحق7105", "بحق7112", "بحق7117", "بحن213", "بسع2827", "بصا2622", "بمم335", "حاب750", "سبي705", "صهط219"],
  },
  {
    name: "السلالم",
    // 15 آلية: سلالم 28 و28 (بيرس) و32 و52 و56 متر + سيارتا السنوركل
    plates: ["اار4625", "ارر9193", "اصم3047", "اصم3546", "اكع1641", "اكي8267", "امن7531", "امن7536", "باد8473", "باد8505", "باق1802", "بحن213", "بمم335", "حاب750", "صهط219"],
  },
  {
    name: "الآليات الثقيلة",
    // 7 آليات ثقيلة: تيدر محروقات، جرافة تركتر، بوكلين، حواس، رافعة 160 طن، رافعة 50 طن، رافعة شوكية
    plates: ["ااك5156", "ابح6452", "اسق2410", "اقي7557", "اقي7558", "اقي7559", "اكل2362"],
  },
  {
    name: "الدراجات النارية",
    // 37 دراجة بلوحاتها + 4 دراجات بدون لوحة تُلتقط بنوعها (4*4 للبحث والانقاذ، و4 كفرات بجهاز رغوة)
    plates: ["حح654", "حح692", "حح919", "حح933", "صا133", "صا156", "صا159", "صا175", "صا178", "صا179", "صا194", "صا238", "صا263", "صا286", "صا451", "صا605", "صا647", "صا661", "قب3657", "قب3658", "قب579", "قب605", "قب613", "قب615", "قب628", "قب639", "قب657", "قب670", "قب675", "قب678", "قب688", "لا3585", "لا3586", "هب723", "هب769", "هح564", "هح565"],
    test: ["دراجة نارية (4*4) للبحث والانقاذ", "ذات 4 كفرات مزودة بجهاز اطفاء بالرغوة"],
  },
  {
    name: "عربات الحرائق الصناعية",
    // 3 آليات: سيارتا إطفاء حرائق صناعية روزنباور + عربة الحرائق الصناعية بالبرج التلسكوبي
    plates: ["اقي2545", "اقي2546", "بصا2622"],
  },
  {
    name: "المركبات الإدارية",
    // 113 مركبة إدارية: جيبات تويوتا ونيسان (2 و4 أبواب) وسيارتا صالون شفروليه رسمية
    plates: ["اار7549", "اار7610", "اطع6677", "اعا9360", "اعا9361", "اعا9362", "اعا9363", "اعا9365", "اكح9352", "الح9004", "الح9008", "الح9797", "الع1060", "الع1091", "امط6540", "امط6561", "امط6562", "امط6567", "انل6409", "انل6413", "انل6414", "انل6428", "انل6440", "انل6442", "انل6448", "انل6561", "انل6579", "انل6589", "اهس2816", "اهس2818", "اون9695", "برح4842", "برح4843", "برق2013", "برق2086", "برق2588", "برك1089", "برك1092", "برك1095", "بعص2226", "بقل5954", "بقل6487", "بقم3231", "بقم3255", "بقم3263", "بقم3283", "بقم3402", "بقم3406", "بقم3410", "بقم3412", "بقم3822", "بقم7027", "بقم7190", "بلط3883", "بلط3933", "بلع5074", "بلع5075", "بلع5287", "بلع5289", "حاص1801", "حاص1839", "حاص1845", "حاص1931", "حاص1955", "حاص1965", "حاص6676", "حاص6683", "حاص8038", "حاص8140", "حاص8260", "حاص8294", "حاص8337", "حبك3857", "حبك3869", "حبك3872", "حبك3873", "حعب5575", "حعب5678", "حير4923", "دقه2619", "دقه2621", "دقه2645", "دقه2647", "دكن1870", "دكن1871", "دكن1877", "دكن1882", "عصو884", "قصن865", "قصن956", "قكك493", "قهه205", "كبص194", "لمل265", "مني182", "مني672", "مني683", "مني827", "نيم701", "نيم736", "هاب629", "هاب635", "هاب647", "هود189", "يال472", "يال48", "يال698", "يال917", "يال930", "يطل276", "يطل447", "يطل622", "يمل624"],
  },
  {
    name: "الديهاتسو المسحوب من ملاك جدة",
    // 45 سيارة جيب 4 باب ديهاتسو رسمي مسحوبة من ملاك جدة
    plates: ["حله6927", "حله6934", "حله6941", "حله6965", "حله6972", "حمح4081", "حمح4084", "حمح4096", "حمح4103", "حمح4124", "حمح4137", "حمح4148", "حمح4163", "حمح4167", "حمح4169", "حمح4170", "حمح4176", "حمح4184", "حمح4189", "حمح4192", "حمح4215", "حمح4229", "حمح4236", "حمح4243", "حمح4264", "حمح4265", "حمح4274", "حمح4282", "حمح4305", "حمح4314", "حمح4315", "حمح4317", "حمح4320", "حمح4330", "حمح4412", "حمح4428", "حمح4468", "حمح4497", "حمح4498", "حنب9052", "حنب9064", "حنب9068", "حنب9074", "حنب9077", "حنب9080"],
  },
];
function matchGroup(v, group) {
  if (group.plates && group.plates.includes(normPlate(v.plate))) return true;
  if (group.test) {
    const s = normU(v.type);
    return group.test.some((t) => s.includes(normU(t)));
  }
  return false;
}

// ====== صفحة التقارير ======
// ====== تقرير الجاهزية الميدانية — تصميم مباشر: صف واحد جامع لكل مركز ======
function ReadinessReport({ centerReadiness, equip, supportCounts, prio, prioWeights }) {
  const data = useMemo(() => {
    const cr = centerReadiness || {}, eq = equip || {};
    const compass = buildCompass(cr, prio || {}, prioWeights || { inc: 50, den: 25, fac: 25 });
    const cmap = {};
    compass.forEach((x) => { cmap[x.name] = x; });
    // صف واحد لكل مركز يجمع كل تكاميله
    const rows = [];
    let g = 0, y = 0, r = 0;
    MANUAL_CENTERS.forEach(({ branch, centers }) => {
      const tmp = centers.map((c) => {
        const s = cr[c] || {};
        const st = fullCenterStatus(c, s, eq);
        const whitCount = FIRE_SLOTS.filter(([k]) => s[k]).length;
        const rescueFull = ["res_fordS", "res_fordB", "res_rosen", "res_merc"].some((k) => s[k]);
        const rescueSub = ["res_jeep", "res_rosenL", "res_fastJeep"].some((k) => s[k]);
        let miss = st.level === "green" ? "—"
          : st.label.replace("⚠ ناقص: ", "").replace("⚠ ", "")
              .replace("انقاذ مخصص (فورد أو مزدوجة) — المتوفر بديل مؤقت", "انقاذ (المتوفر بديل)");
        if (st.level === "green") g++; else if (st.level === "yellow") y++; else r++;
        return {
          name: c.replace(/^مركز /, ""), branch: branch.replace(/^شعبة /, ""),
          level: st.level, whitCount, rescueFull, rescueSub, miss,
          ring: !!(eq.ringCutter || {})[c], elev: !!(eq.elevatorKey || {})[c], elevE: !!(eq.elevatorKeyE || {})[c],
          risk: cmap[c] ? cmap[c].risk : 0,
        };
      });
      // لون الشعبة: أحمر إن فيها عجز كامل، أصفر إن فيها جزئي فقط، أخضر إن اكتملت كلها
      const bLevel = tmp.some((x) => x.level === "red") ? "red" : tmp.some((x) => x.level === "yellow") ? "yellow" : "green";
      tmp.forEach((x, ci) => rows.push({ ...x, bFirst: ci === 0, bSize: centers.length, bLevel }));
    });
    const total = rows.length;
    const sc = supportCounts || {};
    const support = SUPPORT_SLOTS.map(([k, label, multi, gdr]) => {
      const c = sc[k] || 0;
      const lv = supportLevel(c, multi);
      return { label, c, lv, txt: lv === "red" ? (multi ? "جميعها متعطلة" : gdr === "f" ? "متعطلة" : "متعطل") : lv === "yellow" ? "الحد الأدنى" : (multi || gdr === "f" ? "جاهزة" : "جاهز") };
    });
    const sReady = support.filter((s) => s.lv === "green").length;
    const totalDeficit = compass.reduce((a, x) => a + x.risk, 0);
    const recs = buildRecommendations(compass);
    const ring = MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => (eq.ringCutter || {})[c])).length;
    const elev = MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => (eq.elevatorKey || {})[c])).length;
    const elevE = MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => (eq.elevatorKeyE || {})[c])).length;
    return { rows, total, g, y, r, support, sReady, totalDeficit, recs, ring, elev, elevE };
  }, [centerReadiness, equip, supportCounts, prio, prioWeights]);

  const pct = data.total ? Math.round((data.g / data.total) * 100) : 0;
  const th = { border: "1px solid #9AA0AC", padding: "3px 5px", background: "#E9EBEF", fontSize: 10, fontWeight: 800, textAlign: "center", whiteSpace: "nowrap" };
  const td = { border: "1px solid #B9BEC9", padding: "2.5px 5px", fontSize: 10, fontWeight: 700, textAlign: "center" };
  const tdR = { ...td, textAlign: "right" };
  const lvClr = { green: "#1E6B44", yellow: "#C77F1A", red: "#8F1C22" };
  const lvTxt = { green: "جاهزية كاملة", yellow: "عجز جزئي", red: "عجز كامل" };
  const H2 = ({ t }) => (
    <div style={{ fontSize: 13, fontWeight: 800, margin: "14px 0 6px", color: "#141A28", borderRight: "4px solid #9E1B22", paddingRight: 8 }}>{t}</div>
  );
  const Kpi = ({ l, v, c }) => (
    <div style={{ border: "1px solid #B9BEC9", borderRadius: 6, padding: "4px 10px", textAlign: "center", minWidth: 74 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: c || "#141A28", lineHeight: 1.3 }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#5A6172" }}>{l}</div>
    </div>
  );

  return (
    <div style={{ fontSize: 11, lineHeight: 1.7 }}>
      <H2 t="أولاً. ملخص الأرقام" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Kpi l="نسبة الجاهزية" v={pct + "%"} c="#1E6B44" />
        <Kpi l="جاهزية كاملة" v={data.g + " / " + data.total} c="#1E6B44" />
        <Kpi l="عجز جزئي" v={data.y} c="#C77F1A" />
        <Kpi l="عجز كامل" v={data.r} c="#8F1C22" />
        <Kpi l="مؤشر عجز التغطية" v={data.totalDeficit} c="#8F1C22" />
        <Kpi l="إسناد جاهز" v={data.sReady + " / " + SUPPORT_SLOTS.length} c="#1F4E8C" />
        <Kpi l="شعب بقص الخواتم" v={data.ring + " / " + MANUAL_CENTERS.length} c="#1F4E8C" />
        <Kpi l="شعب بالمفتاح العادي" v={data.elev + " / " + MANUAL_CENTERS.length} c="#1F4E8C" />
        <Kpi l="شعب بالمفتاح الإلكتروني" v={data.elevE + " / " + MANUAL_CENTERS.length} c="#1F4E8C" />
      </div>

      <H2 t={"ثانياً. موقف جاهزية المراكز — صف واحد لكل مركز (" + data.total + " مركزاً)"} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>م</th><th style={th}>الشعبة</th><th style={th}>المركز</th><th style={th}>الحالة</th>
          <th style={th}>وايت</th><th style={th}>انقاذ</th><th style={th}>قص الخواتم</th><th style={th}>مصاعد عادي</th><th style={th}>مصاعد إلكتروني</th><th style={{ ...th, whiteSpace: "normal" }}>النواقص</th><th style={th}>العجز</th>
        </tr></thead>
        <tbody>
          {data.rows.map((x, i) => (
            <tr key={i} style={{ background: x.level === "red" ? "#F6E7E8" : x.level === "yellow" ? "#F8F1E2" : "#EAF4EE" }}>
              <td style={td}>{i + 1}</td>
              {x.bFirst && (
                <td rowSpan={x.bSize} style={{ ...td, fontWeight: 800, verticalAlign: "middle",
                  maxWidth: 56, whiteSpace: "normal", padding: "2px 4px", fontSize: 9.5, lineHeight: 1.45,
                  background: x.bLevel === "red" ? "#F2D7D9" : x.bLevel === "yellow" ? "#F5E7C8" : "#DCEDE2",
                  color: lvClr[x.bLevel] }}>{x.branch}</td>
              )}
              <td style={{ ...tdR, whiteSpace: "nowrap" }}>{x.name}</td>
              <td style={{ ...td, color: lvClr[x.level], fontWeight: 800, whiteSpace: "nowrap" }}>{lvTxt[x.level]}</td>
              <td style={{ ...td, color: x.whitCount > 0 ? "#1E6B44" : "#8F1C22", fontWeight: 800 }}>{x.whitCount > 0 ? x.whitCount : "✗"}</td>
              <td style={{ ...td, color: x.rescueFull ? "#1E6B44" : x.rescueSub ? "#C77F1A" : "#8F1C22", fontWeight: 800, whiteSpace: "nowrap" }}>
                {x.rescueFull ? "✓" : x.rescueSub ? "بديل" : "✗"}</td>
              <td style={{ ...td, color: x.ring ? "#1E6B44" : "#8B93A3", fontWeight: 800 }}>{x.ring ? "✓" : "—"}</td>
              <td style={{ ...td, color: x.elev ? "#1E6B44" : "#8B93A3", fontWeight: 800 }}>{x.elev ? "✓" : "—"}</td>
              <td style={{ ...td, color: x.elevE ? "#1E6B44" : "#8B93A3", fontWeight: 800 }}>{x.elevE ? "✓" : "—"}</td>
              <td style={{ ...tdR, color: x.level === "green" ? "#8B93A3" : "#3A4152" }}>{x.miss}</td>
              <td style={{ ...td, fontWeight: 800, color: x.risk > 0 ? "#8F1C22" : "#8B93A3" }}>{x.risk > 0 ? x.risk : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H2 t="ثالثاً. جاهزية قسم الدعم والإسناد" />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>النوع</th><th style={th}>الجاهز</th><th style={th}>الحالة</th>
          <th style={th}>النوع</th><th style={th}>الجاهز</th><th style={th}>الحالة</th></tr></thead>
        <tbody>
          {Array.from({ length: Math.ceil(data.support.length / 2) }, (_, i) => {
            const a = data.support[i * 2], b = data.support[i * 2 + 1];
            return (
              <tr key={i}>
                <td style={tdR}>{a.label}</td><td style={td}>{a.c}</td>
                <td style={{ ...td, color: lvClr[a.lv], fontWeight: 800 }}>{a.txt}</td>
                {b ? (<><td style={tdR}>{b.label}</td><td style={td}>{b.c}</td>
                  <td style={{ ...td, color: lvClr[b.lv], fontWeight: 800 }}>{b.txt}</td></>) : (<><td style={td} /><td style={td} /><td style={td} /></>)}
              </tr>
            );
          })}
        </tbody>
      </table>

    </div>
  );
}

function ReportsPage({ vehicles, logo, centerReadiness, equip, supportCounts, prio, prioWeights, initialMode, ro, isOwner }) {
  const [rBranch, setRBranch] = useState([]);
  const [rUnit, setRUnit] = useState([]);
  const [rStatus, setRStatus] = useState([]);
  const [rFType, setRFType] = useState([]);
  const [rVType, setRVType] = useState([]);
  const [rModel, setRModel] = useState([]);
  const [rGroup, setRGroup] = useState("الكل");
  const [title, setTitle] = useState("تقرير حالة الآليات");
  const [repMode, setRepMode] = useState(initialMode || "vehicles"); // vehicles | readiness

  const branches = useMemo(() => [...new Set(vehicles.map((v) => unifyUnit(v.unit)))].sort((a, b) => a.localeCompare(b, "ar")), [vehicles]);
  const unitsList = useMemo(() => [...new Set(vehicles.map((v) => v.unit).filter(Boolean))].sort(), [vehicles]);
  const typesList = useMemo(() => [...new Set(vehicles.map((v) => v.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [vehicles]);
  const modelsList = useMemo(() => [...new Set(vehicles.map((v) => v.model).filter(Boolean))].sort(), [vehicles]);

  const rows = useMemo(() => {
    const out = [];
    vehicles.forEach((v) => {
      if (rBranch.length && !rBranch.includes(unifyUnit(v.unit))) return;
      if (rUnit.length && !rUnit.includes(v.unit)) return;
      if (rStatus.length) {
        const expanded = rStatus.flatMap((s) => (s === READY_GROUP ? READY_STATUSES : [s]));
        if (!expanded.includes(v.status)) return;
      }
      if (rVType.length && !rVType.includes(v.type)) return;
      if (rModel.length && !rModel.includes(v.model)) return;
      if (rGroup !== "الكل") {
        const g = CUSTOM_GROUPS.find((x) => x.name === rGroup);
        if (!g || !matchGroup(v, g)) return;
      }
      const sorted = [...(v.faults || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const matching = rFType.length === 0 ? sorted : sorted.filter((f) => rFType.includes(f.faultType));
      if (rFType.length && matching.length === 0) return;
      const lf = matching[0];
      out.push({
        v,
        desc: lf ? lf.desc : "—",
        date: lf && lf.date ? hijriDisplay(lf.date) : "—",
        repairDate: lf && lf.repairDate ? hijriDisplay(lf.repairDate) : "—",
      });
    });
    return out;
  }, [vehicles, rBranch, rUnit, rStatus, rFType, rVType, rModel, rGroup]);

  const t = todayHijri();
  const todayTxt = `${t.d} / ${t.m} ${HIJRI_MONTHS[t.m - 1]} ${t.y} هـ`;
  const selStyle = { ...inputStyle, flex: "1 1 150px" };
  const th = { border: "1px solid #333", padding: "7px 8px", background: "#EFEFEF", fontWeight: 800, fontSize: 12.5 };
  const td = { border: "1px solid #555", padding: "6px 8px", fontSize: 12, fontWeight: 600 };

  return (
    <div>
      {/* أدوات الانتقاء - لا تظهر في الطباعة */}
      <div className="no-print" style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {[["vehicles", "تقارير حالة الآليات"], ["readiness", "تقرير الجاهزية الميدانية"], ...((isOwner || ro) ? [["weekly", "📅 تقرير الأعطال الأسبوعي"], ["nawi", "🚒 تكميل الآليات النوعي الأسبوعي"]] : [])].map(([id, lbl]) => (
            <button key={id} onClick={() => setRepMode(id)} style={{
              background: repMode === id ? "#9E1B22" : "#F4F5F7", color: repMode === id ? "#fff" : "#3A4152",
              border: repMode === id ? "none" : "1.5px solid #C9CDD6", borderRadius: 10, padding: "9px 20px",
              fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}>{lbl}</button>
          ))}
        </div>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>
          {repMode === "vehicles" ? "إعداد التقرير — اختر البيانات المطلوبة ثم اطبع" : repMode === "weekly" ? "تقرير الأعطال الأسبوعي (نموذج رقم 2) — حدد الفترة ثم اطبع" : repMode === "nawi" ? "بيان الموقف الأسبوعي للآليات النوعية — حدد الفترة ثم اطبع" : "تقرير الجاهزية الميدانية الشامل — جاهز للطباعة مباشرة من واقع تعبئتك"}
        </h3>
        {repMode === "vehicles" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <input style={{ ...inputStyle, flex: "2 1 220px" }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التقرير" readOnly={ro} />
          <MultiSelect label="الشعبة / الجهة" options={branches} values={rBranch} onChange={setRBranch} />
          <MultiSelect label="المركز التفصيلي" options={unitsList} values={rUnit} onChange={setRUnit} />
          <MultiSelect label="الحالة الفنية" options={[...STATUSES, READY_GROUP]} values={rStatus} onChange={setRStatus} flex="1 1 150px" />
          <MultiSelect label="نوع العطل" options={FAULT_TYPES} values={rFType} onChange={setRFType} flex="1 1 130px" />
          <MultiSelect label="نوع الآلية" options={typesList} values={rVType} onChange={setRVType} flex="1 1 170px" />
          <MultiSelect label="الموديل" options={modelsList} values={rModel} onChange={setRModel} flex="1 1 120px" />
          {CUSTOM_GROUPS.length > 0 && (
            <select style={selStyle} value={rGroup} onChange={(e) => setRGroup(e.target.value)}>
              <option value="الكل">التصنيف الخاص: الكل</option>
              {CUSTOM_GROUPS.map((g) => <option key={g.name}>{g.name}</option>)}
            </select>
          )}
        </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => { if (ro) { alert("🔒 الطباعة غير متاحة بوضع الاستعراض — تسجيل الدخول يتيحها للمحرر والمشرف"); return; } window.print(); }} style={{
            background: "#9E1B22", color: "#fff", border: "none", borderRadius: 10,
            padding: "11px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>📄 حفظ التقرير PDF / طباعة</button>
          {repMode === "vehicles" && <span style={{ fontSize: 13, color: "#5A6172", fontWeight: 700 }}>عدد الآليات في التقرير: {rows.length}</span>}
          <span style={{ fontSize: 12, color: "#8B93A3", fontWeight: 700, flexBasis: "100%" }}>
            💡 عند فتح النافذة اختر الوجهة «حفظ بصيغة PDF» لحفظ الملف على جهازك أو الفلاشة، أو اختر طابعتك للطباعة الورقية مباشرة — والتقرير يخرج مقسماً على صفحات A4 ويتكرر رأس الجدول أعلى كل صفحة.
          </span>
        </div>
      </div>

      {/* منطقة التقرير القابلة للطباعة */}
      <div id="print-area" style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: "26px 30px", position: "relative", overflow: "hidden" }}>
        {repMode === "weekly" && <WeeklyReport vehicles={vehicles} logo={logo} />}
        {repMode === "nawi" && <NawiReport vehicles={vehicles} logo={logo} />}
        {ro && (
          <div className="draft-wm" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} style={{
                position: "absolute", top: i * 170 - 40, right: -120, width: "170%",
                transform: "rotate(-27deg)", fontSize: 32, fontWeight: 800,
                color: "rgba(120, 40, 45, 0.09)", whiteSpace: "nowrap", letterSpacing: 7,
              }}>مسودة غير رسمية &nbsp;&nbsp;&nbsp; مسودة غير رسمية &nbsp;&nbsp;&nbsp; مسودة غير رسمية</div>
            ))}
          </div>
        )}
        {!ro && repMode !== "weekly" && repMode !== "nawi" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "2.5px solid #141A28", paddingBottom: 14, marginBottom: 6 }}>
          <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 800, lineHeight: 1.7 }}>
            المملكة العربية السعودية<br />الإدارة العامة للدفاع المدني بمحافظة جدة<br />إدارة العمليات
          </div>
          <img src={logo || DEFAULT_LOGO} alt="الشعار" style={{ width: 74, height: 74, objectFit: "contain" }} />
          <div style={{ textAlign: "left", fontSize: 12.5, fontWeight: 700, lineHeight: 1.7, color: "#3A4152" }}>
            التاريخ: {todayTxt}<br />{repMode === "vehicles" ? <>عدد الآليات: {rows.length}</> : <>التصنيف: جاهزية ميدانية</>}<br />سجل متابعة الآليات الرقمي
          </div>
        </div>
        )}
        {repMode !== "weekly" && repMode !== "nawi" && <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, margin: "10px 0 6px", textDecoration: "underline" }}>{repMode === "vehicles" ? title : "تقرير الجاهزية الميدانية"}</div>}
        {repMode === "readiness" && (
          <ReadinessReport centerReadiness={centerReadiness} equip={equip}
            supportCounts={supportCounts} prio={prio} prioWeights={prioWeights} />
        )}
        {repMode === "vehicles" && (() => {
          // سطر يوضح المرشحات المطبقة، يتحدث تلقائياً مع كل تغيير بالأعلى
          const parts = [];
          if (rStatus.length) parts.push("الحالة الفنية: " + rStatus.join("، "));
          if (rGroup !== "الكل") parts.push("التصنيف الخاص: " + rGroup);
          if (rBranch.length) parts.push("الشعبة / الجهة: " + rBranch.join("، "));
          if (rUnit.length) parts.push("المركز: " + rUnit.join("، "));
          if (rVType.length) parts.push("نوع الآلية: " + rVType.join("، "));
          if (rModel.length) parts.push("الموديل: " + rModel.join("، "));
          if (rFType.length) parts.push("نوع العطل: " + rFType.join("، "));
          return parts.length ? (
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#3A4152", marginBottom: 14 }}>
              ({parts.join(" — ")})
            </div>
          ) : <div style={{ marginBottom: 12 }} />;
        })()}

        {repMode === "vehicles" && (rows.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8B93A3", padding: 30, fontWeight: 700 }}>لا توجد آليات مطابقة لمعايير الانتقاء الحالية.</div>
        ) : (
          (() => {
            const labels = {
              type: "نوع الآلية", plate: "رقم اللوحة", model: "الموديل", unit: "الجهة",
              status: "الحالة الفنية", faultDesc: "وصف العطل", faultDate: "تاريخ العطل",
              repairDate: "تاريخ الإصلاح", noteDesc: "وصف الملاحظة", noteDate: "تاريخ الملاحظة",
            };
            const cell = (r, c) => {
              if (c === "type") return r.v.type;
              if (c === "plate") return r.v.plate;
              if (c === "model") return r.v.model || "—";
              if (c === "unit") return r.v.unit;
              if (c === "status") return r.v.status;
              if (c === "faultDesc" || c === "noteDesc") return r.desc;
              if (c === "faultDate" || c === "noteDate") return r.date;
              if (c === "repairDate") return r.repairDate;
              return "—";
            };
            const noWrap = ["plate", "faultDate", "noteDate", "repairDate"];
            const sections = [];
            const readySelected = rStatus.includes(READY_GROUP);
            // عند تحديد المجموعة الجاهزة: جدول واحد موحد بأعمدتها الخمسة
            if (readySelected) {
              const gRows = rows.filter((r) => READY_STATUSES.includes(r.v.status));
              if (gRows.length) sections.push({ key: READY_GROUP, title: READY_GROUP, cols: ["type", "plate", "model", "unit", "status"], rows: gRows });
            }
            STATUSES.forEach((st) => {
              if (readySelected && READY_STATUSES.includes(st)) return; // مشمولة في جدول المجموعة
              const stRows = rows.filter((r) => r.v.status === st);
              if (stRows.length === 0) return;
              let cols;
              if (st === "تعمل") cols = ["type", "plate", "unit", "status"];
              else if (st === "تم الإصلاح") cols = ["type", "plate", "model", "unit", "status", "repairDate"];
              else if (st === "تعمل بوجود ملاحظات") cols = ["type", "plate", "unit", "status", "noteDesc", "noteDate"];
              else cols = ["type", "plate", "unit", "status", "faultDesc", "faultDate"];
              sections.push({ key: st, title: st, cols, rows: stRows });
            });
            return sections.map((sec) => (
              <div key={sec.key} style={{ marginBottom: 20 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#141A28", color: "#fff", borderRadius: "8px 8px 0 0",
                  padding: "8px 12px", fontSize: 13.5, fontWeight: 800,
                }}>
                  <span>{sec.key === READY_GROUP ? sec.title : "الحالة الفنية: " + sec.title}</span>
                  <span>عدد الآليات: {sec.rows.length}</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 34 }}>م</th>
                      {sec.cols.map((c) => <th key={c} style={th}>{labels[c]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((r, i) => (
                      <tr key={r.v.id}>
                        <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                        {sec.cols.map((c) => (
                          <td key={c} style={noWrap.includes(c) ? { ...td, whiteSpace: "nowrap" } : (c === "model" ? { ...td, textAlign: "center" } : td)}>
                            {cell(r, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ));
          })()
        ))}

        {!ro && repMode !== "weekly" && repMode !== "nawi" && (
        <div className="sig-block" style={{ marginTop: 40, fontSize: 13.5, fontWeight: 800 }}>
          <div>معد التقرير: نقيب / أكرم بن أحمد الصبحي</div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            التوقيع:
            {typeof SIGNATURE_IMG !== "undefined" && SIGNATURE_IMG
              ? <img src={SIGNATURE_IMG} alt="التوقيع" style={{ height: 38, objectFit: "contain" }} />
              : <span>...............................</span>}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}


// ====== التقرير الأسبوعي — نموذج رقم 2 (خاص بالمشرف) ======
function WeeklyReport({ vehicles, logo }) {
  const t = todayHijri();
  const [fromD, setFromD] = useState("");
  const [toD, setToD] = useState(t.y + "/" + t.m + "/" + t.d);
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState("");
  const [mgrName, setMgrName] = useState("");
  const [mgrRank, setMgrRank] = useState("");

  const parseH = (s) => {
    const m = String(s || "").trim().replace(/[-.]/g, "/").split("/").map((x) => parseInt(x, 10));
    if (m.length !== 3 || m.some(isNaN)) return null;
    // ندعم y/m/d أو d/m/y
    const [a, b, c] = m;
    const y = a > 31 ? a : c, d = a > 31 ? c : a, mo = b;
    return y * 10000 + mo * 100 + d;
  };
  const inPeriod = (ds) => {
    const x = parseH(ds), f = parseH(fromD), e = parseH(toD);
    if (!x || !f || !e) return false;
    return x >= f && x <= e;
  };

  const data = useMemo(() => {
    const rowOf = (v) => {
      const st = (v.status || "").trim();
      if (WEEKLY_STATUS.rejee.includes(st)) return "rejee";
      if (WEEKLY_STATUS.broken.includes(st)) return "broken";
      return "ok";
    };
    const names = WEEKLY_COLS.map((c) => c.name).concat(["اخرى"]);
    const mk = () => Object.fromEntries(names.map((n) => [n, 0]));
    const M = { malak: mk(), rejee: mk(), broken: mk(), ok: mk() };
    const brokenVeh = [], brokenBikes = [];
    let allBrokenDb = 0;
    vehicles.forEach((v) => {
      const col = weeklyColOf(v);
      const row = rowOf(v);
      M[row][col]++;
      M.malak[col]++;
      if (row === "broken") allBrokenDb++;
      const exDai = col === "اخرى" && ((v.type || "").includes("ديهاتسو") || (v.type || "").includes("دايهاتسو"));
      if (row === "broken" && !exDai) {
        (col === "دراجة نارية" ? brokenBikes : brokenVeh).push(v);
      }
    });
    const sum = (o) => names.reduce((a, n) => a + o[n], 0);
    // بيانات التفصيلي: أحدث عطل مفتوح
    const detail = (v) => {
      const fs = (v.faults || []).slice().sort((a, b) => (parseH(b.date) || 0) - (parseH(a.date) || 0));
      const open = fs.find((f) => !f.repairDate) || fs[0] || {};
      const dparts = String(open.date || "").split("/");
      const dTxt = dparts.length === 3 ? dparts[2] + "-" + dparts[1] + "-" + dparts[0] : (open.date || "—");
      return { date: dTxt, desc: open.desc || open.faultType || "—" };
    };
    const orderIdx = (v) => { const c = weeklyColOf(v); const i = names.indexOf(c); return i < 0 ? 99 : i; };
    brokenVeh.sort((a, b) => orderIdx(a) - orderIdx(b));
    // الموقف العام
    const FOURTH = ["الصيانة المركزية", "ورشة خارجية", "ش روزنباور"];
    const isFourth = (v) => FOURTH.includes((v.location || "").trim());
    const allBroken = brokenVeh.length + brokenBikes.length;
    const newInPeriod = vehicles.filter((v) => (v.faults || []).some((f) => inPeriod(f.date))).length;
    const fixedInPeriod = vehicles.filter((v) => (v.faults || []).some((f) => f.repairDate && inPeriod(f.repairDate))).length;
    const fourthN = vehicles.filter((v) => rowOf(v) === "broken" && isFourth(v)).length;
    const notSent = allBroken - fourthN;
    const totalMalak = sum(M.malak), totalRejee = sum(M.rejee);
    const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");
    return {
      names, M, sum, brokenVeh, brokenBikes, detail, allBrokenDb,
      stats: [
        { l: "اجمالي عدد الآليات والمعدات المتعطلة خلال الفترة", n: newInPeriod, p: pct(newInPeriod, allBroken) },
        { l: "اجمالي ما تم اصلاحه من تلك الآليات خلال الفترة", n: fixedInPeriod, p: pct(fixedInPeriod, allBroken) },
        { l: "عدد الآليات التي لا زالت متعطلة", n: allBroken, p: pct(allBroken, totalMalak - totalRejee), sub: "(بعد خصم الرجيع)" },
        { l: "اجمالي المتعطلة على الخط الرابع / إدارة الشؤون الفنية المركزية", n: fourthN, p: pct(fourthN, allBroken) },
        { l: "اجمالي المتعطلة على الخط الرابع لم يتم ارسالها للمركزية", n: notSent, p: pct(notSent, allBroken) },
      ],
    };
  }, [vehicles, fromD, toD]);

  const bd = "1.2px solid #141A28";
  const hcell = { border: bd, padding: "4px 3px", fontSize: 8.5, fontWeight: 800, background: "#DCE3EC", textAlign: "center", verticalAlign: "middle" };
  const cell = { border: bd, padding: "3px 2px", fontSize: 9, fontWeight: 800, textAlign: "center" };
  const dcellH = { border: bd, padding: "3px 3px", fontSize: 8.4, fontWeight: 800, background: "#DCE3EC", textAlign: "center", verticalAlign: "middle", overflow: "hidden" };
  const dcell = { border: bd, padding: "2px 4px", fontSize: 8.2, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" };
  const RowHead = { ...cell, background: "#EDF0F4", fontSize: 7.8, lineHeight: 1.3, whiteSpace: "normal", overflowWrap: "anywhere", padding: "2px 3px" };

  const DetailTable = ({ rows, title }) => (
    <>
      <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 800, margin: "10px 0 6px" }}>({title})</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["م", "نوع الآلية", "رقم اللوحة", "الموديل", "المركز", "تاريخ العطل", "نوع العطل"].map((h) => (
              <th key={h} rowSpan={2} style={dcellH}>{h}</th>
            ))}
            <th colSpan={2} style={dcellH}>إتمام عملية الاصلاح</th>
            {["الإجراءات المتخذة", "توضيح الأسباب في حالة عدم الاصلاح", "موقعها حالياً"].map((h) => (
              <th key={h} rowSpan={2} style={dcellH}>{h}</th>
            ))}
          </tr>
          <tr>
            <th style={{ ...dcellH, width: 26 }}>نعم</th>
            <th style={{ ...dcellH, width: 26 }}>لا</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => {
            const d = data.detail(v);
            return (
              <tr key={v.id || i}>
                <td style={dcell}>{i + 1}</td>
                <td style={{ ...dcell, textAlign: "right" }}>{v.type}</td>
                <td style={{ ...dcell, whiteSpace: "nowrap" }}>{v.plate}</td>
                <td style={dcell}>{v.model || "—"}</td>
                <td style={{ ...dcell, textAlign: "right" }}>{v.unit || "—"}</td>
                <td style={{ ...dcell, whiteSpace: "nowrap" }}>{d.date}</td>
                <td style={{ ...dcell, textAlign: "right" }}>{d.desc}</td>
                <td style={dcell}></td>
                <td style={dcell}>✓</td>
                <td style={dcell}>تم ابلاغ الصيانة</td>
                <td style={dcell}></td>
                <td style={{ ...dcell, textAlign: "right" }}>{v.location || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );

  const SigBlock = () => (
    <table className="sig-block" style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
      <tbody>
        <tr>
          {["معـد البيـان", "مديـر شعبـة الشؤون الفنية", "تصديق مدير الإدارة العامة بمحافظة جدة"].map((h) => (
            <td key={h} style={{ border: bd, padding: "5px", fontSize: 10, fontWeight: 800, background: "#EDF0F4", textAlign: "center" }}>{h}</td>
          ))}
        </tr>
        <tr>
          <td style={{ border: bd, padding: "6px 10px", fontSize: 10, fontWeight: 800 }}>
            الاسم: نقيب / أكرم بن أحمد الصبحي
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              التوقيع:
              {typeof SIGNATURE_IMG !== "undefined" && SIGNATURE_IMG
                ? <img src={SIGNATURE_IMG} alt="" style={{ height: 30, objectFit: "contain" }} />
                : "................"}
            </div>
          </td>
          <td style={{ border: bd, padding: "6px 10px", fontSize: 10, fontWeight: 700, verticalAlign: "top" }}>
            الاسم: {mgrName || "..................."}<br />الرتبة: {mgrRank || "..........."}<br />التوقيع:
          </td>
          <td style={{ border: bd, padding: "6px 10px", fontSize: 10, fontWeight: 700, verticalAlign: "top" }}>
            الاسم: ...................<br />الرتبة: ...........<br />التوقيع:
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } }`}</style>
      {/* أدوات التعبئة — لا تُطبع */}
      <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, background: "#fff", border: "1px solid #D9DCE2", borderRadius: 12, padding: "12px 14px" }}>
        <label style={{ fontSize: 12, fontWeight: 800 }}>الفترة من<br />
          <input value={fromD} onChange={(e) => setFromD(e.target.value)} placeholder="1448/1/21" style={{ padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700, width: 120, textAlign: "center" }} /></label>
        <label style={{ fontSize: 12, fontWeight: 800 }}>إلى<br />
          <input value={toD} onChange={(e) => setToD(e.target.value)} placeholder="1448/1/28" style={{ padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700, width: 120, textAlign: "center" }} /></label>
        <label style={{ fontSize: 12, fontWeight: 800, flex: 1, minWidth: 200 }}>ملاحظة أسفل التكميل (اختياري)<br />
          <input value={note1} onChange={(e) => setNote1(e.target.value)} placeholder="# ..." style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700 }} /></label>
        <label style={{ fontSize: 12, fontWeight: 800, flex: 1, minWidth: 200 }}>ملاحظة أسفل بيان الآليات (اختياري)<br />
          <input value={note2} onChange={(e) => setNote2(e.target.value)} placeholder="# ..." style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700 }} /></label>
        <label style={{ fontSize: 12, fontWeight: 800 }}>مدير الشعبة (اختياري)<br />
          <input value={mgrName} onChange={(e) => setMgrName(e.target.value)} placeholder="الاسم" style={{ padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700, width: 150 }} /></label>
        <label style={{ fontSize: 12, fontWeight: 800 }}>رتبته<br />
          <input value={mgrRank} onChange={(e) => setMgrRank(e.target.value)} placeholder="الرتبة" style={{ padding: "8px 10px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontFamily: "inherit", fontWeight: 700, width: 100 }} /></label>
      </div>
      <div className="no-print" style={{ fontSize: 12.5, fontWeight: 800, color: "#3A4152", background: "#EDF0F4", border: "1px solid #D9DCE2", borderRadius: 10, padding: "8px 14px", marginBottom: 12 }}>
        🔎 مطابقة حية الآن: بيان الآليات <b style={{ color: "#9E1B22" }}>{data.brokenVeh.length}</b> + الدراجات <b style={{ color: "#9E1B22" }}>{data.brokenBikes.length}</b> = <b>{data.brokenVeh.length + data.brokenBikes.length}</b> مصنفة متعطلة — من إجمالي متعطلة القاعدة {data.allBrokenDb} — والمستبعد {data.allBrokenDb - data.brokenVeh.length - data.brokenBikes.length} دايهاتسو متجاهلة تُحصى بعمود اخرى فقط</div>

      {/* رأس النموذج الرسمي بترويستنا */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.7 }}>
          المملكة العربية السعودية<br />الإدارة العامة للدفاع المدني بمحافظة جدة<br />إدارة العمليات
        </div>
        <img src={logo || DEFAULT_LOGO} alt="" style={{ width: 58, height: 58, objectFit: "contain" }} />
        <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.7, textAlign: "left" }}>
          (نموذج رقم 2 أسبوعي)<br />التاريخ: {t.d} / {t.m} {HIJRI_MONTHS[t.m - 1]} {t.y} هـ
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 800, margin: "8px 0 12px", textDecoration: "underline" }}>
        تقرير بالموقف الأسبوعي لأعطال الآليات وبنود الصرف للصيانة — الإدارة العامة للدفاع المدني بمحافظة جدة خلال الفترة من {fromD || "........"} إلى {toD || "........"} هـ
      </div>

      {/* أولاً: مصفوفة التكميل */}
      <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 5 }}>اولاً: تكميل اجمالي الآليات والأعطال والإصلاحات: -</div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...hcell, width: 74 }}>النوع</th>
            {data.names.map((n) => <th key={n} style={hcell}>{n === "اخرى" ? "اخرى" : n}</th>)}
            <th style={{ ...hcell, width: 44 }}>الاجمالي</th>
          </tr>
        </thead>
        <tbody>
          {[["عدد ملاك الادارة", "malak"], ["اجراءات رجيع", "rejee"], ["أعطال أولية (مهام الجهة)", null], ["أعطال متقدمة (مهام المركزية)", "broken"], ["الصالح", "ok"]].map(([lbl, key]) => (
            <tr key={lbl}>
              <td style={RowHead}>{lbl}</td>
              {data.names.map((n) => <td key={n} style={cell}>{key ? data.M[key][n] : 0}</td>)}
              <td style={{ ...cell, background: "#EDF0F4" }}>{key ? data.sum(data.M[key]) : 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note1 && <div style={{ fontSize: 9.5, fontWeight: 800, color: "#8F1C22", marginTop: 4 }}>{note1}</div>}

      {/* ثانياً: البيانات التفصيلية */}
      <div style={{ fontSize: 11.5, fontWeight: 800, margin: "14px 0 2px" }}>ثانيا: البيان التفصيلي للآليات والمعدات المتعطلة والإجراءات التي تمت عليها:</div>
      <DetailTable rows={data.brokenVeh} title="بيان اعطال الآليات" />
      {note2 && <div style={{ fontSize: 9.5, fontWeight: 800, color: "#8F1C22", marginTop: 4 }}>{note2}</div>}
      <SigBlock />
      <div style={{ pageBreakBefore: "always" }} />
      <DetailTable rows={data.brokenBikes} title="بيان أعطال الدراجات النارية" />

      {/* ثالثاً: الموقف العام */}
      <div style={{ fontSize: 11.5, fontWeight: 800, margin: "14px 0 5px" }}>ثالثا: الموقف العام: -</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{data.stats.map((s, i) => <th key={i} colSpan={2} style={{ ...dcellH, fontSize: 9 }}>{s.l}</th>)}</tr>
          <tr>{data.stats.map((s, i) => (
            [<th key={"n" + i} style={dcellH}>عدد</th>,
              <th key={"p" + i} style={dcellH}>نسبة{s.sub ? <div style={{ fontSize: 7.5 }}>{s.sub}</div> : null}</th>]
          ))}</tr>
        </thead>
        <tbody>
          <tr>{data.stats.map((s, i) => (
            [<td key={"n" + i} style={{ ...cell, fontSize: 11 }}>{s.n}</td>,
              <td key={"p" + i} style={{ ...cell, fontSize: 11 }}>{s.p}</td>]
          ))}</tr>
        </tbody>
      </table>
      <SigBlock />
    </div>
  );
}

const NAWI_COLS = [{"n":"عربة التدخل في حوادث المواد الخطرة","p":["اوم4965","سبي705","اهو7367","اقس6823"]},{"n":"عربة التدخل في حوادث الانهيارات","p":["اصم3985","اصم3992"]},{"n":"الرافعات","p":["اقي7558","اقي7557"]},{"n":"سلالم|28","p":["صهط219","اكع1641","اصم3546"]},{"n":"سلالم|30","p":[]},{"n":"سلالم|32","p":["امن7536","امن7531","باق1802","باد8505","باد8473","اصم3047"]},{"n":"سلالم|52","p":["اار4625","ارر9193"]},{"n":"سلالم|56","p":["اكي8267"]},{"n":"سلالم|بيرس","p":["بحن213"]},{"n":"سنوركل","p":["حاب750","بمم335"]},{"n":"اطفاء الحرائق الصناعية","p":["اقي2545","اقي2546","بصا2622"]},{"n":"ونش سحب /8*8","p":["باد4513","بحق7112","الط1122","اعك7362"]},{"n":"صهريج المباني العالية","p":["بسع2827","بحق7105","بحق7103","بحق7117"]},{"n":"صهريج جبلي","p":[]},{"n":"انقاذ جبلي تويوتا","p":[]}];
function NawiReport({ vehicles, logo }) {
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [sig1a, setSig1a] = useState("عقيد/ عبدالعزيز بن علي الشهري");
  const [sig2a, setSig2a] = useState("الاسم / ماجد بن موسى القاضي");
  const t = todayHijri();
  const todayTxt = `${t.d} / ${t.m} ${HIJRI_MONTHS[t.m - 1]} ${t.y} هـ`;
  const num = (s) => { const m = String(s || "").match(/(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})/); return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : 0; };
  const fmtD = (s) => { const m = String(s || "").match(/(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})/); return m ? `${+m[3]}/${+m[2]}/${m[1]}هـ` : (s || ""); };

  // معايير حصرية لهذا التقرير وحده
  const READY = ["تعمل", "تعمل بوجود ملاحظات", "تم الإصلاح"];
  const DOWN = ["عطلانة", "صدر قرار الرجيع", "تحت إجراءات الرجيع", "تحت التجهيز والتسليم"];
  const WSHOP = ["الصيانة المركزية", "ورشة خارجية", "ش روزنباور"];

  const data = useMemo(() => {
    const M = NAWI_COLS.map(() => ({ all: 0, ready: 0, hq: 0, ws: 0 }));
    const broken = [];
    vehicles.forEach((v) => {
      const np = normPlate(v.plate);
      const ci = NAWI_COLS.findIndex((c) => c.p.indexOf(np) >= 0);
      if (ci < 0) return;
      M[ci].all++;
      const st = (v.status || "").trim();
      if (READY.includes(st)) M[ci].ready++;
      else if (DOWN.includes(st)) {
        const ws = WSHOP.includes((v.location || "").trim());
        if (ws) M[ci].ws++; else M[ci].hq++;
        broken.push(v);
      } else M[ci].ready++;
    });
    broken.sort((a, b) => (a.unit || "").localeCompare(b.unit || "", "ar") || (a.type || "").localeCompare(b.type || "", "ar"));
    const openFault = (v) => {
      const fs = (v.faults || []).filter((f) => !f.repairDate);
      fs.sort((a, b) => num(b.date) - num(a.date));
      return fs[0] || (v.faults || [])[(v.faults || []).length - 1] || null;
    };
    const tot = M.reduce((s, m) => ({ all: s.all + m.all, ready: s.ready + m.ready, hq: s.hq + m.hq, ws: s.ws + m.ws }), { all: 0, ready: 0, hq: 0, ws: 0 });
    return { M, tot, broken, openFault };
  }, [vehicles]);

  const gy = "#D9D9D9";
  const bd = "1.2px solid #141A28";
  const th = { border: bd, background: gy, padding: "4px 3px", fontSize: 9.5, fontWeight: 800, textAlign: "center", lineHeight: 1.35, overflow: "hidden" };
  const td = { border: bd, padding: "4px 3px", fontSize: 11, fontWeight: 700, textAlign: "center" };
  const dth = { border: bd, background: gy, padding: "4px 4px", fontSize: 10, fontWeight: 800, textAlign: "center" };
  const dtd = { border: bd, padding: "2px 5px", fontSize: 9, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" };

  // بنية الرأس المزدوج: سلالم تفرعية
  const flat = NAWI_COLS.map((c) => c.n);
  const ladIdx = flat.findIndex((n) => n.startsWith("سلالم|"));
  const ladders = NAWI_COLS.filter((c) => c.n.startsWith("سلالم|"));
  const before = NAWI_COLS.filter((c, i) => i < ladIdx);
  const after = NAWI_COLS.filter((c, i) => i >= ladIdx + ladders.length);

  const inp = (v, set, w) => <input className="no-print-input" value={v} onChange={(e) => set(e.target.value)} style={{ padding: "7px 9px", borderRadius: 9, border: "1.5px solid #C9CDD6", fontSize: 12, fontWeight: 800, fontFamily: "inherit", width: w, textAlign: "center", display: "block", margin: "0 auto" }} />;

  const rowsDef = [["العدد الكلي", "all"], ["جاهزة", "ready"], ["متعطلة بالمقر", "hq"], ["متعطلة بالصيانة", "ws"]];

  return (
    <div>
      <style>{`@media print { @page { size: A4 landscape; margin: 6mm 8mm; } .no-print-input { border: none !important; background: transparent !important; } .nawi-wrap { zoom: 0.88; } .nawi-sig { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <div className="no-print" style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <b style={{ fontSize: 13 }}>الفترة من</b>
        <HijriDateInput value={dFrom} onChange={setDFrom} />
        <b style={{ fontSize: 13 }}>وحتى</b>
        <HijriDateInput value={dTo} onChange={setDTo} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5A6172" }}>المتعطلة الآن: {data.broken.length} من {data.tot.all} آلية نوعية (مقر {data.tot.hq} + صيانة {data.tot.ws})</span>
      </div>

      <div className="nawi-wrap">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ width: 120 }} />
        <div style={{ textAlign: "center", flex: 1 }}>
          {logo && <img src={logo} alt="" style={{ height: 46 }} />}
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>المملكة العربية السعودية — المديرية العامة للدفاع المدني</div>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>الإدارة العامة للدفاع المدني بمحافظة جدة</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, width: 120, textAlign: "left" }}>التاريخ: {todayTxt}</div>
      </div>

      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800, margin: "4px 0 2px" }}>بيان بالموقف الاسبوعي للآليات النوعية بالإدارة العامة للدفاع المدني بمحافظة جدة</div>
      <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>خلال الفترة من تاريخ {dFrom || "..... /..... /........."}هـ وحتى تاريخ {dTo || "..... /..... /........."}هـ</div>

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 64 }} rowSpan={2}>نوع الالية</th>
            {before.map((c) => <th key={c.n} style={th} rowSpan={2}>{c.n}</th>)}
            <th style={th} colSpan={ladders.length}>سلالم</th>
            {after.map((c) => <th key={c.n} style={th} rowSpan={2}>{c.n}</th>)}
            <th style={{ ...th, width: 46 }} rowSpan={2}>الاجمالي</th>
          </tr>
          <tr>
            {ladders.map((c) => <th key={c.n} style={{ ...th, fontSize: 9 }}>{c.n.split("|")[1]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowsDef.map(([lbl, key]) => (
            <tr key={key}>
              <td style={{ ...td, background: gy, fontSize: 9, fontWeight: 800, whiteSpace: "normal", lineHeight: 1.3, padding: "2px 3px" }}>{lbl}</td>
              {NAWI_COLS.map((c, i) => <td key={i} style={td}>{data.M[i][key]}</td>)}
              <td style={{ ...td, background: "#E4E7ED" }}>{data.tot[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: "center", color: "#C0121C", fontSize: 12, fontWeight: 800, margin: "12px 0 6px" }}>( بيان الآليات النوعية المتعطلة )</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={dth}>نوع الالية المتعطلة</th>
            <th style={{ ...dth, width: 82 }}>رقم اللوحة</th>
            <th style={{ ...dth, width: 52 }}>الموديل</th>
            <th style={dth}>المركز</th>
            <th style={{ ...dth, width: "26%" }}>نوع العطل</th>
            <th style={{ ...dth, width: 76 }}>تاريخ العطل</th>
            <th style={{ ...dth, width: 110 }}>الاجراء المتخذ</th>
          </tr>
        </thead>
        <tbody>
          {data.broken.map((v, i) => {
            const f = data.openFault(v);
            const st = (v.status || "").trim();
            const act = st === "صدر قرار الرجيع" || st === "تحت إجراءات الرجيع" ? st : "تم ابلاغ الصيانة";
            return (
              <tr key={v.id || i}>
                <td style={{ ...dtd, textAlign: "right" }}>{v.type}</td>
                <td style={dtd}>{v.plate}</td>
                <td style={dtd}>{v.model || ""}</td>
                <td style={{ ...dtd, textAlign: "right" }}>{v.unit || ""}</td>
                <td style={{ ...dtd, textAlign: "right" }}>{f ? (f.desc || f.faultType || "") : ""}</td>
                <td style={dtd}>{f ? fmtD(f.date) : ""}</td>
                <td style={dtd}>{act}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="nawi-sig" style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12, fontWeight: 800, gap: 20, breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div>مدير شعبة الاطفاء والانقاذ المكلف</div>
          <div style={{ marginTop: 6 }}>{inp(sig1a, setSig1a, 230)}</div>
          <div style={{ marginTop: 10 }}>التوقيع /</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div>مدير إدارة العمليات المكلف</div>
          <div style={{ marginTop: 6 }}>{inp(sig2a, setSig2a, 230)}</div>
          <div style={{ marginTop: 10 }}>التوقيع /</div>
        </div>
      </div>
    </div>
    </div>
  );
}
// ====== استيراد التحديثات من ملف الإكسل ======
// يقرأ الملف بنفس ترتيب أعمدة القاعدة الأصلية ويطبّق نفس قواعد التنظيف والتحويل الهجري
function cleanX(v) { if (v == null) return ""; return String(v).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim(); }
function deHamza(s) { return (s || "").replace(/[أإآ]/g, "ا"); }
function importNormStatus(s) {
  const c = cleanX(s); if (!c) return "تعمل";
  const key = deHamza(c);
  for (const st of STATUSES) if (key === deHamza(st)) return st;
  return "تعمل";
}
function importNormFType(s) {
  const c = cleanX(s); if (!c) return "";
  if (c === "ميكانيكي") return "عطل ميكانيكي";
  const key = deHamza(c);
  for (const ft of FAULT_TYPES) if (key === deHamza(ft)) return ft;
  return "أخرى";
}
// مفتاح مطابقة الآلية: رقم اللوحة، وإن كانت "بدون" أو فارغة فرقم الشاصية
function vehicleKey(plate, chassis) {
  const p = normPlate(plate);
  if (p && p !== "بدون") return "p:" + p;
  const ch = cleanX(chassis).toUpperCase();
  return ch ? "c:" + ch : "";
}

function importParseHijri(v) {
  if (v instanceof Date) {
    try {
      const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(v);
      const g = (t) => parseInt(parts.find((p) => p.type === t)?.value);
      const d = g("day"), m = g("month"), y = g("year");
      if (d && m && y) return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
    } catch {}
    return null;
  }
  const s = cleanX(v); if (!s) return null;
  const m = s.match(/^(\d{1,2})[\s\-\/\.]+(\d{1,2})[\s\-\/\.]+(\d{3,4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (!(d >= 1 && d <= 30 && mo >= 1 && mo <= 12 && y >= 1300 && y <= 1600)) return null;
  return `${y}/${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

function ExcelImport({ vehicles, onApply }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (f) => {
    if (!f) return;
    setBusy(true); setErr("");
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      // الورقة المعتمدة هي "قاعدة البيانات" إن وُجدت، وإلا الورقة الأولى
      const sheetName = wb.SheetNames.find((n) => deHamza(cleanX(n)) === deHamza("قاعدة البيانات")) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      // التعرف على الأعمدة من عناوينها (يدعم الشكل القديم والجديد معاً)
      const H = (raw[0] || []).map((h) => deHamza(cleanX(h)).replace(/ة/g, "ه").replace(/ى/g, "ي"));
      const find = (pred) => H.findIndex(pred);
      const cols = {
        itemNo: find((h) => h.includes("رقم الصنف")),
        type: find((h) => h.includes("نوع") && !h.includes("العطل") && !h.includes("عام")),
        plate: find((h) => h.includes("رقم اللوحه")),
        model: find((h) => h.includes("الموديل")),
        color: find((h) => h.includes("اللون")),
        chassis: find((h) => h.includes("الشاصيه")),
        unit: find((h) => h.includes("جهه") && h.includes("تفصيلي")),
        location: find((h) => h.includes("موقع")),
        status: find((h) => h.includes("الحاله الفنيه")),
        ftype: find((h) => h.includes("نوع العطل")),
        fdesc: find((h) => h.includes("وصف العطل")),
        fdate: find((h) => h.includes("تاريخ العطل")),
        rdate: find((h) => h.includes("تاريخ الاصلاح")),
        notes: find((h) => h.includes("ملاحظات")),
        causedBy: find((h) => h.includes("جهه العطل") || h.includes("المتسببه")),
      };
      if (cols.unit < 0) cols.unit = find((h) => h.includes("جهه") && !h.includes("العطل") && !h.includes("عام"));
      const headerBased = cols.plate >= 0 && cols.type >= 0 && cols.status >= 0;
      // fallback: الترتيب الثابت القديم إن لم تُتعرف العناوين
      const OLD = { itemNo: 0, type: 1, plate: 2, model: 3, color: 4, chassis: 5, unit: 6, location: 7, status: 8, ftype: 9, fdesc: 10, fdate: 11, rdate: 12, notes: 13, causedBy: 14 };
      const C = headerBased ? cols : OLD;
      const pick = (r, idx) => (idx >= 0 && idx < r.length ? r[idx] : null);
      const recs = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] || [];
        const itemNo = pick(r, C.itemNo), type = pick(r, C.type), plate = pick(r, C.plate),
          model = pick(r, C.model), color = pick(r, C.color), chassis = pick(r, C.chassis),
          unit = pick(r, C.unit), location = pick(r, C.location), status = pick(r, C.status),
          ftype = pick(r, C.ftype), fdesc = pick(r, C.fdesc), fdate = pick(r, C.fdate),
          rdate = pick(r, C.rdate), rawNotes = pick(r, C.notes), causedBy = pick(r, C.causedBy);
        if ([itemNo, type, plate, chassis, unit, status, fdesc].every((x) => cleanX(x) === "")) continue;
        const notes = cleanX(rawNotes);
        let desc = cleanX(fdesc);
        const fdateP = importParseHijri(fdate);
        const rdateP = importParseHijri(rdate);
        if (cleanX(rdate) && !rdateP && !(rdate instanceof Date)) desc = (desc ? desc + " — " : "") + "الإصلاح: " + cleanX(rdate);
        recs.push({
          itemNo: cleanX(itemNo), type: cleanX(type), plate: cleanX(plate), model: cleanX(model),
          color: cleanX(color), chassis: cleanX(chassis), unit: cleanX(unit), location: cleanX(location),
          status: importNormStatus(status), notes: notes,
          fault: (cleanX(ftype) || desc || fdateP || rdateP || cleanX(causedBy)) ? {
            faultType: importNormFType(ftype) || "أخرى", date: fdateP || "", repairDate: rdateP || "",
            causedBy: cleanX(causedBy), desc: desc || "غير موصوف",
          } : null,
        });
      }
      if (recs.length === 0) { setErr("الملف لا يحتوي أي صفوف بيانات."); setBusy(false); return; }
      const map = new Map(vehicles.map((v) => [vehicleKey(v.plate, v.chassis), v]).filter(([k]) => k));
      const matched = recs.filter((r) => { const k = vehicleKey(r.plate, r.chassis); return k && map.has(k); }).length;
      setPreview({ recs, matched, added: recs.length - matched });
    } catch (e) {
      console.error(e);
      setErr("تعذرت قراءة الملف — تأكد أنه ملف إكسل (xlsx) بنفس ترتيب أعمدة القاعدة.");
    }
    setBusy(false);
  };

  const apply = (mode) => {
    const recs = preview.recs;
    let newVehicles, faultsAdded = 0;
    if (mode === "replace") {
      newVehicles = recs.map((r, i) => ({
        id: "x_" + Date.now() + "_" + i,
        type: r.type, plate: r.plate, unit: r.unit, itemNo: r.itemNo, chassis: r.chassis,
        color: r.color, model: r.model, location: r.location, status: r.status, notes: r.notes,
        faults: r.fault ? [{ ...r.fault, _id: Date.now() + i }] : [], transfers: [],
        createdAt: new Date().toISOString().slice(0, 10),
      }));
    } else {
      const map = new Map(vehicles.map((v) => [vehicleKey(v.plate, v.chassis), v]).filter(([k]) => k));
      const updated = new Map();
      const newOnes = [];
      recs.forEach((r, i) => {
        const key = vehicleKey(r.plate, r.chassis);
        const ex = key ? map.get(key) : null;
        if (ex) {
          const nv = {
            ...ex,
            type: r.type || ex.type, unit: r.unit || ex.unit, itemNo: r.itemNo || ex.itemNo,
            chassis: r.chassis || ex.chassis, color: r.color || ex.color, model: r.model || ex.model,
            location: r.location || ex.location, status: r.status, notes: r.notes || ex.notes,
            faults: [...ex.faults],
          };
          if (r.fault) {
            const dup = nv.faults.some((f) =>
              (f.date || "") === (r.fault.date || "") &&
              deHamza(cleanX(f.desc)) === deHamza(r.fault.desc) &&
              f.faultType === r.fault.faultType);
            if (!dup) { nv.faults.push({ ...r.fault, _id: Date.now() + i }); faultsAdded++; }
          }
          updated.set(ex.id, nv);
        } else {
          newOnes.push({
            id: "x_" + Date.now() + "_" + i,
            type: r.type, plate: r.plate, unit: r.unit, itemNo: r.itemNo, chassis: r.chassis,
            color: r.color, model: r.model, location: r.location, status: r.status, notes: r.notes,
            faults: r.fault ? [{ ...r.fault, _id: Date.now() + i }] : [], transfers: [],
            createdAt: new Date().toISOString().slice(0, 10),
          });
        }
      });
      newVehicles = [...vehicles.map((v) => updated.get(v.id) || v), ...newOnes];
    }
    onApply(newVehicles, mode, faultsAdded, preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const btn = (bg, fg, border) => ({
    background: bg, color: fg, border: border || "none", borderRadius: 10,
    padding: "10px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <>
      <button onClick={() => fileRef.current?.click()} title="سحب آخر التعديلات من ملف الإكسل" style={{
        background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)",
        borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
      }}>
        {busy ? "جارٍ القراءة..." : "⬆ استيراد"}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])} />
      {err && (
        <div onClick={() => setErr("")} style={{ position: "fixed", bottom: 20, right: 20, background: "#C4353C", color: "#fff", borderRadius: 12, padding: "12px 18px", fontSize: 13.5, fontWeight: 700, zIndex: 100, cursor: "pointer", maxWidth: 380 }}>
          {err} ✕
        </div>
      )}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,13,20,0.55)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div dir="rtl" style={{ background: "#F4F5F7", borderRadius: 18, padding: 24, maxWidth: 520, width: "100%", fontFamily: "'Tajawal',sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#141A28" }}>تأكيد الاستيراد من الإكسل</h3>
            <div style={{ fontSize: 14, color: "#3A4152", lineHeight: 2, marginBottom: 16 }}>
              الملف يحتوي <b>{preview.recs.length}</b> آلية:
              منها <b>{preview.matched}</b> مطابقة لآليات موجودة (ستُحدَّث بياناتها وحالتها من الملف)
              و<b>{preview.added}</b> جديدة ستُضاف.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => apply("merge")} style={btn("#9E1B22", "#fff")}>
                دمج ذكي (موصى به) — يحدّث من الملف ويحتفظ بسجل الأعطال والتنقلات المسجل داخل البرنامج
              </button>
              <button onClick={() => apply("replace")} style={btn("#141A28", "#fff")}>
                استبدال كامل — مسح قاعدة البرنامج وإعادة بنائها من الملف حرفياً
              </button>
              <button onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }} style={btn("#F4F5F7", "#3A4152", "1.5px solid #C9CDD6")}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ====== تصدير حزمة الموقع (zip) والنشر على Netlify ======
// يبني نسخة من التطبيق ببياناتك الحالية داخل ملف index.html مضغوط جاهز للسحب والإفلات
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(name, data) {
  const nameBytes = new TextEncoder().encode(name);
  const crc = crc32(data);
  const lh = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(lh.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
  lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
  lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
  lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
  lh.set(nameBytes, 30);
  const cd = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
  cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
  cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true);
  cd.set(nameBytes, 46);
  const cdOffset = lh.length + data.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true);
  ev.setUint32(12, cd.length, true); ev.setUint32(16, cdOffset, true);
  return new Blob([lh, data, cd, eocd], { type: "application/zip" });
}
function buildSiteHTML(db) {
  // الوسوم تُبنى من قطع منفصلة كي لا تظهر حرفياً داخل الكود فتطابق نفسها عند التصدير
  const SEED_OPEN = ["<scr", "ipt id=", '"', "cd-seed", '"', ">"].join("");
  const SEED_CLOSE = ["</scr", "ipt>"].join("");
  const APP_OPEN = ["<scr", "ipt id=", '"', "app", '"', ">"].join("");
  let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
  // إزالة بذور تصديرات سابقة: فقط ما يقع قبل سكربت التطبيق الحقيقي (حماية من مطابقة نصوص الكود الداخلية)
  for (let guard = 0; guard < 5; guard++) {
    const appIdx = html.indexOf(APP_OPEN);
    const i = html.indexOf(SEED_OPEN);
    if (i === -1 || (appIdx !== -1 && i > appIdx)) break;
    const j = html.indexOf(SEED_CLOSE, i);
    if (j === -1) break;
    html = html.slice(0, i) + html.slice(j + SEED_CLOSE.length);
  }
  // تفريغ صورة الواجهة الساكنة من الجذر كي يقلع التطبيق الحي وحده دون طبقة ميتة فوقه
  const ROOT_OPEN = ["<div id=", '"', "root", '"', ">"].join("");
  const rootIdx = html.indexOf(ROOT_OPEN);
  const appIdx0 = html.indexOf(APP_OPEN);
  if (rootIdx !== -1 && appIdx0 !== -1 && appIdx0 > rootIdx) {
    html = html.slice(0, rootIdx + ROOT_OPEN.length) + "</div>\n" + html.slice(appIdx0);
  }
  const dbJson = JSON.stringify(db).split("</").join("<\\/");
  const seedScript = SEED_OPEN + 'try{var K="cdfleet::cd-fleet:db";if(!localStorage.getItem(K)){localStorage.setItem(K,' + JSON.stringify(dbJson) + ');}}catch(e){}' + SEED_CLOSE;
  const appIdxF = html.indexOf(APP_OPEN);
  html = html.slice(0, appIdxF) + seedScript + "\n" + html.slice(appIdxF);
  return html;
}

// ====== صفحة جاهزية المراكز الميدانية ======
const FIELD_ENTITIES = [
  "شعبة الشاطئ", "شعبة الحمدانية", "شعبة العزيزية", "شعبة المروة", "شعبة أبحر",
  "شعبة السالمية", "شعبة الجامعة", "شعبة الصناعية", "شعبة خزام", "شعبة البغدادية",
  "شعبة الساحل الجنوبي", "شعبة الاسكان", "مركز ثول",
];
// الشعب الاثنتا عشرة فقط لقائمة الجاهزية اليدوية (قسم الدعم والإسناد له جاهزية مختلفة لاحقاً)
const FIELD_BRANCHES_ONLY = FIELD_ENTITIES.filter((n) => n.startsWith("شعبة"));
function readinessColor(pct) {
  if (pct >= 80) return "#2E9E63";
  if (pct >= 60) return "#E8A33D";
  return "#C4353C";
}

// ====== خانات الجاهزية الأساسية لكل مركز (تُعلَّم يدوياً) ======
const FIRE_SLOTS = [["fire_w1", "وايت"], ["fire_w2", "وايت ثانٍ"], ["fire_high", "وايت المباني العالية"]];
const RESCUE_SLOTS = [
  ["res_fordS", "انقاذ فورد صغير"], ["res_fordB", "انقاذ فورد كبير"],
  ["res_rosen", "مزدوجة روزنباور"], ["res_merc", "مزدوجة مرسيدس"],
  ["res_jeep", "جيب خفيف"], ["res_rosenL", "حريق روزنباور (انقاذ خفيف)"],
  ["res_fastJeep", "جيب تدخل سريع"],
];
// المسميات الرسمية لمراكز الشعب في لوحة الجاهزية اليدوية
const MANUAL_CENTERS = [
  { branch: "شعبة الشاطئ", centers: ["مركز غرب 1 ( الشاطئ )", "مركز غرب 2 ( الخالدية )", "مركز غرب 3 ( الروضة )", "مركز غرب 4 ( النهضة )", "مركز مجد 1 ( قصر السلام )", "مركز مجد 3", "مركز مجد 3ب"] },
  { branch: "شعبة الحمدانية", centers: ["مركز شمال 1 ( الحمدانية )", "مركز شمال 2 ( بريمان )", "مركز شمال 3 ( الرحيلي )", "مركز شمال 4 ( الرياض )", "مركز شمال 5 ( ذهبان )"] },
  { branch: "شعبة العزيزية", centers: ["مركز وسط 1 ( الرحاب )", "مركز وسط 2 ( العزيزية )", "مركز وسط 3 ( النسيم )", "مركز وسط 4 ( بني مالك )", "مركز وسط 5 ( الاندلس )"] },
  { branch: "شعبة المروة", centers: ["مركز صفا 1 ( المروة )", "مركز صفا 2 ( النزهة )", "مركز صفا 3 ( الربوة )", "مركز صفا 4 ( الصفا )", "مركز صفا 5 ( الفيصلية )", "مركز صفا 6 ( البوادي )"] },
  { branch: "شعبة ابحر", centers: ["مركز ابحر 1 ( ابحر الجنوبية )", "مركز ابحر 2 ( ابحر الشمالية )", "مركز ابحر 3 ( المحمدية )", "مركز ابحر 4 ( درة العروس )"] },
  { branch: "شعبة السالمية", centers: ["مركز سالمية 1 ( السالمية )", "مركز سالمية 2 ( النخيل )", "مركز سالمية 3", "مركز سالمية 4 ( السامر )", "مركز سالمية 5 ( المنار )"] },
  { branch: "شعبة الجامعة", centers: ["مركز شرق 1 ( الجامعة )", "مركز شرق 2 ( الروابي )", "مركز شرق 3 ( قويزة )", "مركز شرق 4 ( المنتزهات )", "مركز شرق 5 ( الحرزات الشمالي )"] },
  { branch: "شعبة الصناعية", centers: ["مركز صناعية 1 ( الصناعية )", "مركز صناعية 2 ( المرحلة الاولى )", "مركز صناعية 3 ( الاسواق الشعبية )", "مركز صناعية 5 ( السنابل )"] },
  { branch: "شعبة خزام", centers: ["مركز خزام 1 ( خزام )", "مركز خزام 2 ( الخاسكية )", "مركز خزام 3 ( الوزيرية )", "مركز خزام 4 ( بترومين )"] },
  { branch: "شعبة البغدادية", centers: ["مركز بلد 1 ( الحمراء )", "مركز بلد 2 ( البغدادية )", "مركز بلد 3 ( باب مكة )", "مركز بلد 4 ( الاندلس )", "مركز بلد 5 ( الشرفية )"] },
  { branch: "شعبة الساحل الجنوبي", centers: ["مركز جنوب 1 ( الكورنيش )", "مركز جنوب 2 ( الصناعية الثانية )", "مركز جنوب 3 ( طريق الساحل )", "مركز جنوب 4 ( الخمرة )", "مركز جنوب 5 ( المستودعات )"] },
  { branch: "شعبة الاسكان الجنوبي", centers: ["مركز اسكان 1 ( الاسكان الجنوبي )", "مركز اسكان 2 ( ام السلم )", "مركز اسكان 3 ( الالفية )", "مركز اسكان 4 ( الحرزات الشرقي )", "مركز اسكان 5 ( المحاميد )"] },
  { branch: "مركز ثول", centers: ["مركز ثول", "مركز مجد 2 ( الجزيرة )"] },
];

const SINGLE_SLOTS = [
  ["ladder", "السلالم"], ["ambulance", "الإسعاف"], ["water", "انقاذ مائي"],
  ["tanker", "صهريج"], ["hazmat", "تدخل المواد الخطرة"], ["masks", "كمامات"],
  ["collapse", "الانهيارات"], ["telescope", "التليسكوب"], ["foam", "اسناد الرغاوي"],
];

// آليات إضافية تظهر لمراكز محددة فقط
const EXTRA_SLOTS = {
  "مركز صفا 3 ( الربوة )": [["decon", "عربة التطهير"]],
  "مركز صناعية 1 ( الصناعية )": [["indFire", "عربة حريق الصناعية"]],
  "مركز جنوب 1 ( الكورنيش )": [["indFire", "عربة حريق الصناعية"]],
  "مركز مجد 1 ( قصر السلام )": [["lightCart", "عربة إنارة"]],
};
// أسماء كل الخانات للاستخدام في رسائل النقص
const SLOT_LABELS = (() => {
  const m = { fire_w1: "وايت", fire_w2: "وايت ثانٍ", fire_high: "وايت المباني العالية", lightCart: "عربة إنارة" };
  RESCUE_SLOTS.forEach(([k, l]) => (m[k] = l));
  SINGLE_SLOTS.forEach(([k, l]) => (m[k] = l));
  m.decon = "عربة التطهير"; m.indFire = "عربة حريق الصناعية";
  return m;
})();
// القواعد الخاصة: need = خانات لازمة وإلا أصفر · fireOnly = وايت واحد يكفي للجاهزية · twoWhits = وايتان لازمان
const CENTER_RULES = {
  "مركز اسكان 1 ( الاسكان الجنوبي )": { need: ["ladder", "hazmat", "ambulance"] },
  "مركز اسكان 2 ( ام السلم )": { need: ["tanker"] },
  "مركز شرق 1 ( الجامعة )": { need: ["ambulance"] },
  "مركز شرق 3 ( قويزة )": { need: ["water"] },
  "مركز شرق 5 ( الحرزات الشمالي )": { need: ["tanker"] },
  "مركز خزام 1 ( خزام )": { need: ["masks", "hazmat", "ambulance", "ladder"] },
  "مركز ثول": { need: ["ambulance"] },
  "مركز بلد 1 ( الحمراء )": { need: ["water", "collapse"] },
  "مركز بلد 2 ( البغدادية )": { need: ["fire_high"] },
  "مركز بلد 5 ( الشرفية )": { need: ["ladder"] },
  "مركز وسط 5 ( الاندلس )": { need: ["tanker", "ladder", "ambulance"] },
  "مركز صفا 1 ( المروة )": { need: ["ambulance", "ladder", "tanker"] },
  "مركز صفا 3 ( الربوة )": { need: ["hazmat", "masks", "decon"] },
  "مركز صفا 6 ( البوادي )": { fireOnly: true },
  "مركز شمال 1 ( الحمدانية )": { need: ["ladder"] },
  "مركز شمال 3 ( الرحيلي )": { need: ["ambulance"] },
  "مركز غرب 1 ( الشاطئ )": { need: ["ambulance", "ladder", "fire_high"] },
  "مركز غرب 2 ( الخالدية )": { need: ["fire_high"] },
  "مركز مجد 1 ( قصر السلام )": { need: ["ladder", "lightCart"] },
  "مركز مجد 3ب": { fireOnly: true },
  "مركز ابحر 1 ( ابحر الجنوبية )": { need: ["ladder", "tanker"] },
  "مركز ابحر 2 ( ابحر الشمالية )": { need: ["water"] },
  "مركز صناعية 1 ( الصناعية )": { need: ["tanker", "telescope", "foam", "indFire"] },
  "مركز صناعية 2 ( المرحلة الاولى )": { need: ["tanker"] },
  "مركز جنوب 1 ( الكورنيش )": { need: ["indFire", "tanker"] },
  "مركز مجد 2 ( الجزيرة )": { twoWhits: true },
};
// حساب مستوى جاهزية المركز: أحمر (بلا أساس) / أصفر (نقص متطلبات خاصة) / أخضر (مكتمل)
function centerStatus(name, s) {
  s = s || {};
  const fireCount = FIRE_SLOTS.filter(([k]) => s[k]).length;
  const hasFire = fireCount > 0;
  // الإنقاذ المخصص (يحقق الأخضر): فورد صغير/كبير والمزدوجة — والبدائل (الجيبان وحريق روزنباور الخفيف) تغطية جزئية = أصفر
  const hasRescueFull = ["res_fordS", "res_fordB", "res_rosen", "res_merc"].some((k) => s[k]);
  const hasRescueSub = ["res_jeep", "res_rosenL", "res_fastJeep"].some((k) => s[k]);
  const hasRescue = hasRescueFull || hasRescueSub;
  const rule = CENTER_RULES[name] || {};
  if (rule.fireOnly) {
    if (!hasFire) return { level: "red", label: "⚠ بلا وايت" };
    return { level: "green", label: "✓ جاهز — وايت يكفي لهذا المركز" };
  }
  if (!hasFire || !hasRescue) {
    return { level: "red", label: !hasFire && !hasRescue ? "⚠ بلا وايت وبلا إنقاذ" : !hasFire ? "⚠ بلا وايت" : "⚠ بلا إنقاذ" };
  }
  const missing = [];
  if (!hasRescueFull) missing.push("انقاذ مخصص (فورد أو مزدوجة) — المتوفر بديل مؤقت");
  if (rule.twoWhits && fireCount < 2) missing.push("وايت ثانٍ");
  (rule.need || []).forEach((k) => { if (!s[k]) missing.push(SLOT_LABELS[k] || k); });
  if (missing.length) return { level: "yellow", label: "⚠ ناقص: " + missing.join("، ") };
  return { level: "green", label: "✓ الجاهزية مكتملة" };
}
// الحالة الشاملة للمركز: الأساس + المعدات النوعية (الحزام والمزدوجة) في لون واحد
function fullCenterStatus(name, s, equip) {
  const base = centerStatus(name, s);
  if (base.level === "red") return base;
  const eq = equip || {};
  const missing = [];
  if (ANIMAL_STRAP_CENTERS.includes(name) && !(eq.animalStrap || {})[name]) missing.push("حزام الانتشال والانقاذ للحيوانات");
  const dd = (eq.duals || {})[name] || {};
  if (dd.has && !(dd.pump && dd.qala)) missing.push(!dd.pump && !dd.qala ? "جاهزية المزدوجة (المضخة والقلع)" : !dd.pump ? "مضخة المزدوجة" : "قلع المزدوجة");
  if (missing.length === 0) return base;
  if (base.level === "yellow") return { level: "yellow", label: base.label + "، " + missing.join("، ") };
  return { level: "yellow", label: "⚠ ناقص: " + missing.join("، ") };
}

const LEVEL_COLORS = {
  red: { border: "#C4353C", bg: "#FBE9EA", badge: "#C4353C" },
  yellow: { border: "#E8A33D", bg: "#FBF3E2", badge: "#C77F1A" },
  green: { border: "#2E9E63", bg: "#F4F5F7", badge: "#2E9E63" },
};

function CenterCard({ name, state, onToggle }) {
  const s = state || {};
  const st = centerStatus(name, s);
  const colors = LEVEL_COLORS[st.level];
  const extras = EXTRA_SLOTS[name] || [];
  const ticked = [...FIRE_SLOTS, ...RESCUE_SLOTS, ...SINGLE_SLOTS, ...extras].filter(([k]) => s[k]).length;

  const Chip = ({ k, label }) => (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px",
      borderRadius: 13, fontSize: 11, fontWeight: 700, cursor: "pointer",
      background: s[k] ? "#E5F3EB" : "#EEF0F3",
      color: s[k] ? "#1E6B44" : "#5A6172",
      border: "1.5px solid " + (s[k] ? "#2E9E63" : "#D9DCE2"),
      userSelect: "none",
    }}>
      <input type="checkbox" checked={!!s[k]} onChange={() => onToggle(name, k)}
        style={{ accentColor: "#2E9E63", width: 12, height: 12 }} />
      {label}
    </label>
  );

  return (
    <div style={{
      background: colors.bg,
      border: "2px solid " + colors.border,
      borderRadius: 12, padding: "10px 12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 12.5, color: "#141A28" }}>{name}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 14,
          background: colors.badge, color: "#fff", maxWidth: "100%",
        }}>
          {st.label}{" · " + ticked}
        </span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#8F1C22", marginBottom: 3 }}>الإطفاء</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FIRE_SLOTS.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1F4E8C", marginBottom: 3 }}>الإنقاذ</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RESCUE_SLOTS.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#5A6172", marginBottom: 3 }}>آليات فنية أخرى</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SINGLE_SLOTS.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
          {extras.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
        </div>
      </div>
    </div>
  );
}

// ====== جاهزية قسم الدعم والإسناد: عدادات لكل نوع آلية ======
// multi: الأنواع المتعددة بالأصل (الونش، الإنارة، الشيول، السنوركل) — البقية صنف واحد
// الحقل الرابع: الجنس اللغوي للمفرد (m مذكر / f مؤنث) لصياغة "متعطل/متعطلة" و"جاهز/جاهزة"
const SUPPORT_SLOTS = [
  ["dozer", "دركتر", false, "m"],
  ["shovel", "شيول", true, "m"],
  ["fuelTrailer", "قاطرة المحروقات", false, "f"],
  ["extVan", "عربة الطفيات", false, "f"],
  ["dump", "قلاب", false, "m"],
  ["backhoe", "بوكلين", false, "m"],
  ["masksVan", "عربة الكمامات", false, "f"],
  ["whitHigh", "وايت المباني العالية", false, "m"],
  ["tanker", "صهريج", false, "m"],
  ["lowbed3", "لوبد ثلاث محاور", false, "m"],
  ["lowbed4", "لوبد أربع محاور", false, "m"],
  ["tadano55", "تدانو 55 طن", false, "m"],
  ["tadano160", "تدانو 160 طن", false, "m"],
  ["snorkel", "سنوركل", true, "m"],
  ["ladders", "سلالم", false, "f"],
  ["lighting", "عربة إنارة", true, "f"],
  ["blanketVan", "عربة الملاية", false, "f"],
  ["mobilePump", "المضخة المتنقلة", false, "f"],
  ["collapse", "الانهيارات", false, "f"],
  ["foam", "اسناد الرغاوي", false, "m"],
  ["winch", "الونش", true, "m"],
  ["boats", "القوارب", true, "f"],
];
// اللون: صفر = أحمر (جميعها متعطلة) · المتعدد: 1 أصفر و2+ أخضر · المفرد: 1 أخضر
function supportLevel(count, multi) {
  if (count <= 0) return "red";
  if (multi) return count === 1 ? "yellow" : "green";
  return "green";
}

function SupportBoard({ counts, onChange }) {
  const totals = { red: 0, yellow: 0, green: 0 };
  SUPPORT_SLOTS.forEach(([k, , multi]) => { totals[supportLevel(counts[k] || 0, multi)]++; });
  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <KPI label="أنواع آليات القسم" value={SUPPORT_SLOTS.length} color="#141A28" />
        <KPI label="جاهزة (أخضر)" value={totals.green} color="#2E9E63" />
        <KPI label="على الحد الأدنى (أصفر)" value={totals.yellow} color="#C77F1A" />
        <KPI label="متعطلة بالكامل (أحمر)" value={totals.red} color="#C4353C" />
      </div>
      <div style={{ fontSize: 12.5, color: "#5A6172", fontWeight: 700, background: "#EEF0F3", border: "1px solid #D9DCE2", borderRadius: 10, padding: "9px 14px", marginBottom: 16 }}>
        حدّد عدد الآليات <b>الجاهزة للعمل</b> من كل نوع بزري + و− : الصفر يعني أن جميعها متعطلة (أحمر). الأنواع المتعددة بالأصل (الونش، الإنارة، الشيول، السنوركل، القوارب): واحدة جاهزة = أصفر، وأكثر = أخضر. بقية الأنواع صنف واحد: واحدة جاهزة = أخضر.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10 }}>
        {SUPPORT_SLOTS.map(([k, label, multi, g]) => {
          const c = counts[k] || 0;
          const lv = supportLevel(c, multi);
          const colors = LEVEL_COLORS[lv];
          const max = multi ? 20 : 1;
          const btn = (dis) => ({
            width: 34, height: 34, borderRadius: 9, border: "1.5px solid #C9CDD6",
            background: dis ? "#EEF0F3" : "#F4F5F7", color: dis ? "#B4BAC6" : "#141A28",
            fontSize: 18, fontWeight: 800, cursor: dis ? "not-allowed" : "pointer", fontFamily: "inherit",
          });
          return (
            <div key={k} style={{ background: colors.bg, border: "2px solid " + colors.border, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 12.5, color: "#141A28" }}>{label}</span>
                {multi && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#5A6172", background: "#E3E5E9", borderRadius: 8, padding: "2px 7px", whiteSpace: "nowrap" }}>متعدد</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <button style={btn(c <= 0)} disabled={c <= 0} onClick={() => onChange(k, -1)}>−</button>
                <span style={{ fontSize: 22, fontWeight: 800, minWidth: 30, textAlign: "center", color: colors.badge }}>{c}</span>
                <button style={btn(c >= max)} disabled={c >= max} onClick={() => onChange(k, 1)}>+</button>
              </div>
              <div style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: colors.badge }}>
                {lv === "red"
                  ? (multi ? "⚠ جميعها متعطلة" : g === "f" ? "⚠ متعطلة" : "⚠ متعطل")
                  : lv === "yellow" ? "الحد الأدنى — واحدة جاهزة"
                  : (multi || g === "f" ? "✓ جاهزة" : "✓ جاهز")}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ====== جاهزية المعدات والأدوات النوعية لجميع شعب ومراكز إدارة جدة ======
// حزام الانتشال والانقاذ للحيوانات: خاص بمركزين فقط
const ANIMAL_STRAP_CENTERS = ["مركز اسكان 4 ( الحرزات الشرقي )", "مركز شمال 4 ( الرياض )"];

// ====== بوصلة التغطية الذكية: محرك أولويات ودعم قرار نقل الوايت والإنقاذ ======
// عربات الإنقاذ الكاملة، والبدائل الأدنى درجة (تغطي جزئياً): جيب التدخل السريع، حريق روزنباور الخفيف، الجيب الخفيف
const FULL_RESCUE_KEYS = ["res_fordS", "res_fordB", "res_rosen", "res_merc"];
const SUB_RESCUE_KEYS = ["res_jeep", "res_rosenL", "res_fastJeep"];
const DENSITY_OPTS = [[1, "منخفضة"], [2, "متوسطة"], [3, "عالية"], [4, "عالية جداً"]];
const FACILITY_OPTS = [[1, "اعتيادية"], [2, "مهمة (أسواق/أبراج)"], [3, "حرجة (صناعية/مستشفيات)"], [4, "بالغة الحرج (خطرة/استراتيجية)"]];
const TIER_STYLE = {
  max: { label: "قصوى", color: "#8F1C22", bg: "#FBE9EA" },
  high: { label: "عالية", color: "#C77F1A", bg: "#FBF3E2" },
  mid: { label: "متوسطة", color: "#1F4E8C", bg: "#E8EEF7" },
  base: { label: "اعتيادية", color: "#5A6172", bg: "#EEF0F3" },
};
function importanceTier(imp) {
  return imp >= 75 ? "max" : imp >= 50 ? "high" : imp >= 25 ? "mid" : "base";
}
// بناء صفوف البوصلة: الأهمية (معايير موزونة) × الفجوة (وايت 60% لا بديل له، إنقاذ 40% والبديل يغطي 65%)
function buildCompass(centerReadiness, prio, weights) {
  const wSum = (weights.inc || 0) + (weights.den || 0) + (weights.fac || 0) || 1;
  const all = MANUAL_CENTERS.flatMap(({ branch, centers }) => centers.map((c) => ({ branch, name: c })));
  const maxInc = Math.max(1, ...all.map(({ name }) => ((prio[name] || {}).inc || 0)));
  const rows = all.map(({ branch, name }) => {
    const p = prio[name] || {};
    const s = centerReadiness[name] || {};
    const incScore = ((p.inc || 0) / maxInc) * 100;
    const denScore = ((p.den || 1) / 4) * 100;
    const facScore = ((p.fac || 1) / 4) * 100;
    const imp = Math.round((incScore * (weights.inc || 0) + denScore * (weights.den || 0) + facScore * (weights.fac || 0)) / wSum);
    const whitCount = FIRE_SLOTS.filter(([k]) => s[k]).length;
    const rescueFull = FULL_RESCUE_KEYS.filter((k) => s[k]).length;
    const rescueSub = SUB_RESCUE_KEYS.filter((k) => s[k]).length;
    const whitGap = whitCount > 0 ? 0 : 1;
    const rescueGap = rescueFull > 0 ? 0 : rescueSub > 0 ? 0.35 : 1;
    const gap = 0.6 * whitGap + 0.4 * rescueGap;
    const risk = Math.round(imp * gap);
    return { branch, name, inc: p.inc || 0, den: p.den || 1, fac: p.fac || 1, imp, whitCount, rescueFull, rescueSub, gap, risk };
  });
  rows.sort((a, b) => b.risk - a.risk || b.imp - a.imp);
  return rows;
}
// مولد توصيات النقل: فوائض آمنة أولاً، ثم مناقلات مفاضلة بفارق أهمية حاسم (≥15 نقطة)
function buildRecommendations(rows) {
  const recs = [];
  const byImpAsc = (a, b) => a.imp - b.imp;
  const byRiskDesc = (a, b) => b.risk - a.risk;
  // 1) وايت: فائض حقيقي (وايتان فأكثر) نحو الأعلى خطراً بلا وايت
  const wDonors = rows.filter((r) => r.whitCount >= 2).sort(byImpAsc);
  const wNeeds = rows.filter((r) => r.whitCount === 0 && r.imp > 0).sort(byRiskDesc);
  let di = 0;
  for (const need of wNeeds) {
    if (di >= wDonors.length) break;
    const donor = wDonors[di++];
    recs.push({ kind: "وايت", safe: true, from: donor, to: need,
      impact: Math.round(need.imp * 0.6),
      note: "المتبرع يملك " + donor.whitCount + " وايتات ويبقى مغطى بعد النقل" });
  }
  // 2) وايت: مناقلة مفاضلة من الأدنى أهمية (بوايت واحد) إن كان الفارق حاسماً
  const remainingNeeds = wNeeds.slice(di);
  if (remainingNeeds.length) {
    const singleDonors = rows.filter((r) => r.whitCount === 1).sort(byImpAsc);
    for (const need of remainingNeeds.slice(0, 2)) {
      const donor = singleDonors.find((d) => d.name !== need.name && need.imp - d.imp >= 15);
      if (donor) recs.push({ kind: "وايت", safe: false, from: donor, to: need,
        impact: Math.round((need.imp - donor.imp) * 0.6),
        note: "مفاضلة: أهمية المستقبِل " + need.imp + " مقابل " + donor.imp + " للمتبرع — سيفقد المتبرع تغطيته" });
    }
  }
  // 3) إنقاذ: فائض كامل نحو الأعلى خطراً بلا إنقاذ كامل
  const rDonors = rows.filter((r) => r.rescueFull >= 2).sort(byImpAsc);
  const rNeeds = rows.filter((r) => r.rescueFull === 0 && r.imp > 0).sort(byRiskDesc);
  let ri = 0;
  for (const need of rNeeds) {
    if (ri >= rDonors.length) break;
    const donor = rDonors[ri++];
    recs.push({ kind: "إنقاذ", safe: true, from: donor, to: need,
      impact: Math.round(need.imp * 0.4 * (need.rescueSub > 0 ? 0.65 : 1)),
      note: need.rescueSub > 0 ? "المستقبِل لديه بديل جزئي (جيب/انقاذ خفيف) والنقل يرفعه للتغطية الكاملة" : "المتبرع يملك " + donor.rescueFull + " إنقاذات كاملة" });
  }
  recs.sort((a, b) => b.impact - a.impact);
  return recs.slice(0, 6);
}

// محرر جاهزية مركز واحد — نافذة مركّزة تفتح بنقرة على بطاقته
function CenterEditor({ name, branch, state, onToggle, onBoats, onSetSlots, equip, onEquip, onClose, onPrev, onNext, pos }) {
  const s = state || {};
  const st = fullCenterStatus(name, s, equip);
  const colors = LEVEL_COLORS[st.level];
  const rule = CENTER_RULES[name] || {};
  const extras = EXTRA_SLOTS[name] || [];
  const eq = equip || {};
  const ring = (eq.ringCutter || {})[name];
  const elev = (eq.elevatorKey || {})[name];
  const elevE = (eq.elevatorKeyE || {})[name];
  const isStrap = ANIMAL_STRAP_CENTERS.includes(name);
  const strap = (eq.animalStrap || {})[name];
  const dd = (eq.duals || {})[name] || {};

  const chipBase = (active, highlight) => ({
    display: "flex", alignItems: "center", gap: 7, padding: "0 10px",
    borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", userSelect: "none",
    width: "100%", minHeight: 38, boxSizing: "border-box", lineHeight: 1.35,
    background: active ? "#E5F3EB" : highlight ? "#FBF3E2" : "#EEF0F3",
    color: active ? "#1E6B44" : highlight ? "#C77F1A" : "#5A6172",
    border: "1.5px solid " + (active ? "#2E9E63" : highlight ? "#E8A33D" : "#D9DCE2"),
  });
  const Chip = ({ k, label, highlight }) => (
    <label style={chipBase(!!s[k], highlight)}>
      <input type="checkbox" checked={!!s[k]} onChange={() => onToggle(name, k)}
        style={{ accentColor: "#2E9E63", width: 15, height: 15, flexShrink: 0 }} />
      {label}
    </label>
  );
  const EqChip = ({ on, label, onClick, highlight }) => (
    <label style={chipBase(!!on, highlight)}>
      <input type="checkbox" checked={!!on} onChange={onClick}
        style={{ accentColor: "#2E9E63", width: 15, height: 15, flexShrink: 0 }} />
      {label}
    </label>
  );

  const specialKeys = [...(rule.need || [])];
  if (rule.twoWhits) specialKeys.unshift("fire_w1", "fire_w2");

  const Section = ({ title, color, children }) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))", gap: 7, alignItems: "stretch" }}>{children}</div>
    </div>
  );
  // عنوان فرعي يمتد على كامل عرض الشبكة
  const Full = ({ children, style }) => (
    <div style={{ gridColumn: "1 / -1", ...style }}>{children}</div>
  );

  return (
    <div className="no-print" onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,18,25,0.55)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 14,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#F4F5F7", borderRadius: 18, width: "100%", maxWidth: 600,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        border: "2px solid " + colors.border, display: "flex", flexDirection: "column",
      }}>
        <div style={{
          position: "sticky", top: 0, background: colors.bg, borderBottom: "1px solid " + colors.border,
          padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", zIndex: 2,
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#141A28" }}>{name}</div>
            <div style={{ fontSize: 11.5, color: "#5A6172", fontWeight: 700 }}>{branch}</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 800, padding: "4px 12px", borderRadius: 14, background: colors.badge, color: "#fff" }}>{st.label}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#5A6172", padding: 4, fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 15 }}>
          {(specialKeys.length > 0 || rule.fireOnly) && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A5A0B", lineHeight: 1.7 }}>
              {rule.fireOnly
                ? "يكتفي بوايت واحد"
                : "متطلبات المركز: " + specialKeys.map((k) => SLOT_LABELS[k] || k).join("، ")}
            </div>
          )}

          <Section title="الإطفاء" color="#8F1C22">
            {FIRE_SLOTS.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
          </Section>
          <Section title="الإنقاذ" color="#1F4E8C">
            <Full style={{ fontSize: 10.5, fontWeight: 800, color: "#1E6B44" }}>انقاذ أساسي:</Full>
            {(() => {
              // دمج عرضي في هذا المحرر فقط — البيانات والقواعد وبقية الصفحات كما هي
              const fordOn = !!(s.res_fordS || s.res_fordB);
              const dualOn = !!(s.res_rosen || s.res_merc);
              return (
                <>
                  <EqChip on={fordOn} label="انقاذ فورد"
                    onClick={() => onSetSlots(name, fordOn ? { res_fordS: false, res_fordB: false } : { res_fordS: true })} />
                  <EqChip on={dualOn} label="مزدوجة كومندر"
                    onClick={() => onSetSlots(name, dualOn ? { res_rosen: false, res_merc: false } : { res_rosen: true })} />
                </>
              );
            })()}
            <Full style={{ fontSize: 10.5, fontWeight: 800, color: "#C77F1A", marginTop: 3 }}>بدائل مؤقتة:</Full>
            {RESCUE_SLOTS.filter(([k]) => ["res_jeep", "res_rosenL", "res_fastJeep"].includes(k))
              .map(([k, l]) => <Chip key={k} k={k} label={l} />)}
          </Section>
          <Section title="القوارب" color="#0E7490">
            {(() => {
              const boats = s.boats || [];
              const okN = boats.filter((b) => b === "ok").length;
              const downN = boats.length - okN;
              const setCounts = (a, b) => onBoats(name, [...Array(Math.max(0, a)).fill("ok"), ...Array(Math.max(0, b)).fill("down")]);
              const Sm = ({ label, val, onMinus, onPlus, clr }) => (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, background: "#fff", border: "1.5px solid #C9CDD6", borderRadius: 10, padding: "0 8px", width: "100%", minHeight: 38, boxSizing: "border-box" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#3A4152" }}>{label}</span>
                  <button onClick={onMinus} disabled={val === 0} style={{
                    width: 22, height: 22, borderRadius: 6, border: "1px solid #C9CDD6", background: "#F4F5F7",
                    color: val === 0 ? "#C9CDD6" : "#3A4152", fontSize: 13, fontWeight: 800, cursor: val === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", lineHeight: 1, padding: 0,
                  }}>−</button>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: clr, minWidth: 16, textAlign: "center" }}>{val}</span>
                  <button onClick={onPlus} style={{
                    width: 22, height: 22, borderRadius: 6, border: "none", background: clr,
                    color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", lineHeight: 1, padding: 0,
                  }}>+</button>
                </span>
              );
              return (
                <>
                  <Sm label="🚤 جاهزة" val={okN} clr="#1E6B44"
                    onMinus={() => setCounts(okN - 1, downN)} onPlus={() => setCounts(okN + 1, downN)} />
                  <Sm label="متعطلة" val={downN} clr="#8F1C22"
                    onMinus={() => setCounts(okN, downN - 1)} onPlus={() => setCounts(okN, downN + 1)} />
                  {boats.length > 0 && (
                    <Full style={{ fontSize: 11, fontWeight: 700, color: "#8B93A3" }}>الإجمالي: {boats.length}</Full>
                  )}
                </>
              );
            })()}
          </Section>
          <Section title="آليات فنية أخرى" color="#5A6172">
            {SINGLE_SLOTS.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
            {extras.map(([k, l]) => <Chip key={k} k={k} label={l} />)}
          </Section>

          {/* المعدات النوعية مدمجة هنا: تعبئة المركز كاملة من مكان واحد */}
          <div style={{ borderTop: "1.5px dashed #C9CDD6", paddingTop: 13 }}>
            <Section title="المعدات والأدوات النوعية بالمركز" color="#7A3E9D">
              <EqChip on={ring} label="آلة قص الخواتم" onClick={() => onEquip("ringCutter", name)} />
              <EqChip on={elev} label="مفتاح المصاعد العادي" onClick={() => onEquip("elevatorKey", name)} />
              <EqChip on={elevE} label="مفتاح المصاعد الإلكتروني" onClick={() => onEquip("elevatorKeyE", name)} />
              {isStrap && <EqChip on={strap} highlight={!strap} label="حزام الانتشال والانقاذ للحيوانات (خاص بهذا المركز)" onClick={() => onEquip("animalStrap", name)} />}
            </Section>
            <div style={{ marginTop: 11 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                <EqChip on={dd.has} label="توجد مزدوجة بالمركز" onClick={() => onEquip("duals", name, "has")} />
                {dd.has && (
                  <>
                    <EqChip on={dd.pump} highlight={!dd.pump} label="مضخة المزدوجة جاهزة" onClick={() => onEquip("duals", name, "pump")} />
                    <EqChip on={dd.qala} highlight={!dd.qala} label="القلع جاهز" onClick={() => onEquip("duals", name, "qala")} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* شريط التنقل التسلسلي للتعبئة اليومية المتدفقة */}
        <div style={{
          position: "sticky", bottom: 0, background: "#141A28", padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <button onClick={onPrev} style={{
            background: "rgba(255,255,255,0.13)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>▶ السابق</button>
          <span style={{ color: "#C9CCD4", fontSize: 12, fontWeight: 800 }}>{pos}</span>
          <button onClick={onNext} style={{
            background: "#9E1B22", color: "#fff", border: "none",
            borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>المركز التالي ◀</button>
        </div>
      </div>
    </div>
  );
}

function PriorityBoard({ centerReadiness, prio, weights, onPrio, onWeight }) {
  const [brF, setBrF] = useState("all");
  const rows = useMemo(() => buildCompass(centerReadiness, prio, weights), [centerReadiness, prio, weights]);
  const recs = useMemo(() => buildRecommendations(rows), [rows]);
  const totalRisk = rows.reduce((a, r) => a + r.risk, 0);
  const afterRisk = Math.max(0, totalRisk - recs.reduce((a, r) => a + r.impact, 0));
  const shown = rows.filter((r) => brF === "all" || r.branch === brF);
  const wSum = (weights.inc || 0) + (weights.den || 0) + (weights.fac || 0) || 1;
  const pct = (v) => Math.round(((v || 0) / wSum) * 100);

  const Stepper = ({ label, field }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 10, padding: "5px 9px" }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: "#3A4152" }}>{label}</span>
      <button onClick={() => onWeight(field, -5)} style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid #C9CDD6", background: "#EEF0F3", cursor: "pointer", fontWeight: 800, fontFamily: "inherit" }}>−</button>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#141A28", minWidth: 38, textAlign: "center" }}>{pct(weights[field])}%</span>
      <button onClick={() => onWeight(field, 5)} style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid #C9CDD6", background: "#EEF0F3", cursor: "pointer", fontWeight: 800, fontFamily: "inherit" }}>+</button>
    </div>
  );

  const CovChip = ({ ok, part, label }) => (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap",
      background: ok ? "#DCEFE4" : part ? "#F8E9CE" : "#F8DADC",
      color: ok ? "#1E6B44" : part ? "#C77F1A" : "#8F1C22",
      border: "1px solid " + (ok ? "#9FD8B7" : part ? "#EBCB90" : "#EFB2B6") }}>{label}</span>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <KPI label="مؤشر عجز التغطية العام" value={totalRisk} color={totalRisk > 0 ? "#C4353C" : "#2E9E63"} sub="مجموع (الأهمية × الفجوة) لكل المراكز" />
        <KPI label="مراكز حرجة بلا وايت" value={rows.filter((r) => r.whitCount === 0 && r.imp >= 50).length} color="#8F1C22" sub="أهمية ≥ 50 — الوايت لا بديل له" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#5A6172" }}>أوزان معايير الأهمية:</span>
        <Stepper label="الحوادث" field="inc" />
        <Stepper label="الكثافة السكانية" field="den" />
        <Stepper label="طبيعة المنشآت" field="fac" />
        <select value={brF} onChange={(e) => setBrF(e.target.value)} style={{ marginRight: "auto", border: "1.5px solid #C9CDD6", borderRadius: 10, padding: "7px 10px", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", background: "#F4F5F7", cursor: "pointer" }}>
          <option value="all">كل الشعب</option>
          {MANUAL_CENTERS.map(({ branch }) => <option key={branch} value={branch}>{branch}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: "#5A6172", fontWeight: 700, background: "#EEF0F3", border: "1px solid #D9DCE2", borderRadius: 10, padding: "8px 13px", marginBottom: 14, lineHeight: 1.9 }}>
        المعادلة الشفافة: <b>الأهمية</b> = الحوادث (نسبةً لأعلى مركز) + الكثافة + المنشآت بأوزانك أعلاه · <b>العجز</b> = الأهمية × الفجوة (الوايت 60% ولا بديل له، الإنقاذ 40% وبدائله — جيب التدخل السريع وحريق روزنباور الخفيف والجيب الخفيف — تغطي 65%). عبّئ حوادث كل مركز في جدوله أدناه متى توفرت لديك، والترتيب يتحدث لحظياً. التغطية تُقرأ تلقائياً من تعبئتك اليومية.
      </div>

      {/* جدول المراكز مرتباً بالخطر */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {shown.map((r) => {
          const tier = TIER_STYLE[importanceTier(r.imp)];
          return (
            <div key={r.name} style={{ background: "#F4F5F7", border: "1.5px solid " + (r.risk >= 45 ? "#C4353C" : r.risk >= 20 ? "#E8A33D" : "#D9DCE2"), borderRadius: 11, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: tier.bg, color: tier.color, border: "1.5px solid " + tier.color, borderRadius: 10, padding: "2px 9px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{tier.label} {r.imp}</span>
              <div style={{ flex: "1 1 175px", minWidth: 150 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#141A28" }}>{r.name}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#8B93A3" }}>{r.branch}</div>
              </div>
              <label style={{ fontSize: 10.5, fontWeight: 800, color: "#5A6172", display: "flex", alignItems: "center", gap: 4 }}>
                الحوادث
                <input type="number" min="0" value={r.inc} onChange={(e) => onPrio(r.name, "inc", Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: 58, border: "1.5px solid #C9CDD6", borderRadius: 8, padding: "4px 6px", fontSize: 12, fontWeight: 800, fontFamily: "inherit", textAlign: "center" }} />
              </label>
              <select value={r.den} onChange={(e) => onPrio(r.name, "den", parseInt(e.target.value))} title="الكثافة السكانية"
                style={{ border: "1.5px solid #C9CDD6", borderRadius: 8, padding: "4px 6px", fontSize: 10.5, fontWeight: 800, fontFamily: "inherit", background: "#fff" }}>
                {DENSITY_OPTS.map(([v, l]) => <option key={v} value={v}>كثافة: {l}</option>)}
              </select>
              <select value={r.fac} onChange={(e) => onPrio(r.name, "fac", parseInt(e.target.value))} title="طبيعة المنشآت"
                style={{ border: "1.5px solid #C9CDD6", borderRadius: 8, padding: "4px 6px", fontSize: 10.5, fontWeight: 800, fontFamily: "inherit", background: "#fff" }}>
                {FACILITY_OPTS.map(([v, l]) => <option key={v} value={v}>منشآت: {l}</option>)}
              </select>
              <div style={{ display: "flex", gap: 5 }}>
                <CovChip ok={r.whitCount > 0} label={"وايت " + (r.whitCount > 0 ? "✓" + (r.whitCount > 1 ? "×" + r.whitCount : "") : "✗")} />
                <CovChip ok={r.rescueFull > 0} part={r.rescueFull === 0 && r.rescueSub > 0} label={"إنقاذ " + (r.rescueFull > 0 ? "✓" : r.rescueSub > 0 ? "بديل" : "✗")} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "1 1 120px", minWidth: 110 }}>
                <div style={{ background: "#E3E5E9", borderRadius: 6, height: 9, flex: 1 }}>
                  <div style={{ width: Math.min(100, r.risk) + "%", background: r.risk >= 45 ? "#C4353C" : r.risk >= 20 ? "#E8A33D" : "#2E9E63", height: "100%", borderRadius: 6 }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: r.risk >= 45 ? "#C4353C" : r.risk >= 20 ? "#C77F1A" : "#2E9E63", width: 30, textAlign: "left" }}>{r.risk}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ReadinessPage({ vehicles, centerReadiness, onToggle, onBoats, onSetSlots, ro, supportCounts, onSupportChange, equip, onEquip, prio, prioWeights, onPrio, onPrioWeight, onOpenReport }) {
  const [mode, setMode] = useState("centers");
  const [expanded, setExpanded] = useState({});
  const [openBranches, setOpenBranches] = useState({}); // شعب اللوحة اليدوية المفتوحة
  const [lvFilter, setLvFilter] = useState("all"); // فلتر مستوى الجاهزية
  const [brFilter, setBrFilter] = useState("all"); // فلتر الشعبة
  const [editing, setEditing] = useState(null); // المركز المفتوح في المحرر

  const data = useMemo(() => {
    const stats = (list) => {
      const total = list.length;
      const ready = list.filter((v) => READY_STATUSES.includes(v.status)).length;
      const broken = list.filter((v) => v.status === "عطلانة").length;
      return { total, ready, broken, pct: total ? Math.round((ready / total) * 100) : 0 };
    };
    const rows = FIELD_ENTITIES.map((name) => {
      const list = vehicles.filter((v) => unifyUnit(v.unit) === name);
      const centersMap = {};
      list.forEach((v) => {
        const u = v.unit || "غير محدد";
        (centersMap[u] = centersMap[u] || []).push(v);
      });
      const centers = Object.entries(centersMap)
        .map(([cname, clist]) => ({ name: cname, ...stats(clist) }))
        .sort((a, b) => b.pct - a.pct);
      return { name, ...stats(list), centers };
    }).filter((r) => r.total > 0).sort((a, b) => b.pct - a.pct);
    const allField = vehicles.filter((v) => FIELD_ENTITIES.includes(unifyUnit(v.unit)));
    return { rows, overall: stats(allField) };
  }, [vehicles]);

  // مراكز كل شعبة بالمسميات الرسمية المعتمدة (الشعبة عنوان فقط — الإدخال للمراكز)
  const branchCenters = MANUAL_CENTERS;

  const levelCounts = useMemo(() => {
    let red = 0, yellow = 0, green = 0, total = 0;
    branchCenters.forEach(({ centers }) => centers.forEach((c) => {
      total++;
      const lv = fullCenterStatus(c, centerReadiness[c], equip).level;
      if (lv === "red") red++; else if (lv === "yellow") yellow++; else green++;
    }));
    return { red, yellow, green, total };
  }, [branchCenters, centerReadiness, equip]);

  // تغطية الشعب بالمعدات النوعية (قص الخواتم ومفتاح المصاعد)
  const coverage = useMemo(() => {
    const ring = equip.ringCutter || {}, elev = equip.elevatorKey || {}, elevE = equip.elevatorKeyE || {};
    return {
      ring: MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => ring[c])).length,
      elev: MANUAL_CENTERS.filter(({ centers }) => centers.some((c) => elev[c])).length,
    };
  }, [equip]);

  // القائمة الموحدة للمراكز حسب الفلاتر — تُستخدم للشبكة وللتنقل التسلسلي معاً
  const centerList = useMemo(() =>
    MANUAL_CENTERS.flatMap(({ branch, centers }) => centers.map((c) => ({ branch, name: c })))
      .filter(({ branch }) => brFilter === "all" || branch === brFilter)
      .map((x) => ({ ...x, st: fullCenterStatus(x.name, centerReadiness[x.name], equip) }))
      .filter(({ st }) => lvFilter === "all" || st.level === lvFilter),
  [brFilter, lvFilter, centerReadiness, equip]);

  const Bar = ({ pct }) => (
    <div style={{ background: "#E3E5E9", borderRadius: 6, height: 10, flex: 1, minWidth: 80 }}>
      <div style={{ width: pct + "%", background: readinessColor(pct), height: "100%", borderRadius: 6, transition: "width .4s" }} />
    </div>
  );

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setMode(id)} style={{
      background: mode === id ? "#9E1B22" : "#F4F5F7", color: mode === id ? "#fff" : "#3A4152",
      border: mode === id ? "none" : "1.5px solid #C9CDD6", borderRadius: 10, padding: "9px 20px",
      fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <TabBtn id="centers" label="📋 التكميل اليومي" />
        <TabBtn id="branches" label="🗺️ جاهزية الشعب" />
        <TabBtn id="support" label="🛠️ الدعم والإسناد" />
        <TabBtn id="priority" label="🎯 التغطية الميدانية" />
        {onOpenReport && (
          <button onClick={onOpenReport} style={{
            marginRight: "auto", background: "#141A28", color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 3px 10px rgba(20,26,40,0.35)",
          }}>🖨️ تقرير الجاهزية</button>
        )}
      </div>

      {mode === "branches" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <KPI label="آليات المراكز الميدانية" value={data.overall.total} color="#141A28" />
            <KPI label="الجاهزة للعمل" value={data.overall.ready} color="#2E9E63"
              sub={data.overall.pct + "% جاهزية ميدانية عامة"} />
            <KPI label="عطلانة" value={data.overall.broken} color="#C4353C" />
            <KPI label="عدد الشعب والمراكز" value={data.rows.length} color="#1F4E8C" />
          </div>
          <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ background: "#141A28", color: "#fff", padding: "12px 18px", fontSize: 15, fontWeight: 800, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>جاهزية المراكز الميدانية</span>
              <span style={{ fontSize: 12.5, color: "#C9CCD4", fontWeight: 700 }}>الجاهزية = تعمل + تم الإصلاح + تعمل بوجود ملاحظات · اضغط أي شعبة لتفصيل مراكزها</span>
            </div>
            {data.rows.map((r) => (
              <div key={r.name} style={{ borderBottom: "1px solid #E6E8EC" }}>
                <div onClick={() => setExpanded((p) => ({ ...p, [r.name]: !p[r.name] }))}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", cursor: "pointer", flexWrap: "wrap", background: expanded[r.name] ? "#EEF0F3" : "transparent" }}>
                  <span style={{ fontSize: 11, color: "#8B93A3", width: 12 }}>{expanded[r.name] ? "▼" : "◀"}</span>
                  <span style={{ fontWeight: 800, fontSize: 14.5, flex: "1 1 170px" }}>{r.name}</span>
                  <span style={{ fontSize: 12.5, color: "#5A6172", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {r.ready} جاهزة من {r.total}
                    {r.broken > 0 && <span style={{ color: "#8F1C22" }}> · {r.broken} عطلانة</span>}
                  </span>
                  <Bar pct={r.pct} />
                  <span style={{ fontWeight: 800, fontSize: 15, color: readinessColor(r.pct), width: 48, textAlign: "left" }}>{r.pct}%</span>
                </div>
                {expanded[r.name] && (
                  <div style={{ padding: "4px 40px 14px 18px", background: "#EEF0F3" }}>
                    {r.centers.map((c) => (
                      <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px dashed #D9DCE2", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#3A4152", flex: "1 1 220px" }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: "#5A6172", fontWeight: 700, whiteSpace: "nowrap" }}>{c.ready}/{c.total}</span>
                        <Bar pct={c.pct} />
                        <span style={{ fontWeight: 800, fontSize: 13, color: readinessColor(c.pct), width: 42, textAlign: "left" }}>{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "priority" && (
        <PriorityBoard centerReadiness={centerReadiness} prio={prio} weights={prioWeights}
          onPrio={onPrio} onWeight={onPrioWeight} />
      )}

      {mode === "support" && (
        <SupportBoard counts={supportCounts} onChange={onSupportChange} />
      )}

      {mode === "centers" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <KPI label="إجمالي المراكز" value={levelCounts.total} color="#141A28" />
            <KPI label="جاهزية مكتملة (أخضر)" value={levelCounts.green} color="#2E9E63" />
            <KPI label="نقص متطلبات المركز (أصفر)" value={levelCounts.yellow} color="#C77F1A" />
            <KPI label="عجز كامل" value={levelCounts.red} color="#C4353C"
              sub={levelCounts.total ? Math.round((levelCounts.red / levelCounts.total) * 100) + "% من المراكز" : ""} />
            <KPI label="شعب مغطاة بقص الخواتم" value={coverage.ring + " / " + MANUAL_CENTERS.length}
              color={coverage.ring === MANUAL_CENTERS.length ? "#2E9E63" : "#C77F1A"} />
            <KPI label="شعب مغطاة بالمفتاح العادي" value={coverage.elev + " / " + MANUAL_CENTERS.length}
              color={coverage.elev === MANUAL_CENTERS.length ? "#2E9E63" : "#C77F1A"} />
          </div>

          {/* شريط الفلاتر الذكي */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            {[["all", "الكل", levelCounts.total, "#141A28"],
              ["red", "🔴 الحمراء", levelCounts.red, "#C4353C"],
              ["yellow", "🟡 الصفراء", levelCounts.yellow, "#C77F1A"],
              ["green", "🟢 المكتملة", levelCounts.green, "#2E9E63"]].map(([id, lbl, n, clr]) => (
              <button key={id} onClick={() => setLvFilter(id)} style={{
                background: lvFilter === id ? clr : "#F4F5F7", color: lvFilter === id ? "#fff" : "#3A4152",
                border: "1.5px solid " + (lvFilter === id ? clr : "#C9CDD6"), borderRadius: 18,
                padding: "6px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>{lbl} ({n})</button>
            ))}
            <select value={brFilter} onChange={(e) => setBrFilter(e.target.value)} style={{
              marginRight: "auto", border: "1.5px solid #C9CDD6", borderRadius: 10, padding: "7px 10px",
              fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", background: "#F4F5F7", color: "#141A28", cursor: "pointer",
            }}>
              <option value="all">كل الشعب</option>
              {MANUAL_CENTERS.map(({ branch }) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 12, color: "#5A6172", fontWeight: 700, background: "#EEF0F3", border: "1px solid #D9DCE2", borderRadius: 10, padding: "8px 13px", marginBottom: 14 }}>
            كل مركز يُعبأ كاملاً من مكان واحد: اضغط بطاقته يفتح محرره الشامل (الأساس + المعدات النوعية + المزدوجة)، وتنقّل بزر "المركز التالي" لتعبئة الجولة اليومية بتدفق دون إغلاق. الألوان لحظية وشاملة، والفلاتر أعلاه تريك أين الخلل مباشرة.
          </div>

          {/* شبكة بطاقات المراكز المدمجة */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))", gap: 9 }}>
            {centerList.map(({ branch, name: c, st }) => {
              const colors = LEVEL_COLORS[st.level];
              const ring = (equip.ringCutter || {})[c], elev = (equip.elevatorKey || {})[c], elevE = (equip.elevatorKeyE || {})[c];
              const dd = (equip.duals || {})[c] || {};
              const strapC = ANIMAL_STRAP_CENTERS.includes(c);
              const strapOn = (equip.animalStrap || {})[c];
              const boats = (centerReadiness[c] || {}).boats || [];
              const boatsOk = boats.filter((b) => b === "ok").length;
              const Mini = ({ txt, ok }) => (
                <span style={{ fontSize: 9, fontWeight: 800, padding: "1.5px 7px", borderRadius: 9,
                  background: ok ? "#DCEFE4" : "#F8E9CE", color: ok ? "#1E6B44" : "#C77F1A",
                  border: "1px solid " + (ok ? "#9FD8B7" : "#EBCB90") }}>{txt}</span>
              );
              return (
                <div key={c} onClick={() => setEditing({ name: c, branch })} style={{
                  background: colors.bg, border: "2px solid " + colors.border, borderRadius: 11,
                  padding: "9px 11px", cursor: "pointer", userSelect: "none",
                  display: "flex", flexDirection: "column", gap: 5, minHeight: 78,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#141A28", lineHeight: 1.35 }}>{c}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#8B93A3" }}>{branch}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: colors.badge, marginTop: "auto", lineHeight: 1.5 }}>{st.label}</div>
                  {(ring || elev || elevE || dd.has || strapC || boats.length > 0) && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {boats.length > 0 && <Mini txt={"🚤 " + boatsOk + "/" + boats.length + " جاهز"} ok={boatsOk === boats.length} />}
                      {ring && <Mini txt="قص الخواتم ✓" ok />}
                      {elev && <Mini txt="مصاعد عادي ✓" ok />}
                      {elevE && <Mini txt="مصاعد إلكتروني ✓" ok />}
                      {dd.has && <Mini txt={"مزدوجة " + (dd.pump && dd.qala ? "✓" : "⚠")} ok={dd.pump && dd.qala} />}
                      {strapC && <Mini txt={"حزام الحيوانات " + (strapOn ? "✓" : "⚠")} ok={!!strapOn} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editing && (() => {
            const idx = centerList.findIndex((x) => x.name === editing.name);
            const n = centerList.length;
            const go = (dir) => {
              if (n === 0) { setEditing(null); return; }
              const cur = idx >= 0 ? idx : 0;
              const nx = ((cur + dir) % n + n) % n;
              setEditing({ name: centerList[nx].name, branch: centerList[nx].branch });
            };
            return (
              <CenterEditor name={editing.name} branch={editing.branch}
                state={centerReadiness[editing.name]} onToggle={onToggle} onBoats={onBoats} onSetSlots={onSetSlots}
                equip={equip} onEquip={onEquip}
                onPrev={() => go(-1)} onNext={() => go(1)}
                pos={(idx >= 0 ? idx + 1 : "–") + " / " + n}
                onClose={() => setEditing(null)} />
            );
          })()}
        </>
      )}
    </div>
  );
}

// ====== التطبيق الرئيسي ======
export default function FleetApp() {
  const [db, setDb] = useState(null);
  const [logo, setLogo] = useState(null);
  const [view, setView] = useState("readiness");
  const [reportsInit, setReportsInit] = useState("vehicles");
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState([]);
  const [fType, setFType] = useState([]);
  const [fBranch, setFBranch] = useState([]);
  const [fUnit, setFUnit] = useState([]);
  const [fModel, setFModel] = useState([]);

  useEffect(() => {
    (async () => {
      setDb(await loadDB());
      try { const r = await window.storage.get(LOGO_KEY); if (r) setLogo(r.value); } catch {}
    })();
  }, []);

  // ====== سجل التراجع: كل تعديل على البيانات الأساسية قابل للتراجع ======
  const undoStack = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  // ====== الدور: محرر (بكلمة سر) أو مستعرض فقط ======
  const [role, setRole] = useState(getStoredRole);
  const ro = role === "viewer";
  const isOwner = role === "owner";
  const roRef = useRef(ro);
  useEffect(() => { roRef.current = ro; }, [ro]);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwVal, setPwVal] = useState("");
  const [pwErr, setPwErr] = useState("");
  const loginEditor = () => { setPwVal(""); setPwErr(""); setPwOpen(true); };
  const submitPw = () => {
    const p = pwVal;
    const h = pwHash(p);
    if (h === OWNER_HASH) {
      try { window.localStorage.setItem(ROLE_KEY, OWNER_HASH); } catch {}
      setRole("owner"); setPwOpen(false);
      setImportMsg("👑 تم الدخول كمشرف");
      setTimeout(() => setImportMsg(""), 4500);
    } else if (h === PW_HASH) {
      try { window.localStorage.setItem(ROLE_KEY, PW_HASH); } catch {}
      setRole("editor"); setPwOpen(false);
      setImportMsg("✏️ تم الدخول كمحرر جاهزية");
      setTimeout(() => setImportMsg(""), 4500);
    } else {
      setPwErr("كلمة السر غير صحيحة — حاول مجدداً");
    }
  };
  const logoutEditor = () => {
    try { window.localStorage.removeItem(ROLE_KEY); } catch {}
    setRole("viewer");
  };

  // ====== المزامنة عبر GitHub: استطلاع خفيف كل 5 ثوانٍ + دفع مباشر ======
  const [cloud, setCloud] = useState("init"); // init | on | off | nodata | notoken
  const [syncStamp, setSyncStamp] = useState("");
  const stampNow = (label) => {
    const t = new Date();
    setSyncStamp(label + " " + String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0") + ":" + String(t.getSeconds()).padStart(2, "0"));
  };
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);
  useEffect(() => { const md = migrateDb(db); if (md !== db) { setDb(md); saveDB(md); } }, []);
  const shaDataRef = useRef(undefined); // undefined = لم يُجلب بعد
  const shaVerRef = useRef(undefined);
  const lastRevRef = useRef(null);
  const lastPushedRevRef = useRef(null);
  const pollSt = useRef({});
  const pushPendingRef = useRef(false);
  const tokenRef = useRef("");
  const cfgRef = useRef(null);
  const pushTimer = useRef(null);
  const retryRef = useRef(null);

  const tryDecryptToken = (cfg, roleNow) => {
    if (!cfg) return "";
    const h = roleNow === "owner" ? OWNER_HASH : roleNow === "editor" ? PW_HASH : "";
    if (!h) return "";
    const enc = roleNow === "owner" ? (cfg.tokO || cfg.tokA) : (cfg.tokA || "");
    const t = enc ? xorUnhex(enc, h) : "";
    return t && t.indexOf("gh") === 0 ? t : (t && t.length > 20 ? t : "");
  };

  const applyRemote = (text) => {
    try {
      const parsed = JSON.parse(text);
      const remoteDb = migrateDb(parsed.db || parsed);
      cfgRef.current = parsed.cfg || null;
      if (!tokenRef.current) tokenRef.current = tryDecryptToken(cfgRef.current, roleRef.current);
      setDb(remoteDb); saveDB(remoteDb);
      stampNow("⬇ آخر استلام");
    } catch {}
  };

  useEffect(() => {
    let alive = true;
    const loop = async () => {
      if (!alive) return;
      try {
        if (typeof fetch !== "function") { setCloud("off"); return; }
        const res = await readVer(tokenRef.current, pollSt.current);
        if (!alive) return;
        if (res.missing) { setCloud("nodata"); }
        else if (res.unchanged) { setCloud("on"); }
        else {
          const v = res.ver || {};
          const newer = parseInt(v.rev) > (parseInt(lastRevRef.current) || 0);
          if (v.rev && newer && v.by !== _cid && !pushPendingRef.current) {
            const text = await readData(tokenRef.current, v.rev);
            if (!alive) return;
            try {
              const parsed = JSON.parse(text);
              // لا نطبق إلا نسخة بنفس المؤشر أو أحدث (يصد النسخ المخبأة القديمة)
              if (parseInt(parsed.rev) >= parseInt(v.rev) || parseInt(parsed.rev) > (parseInt(lastRevRef.current) || 0)) {
                lastRevRef.current = parsed.rev || v.rev;
                applyRemote(text);
              }
            } catch {}
          } else if (v.rev && newer && v.by === _cid) {
            lastRevRef.current = v.rev; // صدى بثنا
          }
          setCloud("on");
        }
      } catch (e) { if (alive) setCloud("off"); }
      if (alive) setTimeout(loop, 5000);
    };
    loop();
    return () => { alive = false; };
  }, []);

  // حين يسجل المستخدم دخوله لاحقاً نفك الرمز من الإعدادات المستلمة
  useEffect(() => {
    if (!tokenRef.current && cfgRef.current && role !== "viewer") {
      tokenRef.current = tryDecryptToken(cfgRef.current, role);
    }
  }, [role]);

  const doPush = async (nextDb) => {
    const tok = tokenRef.current;
    if (!tok) { setCloud("notoken"); throw new Error("no-token"); }
    pushPendingRef.current = true;
    const rev = Date.now() + "-" + _cid;
    const payload = JSON.stringify({ cfg: cfgRef.current || {}, db: nextDb, rev, meta: { by: _cid, at: Date.now() } });
    if (shaDataRef.current === undefined) shaDataRef.current = await ghGetSha(tok, GH.path);
    if (shaVerRef.current === undefined) shaVerRef.current = await ghGetSha(tok, VER_PATH);
    shaDataRef.current = await ghPutFile(tok, GH.path, payload, shaDataRef.current, "تحديث بيانات السجل");
    shaVerRef.current = await ghPutFile(tok, VER_PATH, JSON.stringify({ rev, by: _cid, at: Date.now() }), shaVerRef.current, "مؤشر التحديث " + rev);
    lastPushedRevRef.current = rev;
    lastRevRef.current = rev;
    pushPendingRef.current = false;
    setCloud("on");
    stampNow("⬆ آخر بث");
  };

  const queueCloud = (next) => {
    if (roRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try { await doPush(next); }
      catch (e) {
        pushPendingRef.current = false;
        const m = String(e && e.message || "");
        if (m === "gh-conflict") {
          // نسخة سبقتنا: نحدّث بصمات الملفات ونعيد الدفع (آخر كتابة تفوز)
          try {
            shaDataRef.current = await ghGetSha(tokenRef.current, GH.path);
            shaVerRef.current = await ghGetSha(tokenRef.current, VER_PATH);
            await doPush(dbRef.current);
            return;
          } catch {}
        }
        if (m === "gh-auth") {
          setImportMsg("⛔ رمز ربط GitHub مرفوض أو منتهي — المشرف يعيد الربط من 🔑");
          setTimeout(() => setImportMsg(""), 8000);
        } else if (m === "no-token") {
          setImportMsg("🔑 لم يُربط GitHub بعد — يضيفه المشرف");
          setTimeout(() => setImportMsg(""), 7000);
        }
        setCloud(m === "no-token" ? "notoken" : "off");
        clearTimeout(retryRef.current);
        if (m !== "no-token" && m !== "gh-auth") retryRef.current = setTimeout(() => queueCloud(dbRef.current), 8000);
      }
    }, 1200);
  };

  // ربط GitHub (المشرف): لصق الرمز مرة واحدة
  const [ghOpen, setGhOpen] = useState(false);
  const [ghVal, setGhVal] = useState("");
  const [ghErr, setGhErr] = useState("");
  const [ghBusy, setGhBusy] = useState(false);
  const submitGh = async () => {
    const tok = ghVal.trim();
    if (tok.length < 20) { setGhErr("الرمز قصير — انسخه كاملاً من GitHub"); return; }
    setGhBusy(true); setGhErr("");
    try {
      // تحقق فعلي: طلب معلومات المستودع بالرمز
      const r = await fetch("https://api.github.com/repos/" + GH.owner + "/" + GH.repo, {
        headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + tok },
      });
      if (r.status === 401 || r.status === 403) throw new Error("auth");
      if (!r.ok) throw new Error("repo");
      tokenRef.current = tok;
      cfgRef.current = { tokA: xorHex(tok, PW_HASH), tokO: xorHex(tok, OWNER_HASH) };
      // جلب بصمات الملفات إن وُجدت ثم دفع كامل
      shaDataRef.current = await ghGetSha(tok, GH.path);
      shaVerRef.current = await ghGetSha(tok, VER_PATH);
      await doPush(dbRef.current);
      setGhOpen(false);
      setImportMsg("✅ اكتمل الربط ورُفعت البيانات");
      setTimeout(() => setImportMsg(""), 6000);
    } catch (e) {
      setGhErr(String(e.message).includes("auth") ? "الرمز مرفوض — تأكد من صلاحياته على هذا المستودع" : "تعذر التحقق — تأكد من الإنترنت والرمز");
    }
    setGhBusy(false);
  };

  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);

  // إخفاء عنوان المستند من رؤوس صفحات الطباعة
  useEffect(() => {
    let saved = "";
    const before = () => { saved = document.title; document.title = " "; };
    const after = () => { document.title = saved || "سجل متابعة الآليات"; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  // تنزيل index.html بأحدث البيانات الحية — للمشرف
  const downloadIndex = () => {
    if (ro) {
      setImportMsg("🔒 تحميل index غير متاح بوضع الاستعراض — صلاحية المشرف");
      setTimeout(() => setImportMsg(""), 5000);
      return;
    }
    if (!db) return;
    try {
      const html = buildSiteHTML(db);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "index.html";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      setImportMsg("⬇ نُزّل ملف index");
      setTimeout(() => setImportMsg(""), 5000);
    } catch (e) { console.error(e); }
  };

  const persist = (next, label = "تعديل") => {
    if (roRef.current) {
      setImportMsg("👁 وضع الاستعراض — التعديل للمحررين");
      setTimeout(() => setImportMsg(""), 4000);
      return;
    }
    // تعديل سجل الآليات (إضافة/تحرير/استيراد/أعطال) صلاحية المشرف وحده
    if (next.vehicles !== db.vehicles && roleRef.current !== "owner") {
      setImportMsg("🔒 سجل الآليات صلاحية المشرف");
      setTimeout(() => setImportMsg(""), 4500);
      return;
    }
    undoStack.current.push({ db, label });
    if (undoStack.current.length > 30) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
    setDb(next); saveDB(next);
    queueCloud(next);
  };
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setUndoCount(undoStack.current.length);
    setDb(prev.db); saveDB(prev.db);
    setImportMsg("↩ تم التراجع عن: " + prev.label);
    setTimeout(() => setImportMsg(""), 4000);
  };
  const vehicles = db?.vehicles || [];

  const vehGuard = () => {
    if (isOwner) return true;
    setImportMsg("🔒 بيانات الآليات وأعطالها استعراض فقط لهذه الصلاحية — التعديل عليها للمشرف وحده");
    setTimeout(() => setImportMsg(""), 6000);
    return false;
  };
  const updateVehicle = (nv) => { if (!vehGuard()) return; persist({ ...db, vehicles: vehicles.map((x) => (x.id === nv.id ? nv : x)) }, "تعديل بيانات آلية " + (nv.plate || "")); };
  const deleteVehicle = (id) => { if (!vehGuard()) return; const dv = vehicles.find((x) => x.id === id); persist({ ...db, vehicles: vehicles.filter((x) => x.id !== id) }, "حذف آلية " + (dv?.plate || "")); setView("list"); setSelectedId(null); };
  const addVehicle = (v) => { if (!vehGuard()) return; persist({ ...db, vehicles: [...vehicles, v] }, "إضافة آلية " + (v.plate || "")); setAdding(false); setView("list"); };

  const uploadLogo = async (dataUrl) => {
    setLogo(dataUrl);
    try { await window.storage.set(LOGO_KEY, dataUrl); } catch (e) { console.error(e); }
  };

  const allTypes = useMemo(() => [...new Set(vehicles.map((v) => v.type).filter(Boolean))].sort(), [vehicles]);
  const allUnits = useMemo(() => [...new Set(vehicles.map((v) => v.unit).filter(Boolean))].sort(), [vehicles]);
  const allBranches = useMemo(() => [...new Set(vehicles.map((v) => unifyUnit(v.unit)))].sort((a, b) => a.localeCompare(b, "ar")), [vehicles]);
  const allModels = useMemo(() => [...new Set(vehicles.map((v) => v.model).filter(Boolean))].sort(), [vehicles]);

  const filtered = useMemo(() => {
    // تحويل الأرقام العربية إلى إنجليزية لتوحيد البحث
    const qNorm = q.trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const qDigits = qNorm.replace(/\s+/g, "");
    // إذا كان المدخل أرقاماً فقط: البحث حصراً في أرقام اللوحات
    const numericOnly = qDigits.length > 0 && /^\d+$/.test(qDigits);
    return vehicles.filter((v) => {
      if (qNorm) {
        if (numericOnly) {
          const plateDigits = (v.plate || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D+/g, "");
          if (!plateDigits.includes(qDigits)) return false;
        } else {
          const text = [v.type, v.plate, v.unit, v.itemNo, v.chassis, v.color, v.model, v.location, v.notes].join(" ").toLowerCase();
          if (!text.includes(qNorm.toLowerCase())) return false;
        }
      }
      if (fStatus.length && !fStatus.includes(v.status)) return false;
      if (fType.length && !fType.includes(v.type)) return false;
      if (fBranch.length && !fBranch.includes(unifyUnit(v.unit))) return false;
      if (fUnit.length && !fUnit.includes(v.unit)) return false;
      if (fModel.length && !fModel.includes(v.model)) return false;
      return true;
    });
  }, [vehicles, q, fStatus, fType, fBranch, fUnit, fModel]);

  const counts = useMemo(() => {
    const c = { total: vehicles.length };
    STATUSES.forEach((s) => (c[s] = vehicles.filter((v) => v.status === s).length));
    return c;
  }, [vehicles]);

  const byType = useMemo(() => {
    const m = {};
    vehicles.forEach((v) => { if (v.type) m[v.type] = (m[v.type] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [vehicles]);

  const byUnit = useMemo(() => {
    const m = {};
    vehicles.forEach((v) => { const u = unifyUnit(v.unit); m[u] = (m[u] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [vehicles]);

  const faultStats = useMemo(() => {
    const flat = [];
    vehicles.forEach((v) => (v.faults || []).forEach((f) => {
      const mNum = parseInt((f.date || "").split("/")[1]);
      flat.push({
        vtype: v.type || "غير محدد",
        unit: unifyUnit(v.unit),
        model: v.model || "غير محدد",
        ftype: f.faultType || "غير محدد",
        month: mNum ? HIJRI_MONTHS[mNum - 1] : null,
      });
    }));
    const tally = (key) => {
      const m = {};
      flat.forEach((x) => { if (x[key]) m[x[key]] = (m[x[key]] || 0) + 1; });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    // العطلانة حالياً لكل جهة (شاملة الجهات صفراً)
    const brokenNow = {};
    vehicles.forEach((v) => { const u = unifyUnit(v.unit); if (!(u in brokenNow)) brokenNow[u] = 0; });
    vehicles.forEach((v) => { if (v.status === "عطلانة") brokenNow[unifyUnit(v.unit)]++; });
    // أعطال آخر 12 شهراً هجرياً لكل جهة (المؤرخة فقط، شاملة الجهات صفراً)
    const th = todayHijri();
    const nowIdx = th.y * 12 + (th.m - 1);
    const last12 = {};
    vehicles.forEach((v) => { const u = unifyUnit(v.unit); if (!(u in last12)) last12[u] = 0; });
    vehicles.forEach((v) => (v.faults || []).forEach((f) => {
      const [fy, fm] = (f.date || "").split("/").map((x) => parseInt(x));
      if (!fy || !fm) return;
      const idx = fy * 12 + (fm - 1);
      if (idx <= nowIdx && idx > nowIdx - 12) last12[unifyUnit(v.unit)]++;
    }));
    const isField = (u) => FIELD_ENTITIES.includes(u);
    const desc = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    const ascField = (o) => Object.entries(o).filter(([u]) => isField(u)).sort((a, b) => a[1] - b[1]).slice(0, 5);
    return {
      total: flat.length,
      byVType: tally("vtype"), byUnit: tally("unit"), byFType: tally("ftype"),
      byMonth: tally("month"), byModel: tally("model"),
      brokenNowTop: desc(brokenNow).filter(([, n]) => n > 0).slice(0, 5),
      brokenNowLeastField: ascField(brokenNow),
      last12Top: desc(last12).filter(([, n]) => n > 0).slice(0, 5),
      last12LeastField: ascField(last12),
    };
  }, [vehicles]);

  const selected = vehicles.find((v) => v.id === selectedId);

  if (!db) return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#5A6172", fontSize: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>
      جارٍ تحميل قاعدة البيانات...
    </div>
  );

  const NavBtn = ({ id, label }) => (
    <button onClick={() => { setView(id); setSelectedId(null); setAdding(false); }} style={{
      background: view === id ? "rgba(255,255,255,0.16)" : "transparent", color: "#fff",
      border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 14.5, fontWeight: view === id ? 800 : 600,
      cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );

  return (
    <div dir="rtl" className="app-shell" style={{ fontFamily: "'Tajawal',sans-serif", background: "#E5E8EC", minHeight: "100vh", color: "#1B2130", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: #9E1B22 !important; }
        tr.row-hover:hover { background: #FBF7F7 !important; }
        /* القائمة الجانبية الثابتة أقصى اليمين */
        .app-shell { margin-right: 218px; }
        .side-rail { position: fixed; top: 0; right: 0; bottom: 0; width: 218px; z-index: 250;
          background: #14181F; display: flex; flex-direction: column; gap: 6px; padding: 14px 10px;
          border-left: 1px solid rgba(255,255,255,0.06); overflow-y: auto; }
        .side-rail .rail-title { color: #E8EAEF; font-size: 13.5px; font-weight: 800; padding: 4px 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 4px; }
        .side-rail button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: right;
          background: transparent; color: #C9CCD4; border: none; border-radius: 11px; padding: 11px 12px;
          font-size: 13.5px; font-weight: 800; cursor: pointer; font-family: inherit; }
        .side-rail button:hover { background: rgba(255,255,255,0.07); color: #fff; }
        .side-rail button.act { background: #9E1B22; color: #fff; box-shadow: 0 3px 12px rgba(158,27,34,0.45); }
        .side-rail .ric { font-size: 20px; line-height: 1; width: 26px; text-align: center; flex-shrink: 0; }
        @media (max-width: 760px) {
          .app-shell { margin-right: 62px; }
          .side-rail { width: 62px; padding: 12px 7px; }
          .side-rail .rail-title, .side-rail .rlb { display: none; }
          .side-rail button { justify-content: center; padding: 12px 0; }
        }
        @media print { .app-shell { margin-right: 0 !important; } .side-rail { display: none !important; } }
        /* تحسينات العرض على شاشات الهواتف */
        @media (max-width: 640px) {
          .app-main { padding: 14px 10px 46px !important; }
          .app-nav { width: 100%; overflow-x: auto; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; padding-bottom: 4px; scrollbar-width: none; }
          .app-nav::-webkit-scrollbar { display: none; }
          .app-nav button { white-space: nowrap; padding: 8px 12px !important; font-size: 13px !important; flex-shrink: 0; }
          .hdr-title { font-size: 15.5px !important; }
          .hdr-sub { font-size: 10.5px !important; }
          .hdr-logo { width: 56px !important; height: 46px !important; margin-right: 0 !important; }
          table { font-size: 12px !important; }
          #print-area { padding: 14px 10px !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          #print-area table { min-width: 620px; }
          h3 { font-size: 14.5px !important; }
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          .no-print, header { display: none !important; }
          body { background: #fff !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          #print-area { background: #fff !important; border: none !important; border-radius: 0 !important; padding: 0 !important; box-shadow: none !important; }
          #print-area table { page-break-inside: auto; }
          #print-area tr { page-break-inside: avoid; page-break-after: auto; }
          #print-area thead { display: table-header-group; }
          #print-area .sig-block { page-break-inside: avoid; }
          .draft-wm div { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <aside className="side-rail no-print" aria-label="التنقل">
        <div className="rail-title">جاهزية المراكز الميدانية</div>
        {[
          ["readiness", "📋", "الجاهزية الميدانية"],
          ["list", "🚒", "سجل الآليات"],
          ["dashboard", "📊", "لوحة المعلومات"],
          ["charts", "📈", "الداشبورد"],
          ["reports", "🖨️", "التقارير"],
        ].map(([id, ic, lbl]) => (
          <button key={id} className={view === id ? "act" : ""}
            onClick={() => { if (id === "reports") setReportsInit("vehicles"); setView(id); }}>
            <span className="ric">{ic}</span><span className="rlb">{lbl}</span>
          </button>
        ))}
        {(isOwner || ro) && typeof window !== "undefined" && window.__STANDALONE__ && (
          <button onClick={downloadIndex} style={{ marginTop: "auto", background: "rgba(31,111,184,0.25)", color: "#BBD9F2" }}>
            <span className="ric">⬇</span><span className="rlb">تحميل index</span>
          </button>
        )}
      </aside>

      <header className="no-print" style={{ background: `linear-gradient(270deg, #14181F 55%, rgba(20,24,31,0.52) 80%, rgba(20,24,31,0.16) 100%), url(${HEADER_BG}) left center / auto 115% no-repeat, #14181F`, padding: "12px 22px 0", color: "#fff", position: "relative" }}>
        {/* زر خفي: تنزيل index.html بأحدث بياناتك الحية لرفعه على GitHub */}
        
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* الصف الأول: الهوية يميناً وأزرار الإجراءات يساراً */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingBottom: 10 }}>
            <Logo logoSrc={logo} onUpload={uploadLogo} />
            <div style={{ flex: 1, minWidth: 210 }}>
              <div className="hdr-title" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>جاهزية المراكز الميدانية</div>
              <div className="hdr-sub" style={{ fontSize: 13, color: "#C9CCD4", marginTop: 2 }}>الإدارة العامة للدفاع المدني بمحافظة جدة — إدارة العمليات</div>
            </div>
            <div className="app-nav" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(isOwner || ro) && <ExcelImport vehicles={vehicles} onApply={(nv, mode, faultsAdded, pv) => {
                if (!vehGuard()) return;
                persist({ ...db, vehicles: nv }, mode === "replace" ? "الاستبدال الكامل من الإكسل" : "الدمج من الإكسل");
                setImportMsg(mode === "replace"
                  ? `تم الاستبدال الكامل: ${nv.length} آلية من الملف`
                  : `تم الدمج: تحديث ${pv.matched} وإضافة ${pv.added} آلية و${faultsAdded} عطل جديد`);
                setTimeout(() => setImportMsg(""), 6000);
              }} />}
              {(isOwner || ro) && <button onClick={() => { setView("list"); setAdding(true); setSelectedId(null); }} style={{
                background: "#9E1B22", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px",
                fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(158,27,34,0.45)",
              }}>+ إضافة آلية</button>}
            </div>
          </div>
          {/* الصف الثاني: الجاهزية أساس التنقل والبقية بالقائمة الجانبية */}
          <nav className="app-nav" style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.13)", paddingTop: 7, paddingBottom: 9, flexWrap: "wrap" }}>
            <span onClick={() => {
              const msg = cloud === "on" ? "🟢 متصل — المزامنة عبر GitHub تعمل (كل 5 ثوانٍ)" + (syncStamp ? " · " + syncStamp : "")
                : cloud === "off" ? "⚪ غير متصل — تعديلاتك محلية الآن وسيعاد البث تلقائياً عند عودة الاتصال"
                : cloud === "nodata" ? "🟡 المستودع بلا بيانات بعد — المشرف يربط GitHub من 🔑 فتُرفع تلقائياً"
                : cloud === "notoken" ? "🔑 لم يُربط GitHub — المشرف يضيف رمز الربط مرة واحدة"
                : "🟡 جارٍ فحص المستودع...";
              setImportMsg(msg); setTimeout(() => setImportMsg(""), 6000);
            }} title="اضغط لمعرفة حالة المزامنة"
              style={{ fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "0 10px", minHeight: 34 }}>
              {cloud === "on" ? "🟢" : cloud === "off" ? "⚪" : cloud === "notoken" ? "🔑" : "🟡"}
              {syncStamp && <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.75)" }}>{syncStamp}</span>}
            </span>
            {ro ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <button onClick={loginEditor} style={{
                background: "rgba(255,255,255,0.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.25)",
                borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>🔐 دخول المحررين</button>
              {typeof window !== "undefined" && window.__STANDALONE__ && (
                <button onClick={downloadIndex} title="صلاحية المشرف — معروض للاطلاع" style={{
                  background: "rgba(31,111,184,0.45)", color: "#fff", border: "none", borderRadius: 10,
                  padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                }}>⬇ تحميل index</button>
              )}
              <button onClick={() => { setImportMsg("🔒 ربط GitHub صلاحية المشرف — الاستعراض متاح للجميع"); setTimeout(() => setImportMsg(""), 5000); }} title="صلاحية المشرف — معروض للاطلاع" style={{
                background: "rgba(20,26,40,0.7)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10,
                padding: "8px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>🔑 ربط GitHub</button>
              </span>
            ) : (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#B9E8C9", fontSize: 12.5, fontWeight: 800, background: "rgba(46,158,99,0.25)", borderRadius: 10, padding: "8px 14px" }}>{isOwner ? "👑 المشرف" : "✏️ محرر جاهزية"}</span>
                <button onClick={logoutEditor} title="الخروج لوضع الاستعراض" style={{
                  background: "transparent", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 10, padding: "8px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                }}>خروج</button>
                {typeof window !== "undefined" && window.__STANDALONE__ && (isOwner || ro) && (
                  <button onClick={downloadIndex} title="تنزيل ملف index بأحدث بياناتك — لرفعه على GitHub" style={{
                    background: "#1F6FB8", color: "#fff", border: "none", borderRadius: 10,
                    padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 3px 10px rgba(31,111,184,0.45)",
                  }}>⬇ تحميل index</button>
                )}
                {(isOwner || ro) && (
                  <button onClick={() => { if (ro) { setImportMsg("🔒 ربط GitHub صلاحية المشرف — الاستعراض متاح للجميع"); setTimeout(() => setImportMsg(""), 5000); return; } setGhVal(""); setGhErr(""); setGhOpen(true); }} title="ربط GitHub لتفعيل المزامنة — مرة واحدة" style={{
                    background: "#141A28", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10,
                    padding: "8px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                  }}>🔑 ربط GitHub</button>
                )}
              </span>
            )}
          </nav>
        </div>
      </header>

      {pwOpen && (
        <div className="no-print" onClick={() => setPwOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#F4F5F7", borderRadius: 16, padding: "22px 20px", width: "100%", maxWidth: 360, boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#141A28", marginBottom: 4 }}>🔐 دخول المحررين</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6172", marginBottom: 14 }}>أدخل كلمة السر</div>
            <input type="password" value={pwVal} autoFocus inputMode="text"
              onChange={(e) => { setPwVal(e.target.value); setPwErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitPw(); }}
              placeholder="كلمة السر"
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 16, fontWeight: 800, borderRadius: 12, border: "1.5px solid " + (pwErr ? "#C4353C" : "#C9CDD6"), background: "#fff", fontFamily: "inherit", textAlign: "center", letterSpacing: 2 }} />
            {pwErr && <div style={{ color: "#C4353C", fontSize: 12, fontWeight: 800, marginTop: 8, textAlign: "center" }}>{pwErr}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={submitPw} style={{ flex: 1, background: "#9E1B22", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>دخول</button>
              <button onClick={() => setPwOpen(false)} style={{ background: "#E9EBEF", color: "#3A4152", border: "1px solid #C9CDD6", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {ghOpen && (
        <div className="no-print" onClick={() => !ghBusy && setGhOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#F4F5F7", borderRadius: 16, padding: "22px 20px", width: "100%", maxWidth: 430, boxShadow: "0 18px 50px rgba(0,0,0,0.45)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#141A28", marginBottom: 4 }}>🔑 ربط GitHub — مرة واحدة فقط</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6172", lineHeight: 1.9, marginBottom: 12 }}>
              الصق رمز الربط من GitHub:
            </div>
            <input value={ghVal} autoFocus dir="ltr"
              onChange={(e) => { setGhVal(e.target.value); setGhErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitGh(); }}
              placeholder="ghp_xxxxxxxxxxxxxxxx"
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 13.5, fontWeight: 700, borderRadius: 12, border: "1.5px solid " + (ghErr ? "#C4353C" : "#C9CDD6"), background: "#fff", fontFamily: "monospace" }} />
            {ghErr && <div style={{ color: "#C4353C", fontSize: 12, fontWeight: 800, marginTop: 8 }}>{ghErr}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={submitGh} disabled={ghBusy} style={{ flex: 1, background: ghBusy ? "#8B93A3" : "#1E6B44", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14.5, fontWeight: 800, cursor: ghBusy ? "wait" : "pointer", fontFamily: "inherit" }}>{ghBusy ? "جارٍ التحقق والرفع..." : "ربط ورفع البيانات"}</button>
              <button onClick={() => setGhOpen(false)} disabled={ghBusy} style={{ background: "#E9EBEF", color: "#3A4152", border: "1px solid #C9CDD6", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {importMsg && (
        <div className="no-print" style={{ background: "#1E6B44", color: "#fff", textAlign: "center", padding: "9px 16px", fontSize: 13.5, fontWeight: 800 }}>
          ✓ {importMsg}
        </div>
      )}

      <main className="app-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 40px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        {view === "dashboard" && (
          <div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <KPI label="إجمالي الآليات" value={counts.total} color="#141A28" />
              <KPI label="تعمل" value={(counts["تعمل"] || 0) + (counts["تم الإصلاح"] || 0)} color="#2E9E63"
                sub={counts.total ? Math.round(((counts["تعمل"] + counts["تم الإصلاح"] + counts["تعمل بوجود ملاحظات"]) / counts.total) * 100) + "% جاهزية تشغيلية (شاملة المُصلحة)" : ""} />
              <KPI label="عطلانة" value={counts["عطلانة"]} color="#C4353C"
                sub={counts.total ? Math.round((counts["عطلانة"] / counts.total) * 100) + "% من قوة الآليات" : ""} />
              <KPI label="تعمل بوجود ملاحظات" value={counts["تعمل بوجود ملاحظات"]} color="#E8A33D" />
              <KPI label="تحت التجهيز والتسليم" value={counts["تحت التجهيز والتسليم"]} color="#12897C" />
              <KPI label="تحت إجراءات الرجيع" value={counts["تحت إجراءات الرجيع"]} color="#7A64B8"
                sub={counts.total ? Math.round(((counts["تحت إجراءات الرجيع"] + counts["صدر قرار الرجيع"]) / counts.total) * 100) + "% إجمالي الرجيع" : ""} />
              <KPI label="صدر قرار الرجيع" value={counts["صدر قرار الرجيع"]} color="#8B93A3"
                sub={counts.total ? Math.round(((counts["تحت إجراءات الرجيع"] + counts["صدر قرار الرجيع"]) / counts.total) * 100) + "% إجمالي الرجيع" : ""} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
              <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15.5, fontWeight: 800 }}>توزيع الآليات حسب النوع</h3>
                {byType.length === 0 ? <div style={{ color: "#8B93A3", fontSize: 13.5 }}>لا توجد بيانات بعد — ابدأ بإضافة الآليات.</div> :
                  byType.map(([k, n]) => (
                    <div key={k} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        <span>{k}</span><span style={{ color: "#5A6172" }}>{n}</span>
                      </div>
                      <div style={{ background: "#E3E5E9", borderRadius: 6, height: 9 }}>
                        <div style={{ width: (n / counts.total) * 100 + "%", background: "linear-gradient(90deg,#9E1B22,#C4353C)", height: "100%", borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
              </div>

              <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15.5, fontWeight: 800 }}>توزيع الآليات حسب الجهات</h3>
                {byUnit.length === 0 ? <div style={{ color: "#8B93A3", fontSize: 13.5 }}>لا توجد بيانات بعد.</div> :
                  byUnit.map(([k, n]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #E6E8EC", fontSize: 13.5 }}>
                      <span style={{ fontWeight: 700 }}>{k}</span>
                      <span style={{ background: "#E5E8EC", borderRadius: 14, padding: "2px 12px", fontWeight: 800, color: "#3A4152" }}>{n}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "26px 0 12px", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#141A28" }}>إحصائيات الأعطال</h3>
              <span style={{ fontSize: 12.5, color: "#8B93A3", fontWeight: 700 }}>إجمالي الأعطال (الحالة الفنية: عطلانة): {counts["عطلانة"]}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <StatCard title="أكثر أنواع الآليات أعطالاً" entries={faultStats.byVType} accent="#9E1B22" />
              <StatCard title="أكثر الجهات آليات عطلانة (حالياً)" entries={faultStats.brokenNowTop} accent="#C4353C" />
              <StatCard title="الأكثر أعطالاً خلال الـ12 شهراً الماضية" entries={faultStats.last12Top} accent="#7A3E9D" />
              <StatCard title="أكثر أنواع الأعطال تكراراً" entries={faultStats.byFType} accent="#8A5A0B" />
              <StatCard title="الشهر الهجري الأكثر أعطالاً" entries={faultStats.byMonth} accent="#7A64B8" />
              <StatCard title="الموديل الأكثر تعطلاً" entries={faultStats.byModel} accent="#1F5A7A" />
              <StatCard title="الشعب الميدانية الأقل آليات عطلانة (حالياً)" entries={faultStats.brokenNowLeastField} accent="#1E6B44" />
              <StatCard title="الشعب الميدانية الأقل أعطالاً خلال الـ12 شهراً" entries={faultStats.last12LeastField} accent="#12897C" />
            </div>

            <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 20, marginTop: 16 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15.5, fontWeight: 800 }}>الآليات التي تحتاج متابعة (عطلانة / تعمل بوجود ملاحظات)</h3>
              {vehicles.filter((v) => v.status === "عطلانة" || v.status === "تعمل بوجود ملاحظات").length === 0 ? (
                <div style={{ color: "#2E9E63", fontSize: 13.5, fontWeight: 700 }}>✓ لا توجد آليات عطلانة أو عليها ملاحظات حالياً.</div>
              ) : (
                vehicles.filter((v) => v.status === "عطلانة" || v.status === "تعمل بوجود ملاحظات").map((v) => {
                  const lastFault = [...v.faults].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
                  return (
                    <div key={v.id} onClick={() => { setSelectedId(v.id); setView("detail"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid #E6E8EC", marginBottom: 8, flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{v.type} — {v.plate}</span>
                        <span style={{ color: "#8B93A3", fontSize: 13 }}> · {v.unit}</span>
                        {lastFault && (
                          <div style={{ fontSize: 12.5, color: "#8F1C22", marginTop: 2 }}>
                            آخر عطل: {lastFault.faultType || ""} {lastFault.desc ? "— " + lastFault.desc : ""} ({hijriDisplay(lastFault.date)})
                          </div>
                        )}
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {view === "charts" && (
          <InteractiveDashboard vehicles={vehicles} counts={counts} faultStats={faultStats}
            centerReadiness={db.centerReadiness || {}}
            equip={db.equipReadiness || {}}
            supportCounts={db.supportReadiness || {}}
            prio={db.priorityData || {}}
            prioWeights={db.priorityWeights || { inc: 50, den: 25, fac: 25 }} />
        )}

        {view === "readiness" && (
          <ReadinessPage vehicles={vehicles} ro={ro}
            onOpenReport={() => { setReportsInit("readiness"); setView("reports"); }}
            onSetSlots={(center, patch) => {
              const cr = db.centerReadiness || {};
              const c = cr[center] || {};
              persist({ ...db, centerReadiness: { ...cr, [center]: { ...c, ...patch } } }, "جاهزية مركز: " + center);
            }}
            onBoats={(center, boats) => {
              const cr = db.centerReadiness || {};
              const c = cr[center] || {};
              persist({ ...db, centerReadiness: { ...cr, [center]: { ...c, boats } } }, "قوارب مركز: " + center);
            }}
            prio={db.priorityData || {}}
            prioWeights={db.priorityWeights || { inc: 50, den: 25, fac: 25 }}
            onPrio={(center, field, value) => {
              const pd = db.priorityData || {};
              persist({ ...db, priorityData: { ...pd, [center]: { ...(pd[center] || {}), [field]: value } } }, "التغطية الميدانية: " + center);
            }}
            onPrioWeight={(field, delta) => {
              const w = db.priorityWeights || { inc: 50, den: 25, fac: 25 };
              const next = Math.min(90, Math.max(5, (w[field] || 25) + delta));
              persist({ ...db, priorityWeights: { ...w, [field]: next } }, "أوزان التغطية الميدانية");
            }}
            equip={db.equipReadiness || {}}
            onEquip={(section, center, field) => {
              const eq = db.equipReadiness || {};
              let next;
              if (section === "duals") {
                const d0 = (eq.duals || {})[center] || {};
                const d1 = { ...d0, [field]: !d0[field] };
                if (field === "has" && !d1.has) { d1.pump = false; d1.qala = false; }
                next = { ...eq, duals: { ...(eq.duals || {}), [center]: d1 } };
              } else {
                const s0 = eq[section] || {};
                next = { ...eq, [section]: { ...s0, [center]: !s0[center] } };
              }
              persist({ ...db, equipReadiness: next }, "جاهزية المعدات النوعية");
            }}
            supportCounts={db.supportReadiness || {}}
            onSupportChange={(key, delta) => {
              const sr = db.supportReadiness || {};
              const next = Math.max(0, (sr[key] || 0) + delta);
              persist({ ...db, supportReadiness: { ...sr, [key]: next } }, "جاهزية الدعم والإسناد");
            }}
            centerReadiness={db.centerReadiness || {}}
            onToggle={(center, slot) => {
              const cr = db.centerReadiness || {};
              const c = cr[center] || {};
              persist({ ...db, centerReadiness: { ...cr, [center]: { ...c, [slot]: !c[slot] } } }, "جاهزية مركز: " + center);
            }} />
        )}

        {view === "reports" && (
          <ReportsPage vehicles={vehicles} logo={logo} initialMode={reportsInit} ro={ro} isOwner={isOwner}
            centerReadiness={db.centerReadiness || {}}
            equip={db.equipReadiness || {}}
            supportCounts={db.supportReadiness || {}}
            prio={db.priorityData || {}}
            prioWeights={db.priorityWeights || { inc: 50, den: 25, fac: 25 }} />
        )}

        {view === "list" && !adding && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <input style={{ ...inputStyle, flex: "2 1 240px" }} placeholder="🔍 الأرقام تبحث في اللوحات حصراً — والنص في كل الحقول..." value={q} onChange={(e) => setQ(e.target.value)} />
              <MultiSelect label="الحالة" options={STATUSES} values={fStatus} onChange={setFStatus} flex="1 1 130px" />
              <MultiSelect label="النوع" options={allTypes} values={fType} onChange={setFType} flex="1 1 130px" />
              <MultiSelect label="الموديل" options={allModels} values={fModel} onChange={setFModel} flex="1 1 120px" />
              <MultiSelect label="الشعبة / الجهة" options={allBranches} values={fBranch} onChange={setFBranch} flex="1 1 150px" />
              <MultiSelect label="المركز التفصيلي" options={allUnits} values={fUnit} onChange={setFUnit} flex="1 1 150px" />
            </div>

            <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "#141A28", color: "#fff", textAlign: "right" }}>
                      {["نوع الآلية", "رقم اللوحة", "جهة الآلية", "رقم الصنف", "رقم الشاصية", "اللون", "الموديل", "الموقع الحالي", "الحالة الفنية", "أعطال"].map((h) => (
                        <th key={h} style={{ padding: "12px 12px", fontWeight: 800, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#8B93A3" }}>
                        {vehicles.length === 0 ? "قاعدة البيانات فارغة — اضغط «+ إضافة آلية» لبدء التسجيل." : "لا توجد نتائج مطابقة للبحث."}
                      </td></tr>
                    ) : filtered.map((v) => (
                      <tr key={v.id} className="row-hover" onClick={() => { setSelectedId(v.id); setView("detail"); }} style={{ borderBottom: "1px solid #E6E8EC", cursor: "pointer" }}>
                        <td style={{ padding: "11px 12px", fontWeight: 800 }}>{v.type}</td>
                        <td style={{ padding: "11px 12px", fontWeight: 700 }}>{v.plate}</td>
                        <td style={{ padding: "11px 12px" }}>{v.unit}</td>
                        <td style={{ padding: "11px 12px", color: "#5A6172" }}>{v.itemNo || "—"}</td>
                        <td style={{ padding: "11px 12px", color: "#5A6172" }}>{v.chassis || "—"}</td>
                        <td style={{ padding: "11px 12px" }}>{v.color || "—"}</td>
                        <td style={{ padding: "11px 12px" }}>{v.model || "—"}</td>
                        <td style={{ padding: "11px 12px" }}>{v.location || "—"}</td>
                        <td style={{ padding: "11px 12px" }}><StatusBadge status={v.status} /></td>
                        <td style={{ padding: "11px 12px", textAlign: "center", fontWeight: 700 }}>{v.faults.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#8B93A3", marginTop: 10 }}>عدد النتائج: {filtered.length} من أصل {vehicles.length} آلية</div>
          </div>
        )}

        {view === "list" && adding && (
          <div style={{ background: "#F4F5F7", border: "1px solid #D9DCE2", borderRadius: 16, padding: 22 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 800 }}>تسجيل آلية جديدة</h3>
            <VehicleForm initial={emptyVehicle()} onSave={addVehicle} onCancel={() => setAdding(false)} />
          </div>
        )}

        {view === "detail" && selected && (
          <VehicleDetail vehicle={selected} onUpdate={updateVehicle} onDelete={deleteVehicle} onBack={() => setView("list")} />
        )}
      </main>

      <footer className="no-print" style={{
        background: "linear-gradient(120deg,#14181F 55%,#2A1114)", color: "#fff",
        textAlign: "center", padding: "13px 16px", marginTop: "auto", position: "relative",
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: 0.3 }}>
          إعداد وتطوير رائد / فارس بن خالد العتيبي — نقيب / أكرم بن أحمد الصبحي
          <span style={{ color: "#E8A33D", fontWeight: 800 }}> · 2026</span>
        </span>
      </footer>
    </div>
  );
}
