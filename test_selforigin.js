// يحاكي حالة أكرم بالضبط: واجهة GitHub بلا رمز مرفوضة (تجاوز الحصة)،
// ونطاق raw محجوب على الشبكة — والمنقذ هو القراءة من نفس أصل الصفحة.
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const DATA = fs.readFileSync(__dirname + "/data_restored.json", "utf8");
const VER  = fs.readFileSync(__dirname + "/ver_restored.json", "utf8");
const APPV = fs.readFileSync(__dirname + "/app-ver.json", "utf8");
const OWNER_HASH = "0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const wait = ms => new Promise(r => setTimeout(r, ms));
const mk = (b, st) => ({ ok:(st||200)<400, status:st||200, headers:{get:()=>null}, text:async()=>b, json:async()=>JSON.parse(b) });
const log = { api401:0, rawBlocked:0, self:0, puts:[] };
function stub(u, o) {
  u = String(u); o = o || {};
  const auth = o.headers && (o.headers.Authorization || o.headers.authorization);
  if (u.startsWith("https://raw.githubusercontent.com")) { log.rawBlocked++; return Promise.reject(new TypeError("Failed to fetch")); }
  if (u.startsWith("https://api.github.com")) {
    if (o.method === "PUT") { if (!auth) return Promise.resolve(mk("{}", 401)); log.puts.push(u.split("/contents/")[1]); return Promise.resolve(mk('{"content":{"sha":"s"}}')); }
    if (!auth) { log.api401++; return Promise.resolve(mk('{"message":"API rate limit exceeded"}', 403)); }
    if (u.includes("ver.json")) return Promise.resolve(mk(VER));
    if (u.includes("data.json")) return Promise.resolve(mk(DATA));
    return Promise.resolve(mk('{"sha":"x"}'));
  }
  if (u.startsWith("https://alsubhi1415-dev.github.io/")) {
    log.self++;
    if (u.includes("app-ver.json")) return Promise.resolve(mk(APPV));
    if (u.includes("ver.json")) return Promise.resolve(mk(VER));
    if (u.includes("data.json")) return Promise.resolve(mk(DATA));
    return Promise.resolve(mk("{}", 404));
  }
  return Promise.resolve(mk("{}", 404));
}
const dom = new JSDOM(html, { runScripts:"dangerously", pretendToBeVisual:true,
  url:"https://alsubhi1415-dev.github.io/Akram.Su/",
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
  await wait(6000); await wait(3000);
  ok("لم يُطلب النطاق المحجوب أصلاً", log.rawBlocked === 0);
  ok("لم تُستنزف حصة api بلا رمز", log.api401 === 0);
  ok("قراءة من نفس الأصل نجحت", log.self > 0);
  ok("شاشة الإقلاع اختفت", !txt().includes("جارٍ تحميل بيانات السجل"));
  ok("لا شريط «لم تصل بيانات السحابة»", !txt().includes("لم تصل بيانات السحابة بعد"));
  const nav=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(D.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(1000);}
  ok("البيانات الحقيقية ظهرت (639 آلية)", /من أصل\s*639/.test(txt()));
  const f=byTitle("تسجيل عطل فوري"); if(f){f.click(); await wait(600);}
  const modal=Array.from(D.querySelectorAll("div")).find(d=>(d.className||"").includes("modal-card"));
  const sc=modal?modal.closest("div[style]").parentElement:D;
  const sels=Array.from(sc.querySelectorAll("select"));
  if(sels.length>=3){setN(sels[0],"9","HTMLSelectElement");await wait(120);setN(sels[1],"2","HTMLSelectElement");await wait(120);setN(sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=sc.querySelector("textarea"); if(ta){setN(ta,"فحص الحفظ عبر نفس الأصل","HTMLTextAreaElement");await wait(200);}
  const sv=byText("حفظ"); if(sv){sv.click(); await wait(1500);}
  ok("الحفظ لم يُمنع", !txt().includes("أُلغي الحفظ"));
  await wait(2500);
  ok("تمّ الرفع للسحابة", log.puts.includes("data.json") && log.puts.includes("ver.json"));
  ok("لا تنبيه إدخال", alerts.length===0);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0; for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("إحصاء: api بلا رمز مرفوض "+log.api401+" | raw محجوب "+log.rawBlocked+" | نفس الأصل "+log.self+" | رفع: "+(log.puts.join(", ")||"لا شيء"));
  if(errs.length)console.log("أخطاء:",errs.slice(0,3).join(" | "));
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
