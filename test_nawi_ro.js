// المستعرض: التقرير النوعي بلا علامة مائية وبلا قيود
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
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ w.fetch=stub; }});   // مستعرض بلا تسجيل دخول
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
let alerts=[]; W.alert=(m)=>alerts.push(String(m));
let opened=0; W.open=()=>{opened++; return null;};
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const wm=()=>D.querySelectorAll(".draft-wm").length;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("الصلاحية مستعرض", !txt().includes("المشرف"));
  await click("التقارير والبيانات",1700);
  ok("العلامة المائية ظاهرة بباقي التقارير", wm() > 0);
  await click("تكميل الآليات النوعي الأسبوعي",2400);
  ok("التقرير النوعي متاح للمستعرض", txt().includes("النوعي"));
  ok("العلامة المائية أُزيلت عنه", wm() === 0);
  // الطباعة تعمل بلا منع
  const pb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("طباعة التقرير"));
  ok("زر الطباعة متاح", !!pb);
  if(pb){pb.click(); await wait(900);}
  ok("الطباعة انطلقت بلا منع", opened > 0 && alerts.length === 0);
  // تنزيل PDF بلا منع
  const pd=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("تنزيل PDF"));
  if(pd){pd.click(); await wait(1200);}
  ok("PDF بلا رسالة منع", !alerts.some(a=>a.includes("غير متاح بوضع الاستعراض")));
  // العودة لتقرير آخر: العلامة تعود
  await click("تقارير حالة الآليات",1600);
  ok("العلامة تعود لبقية التقارير", wm() > 0);
  alerts=[];
  const pd2=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("تنزيل PDF"));
  if(pd2){pd2.click(); await wait(1500);}
  ok("قيد PDF مبنيّ لبقية التقارير", (html.match(/!==\"nawi\"/g)||[]).length >= 3);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
