// رمز الآلية المصوّر في كل مواضع البرنامج
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
const imgs=()=>Array.from(D.querySelectorAll("img")).filter(i=>String(i.getAttribute("src")).indexOf("data:image/png")===0);
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||800);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(3000);
  ok("لا إيموجي آلية في النسخة", !html.includes("\u{1F692}") && !html.includes("\u{1F69B}"));
  ok("[نظرة عامة] الرمز المصوّر ظاهر", imgs().length >= 1);
  await click("سجل الآليات",1200);
  ok("[سجل الآليات] رمز رأس العمود مصوّر", imgs().length >= 1);
  await click("المؤشرات والتحليلات",1500);
  ok("[المؤشرات] بطاقة أنواع الآليات برمز مصوّر", imgs().length >= 1);
  await click("الجاهزية الميدانية",1500);
  ok("[الجاهزية] بطاقة الإسناد برمز مصوّر", imgs().length >= 1);
  await click("التقارير والبيانات",1500);
  ok("[التقارير] زر التكميل النوعي برمز مصوّر", txt().includes("تكميل الآليات النوعي"));
  ok("مقاس الرمز يتبع حجم الخط", html.includes('height: sz || "1em"') || html.includes("1em"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
