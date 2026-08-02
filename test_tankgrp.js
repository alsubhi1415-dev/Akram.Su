// التصنيف الخاص «وايتات صهاريج» بصفحة التقارير
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
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
// الآلية الجديدة: عربة الحرائق الصناعية بالبرج التلسكوبي (أُضيفت لقاعدة البيانات الحيّة)
if(!new Set(base.db.vehicles.map(v=>norm(v.plate))).has("بصا2621")) base.db.vehicles.push({
  id:"v_471_بصا2621", type:"عربة للحرائق الصناعية مع برج تلسكوبي", plate:"ب ص ا 2621",
  unit:"شعبة الدفاع المدني الميدانية بالصناعية", model:"2021", location:"ش روزنباور",
  status:"تعمل", faults:[], transfers:[], createdAt:"2026-08-02" });
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
  // كل لوحات التصنيفات الخاصة موجودة فعلياً بالقاعدة
  const src=fs.readFileSync(__dirname+"/fleet-database.jsx","utf8");
  const blk=src.slice(src.indexOf("const CUSTOM_GROUPS = ["), src.indexOf("function matchGroup"));
  const names=(blk.match(/name: "[^"]+"/g)||[]).map(x=>x.slice(7,-1));
  const nm=p=>(p||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g,"");
  const have=new Set(base.db.vehicles.map(v=>nm(v.plate)));
  let stale=0, lad=0;
  names.forEach(n=>{
    const i=blk.indexOf('name: "'+n+'"'); const j=blk.indexOf("plates: [",i);
    if(j<0||j>blk.indexOf("},",i)) return;
    const k=blk.indexOf("]",j);
    const pl=(blk.slice(j,k).match(/"[^"]+"/g)||[]).map(x=>x.slice(1,-1));
    if(n==="السلالم") lad=pl.length;
    pl.forEach(p=>{ if(!have.has(p)) stale++; });
  });
  ok("السلالم 14 لوحة", lad===14);
  // الآلية الجديدة: عربة الحرائق الصناعية بالبرج التلسكوبي
  const NEW="بصا2621", TWIN="بصا2622";
  const grp=(n)=>{const i=blk.indexOf('name: "'+n+'"'); const j=blk.indexOf("plates: [",i); const k=blk.indexOf("]",j);
    return (blk.slice(j,k).match(/"[^"]+"/g)||[]).map(x=>x.slice(1,-1));};
  ok("[نوعية] الجديدة مضافة والعدد 34", grp("الآليات النوعية").includes(NEW) && grp("الآليات النوعية").length===34);
  ok("[صناعية] الجديدة مضافة والعدد 4", grp("عربات الحرائق الصناعية").includes(NEW) && grp("عربات الحرائق الصناعية").length===4);
  ok("[بيان 186] لم يتغيّر عدده", grp("بيان 186 آلية").length===186 && !grp("بيان 186 آلية").includes(NEW));
  ok("[نموذج 2] عمود الحرائق الصناعية أربع لوحات", /"name": "اطفاء الحرائق الصناعية", "plates": \["اقي2545", "اقي2546", "بصا2621", "بصا2622"\]/.test(src));
  ok("[النوعي] العمود نفسه أربع لوحات", src.includes('"n":"اطفاء الحرائق الصناعية","p":["اقي2545","اقي2546","بصا2621","بصا2622"]'));
  ok("الجديدة حيثما وُجد توأمها عدا بيان 186", ["الآليات النوعية","عربات الحرائق الصناعية"].every(n=>grp(n).includes(TWIN)&&grp(n).includes(NEW)));
  ok("لا لوحات مسحوبة في أي تصنيف", stale===0);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
