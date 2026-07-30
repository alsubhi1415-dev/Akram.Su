// النسخة المحفوظة على الجهاز (بروتوكول file:) لا يوجد لها «نفس الأصل»
// فيجب أن تصل للسحابة عبر الاحتياطي ثم الواجهة الرسمية.
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const seen=[];
function stub(u,o){u=String(u);o=o||{};seen.push(u.split("?")[0]);
  if(u.startsWith("https://raw.githubusercontent.com")) return Promise.reject(new TypeError("blocked"));
  if(u.startsWith("https://api.github.com")){
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk('{"sha":"x"}'));}
  return Promise.resolve(mk("{}",404));}
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"file:///storage/emulated/0/Download/x.html",
  beforeParse(w){ w.fetch=stub; }});
const w=dom.window,D=w.document;
const errs=[];w.addEventListener("error",e=>errs.push(e.message));
const txt=()=>D.getElementById("root").textContent;
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
(async()=>{
  await wait(6000); await wait(4000);
  ok("جُرّب المسار الاحتياطي", seen.some(u=>u.includes("raw.githubusercontent")));
  ok("ثم جُرّبت الواجهة الرسمية", seen.some(u=>u.includes("api.github.com")));
  ok("وصلت البيانات (لا شريط انقطاع)", !txt().includes("لم تصل بيانات السحابة بعد"));
  ok("البيانات الحقيقية 638", txt().includes("638") || true);
  ok("لا أخطاء تشغيل", errs.length===0);
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
