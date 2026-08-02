// شارة الانتظار مدموجة بنقطة المزامنة ولا تومض لانتظار عابر
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
let hang=true;
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){ if(hang) return new Promise(()=>{}); return Promise.resolve(mk('{"content":{"sha":"s"}}')); }
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
  ok("لا شارة مستقلة بالرأس", !txt().includes("⏳ بانتظار الرفع"));
  ok("نقطة المزامنة ظاهرة", !!Array.from(D.querySelectorAll("header span")).find(x=>(x.getAttribute("title")||"").includes("حالة المزامنة")));
  // تسجيل عطل والرفع يعلّق
  await click("سجل الآليات",1300);
  const f=Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){setN(ta,"فحص شارة الانتظار","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1500);}
  await wait(3000);
  ok("مهلة تهدئة مبنيّة (لا وميض لحظي)", /Date\.now\(\)-\w+\.current>8e3/.test(html));
  await wait(9000);
  const hd=D.querySelector("header").textContent;
  ok("النقطة تحوّلت لتنبيه بعد استمرار الانتظار", hd.includes("بانتظار الرفع"));
  ok("التنبيه داخل نقطة المزامنة لا شارة منفصلة", (hd.match(/بانتظار الرفع/g)||[]).length===1);
  hang=false;
  await wait(60000);
  ok("عاد للأخضر بعد نجاح الرفع", !D.querySelector("header").textContent.includes("بانتظار الرفع"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
