const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ROLE_KEY = "cdfleet_role_hash";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function boot(role) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      if (role === "owner") { try { w.localStorage.setItem(ROLE_KEY, OWNER_HASH); } catch (e) {} }
    },
  });
  return dom.window;
}

const checks = [];
const ok = (n, c) => { checks.push([n, !!c]); };

const helpers = (w) => {
  const root = () => w.document.getElementById("root");
  const txt = () => (root() ? root().textContent : "");
  const findBtn = (label) => Array.from(w.document.querySelectorAll("button")).find((b) => (b.textContent || "").trim().includes(label));
  const click = async (label, ms) => { const b = findBtn(label); if (b) { b.click(); await wait(ms || 450); } return !!b; };
  return { root, txt, findBtn, click };
};

(async () => {
  // ============ (أ) وضع المستعرض ============
  const wv = boot("visitor");
  await wait(6000); // انتظار موثّق 6 ثوانٍ
  await wait(5500); // تجاوز شاشة الإقلاع (مهلة 10 ثوانٍ)
  const V = helpers(wv);
  ok("[زائر] الإقلاع تمّ", V.root() && V.root().childNodes.length > 0);
  ok("[زائر] ختم الإصدار 15.5", V.txt().includes("الإصدار 15.5"));
  ok("[زائر] مقصد الصفحة الرئيسية بالشريط", V.txt().includes("الصفحة الرئيسية"));
  ok("[زائر] زر الأدوات بالرأس", V.txt().includes("⋯ أدوات"));
  ok("[زائر] أزرار الأدوات لم تعد ظاهرة بالرأس", !V.txt().includes("ربط GitHub"));

  await V.click("الصفحة الرئيسية");
  ok("[زائر] التبويبات الثلاثة", V.txt().includes("نظرة عامة") && V.txt().includes("لوحة المعلومات") && V.txt().includes("مركز القرار"));
  ok("[زائر] تبويب لوحة المعلومات", await V.click("لوحة المعلومات"));
  ok("[زائر] محتوى لوحة المعلومات", V.txt().includes("إجمالي الآليات"));
  ok("[زائر] تبويب مركز القرار", await V.click("مركز القرار"));
  ok("[زائر] الشريط باقٍ", V.txt().includes("لوحة المعلومات"));

  await V.click("⋯ أدوات");
  ok("[زائر] الدرج يفتح", V.txt().includes("أدوات إضافية"));
  ok("[زائر] الوضع الليلي متاح", V.txt().includes("الوضع الليلي"));
  ok("[زائر] لا أدوات مشرف بالدرج", !V.txt().includes("سجل التدقيق") && !V.txt().includes("سلة المحذوفات"));
  const nightRow = Array.from(wv.document.querySelectorAll("div")).find((d) => (d.textContent || "").trim() === "🌙الوضع الليلي" || (d.textContent || "").trim() === "الوضع الليلي");
  if (nightRow) { nightRow.click(); await wait(400); }
  ok("[زائر] الوضع الليلي يعمل ويغلق الدرج", wv.document.body.classList.contains("dark"));

  for (const lbl of ["سجل الآليات", "المؤشرات والتحليلات", "الجاهزية الميدانية", "إحصائيات عملياتية", "التقارير والبيانات"]) {
    const f = await V.click(lbl, 600);
    ok("[زائر] مقصد: " + lbl, f && V.txt().length > 200);
  }
  {
    const fs2 = require("fs"), json = JSON.parse(fs2.readFileSync(__dirname + "/app-ver.json", "utf8"));
    const m = html.match(/\u0627\u0644\u0625\u0635\u062f\u0627\u0631 \\d+\\.\\d+/) || [];
    ok("ختم الإصدار المنشور مطابق للنسخة", json.build && V.txt().includes(json.build.split(" \u00b7 ")[0]));
  }
  ok("[زائر] مرشّح «المركز» بلا كلمة تفصيلي", !V.txt().includes("المركز التفصيلي"));
  ok("[زائر] عنوان الشريط الجديد", V.txt().includes("جاهزية الآليات والمراكز الميدانية"));
  ok("[زائر] عنوان الشريط بسطر واحد", html.includes(".side-rail .rail-title { color: #FCF7EE; font-size: 14px") && html.includes("white-space: nowrap; overflow: hidden; text-overflow: clip;"));
  ok("[زائر] عنوان الشريط مخفي بالجوال", html.includes(".side-rail .rail-title { display: none; }"));
  ok("[زائر] عنوان البرنامج الجديد", V.txt().includes("المنصة الرقمية لجاهزية الآليات والمراكز الميدانية"));
  ok("[زائر] عبارات الشريط أكبر", html.includes("font-size: 14px; font-weight: 800; cursor: pointer"));
  ok("[زائر] عبارات الشريط أنصع", html.includes(".side-rail .rlb { color: #F6EEDA;"));
  ok("[زائر] الشريط لم يتّسع", html.includes("width: 246px"));
  ok("[زائر] الوضع الليلي يقلب إضاءة المحتوى فعلاً", html.includes("invert(0.94) hue-rotate(180deg)"));
  ok("[زائر] الطباعة محميّة من مرشح الوضع الليلي", html.includes("body.dark main { filter: none !important; }"));
  ok("[زائر] مساحات لمس 44px للشاشات الصغيرة", html.includes("min-height: 44px"));
  ok("[زائر] الصور معكوسة عكساً مضاداً بالوضع الليلي", html.includes("body.dark main img"));
  await V.click("المؤشرات والتحليلات", 700);
  ok("[زائر] عنوان الرأس موحّد مع القائمة", V.txt().includes("المؤشرات والتحليلات") && !V.txt().includes("مؤشرات الجاهزية والأعطال"));
  await V.click("الصفحة الرئيسية", 700);
  ok("[زائر] رابط النظرة العامة موحّد", !V.txt().includes("مؤشرات الجاهزية والأعطال"));
  wv.close();

  // ============ (ب) وضع المشرف ============
  const wo = boot("owner");
  await wait(6000); // انتظار موثّق 6 ثوانٍ
  await wait(5500); // تجاوز شاشة الإقلاع (مهلة 10 ثوانٍ)
  const O = helpers(wo);
  ok("[مشرف] الإقلاع تمّ", O.root() && O.root().childNodes.length > 0);
  ok("[مشرف] الصلاحية مفعّلة", O.txt().includes("المشرف"));
  ok("[مشرف] زر الأدوات بالرأس", O.txt().includes("⋯ أدوات"));
  await O.click("⋯ أدوات");
  const t = O.txt();
  ok("[مشرف] عتبة تنبيه الجاهزية بالدرج", t.includes("عتبة تنبيه الجاهزية"));
  ok("[مشرف] سلة المحذوفات بالدرج", t.includes("سلة المحذوفات"));
  ok("[مشرف] سجل التدقيق بالدرج", t.includes("سجل التدقيق"));
  ok("[مشرف] نسخة احتياطية بالدرج", t.includes("نسخة احتياطية"));
  ok("[مشرف] ربط GitHub بالدرج", t.includes("ربط GitHub"));

  const row = (label) => Array.from(wo.document.querySelectorAll("div")).filter((d) => (d.textContent || "").includes(label) && d.children.length === 2).pop();
  const audit = row("سجل التدقيق");
  if (audit) { audit.click(); await wait(600); }
  ok("[مشرف] فتح سجل التدقيق من الدرج", O.txt().includes("التدقيق"));
  ok("[مشرف] الدرج انغلق بعد الاختيار", !O.txt().includes("أدوات إضافية"));
  wo.close();

  let pass = 0;
  for (const [n, c] of checks) { if (c) pass++; console.log((c ? "✔" : "✘") + " " + n); }
  console.log("النتيجة: " + pass + "/" + checks.length);
  process.exit(pass === checks.length ? 0 : 2);
})();
