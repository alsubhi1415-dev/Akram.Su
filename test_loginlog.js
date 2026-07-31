// سجل دخول الفريق: قيد واحد عند تسجيل الدخول، ومشرف حصراً
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
let pushed=null;
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"&&u.includes("data.json")){const bd=JSON.parse(o.body);pushed=JSON.parse(Buffer.from(bd.content,"base64").toString("utf8"));return Promise.resolve(mk('{"content":{"sha":"s"}}'));}
  if(o.method==="PUT")return Promise.resolve(mk('{"content":{"sha":"s"}}'));
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk('{"sha":"x"}'));};
const UA="Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ w.fetch=stub;
    try { Object.defineProperty(w.navigator, "userAgent", { get: () => UA, configurable: true }); } catch(e){}
    try { Object.defineProperty(w.screen, "width", { get: () => 412, configurable: true }); } catch(e){}
  }});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const setN=(el,v)=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(el,v);
  el.dispatchEvent(new w.Event("input",{bubbles:true}));};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("البداية بوضع المستعرض", !txt().includes("المشرف "));
  // تسجيل الدخول
  const lb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("دخول المحررين"));
  ok("زر دخول المحررين موجود", !!lb);
  if(lb){lb.click(); await wait(700);}
  const inp=Array.from(D.querySelectorAll("input")).find(i=>i.type==="password") || Array.from(D.querySelectorAll("input")).pop();
  if(inp){setN(inp,"admin4441"); await wait(300);}
  const sb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="دخول");
  if(sb){sb.click(); await wait(1200);}
  ok("تمّ الدخول كمشرف", txt().includes("تم الدخول كمشرف") || txt().includes("المشرف"));
  await wait(4000);
  const log = pushed && pushed.db && pushed.db.loginLog;
  ok("قيد الدخول كُتب في ملف السحابة", Array.isArray(log) && log.length>0);
  const last = log && log[log.length-1];
  ok("القيد يحمل الصفة", last && last.r==="المشرف");
  ok("القيد يحمل نوع الجهاز (جوال)", last && last.k==="جوال");
  ok("القيد يحمل النظام والمتصفح", last && last.o==="Android" && last.b==="Chrome");
  ok("القيد يحمل التاريخ والوقت", last && /هـ \d\d:\d\d/.test(last.t));
  console.log("   القيد:", JSON.stringify(last));
  // العرض بالدرج
  const tb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("⋯ أدوات"));
  if(tb){tb.click(); await wait(700);}
  const item=Array.from(D.querySelectorAll("div")).find(d=>(d.textContent||"").trim().startsWith("👤سجل دخول الفريق"));
  ok("عنصر سجل الدخول بالدرج (مشرف)", !!item);
  if(item){item.click(); await wait(800);}
  ok("النافذة تعرض القيد", txt().includes("سجل دخول الفريق") && txt().includes("Android"));
  ok("تنويه أن الزائر لا يُرصد", txt().includes("لا يُرصد"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
