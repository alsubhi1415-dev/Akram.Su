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
nu.db.syncLog=[...base.db.syncLog,{t:"16/2/1448هـ 17:30",r:"المشرف",a:"قيد تجريبي للتحديث الفوري",p:["ا ك ى 8250"],rev:"2"}];
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
  beforeParse(w){ w.fetch=stub; }});   // مشرف: العنصر صار مقصوراً على المسجّلين
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("الصلاحية مستعرض", !txt().includes("المشرف"));
  const tb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("أدوات"));
  if(tb){tb.click(); await wait(700);}
  const item=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim().startsWith("✅آخر التغييرات المعتمدة"));
  ok("العنصر محجوب عن المستعرض", !item);
  if(item){item.click(); await wait(800);}
  // الميزة صارت للمسجّلين فقط — والمستعرض يقرأ من نفس الأصل بلا رمز كتابة
  phase=2;
  await wait(9000);
  ok("المستعرض لا يستعمل واجهة GitHub (بلا رمز)", apiCalls === 0);
  ok("بيانات المستعرض محمّلة", txt().includes("639") || txt().includes("إجمالي الآليات"));
  {
    const hb=Array.from(D.querySelector("header").querySelectorAll("button"));
    ok("[مستعرض] زر دخول المحررين برمز مصوّر", !!hb.find(b=>b.querySelector("img") && (b.textContent||"").includes("دخول المحررين")));
    ok("زر البحث السريع برمز مصوّر", !!hb.find(b=>b.querySelector("img") && (b.textContent||"").includes("بحث سريع")));
  }
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
