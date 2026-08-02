// ثبات الترويسة بالجوال عند التنقل بين الصفحات
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
  beforeParse(w){ w.fetch=stub; }});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const setW=(px)=>{Object.defineProperty(W,"innerWidth",{value:px,configurable:true,writable:true});W.dispatchEvent(new W.Event("resize"));};
const hdr=()=>D.querySelector("header");
const pad=()=>{const st=hdr().getAttribute("style")||""; const m=st.match(/padding:\s*([^;]+)/); return m?m[1].trim():"";};
const minH=()=>{const st=hdr().getAttribute("style")||""; const m=st.match(/min-height:\s*([^;]+)/); return m?m[1].trim():"";};
const keyBtns=()=>{const t=D.querySelector("nav.app-nav").textContent;
  return ["بحث سريع","أدوات","الإصدار"].filter(k=>t.includes(k)).length + (t.includes("دخول المحررين")||t.includes("المشرف")||t.includes("محرر")?1:0);};
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  setW(390); await wait(800);
  const p0=pad(), h0=minH(), n0=keyBtns();
  const ttl=()=>{const e=D.querySelector("header .hdr-title"); return e?e.textContent.trim():"";};
  const t0=ttl();
  ok("[جوال] الترويسة لها ارتفاع أدنى ثابت", h0.includes("150"));
  const pages=["سجل الآليات","الجاهزية الميدانية","المؤشرات والتحليلات","إحصائيات عملياتية","التقارير والبيانات","الصفحة الرئيسية"];
  let same=true, sameH=true, sameN=true, sameT=true;
  for(const pg of pages){
    await click(pg,1100);
    if(pad()!==p0) { same=false; console.log("   تغيّر الحشو عند:",pg,"→",pad()); }
    if(minH()!==h0) sameH=false;
    if(keyBtns()<n0) { sameN=false; console.log("   نقصت أزرار الشريط عند:",pg,keyBtns(),"بدل",n0); }
    if(ttl()!==t0) { sameT=false; console.log("   تغيّر عنوان الترويسة عند:",pg,"→",ttl()); }
  }
  ok("[جوال] الحشو ثابت عبر كل الصفحات", same);
  ok("[جوال] الارتفاع الأدنى ثابت", sameH);
  ok("[جوال] أزرار الشريط الأساسية كاملة دائماً", sameN && n0===4);
  ok("[جوال] عنوان الترويسة ثابت في كل الصفحات", sameT && t0.includes("المنصة الرقمية"));
  const gap=()=>D.querySelector("header .hdr-title .hdr-gap");
  ok("[جوال] فجوة زر الرجوع محجوزة داخل العنوان", !!gap());
  ok("[جوال] الفجوة تطفو يساراً فيلتفّ النص حولها", html.includes("header .hdr-title .hdr-gap { float: left;"));
  ok("[جوال] الحشو موحّد بلا إزاحة 86px", !pad().includes("86px"));
  ok("[جوال] زر الرجوع ظهر بعد التنقل", !!D.querySelector(".fd-float-back"));
  ok("[جوال] قاعدة تصغير زر الرجوع مبنيّة", html.includes(".fd-float-back { top: 6px !important; left: 6px !important;"));
  // سطح المكتب يحتفظ بسلوكه القديم
  setW(1400); await wait(800);
  await click("سجل الآليات",1100);
  ok("[مكتب] الحشو موحّد أيضاً بلا إزاحة", !pad().includes("86px"));
  ok("[مكتب] الفجوة محجوزة كذلك", !!D.querySelector("header .hdr-title .hdr-gap"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
