// سجل التغييرات متاح للمستعرض بلا تسجيل دخول + زر التحديث الفوري
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
// نسخة سحابية تحوي سجل تغييرات
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
base.db.syncLog=[{t:"16/2/1448هـ 09:10",r:"المشرف",a:"تعديل 2 آلية",p:["أ ص م 3546"],rev:"1"}];
const OLD=JSON.stringify(base);
const nu=JSON.parse(JSON.stringify(base));
nu.rev=String(parseInt(base.rev)+1000);
nu.db.syncLog=[...base.db.syncLog,{t:"16/2/1448هـ 17:30",r:"المشرف",a:"تسجيل 1 عطل",p:["ا ك ى 8250"],rev:"2"}];
const NEW=JSON.stringify(nu);
const NEWVER=JSON.stringify({rev:nu.rev,by:"other",at:Date.now()});
let phase=1, apiCalls=0;
const stub=(u,o)=>{u=String(u);o=o||{};
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.startsWith("https://api.github.com")){ apiCalls++;
    if(u.includes("ver.json"))return Promise.resolve(mk(phase===1?VER:NEWVER));
    if(u.includes("data.json"))return Promise.resolve(mk(phase===1?OLD:NEW));
  }
  if(u.includes("ver.json"))return Promise.resolve(mk(phase===1?VER:VER)); // نفس الأصل متأخر
  if(u.includes("data.json"))return Promise.resolve(mk(OLD));              // نفس الأصل متأخر
  return Promise.resolve(mk("{}",404));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ try{w.localStorage.setItem("cdfleet_role_hash","a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49");}catch(e){} w.fetch=stub; }});   // مشرف: العنصر صار مقصوراً على المسجّلين
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("الصلاحية مشرف", txt().includes("المشرف"));
  const tb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb){tb.click(); await wait(700);}
  const item=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim().startsWith("✅آخر التغييرات المعتمدة"));
  ok("العنصر متاح للمشرف", !!item);
  if(item){item.click(); await wait(800);}
  ok("النافذة تفتح وتعرض القيد القديم", txt().includes("تعديل 2 آلية"));
  ok("زر التحديث الآن موجود", txt().includes("تحديث الآن"));
  // السحابة تتقدّم بينما «نفس الأصل» ما زال متأخراً
  phase=2;
  const rb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("تحديث الآن"));
  if(rb){rb.click(); await wait(2500);}
  ok("التحديث الفوري جلب النسخة الأحدث", txt().includes("تسجيل 1 عطل"));
  ok("رسالة تأكيد ظهرت", txt().includes("وصلت نسخة أحدث") || txt().includes("أنت على أحدث نسخة"));
  {
    const hb=Array.from(D.querySelector("header").querySelectorAll("button"));
    ok("[مشرف] شارة الصفة برمز مصوّر", !!Array.from(D.querySelectorAll("header span")).find(x=>x.querySelector("img") && (x.textContent||"").includes("المشرف")));
    ok("زر البحث السريع برمز مصوّر", !!hb.find(b=>b.querySelector("img") && (b.textContent||"").includes("بحث سريع")));
  }
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
