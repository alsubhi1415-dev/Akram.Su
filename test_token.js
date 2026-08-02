// يعيد الحالة التي واجهها أكرم: جلسة ثانية والسحابة لم تتغيّر
// — يجب أن يبقى رمز الكتابة متاحاً وأن ينجح الرفع.
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const store={};
function boot(dataCalls){
  const puts=[];
  const stub=(u,o)=>{u=String(u);o=o||{};
    if(o.method==="PUT"){puts.push(u.split("/contents/")[1]);return Promise.resolve(mk('{"content":{"sha":"s"}}'));}
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json")){dataCalls.n++;return Promise.resolve(mk(DATA));}
    return Promise.resolve(mk('{"sha":"x"}'));};
  const d=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);for(const k in store)w.localStorage.setItem(k,store[k]);}catch(e){} w.fetch=stub;}});
  d.window.__puts=puts; return d.window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const txt=w=>w.document.getElementById("root").textContent;
(async()=>{
  // الجلسة الأولى: تُبنى المرآة
  let dc={n:0}; const w1=boot(dc); await wait(6000); await wait(2500);
  const mir=w1.localStorage.getItem("fd_mirror_v1");
  const m=mir?JSON.parse(mir):null;
  ok("[1] المرآة كُتبت", !!m);
  ok("[1] المرآة تحفظ الإعدادات (رمز الكتابة)", m && m.cfg && (m.cfg.tokA || m.cfg.tokO));
  if(mir) store["fd_mirror_v1"]=mir;
  w1.close();

  // الجلسة الثانية: السحابة لم تتغيّر إطلاقاً
  dc={n:0}; const w2=boot(dc); await wait(6000); await wait(3000);
  ok("[2] لا شارة قفل حفظ", !txt(w2).includes("الحفظ موقوف"));
  // فتح شاشة التشخيص للتأكد من الرمز
  const tb=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb){tb.click(); await wait(600);}
  const item=Array.from(w2.document.querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(item){item.click(); await wait(700);}
  const t=txt(w2).replace(/\s+/g,"");
  ok("[2] رمز الكتابة مفكوك وجاهز", t.includes("رمزالكتابةمفكوكوجاهز"));
  ok("[2] الحفظ متاح الآن", t.includes("الحفظمتاحالآننعم"));
  const close=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="إغلاق");
  if(close){close.click(); await wait(500);}

  // محاولة حفظ فعلية
  const nav=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(1000);}
  const f=Array.from(w2.document.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const modal=Array.from(w2.document.querySelectorAll("div")).find(d=>(d.className||"").includes("modal-card"));
  const sc=modal?modal.closest("div[style]").parentElement:w2.document;
  const sels=Array.from(sc.querySelectorAll("select"));
  const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(w2[p].prototype,"value").set.call(el,v);
    el.dispatchEvent(new w2.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=sc.querySelector("textarea"); if(ta){setN(ta,"فحص الرفع بعد الإقلاع من المرآة","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  ok("[2] لا رسالة «لم يُربط GitHub»", !txt(w2).includes("لم يُربط GitHub"));
  await wait(2500);
  ok("[2] تمّ رفع البيانات فعلاً", w2.__puts.includes("data.json") && w2.__puts.includes("ver.json"));
  w2.close();

  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
