// الآلية الجديدة ب ص ا 2621 تظهر بالعدد 4 في كل تقرير يخصّها
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
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||1000);}return !!b;};
const colCount=(tbl,head)=>{
  const rows=Array.from(tbl.querySelectorAll("tr"));
  let idx=-1;
  for(const r of rows){
    const cs=Array.from(r.querySelectorAll("th,td")).map(e=>e.textContent.trim());
    const k=cs.findIndex(c=>c===head||c.replace(/\s+/g," ")===head);
    if(k>-1){ idx=k; break; }
  }
  if(idx<0) return null;
  const mal=rows.find(r=>(r.textContent||"").includes("ملاك"));
  if(!mal) return null;
  const cs=Array.from(mal.querySelectorAll("th,td")).map(e=>e.textContent.trim());
  return cs[idx];
};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("إجمالي الآليات 639", txt().includes("639"));
  // سجل الآليات: البحث عن اللوحة
  await click("سجل الآليات",1400);
  const bx=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("بحث"));
  const setN=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
  if(bx){setN(bx,"2621"); await wait(1000);}
  ok("[السجل] الآلية الجديدة ظاهرة", txt().includes("عربة للحرائق الصناعية مع برج تلسكوبي"));
  if(bx){setN(bx,""); await wait(700);}
  // التقرير الأسبوعي (نموذج 2)
  await click("التقارير والبيانات",1600);
  await click("تقرير الأعطال الأسبوعي",2400);
  let tbl=Array.from(D.querySelectorAll("table")).find(x=>(x.textContent||"").includes("اطفاء الحرائق الصناعية"));
  ok("[نموذج 2] الجدول موجود", !!tbl);
  ok("[نموذج 2] ملاك عمود الحرائق الصناعية = 4", tbl && colCount(tbl,"اطفاء الحرائق الصناعية")==="4");
  // التقرير النوعي
  await click("التقارير والبيانات",1400);
  await click("تقرير التكميل النوعي",2400);
  tbl=Array.from(D.querySelectorAll("table")).find(x=>(x.textContent||"").includes("اطفاء الحرائق الصناعية"));
  ok("[النوعي] الجدول موجود", !!tbl);
  ok("[النوعي] ملاك العمود = 4", tbl && colCount(tbl,"اطفاء الحرائق الصناعية")==="4");
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
