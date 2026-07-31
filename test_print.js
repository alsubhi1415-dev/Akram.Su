// فحص المطبوعات: توقيع معد التقرير في بيان الآليات فقط، وقواعد فواصل الصفحات.
const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const DATA = fs.readFileSync(__dirname + "/data_restored.json", "utf8");
const VER = fs.readFileSync(__dirname + "/ver_restored.json", "utf8");
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ROLE_KEY = "cdfleet_role_hash";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function mkRes(body, status) {
  return { ok: (status || 200) < 400, status: status || 200, headers: { get: () => null },
    text: async () => body, json: async () => JSON.parse(body) };
}
function stubFetch(url, opts) {
  const u = String(url);
  if ((opts && opts.method) === "PUT") return Promise.resolve(mkRes(JSON.stringify({ content: { sha: "s" } })));
  if (u.includes("ver.json")) return Promise.resolve(mkRes(VER));
  if (u.includes("data.json")) return Promise.resolve(mkRes(DATA));
  return Promise.resolve(mkRes("{}", 404));
}

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w) { try { w.localStorage.setItem(ROLE_KEY, OWNER_HASH); } catch (e) {} w.fetch = stubFetch; },
});
const w = dom.window;
const D = w.document;
const errs = [];
w.addEventListener("error", (e) => errs.push(e.message));

const txt = () => D.getElementById("root").textContent;
const ptxt = () => { const e = D.getElementById("print-area"); return e ? e.textContent : ""; };
const clickTxt = async (t, ms) => {
  const b = Array.from(D.querySelectorAll("button")).find((x) => (x.getAttribute("title") || "") === t) || Array.from(D.querySelectorAll("button")).find((x) => (x.textContent || "").trim().includes(t));
  if (b) { b.click(); await wait(ms || 800); }
  return !!b;
};

const checks = [];
const ok = (n, c) => checks.push([n, !!c]);

(async () => {
  await wait(6000);
  await wait(2000);

  ok("وصلت بيانات السحابة المحاكاة", !txt().includes("لم تصل بيانات السحابة بعد"));
  ok("فتح التقارير والبيانات", await clickTxt("التقارير والبيانات", 1200));

  // تقارير حالة الآليات: التوقيع باقٍ
  ok("فتح تقارير حالة الآليات", await clickTxt("تقارير حالة الآليات", 1200));
  const tv = ptxt();
  ok("[الآليات] معد التقرير موجود", tv.includes("معد التقرير"));
  ok("[الآليات] اسم المعد موجود", tv.includes("أكرم بن أحمد الصبحي"));

  // تقرير الجاهزية: لا توقيع ولا اسم
  ok("فتح تقرير الجاهزية الميدانية", await clickTxt("تقرير الجاهزية الميدانية", 1400));
  const tr = ptxt();
  ok("[الجاهزية] لا عبارة معد التقرير", !tr.includes("معد التقرير"));
  ok("[الجاهزية] لا اسم المعد", !tr.includes("أكرم بن أحمد الصبحي"));
  ok("[الجاهزية] التقرير معروض فعلاً", tr.length > 500);
  ok("[تحقق] الاسم في التذييل غير مطبوع", D.querySelector("footer").className.includes("no-print"));

  // قواعد الطباعة مبنيّة في النسخة
  ok("مسافة ثابتة أعلى الصفحة وأسفلها (نافذة الطباعة)", html.includes('margin: ${land ? "8mm" : "10mm"} 0') || html.includes("8mm") );
  ok("فاصل صفحة بين الفقرات ولو تخللتها عناصر", html.includes(".sec-block ~ .sec-block") || html.includes("~ .rep-sec"));
  ok("متنفس أسفل الجداول", html.includes("margin-bottom: 5mm"));
  ok("حشو سفلي للفقرات", html.includes("padding-bottom: 3mm"));
  ok("هامش الطباعة المباشرة", html.includes("margin: 14mm 12mm"));
  ok("لا أخطاء تشغيل", errs.length === 0);

  let p = 0;
  for (const [n, c] of checks) { if (c) p++; console.log((c ? "✔" : "✘") + " " + n); }
  if (errs.length) console.log("أخطاء:", errs.slice(0, 3).join(" | "));
  console.log("النتيجة: " + p + "/" + checks.length);
  process.exit(p === checks.length ? 0 : 2);
})();
