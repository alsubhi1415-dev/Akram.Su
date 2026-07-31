// بطاقات صفحة الجاهزية: التسميات والألوان والنسب + زر التقرير
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
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",beforeParse(w){w.fetch=stub;}});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1200);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("الجاهزية الميدانية",1800);
  const t=txt();
  ok("بطاقة «المراكز مكتملة الجاهزية»", t.includes("المراكز مكتملة الجاهزية"));
  ok("بطاقة «مراكز يوجد بها نقص بسيط بالجاهزية»", t.includes("مراكز يوجد بها نقص بسيط بالجاهزية"));
  ok("بطاقة «مراكز يوجد بها عجز مؤثر»", t.includes("مراكز يوجد بها عجز مؤثر"));
  ok("لا أثر للتسميات القديمة", !t.includes("جاهزية مكتملة (أخضر)") && !t.includes("نقص متطلبات المركز (أصفر)") && !t.includes("عجز كامل"));
  ok("نسبة مئوية تحت كل بطاقة (ثلاث نسب)", (t.match(/% من المراكز/g)||[]).length >= 3);
  ok("ألوان البطاقات مبنيّة", html.includes("#F1FAF5") && html.includes("#FEF9EE") && html.includes("#FDF2F3"));
  const pb=Array.from(D.querySelectorAll("button.print-dark"));
  ok("زر التقرير بمقاس الشبكة ولون أغمق", pb.length===1 && pb[0].className.includes("grid-btn"));
  ok("زر التقرير يحمل رمز الطابعة", pb[0] && !!pb[0].querySelector("img"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
