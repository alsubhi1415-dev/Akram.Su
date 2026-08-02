// الشريط المتحرك: وجوده ومحتواه وحركته الفعلية
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
  beforeParse(w){ w.fetch=stub; }});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const tx=(el)=>{const s=(el.getAttribute("style")||"").match(/translateX\(([-\d.]+)px\)/); return s?parseFloat(s[1]):null;};
(async()=>{
  await wait(6000); await wait(3000);
  const tk=D.querySelector(".tk-wrap");
  ok("الشريط ظاهر بالصفحة الرئيسية", !!tk);
  ok("مستثنى من الطباعة", tk && (tk.getAttribute("class")||"").includes("no-print"));
  const track=tk && tk.querySelector(".tk-track");
  ok("مسار الشريط موجود", !!track);
  const items=track?Array.from(track.querySelectorAll(".tk-item")):[];
  ok("العناصر مضاعفة للدوران السلس", items.length>0 && items.length%2===0);
  const t=tk?tk.textContent:"";
  ok("يعرض نسبة الجاهزية", t.includes("نسبة الجاهزية الحالية"));
  ok("يعرض المتعطلة حالياً", t.includes("متعطلة حالياً"));
  ok("يعرض المتوقفة أكثر من 90 يوماً", t.includes("متوقفة أكثر من 90 يوماً"));
  ok("يعرض أعطال الآليات النوعية", /الآليات النوعية:\s*\d+/.test(t));
  ok("عدد النوعية 34 كما بالتصنيف الخاص", /من\s*34/.test(t) || /34\s*جاهزة/.test(t));
  // الحركة الفعلية: يجب أن يتغيّر الإزاحة مع الوقت
  if(track){ track.scrollWidth = 4000; Object.defineProperty(track,"scrollWidth",{value:4000,configurable:true}); }
  await wait(400);
  const a=tx(track);
  await wait(900);
  const b=tx(track);
  ok("الشريط يتحرك فعلاً", a!==null && b!==null && b<a);
  console.log("   الإزاحة: "+a+"px ← ثم "+b+"px");
  // التوقف عند المرور
  tk.dispatchEvent(new W.MouseEvent("mouseover",{bubbles:true}));
  tk.dispatchEvent(new W.MouseEvent("mouseenter",{bubbles:true}));
  await wait(300);
  const c1=tx(track); await wait(700); const c2=tx(track);
  ok("يتوقف عند وضع المؤشر", c1===c2);
  tk.dispatchEvent(new W.MouseEvent("mouseout",{bubbles:true}));
  tk.dispatchEvent(new W.MouseEvent("mouseleave",{bubbles:true}));
  await wait(700);
  ok("يستأنف بعد إبعاد المؤشر", tx(track)<c2);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
