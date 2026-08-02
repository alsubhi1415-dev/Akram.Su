// سطر موضوع البيان: موجز وملوّن — لا سرد لعشرات الجهات
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
const area=()=>D.getElementById("print-area")||D.getElementById("root");
const txt=()=>area().textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const inner=(pred)=>Array.from(D.querySelectorAll("div")).filter(d=>d.querySelectorAll("div").length===0).find(pred);
const openF=async(lbl)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(lbl)); if(b){b.click(); await wait(700);} return b;};
const pickAll=async()=>{const a=inner(d=>(d.textContent||"").trim().startsWith("✓ تحديد الكل")); if(a){a.click(); await wait(800);}};
const pickOne=async(name)=>{const l=Array.from(D.querySelectorAll("label")).find(x=>(x.textContent||"").trim()===name); if(l){const cb=l.querySelector('input'); if(cb) cb.click(); await wait(800);} return !!l;};
const closeF=async()=>{const ov=Array.from(D.querySelectorAll("div")).find(d=>(d.getAttribute("style")||"").includes("z-index: 55")); if(ov){ov.click(); await wait(500);}};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("التقارير والبيانات",1800);
  // تحديد كل الجهات = «الكل» فلا تُذكر
  await openF("الشعبة / الجهة"); await pickAll(); await closeF();
  let t=txt();
  ok("تحديد كل الجهات لا يُسرد بالعنوان", !t.includes("الشعبة / الجهة:"));
  // إزالة واحدة → يصير التحديد جزئياً وكثيراً → يُختصر بعدد
  await openF("الشعبة / الجهة");
  const boxes=Array.from(D.querySelectorAll('input[type="checkbox"]')).filter(b=>b.checked);
  if(boxes.length){ boxes[0].click(); await wait(800); }
  await closeF();
  t=txt();
  ok("التحديد الكثير يُختصر بعدده", /الشعبة \/ الجهة:\s*\d+\s*جهة/.test(t));
  ok("لا سرد لأسماء الجهات", !/الشعبة \/ الجهة:\s*شعبة/.test(t));
  // مسح ثم اختيار جهة واحدة → تُذكر باسمها
  await openF("الشعبة / الجهة");
  const clr=inner(d=>(d.textContent||"").trim().startsWith("✕ مسح التحديد")); if(clr){clr.click(); await wait(700);}
  const got=await pickOne("شعبة الحمدانية");
  await closeF();
  t=txt();
  ok("جهة واحدة تُذكر باسمها", !got || t.includes("الشعبة / الجهة: شعبة الحمدانية"));
  // حالة فنية واحدة بلونها
  const stBtn=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("الحالة الفنية"));
  if(stBtn){ stBtn.click(); await wait(700); await pickOne("عطلانة"); await closeF(); }
  t=txt();
  ok("الحالة الفنية تظهر بالعنوان", t.includes("الحالة الفنية: عطلانة"));
  const seg=Array.from(area().querySelectorAll("span")).find(x=>(x.textContent||"").includes("الحالة الفنية: عطلانة"));
  const st=(seg&&seg.getAttribute("style"))||"";
  ok("لون الحالة مطابق لجدول الحالات", /#E0575F|rgb\(224,\s*87,\s*95\)/i.test(st));
  const seg2=Array.from(area().querySelectorAll("span")).find(x=>(x.textContent||"").includes("الشعبة / الجهة:"));
  ok("لون الجهة مختلف عن لون الحالة", !seg2 || !(seg2.getAttribute("style")||"").includes("#E0575F"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
