// نسخة الجوال للمستعرض: البحث السريع والجرس والأدوات
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ w.fetch=stub; }});          // بلا تسجيل دخول = مستعرض
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setW=(px)=>{Object.defineProperty(W,"innerWidth",{value:px,configurable:true,writable:true});W.dispatchEvent(new W.Event("resize"));};
const byTitle=(t)=>Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"").includes(t));
const setN=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  setW(390); await wait(700);
  ok("الصلاحية مستعرض", !txt().includes("المشرف") && txt().includes("دخول المحررين"));
  // --- البحث السريع ---
  const sb=byTitle("بحث سريع");
  ok("[مستعرض] زر البحث السريع متاح", !!sb);
  sb.click(); await wait(900);
  const inp=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("ابحث بلوحة"));
  ok("النافذة فتحت بحقل البحث", !!inp);
  ok("لا تركيز تلقائي (الكيبورد لا يرتفع)", D.activeElement !== inp);
  ok("زر ✕ للإغلاق موجود", Array.from(D.querySelectorAll("button")).some(b=>(b.textContent||"").trim()==="✕"));
  ok("عنوان النافذة ظاهر", txt().includes("بحث سريع وتنقّل"));
  ok("اختصارات الصفحات معروضة قبل الكتابة", txt().includes("الصفحات") && txt().includes("سجل الآليات"));
  // بحث نصي
  setN(inp,"وايت"); await wait(900);
  ok("[مستعرض] البحث النصي يعطي نتائج", txt().includes("الآليات") && /وايت/.test(txt()));
  // الإغلاق بالزر
  const x=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="✕");
  x.click(); await wait(700);
  ok("✕ يغلق النافذة", !Array.from(D.querySelectorAll("input")).some(i=>(i.getAttribute("placeholder")||"").includes("ابحث بلوحة")));
  // --- الجرس ---
  const bl=byTitle("التنبيهات");
  ok("[مستعرض] زر التنبيهات متاح", !!bl);
  bl.click(); await wait(900);
  ok("لوحة التنبيهات ظهرت", txt().includes("التنبيهات الذكية"));
  ok("للوحة التنبيهات زر ✕", Array.from(D.querySelectorAll("button")).some(b=>(b.textContent||"").trim()==="✕"));
  const x2=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="✕");
  x2.click(); await wait(700);
  ok("✕ يغلق التنبيهات", !txt().includes("التنبيهات الذكية"));
  // --- الأدوات ---
  const tb=byTitle("أدوات إضافية");
  tb.click(); await wait(900);
  const sheet=Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("أدوات إضافية"));
  ok("لوحة الأدوات ظهرت كاملة", !!sheet);
  const st=sheet?sheet.textContent:"";
  ok("[مستعرض] الوضع الليلي متاح", st.includes("الوضع الليلي") || st.includes("الوضع النهاري"));
  ok("[مستعرض] حالة المزامنة متاحة", st.includes("حالة المزامنة"));
  ok("[مستعرض] لا أدوات أخرى", !st.includes("سلة المحذوفات") && !st.includes("سجل التدقيق") && !st.includes("نسخة احتياطية") && !st.includes("ربط GitHub") && !st.includes("عتبة تنبيه") && !st.includes("آخر التغييرات المعتمدة"));
  ok("للوحة الأدوات زر ✕", !!Array.from(sheet.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="✕"));
  // لوحة التنبيهات بالجوال تُرسم بجذر التطبيق
  const bl2=byTitle("التنبيهات"); bl2.click(); await wait(900);
  const bsheet=Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("التنبيهات الذكية"));
  ok("[جوال] لوحة التنبيهات بجذر التطبيق", !!bsheet && !D.querySelector("header").contains(bsheet));
  bsheet.click(); await wait(600);
  ok("الضغط خارجها يغلقها", !Array.from(D.querySelectorAll(".modal-overlay")).some(o=>(o.textContent||"").includes("التنبيهات الذكية")));
  // الوضع الليلي يبدّل دون إغلاق اللوحة
  const sh2=()=>Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("أدوات إضافية"));
  if(!sh2()){ byTitle("أدوات إضافية").click(); await wait(800); }
  ok("لوحة الأدوات مفتوحة", !!sh2());
  const darkRow=Array.from(sh2().querySelectorAll("div")).find(d=>/الوضع (الليلي|النهاري)/.test((d.textContent||"").trim()) && d.querySelectorAll("div").length===0);
  const wasDark=D.body.classList.contains("dark");
  if(darkRow){darkRow.click(); await wait(700);}
  ok("[مستعرض] الوضع الليلي تبدّل فعلاً", D.body.classList.contains("dark")!==wasDark);
  ok("اللوحة بقيت مفتوحة بعد تبديل الوضع", !!sh2());
  // حالة المزامنة تفتح نافذتها
  const syncRow=Array.from(sh2().querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(syncRow){syncRow.click(); await wait(900);}
  await wait(600);
  const dg=Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("🩺 حالة المزامنة"));
  ok("[مستعرض] نافذة حالة المزامنة فتحت", !!dg && (dg.textContent||"").includes("هذه الشاشة"));
  ok("لوحة الأدوات أُغلقت بعد فتح النافذة", !sh2());
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
