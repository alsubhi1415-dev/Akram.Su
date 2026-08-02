// كلمات المرور الجديدة: الدخول بالصلاحيتين وفكّ رمز الكتابة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
function run(pw, expect){
  let puts=[], authOK=null;
  const stub=(u,o)=>{u=String(u);o=o||{};
    if(o.method==="PUT"){ authOK=(o.headers&&(o.headers.Authorization||o.headers.authorization))||""; puts.push(u.split("/contents/")[1]);
      return Promise.resolve(mk('{"content":{"sha":"s"}}')); }
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk('{"sha":"x"}'));};
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",beforeParse(w){w.fetch=stub;}});
  return {w:dom.window, puts:()=>puts, auth:()=>authOK};
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const setN=(W,el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
async function login(ctx,pw){
  const W=ctx.w, D=W.document;
  const lb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("دخول المحررين"));
  if(lb){lb.click(); await wait(700);}
  const inp=Array.from(D.querySelectorAll("input")).find(i=>i.type==="password")||Array.from(D.querySelectorAll("input")).pop();
  if(inp){setN(W,inp,pw); await wait(300);}
  const sb=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="دخول");
  if(sb){sb.click(); await wait(1400);}
  return D.getElementById("root").textContent;
}
(async()=>{
  // مشرف
  const a=run(); await wait(6000); await wait(3000);
  let t=await login(a,"1322144");
  ok("[1322144] دخل كمشرف", t.includes("المشرف"));
  // محرر
  const b=run(); await wait(6000); await wait(2500);
  t=await login(b,"1010");
  ok("[1010] دخل كمحرر جاهزية", t.includes("محرر جاهزية"));
  // كلمة قديمة يجب أن تُرفض
  const c=run(); await wait(6000); await wait(2500);
  t=await login(c,"admin4441");
  ok("[كلمة قديمة] مرفوضة", !t.includes("المشرف") && !t.includes("محرر جاهزية"));
  const d=run(); await wait(6000); await wait(2500);
  t=await login(d,"4441");
  ok("[كلمة المحرر القديمة] مرفوضة", !t.includes("محرر جاهزية") && !t.includes("المشرف"));
  // رمز الكتابة يُفكّ فعلاً: حفظ يرفع بترويسة تحمل الرمز
  const D=a.w.document, W=a.w;
  const nav=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")==="سجل الآليات");
  if(nav){nav.click(); await wait(1200);}
  const f=Array.from(D.querySelectorAll("button")).find(x=>x.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(D.querySelectorAll("select")).slice(-3);
  const setS=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLSelectElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("change",{bubbles:true}));};
  if(sels.length>=3){setS(sels[0],"9");await wait(120);setS(sels[1],"2");await wait(120);setS(sels[2],"1448");await wait(120);}
  const ta=Array.from(D.querySelectorAll("textarea")).pop();
  if(ta){Object.getOwnPropertyDescriptor(W.HTMLTextAreaElement.prototype,"value").set.call(ta,"فحص كلمة المرور");ta.dispatchEvent(new W.Event("input",{bubbles:true}));await wait(200);}
  const sv=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(2500);}
  await wait(2500);
  ok("رمز الكتابة فُكّ ورُفع الملف", a.puts().includes("data.json"));
  ok("ترويسة الرفع تحمل رمزاً حقيقياً", /Bearer gh\w/.test(String(a.auth()||"")));
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
