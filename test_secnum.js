// ترقيم بيانات تقرير حالة الآليات: يُحذف الترقيم إن كان البيان واحداً
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
const DATA=JSON.stringify(base);
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const setS=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLSelectElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("change",{bubbles:true}));};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("التقارير والبيانات",1800);
  const t0=txt();
  ok("التصنيف الخاص أُعيدت تسميته", t0.includes("المزدوجات (الكومندر)"));
  ok("لا أثر للاسم القديم وحده", !/المزدوجات(?!\s*\(الكومندر\))/.test(t0.replace(/المزدوجات \(الكومندر\)/g,"")));
  // بلا مرشّح حالة: ثلاثة بيانات → ترقيم
  await wait(600);
  let t=txt();
  ok("[كل الحالات] ترقيم متسلسل", t.includes("أولاً: بيان الآليات") && t.includes("ثانياً: بيان الآليات"));
  // مرشّح على حالة واحدة: بيان واحد → بلا ترقيم
  const stBtn=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("الحالة الفنية"));
  ok("مرشّح الحالة الفنية موجود", !!stBtn);
  if(stBtn){ stBtn.click(); await wait(700);
    const opt=Array.from(D.querySelectorAll("div,label,button")).find(e=>(e.textContent||"").trim()==="عطلانة");
    if(opt){ opt.click(); await wait(1600); }
    stBtn.click(); await wait(900);
  }
  t=txt();
  ok("[حالة واحدة] البيان ظاهر", t.includes("بيان الآليات المتعطلة"));
  ok("[حالة واحدة] بلا «ثانياً»", !t.includes("ثانياً: بيان الآليات المتعطلة"));
  ok("[حالة واحدة] بلا «أولاً» كذلك", !t.includes("أولاً: بيان الآليات المتعطلة"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
