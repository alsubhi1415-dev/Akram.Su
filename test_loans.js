// إعارة الآليات: الحقل بنموذج العطل + بطاقة الإعارات القائمة
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
// قاعدة مُهيّأة: وايت متعطل بإعارة قائمة، وسلّم مُصلَح بإعارة مغلقة، ووايت رجيع بإعارة (يجب تجاهله)
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
const V=base.db.vehicles;
const pick=(pred)=>V.find(pred);
const norm=p=>(p||"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g,"");
const src=fs.readFileSync(__dirname+"/fleet-database.jsx","utf8");
const grab=(n)=>{const i=src.indexOf('name: "'+n+'"');const j=src.indexOf("plates: [",i);const k=src.indexOf("]",j);
  return new Set((src.slice(j,k).match(/"[^"]+"/g)||[]).map(x=>x.slice(1,-1)));};
const RES=grab("الانقاذات"), LAD=grab("السلالم");
const wcols=(()=>{const i=src.indexOf("const WEEKLY_COLS = [");let d=0,e=0;const r=src.slice(i+"const WEEKLY_COLS = ".length);
  for(let k=0;k<r.length;k++){if(r[k]==="[")d++;else if(r[k]==="]"){d--;if(d===0){e=k+1;break;}}}
  return JSON.parse(r.slice(0,e));})();
const WH=new Set(); ["وايت روزنباور بروبلين مطور","وايت ماء","وايت جبلي"].forEach(n=>{
  const c=wcols.find(x=>x.name===n); if(c)(c.plates||[]).forEach(p=>WH.add(norm(p)));});
["بدق3669","بدق3654","بدق3664","بدق3659","اين3852","اين3851","اين3866","اين3859","اين3860"].forEach(p=>WH.delete(p));
const w=pick(v=>WH.has(norm(v.plate)));
w.status="عطلانة"; w.unit="شعبة الجامعة";
w.faults=[{_id:1,faultType:"ميكانيكي",date:"1448/02/01",desc:"عطل مضخة",cover:"قسم الدعم والإسناد"}];
const l=pick(v=>LAD.has(norm(v.plate)));
l.status="تم الإصلاح"; l.unit="شعبة المروة";
l.faults=[{_id:2,faultType:"كهربائي",date:"1448/01/20",repairDate:"1448/02/10",desc:"عطل سابق",cover:"شعبة الشاطئ"}];
const rj=V.filter(v=>WH.has(norm(v.plate)))[3];
rj.status="صدر قرار الرجيع"; rj.unit="شعبة خزام";
rj.faults=[{_id:3,faultType:"ميكانيكي",date:"1448/01/05",desc:"رجيع",cover:"شعبة المروة"}];
const jeep=pick(v=>!WH.has(norm(v.plate))&&!RES.has(norm(v.plate))&&!LAD.has(norm(v.plate))&&(v.type||"").includes("جيب"));
jeep.status="عطلانة"; jeep.faults=[];
const DATA=JSON.stringify(base);
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(x){try{x.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} x.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // --- بطاقة الإعارات ---
  await click("الصفحة الرئيسية",1200);
  const dt=Array.from(D.querySelectorAll(".cmd-tab")).find(t=>(t.textContent||"").includes("مركز القرار"));
  if(dt){dt.click(); await wait(1500);}
  const tb=Array.from(D.querySelectorAll(".grid-btn")).find(b=>(b.textContent||"").includes("الإعارات"));
  ok("تبويب «الإعارات» موجود", !!tb);
  ok("عدّاد التبويب = 2 (قائمة + قابلة للإعادة)", tb && /\(\s*2\s*\)/.test(tb.textContent));
  if(tb){tb.click(); await wait(1000);}
  const t=txt();
  ok("الإعارة المفتوحة معروضة", t.includes("قسم الدعم والإسناد") && t.includes("شعبة الجامعة"));
  ok("الإعارة المُصلَحة تظهر ضمن «قابلة للإعادة»", t.includes("قابلة للإعادة الآن"));
  ok("زر «تمت الإعادة» متاح للمشرف", Array.from(D.querySelectorAll("button")).some(b=>(b.textContent||"").trim()==="تمت الإعادة"));
  ok("إعارة آلية الرجيع مستثناة", !t.includes("رجيع") || !t.includes("شعبة خزام"));
  ok("عمر الإعارة بالأيام ظاهر", /يوماً/.test(t));
  // --- الحقل داخل نموذج العطل ---
  await click("سجل الآليات",1400);
  const inp=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("بحث"));
  const setN=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
  if(inp){setN(inp,w.plate); await wait(900);}
  const row=D.querySelector("table.fleet-tbl tbody tr");
  if(row){row.click(); await wait(1200);}
  const addBtn=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="+ إضافة");
  if(addBtn){addBtn.click(); await wait(800);}
  const labels=Array.from(D.querySelectorAll("div,span,label")).map(e=>e.textContent||"");
  ok("[وايت] حقل «غُطّي العجز بآلية من» ظاهر", txt().includes("غُطّي العجز بآلية من"));
  const sels=Array.from(D.querySelectorAll("select"));
  const cov=sels.find(s=>Array.from(s.options).some(o=>o.text==="قسم الدعم والإسناد"));
  ok("قائمة المصادر بها 14 خياراً (13 شعبة + الدعم)", cov && cov.options.length===15);
  // التصنيف باللوحات: صهريج ومباني عالية لا يظهر لهما الحقل
  const tank=V.find(v=>["بدق3669","بدق3654","اين3852"].includes(norm(v.plate)));
  const high=V.find(v=>(v.type||"").includes("مباني عالية"));
  const openFor=async(plate)=>{
    await click("سجل الآليات",1300);
    const bx=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("بحث"));
    if(bx){setN(bx,plate); await wait(900);}
    const r=D.querySelector("table.fleet-tbl tbody tr"); if(r){r.click(); await wait(1200);}
    const ab=Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="+ إضافة");
    if(ab){ab.click(); await wait(700);}
    return txt().includes("غُطّي العجز بآلية من");
  };
  if(tank) ok("[صهريج] لا يظهر حقل الإعارة", !(await openFor(tank.plate)));
  if(high) ok("[مباني عالية] لا يظهر حقل الإعارة", !(await openFor(high.plate)));
  // الشريط المتحرك بالصفحة الرئيسية
  await click("الصفحة الرئيسية",1400);
  const tk=D.querySelector(".tk-wrap");
  ok("الشريط المتحرك ظاهر", !!tk);
  const tks=tk?tk.textContent:"";
  ok("الشريط ينبّه بإمكان إعادة المُعارة", tks.includes("يمكن إعادة المُعارة"));
  ok("الشريط يذكر نسبة الجاهزية", tks.includes("نسبة الجاهزية الحالية"));
  ok("الشريط مستثنى من الطباعة", (tk.getAttribute("class")||"").includes("no-print"));
  ok("العناصر مضاعفة لدوران سلس", tk.querySelectorAll(".tk-item").length % 2 === 0);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
