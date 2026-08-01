// تعارض السحابة: الدمج ثم الدفع بنجاح — لا حلقة تعارض أبدية
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
// السحابة تسبق جهازنا: مؤشر أحدث بكثير
let cloudRev = String(Date.now()+500000)+"-other";
let cloud = JSON.parse(JSON.stringify(base)); cloud.rev = cloudRev;
// المرآة المحلية بمؤشر أقدم — فينشأ تعارض عند أول دفع
const mirrorRev = String(Date.now()-900000)+"-me";
let conflicts=0, puts=[];
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){
    const p=u.split("/contents/")[1];
    puts.push(p);
    if(p==="ver.json"){ try{ const b=JSON.parse(o.body); const t=JSON.parse(Buffer.from(b.content,"base64").toString("utf8")); cloudRev=t.rev; cloud.rev=t.rev; }catch(e){} }
    if(p==="data.json"){ try{ const b=JSON.parse(o.body); cloud=JSON.parse(Buffer.from(b.content,"base64").toString("utf8")); }catch(e){} }
    return Promise.resolve(mk('{"content":{"sha":"s'+puts.length+'"}}'));
  }
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(JSON.stringify({rev:cloudRev,by:"other",at:Date.now()})));
  if(u.includes("data.json"))return Promise.resolve(mk(JSON.stringify(cloud)));
  return Promise.resolve(mk('{"sha":"x"}'));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){
    try{
      w.localStorage.setItem("cdfleet_role_hash",OW);
      w.localStorage.setItem("fd_mirror_v1", JSON.stringify({rev:mirrorRev, at:Date.now(), db:base.db, cfg:base.cfg}));
    }catch(e){}
    w.fetch=stub;
  }});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(W[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new W.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // تعديل يُحدث تعارضاً مع السحابة الأحدث
  await click("سجل الآليات",1300);
  const f=Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){setN(ta,"فحص التعارض","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  await wait(9000);
  ok("تمّ الدفع بعد الدمج (لا حلقة تعارض)", puts.includes("data.json") && puts.includes("ver.json"));
  ok("عدد عمليات الرفع معقول", puts.length>0 && puts.length<=6);
  ok("التعديل وصل السحابة", JSON.stringify(cloud).includes("فحص التعارض"));
  const n0=puts.length;
  await wait(20000);
  ok("لا تكرار دفع بعد الاستقرار", puts.length - n0 <= 2);
  ok("لا شارة انتظار عالقة", !D.querySelector("header").textContent.includes("بانتظار الرفع"));
  ok("طابور الرفع فُرّغ", !W.localStorage.getItem("fd_pending_v1"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("عمليات الرفع:",puts.join(", ")||"لا شيء");
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
