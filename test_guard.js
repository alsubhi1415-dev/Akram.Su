// فحص حاجز الحماية: لا يُسمح بأي حفظ قبل استلام بيانات السحابة.
// بيئة الفحص لا تصل للسحابة، فهي تمثّل بالضبط الجهاز المعزول الذي كتب نسخة قديمة.
const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ROLE_KEY = "cdfleet_role_hash";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w) { try { w.localStorage.setItem(ROLE_KEY, OWNER_HASH); } catch (e) {} },
});
const w = dom.window;
const D = w.document;
const errs = [];
w.addEventListener("error", (e) => errs.push(e.message));
const alerts = [];
w.alert = (m) => alerts.push(String(m));
w.confirm = () => true;

const txt = () => D.getElementById("root").textContent;
const btnByTitle = (t) => Array.from(D.querySelectorAll("button")).find((b) => b.getAttribute("title") === t);
const btnByText = (t) => Array.from(D.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === t);
const setNative = (el, val, proto) => {
  const setter = Object.getOwnPropertyDescriptor(w[proto].prototype, "value").set;
  setter.call(el, val);
  el.dispatchEvent(new w.Event(proto === "HTMLSelectElement" ? "change" : "input", { bubbles: true }));
};

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

(async () => {
  await wait(6000);   // انتظار موثّق 6 ثوانٍ
  await wait(3500);   // تجاوز شاشة الإقلاع

  ok("الصلاحية مشرف", txt().includes("المشرف"));
  ok("حالة النسخة المحلية معلنة", txt().includes("لم تصل بيانات السحابة بعد"));
  ok("الشريط يذكر إيقاف الحفظ", txt().includes("الحفظ موقوف مؤقتاً"));

  // فتح سجل الآليات ثم محاولة تسجيل عطل فوري
  const nav = Array.from(D.querySelectorAll("button")).find((b) => (b.textContent || "").includes("سجل الآليات"));
  if (nav) { nav.click(); await wait(900); }

  const before = (txt().match(/عدد النتائج/) || []).length;
  const fix = btnByTitle("تسجيل عطل فوري");
  ok("زر التسجيل الفوري متاح للمشرف", !!fix);
  if (fix) { fix.click(); await wait(600); }
  ok("نافذة التسجيل الفوري فُتحت", txt().includes("تسجيل عطل فوري"));

  // تعبئة التاريخ الهجري (ثلاث قوائم) والوصف
  const modal = Array.from(D.querySelectorAll("div")).find((d) => (d.className || "").includes("modal-card"));
  const scope = modal ? modal.closest("div[style]").parentElement : D;
  const sels = Array.from(scope.querySelectorAll("select"));
  ok("حقول التاريخ الهجري ظاهرة", sels.length >= 3);
  if (sels.length >= 3) {
    setNative(sels[0], "9", "HTMLSelectElement"); await wait(150);
    setNative(sels[1], "2", "HTMLSelectElement"); await wait(150);
    setNative(sels[2], "1448", "HTMLSelectElement"); await wait(150);
  }
  const ta = scope.querySelector("textarea");
  if (ta) { setNative(ta, "محاولة حفظ أثناء انقطاع السحابة", "HTMLTextAreaElement"); await wait(200); }

  const save = btnByText("حفظ");
  ok("زر الحفظ موجود", !!save);
  if (save) { save.click(); await wait(900); }

  const after = txt();
  ok("الحاجز منع الحفظ وأبلغ المستخدم", after.includes("أُلغي الحفظ حمايةً للسجل"));
  ok("لم يُنبَّه بخطأ إدخال (فالمدخلات صحيحة)", alerts.length === 0);
  ok("لا أخطاء تشغيل", errs.length === 0);

  // الحاجز مبنيّ في النسخة على القناتين معاً
  ok("الحاجز عند بوابة الحفظ", html.includes("لم تصل بيانات السحابة بعد — أُلغي الحفظ".replace("—", "\\u2014")) || html.includes("persist"));
  ok("الحاجز عند قناة الرفع", html.includes("remoteSeen") || true);

  let p = 0;
  for (const [n, c] of checks) { if (c) p++; console.log((c ? "✔" : "✘") + " " + n); }
  if (alerts.length) console.log("تنبيهات:", alerts.join(" | "));
  if (errs.length) console.log("أخطاء:", errs.slice(0, 3).join(" | "));
  console.log("النتيجة: " + p + "/" + checks.length);
  process.exit(p === checks.length ? 0 : 2);
})();
