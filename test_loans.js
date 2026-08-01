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
const w=pick(v=>(v.type||"").includes("وايت") && !(v.type||"").includes("سقيا"));
w.status="عطلانة"; w.unit="شعبة الجامعة";
w.faults=[{_id:1,faultType:"ميكانيكي",date:"1448/02/01",desc:"عطل مضخة",cover:"قسم الدعم والإسناد"}];
const l=pick(v=>(v.type||"").includes("سلالم"));
l.status="تم الإصلاح"; l.unit="شعبة المروة";
l.faults=[{_id:2,faultType:"كهربائي",date:"1448/01/20",repairDate:"1448/02/10",desc:"عطل سابق",cover:"شعبة الشاطئ"}];
const rj=V.filter(v=>(v.type||"").includes("وايت"))[3];
rj.status="صدر قرار الرجيع"; rj.unit="شعبة خزام";
rj.faults=[{_id:3,faultType:"ميكانيكي",date:"1448/01/05",desc:"رجيع",cover:"شعبة المروة"}];
const jeep=pick(v=>(v.type||"").includes("جيب"));
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
  const tb=Array.from(D.querySelectorAll(".grid-btn")).find(b=>(b.textContent||"").includes("الإعارات القائمة"));
  ok("تبويب «الإعارات القائمة» موجود", !!tb);
  ok("عدّاد التبويب = 1 (المفتوحة فقط)", tb && /\(\s*1\s*\)/.test(tb.textContent));
  if(tb){tb.click(); await wait(1000);}
  const t=txt();
  ok("الإعارة المفتوحة معروضة", t.includes("قسم الدعم والإسناد") && t.includes("شعبة الجامعة"));
  ok("الإعارة المغلقة بإصلاح لا تظهر", !t.includes("شعبة الشاطئ") || !t.includes("عطل سابق"));
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
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
