// أزرار الإضافة والاستيراد + رموز الصلاحيات الثلاث
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="0f37b8ff0653a56ad7d30277ff9efd50b309c399d24efc42d24e3463acafeecd";
const ED="9ba4a1e0b9b9fbc2b0be2f2f36ad82a94ee2f13a2b3a1a6b1d9d0b0d0f1e2c3d";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
function boot(role){
  return new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){ if(role) {try{w.localStorage.setItem("cdfleet_role_hash",role);}catch(e){}} w.fetch=stub; }}).window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const txt=w=>w.document.getElementById("root").textContent;
(async()=>{
  // --- زائر ---
  const wv=boot(null); await wait(6000); await wait(3000);
  ok("[زائر] لا زر «إضافة آلية»", !txt(wv).includes("إضافة آلية"));
  ok("[زائر] لا زر «استيراد»", !txt(wv).includes("استيراد"));
  const lb=Array.from(wv.document.querySelectorAll("header button")).find(b=>(b.textContent||"").includes("دخول المحررين"));
  ok("[زائر] زر الدخول برمز مصوّر", !!(lb && lb.querySelector("img")));
  wv.close();
  // --- مشرف ---
  const wo=boot(OW); await wait(6000); await wait(3000);
  ok("[مشرف] لا زر «إضافة آلية»", !txt(wo).includes("إضافة آلية"));
  ok("[مشرف] زر «استيراد» متاح", txt(wo).includes("استيراد"));
  const rb=Array.from(wo.document.querySelectorAll("header span")).find(x=>(x.textContent||"").trim().endsWith("المشرف"));
  ok("[مشرف] شارة الصفة برمز مصوّر", !!(rb && rb.querySelector("img")));
  ok("[مشرف] لا 👑 نصية", !/\u{1F451}/u.test(txt(wo)));
  ok("الرموز الثلاثة مضمّنة", html.includes("EDITOR_ICON") || (html.split("data:image/png;base64,").length-1) >= 28);
  wo.close();
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
