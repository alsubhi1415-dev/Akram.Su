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
  await wait(5500); // تجاوز شاشة الإقلاع (مهلة 10 ثوانٍ)
  const checks = [];
  const ok = (n, c) => checks.push([n, !!c]);
  const D = w.document;

  ok("تمّ الإقلاع", D.getElementById("root").childNodes.length > 0);
  ok("ختم الإصدار 15.8", D.getElementById("root").textContent.includes("15.8"));

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
  for (const lbl of ["الصفحة الرئيسية", "المؤشرات والتحليلات", "الجاهزية الميدانية", "إحصائيات عملياتية", "التقارير والبيانات"]) {
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

  // --- الشريط الجانبي في الجوال: النص كاملاً فوق الأيقونة ---
  setW(390); await wait(500);
  const rail = D.querySelector(".side-rail");
  ok("[شريط] الشريط موجود", !!rail);
  if (rail) {
    const btns2 = Array.from(rail.querySelectorAll("button"));
    const labels = btns2.map(b => { const e = b.querySelector(".rlb"); return e ? e.textContent.trim() : ""; }).filter(Boolean);
    ok("[شريط] كل مقصد يحمل نصه", labels.length >= 6);
    ok("[شريط] النصوص كاملة بلا اختصار", labels.includes("المؤشرات والتحليلات") && labels.includes("الجاهزية الميدانية") && labels.includes("التقارير والبيانات"));
    const b0 = btns2.find(b => b.querySelector(".rlb"));
    const kids = Array.from(b0.children).map(c => c.className);
    ok("[شريط] ترتيب العناصر: أيقونة ثم نص (والقلب بالتنسيق)", String(kids[0]).indexOf("ric") === 0 && kids[1] === "rlb");
    const grps = Array.from(rail.querySelectorAll(".rail-grp"));
    ok("[شريط] لا عناوين مساحات فوق المقاصد", grps.length === 0);
    const vimg = rail.querySelectorAll(".ric-img img");
    ok("[شريط] المقاصد الستة كلها برموز مصوّرة", vimg.length === 6 && Array.from(vimg).every(i => String(i.getAttribute("src")).indexOf("data:image/png") === 0));
    const named = Array.from(rail.querySelectorAll("button")).filter(b => b.querySelector(".ric-img img"))
      .map(b => (b.querySelector(".rlb")||{}).textContent.trim());
    ok("[شريط] الصور موزّعة على المقاصد الستة", ["الصفحة الرئيسية","سجل الآليات","المؤشرات والتحليلات","الجاهزية الميدانية","إحصائيات عملياتية","التقارير والبيانات"].every(x => named.includes(x)));
    const icons = Array.from(rail.querySelectorAll("button .ric")).map(e => e.querySelector("img") ? "IMG" : e.textContent.trim());
    ok("[شريط] لا إيموجي في المقاصد", icons.filter(x => x === "IMG").length === 6);
    const MAIN = ["الصفحة الرئيسية","سجل الآليات","المؤشرات والتحليلات","الجاهزية الميدانية","إحصائيات عملياتية","التقارير والبيانات"];
    ok("[شريط] عبارة واحدة لكل مقصد", MAIN.every(x => labels.includes(x)));
    ok("[شريط] الصفحة الرئيسية بدل مركز القيادة", labels.includes("الصفحة الرئيسية") && !labels.includes("مركز القيادة"));
  }
  ok("[شريط] النص يُعرض فوق الأيقونة", html.includes("flex-direction: column-reverse"));
  ok("[شريط] عرض الشريط وُسّع", html.includes("width: 64px"));
  ok("[شريط] لا اختصار بالنقاط", html.includes("text-overflow: clip"));
  ok("[شريط] مسافة بين العبارة والأيقونة", html.includes("gap: 6px; padding: 8px 1px 7px"));
  ok("[شريط] مقاس الصورة كمقاس الإيموجي", html.includes(".side-rail .ric-img img { height: 19px") && html.includes(".side-rail .ric-img img { height: 15px; }"));
  ok("[شريط] لون العبارة فاتح واضح", html.includes(".side-rail .rlb { color: #F6EEDA;"));
  ok("[شريط] المقصد المفتوح بالأبيض", html.includes(".side-rail button.act .rlb { color: #FFFFFF; }"));

  ok("لا أخطاء تشغيل", errs.length === 0);

  let pass = 0;
  for (const [n, c] of checks) { if (c) pass++; console.log((c ? "✔" : "✘") + " " + n); }
  if (errs.length) console.log("ERRORS: " + errs.slice(0, 4).join(" | "));
  console.log("النتيجة: " + pass + "/" + checks.length);
  process.exit(pass === checks.length ? 0 : 2);
})();
