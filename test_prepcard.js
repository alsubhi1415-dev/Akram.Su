// بطاقة «تحت التجهيز والتسليم»: تظهر عند وجود آليات وتختفي عند انعدامها
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const base=JSON.parse(fs.readFileSync(__dirname+"/data_restored.json","utf8"));
function boot(prepCount){
  const d=JSON.parse(JSON.stringify(base));
  d.db.vehicles.forEach(v=>{ if((v.status||"").trim()==="تحت التجهيز والتسليم") v.status="عطلانة"; });
  for(let i=0;i<prepCount;i++) d.db.vehicles[i].status="تحت التجهيز والتسليم";
  const DATA=JSON.stringify(d);
  const stub=u=>{u=String(u);
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk("{}"));};
  return new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){ w.fetch=stub; }}).window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const txt=w=>w.document.getElementById("root").textContent;
(async()=>{
  // بلا آليات تحت التجهيز
  const w0=boot(0); await wait(6000); await wait(3000);
  ok("[صفر] البطاقة مخفية", !txt(w0).includes("آليات تحت التجهيز والتسليم"));
  ok("[صفر] بقية البطاقات ظاهرة", txt(w0).includes("الآليات المتعطلة حالياً") && txt(w0).includes("آليات الرجيع"));
  w0.close();
  // بثلاث آليات
  const w3=boot(3); await wait(6000); await wait(3000);
  const t=txt(w3);
  ok("[ثلاث] البطاقة ظاهرة", t.includes("آليات تحت التجهيز والتسليم"));
  const i=t.indexOf("آليات تحت التجهيز والتسليم");
  const seg=t.slice(Math.max(0,i-40), i+90);
  ok("[ثلاث] العدد 3 معروض", /(^|\D)3(\D|$)/.test(seg));
  ok("[ثلاث] نسبة مئوية معروضة", /نسبة\s*\d+%/.test(seg) || /%/.test(seg));
  ok("[ثلاث] البطاقة برمز مصوّر", !!Array.from(w3.document.querySelectorAll("img")).find(x=>String(x.getAttribute("src")).indexOf("data:image/png")===0));
  w3.close();
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
