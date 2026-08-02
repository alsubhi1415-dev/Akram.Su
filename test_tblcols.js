// جدول سجل الآليات: أعرضة الأعمدة وظهور بيانات العطل
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=b=>({ok:true,status:200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const stub=u=>{u=String(u);
  if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
  if(u.includes("ver.json"))return Promise.resolve(mk(VER));
  if(u.includes("data.json"))return Promise.resolve(mk(DATA));
  return Promise.resolve(mk("{}"));};
function boot(role){
  return new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){ if(role){try{w.localStorage.setItem("cdfleet_role_hash",role);}catch(e){}} w.fetch=stub; }}).window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const sumW=(ths)=>ths.reduce((a,t)=>a+parseFloat(((t.getAttribute("style")||"").match(/width:\s*([\d.]+)%/)||[0,0])[1]),0);
(async()=>{
  for(const [role,tag,cols] of [[null,"زائر",8],[OW,"مشرف",9]]){
    const w=boot(role); const D=w.document;
    await wait(6000); await wait(3000);
    const nav=Array.from(D.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات");
    if(nav){nav.click(); await wait(1400);}
    const ths=Array.from(D.querySelectorAll("table.fleet-tbl thead th"));
    ok(`[${tag}] عدد الأعمدة ${cols}`, ths.length===cols);
    const tot=sumW(ths);
    ok(`[${tag}] مجموع الأعرضة = 100% (كان ${tag==="زائر"?"101":"100"})`, Math.abs(tot-100)<0.01);
    const heads=ths.map(t=>t.textContent.replace(/[▲▼]/g,"").trim());
    ok(`[${tag}] رأس «الموديل» موجود`, heads.some(h=>h.includes("الموديل")));
    if(cols===9) ok(`[${tag}] رأس «إجراء» بلا رمز يزاحمه`, heads[8]==="إجراء");
    // صفوف الآليات المتعطلة تعرض وصفاً وتاريخاً
    const rows=Array.from(D.querySelectorAll("table.fleet-tbl tbody tr")).slice(0,120);
    let down=0, withDesc=0, withDate=0;
    for(const r of rows){
      const tds=r.querySelectorAll("td");
      if(tds.length<8) continue;
      const stTxt=tds[5].textContent;
      if(stTxt.includes("عطلانة")||stTxt.includes("التجهيز")){
        down++;
        if((tds[6].textContent||"").trim()!=="—") withDesc++;
        if((tds[7].textContent||"").trim().length>1) withDate++;
      }
    }
    ok(`[${tag}] صفوف متعطلة مفحوصة (${down})`, down>0);
    ok(`[${tag}] كلها تعرض وصف عطل`, down>0 && withDesc===down);
    ok(`[${tag}] كلها تعرض تاريخاً`, down>0 && withDate===down);
    w.close();
  }
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
