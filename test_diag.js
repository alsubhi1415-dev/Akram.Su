// فحص شاشة «حالة المزامنة»
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
function stub(u,o){u=String(u);o=o||{};
  const auth=o.headers&&(o.headers.Authorization||o.headers.authorization);
  if(u.startsWith("https://raw.githubusercontent.com")) return Promise.reject(new TypeError("blocked"));
  if(u.startsWith("https://api.github.com")){ if(!auth) return Promise.resolve(mk('{}',403));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER)); if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk('{"sha":"x"}')); }
  if(u.startsWith("https://alsubhi1415-dev.github.io/")){
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk("{}",404)); }
  return Promise.resolve(mk("{}",404));}
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash","0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd");}catch(e){} w.fetch=stub;}});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const clickTxt=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||500);}return !!b;};
(async()=>{
  await wait(6000); await wait(3000);
  ok("فتح درج الأدوات", await clickTxt("أدوات",600));
  const row=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim()==="🩺حالة المزامنة"||(d.textContent||"").trim()==="حالة المزامنة");
  ok("عنصر حالة المزامنة بالدرج", !!row);
  if(row){row.click(); await wait(700);}
  const t=txt();
  ok("النافذة فُتحت", t.includes("حالة المزامنة"));
  ok("تعرض نسخة البرنامج", t.includes("15.8"));
  ok("تعرض حالة الاتصال", t.includes("متصل"));
  ok("تعرض مصدر القراءة", t.includes("نفس أصل الصفحة") || t.includes("الواجهة الرسمية"));
  ok("تعرض مؤشر الاستلام", t.includes("rstr1101"));
  ok("تعرض حالة رمز الكتابة", t.includes("مفكوك وجاهز") || t.includes("غير متاح"));
  ok("تعرض عدد الآليات", t.includes("638"));
  ok("زر التحديث الكامل", t.includes("تحديث كامل"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
