// توحيد الأرقام: البحث بالعربية والفارسية والإنجليزية يعطي النتيجة نفسها
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
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",beforeParse(w){w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setN=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const AR="٠١٢٣٤٥٦٧٨٩", FA="۰۱۲۳۴۵۶۷۸۹";
const toAr=s=>s.replace(/\d/g,d=>AR[+d]);
const toFa=s=>s.replace(/\d/g,d=>FA[+d]);
const base=JSON.parse(DATA).db;
const sample=base.vehicles.find(v=>/\d{3,}/.test(v.plate||""));
const num=(sample.plate.match(/\d+/g)||[]).join("");
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  console.log("   اللوحة المختبرة:", sample.plate, "· الرقم:", num, "· عربي:", toAr(num), "· فارسي:", toFa(num));
  // --- سجل الآليات ---
  await click("سجل الآليات",1400);
  const box=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("الأرقام تبحث"));
  ok("مربع بحث السجل موجود", !!box);
  const rows=()=>D.querySelectorAll("table.fleet-tbl tbody tr").length;
  setN(box,num); await wait(900); const rEn=rows();
  ok("[السجل] الرقم الإنجليزي يعطي نتائج", rEn>0 && txt().includes(sample.type));
  setN(box,toAr(num)); await wait(900); const rAr=rows();
  ok("[السجل] الرقم العربي يعطي النتيجة نفسها", rAr===rEn && txt().includes(sample.type));
  setN(box,toFa(num)); await wait(900); const rFa=rows();
  ok("[السجل] الرقم الفارسي يعطي النتيجة نفسها", rFa===rEn && txt().includes(sample.type));
  setN(box,""); await wait(600);
  // --- البحث السريع ---
  await click("بحث سريع",1000);
  const q=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("ابحث بلوحة"));
  ok("مربع البحث السريع موجود", !!q);
  setN(q,num); await wait(800);
  const hitEn=txt().includes(sample.type);
  ok("[البحث السريع] الرقم الإنجليزي يجد الآلية", hitEn);
  setN(q,toAr(num)); await wait(800);
  ok("[البحث السريع] الرقم العربي يجدها", txt().includes(sample.type));
  setN(q,toFa(num)); await wait(800);
  ok("[البحث السريع] الرقم الفارسي يجدها", txt().includes(sample.type));
  // نص بهمزة مختلفة
  setN(q,"الاليات"); await wait(800);
  ok("[البحث السريع] البحث النصي يتجاهل فروق الهمزة", txt().includes("سجل الآليات"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
