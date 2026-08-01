// التصنيف الخاص «وايتات صهاريج» بصفحة التقارير
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
// نضمن وجود التسع لوحات بالقاعدة المستعملة للفحص
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
const PL=["ب د ق 3669","ب د ق 3654","ب د ق 3664","ب د ق 3659","ا ى ن 3852","ا ى ن 3851","ا ى ن 3866","ا ى ن 3859","ا ى ن 3860"];
const norm=p=>(p||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g,"");
const have=new Set(base.db.vehicles.map(v=>norm(v.plate)));
PL.forEach((p,i)=>{ if(!have.has(norm(p))) base.db.vehicles.push({
  id:"tank_"+i, type:i<4?"سيارة رآس تريلا سكس افيكو (صهريج)":"وايت ماء سقيا سكس مان (صهريج)",
  plate:p, unit:"قسم الدعم والإسناد الأول", model:"2015", location:"شعبة المروة",
  status:"تعمل", faults:[], transfers:[], createdAt:"2026-01-01" }); });
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
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("التقارير والبيانات",1800);
  const sel=Array.from(D.querySelectorAll("select")).find(s=>Array.from(s.options).some(o=>o.text.includes("التصنيف الخاص")));
  ok("قائمة «التصنيف الخاص» موجودة", !!sel);
  const opts=sel?Array.from(sel.options).map(o=>o.text):[];
  ok("خيار «وايتات صهاريج» مضاف", opts.includes("وايتات صهاريج"));
  ok("التصنيفات القديمة باقية", opts.includes("السلالم") && opts.includes("الانقاذات") && opts.includes("وايتات البروبلين") && opts.includes("المزدوجات"));
  ok("عدد التصنيفات 12 + الكل", opts.length===13);
  // اختيار التصنيف الجديد
  if(sel){
    const set=Object.getOwnPropertyDescriptor(W.HTMLSelectElement.prototype,"value").set;
    set.call(sel,"وايتات صهاريج"); sel.dispatchEvent(new W.Event("change",{bubbles:true}));
    await wait(1400);
  }
  const t=txt();
  ok("التقرير يعرض الصهاريج فقط", t.includes("صهريج"));
  ok("لا تظهر آليات خارج التصنيف", !t.includes("دراجة نارية ياماها"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
