const fs=require("fs"), {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const data=JSON.parse(fs.readFileSync(__dirname+"/data.json","utf8"));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[]; const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.print=function(){};w.IntersectionObserver=class{constructor(cb){this.cb=cb;}observe(el){this.cb([{isIntersecting:true,target:el}]);}disconnect(){}};w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),16);try{w.localStorage.setItem("cdfleet::cd-fleet:db",JSON.stringify(data.db));}catch(e){}}});
  const w=dom.window,doc=w.document; const errs=[]; w.addEventListener("error",e=>errs.push(e.message));
  await wait(9500);
  ok("التطبيق الأساسي يقلع",(doc.getElementById("root").textContent||"").length>200);
  ok("لا أخطاء تشغيل",errs.length===0); if(errs.length)console.log("ERR:",errs.slice(0,3));
  ok("اسم أكرم في تذييل التطوير بجوار فارس",doc.body.textContent.includes("أكرم")&&doc.body.textContent.includes("فارس"));
  var _srcDec=html.replace(/\\u([0-9A-Fa-f]{4})/g,function(m,h){return String.fromCharCode(parseInt(h,16));});ok("اسم أكرم عاد لكل التقارير + التذييل (7 مواضع)",(_srcDec.match(/أكرم/g)||[]).length>=7);
  const rail=doc.querySelector(".side-rail");
  ok("عنصر الصيانة بالقائمة الجانبية",rail&&rail.textContent.includes("الصيانة الوقائية"));
  ok("لا زر أدوات المنصة",!doc.getElementById("fd31-tools-fab"));
  ok("زر المساعد داخل القائمة الجانبية لا عائم",!doc.getElementById("fd31-dock")&&!!doc.getElementById("fd31-rail-ai")&&doc.getElementById("fd31-rail-ai").parentNode===rail);

  doc.getElementById("fd31-rail-ai").click(); await wait(600);
  const q=doc.getElementById("fd31-q");
  const ask=async t=>{q.value=t;doc.getElementById("fd31-send").click();await wait(480);const b=doc.querySelectorAll("#fd31-msgs .fd31-msg.bot");return b[b.length-1];};
  ok("المساعد يفتح",doc.getElementById("fd31-ai").classList.contains("open"));

  // عدّ + تصنيف خاص
  ok("العدّ 639",(await ask("كم عدد الآليات")).textContent.includes("639"));
  ok("البروبلين 83",(await ask("كم البروبلين")).textContent.includes("83"));

  // السؤال المركّب الكامل
  const mc=await ask("الانقاذ المائي كم واحد متعطل وكم عربة زلازل شغالة وكم حريق صناعية شغالة الان واين موقعها كم الية واقفة في الصيانة وكم واقف بالشعب كلها");
  ok("إجابة مركّبة (بطاقة multi)",!!mc.querySelector(".fd31-multi"));
  ok("المركّب: 5 بنود",mc.querySelectorAll(".fd31-mc").length===5);
  ok("المركّب يذكر الإنقاذات متعطل 35",mc.textContent.includes("الانقاذات")&&mc.textContent.includes("35"));
  ok("المركّب يتعرّف على الزلازل",mc.textContent.includes("الزلازل"));
  ok("المركّب: الصيانة كموقع",mc.textContent.includes("الصيانة"));
  ok("المركّب: مواقع الشُّعب",mc.textContent.includes("الشُّعب"));

  // توريث الموضوع
  const inh=await ask("كم سلالم تعمل وكم متعطلة");
  ok("توريث الموضوع: كلاهما سلالم",(inh.textContent.match(/السلالم/g)||[]).length>=2);

  // بُعد الموقع مفرد
  // أعداد مواقع الصيانة تُحسب ديناميكياً من data.json (لا أرقام متيبّسة تتهرّأ مع حركة الآليات)
  const _nrm=t=>String(t||"").replace(/[\u0640]/g,"").replace(/\u0629/g,"\u0647").replace(/[\u0623\u0625\u0622]/g,"\u0627").trim();
  const _locCnt=k=>data.db.vehicles.filter(v=>_nrm(v.location).includes(_nrm(k))).length;
  const _cm=_locCnt("الصيانة المركزية"), _rz=_locCnt("روزنباور");
  ok("في الصيانة المركزية = "+_cm+" (ديناميكي)",(await ask("كم آلية في الصيانة المركزية")).textContent.includes(String(_cm)));
  ok("في روزنباور = "+_rz+" (موقع لا صانع، ديناميكي)",(await ask("كم آلية في روزنباور")).textContent.includes(String(_rz)));

  // أين موقعها
  const wh=await ask("كم عطلانة في شعبة أبحر وأين موقعها");
  ok("أين موقعها يعرض المواقع",wh.textContent.includes("المواقع")||wh.textContent.includes("مواقعها")||wh.textContent.includes("📍"));

  // === الدفعة السابعة: المسميات النوعية + التوزيع/التكميل ===
  ok("سلم 32 متر (فئة دقيقة) = 6",(await ask("كم سلم 32 متر")).textContent.includes("6"));
  ok("سلالم بيرس يُتعرّف عليه",(await ask("كم سلالم بيرس")).textContent.includes("بيرس"));
  ok("الرافعات = 2",(await ask("كم الرافعات")).textContent.includes("2"));
  ok("صهريج المباني العالية = 4",(await ask("كم صهريج المباني العالية")).textContent.includes("4"));
  const dist=await ask("توزيع السلالم على الشُّعب");
  ok("توزيع على الشُّعب يعرض أشرطة",dist.querySelectorAll(".fd31-bar").length>2);
  ok("التوزيع يذكر النقص/التكميل",dist.textContent.includes("ينقص")||dist.textContent.includes("بلا")||dist.textContent.includes("مكتمل"));
  const gap=await ask("أي شعبة ينقصها سلم 32 متر");
  ok("كشف نقص الشُّعب",gap.textContent.includes("بلا")||gap.textContent.includes("ينقص")||gap.textContent.includes("مكتمل"));
  const eq=await ask("ما هو التليسكوب");
  ok("المعدة النوعية تُشرح لا تُعدّ",eq.textContent.includes("جاهزية")&&eq.textContent.includes("مركز"));
  ok("مزدوجة روزنباور = المزدوجات 63",(await ask("كم مزدوجة روزنباور")).textContent.includes("63"));

  // الدفعة الثامنة: توحيد إملاء الماركات
  const chevA=(await ask("كم سيارة شفروليه لنقل التنفس")).textContent;
  const chevB=(await ask("كم سيارة شفرليت لنقل التنفس")).textContent;
  ok("شفروليه = شفرليت (نفس النوع)", chevA.includes("5")&&chevB.includes("5"));
  const diA=(await ask("كم جيب دايهاتسو")).textContent;
  const diB=(await ask("كم جيب ديهاتسو")).textContent;
  ok("دايهاتسو = ديهاتسو", diA.includes("45")&&diB.includes("45"));
  ok("جيب دايهاتسو سلامة يبقى 11",(await ask("كم جيب دايهاتسو سلامة")).textContent.includes("11"));

  // الدفعة التاسعة: داشبورد غرفة العمليات في صفحة المؤشرات
  const chartsBtn=Array.from(rail.querySelectorAll("button")).find(x=>(x.title||"").includes("المؤشرات"));
  if(chartsBtn){ chartsBtn.click(); await wait(1800); }
  const od=doc.getElementById("fd-ops-dash");
  ok("مرساة الداشبورد في المؤشرات",!!od);
  ok("الداشبورد بُني (IO)",od&&!!od.querySelector(".ops-wrap"));
  ok("مؤشر الجاهزية الدائري",od&&!!od.querySelector(".ops-gauge-fill"));
  ok("6 بطاقات KPI",od&&od.querySelectorAll(".ops-kpi").length===6);
  ok("لوحة جاهزية 12 شعبة",od&&od.querySelectorAll(".ops-brow").length===12);
  ok("نبض الأعطال",od&&!!od.querySelector(".ops-pulse"));
  ok("خريطة الشُّعب التفاعلية (12 عقدة)",od&&od.querySelectorAll(".ops-node").length===12);
  var _isk=od&&Array.from(od.querySelectorAll(".ops-node")).find(function(g){return g.getAttribute("data-b")==="الاسكان";});
  ok("عقدة الإسكان موجودة",!!_isk);
  if(_isk){_isk.dispatchEvent(new w.Event("click",{bubbles:true})); await wait(60); var _dd=od.querySelector("#ops-map-detail"); var _dt=_dd.textContent; ok("الإسكان يعرض آليات + تسميات واضحة",/28|2[0-9]/.test(_dt)&&_dt.indexOf("إجمالي آليات الشعبة")>=0&&!!_dd.querySelector(".omd-pctl")); ok("بطاقات آليات الشعبة الشبكية",_dd.querySelectorAll(".omd-veh").length>0&&!!_dd.querySelector(".omd-veh-p"));}
  // ملخّص المعروض (وحدة مباشرة)
  var _div=doc.createElement("div"); var _sample=(w.__FD31_VEH__||[]).slice(0,50);
  if(w.fdListSummary){ w.fdListSummary(_div, doc.__SAMPLE__||[]); }
  ok("دالة الملخّص معرّضة",typeof w.fdListSummary==="function");
  // رقائق الملخّص القابلة للضغط كمرشّح (وحدة مباشرة)
  var _h=doc.createElement("div"); var _set=null,_cur=[];
  if(w.fdListSummary){ w.fdListSummary(_h, (data.db.vehicles||[]).slice(0,60), function(v){_set=v;}, _cur); }
  var _clk=_h.querySelector(".fdls-chip.clk[data-status]");
  ok("رقائق الملخّص أزرار مرشّحة",!!_clk);
  // base بلا رجيع → تختفي رقاقة الرجيع، والأرقام من الأساس
  var _base=[{status:"تعمل",unit:"x",type:"a",plate:"1"},{status:"تعمل",unit:"x",type:"a",plate:"2"},{status:"تعمل",unit:"x",type:"a",plate:"3"},{status:"عطلانة",unit:"x",type:"b",plate:"4"},{status:"عطلانة",unit:"x",type:"b",plate:"5"}];
  var _h2=doc.createElement("div"); var _s2=null; w.fdListSummary(_h2,_base,function(v){_s2=v;},[],_base);
  var _cs=Array.from(_h2.querySelectorAll(".fdls-chip")).map(function(b){return b.getAttribute("data-status");});

  // حارس جذر العدّ: البذرة يجب أن تحوي التليسكوبية v_641 (فيصير العدّ 639 بعد ZH لا 638)
  ok("بذرة الحزمة تحوي التليسكوبية v_641 (منع تكرار خلل 638)", /id:"v_641_/.test(html));
  ok("ZH ما زالت تستثني السلّم المحذوف v_400", /Hme=\["v_400_/.test(html));
  // الثابت الحارس: عدد كائنات البذرة = عدد data.json بالضبط (منع تكرار خلل 638/639)
  ok("عدد كائنات البذرة = data.json (639)", (html.match(/id:"v_\d+_/g)||[]).length===data.db.vehicles.length && data.db.vehicles.length===639);

  ok("الرقائق الصفرية مخفية (بلا رجيع=رقاقتان)",_cs.length===2&&_cs.indexOf("تحت إجراءات الرجيع")<0);
  ok("نسبة الرقاقة من الأساس (تعمل 60٪)",(_h2.querySelector(".fdls-chip small")||{}).textContent.indexOf("60")>=0);
  var _clk2=_h2.querySelector(".fdls-chip.clk[data-status]");
  if(_clk2){ _clk2.click(); ok("ضغط الرقاقة يضيف الحالة (تراكمي)", Array.isArray(_s2)&&_s2.length===1); }
  ok("زر الشاشة الكاملة",od&&!!od.querySelector("#ops-full"));

  var _cl=doc.querySelector("#fd31-ai .fd31-close"); if(_cl)_cl.click(); await wait(150);
  let p=0; for(const[n,c]of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:1);
})();
