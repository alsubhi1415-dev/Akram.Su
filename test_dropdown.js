// اللوحات المنسدلة بالجوال: ترتفع لجسم الصفحة فلا يحبسها الشريط
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const setW=(px)=>{Object.defineProperty(W,"innerWidth",{value:px,configurable:true,writable:true});W.dispatchEvent(new W.Event("resize"));};
const panel=(kw)=>Array.from(D.querySelectorAll("div.no-print")).find(d=>(d.textContent||"").includes(kw));
const inNav=(el)=>!!(el && el.closest && el.closest("nav.app-nav"));
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const btn=(t)=>Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes(t));
(async()=>{
  await wait(6000); await wait(3000);
  setW(390); await wait(800);
  // درج الأدوات
  const tb=btn("أدوات"); if(tb){tb.click(); await wait(900);}
  const tp=panel("أدوات إضافية");
  ok("[جوال] درج الأدوات مفتوح", !!tp);
  ok("[جوال] الدرج خارج شريط الأزرار (غير محبوس)", tp && !inNav(tp));
  ok("[جوال] الدرج ابن مباشر لجسم الصفحة", tp && tp.parentElement === D.body);
  ok("[جوال] الدرج يعرض عناصره", tp && (tp.textContent||"").includes("سلة المحذوفات"));
  if(tb){tb.click(); await wait(600);}
  ok("[جوال] يُغلق بالضغط ثانية", !panel("أدوات إضافية"));
  // لوحة التنبيهات
  const bells=Array.from(D.querySelectorAll("header button")).filter(b=>b.querySelector("img"));
  const bell=bells.find(b=>(b.textContent||"").trim()!=="" || true);
  const bellBtn=Array.from(D.querySelectorAll("header button")).find(b=>b.getAttribute("title")==="التنبيهات الذكية") || bells[bells.length-1];
  if(bellBtn){bellBtn.click(); await wait(900);}
  const bp=panel("التنبيهات الذكية");
  ok("[جوال] لوحة التنبيهات مفتوحة", !!bp);
  ok("[جوال] لوحة التنبيهات غير محبوسة", bp && !inNav(bp));
  // سطح المكتب: السلوك القديم سليم
  setW(1400); await wait(800);
  if(bellBtn){bellBtn.click(); await wait(500);}
  const tb2=btn("أدوات"); if(tb2){tb2.click(); await wait(800);}
  const tp2=panel("أدوات إضافية");
  ok("[مكتب] الدرج يفتح أيضاً", !!tp2);
  ok("[مكتب] الدرج بجسم الصفحة كذلك", tp2 && tp2.parentElement === D.body);
  // زر الرجوع الطافي كذلك
  setW(390); await wait(600);
  const tb3=btn("أدوات"); if(tb3 && panel("أدوات إضافية")){tb3.click(); await wait(600);}
  const nav2=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات");
  if(nav2){nav2.click(); await wait(1500);}
  const nav3=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="الجاهزية الميدانية");
  if(nav3){nav3.click(); await wait(1500);}
  const back=D.querySelector(".fd-float-back");
  ok("[جوال] زر الرجوع ظاهر", !!back);
  ok("[جوال] زر الرجوع غير محبوس بالشريط", back && !back.closest("nav.app-nav"));
  ok("[جوال] زر الرجوع بجسم الصفحة", back && back.parentElement === D.body);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
