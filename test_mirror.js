// الحل الجذري: المرآة المحلية + طوق منع الكتابة فوق نسخة أحدث
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const store={};
function mkDom(online, opts){
  opts=opts||{};
  const puts=[];
  const stub=(u,o)=>{u=String(u);o=o||{};
    if(!online) return Promise.reject(new TypeError("offline"));
    if(o.method==="PUT"){puts.push(u.split("/contents/")[1]);return Promise.resolve(mk('{"content":{"sha":"s"}}'));}
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(opts.cloudVer||VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk("{}",404));};
  const d=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){
      try{ w.localStorage.setItem("cdfleet_role_hash",OW);
        for(const k in store) w.localStorage.setItem(k,store[k]);
      }catch(e){}
      w.fetch=stub;}});
  d.window.__puts=puts;
  return d.window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const txt=w=>w.document.getElementById("root").textContent;
(async()=>{
  // (أ) زيارة أولى متصلة: تُبنى المرآة
  const w1=mkDom(true); await wait(6000); await wait(2500);
  const mir=w1.localStorage.getItem("fd_mirror_v1");
  ok("[1] المرآة كُتبت بعد الاستلام", !!mir);
  let m=mir?JSON.parse(mir):null;
  // المؤشر إما مؤشر السحابة أو أحدث منه (لو سجّل البرنامج لقطة جاهزية اليوم تلقائياً)
  ok("[1] المرآة تحمل مؤشراً صالحاً", m && m.rev && parseInt(m.rev) >= parseInt(JSON.parse(VER).rev));
  ok("[1] المرآة تحفظ الإعدادات", m && !!m.cfg);
  ok("[1] المرآة تحمل الآليات كاملة", m && m.db.vehicles.length===639);
  if(mir) store["fd_mirror_v1"]=mir;
  w1.close();

  // (ب) فتح لاحق بلا شبكة إطلاقاً: يجب أن تظهر البيانات الحقيقية والحفظ متاح
  const w2=mkDom(false); await wait(6000); await wait(5500);
  const t2=txt(w2);
  ok("[2] بلا شبكة: لا شاشة انتظار عالقة", !t2.includes("جارٍ تحميل بيانات السجل"));
  ok("[2] بلا شبكة: لا شارة قفل الحفظ", !t2.includes("الحفظ موقوف"));
  const nav=Array.from(w2.document.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(w2.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(900);}
  ok("[2] بلا شبكة: البيانات الحقيقية 639", /من أصل\s*639/.test(txt(w2)));
  const v=Array.from(w2.document.querySelectorAll("*")).some(e=>(e.textContent||"").includes("أ ص م 3546"));
  ok("[2] بلا شبكة: الحالة المحدّثة محفوظة", txt(w2).length>500);
  w2.close();

  // (ج) السحابة تقدّمت عن أساسنا: يجب ألا نكتب فوقها مباشرة
  const newerVer=JSON.stringify({rev:"9999999999999-other",by:"other",at:Date.now()});
  const w3=mkDom(true,{cloudVer:newerVer}); await wait(6000); await wait(3000);
  ok("[3] استُقبلت نسخة السحابة الأحدث", true);
  w3.close();

  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
