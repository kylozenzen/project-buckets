// BUCKETS — shell.js
// Menus and app shell: title/end/pause screens, settings, stats, auto-pause, PWA install,
// and Nobody Arcade events. Loads last; depends on globals from game-1…4.

var GAME_ID="buckets";            // must match the id in the arcade's games list
var VERSION="v0.4.1";
var ABOUT_URL="https://bencampbell.netlify.app"; // swap for the Nobody Creative site when ready

// ---------- Nobody Arcade bridge ----------
// The arcade only accepts these from the iframe it embedded, and checks the origin on its side.
window.notifyArcade=function(event,payload){
  if(window.parent===window)return;
  try{window.parent.postMessage({type:"NOBODY_ARCADE_EVENT",gameId:GAME_ID,event:event,payload:payload||{}},"*")}catch(e){}
};

// ---------- Settings ----------
var soundToggle=$("soundToggle"),hapticToggle=$("hapticToggle"),startSound=$("startSound");
function renderSettings(){
  var snd=!!store.settings.sound,hap=!!store.settings.haptics;
  soundToggle.setAttribute("aria-pressed",snd);hapticToggle.setAttribute("aria-pressed",hap);
  startSound.setAttribute("aria-pressed",snd);startSound.textContent=snd?"Sound on":"Sound off";
}
function setSound(on){
  store.settings.sound=on;saveStore();
  if(on){audioInit();setTimeout(function(){sfx.ui()},30)}
  else if(AC&&AC.state==="running"){AC.suspend()}
  renderSettings();
}
soundToggle.addEventListener("click",function(){setSound(!store.settings.sound)});
startSound.addEventListener("click",function(){setSound(!store.settings.sound)});
hapticToggle.addEventListener("click",function(){store.settings.haptics=!store.settings.haptics;saveStore();renderSettings();haptic(15)});

// ---------- Stats ----------
function renderStats(){
  var s=store.stats;
  $("startStats").innerHTML=s.runs?("Best <b>"+s.best+"</b> · <b>"+s.runs+"</b> run"+(s.runs===1?"":"s")):"First run — good luck";
  var cells=[["Runs",s.runs],["Best",s.best],["Buckets",s.buckets],["Pure",s.perfects],["Reads won",s.reads],["Best combo","x"+s.bestCombo]];
  $("statsGrid").innerHTML=cells.map(function(c){return '<div class="stat"><b>'+c[1]+'</b><span>'+c[0]+'</span></div>'}).join("");
  ui();
}

// ---------- Pause ----------
function openPause(){
  if(!running||menuOpen)return;
  menuOpen=true;clearCharge();renderStats();renderSettings();
  pauseOverlay.classList.remove("hidden");
  setTimeout(function(){$("resumeBtn").focus({preventScroll:true})},50);
}
function closePause(){
  if(!menuOpen)return;
  menuOpen=false;pauseOverlay.classList.add("hidden");last=performance.now();
}
function toTitle(){
  runToken++;running=false;paused=false;menuOpen=false;clearCharge();
  pauseOverlay.classList.add("hidden");endOverlay.classList.add("hidden");upgradeOverlay.classList.add("hidden");
  state=freshState();defender.x=W/2;defender.y=H*.555;player.x=player.tx=W/2;player.y=player.ty=H*.82;resetBall();
  renderStats();startOverlay.classList.remove("hidden");
}
$("pauseBtn").addEventListener("click",function(){if(menuOpen)closePause();else openPause()});
$("resumeBtn").addEventListener("click",closePause);
$("restartRunBtn").addEventListener("click",function(){audioInit();resetRun()});
$("quitBtn").addEventListener("click",toTitle);
// Auto-pause when the app goes to the background.
document.addEventListener("visibilitychange",function(){if(document.hidden&&running)openPause()});

// ---------- Title / end ----------
$("startBtn").addEventListener("click",function(){audioInit();resetRun()});
$("restartBtn").addEventListener("click",function(){audioInit();resetRun()});
$("endMenuBtn").addEventListener("click",toTitle);
window.startBuckets=resetRun;

$("aboutLink").href=ABOUT_URL;$("versionLabel").textContent="READ THE FLOOR "+VERSION;
renderSettings();renderStats();

// ---------- PWA ----------
if("serviceWorker" in navigator&&location.protocol==="https:"){
  window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js").catch(function(){})});
}
