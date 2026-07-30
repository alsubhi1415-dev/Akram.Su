// رمز الجاهزية المصوّر
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
const allImgs=()=>Array.from(D.querySelectorAll("img")).map(i=>String(i.getAttribute("src")));
const click=async(t,ms)=>{const b=Array.from(D.querySelectorAll("button")).find(x=>(x.textContent||"").includes(t));if(b){b.click();await wait(ms||900);}return !!b;};
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
// بصمة الرمزين للتفريق بينهما
const RDY = html.match(/RDY[^"]*"(data:image\/png;base64,[A-Za-z0-9+/=]{40})/);
(async()=>{
  await wait(6000); await wait(3000);
  ok("لا ✅ في واجهات العرض", (txt().match(/\u2705/g)||[]).length === 0);
  const imgs1=allImgs().filter(s=>s.indexOf("data:image/png")===0);
  ok("[نظرة عامة] رموز مصوّرة ظاهرة", imgs1.length >= 2);
  await click("سجل الآليات",1200);
  ok("[سجل الآليات] شرائح التصنيف برمز مصوّر", allImgs().filter(s=>s.indexOf("data:image/png")===0).length >= 2);
  ok("[سجل الآليات] لا ✅ نصية", (txt().match(/\u2705/g)||[]).length === 0);
  await click("لوحة المعلومات",1500);
  ok("[لوحة المعلومات] بطاقة الجاهزة برمز مصوّر", allImgs().filter(s=>s.indexOf("data:image/png")===0).length >= 1);
  ok("مقاس الرمز يتبع حجم الخط", html.replace(/\s+/g,"").includes("1em"));
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
