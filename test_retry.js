// شبكة تفشل عند الرفع ثم تتعافى: يجب ألا يضيع التعديل وأن يُرفع تلقائياً
const fs=require("fs"); const {JSDOM}=require("jsdom");
const html=fs.readFileSync(__dirname+"/index.html","utf8");
const DATA=fs.readFileSync(__dirname+"/data_restored.json","utf8");
const VER=fs.readFileSync(__dirname+"/ver_restored.json","utf8");
const APPV=fs.readFileSync(__dirname+"/app-ver.json","utf8");
const OW="a05d586a098b79c3fc8c3a58160bed5734c62cebf955bd2bd146102fcdd92e49";
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mk=(b,st)=>({ok:(st||200)<400,status:st||200,headers:{get:()=>null},text:async()=>b,json:async()=>JSON.parse(b)});
const store={};
let failPuts=true; const puts=[];
function mkw(){
  const stub=(u,o)=>{u=String(u);o=o||{};
    if(o.method==="PUT"){
      if(failPuts) return Promise.reject(new TypeError("Failed to fetch"));
      puts.push(u.split("/contents/")[1]); return Promise.resolve(mk('{"content":{"sha":"s"}}'));
    }
    if(u.includes("app-ver.json"))return Promise.resolve(mk(APPV));
    if(u.includes("ver.json"))return Promise.resolve(mk(VER));
    if(u.includes("data.json"))return Promise.resolve(mk(DATA));
    return Promise.resolve(mk('{"sha":"x"}'));};
  return new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://alsubhi1415-dev.github.io/Akram.Su/",
    beforeParse(w){try{w.localStorage.setItem("cdfleet_role_hash",OW);for(const k in store)w.localStorage.setItem(k,store[k]);}catch(e){} w.fetch=stub;}}).window;
}
const checks=[];const ok=(n,c)=>checks.push([n,!!c]);
const txt=w=>w.document.getElementById("root").textContent;
const setN=(w,el,v,p)=>{Object.getOwnPropertyDescriptor(w[p].prototype,"value").set.call(el,v);
  el.dispatchEvent(new w.Event(p==="HTMLSelectElement"?"change":"input",{bubbles:true}));};
async function saveFault(w){
  const nav=Array.from(w.document.querySelectorAll("button")).find(b=>(b.getAttribute("title")||"")==="سجل الآليات") || Array.from(w.document.querySelectorAll("button")).find(b=>(b.textContent||"").includes("سجل الآليات"));
  if(nav){nav.click(); await wait(1000);}
  const f=Array.from(w.document.querySelectorAll("button")).find(b=>b.getAttribute("title")==="تسجيل عطل فوري");
  if(f){f.click(); await wait(700);}
  const sels=Array.from(w.document.querySelectorAll("select")).slice(-3);
  if(sels.length>=3){setN(w,sels[0],"9","HTMLSelectElement");await wait(120);setN(w,sels[1],"2","HTMLSelectElement");await wait(120);setN(w,sels[2],"1448","HTMLSelectElement");await wait(120);}
  const ta=Array.from(w.document.querySelectorAll("textarea")).pop();
  if(ta){setN(w,ta,"فحص طابور الرفع","HTMLTextAreaElement");await wait(200);}
  const sv=Array.from(w.document.querySelectorAll("button")).find(b=>(b.textContent||"").trim()==="حفظ");
  if(sv){sv.click(); await wait(1200);}
}
(async()=>{
  // جلسة أولى: الرفع يفشل
  const w1=mkw(); await wait(6000); await wait(2500);
  await saveFault(w1);
  await wait(3000);
  ok("[1] لم يُرفع شيء (الشبكة تفشل)", puts.length===0);
  const pend=w1.localStorage.getItem("fd_pending_v1");
  ok("[1] التعديل محفوظ بطابور الرفع", !!pend);
  await wait(10000);   // مهلة التهدئة: التنبيه لا يظهر لانتظار عابر
  ok("[1] شارة «بانتظار الرفع» ظاهرة", txt(w1).includes("بانتظار الرفع"));
  // احتفظ بالتخزين لمحاكاة إعادة فتح الصفحة
  for(const k of ["fd_mirror_v1","fd_pending_v1"]) { const v=w1.localStorage.getItem(k); if(v) store[k]=v; }
  w1.close();

  // جلسة ثانية: الشبكة تعافت — يجب أن يُرفع تلقائياً بلا تدخل
  failPuts=false;
  const w2=mkw(); await wait(6000); await wait(6000);
  ok("[2] رُفع التعديل تلقائياً بعد التعافي", puts.includes("data.json") && puts.includes("ver.json"));
  ok("[2] طابور الرفع فُرّغ", !w2.localStorage.getItem("fd_pending_v1"));
  ok("[2] اختفت شارة الانتظار", !txt(w2).includes("بانتظار الرفع"));
  w2.close();
  let p=0;for(const[n,c] of checks){if(c)p++;console.log((c?"✔":"✘")+" "+n);}
  console.log("عمليات الرفع:",puts.join(", ")||"لا شيء");
  console.log("النتيجة: "+p+"/"+checks.length);
  process.exit(p===checks.length?0:2);
})();
