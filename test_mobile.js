const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://alsubhi1415-dev.github.io/Akram.Su/" });
const w = dom.window;
const errs = [];
w.addEventListener("error", (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const setW = (px) => { Object.defineProperty(w, "innerWidth", { value: px, configurable: true, writable: true }); w.dispatchEvent(new w.Event("resize")); };
const btns = () => Array.from(w.document.querySelectorAll("button"));
const click = async (label, ms) => {
  const b = btns().find((x) => (x.textContent || "").trim().includes(label));
  if (b) { b.click(); await wait(ms || 500); }
  return !!b;
};

(async () => {
  await wait(6000); // انتظار موثّق 6 ثوانٍ
  await wait(3500); // تجاوز شاشة الإقلاع (مهلة 7 ثوانٍ)
  const checks = [];
  const ok = (n, c) => checks.push([n, !!c]);
  const D = w.document;

  ok("تمّ الإقلاع", D.getElementById("root").childNodes.length > 0);
  ok("ختم الإصدار 11.4", D.getElementById("root").textContent.includes("11.4"));

  // --- سطح المكتب: الجدول هو الأصل ---
  setW(1280); await wait(400);
  await click("سجل الآليات", 700);
  ok("[مكتب] جدول سجل الآليات ظاهر", !!D.querySelector("table.fleet-tbl"));
  ok("[مكتب] لا بطاقات", D.querySelectorAll(".veh-card").length === 0);
  const deskRows = D.querySelectorAll("table.fleet-tbl tbody tr").length;
  ok("[مكتب] صفوف الجدول > 0", deskRows > 0);

  // --- الجوال: بطاقات بدل الجدول ---
  setW(390); await wait(700);
  ok("[جوال] الجدول مخفي", !D.querySelector("table.fleet-tbl"));
  const cards = D.querySelectorAll(".veh-card").length;
  ok("[جوال] بطاقات ظاهرة", cards > 0);
  ok("[جوال] عدد البطاقات = عدد صفوف الجدول", cards === deskRows);
  const ct = D.querySelector(".veh-card") ? D.querySelector(".veh-card").textContent : "";
  ok("[جوال] البطاقة تحوي لوحة ورموز الجهة/الموقع", ct.includes("🏢") && ct.includes("📍"));
  ok("[جوال] عدد النتائج باقٍ أسفل القائمة", D.getElementById("root").textContent.includes("عدد النتائج"));
  ok("[جوال] شريط ملاءمة العرض مخفي", !D.getElementById("root").textContent.includes("ملاءمة العرض"));

  // فتح تفاصيل آلية من البطاقة
  const c0 = D.querySelector(".veh-card");
  if (c0) { c0.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await wait(700); }
  ok("[جوال] النقر على البطاقة يفتح التفاصيل", D.getElementById("root").textContent.includes("الأعطال") || D.getElementById("root").textContent.includes("بيانات الآلية"));

  // --- الرجوع للمكتب: الجدول يعود ---
  await click("سجل الآليات", 700);
  setW(1280); await wait(700);
  ok("[رجوع للمكتب] الجدول عاد", !!D.querySelector("table.fleet-tbl"));
  ok("[رجوع للمكتب] البطاقات اختفت", D.querySelectorAll(".veh-card").length === 0);

  // --- انحدار: باقي المقاصد تعمل بالجوال ---
  setW(390); await wait(500);
  for (const lbl of ["مركز القيادة", "المؤشرات والتحليلات", "الجاهزية الميدانية", "إحصائيات عملياتية", "التقارير والبيانات"]) {
    const f = await click(lbl, 700);
    ok("[جوال] مقصد: " + lbl, f && D.getElementById("root").textContent.length > 200);
  }

  // --- صفحة العمليات في الجوال ---
  // ملاحظة: لا تُنشأ حوادث تجريبية إطلاقاً حمايةً لقاعدة البيانات الحية،
  // لذا يُتحقق من فرع البطاقة بنيوياً ومن سلامة الصفحة في العرض الضيق.
  setW(390); await wait(400);
  await click("إحصائيات عملياتية", 900);
  ok("[جوال] صفحة العمليات تفتح", D.getElementById("root").textContent.includes("أحدث الحوادث المسجلة"));
  ok("[جوال] فرع بطاقة الحادث مبنيّ في النسخة", html.includes("inc-card"));
  ok("[جوال] لا بطاقات حوادث (السجل فارغ فعلاً)", D.querySelectorAll(".inc-card").length === 0);
  setW(1280); await wait(800);
  ok("[مكتب] صفحة العمليات سليمة بعد التوسيع", D.getElementById("root").textContent.includes("أحدث الحوادث المسجلة"));

  ok("لا أخطاء تشغيل", errs.length === 0);

  let pass = 0;
  for (const [n, c] of checks) { if (c) pass++; console.log((c ? "✔" : "✘") + " " + n); }
  if (errs.length) console.log("ERRORS: " + errs.slice(0, 4).join(" | "));
  console.log("النتيجة: " + pass + "/" + checks.length);
  process.exit(pass === checks.length ? 0 : 2);
})();
