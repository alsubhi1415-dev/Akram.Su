// شريط تبويبات مساحة القيادة: الشكل الجديد والرموز الثلاثة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}",404));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ w.fetch=stub; }});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  const bar=D.querySelector(".cmd-tabs");
  ok("شريط التبويبات بالشكل الجديد", !!bar);
  const tabs=bar?Array.from(bar.querySelectorAll(".cmd-tab")):[];
  ok("ثلاثة تبويبات", tabs.length===3);
  ok("لكل تبويب رمز مصوّر", tabs.every(t=>{const i=t.querySelector("img.ct-img");return i && String(i.getAttribute("src")).indexOf("data:image/png")===0;}));
  const labels=tabs.map(t=>(t.querySelector(".ct-lb")||{}).textContent);
  ok("العبارات الثلاث صحيحة", JSON.stringify(labels)===JSON.stringify(["نظرة عامة","لوحة المعلومات","مركز القرار"]));
  ok("الرموز الثلاثة مختلفة", new Set(tabs.map(t=>t.querySelector("img.ct-img").getAttribute("src"))).size===3);
  ok("التبويب الأول نشط", tabs[0].className.includes("act"));
  tabs[1].click(); await wait(700);
  const tabs2=Array.from(D.querySelectorAll(".cmd-tab"));
  ok("النقر ينقل النشاط", tabs2[1].className.includes("act") && !tabs2[0].className.includes("act"));
  ok("محتوى لوحة المعلومات ظهر", txt().includes("إجمالي الآليات"));
  tabs2[2].click(); await wait(900);
  ok("تبويب مركز القرار يعمل", Array.from(D.querySelectorAll(".cmd-tab"))[2].className.includes("act"));
  ok("تنسيق الجوال: أيقونة فوق النص", html.includes("flex-direction: column; gap: 4px; padding: 8px 3px;"));
  ok("تنسيق النشط بتدرّج وخط ذهبي", html.includes("inset 0 -3px 0 #D4AF37"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
