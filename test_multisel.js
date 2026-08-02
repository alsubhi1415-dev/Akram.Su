// «تحديد الكل» في مرشّحات القوائم المتعددة ثم إزالة ما لا يلزم
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
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
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
async function testOn(where, openPage){
  await openPage();
  const btn=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("الشعبة / الجهة"));
  ok(`[${where}] مرشّح الشعبة موجود`, !!btn);
  btn.click(); await wait(800);
  const all=Array.from(D.querySelectorAll("div")).filter(d=>d.querySelectorAll("div").length===0).find(d=>(d.textContent||"").trim().startsWith("✓ تحديد الكل"));
  ok(`[${where}] زر «تحديد الكل» ظاهر`, !!all);
  const boxes=()=>Array.from(D.querySelectorAll('input[type="checkbox"]'));
  const before=boxes().filter(b=>b.checked).length;
  ok(`[${where}] لا شيء محدد ابتداءً`, before===0);
  all.click(); await wait(900);
  const afterAll=boxes().filter(b=>b.checked).length;
  ok(`[${where}] الكل صار محدداً (${afterAll})`, afterAll>1 && afterAll===boxes().length);
  ok(`[${where}] العدّاد يعرض المحدد من الإجمالي`, /\d+\s*\/\s*\d+/.test(txt()));
  // إزالة واحد يدوياً
  const first=boxes().find(b=>b.checked);
  first.click(); await wait(900);
  const afterOne=boxes().filter(b=>b.checked).length;
  ok(`[${where}] إزالة خيار واحد لا تلغي البقية`, afterOne===afterAll-1);
  // مسح التحديد
  const clr=Array.from(D.querySelectorAll("div")).filter(d=>d.querySelectorAll("div").length===0).find(d=>(d.textContent||"").trim().startsWith("✕ مسح التحديد"));
  clr.click(); await wait(800);
  ok(`[${where}] مسح التحديد يعيد الكل`, boxes().filter(b=>b.checked).length===0);
  // إغلاق
  const ov=Array.from(D.querySelectorAll("div")).find(d=>(d.getAttribute("style")||"").includes("z-index: 55"));
  if(ov) ov.click(); await wait(500);
}
(async()=>{
  await wait(6000); await wait(3000);
  await testOn("التقارير", async()=>{ await click("التقارير والبيانات",1600); });
  await testOn("سجل الآليات", async()=>{ await click("سجل الآليات",1500); });
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
