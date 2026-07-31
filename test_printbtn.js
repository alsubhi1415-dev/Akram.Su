// أزرار الطباعة: خلفية فاتحة ورمز واضح في كل الصفحات
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
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("صنف أزرار الطباعة مبنيّ", html.includes(".print-btn {") && html.includes("background: #FFFFFF; color: #1B2440;"));
  ok("لا خلفيات داكنة على أزرار الطباعة", !html.includes('background: "#141A28", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}><PrIcon'));
  // سجل الآليات
  await click("سجل الآليات",1500);
  const p1=Array.from(D.querySelectorAll("button.print-btn"));
  ok("[سجل الآليات] زر طباعة البيان بالصنف الجديد", p1.some(b=>(b.textContent||"").includes("طباعة البيان")));
  ok("[سجل الآليات] الزر يحمل رمز الطابعة", p1.some(b=>b.querySelector("img")));
  // الجاهزية
  await click("الجاهزية الميدانية",1600);
  const p2=Array.from(D.querySelectorAll("button.print-btn"));
  const pd=Array.from(D.querySelectorAll("button.print-dark"));
  ok("[الجاهزية] زر تقرير الجاهزية بالصنف الداكن", pd.some(b=>(b.textContent||"").includes("تقرير الجاهزية")));
  // العمليات
  await click("إحصائيات عملياتية",1600);
  const p3=Array.from(D.querySelectorAll("button.print-btn"));
  ok("[العمليات] زر النموذج الشامل فاتح", p3.some(b=>(b.textContent||"").includes("النموذج الشامل")));
  ok("[العمليات] الزر يحمل رمز الطابعة", p3.some(b=>b.querySelector("img")));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
