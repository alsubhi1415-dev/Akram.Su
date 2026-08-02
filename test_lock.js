// شارة «الحفظ موقوف» وحقول التشخيص الحاسمة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
function mkDom(online){
  const stub=(u,o)=>{u=String(u);o=o||{};
    if(!online) return Promise.reject(new TypeError("offline"));
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk("{}",404));};
  const d=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
  return d.window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  // (أ) بلا اتصال: الشارة تظهر
  const w1=mkDom(false); await wait(6000); await wait(5500);
  const t1=w1.document.getElementById("root").textContent;
  ok("[منقطع] شارة الحفظ موقوف ظاهرة", t1.includes("الحفظ موقوف"));
  const row1=Array.from(w1.document.querySelectorAll("div")).find(d=>(d.textContent||"").trim().includes("حالة المزامنة")&&d.parentElement);
  // فتح التشخيص عبر الدرج
  const tb1=Array.from(w1.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb1){tb1.click(); await wait(500);}
  const item1=Array.from(w1.document.querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(item1){item1.click(); await wait(600);}
  const d1=w1.document.getElementById("root").textContent;
  ok("[منقطع] استُلمت السحابة: لا", d1.replace(/\s+/g,"").includes("استُلمتالسحابةلا"));
  ok("[منقطع] الحفظ متاح الآن: لا", d1.replace(/\s+/g,"").includes("الحفظمتاحالآنلا"));
  w1.close();

  // (ب) متصل: الشارة تختفي والحفظ متاح
  const w2=mkDom(true); await wait(6000); await wait(2500);
  const t2=w2.document.getElementById("root").textContent;
  ok("[متصل] لا شارة قفل", !t2.includes("الحفظ موقوف"));
  const tb2=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb2){tb2.click(); await wait(500);}
  const item2=Array.from(w2.document.querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(item2){item2.click(); await wait(600);}
  const d2=w2.document.getElementById("root").textContent.replace(/\s+/g," ");
  ok("[متصل] استُلمت السحابة: نعم", d2.replace(/\s+/g,"").includes("استُلمتالسحابةنعم"));
  ok("[متصل] الحفظ متاح الآن: نعم", d2.replace(/\s+/g,"").includes("الحفظمتاحالآننعم"));
  ok("[متصل] الصلاحية مشرف", d2.replace(/\s+/g,"").includes("الصلاحيةمشرف"));
  w2.close();

  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
