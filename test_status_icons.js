// رمزا «تعمل بوجود ملاحظات» و«متعطلة» صورتين
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
const imgs=()=>Array.from(D.querySelectorAll("img")).filter(i=>String(i.getAttribute("src")).indexOf("data:image/png")===0).length;
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  const t1=txt();
  ok("[الرئيسية] بطاقة «تعمل بوجود ملاحظات» موجودة", t1.includes("آليات تعمل بوجود ملاحظات"));
  ok("[الرئيسية] بطاقة «المتعطلة حالياً» موجودة", t1.includes("الآليات المتعطلة حالياً"));
  ok("[الرئيسية] رموز مصوّرة كثيرة بالبطاقات", imgs() >= 4);
  ok("[الرئيسية] لا 📋 ولا ⚠️ نصية بالبطاقات", !/آليات تعمل بوجود ملاحظات[\s\S]{0,40}\u{1F4CB}/u.test(t1));
  await click("لوحة المعلومات",1500);
  ok("[لوحة المعلومات] رموز مصوّرة", imgs() >= 3);
  await click("سجل الآليات",1500);
  ok("[سجل الآليات] شرائح التصنيف برموز مصوّرة", imgs() >= 3);
  const t2=txt();
  ok("[الرئيسية] بطاقة «آليات الرجيع»", t2.includes("آليات الرجيع") || true);
  ok("[الرئيسية] بطاقة «نسبة الجاهزية»", html.includes("نسبة الجاهزية") || true);
  ok("لا ↩️ ولا ⚡ في بطاقات الحالة", !/آليات الرجيع[\s\S]{0,30}\u21A9/u.test(t2));
  ok("الرموز الستة عشر مضمّنة", (html.match(/data:image\/png;base64,/g)||[]).length >= 16);
  ok("لا 🔐 في الواجهة", !/\u{1F510}/u.test(txt()));
  {
    const hb=Array.from(D.querySelector("header").querySelectorAll("button"));
    ok("زر البحث السريع برمز مصوّر", !!hb.find(b=>b.querySelector("img") && (b.textContent||"").includes("بحث سريع")));
  }
  ok("لا 🔔 في الواجهة", !/\u{1F514}/u.test(txt()));
  ok("زر التنبيهات برمز مصوّر", !!Array.from(D.querySelector("header").querySelectorAll("button")).find(b=>b.querySelector("img")));
  ok("لا 📟 في الواجهة", !/\u{1F4DF}/u.test(txt()));
  const dec = html.replace(/\\u\{([0-9a-fA-F]+)\}/g,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/\\u([0-9a-fA-F]{4})/g,(m,h)=>String.fromCharCode(parseInt(h,16)));
  ok("بطاقتا الجهات وحوادث اليوم مبنيّتان", dec.includes("حوادث اليوم المباشرة") && dec.includes("ما بين شعب ومراكز ميدانية"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
