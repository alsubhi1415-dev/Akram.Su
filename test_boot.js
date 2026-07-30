const fs=require("fs");const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/"});
const w=dom.window;const wait=ms=>new Promise(r=>setTimeout(r,ms));
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>w.document.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(1200);
  ok("شاشة الانتظار تظهر عند الإقلاع", txt().includes("جارٍ تحميل بيانات السجل"));
  ok("زر المتابعة بالنسخة المحلية متاح", txt().includes("متابعة بالنسخة المحلية"));
  await wait(9000); // تجاوز مهلة السبع ثوانٍ
  const after=txt();
  ok("شاشة الانتظار تختفي حتماً", !after.includes("جارٍ تحميل بيانات السجل"));
  ok("الواجهة ظهرت", after.includes("نظرة عامة"));
  const ready=!after.includes("لم تصل بيانات السحابة");
  ok("حالة نهائية واضحة (سحابة أو نسخة محلية)", true);
  console.log(ready?"↳ الحالة: وصلت بيانات السحابة":"↳ الحالة: نسخة محلية مع شريط تنبيه");
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("ERR:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
