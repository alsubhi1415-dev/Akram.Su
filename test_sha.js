// بصمة الملف البائتة: يجب أن تُحدَّث ويُعاد الرفع بنجاح لا أن تُعلّق الرفع للأبد
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
let cloud=JSON.parse(JSON.stringify(base));
let sha={ "data.json":"aaa1", "ver.json":"bbb1" };
let cloudRev=String(base.rev||Date.now())+"";
let rejected=0, puts=[];
const stub=(u,o)=>{u=String(u);o=o||{};
  const path=u.includes("data.json")?"data.json":u.includes("ver.json")?"ver.json":"";
  if(o.method==="PUT"){
    const b=JSON.parse(o.body);
    if(b.sha!==sha[path]){ rejected++; return Promise.resolve(mk(JSON.stringify({message:path+" does not match "+b.sha}),409)); }
    sha[path]="s"+(++puts.length);
    puts.push(path);
    if(path==="data.json"){ try{ cloud=JSON.parse(Buffer.from(b.content,"base64").toString("utf8")); }catch(e){} }
    if(path==="ver.json"){ try{ cloudRev=JSON.parse(Buffer.from(b.content,"base64").toString("utf8")).rev; }catch(e){} }
    return Promise.resolve(mk('{"content":{"sha":"'+sha[path]+'"}}'));
  }
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  // طلب البصمة (contents بدون raw)
  if(o.headers && String(o.headers.Accept||"").includes("vnd.github+json") && path)
    return Promise.resolve(mk(JSON.stringify({sha:sha[path]})));
  if(path==="ver.json")return Promise.resolve(mk(JSON.stringify({rev:cloudRev,by:"x",at:Date.now()})));
  if(path==="data.json")return Promise.resolve(mk(JSON.stringify(cloud)));
  return Promise.resolve(mk('{"sha":"x"}'));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(W[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new W.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // نُبدّل بصمة السحابة من تحت أقدام البرنامج
  sha["data.json"]="CHANGED"; sha["ver.json"]="CHANGED2";
  await click("سجل الآليات",1300);
  const f=Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){setN(ta,"فحص البصمة البائتة","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  await wait(9000);
  ok("رُفع الملف رغم تبدّل البصمة", puts.includes("data.json") && puts.includes("ver.json"));
  ok("التعديل وصل السحابة", JSON.stringify(cloud).includes("فحص البصمة البائتة"));
  ok("لا شارة انتظار عالقة", !D.querySelector("header").textContent.includes("بانتظار الرفع"));
  ok("طابور الرفع فُرّغ", !W.localStorage.getItem("fd_pending_v1"));
  const n0=puts.length;
  await wait(15000);
  ok("لا حلقة رفع بعد الاستقرار", puts.length-n0<=2);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("رفضات 409:",rejected,"| عمليات الرفع:",puts.filter(x=>typeof x==="string").join(", "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
