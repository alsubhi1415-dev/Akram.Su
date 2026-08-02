// درج الأدوات: لوحة سفلية بالجوال بجذر التطبيق، وقائمة منسدلة بسطح المكتب
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
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
const toolsBtn=()=>Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="أدوات إضافية");
const sheet=()=>Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("أدوات إضافية"));
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // --- الجوال ---
  setW(390); await wait(700);
  ok("[جوال] زر الأدوات موجود", !!toolsBtn());
  toolsBtn().click(); await wait(800);
  const sh=sheet();
  ok("[جوال] اللوحة تُرسم بجذر التطبيق لا داخل الترويسة", !!sh && !D.querySelector("header").contains(sh));
  ok("[جوال] غطاء معتم خلفها", !!sh && (sh.getAttribute("style")||"").includes("position: fixed"));
  const items=sh?Array.from(sh.querySelectorAll("div")).map(e=>e.textContent):[];
  const t=sh?sh.textContent:"";
  ok("[جوال] كل البنود ظاهرة", ["عتبة تنبيه","سلة المحذوفات","سجل التدقيق","سجل دخول الفريق","آخر التغييرات المعتمدة","نسخة احتياطية","ربط GitHub","حالة المزامنة","الوضع"].every(k=>t.includes(k)));
  ok("[جوال] زر إغلاق صريح", !!Array.from(sh.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="إغلاق"));
  // الضغط على الغطاء يغلق
  sh.click(); await wait(700);
  ok("[جوال] الضغط خارجها يغلقها", !sheet());
  // فتح بند فعلي
  toolsBtn().click(); await wait(700);
  const diag=Array.from(sheet().querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(diag){diag.click(); await wait(900);}
  ok("[جوال] بند يفتح نافذته", D.getElementById("root").textContent.includes("حالة المزامنة") && !sheet());
  // إغلاق نافذة التشخيص
  const cl=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="إغلاق");
  if(cl){cl.click(); await wait(600);}
  // --- سطح المكتب ---
  setW(1400); await wait(800);
  toolsBtn().click(); await wait(800);
  ok("[مكتب] قائمة منسدلة داخل الترويسة", !!D.querySelector("header").querySelector('div[style*="position: absolute"]'));
  ok("[مكتب] لا لوحة سفلية", !sheet());
  // لوحة التنبيهات بالجوال: سفلية أيضاً لا تعتمد على ارتفاع الترويسة
  setW(390); await wait(700);
  const bell=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"").includes("التنبيهات"));
  ok("[جوال] زر التنبيهات موجود", !!bell);
  if(bell){bell.click(); await wait(800);}
  const bp=Array.from(D.querySelectorAll(".modal-overlay")).find(o=>(o.textContent||"").includes("التنبيهات الذكية"));
  ok("[جوال] لوحة التنبيهات بجذر التطبيق", !!bp && !D.querySelector("header").contains(bp));
  ok("لا اعتماد على ارتفاع الترويسة في أي لوحة", !html.includes("top: 68"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
