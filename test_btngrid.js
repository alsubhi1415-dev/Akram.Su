// مجموعات الأزرار الموحّدة + حذف كشف الجولة الميدانية
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}",404));};
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);}catch(e){} w.fetch=stub;}});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.getAttribute("title")||"")===t)||Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  // صفحة التقارير
  await click("التقارير والبيانات",1500);
  const g=D.querySelector(".btn-grid");
  ok("[التقارير] مجموعة الأزرار بشبكة موحّدة", !!g && g.className.includes("g5"));
  const btns=g?Array.from(g.querySelectorAll(".grid-btn")):[];
  ok("[التقارير] عشرة أزرار (سطران × خمسة)", btns.length===10);
  ok("[التقارير] كل الأزرار بنفس الصنف", btns.every(b=>b.className.includes("grid-btn")));
  ok("[التقارير] كشف الجولة الميدانية أُزيل", !txt().includes("كشف الجولة الميدانية"));
  ok("[التقارير] زر واحد نشط", btns.filter(b=>b.className.includes("act")).length===1);
  const before=btns.filter(b=>b.className.includes("act"))[0].textContent;
  btns[3].click(); await wait(900);
  const g2=D.querySelector(".btn-grid");
  ok("[التقارير] النقر ينقل النشاط", Array.from(g2.querySelectorAll(".grid-btn"))[3].className.includes("act"));
  // مركز القرار — عبر الصفحة الرئيسية ثم التبويب
  await click("الصفحة الرئيسية",1200);
  const dt=Array.from(D.querySelectorAll(".cmd-tab")).find(t=>(t.textContent||"").includes("مركز القرار"));
  if(dt){dt.click(); await wait(1500);}
  const dg=Array.from(D.querySelectorAll(".btn-grid")).pop();
  const dbt=dg?Array.from(dg.querySelectorAll(".grid-btn")):[];
  ok("[مركز القرار] خمسة تبويبات بالشبكة", dbt.length===5);
  ok("[مركز القرار] العدّاد بصنف مستقل", !!dg.querySelector(".gb-n"));
  // العمليات
  await click("إحصائيات عملياتية",1600);
  const og=Array.from(D.querySelectorAll(".btn-grid.navy")).pop();
  ok("[العمليات] أزرار الفترات بشبكة كحلية", !!og && og.querySelectorAll(".grid-btn").length===5);
  ok("[العمليات] عدّاد الفترة نُقل خارج الشبكة", txt().includes("حوادث الفترة"));
  // صفحة الجاهزية الميدانية
  await click("الجاهزية الميدانية",1600);
  const rg=Array.from(D.querySelectorAll(".btn-grid.g4")).find(g=>g.querySelectorAll(".grid-btn").length===4);
  const rbt=rg?Array.from(rg.querySelectorAll(".grid-btn")):[];
  ok("[الجاهزية] أربعة أزرار بشبكة رباعية", rbt.length===4);
  ok("[الجاهزية] الأزرار الأربعة كلها برموز مصوّرة", rg && rg.querySelectorAll("img").length===4);
  ok("[الجاهزية] اسم الزر «قسم الدعم والإسناد»", (rg?rg.textContent:"").includes("قسم الدعم والإسناد"));
  ok("[الجاهزية] زر تقرير الجاهزية خارج الشبكة", txt().includes("تقرير الجاهزية"));
  ok("[الجاهزية] زر واحد نشط", rbt.filter(b=>b.className.includes("act")).length===1);
  rbt[1].click(); await wait(1000);
  const rg2=Array.from(D.querySelectorAll(".btn-grid.g4")).find(g=>g.querySelectorAll(".grid-btn").length===4);
  ok("[الجاهزية] النقر ينقل النشاط", Array.from(rg2.querySelectorAll(".grid-btn"))[1].className.includes("act"));
  ok("قواعد الشبكة مبنيّة", html.includes(".btn-grid.g5 { grid-template-columns: repeat(5") && html.includes("grid-template-columns: repeat(2"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
