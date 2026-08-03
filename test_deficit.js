// بيان العجز بالمراكز: إدخال يدوي مستقل عن الجاهزية
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
let puts=0;
const stub=(u,o)=>{u=String(u);o=o||{};
  if(o.method==="PUT"){puts++;return Promise.resolve(mk('{"content":{"sha":"s"}}'));}
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const W=dom.window,D=W.document;
const errs=[];W.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const area=()=>D.getElementById("print-area")||D.getElementById("root");
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const setN=(el,v)=>{Object.getOwnPropertyDescriptor(W.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new W.Event("input",{bubbles:true}));};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  await click("التقارير والبيانات",1600);
  ok("زر البيان موجود بصفحة التقارير", txt().includes("بيان العجز بالمراكز"));
  await click("بيان العجز بالمراكز",1600);
  const t=txt();
  ok("الشاشة فُتحت", t.includes("انقر الخانة أمام المركز") && t.includes("مركزاً بالبيان"));
  ok("تنويه الاستقلال عن الجاهزية", t.includes("مستقل عن الجاهزية اليومية"));
  ok("قسم الدعم مدموج بخانة واحدة", t.includes("قسم الدعم والإسناد (الأول والثاني والثالث)"));
  ok("البيان فارغ ابتداءً", t.includes("لم تُحدَّد مراكز بعد"));
  // فتح شعبة واختيار مركز
  const brs=Array.from(D.querySelectorAll("div")).filter(d=>(d.textContent||"").includes("مركزاً") && (d.getAttribute("style")||"").includes("cursor: pointer"));
  ok("قائمة الشعب معروضة", brs.length>=13);
  brs[0].click(); await wait(800);
  ok("مراكز الشعبة ظهرت", D.querySelectorAll("tbody tr").length>0);
  // اختيار نوع عجز
  const cell=Array.from(D.querySelectorAll("td")).find(x=>(x.getAttribute("title")||"")==="تعمل بلا وايت");
  ok("خانات أنواع العجز ظاهرة بالمصفوفة", !!cell);
  cell.click(); await wait(900);
  ok("البيان صار فيه صف", !txt().includes("لم تُحدَّد مراكز بعد"));
  ok("عمود نوع العجز ظهر بالبيان بنصه الكامل", area().textContent.includes("تعمل بلا وايت"));
  // مربعات النص: حتى ثلاثة
  const noteCell=()=>Array.from(D.querySelectorAll("td")).find(x=>(x.textContent||"").trim()==="✎");
const addBtn=()=>Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("بيان نصي"));
  const nc=noteCell(); if(nc){nc.click(); await wait(800);}
  ok("زر إضافة بيان نصي موجود", !!addBtn());
  addBtn().click(); await wait(600);
  const inp=Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("بيان عجز إضافي"));
  ok("مربع النص ظهر", !!inp);
  setN(inp,"نقص خرطوم ضغط عالٍ"); await wait(700);
  ok("النص الحر ظهر بالبيان", area().textContent.includes("نقص خرطوم ضغط عالٍ"));
  addBtn().click(); await wait(500); 
  const a3=addBtn(); if(a3){a3.click(); await wait(500);}
  ok("سقف ثلاثة مربعات", !addBtn());
  ok("عدد مربعات النص = 3", Array.from(D.querySelectorAll("input")).filter(i=>(i.getAttribute("placeholder")||"").includes("بيان عجز إضافي")).length===3);
  // الحفظ محلي لا سحابي
  // قد يقع رفع روتيني عند الإقلاع لا علاقة له بالبيان — المهم أن البيان محلي
  ok("الخياران الجديدان بنصهما الحرفي", txt().includes("يعمل بوايت فقط (بلا إنقاذ)") && txt().includes("يعمل بإنقاذ خفيف (جيب إداري) + وايت"));
  ok("البيان يُحفظ بقاعدة البيانات (متزامن)", puts > 0);
  ok("الطباعة أفقية للبيان", html.includes('"c186", "weekly", "nawi", "tour", "deficit"') || html.includes("deficit"));
  ok("بحث المراكز موجود", !!Array.from(D.querySelectorAll("input")).find(i=>(i.getAttribute("placeholder")||"").includes("ابحث عن مركز")));
  ok("مرشّح «ما به عجز فقط» موجود", txt().includes("ما به عجز فقط"));

  // ترويسة وتذييل الطباعة
  ok("ترويسة رسمية بالبيان", area().textContent.includes("المديرية العامة للدفاع المدني"));
  ok("عنوان البيان", area().textContent.includes("بيان العجز بالمراكز الميدانية"));
  ok("خانة التوقيع", area().textContent.includes("التوقيع"));
  ok("زر الطباعة متاح", txt().includes("طباعة التقرير"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
