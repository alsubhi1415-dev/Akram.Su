// سجل التغييرات المعتمدة: يُكتب داخل ملف السحابة ويظهر للمشرف
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
let pushedBody=null;
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){ if(u.includes("data.json")){ const bd=JSON.parse(o.body); pushedBody=JSON.parse(Buffer.from(bd.content,"base64").toString("utf8")); } return Promise.resolve(mk('{"content":{"sha":"s"}}')); }
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk('{"sha":"x"}'));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(w[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new w.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(2500);
  // حفظ عطل
  const nav=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(1000);}
  const f=Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){setN(ta,"فحص سجل التغييرات","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  await wait(3000);
  ok("رُفع الملف للسحابة", !!pushedBody);
  const log = pushedBody && pushedBody.db && pushedBody.db.syncLog;
  ok("سجل التغييرات مكتوب داخل ملف السحابة", Array.isArray(log) && log.length>0);
  const last = log && log[log.length-1];
  ok("القيد يصف التغيير", last && typeof last.a === "string" && last.a.length>3);
  ok("القيد يحمل التاريخ والصفة", last && last.t && last.r === "المشرف");
  ok("القيد يحمل مؤشر النسخة", last && !!last.rev);
  console.log("   القيد:", JSON.stringify(last));
  // عرضه بالدرج
  const tb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb){tb.click(); await wait(600);}
  const item=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim().startsWith("✅آخر التغييرات المعتمدة"));
  ok("عنصر «آخر التغييرات المعتمدة» بالدرج", !!item);
  if(item){item.click(); await wait(800);}
  const t=txt();
  ok("النافذة تعرض القيد", t.includes("آخر التغييرات المعتمدة") && t.includes("الأحدث"));
  ok("تنبيه أن المصدر هو السحابة", t.includes("مقروءة من قاعدة البيانات في السحابة"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
