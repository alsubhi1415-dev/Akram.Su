// فحص حاجز النسخة القديمة: نسخة برنامج متخلّفة عن المنشور لا يُسمح لها بالكتابة.
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const DATA = fs.readFileSync(__dirname + "/data_restored.json", "utf8");
const VER  = fs.readFileSync(__dirname + "/ver_restored.json", "utf8");
const OWNER_HASH = "a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const puts = [];
const mk = (b, st) => ({ ok:(st||200)<400, status:st||200, headers:{get:()=>null}, text:async()=>b, json:async()=>JSON.parse(b) });
// الخادم يعلن نسخة أحدث بكثير من نسخة الجهاز
const APPVER = JSON.stringify({ build: "الإصدار 99.9 · 1448/02/09هـ", at: 1 });
function stub(u, o) {
  u = String(u);
  if ((o && o.method) === "PUT") { puts.push(u.split("/contents/")[1]); return Promise.resolve(mk('{"content":{"sha":"s"}}')); }
  if (u.includes("app-ver.json")) return Promise.resolve(mk(APPVER));
  if (u.includes("ver.json")) return Promise.resolve(mk(VER));
  if (u.includes("data.json")) return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}", 404));
}
const dom = new JSDOM(html, { runScripts:"dangerously", pretendToBeVisual:true, url:"https://alsubhi1415-dev.github.io/Akram.Su/",
  beforeParse(w){ try{w.localStorage.setItem("cdfleet_role_hash",OWNER_HASH);}catch(e){} w.fetch = stub; } });
const w = dom.window, D = w.document;
const errs=[]; w.addEventListener("error",e=>errs.push(e.message));
const alerts=[]; w.alert=m=>alerts.push(String(m)); w.confirm=()=>true;
const txt=()=>D.getElementById("root").textContent;
const byTitle=t=>Array.from(D.querySelectorAll("button")).find(b=>b.getAttribute("title")===t);
const byText=t=>Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").trim()===t);
const setN=(el,v,p)=>{Object.getOwnPropertyDescriptor(w[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new w.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
const checks=[]; const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(2500);
  ok("شريط التحديث ظهر", txt().includes("تتوفر نسخة أحدث"));
  ok("وصلت بيانات السحابة", !txt().includes("لم تصل بيانات السحابة بعد"));
  const nav=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(900);}
  const f=byTitle("تسجيل عطل فوري"); if(f){f.click(); await wait(600);}
  const modal=Array.from(D.querySelectorAll("div")).find(d=>(d.className||"").includes("modal-card"));
  const sc=modal?modal.closest("div[style]").parentElement:D;
  const sels=Array.from(sc.querySelectorAll("select"));
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=sc.querySelector("textarea"); if(ta){setN(ta,"محاولة من نسخة قديمة","HTMLTextAreaElement");await wait(200);}
  const sv=byText("حفظ"); if(sv){sv.click(); await wait(1200);}
  ok("الحاجز منع الحفظ من النسخة القديمة", txt().includes("نسختك من البرنامج قديمة"));
  await wait(2500);
  ok("لم يُرفع شيء للسحابة", puts.length===0);
  ok("لا تنبيه إدخال", alerts.length===0);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0; for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
