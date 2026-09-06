
(() => {
  const E = window.POOLER_EXERCISES || [];
  const X = window.POOLER_EXAM_DRILLS || [];
  const ALL = [...E, ...X];
  const KEY = "pooler-v6";
  const USER_KEY = "pooler-user-id";
  let userId = localStorage.getItem(USER_KEY) || "";
  let authUser = null;
  let authMode = "register";
  const defaults = {
    name:"Learner", bio:"Build skill, not noise.", xp:0, solved:[], openedDrills:0,
    streak:0, bestStreak:0, lastActive:"", theme:"dark", lang:"en", day:"Day 00",
    runs:0, speedBest:0, avatar:""
  };
  let state = {...defaults};
  try { state = {...defaults, ...(JSON.parse(localStorage.getItem(KEY)||"{}"))}; } catch {}
  let selected = null, currentFilter = "ALL", sortMode = "default";
  let focusSeconds = 1500, focusInterval = null, mockSeconds = 0, mockInterval = null, speedStartedAt = 0;
  const ONBOARDING_KEY = "pooler-onboarding-v1";
  let onboardingStep = 0;
  const onboardingCopy = {
    en:[
      ["✦","Welcome to POOLER","A guided companion for the C Pool. First, learn how the site works.",["Learn the concept","Practice in Code Lab","Run, test and fix","Submit and track progress"],"Show me →"],
      ["⌂","Dashboard","Your starting point: daily quest, progress and the next exercise.",["Continue where you stopped","See streak and XP","Jump into challenges"],"Next →"],
      ["📚","Lessons & Concepts","Learn the C concept before the exercise. Short, practical and connected to Pool tasks.",["Read the explanation","Study the example","Complete the mini mission","Apply it in Training"],"Next →"],
      ["💻","Code Lab","Write and test C code. Run it, read output or compiler errors, then fix it.",["Write code","Run it","Read errors","Fix and run again"],"Next →"],
      ["🎯","Training & Exams","Training contains Pool exercises. Exam Room gives you timed practice.",["Day 00 → Day 13","Skills and difficulty","Mock exam drills","Track solved work"],"Next →"],
      ["🏆","Profile & Leaderboard","Create a real account when ready. Your progress and profile picture can stay with your account.",["Persistent account","Profile picture","Community ranking","Progress across sessions"],"Next →"],
      ["🚀","You are ready","Start with the basics, understand each concept, then solve. The goal is mastery, not rushing.",["Start Here","Then ft_putchar","Continue through the Pool path"],"Enter POOLER →"]
    ],
    fr:[
      ["✦","Bienvenue sur POOLER","Un compagnon guidé pour la Piscine C. Découvre d'abord comment le site fonctionne.",["Apprendre le concept","Pratiquer dans Code Lab","Exécuter, tester et corriger","Soumettre et suivre la progression"],"Découvrir →"],
      ["⌂","Tableau de bord","Ton point de départ : quête du jour, progression et prochain exercice.",["Continuer où tu t'es arrêté","Voir streak et XP","Lancer un défi"],"Suivant →"],
      ["📚","Leçons & Concepts","Apprends le concept C avant l'exercice. Court, pratique et lié aux exercices Pool.",["Lire l'explication","Étudier l'exemple","Faire la mini-mission","Appliquer dans Entraînement"],"Suivant →"],
      ["💻","Code Lab","Écris et teste ton code C. Exécute, lis les erreurs puis corrige.",["Écrire","Exécuter","Lire les erreurs","Corriger et recommencer"],"Suivant →"],
      ["🎯","Entraînement & Examens","Entraînement contient les exercices Pool. Salle d'examen propose des sessions chronométrées.",["Day 00 → Day 13","Compétences et difficulté","Simulations","Suivre les réussites"],"Suivant →"],
      ["🏆","Profil & Classement","Crée un vrai compte quand tu es prêt. Progression et photo peuvent rester liées au compte.",["Compte persistant","Photo de profil","Classement","Progression conservée"],"Suivant →"],
      ["🚀","Tu es prêt","Commence par les bases, comprends chaque concept, puis résous. Le but est la maîtrise.",["Start Here","Puis ft_putchar","Continue le parcours Pool"],"Entrer dans POOLER →"]
    ],
    ar:[
      ["✦","مرحبا بك في POOLER","POOLER هو المرافق ديالك لتعلم C والـPiscine. الأول غادي نوريوك كيفاش خدام الموقع.",["تعلم الـconcept","جرب فـCode Lab","شغل واختبر وصلح","سجل التقدم ديالك"],"ورّيني →"],
      ["⌂","الرئيسية","هنا كتلقى مهمة اليوم، التقدم ديالك، والتمرين اللي خاصك تكمل فيه.",["كمل منين وقفتي","شوف الـstreak والـXP","جرب تحدي"],"التالي →"],
      ["📚","الدروس والمفاهيم","تعلم الـconcept قبل التمرين. الدروس قصيرة وعملية ومربوطة بتمارين الـPool.",["قرا الشرح","شوف المثال","دير mini mission","طبق فـTraining"],"التالي →"],
      ["💻","Code Lab","هنا كتكتب وكتجرب C. دير Run، قرا الـoutput أو أخطاء الـcompiler، وصلح.",["كتب الكود","Run","قرا الـerrors","صلح وعاود Run"],"التالي →"],
      ["🎯","Training و Exams","Training فيه تمارين الـPool. Exam Room فيه تدريبات بوقت.",["Day 00 → Day 13","المهارات والمستوى","Mock exams","تبع التقدم"],"التالي →"],
      ["🏆","Profile و Leaderboard","منين تكون واجد دير حساب حقيقي. التقدم والصورة ديالك يبقاو مربوطين بالحساب.",["حساب دائم","صورة شخصية","الترتيب","التقدم محفوظ"],"التالي →"],
      ["🚀","دابا واجد","بدا بالأساسيات، فهم كل concept، ومن بعد حل. الهدف هو الإتقان ماشي السرعة.",["بدا Start Here","من بعد ft_putchar","كمل مسار الـPool"],"دخل لـPOOLER →"]
    ]
  };
  function renderOnboarding(){
    const m=$("#onboardingModal"), steps=onboardingCopy[state.lang]||onboardingCopy.en, x=steps[onboardingStep]; if(!m||!x)return;
    $("#onboardingStepLabel").textContent=`${state.lang==="ar"?"البداية":state.lang==="fr"?"BIENVENUE":"WELCOME"} · ${onboardingStep+1} / ${steps.length}`;
    $("#onboardingIcon").textContent=x[0]; $("#onboardingTitle").textContent=x[1]; $("#onboardingText").textContent=x[2];
    $("#onboardingPoints").innerHTML=x[3].map(v=>`<div><span>✓</span><p>${esc(v)}</p></div>`).join("");
    $("#onboardingProgress").style.width=`${(onboardingStep+1)/steps.length*100}%`; $("#onboardingNext").textContent=x[4];
    $("#onboardingBack").textContent=state.lang==="ar"?"رجوع":state.lang==="fr"?"Retour":"Back"; $("#onboardingBack").classList.toggle("hidden",onboardingStep===0);
    $("#onboardingSkipText").textContent=state.lang==="ar"?"تجاوز الجولة":state.lang==="fr"?"Passer le tour":"Skip tour";
  }
  function closeOnboarding(){
    const m=$("#onboardingModal"); if(m){m.classList.remove("open");m.setAttribute("aria-hidden","true");}
    localStorage.setItem(ONBOARDING_KEY,"done");
    if(!authUser) setTimeout(()=>openAuth("register"),180);
  }
  function startOnboarding(){if(localStorage.getItem(ONBOARDING_KEY)==="done")return;onboardingStep=0;renderOnboarding();$("#onboardingModal")?.classList.add("open");}


  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  async function syncProfileToServer(){
    if(!authUser) return false;
    try{
      const r=await fetch("/api/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state}),cache:"no-store"});
      return r.ok;
    }catch{return false;}
  }
  function applyServerUser(u){
    authUser=u||null;
    if(authUser){
      userId=authUser.id; localStorage.setItem(USER_KEY,userId);
      if(authUser.state && typeof authUser.state === "object") state={...defaults,...authUser.state,name:authUser.name||authUser.state.name||defaults.name,bio:authUser.bio||authUser.state.bio||defaults.bio};
      else state={...state,name:authUser.name||state.name,bio:authUser.bio||state.bio};
      state.xp = Number(authUser.xp)||0;
      state.level = Number(authUser.level)||currentLevel();
      save();
    }
    refreshAccountUI(); refreshProfile(); renderProfilePage(); renderStats();
  }
  function refreshAccountUI(){
    const signed=!!authUser;
    const status=$("#accountStatus"); if(status){ status.textContent=signed?`@${authUser.username}`:"Not signed in"; status.classList.toggle("signed",signed); }
    ["#loginBtn","#accountLoginBtn"].forEach(sel=>{const e=$(sel);if(e)e.classList.toggle("hidden",signed)});
    ["#registerBtn","#accountCreateBtn"].forEach(sel=>{const e=$(sel);if(e)e.classList.toggle("hidden",signed)});
    const logout=$("#logoutBtn"); if(logout) logout.classList.toggle("hidden",!signed);
    const edit=$("#profileEditBtn"); if(edit) edit.disabled=false;
    const adminNav=$("#adminNav"); if(adminNav) adminNav.classList.toggle("hidden", !(signed && authUser.role === "admin"));
    const hint=$("#accountHint"); if(hint) hint.textContent=signed?`Signed in as @${authUser.username}. Your progress is stored in the persistent community database.`:"Create an account so your profile, solved exercises and streak stay on the community leaderboard after a restart or redeploy.";
  }
  function openAuth(mode="register"){
    authMode=mode; $("#authModal").classList.add("open"); $("#authUsername").value=authUser?.username||""; $("#authPassword").value=""; $("#authName").value=state.name==="Learner"?"":state.name; $("#authError").textContent=""; updateAuthMode(); setTimeout(()=>$("#authUsername").focus(),50);
  }
  function closeAuth(){ if(!authUser){ toast("Log in or create an account to enter POOLER"); return; } $("#authModal").classList.remove("open"); }
  function updateAuthMode(){
    const reg=authMode==="register"; $("#authRegisterTab")?.classList.toggle("active",reg); $("#authLoginTab")?.classList.toggle("active",!reg); $("#authNameWrap")?.classList.toggle("hidden",!reg); $("#authTitle").textContent=reg?"Create your POOLER account":"Log in to POOLER"; $("#authSubtitle").textContent=reg?"Your account keeps progress and leaderboard data persistent.":"Continue your progress from any device."; $("#submitAuth").textContent=reg?"Create account":"Log in";
  }
  async function submitAuth(){
    const username=$("#authUsername").value.trim(), password=$("#authPassword").value, name=$("#authName").value.trim()||state.name||username, err=$("#authError");
    err.textContent=""; if(!username||!password){err.textContent="Username and password are required.";return;}
    const endpoint=authMode==="register"?"/api/auth/register":"/api/auth/login";
    const body=authMode==="register"?{username,password,name,bio:state.bio,state}:{username,password};
    const btn=$("#submitAuth"); btn.disabled=true;
    try{ const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Request failed"); applyServerUser(d.user); closeAuth(); loadLeaderboard(); toast(authMode==="register"?"Account created — progress is now persistent":"Welcome back — progress restored"); }
    catch(e){err.textContent=e.message||"Could not complete the request.";} finally{btn.disabled=false;}
  }
  async function initAuth(){
    try{
      const r=await fetch("/api/me",{cache:"no-store"}); const d=await r.json();
      if(d.authenticated&&d.user) applyServerUser(d.user);
      else {
        authUser=null; userId=""; localStorage.removeItem(USER_KEY); refreshAccountUI();
        if(localStorage.getItem(ONBOARDING_KEY)==="done") setTimeout(()=>openAuth("login"),300);
      }
    }catch{
      authUser=null; userId=""; localStorage.removeItem(USER_KEY); refreshAccountUI();
      if(localStorage.getItem(ONBOARDING_KEY)==="done") setTimeout(()=>openAuth("login"),300);
    }
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const avatarOk = a => typeof a === "string" && /^data:image\/(jpeg|png|webp);base64,/i.test(a);
  const avatarHtml = (avatar, name, cls="avatar") => avatarOk(avatar) ? `<span class="${cls} avatar-photo"><img src="${esc(avatar)}" alt=""></span>` : `<span class="${cls}">${esc((name||"L")[0].toUpperCase())}</span>`;
  async function pickAvatar(file){
    if(!file) return;
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){ toast("Use a JPG, PNG or WebP image"); return; }
    if(file.size > 5*1024*1024){ toast("Image must be smaller than 5 MB"); return; }
    try{
      const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
      const max=256, scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      let data=c.toDataURL("image/jpeg",.82);
      if(data.length>260000) data=c.toDataURL("image/jpeg",.62);
      if(data.length>300000){ toast("Image is still too large — choose another one"); return; }
      state.avatar=data; save(); const pv=$("#profileUploadPreview"); if(pv){pv.innerHTML=`<img src="${esc(data)}" alt="">`;pv.classList.add("avatar-photo");} refreshProfile(); renderProfilePage(); renderLeaderboard(window.__POOLER_LEADERBOARD||[]);
      const ok=await syncProfileToServer();
      toast(authUser ? (ok?"Profile picture saved":"Picture saved locally · sync unavailable") : "Picture saved locally · create an account to keep it");
    }catch{ toast("Could not read that image"); }
  }
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
    const solved = id => state.solved.includes(id);
  const exerciseXP = item => ({easy:100, medium:150, hard:250}[String(item?.difficulty||"easy").toLowerCase()] || 100);
  const calculateXP = () => state.solved.reduce((sum,id) => sum + exerciseXP(E.find(x=>x.id===id)), 0);
  const currentLevel = () => 1 + Math.floor((Number(state.xp)||0) / 500);
  const syncLocalProgress = () => { state.xp = calculateXP(); state.level = currentLevel(); };
  const dayExercises = d => E.filter(x => x.day === d);
  const currentDay = () => `Day ${String(Math.min(13, Math.floor(state.solved.filter(id => E.some(x=>x.id===id)).length / 10))).padStart(2,"0")}`;
  const toast = (msg) => {
    const el = document.createElement("div"); el.className="toast"; el.textContent=msg;
    $("#toastStack").appendChild(el); setTimeout(()=>el.remove(),2600);
  };

  function markActivity() {
    const d = today();
    if (state.lastActive !== d) {
      const y = new Date(); y.setDate(y.getDate()-1);
      const yd = y.toISOString().slice(0,10);
      state.streak = state.lastActive === yd ? state.streak + 1 : 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.lastActive = d; save();
    }
  }

  function refreshProfile() {
    const name = state.name || "Learner";
    const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
    const avatar = (name[0] || "L").toUpperCase();
    set("#heroName", name.split(" ")[0]);
    set("#heroSolved", state.solved.length);
    set("#sideName", name);
    const sideAvatar=$("#avatar"); if(sideAvatar){ if(avatarOk(state.avatar)) sideAvatar.innerHTML=`<img src="${esc(state.avatar)}" alt="">`; else sideAvatar.textContent=avatar; sideAvatar.classList.toggle("avatar-photo",avatarOk(state.avatar)); }
    set("#mSolved", state.solved.length);
    set("#mTotal", `of ${E.length} training drills`);
    set("#mStreak", state.streak);
    set("#mLevel", currentLevel());
    set("#mXP", Number(state.xp)||0);
    set("#mRuns", state.runs);
    const statsAvatar=$("#statsAvatar"); if(statsAvatar){ if(avatarOk(state.avatar)) statsAvatar.innerHTML=`<img src="${esc(state.avatar)}" alt="">`; else statsAvatar.textContent=avatar; statsAvatar.classList.toggle("avatar-photo",avatarOk(state.avatar)); }
    set("#statsName", name);
    set("#statsBio", state.bio || defaults.bio);
    set("#bestStreak", state.bestStreak);
    set("#statsSolved", state.solved.length);
    set("#statsRuns", state.runs);
    set("#drillsOpened", state.openedDrills);
    renderDashProgress();
    renderDashLeaderboard();
  }

  function renderDashProgress(){
    const xp=Number(state.xp)||0, lvl=currentLevel();
    const prev=(lvl-1)*500, next=lvl*500, pct=Math.max(0,Math.min(100,((xp-prev)/(next-prev))*100));
    const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
    set("#mLevel",lvl);set("#mLevelRing",lvl);set("#sideLevel",lvl);set("#mXP",xp);set("#progressXP",`${xp} / ${next} XP`);set("#levelNext",next);set("#dashProgressPct",`${Math.round(pct)}%`);set("#mBest",state.bestStreak||0);
    ["#levelBar","#dashProgressBar"].forEach(id=>{const e=$(id);if(e)e.style.width=pct+"%"});
  }
  async function renderDashLeaderboard(){
    const box=$("#dashLeaderboard"); if(!box)return;
    try{const r=await fetch("/api/leaderboard",{cache:"no-store"}); if(!r.ok)throw 0; const d=await r.json(); const users=d.users||[];
      const sorted=[...users].sort((a,b)=>(Number(b.xp)||0)-(Number(a.xp)||0)||(Number(b.solved)||0)-(Number(a.solved)||0));
      const me=authUser?.username; const rank=sorted.findIndex(u=>u.username===me)+1; setDashRank(rank);
      box.innerHTML=sorted.slice(0,5).map((u,i)=>{const lvl=Number(u.level)||Math.floor((Number(u.xp)||0)/500)+1; const av=u.avatar?`<img src="${esc(u.avatar)}" alt="">`:`<span class="lb-avatar">${esc((u.name||u.username||"U")[0].toUpperCase())}</span>`; return `<div class="lb-row rank-${i+1}"><span class="ranknum">${i+1}</span><span class="lb-user">${av}<span><b>${esc(u.username||u.name||"User")}</b><small>${esc(u.bio||"Keep building.")}</small></span></span><span><span class="level-pill">${lvl}</span></span><span>${Number(u.xp)||0}</span><span>${Number(u.solved)||0}</span><span>${Number(u.streak)||0}</span></div>`}).join("")||`<div class="dash-empty">No community accounts yet.</div>`;
    }catch{box.innerHTML=`<div class="dash-empty">Sign in to see live community rankings.</div>`;setDashRank(null)}
  }
  function setDashRank(r){const e=$("#mRank");if(e)e.textContent=r?`#${r}`:"—"}

  function complete(id) {
    if (!state.solved.includes(id)) {
      state.solved.push(id);
      const item = E.find(x=>x.id===id);
      syncLocalProgress();
      markActivity(); save(); syncProfileToServer();
      toast(`✓ ${item?.title || "exercise"} solved`);
      checkAchievements();
    }
    refreshProfile(); renderAll();
    if (selected) { renderDetail(); }
  }

  function checkAchievements() {
    const done = state.solved.length;
    if (done === 1) toast("🏆 FIRST BLOOD unlocked");
    if (done === 10) toast("🏆 TEN DEEP unlocked");
    if (state.streak === 7) toast("🔥 STREAK 7 unlocked");
    if (state.openedDrills === 5) toast("⏱ EXAM READY unlocked");
    if (E.some(x=>x.day===currentDay()) && dayExercises(currentDay()).length === 10 &&
        dayExercises(currentDay()).every(x=>solved(x.id))) toast("🏆 DAY BREAKER unlocked");
  }

  function renderAchievements() {
    const badges = [
      ["🥇","FIRST BLOOD","Solve your first exercise.",state.solved.length>=1],
      ["🔟","TEN DEEP","Solve 10 exercises.",state.solved.length>=10],
      ["🧭","DAY BREAKER","Complete a full day.",E.some(x=>dayExercises(x.day).length===10 && dayExercises(x.day).every(y=>solved(y.id)))],
      ["⏱","EXAM READY","Open 5 exam drills.",state.openedDrills>=5],
      ["🔥","STREAK 7","Reach a 7-day streak.",state.bestStreak>=7],
      ["⚡","RUNNER","Run code 20 times.",state.runs>=20]
    ];
    $("#achievementStrip").innerHTML = badges.map(b=>`<div class="badge ${b[3]?"":"locked"}"><div class="badge-icon">${b[0]}</div><b>${b[1]}</b><small>${b[2]}</small></div>`).join("");
  }

  function renderMission() {
    const d = currentDay(), list = dayExercises(d), next = list.find(x=>!solved(x.id)) || list[0];
    const done = list.filter(x=>solved(x.id)).length;
    $("#missionTag").textContent = d.toUpperCase();
    $("#missionTitle").textContent = next?.title || "Choose a challenge";
    $("#missionDesc").textContent = next?.description || "Open Training to keep moving.";
    $("#missionBar").style.width = `${list.length ? done/list.length*100 : 0}%`;
    $("#missionMeta").textContent = `${done} / ${list.length}`;
    $("#missionBtn").onclick = () => { if (next) { openExercise(next.id); go("lab"); } };
  }

  function renderRoad() {
    const days = Array.from({length:14},(_,i)=>`Day ${String(i).padStart(2,"0")}`);
    $("#roadStrip").innerHTML = days.slice(0,7).map(d=>{
      const list=dayExercises(d), done=list.filter(x=>solved(x.id)).length;
      return `<button class="road-card ${d===currentDay()?"current":""}" data-day="${d}">
        <b>${d}</b><strong>${esc(list[0]?.title||"Foundation")}</strong>
        <div class="mini-bar"><i style="width:${done/list.length*100}%"></i></div>
      </button>`;
    }).join("");
    $$(".road-card").forEach(b=>b.onclick=()=>openDay(b.dataset.day));
  }

  function renderDays() {
    const focus = [
      "Shell + write() + control flow","Pointers + arrays + core strings","String validation + case",
      "Parsing + custom string drills","Math + recursion foundations","Recursion + number patterns",
      "argc / argv + argument handling","malloc + arrays + ownership","Linked lists + mutation",
      "Builds + parsing + memory paths","Debugging + edge cases","Advanced strings + allocation",
      "Exam memory + speed","Exam pressure + mixed skills"
    ];
    $("#dayGrid").innerHTML = Array.from({length:14},(_,i)=>{
      const d=`Day ${String(i).padStart(2,"0")}`, list=dayExercises(d), done=list.filter(x=>solved(x.id)).length;
      return `<article class="day-card ${d===currentDay()?"current":""}">
        <div class="day-top"><span>${d}</span><span>${done}/${list.length}</span></div>
        <h3>${focus[i]}</h3><p>${i>=10?"Exam-near: mixed tasks, speed and edge cases.":"Build one layer at a time; repeat until the pattern is automatic."}</p>
        <div class="bar"><i style="width:${done/list.length*100}%"></i></div>
        <div class="count"><button class="text-btn" data-open-day="${d}">Open day →</button></div>
      </article>`;
    }).join("");
    $$("[data-open-day]").forEach(b=>b.onclick=()=>openDay(b.dataset.openDay));
  }

  function openDay(day) {
    currentFilter=day; renderFilters(); renderExercises(); go("training");
  }

  function renderFilters() {
    const days=["ALL",...Array.from({length:14},(_,i)=>`Day ${String(i).padStart(2,"0")}`)];
    $("#dayFilters").innerHTML=days.map(d=>`<button class="filter ${d===currentFilter?"active":""}" data-filter="${d}">${d}</button>`).join("");
    $$(".filter[data-filter]").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;renderFilters();renderExercises()});
    $$(".filter[data-sort]").forEach(b=>b.classList.toggle("active",b.dataset.sort===sortMode));
  }

  function renderExercises() {
    const q=($("#exerciseSearch")?.value||"").trim().toLowerCase();
    let list=E.filter(x=>(currentFilter==="ALL"||x.day===currentFilter) &&
      (!q || `${x.title} ${x.description} ${x.tag} ${x.day}`.toLowerCase().includes(q)));
    if(sortMode==="hard") list.sort((a,b)=>({hard:0,medium:1,easy:2}[a.difficulty]-({hard:0,medium:1,easy:2}[b.difficulty])));
    if(sortMode==="unsolved") list.sort((a,b)=>Number(solved(a.id))-Number(solved(b.id)));
    $("#exerciseList").innerHTML = list.length ? list.map((x,i)=>`
      <button class="exercise-row ${selected?.id===x.id?"selected":""}" data-id="${x.id}">
        <span class="ex-num">${String(i+1).padStart(2,"0")}</span>
        <span class="ex-main"><b>${esc(x.title)}</b><small>${esc(x.description)}</small></span>
        <span class="ex-tag">${esc(x.tag)}</span><span class="ex-status ${solved(x.id)?"done":""}"></span>
      </button>`).join("") : `<div class="empty-state"><span>⌕</span><h3>No match</h3><p>Try another day or search term.</p></div>`;
    $$(".exercise-row").forEach(b=>b.onclick=()=>{openExercise(b.dataset.id);go("lab")});
    if(selected) renderDetail();
  }

  function openExercise(id) {
    selected=ALL.find(x=>x.id===id) || null;
    if(!selected) return;
    renderExercises(); renderDetail(); loadSelectedToLab();
  }

  function renderDetail() {
    if(!selected) {
      $("#exerciseDetail").innerHTML=`<div class="detail-card empty-state"><span>⌘</span><h3>Select a drill</h3><p>Choose a challenge to see the brief and send it to Code Lab.</p></div>`;
      return;
    }
    const tests=selected.tests||[];
    $("#exerciseDetail").innerHTML=`<div class="detail-card">
      <div class="detail-head"><div><span class="eyebrow">${esc(selected.day)} · ${esc(selected.difficulty)}</span><h2>${esc(selected.title)}</h2></div><span class="pill">${esc(selected.tag)}</span></div>
      <p class="detail-desc">${esc(selected.description)}</p>
      <div class="detail-meta"><span class="pill">${selected.nearExam?"exam-near":"training"}</span><span class="pill">${tests.length?tests.length+" auto tests":"compile check"}</span></div>
      <div class="brief"><b>Brief</b><br>Implement the task cleanly. Compile with warnings, test edge cases, and keep the solution small enough to reason about.</div>
      <div class="hint-box"><b>Hint</b><p>${esc(selected.hint || "Start with the smallest case.")}</p></div>
      <div class="detail-actions"><button class="primary" id="detailStart">Open in Code Lab →</button></div>
    </div>`;
    $("#detailStart").onclick=()=>{loadSelectedToLab();go("lab")};
  }

  function loadSelectedToLab() {
    if(!selected) return;
    const ed = $("#codeEditor");
    ed.value = String(selected.starter||"").replaceAll("\\n","\n");
    // Always open a newly selected drill at the real top-left editor position.
    // Mobile browsers can retain the textarea scroll offset from the previous drill.
    ed.scrollTop = 0;
    ed.scrollLeft = 0;
    ed.selectionStart = 0;
    ed.selectionEnd = 0;
    $("#highlight").scrollTop = 0;
    $("#highlight").scrollLeft = 0;
    $("#lineNumbers").scrollTop = 0;
    $("#fileName").textContent = `${selected.title}.c`;
    $("#labTaskTitle").textContent = selected.title;
    $("#labTaskDesc").textContent = selected.description;
    syncEditor(); showOutput("console");
    $("#outputConsole").textContent = `$ Loaded ${selected.title}\n$ Read the brief, then Run or Ctrl↵.`;
    renderHint();
  }

  // Safe highlighting: tokenize first, then escape each token. Never regex-rewrite generated HTML.
  function highlightC(code) {
    const token = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:int|char|void|unsigned|signed|long|short|const|static|struct|typedef|return|if|else|while|for|break|continue|sizeof|NULL)\b|\b\d+\b)/g;
    let out="", last=0, m;
    while((m=token.exec(code))){
      out += esc(code.slice(last,m.index));
      const v=m[0], cls=v.startsWith("/*")||v.startsWith("//")?"tok-comment":
        v.startsWith('"')||v.startsWith("'")?"tok-string":
        /^\d+$/.test(v)?"tok-num":"tok-key";
      out += `<span class="${cls}">${esc(v)}</span>`;
      last=m.index+v.length;
    }
    out += esc(code.slice(last));
    return out;
  }

  function syncEditor() {
    const ed=$("#codeEditor"), code=ed.value;
    $("#highlight code").innerHTML=highlightC(code)+"\n";
    const lines=Math.max(1,code.split("\n").length);
    $("#lineNumbers").textContent=Array.from({length:lines},(_,i)=>i+1).join("\n");
    const p=ed.selectionStart||0, before=code.slice(0,p).split("\n");
    $("#cursorPos").textContent=`Ln ${before.length}, Col ${before.at(-1).length+1}`;
    $("#highlight").scrollTop=ed.scrollTop;
    $("#highlight").scrollLeft=ed.scrollLeft;
    $("#lineNumbers").scrollTop=ed.scrollTop;
    $("#lineNumbers").scrollLeft=0;
  }

  function renderHint() {
    $("#outputHint").innerHTML = selected
      ? `<div class="hint-box"><b>${esc(selected.title)}</b><p>${esc(selected.hint || "Reduce the problem to inputs → transformation → output.")}</p></div>`
      : `<div class="hint-box"><b>Stuck?</b><p>Reduce the problem to inputs → transformation → output, then test the smallest case.</p></div>`;
  }

  function showOutput(which) {
    ["console","tests","hint"].forEach(x=>$("#output"+x[0].toUpperCase()+x.slice(1)).classList.toggle("hidden",x!==which));
    $$(".lab-tab").forEach(b=>b.classList.toggle("active",b.dataset.output===which));
  }

  function renderTests(tests) {
    $("#testCount").textContent=tests.length;
    if(!tests.length) {
      $("#outputTests").innerHTML=`<div class="empty-state"><span>✓</span><h3>No automatic harness for this drill</h3><p>This drill uses a compile/runtime check. It is completed only when its validation passes.</p></div>`;
      return;
    }
    $("#outputTests").innerHTML=tests.map(t=>`
      <div class="test-row ${t.pass?"pass":"fail"}">
        <b>${t.pass?"PASS":"FAIL"} · ${esc(t.name)}</b>
        <small>${esc(t.detail||"")}</small>
      </div>`).join("");
  }


  function startMockTimer(){
    clearInterval(mockInterval); mockSeconds=3600;
    const el=$("#mockTimer"); if(!el) return;
    el.classList.remove("hidden");
    const tick=()=>{
      const m=String(Math.floor(mockSeconds/60)).padStart(2,"0"), s=String(mockSeconds%60).padStart(2,"0");
      el.textContent=`MOCK ${m}:${s}`;
      if(mockSeconds<=0){clearInterval(mockInterval); mockInterval=null; toast("⏱ Full Mock finished."); return;}
      mockSeconds--;
    };
    tick(); mockInterval=setInterval(tick,1000);
  }

  function stopMockTimer(){ clearInterval(mockInterval); mockInterval=null; const el=$("#mockTimer"); if(el) el.classList.add("hidden"); }

  async function runCode() {
    const code=$("#codeEditor").value;
    state.runs++; save(); refreshProfile();
    showOutput("console");
    $("#outputConsole").textContent="$ compiling…";
    try {
      const r=await fetch("/api/run",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({code,exercise:selected?.id||null})});
      const d=await r.json();
      let out=d.compile||"";
      if(d.output!==undefined) out += `\n\n$ output\n${d.output}`;
      if(d.error) out += `\n\n$ error\n${d.error}`;
      $("#outputConsole").textContent=out || "$ done";
      renderTests(d.tests||[]);
      if((d.tests||[]).length) showOutput("tests");
      if(d.all_pass && selected && !solved(selected.id)) {
        if(speedStartedAt){
          const seconds=Math.max(1,Math.round((Date.now()-speedStartedAt)/1000));
          if(!state.speedBest || seconds<state.speedBest) { state.speedBest=seconds; save(); toast(`⚡ New speedrun best: ${seconds}s`); }
          speedStartedAt=0;
        }
        complete(selected.id);
      }
    } catch(e) {
      $("#outputConsole").textContent="$ Backend unavailable.\n\nRun ./run.sh in the POOLER folder.\nThe editor itself stays local, but compile/test needs the included server.";
    }
  }


  const LESSONS = [
    {id:"start-here",title:"Start Here — How POOLER works",tag:"ONBOARDING",desc:"Learn the workflow, the C basics you will use first, then finish your first guided mission.",body:"POOLER is built as a learn → try → test → fix → submit loop. Start by reading the short explanation, copy the idea into Code Lab, run the compiler and tests, read the result, fix your code, and only then move to the next drill. You do not need to memorize everything at once: each lesson introduces one concept and ends with a small task.",example:`1. Read the brief
2. Understand the concept
3. Try the example yourself
4. Open Code Lab
5. Compile / run / test
6. Fix errors and submit
`,remember:"Never skip the compiler output. An error is feedback: read the first useful line, locate the file/line, fix one thing, then test again.",practice:"First mission: implement ft_putchar so the test harness prints one character. After it passes, continue with ft_print_alphabet.",steps:["1 · Learn the idea — read the lesson and understand the vocabulary.","2 · Try it — change or rewrite the example without blindly copying it.","3 · Test it — use Code Lab and read compiler/test output.","4 · Fix it — make one correction at a time and rerun.","5 · Move on — once the mission works, open the next Pool exercise."],practiceExercise:"ft_putchar"},
    {id:"variables",title:"Variables & types",tag:"C BASICS",desc:"Understand how C stores values and why the type matters.",body:"A variable is a named memory location. In C, the type tells the compiler what kind of value is stored and how much space it needs. Common Pool types include int for integers and char for one character.",example:`int age = 18;\nchar c = 'a';\n`,remember:"Declare before use. Match the type to the value.",practice:"Create an int called n, set it to 42, and print it with write() by converting the digit to a character."},
    {id:"write",title:"write()",tag:"OUTPUT",desc:"Print characters using the only output function allowed in many early Pool drills.",body:"write() sends bytes to a file descriptor. For standard output, use descriptor 1. Its basic form is write(1, &c, 1): address of the data plus number of bytes.",example:`#include <unistd.h>\n\nchar c = 'A';\nwrite(1, &c, 1);\n`,remember:"1 = stdout. &c gives the address. 1 means one byte.",practice:"Print the alphabet from a to z with write()."},
    {id:"conditions",title:"if / else",tag:"CONTROL FLOW",desc:"Make a program choose between different paths.",body:"if evaluates a condition. If it is true, its block runs; otherwise an else block can run. Comparisons such as ==, !=, < and >= produce a boolean-like result in C.",example:`if (c >= 'a' && c <= 'z')\n{\n\twrite(1, &c, 1);\n}\n`,remember:"Use == for comparison. = is assignment.",practice:"Print only lowercase letters from a string."},
    {id:"loops",title:"while & for loops",tag:"LOOPS",desc:"Repeat an operation while a condition remains true.",body:"A loop has three important parts: initialization, condition and update. A while loop makes those steps explicit; a for loop puts them together. Always make sure the loop variable changes so the loop can terminate.",example:`int i = 0;\nwhile (i < 10)\n{\n\twrite(1, &c, 1);\n\ti++;\n}\n`,remember:"Check the condition, update the state, and know when the loop stops.",practice:"Write a loop that prints the digits 0 through 9."},
    {id:"arrays",title:"Arrays",tag:"MEMORY",desc:"Store several values of the same type in contiguous memory.",body:"An array groups elements of the same type. Indexing starts at 0, so an array of 5 elements uses indexes 0 to 4. Accessing outside the valid range is undefined behavior.",example:`int nums[3];\nnums[0] = 10;\nnums[1] = 20;\nnums[2] = 30;\n`,remember:"First element = index 0. Last element = size - 1.",practice:"Loop through an int array and find its largest value."},
    {id:"pointers",title:"Pointers",tag:"POINTERS",desc:"Understand addresses, dereferencing and why pointers matter in C.",body:"A pointer stores an address. The & operator obtains an address and * dereferences a pointer to access the value at that address. Pointers let functions modify data owned by their caller.",example:`int n = 42;\nint *p = &n;\n*p = 43;\n`,remember:"& = address. * = value at an address when used as a dereference.",practice:"Write a function that swaps two integers using pointers."},
    {id:"strings",title:"Strings",tag:"STRINGS",desc:"Treat C strings as character arrays terminated by \"\0\".",body:"C has no built-in string object. A string is a sequence of chars ending with the null character \"\0\". Loops usually stop when str[i] becomes zero.",example:`char *s = "hello";\nint i = 0;\nwhile (s[i])\n\ti++;\n`,remember:"The terminator \"\0\" is part of the representation and marks the end.",practice:"Implement your own string length function without strlen()."},
    {id:"argc-argv",title:"argc / argv",tag:"PROGRAMS",desc:"Read arguments passed to a C program from the command line.",body:"argc tells you how many arguments exist. argv is an array of strings. argv[0] is normally the program name, and user-provided arguments start at argv[1].",example:`int main(int argc, char **argv)\n{\n\t(void)argc;\n\t(void)argv;\n\treturn (0);\n}\n`,remember:"Always respect argc before reading argv[i].",practice:"Write a program that prints its first command-line argument."},
    {id:"malloc",title:"malloc / free",tag:"MEMORY",desc:"Allocate memory dynamically and release it correctly.",body:"malloc reserves a requested number of bytes and returns an address. The memory is uninitialized. free releases memory previously allocated by malloc. Forgetting free causes a leak; using freed memory is invalid.",example:`int *a = malloc(3 * sizeof(int));\nif (!a)\n\treturn (1);\n/* use a */\nfree(a);\n`,remember:"Every successful malloc needs a matching free when ownership ends.",practice:"Allocate an array of n integers, initialize it, then free it."},
    {id:"recursion",title:"Recursion",tag:"ALGORITHMS",desc:"Solve a problem by reducing it to smaller versions of itself.",body:"A recursive function calls itself. It needs a base case that stops recursion and a recursive case that moves toward that base case. Without a valid base case, the calls can continue until the stack overflows.",example:`int fact(int n)\n{\n\tif (n <= 1)\n\t\treturn (1);\n\treturn (n * fact(n - 1));\n}\n`,remember:"Base case + progress toward the base case.",practice:"Implement a recursive function that prints numbers from n down to 1."},
    {id:"debugging",title:"Debugging C",tag:"DEBUGGING",desc:"Turn compiler and test failures into useful information.",body:"Read the first error first. Compile with warnings such as -Wall -Wextra. Check types, indexes, pointer validity, loop conditions and return values. Change one thing at a time and rerun the smallest useful test.",example:`cc -Wall -Wextra -Werror file.c\n./a.out\n`,remember:"Compiler warning → understand it. Failing test → reproduce it. Then isolate the cause.",practice:"Take one of your old Pool exercises and deliberately introduce one bug, then diagnose it."}
  ];

  function renderLessons(filter="") {
    const q=String(filter||"").toLowerCase().trim();
    const list=LESSONS.filter(l=>!q || `${l.title} ${l.tag} ${l.desc} ${l.body}`.toLowerCase().includes(q));
    $("#lessonList").innerHTML=list.length ? list.map((l,i)=>`<button class="lesson-row ${selectedLesson===l.id?"selected":""}" data-lesson="${l.id}"><span class="lesson-num">${String(i+1).padStart(2,"0")}</span><span><b>${esc(l.title)}</b><small>${esc(l.desc)}</small></span><em>${esc(l.tag)}</em></button>`).join("") : `<div class="empty-state"><span>⌕</span><h3>No lesson found</h3><p>Try another search.</p></div>`;
    $$("[data-lesson]").forEach(b=>b.onclick=()=>showLesson(b.dataset.lesson));
    if(selectedLesson && LESSONS.some(x=>x.id===selectedLesson)) showLesson(selectedLesson,false); else if(list.length) showLesson(list[0].id,false);
  }
  let selectedLesson="start-here";
  function showLesson(id,rerender=true){
    const l=LESSONS.find(x=>x.id===id); if(!l) return; selectedLesson=id;
    const steps = Array.isArray(l.steps) ? `<div class="lesson-section"><h3>Your workflow</h3><div class="lesson-steps">${l.steps.map((x,i)=>`<div class="lesson-step"><span>${String(i+1).padStart(2,"0")}</span><p>${esc(x)}</p></div>`).join("")}</div></div>` : "";
    const cta = l.practiceExercise ? "Start first mission →" : "Open Code Lab →";
    $("#lessonDetail").innerHTML=`<div class="lesson-detail-inner"><span class="eyebrow">${esc(l.tag)}</span><h2>${esc(l.title)}</h2><p class="lesson-lead">${esc(l.desc)}</p>${steps}<div class="lesson-section"><h3>Understand</h3><p>${esc(l.body)}</p></div><div class="lesson-section"><h3>Example</h3><pre><code>${esc(l.example)}</code></pre></div><div class="lesson-section lesson-remember"><h3>Remember</h3><p>${esc(l.remember)}</p></div><div class="lesson-section"><h3>Practice</h3><p>${esc(l.practice)}</p></div><button class="primary" id="lessonToLab">${cta}</button></div>`;
    $("#lessonToLab").onclick=()=>{ if(l.practiceExercise) openExercise(l.practiceExercise); else go("lab"); };
    if(rerender) renderLessons($("#lessonSearch")?.value||"");
  }

  function renderExams() {
    $("#examGrid").innerHTML=X.map(x=>`<article class="exam-card">
      <span class="eyebrow">${esc(x.id)}</span><b>${esc(x.title)}</b><p>${esc(x.description)}</p>
      <div class="card-foot"><span class="difficulty">${esc(x.difficulty)}</span><button class="ghost" data-drill="${x.id}">Open →</button></div>
    </article>`).join("");
    $$("[data-drill]").forEach(b=>b.onclick=()=>{
      state.openedDrills++; save(); refreshProfile();
      selected=X.find(x=>x.id===b.dataset.drill); loadSelectedToLab(); go("lab");
    });
  }

  function renderConcepts() {
    $("#conceptGrid").innerHTML=(window.POOLER_CONCEPTS||[]).map(c=>`<article class="panel"><span class="eyebrow">MENTAL MODEL</span><h3>${esc(c[0])}</h3><p>${esc(c[1])}</p></article>`).join("");
  }
  function renderTools() {
    $("#toolGrid").innerHTML=(window.POOLER_TOOLS||[]).map(t=>`<article class="tool-card"><h3>${esc(t[0])}</h3><p>${esc(t[2])}</p><pre>${esc(t[1])}</pre></article>`).join("");
  }
  function renderProfilePage() {
    const name=state.name||"Learner", pct=Math.round(state.solved.length/E.length*100);
    const profileAvatar=$("#profileAvatar"); if(profileAvatar){ if(avatarOk(state.avatar)) profileAvatar.innerHTML=`<img src="${esc(state.avatar)}" alt="">`; else profileAvatar.textContent=(name[0]||"L").toUpperCase(); profileAvatar.classList.toggle("avatar-photo",avatarOk(state.avatar)); }
    $("#profileNameView").textContent=name;
    $("#profileBioView").textContent=state.bio||defaults.bio;
    $("#profileSolvedChip").textContent=`${state.solved.length} solved`;
    $("#profileStreakChip").textContent=`${state.streak} day streak`;
    $("#profileSolvedView").textContent=state.solved.length;
    $("#profileRunsView").textContent=state.runs;
    $("#profileBestView").textContent=state.bestStreak;
    $("#profileProgressView").textContent=`${pct}%`;
    const badges=[
      ["🥇","FIRST BLOOD","Solve your first exercise.",state.solved.length>=1],
      ["🔟","TEN DEEP","Solve 10 exercises.",state.solved.length>=10],
      ["🧭","DAY BREAKER","Complete a full day.",E.some(x=>dayExercises(x.day).length===10&&dayExercises(x.day).every(y=>solved(y.id)))],
      ["⏱","EXAM READY","Open 5 exam drills.",state.openedDrills>=5],
      ["🔥","STREAK 7","Reach a 7-day streak.",state.bestStreak>=7],
      ["⚡","RUNNER","Run code 20 times.",state.runs>=20]
    ];
    $("#profileBadgeGrid").innerHTML=badges.map(b=>`<div class="profile-badge ${b[3]?"earned":"locked"}"><span>${b[0]}</span><div><b>${b[1]}</b><small>${b[2]}</small></div></div>`).join("");
  }

  function renderStats() {
    const pct=Math.round(state.solved.length/E.length*100);
    $("#completionPct").textContent=`${pct}%`; $("#completionBar").style.width=`${pct}%`;
    $("#dayMini").innerHTML=Array.from({length:14},(_,i)=>{
      const d=`Day ${String(i).padStart(2,"0")}`, n=dayExercises(d).filter(x=>solved(x.id)).length;
      return `<div class="day-mini"><span>${d}</span><b>${n}/10</b></div>`;
    }).join("");
  }

  function renderLeaderboard(list=[]){
    const users=Array.isArray(list)?list:[]; window.__POOLER_LEADERBOARD=users;
    $("#leaderRows").innerHTML=users.slice(0,25).map((u,i)=>`
      <div class="leader-row ${authUser&&u.id===authUser.id?"me":""}">
        <span class="rank">#${i+1}</span><div class="leader-person">${avatarHtml(u.avatar,u.name,"avatar")}
        <div><b>${esc(u.name||"Learner")}</b><small>${esc(u.bio||"POOLER learner")}${authUser&&u.id===authUser.id?" · you":""}</small></div></div>
        <span class="leader-progress"><b>Lv ${Number(u.level)||1}</b><small>${Number(u.xp)||0} XP · ${Number(u.solved)||0} solved</small></span>
      </div>`).join("");
    $("#leaderStatus").textContent=`${users.length} account${users.length===1?"":"s"}`;
    $("#leaderMe").innerHTML=authUser?`<div class="profile-block">${avatarHtml(authUser.avatar||state.avatar,authUser.name,"avatar large")}<div><b>${esc(authUser.name)}</b><small>@${esc(authUser.username)} · Lv ${Number(authUser.level)||currentLevel()} · ${Number(authUser.xp)||state.xp} XP · ${state.solved.length} solved · ${state.streak} day streak</small></div></div>`:`<div class="profile-block"><span class="avatar large">?</span><div><b>Sign in to save your profile</b><small>Your leaderboard entry is created only after you make an account.</small></div></div>`;
  }
  async function loadLeaderboard(){
    try {
      const r=await fetch("/api/leaderboard",{cache:"no-store"});
      if(!r.ok) throw new Error("leaderboard request failed");
      const d=await r.json(); renderLeaderboard(d.users||[]);
    } catch {
      renderLeaderboard([]); $("#leaderStatus").textContent="local account · server offline";
    }
  }

  function closeMobileSidebar(){ const sb=$("#sidebar"), ov=$("#mobileOverlay"); if(sb){sb.classList.remove("open","active");} if(ov) ov.classList.remove("open"); document.body.classList.remove("sidebar-open"); }
  function go(view, writeHash=true) {
    if(view==="admin" && !(authUser && authUser.role === "admin")){ toast("Admin access required"); view="dashboard"; }
    if(!$("#view-"+view)) view="dashboard";
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $$(".view").forEach(v=>v.classList.remove("active"));
    $("#view-"+view).classList.add("active");
    const label=$(`.nav-item[data-view="${view}"] b`)?.textContent || view;
    $("#viewTitle").textContent=label;
    applyLang();
    closeMobileSidebar();
    if(writeHash) { const target=`#${view}`; if(location.hash!==target) history.pushState({view},"",target); }
    window.scrollTo({top:0,behavior:"auto"});
    if(view==="leaderboard") loadLeaderboard();
    if(view==="admin") loadAdmin();
    if(view==="lessons") renderLessons($("#lessonSearch")?.value||"");
    if(view==="exams") renderExams();
  }
  function restoreView(){
    const raw=location.hash.replace(/^#/,"");
    const view=raw.split("?")[0] || "dashboard";
    go($("#view-"+view)?view:"dashboard", false);
  }
  window.addEventListener("hashchange", restoreView);
  window.addEventListener("popstate", restoreView);
  window.addEventListener("pageshow", restoreView);

  function profileOpen(){ $("#profileName").value=state.name; $("#profileBio").value=state.bio; $("#profileFile").value=""; const pv=$("#profileUploadPreview"); if(pv){ if(avatarOk(state.avatar)) pv.innerHTML=`<img src="${esc(state.avatar)}" alt="">`; else pv.textContent=(state.name||"L")[0].toUpperCase(); pv.classList.toggle("avatar-photo",avatarOk(state.avatar)); } $("#profileModal").classList.add("open"); }
  function profileClose(){ $("#profileModal").classList.remove("open"); }
  function initGlobalSearch(){
    const input=$("#globalSearch"), box=$("#globalResults"); if(!input||!box)return;
    let users=[]; let usersLoaded=false; let timer=0;
    const loadUsers=async()=>{if(usersLoaded)return; try{const r=await fetch("/api/leaderboard",{cache:"no-store"}); if(r.ok){const d=await r.json(); users=Array.isArray(d.users)?d.users:[];}}catch{} usersLoaded=true;};
    const run=async raw=>{
      const q=raw.trim().toLowerCase(); if(!q){box.classList.remove("open");return;}
      await loadUsers();
      const ex=E.filter(x=>`${x.title} ${x.id} ${x.description||""} ${x.tag||""}`.toLowerCase().includes(q)).slice(0,5);
      const ls=LESSONS.filter(x=>`${x.title} ${x.tag} ${x.desc||""} ${x.body||""}`.toLowerCase().includes(q)).slice(0,4);
      const cs=(window.POOLER_CONCEPTS||[]).filter(x=>`${x[0]||""} ${x[1]||""}`.toLowerCase().includes(q)).slice(0,3);
      const us=users.filter(x=>`${x.username||""} ${x.name||""} ${x.bio||""}`.toLowerCase().includes(q)).slice(0,3);
      const out=[...ex.map(x=>({type:"Exercise",title:x.title,id:x.id})),...ls.map(x=>({type:"Lesson",title:x.title,id:x.id})),...cs.map(x=>({type:"Concept",title:x[0],id:"concepts"})),...us.map(x=>({type:"User",title:x.username||x.name||"User",id:x.username}))];
      box.innerHTML=out.length?out.map((x,i)=>`<div class="global-result" data-gi="${i}"><b>${esc(x.title)}</b><small>${x.type}</small></div>`).join(""):`<div class="global-result"><small>No matching result.</small></div>`;
      box.classList.add("open");
      $$(".global-result[data-gi]").forEach((el,i)=>el.onclick=()=>{const x=out[i];box.classList.remove("open");input.value=""; if(x.type==="Exercise"){openExercise(x.id);go("lab")} else if(x.type==="Lesson"){go("lessons");setTimeout(()=>{const b=$(`[data-lesson="${x.id}"]`);b?.click()},30)} else if(x.type==="Concept"){go("concepts")} else {go("leaderboard")}});
    };
    input.addEventListener("input",e=>{clearTimeout(timer);timer=setTimeout(()=>run(e.target.value),80)});
    input.addEventListener("focus",()=>loadUsers());
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){const first=box.querySelector(".global-result[data-gi]");first?.click()} if(e.key==="Escape"){box.classList.remove("open");input.blur()}});
    document.addEventListener("click",e=>{if(!e.target.closest(".top-search"))box.classList.remove("open")});
    document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();input.focus();input.select()}});
  }

  function initEditor() {
    const ed=$("#codeEditor");
    ["input","scroll","click","keyup","select"].forEach(ev=>ed.addEventListener(ev,syncEditor));
    ed.addEventListener("touchend",syncEditor,{passive:true});
    ed.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save();toast("Progress saved locally");return}
      if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();runCode();return}
      if(e.key==="Tab"){
        e.preventDefault();
        const a=ed.selectionStart,b=ed.selectionEnd;
        const selectedText=ed.value.slice(a,b);
        if(selectedText.includes("\n")){
          const replaced=selectedText.split("\n").map((line,idx)=>idx?"\t"+line:line).join("\n");
          ed.value=ed.value.slice(0,a)+replaced+ed.value.slice(b);
          ed.selectionStart=a; ed.selectionEnd=a+replaced.length;
        } else {
          ed.value=ed.value.slice(0,a)+"\t"+ed.value.slice(b); ed.selectionStart=ed.selectionEnd=a+1;
        }
        syncEditor(); return;
      }
      if(e.key==="Enter"){
        const p=ed.selectionStart, line=ed.value.slice(0,p).split("\n").at(-1);
        const indent=(line.match(/^\s+/)||[""])[0];
        setTimeout(()=>{const q=ed.selectionStart;ed.value=ed.value.slice(0,q)+indent+ed.value.slice(q);ed.selectionStart=ed.selectionEnd=q+indent.length;syncEditor()},0);
      }
    });
    syncEditor();
  }

  function initFocus() {
    $("#focusBtn").onclick=()=>$("#focusOverlay").classList.add("open");
    $("#focusClose").onclick=()=>{clearInterval(focusInterval);$("#focusOverlay").classList.remove("open")};
    $("#focusStart").onclick=()=>{
      clearInterval(focusInterval); focusSeconds=1500; $("#focusTimer").textContent="25:00";
      focusInterval=setInterval(()=>{
        focusSeconds--; const m=String(Math.floor(focusSeconds/60)).padStart(2,"0"), s=String(focusSeconds%60).padStart(2,"0");
        $("#focusTimer").textContent=`${m}:${s}`;
        if(focusSeconds<=0){clearInterval(focusInterval);toast("Focus complete. Nice work.");}
      },1000);
    };
  }

  function randomChallenge(filterFn=()=>true) {
    const pool=E.filter(x=>filterFn(x) && !solved(x.id));
    const pick=(pool.length?pool:E)[Math.floor(Math.random()*(pool.length?pool:E).length)];
    openExercise(pick.id); go("lab"); toast(`🎲 ${pick.title}`);
  }

  function bugHunt(){ randomChallenge(x=>x.tag==="debugging"||x.tag==="edge-cases"||x.tag==="memory"); }
  function speedRun(){ speedStartedAt=Date.now(); randomChallenge(x=>x.difficulty==="easy"||x.difficulty==="medium"); toast("⚡ Speedrun started — your time begins now."); }
  function boss(){ randomChallenge(x=>x.difficulty==="hard"); toast("☠ Daily Boss selected."); }

  $$(".nav-item").forEach(b=>b.onclick=()=>{ go(b.dataset.view); closeMobileSidebar(); });
  $$("[data-jump]").forEach(b=>b.onclick=()=>go(b.dataset.jump));
  $("#continueBtn").onclick=()=>{const x=E.find(x=>!solved(x.id))||E[0];openExercise(x.id);go("lab")};
  $("#openLabDash")?.addEventListener("click",()=>go("lab"));
  $("#focusStartDash")?.addEventListener("click",()=>go("lab"));
  $("#randomBtn").onclick=()=>randomChallenge();
  $("#randomBtn2").onclick=()=>randomChallenge();
  $("#bugHuntBtn").onclick=bugHunt;
  $("#speedBtn").onclick=speedRun;
  $("#bossBtn").onclick=boss;
  $("#exerciseSearch").addEventListener("input",renderExercises);
  $("#lessonSearch").addEventListener("input",e=>renderLessons(e.target.value));
  $$(".filter[data-sort]").forEach(b=>b.onclick=()=>{sortMode=b.dataset.sort;renderFilters();renderExercises()});
  $("#loadStarter").onclick=()=>selected&&loadSelectedToLab();
  $("#clearCode").onclick=()=>{$("#codeEditor").value="";syncEditor()};
  $("#copyCode").onclick=async()=>{try{await navigator.clipboard.writeText($("#codeEditor").value);toast("Code copied")}catch{toast("Clipboard unavailable")}};
  $("#runCode").onclick=runCode;
  $$(".lab-tab").forEach(b=>b.onclick=()=>showOutput(b.dataset.output));
  $("#openProfile").onclick=()=>go("profile"); $("#editProfile").onclick=profileOpen;
  $("#profileEditBtn").onclick=profileOpen;
  $("#profileTrainBtn").onclick=()=>go("training");
  $("#closeProfile").onclick=profileClose; $("#cancelProfile").onclick=profileClose;
  $("#profileFile").onchange=e=>pickAvatar(e.target.files?.[0]);
  $("#changeAvatarBtn").onclick=()=>$("#profileFile").click();
  $("#saveProfile").onclick=async()=>{state.name=$("#profileName").value.trim()||"Learner";state.bio=$("#profileBio").value.trim()||defaults.bio;save();profileClose();refreshProfile();renderProfilePage();const ok=await syncProfileToServer();loadLeaderboard();toast(authUser?(ok?"Profile saved":"Profile saved locally · sync unavailable"):"Profile saved locally · create an account to keep it")};
  $("#loginBtn").onclick=()=>openAuth("login"); $("#registerBtn").onclick=()=>openAuth("register"); $("#accountLoginBtn").onclick=()=>openAuth("login"); $("#accountCreateBtn").onclick=()=>openAuth("register");
  $("#logoutBtn").onclick=async()=>{try{await fetch("/api/auth/logout",{method:"POST"});}catch{} authUser=null; localStorage.removeItem(USER_KEY); refreshAccountUI(); loadLeaderboard(); toast("Logged out")};
  $("#closeAuth").onclick=closeAuth; $("#cancelAuth").onclick=closeAuth; $("#authRegisterTab").onclick=()=>{authMode="register";updateAuthMode()}; $("#authLoginTab").onclick=()=>{authMode="login";updateAuthMode()}; $("#submitAuth").onclick=submitAuth; $("#authPassword").addEventListener("keydown",e=>{if(e.key==="Enter")submitAuth()});
  $("#onboardingNext").onclick=()=>{const steps=onboardingCopy[state.lang]||onboardingCopy.en;if(onboardingStep<steps.length-1){onboardingStep++;renderOnboarding()}else{closeOnboarding();go("lessons");}};
  $("#onboardingBack").onclick=()=>{if(onboardingStep>0){onboardingStep--;renderOnboarding()}};
  $("#skipOnboarding").onclick=closeOnboarding; $("#onboardingSkipText").onclick=closeOnboarding;
  $("#onboardingModal").onclick=e=>{if(e.target.id==="onboardingModal")closeOnboarding()};
  $("#themeBtn").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";save();applyTheme()};
  const UI_LANG = {
    en:{nav:["Dashboard","Training","Code Lab","Exam Room","Roadmap","Concepts","Lessons","Pool Tools","Leaderboard","Profile","Analytics","Admin Console"],
      view:{dashboard:"Dashboard",training:"Training",lab:"Code Lab",exams:"Exam Room",roadmap:"Roadmap",concepts:"Concepts",lessons:"Lessons",tools:"Pool Tools",leaderboard:"Leaderboard",profile:"Profile",stats:"Analytics",admin:"Admin Console"},
      continue:"Continue training", random:"🎲 Random challenge", starter:"Starter", clear:"Clear", copy:"Copy", run:"Run", save:"Save", edit:"Edit", refresh:"Refresh",
      search:"Search title, skill, day…", workspace:"WORKSPACE", learn:"LEARN", community:"COMMUNITY", quest:"TODAY'S QUEST", pulse:"POOLER PULSE", badges:"ACHIEVEMENTS", road:"YOUR ROAD"},
    fr:{nav:["Tableau","Entraînement","Code Lab","Salle d'examen","Parcours","Concepts","Leçons","Outils Pool","Classement","Profil","Analytique","Console Admin"],
      view:{dashboard:"Tableau",training:"Entraînement",lab:"Code Lab",exams:"Salle d'examen",roadmap:"Parcours",concepts:"Concepts",lessons:"Leçons",tools:"Outils Pool",leaderboard:"Classement",profile:"Profil",stats:"Analytique",admin:"Console Admin"},
      continue:"Continuer l'entraînement", random:"🎲 Défi aléatoire", starter:"Départ", clear:"Effacer", copy:"Copier", run:"Exécuter", save:"Enregistrer", edit:"Modifier", refresh:"Actualiser",
      search:"Rechercher un titre, une compétence, un jour…", workspace:"ESPACE", learn:"APPRENDRE", community:"COMMUNAUTÉ", quest:"QUÊTE DU JOUR", pulse:"POOLER PULSE", badges:"SUCCÈS", road:"TON PARCOURS"},
    ar:{nav:["الرئيسية","التدريب","مختبر الكود","غرفة الامتحان","المسار","المفاهيم","الدروس","أدوات Pool","الترتيب","البروفايل","الإحصائيات","لوحة الإدارة"],
      view:{dashboard:"الرئيسية",training:"التدريب",lab:"مختبر الكود",exams:"غرفة الامتحان",roadmap:"المسار",concepts:"المفاهيم",lessons:"الدروس",tools:"أدوات Pool",leaderboard:"الترتيب",profile:"البروفايل",stats:"الإحصائيات",admin:"لوحة الإدارة"},
      continue:"كمل التدريب", random:"🎲 تحدي عشوائي", starter:"البداية", clear:"مسح", copy:"نسخ", run:"تشغيل", save:"حفظ", edit:"تعديل", refresh:"تحديث",
      search:"قلب على تمرين، مهارة، نهار…", workspace:"مساحة العمل", learn:"تعلّم", community:"المجتمع", quest:"مهمة اليوم", pulse:"POOLER PULSE", badges:"الإنجازات", road:"المسار ديالك"}
  };
  function applyLang(){
    const l=UI_LANG[state.lang]||UI_LANG.en;
    document.documentElement.lang=state.lang;
    document.documentElement.dir=state.lang==="ar"?"rtl":"ltr";
    $$(".nav-item b").forEach((el,i)=>el.textContent=l.nav[i]||el.textContent);
    const active=$(".nav-item.active")?.dataset.view||"dashboard";
    $("#viewTitle").textContent=l.view[active]||active;
    $("#continueBtn").firstChild.textContent=l.continue+" ";
    $("#randomBtn").textContent=l.random;
    $("#randomBtn2 b").textContent=state.lang==="ar"?"فاجئني":state.lang==="fr"?"Surprends-moi":"Surprise me";
    $("#loadStarter").textContent=l.starter; $("#clearCode").textContent=l.clear; $("#copyCode").textContent=l.copy;
    const run=$("#runCode"); if(run) run.childNodes[0].textContent=l.run+" ";
    if($("#saveProfile")) $("#saveProfile").textContent=l.save; if($("#editProfile")) $("#editProfile").textContent=l.edit; if($("#refreshLeaderboard")) $("#refreshLeaderboard").textContent=l.refresh;
    $("#exerciseSearch").placeholder=l.search;
    $$(".side-label").forEach((el,i)=>{if(i===0)el.textContent=l.workspace;if(i===1)el.textContent=l.learn;if(i===2)el.textContent=l.community});
    $$(".section-head .eyebrow").forEach(el=>{if(el.textContent.includes("YOUR ROAD"))el.textContent=l.road;if(el.textContent.includes("ACHIEVEMENTS"))el.textContent=l.badges});
    const q=$(".mission-card .eyebrow"); if(q)q.textContent=l.quest;
    const pulse=$(".pulse-card .eyebrow"); if(pulse)pulse.textContent=l.pulse;
    $("#langBtn").textContent=state.lang.toUpperCase();
  }
  $("#mobileMenu").onclick=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    const sb=$("#sidebar"), ov=$("#mobileOverlay");
    if(!sb) return;
    const open=!sb.classList.contains("open");
    sb.classList.toggle("open",open);
    sb.classList.toggle("active",open);
    if(ov) ov.classList.toggle("open",open);
    document.body.classList.toggle("sidebar-open",open);
  };
  $("#mobileOverlay").onclick=closeMobileSidebar;
  document.addEventListener("click",e=>{ const sb=$("#sidebar"), btn=$("#mobileMenu"); if(window.innerWidth<=768 && sb.classList.contains("open") && !sb.contains(e.target) && !btn.contains(e.target)) closeMobileSidebar(); });
  $("#langBtn").onclick=()=>{ state.lang=state.lang==="en"?"fr":state.lang==="fr"?"ar":"en"; save(); applyLang(); toast(`Language: ${state.lang.toUpperCase()}`); };
  $("#refreshLeaderboard").onclick=loadLeaderboard;
  $("#refreshAdmin")?.addEventListener("click",loadAdmin);
  $("#adminUsers")?.addEventListener("click",handleAdminClick);
  $("#startMock").onclick=()=>{state.openedDrills++;save();refreshProfile();selected=X.find(x=>x.tag==="full-mock")||X.at(-1);loadSelectedToLab();go("lab");startMockTimer();toast("⏱ Full Mock started — 60 minutes on the clock.");};

  async function loadAdmin(){
    if(!(authUser && authUser.role === "admin")) return;
    const box=$("#adminUsers"), status=$("#adminStatus"), stats=$("#adminStats");
    if(status) status.textContent="Loading…";
    try{
      const r=await fetch("/api/admin/users",{cache:"no-store"}); const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Admin request failed");
      const users=d.users||[];
      if(stats) stats.innerHTML=`<article class="panel profile-stat"><span class="eyebrow">ACCOUNTS</span><strong>${users.length}</strong><small>registered users</small></article><article class="panel profile-stat"><span class="eyebrow">ADMINS</span><strong>${users.filter(u=>u.role==="admin").length}</strong><small>privileged accounts</small></article><article class="panel profile-stat"><span class="eyebrow">TOTAL XP</span><strong>${users.reduce((a,u)=>a+(Number(u.xp)||0),0)}</strong><small>community XP</small></article><article class="panel profile-stat"><span class="eyebrow">SOLVED</span><strong>${users.reduce((a,u)=>a+(Number(u.solved)||0),0)}</strong><small>recorded solves</small></article>`;
      if(status) status.textContent=`${users.length} accounts`;
      if(box) box.innerHTML=users.map(u=>`<div class="admin-user" data-id="${esc(u.id)}" style="display:grid;grid-template-columns:1.2fr 1fr 1fr 110px 100px 90px;gap:10px;align-items:end;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.08)">
        <label><small>Username</small><input class="admin-input" data-field="username" value="${esc(u.username)}"></label>
        <label><small>Name</small><input class="admin-input" data-field="name" value="${esc(u.name)}"></label>
        <label><small>Bio</small><input class="admin-input" data-field="bio" value="${esc(u.bio||"")}"></label>
        <label><small>XP</small><input class="admin-input" data-field="xp" type="number" min="0" value="${Number(u.xp)||0}"></label>
        <label><small>Level</small><input class="admin-input" value="${Number(u.level)||1}" disabled></label>
        <label><small>Role</small><select class="admin-input" data-field="role"><option value="user" ${u.role!=="admin"?"selected":""}>User</option><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option></select></label>
        <label><small>Solved</small><input class="admin-input" data-field="solved" type="number" min="0" value="${Number(u.solved)||0}"></label>
        <label><small>Streak</small><input class="admin-input" data-field="streak" type="number" min="0" value="${Number(u.streak)||0}"></label>
        <label><small>Best streak</small><input class="admin-input" data-field="best_streak" type="number" min="0" value="${Number(u.best_streak)||0}"></label>
        <label><small>Runs</small><input class="admin-input" data-field="runs" type="number" min="0" value="${Number(u.runs)||0}"></label>
        <label><small>Drills opened</small><input class="admin-input" data-field="opened_drills" type="number" min="0" value="${Number(u.opened_drills)||0}"></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="primary admin-save">Save</button><button class="ghost admin-reset">Reset</button><button class="ghost admin-delete" ${u.id===authUser.id?"disabled":""}>Delete</button></div>
      </div>`).join("") || `<p class="fine">No accounts yet.</p>`;
    }catch(e){ if(status) status.textContent=e.message||"Could not load admin data"; }
  }
  async function adminAction(url, payload){
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
    const d=await r.json(); if(!r.ok) throw new Error(d.error||"Request failed"); return d;
  }
  async function handleAdminClick(e){
    const row=e.target.closest(".admin-user"); if(!row) return; const id=row.dataset.id;
    if(e.target.closest(".admin-save")){
      const payload={id}; row.querySelectorAll("[data-field]").forEach(el=>payload[el.dataset.field]=el.value);
      try{await adminAction("/api/admin/users/update",payload); toast("User updated"); await loadAdmin(); if(id===authUser.id){const me=await fetch("/api/me",{cache:"no-store"}); const md=await me.json(); if(md.user) applyServerUser(md.user);}}catch(err){toast(err.message);}
    }
    if(e.target.closest(".admin-reset")){
      if(!confirm("Reset this user's XP, solved count, streak and activity?")) return;
      try{await adminAction("/api/admin/users/reset",{id}); toast("User progress reset"); loadAdmin();}catch(err){toast(err.message);}
    }
    if(e.target.closest(".admin-delete")){
      if(!confirm("Permanently delete this account? This cannot be undone.")) return;
      try{await adminAction("/api/admin/users/delete",{id}); toast("Account deleted"); loadAdmin(); loadLeaderboard();}catch(err){toast(err.message);}
    }
  }

  function applyTheme(){document.body.classList.toggle("light",state.theme==="light");}
  function renderAll(){refreshProfile();renderProfilePage();renderMission();renderRoad();renderDays();renderConcepts();renderTools();renderLessons();renderExams();renderStats();renderAchievements();renderLeaderboard([]);loadLeaderboard();}

  markActivity(); applyTheme(); applyLang(); initEditor(); initFocus(); initGlobalSearch(); renderAll(); renderFilters(); restoreView(); refreshAccountUI(); initAuth();
  setTimeout(startOnboarding, 250);
})();

// Native-editor caret stability: keep the textarea as the only rendered code layer.
(function stabilizeCodeEditor(){
  const ed = document.getElementById('codeEditor');
  if(!ed) return;
  const resetScroll = () => {
    ed.scrollTop = 0;
    ed.scrollLeft = 0;
    const hl = document.getElementById('highlight');
    const ln = document.getElementById('lineNumbers');
    if(hl){ hl.scrollTop = 0; hl.scrollLeft = 0; }
    if(ln){ ln.scrollTop = 0; }
  };
  ed.addEventListener('focus', () => {
    // Do not allow browser scroll restoration to move the editor on focus.
    requestAnimationFrame(() => {
      if(ed.value && ed.selectionStart === 0 && ed.selectionEnd === 0) resetScroll();
    });
  });
  window.addEventListener('pageshow', () => {
    if(!ed.value || ed.selectionStart === 0) resetScroll();
  });
})();
