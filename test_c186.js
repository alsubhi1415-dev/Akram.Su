// بيان الـ186: السؤال المفصلي وحده يُعرض، والحركات البديهية تُلخّص وتُعتمد بضغطة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const norm=p=>(p||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g,"");
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
const V=base.db.vehicles;
// نبني بياناً بأربع آليات: واحدة تحتاج سؤالاً وثلاث حركات بديهية
const pick=(f)=>V.find(f);
const askV = pick(v=>(v.status||"").trim()==="عطلانة" && (v.faults||[]).some(f=>!f.repairDate));
const fixV1= pick(v=>(v.status||"").trim()==="تم الإصلاح");
const fixV2= pick(v=>(v.status||"").trim()==="تعمل");
const rejV = pick(v=>(v.status||"").includes("الرجيع"));
base.db.cohort186={ name:"بيان اختبار", createdAt:"1448/02/01", items:{
  [norm(askV.plate)]:{ st:"fixed", at:1, sig:"تم الإصلاح|" },     // كانت مُصلَحة ثم تعطلت ← سؤال
  [norm(fixV1.plate)]:{ st:"broken", at:1, sig:"عطلانة|قديم" },   // صارت مُصلَحة ← بديهي
  [norm(fixV2.plate)]:{ st:"broken", at:1, sig:"عطلانة|قديم" },   // صارت تعمل ← بديهي
  [norm(rejV.plate)]:{ st:"broken", at:1, sig:"عطلانة|قديم" },    // أُحيلت للرجيع ← بديهي
}};
const DATA=JSON.stringify(base);
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("التقارير والبيانات",1600);
  await click("بيان أعطال الـ 186 آلية",2200);
  const t=txt();
  ok("لوحة المراجعة ظهرت", t.includes("مراجعة تغييرات بعد آخر تحديث"));
  ok("العنوان يذكر عدد ما يحتاج قرارك", /تحتاج قرارك/.test(t));
  ok("النص يشرح السؤال المفصلي", t.includes("هل عاودها العطل نفسه أم أصابها عطل جديد مختلف"));
  ok("زرّا السؤال المفصلي معروضان", t.includes("له علاقة بالعطل السابق") && t.includes("عطل جديد مختلف"));
  ok("الحركات البديهية ملخّصة لا مسؤول عنها", t.includes("حركات بديهية لا تحتاج سؤالاً"));
  ok("الملخّص يفصّل الوجهتين", /إلى بيان ما تم إصلاحه/.test(t) && /إلى بيان الرجيع/.test(t));
  // لا أزرار توجيه فردية للآليات البديهية
  const btns=Array.from(D.querySelectorAll("button")).map(b=>(b.textContent||"").trim());
  const perRow=btns.filter(x=>x==="لبيان المتعطلة"||x==="نقلها لبيان ما تم إصلاحه"||x==="لبيان الرجيع").length;
  ok("لا أزرار توجيه فردية للحركات البديهية", perRow===0);
  ok("زر الاعتماد الجماعي موجود", btns.some(x=>x.includes("اعتماد الحركات الواضحة")));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
