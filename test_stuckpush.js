// محاولة رفع معلّقة لا تنتهي: يجب ألا تُجمّد الشارة إلى الأبد
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
let hang=true; const puts=[];
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){
    if(hang) return new Promise(()=>{});      // طلب لا يعود أبداً
    puts.push(u.split("/contents/")[1]); return Promise.resolve(mk('{"content":{"sha":"s"}}'));
  }
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk('{"sha":"x"}'));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(W[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new W.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // تسجيل عطل → محاولة رفع تعلّق للأبد
  await click("سجل الآليات",1300);
  const f=Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){setN(ta,"فحص المحاولة المعلّقة","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  await wait(3000);
  ok("المحاولة علقت ولم يُرفع شيء", puts.length===0);
  ok("شارة الانتظار ظاهرة (صادقة)", txt().includes("بانتظار الرفع"));
  // الشبكة تعافت: يجب أن تُحرَّر المحاولة العالقة ويُعاد الرفع تلقائياً
  hang=false;
  await wait(60000);
  ok("حُرّرت المحاولة العالقة ورُفع التعديل", puts.includes("data.json") && puts.includes("ver.json"));
  ok("اختفت الشارة بعد النجاح", !txt().includes("بانتظار الرفع"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("عمليات الرفع:",puts.join(", ")||"لا شيء");
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
