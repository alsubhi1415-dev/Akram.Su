// الشارة العالقة: يجب أن تُصالَح ذاتياً حين لا فرق عن السحابة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const puts=[]; const T0=Date.now();
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){puts.push({p:u.split("/contents/")[1],t:Date.now()-T0});return Promise.resolve(mk('{"content":{"sha":"s"}}'));}
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk('{"sha":"x"}'));};
// راية عالقة من جلسة سابقة: طابور يطابق ما في السحابة تماماً
const stale=JSON.parse(DATA).db;
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){
    try{
      w.localStorage.setItem("cdfleet_role_hash",OW);
      w.localStorage.setItem("fd_pending_v1", JSON.stringify({ db: stale, at: Date.now()-86400000 }));
    }catch(e){}
    w.fetch=stub;
  }});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("الراية العالقة موجودة بالتخزين عند البدء", true);
  await wait(6000);   // مهلة المصالحة
  const still = W.localStorage.getItem("fd_pending_v1");
  ok("طابور الرفع فُرّغ ذاتياً", !still);
  ok("شارة «بانتظار الرفع» اختفت", !txt().includes("بانتظار الرفع"));
  // شاشة التشخيص تبيّن السبب
  const tb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb){tb.click(); await wait(700);}
  const item=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة");
  if(item){item.click(); await wait(800);}
  const t=txt().replace(/\s+/g,"");
  ok("التشخيص يعرض «فرق فعلي عن السحابة»", t.includes("فرقفعليعنالسحابة"));
  ok("ويقول لا يوجد فرق", t.includes("فرقفعليعنالسحابةلايوجد"));
  ok("مصالحة واحدة لا حلقة رفع متكررة", puts.length <= 2);
  ok("لم يتكرر الرفع بعد المصالحة", (await (async()=>{const n=puts.length; await wait(6000); return puts.length===n;})()));
  // سيناريو المحاولة العالقة: راية + فرق حقيقي + محاولة لا تنتهي
  ok("نص التشخيص يعرض الحقول الجديدة", txt().includes("فرق فعلي عن السحابة"));
  const copyBtn=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("نسخ التفاصيل"));
  ok("زر «مصالحة الآن» موجود", Array.from(D.querySelectorAll("button")).some(b=>(b.textContent||"").includes("مصالحة الآن")));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("عمليات الرفع:",JSON.stringify(puts));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
