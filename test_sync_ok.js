// فحص الوجه الآخر للحاجز: متى وصلت بيانات السحابة عمل الحفظ والرفع طبيعياً.
// تُحاكى السحابة محلياً (بلا أي اتصال حقيقي ولا مساس بالبيانات الحية).
const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const DATA = fs.readFileSync(__dirname + "/data_restored.json", "utf8");
const VER = fs.readFileSync(__dirname + "/ver_restored.json", "utf8");
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ROLE_KEY = "cdfleet_role_hash";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const puts = [];
function mkRes(body, status) {
  return {
    ok: (status || 200) < 400, status: status || 200,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}
function stubFetch(url, opts) {
  const u = String(url);
  const m = (opts && opts.method) || "GET";
  if (m === "PUT") {
    puts.push(u.split("/contents/")[1]);
    return Promise.resolve(mkRes(JSON.stringify({ content: { sha: "newsha" + puts.length } })));
  }
  if (u.includes("ver.json")) return Promise.resolve(mkRes(VER));
  if (u.includes("data.json")) {
    if (u.includes("api.github.com") && !u.includes("?ref=") ) return Promise.resolve(mkRes(JSON.stringify({ sha: "datasha" })));
    if (u.includes("application") ) return Promise.resolve(mkRes(DATA));
    return Promise.resolve(mkRes(DATA));
  }
  if (u.includes("app-ver.json")) return Promise.resolve(mkRes("{}", 404));
  return Promise.resolve(mkRes("{}", 404));
}

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w) {
    try { w.localStorage.setItem(ROLE_KEY, OWNER_HASH); } catch (e) {}
    w.fetch = stubFetch;
  },
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
  await wait(6000);
  await wait(2000);

  ok("شاشة الإقلاع اختفت", !txt().includes("جارٍ تحميل بيانات السجل"));
  ok("لا شريط نسخة محلية (وصلت السحابة)", !txt().includes("لم تصل بيانات السحابة بعد"));

  const nav = Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(D.querySelectorAll("button")).find((b) => (b.textContent || "").includes("سجل الآليات"));
  if (nav) { nav.click(); await wait(1000); }
  ok("البيانات محمّلة من السحابة المحاكاة", /من أصل\s*639/.test(txt()));

  const fix = btnByTitle("تسجيل عطل فوري");
  ok("زر التسجيل الفوري متاح", !!fix);
  if (fix) { fix.click(); await wait(600); }

  const modal = Array.from(D.querySelectorAll("div")).find((d) => (d.className || "").includes("modal-card"));
  const scope = modal ? modal.closest("div[style]").parentElement : D;
  const sels = Array.from(scope.querySelectorAll("select"));
  if (sels.length >= 3) {
    setNative(sels[0], "9", "HTMLSelectElement"); await wait(150);
    setNative(sels[1], "2", "HTMLSelectElement"); await wait(150);
    setNative(sels[2], "1448", "HTMLSelectElement"); await wait(150);
  }
  const ta = scope.querySelector("textarea");
  if (ta) { setNative(ta, "فحص الحفظ بعد وصول السحابة", "HTMLTextAreaElement"); await wait(200); }
  const save = btnByText("حفظ");
  if (save) { save.click(); await wait(1200); }

  ok("الحاجز لم يعترض الحفظ", !txt().includes("أُلغي الحفظ حمايةً للسجل"));
  ok("لا تنبيه إدخال", alerts.length === 0);

  await wait(2500); // مهلة قائمة الرفع
  ok("تمّ رفع data.json للسحابة", puts.includes("data.json"));
  ok("تمّ رفع ver.json للسحابة", puts.includes("ver.json"));
  ok("لا أخطاء تشغيل", errs.length === 0);

  let p = 0;
  for (const [n, c] of checks) { if (c) p++; console.log((c ? "✔" : "✘") + " " + n); }
  if (alerts.length) console.log("تنبيهات:", alerts.join(" | "));
  if (errs.length) console.log("أخطاء:", errs.slice(0, 3).join(" | "));
  console.log("عمليات الرفع:", puts.join(", ") || "لا شيء");
  console.log("النتيجة: " + p + "/" + checks.length);
  process.exit(p === checks.length ? 0 : 2);
})();
