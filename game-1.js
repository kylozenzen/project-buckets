// BUCKETS — game-1.js
// Globals, saved settings/stats, run/player/defender/ball state, audio, HUD, stance + read system.

var canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
function $(id){return document.getElementById(id)}
var hudEl=$("hud"),scoreEl=$("score"),bestLabel=$("bestLabel"),heatEl=$("heat"),heatTrack=$("heatTrack"),comboEl=$("combo"),pipsEl=$("pips");
var roundLabel=$("roundLabel"),startOverlay=$("startOverlay"),upgradeOverlay=$("upgradeOverlay"),endOverlay=$("endOverlay"),pauseOverlay=$("pauseOverlay");
var upgradeGrid=$("upgradeGrid"),shotMeter=$("shotMeter"),shotFill=$("shotFill"),flashEl=$("flash"),gestureHint=$("gestureHint");
var callout=$("callout"),calloutMain=$("calloutMain"),calloutSub=$("calloutSub");
var finalScore=$("finalScore"),madeStat=$("madeStat"),bestComboStat=$("bestComboStat"),perfectStat=$("perfectStat"),endText=$("endText"),endKicker=$("endKicker");

var W=390,H=844,DPR=1,last=0,time=0,running=false,paused=false,menuOpen=false,freeze=0,shake=0,netT=0,timeScale=1,slowT=0,runToken=0;
var particles=[],streaks=[],floaters=[];
var pointer={down:false,id:null,sx:0,sy:0,x:0,y:0,t0:0,moved:false,charge:0};
var keyCharge={down:false,t0:0};

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function easeOut(t){return 1-Math.pow(1-t,3)}
function rand(a,b){return a+Math.random()*(b-a)}
function d2(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy)}
function rr(c,x,y,w,h,r){if(h<0){y+=h;h=-h}if(w<0){x+=w;w=-w}r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function line(c,x1,y1,x2,y2,w,color){c.strokeStyle=color;c.lineWidth=w;c.lineCap="round";c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}

// ---------- Saved settings + lifetime stats (local only) ----------
var STORE_KEY="buckets.v1";
var store=(function(){
  var d={settings:{sound:false,haptics:true},stats:{runs:0,best:0,buckets:0,perfects:0,reads:0,bestCombo:1,dunks:0}};
  try{var raw=JSON.parse(localStorage.getItem(STORE_KEY)||"null");if(raw){for(var k in raw.settings)d.settings[k]=raw.settings[k];for(var j in raw.stats)d.stats[j]=raw.stats[j]}}catch(e){}
  return d;
})();
function saveStore(){try{localStorage.setItem(STORE_KEY,JSON.stringify(store))}catch(e){}}
function haptic(p){if(store.settings.haptics&&navigator.vibrate){try{navigator.vibrate(p)}catch(e){}}}

var state={pos:1,max:10,score:0,heat:0,combo:1,bestCombo:1,makes:0,misses:0,perfects:0,
shotWindow:1,stunBonus:0,bully:false,magnet:0,ghost:false,ghostReady:false,quickFirst:false,
clockMax:8.5,clock:8.5,space:18,advantage:0,advantageBonus:0,reads:0,readStreak:0,bestReadStreak:0,
lastMove:"",repeat:0,antiSpam:2,deadeye:0,styleBank:0,timeouts:0,results:[],dunks:0,moves:0};
var player={x:195,y:690,tx:195,ty:690,r:18,action:"idle",aT:0,stun:0,dribble:0,facing:1,lean:0,air:0};
var defender={x:195,y:470,tx:195,ty:470,r:21,type:"shadow",name:"THE SHADOW",stun:0,commit:0,facing:-1,trashT:0,
stance:"press",stanceLabel:"PRESS",stanceHint:"Crowding your handle",stanceColor:"#ff4d6d",stanceGlyph:"→←",stanceT:0,boss:false,readsNeeded:1,readsWon:0};
// post: "" while dribbling/in flight, "drop" when falling through the net, "bounce" after a miss
var ball={x:207,y:680,r:9,shot:false,t:0,dur:.78,sx:0,sy:0,tx:0,ty:0,arc:0,perfect:false,made:false,spin:0,kind:"jumper",post:"",pt:0,vx:0,vy:0,ground:0};

var defenderTypes=[
 {type:"reacher",name:"THE REACHER",accent:"#ff4d6d",num:"3"},
 {type:"wall",name:"THE WALL",accent:"#ffb22f",num:"45"},
 {type:"shadow",name:"THE SHADOW",accent:"#55dcff",num:"11"},
 {type:"gambler",name:"THE GAMBLER",accent:"#b98cff",num:"7"}
];
// Each stance has a label, a glyph and a body pose, so color is never the only cue.
var stanceDefs={
 press:{id:"press",label:"PRESS",glyph:"→←",hint:"Crowding your handle",coach:"Cross or tap hesi",color:"#ff4d6d",counter:["cross","hesi"]},
 sag:{id:"sag",label:"SAG",glyph:"←→",hint:"Giving you air",coach:"Hold to shoot it",color:"#55dcff",counter:["shot"]},
 reach:{id:"reach",label:"REACH",glyph:"✋",hint:"Hands are active",coach:"Swipe to cross him",color:"#ffb22f",counter:["cross"]},
 cut:{id:"cut",label:"CUT OFF",glyph:"⊘",hint:"Sitting on the drive",coach:"Swipe down to step back",color:"#b98cff",counter:["step"]}
};
var upgrades=[
 {icon:"◎",name:"HEAT CHECK",desc:"Widen the perfect-release window.",apply:function(){state.shotWindow=Math.min(1.75,state.shotWindow+.24)},maxed:function(){return state.shotWindow>=1.749}},
 {icon:"↯",name:"ANKLE INSURANCE",desc:"Crossovers stun defenders longer.",apply:function(){state.stunBonus+=.16}},
 {icon:"▰",name:"BULLY BALL",desc:"Drives knock defenders out of your lane.",apply:function(){state.bully=true},maxed:function(){return state.bully}},
 {icon:"⌁",name:"MAGNET RIM",desc:"Near misses get a second chance.",apply:function(){state.magnet=Math.min(.55,state.magnet+.18)},maxed:function(){return state.magnet>=.549}},
 {icon:"◇",name:"GHOST STEP",desc:"Ignore the first defensive bump each possession.",apply:function(){state.ghost=true},maxed:function(){return state.ghost}},
 {icon:"♨",name:"MICROWAVE",desc:"Start every new possession with extra heat.",apply:function(){state.quickFirst=true},maxed:function(){return state.quickFirst}},
 {icon:"⏱",name:"CLOCKWORK",desc:"Add 1.5 seconds to every possession.",apply:function(){state.clockMax=Math.min(12,state.clockMax+1.5)},maxed:function(){return state.clockMax>=11.99}},
 {icon:"➜",name:"FIRST STEP",desc:"Correct reads stay open longer.",apply:function(){state.advantageBonus+=.35}},
 {icon:"◉",name:"DEAD EYE",desc:"Reduce the penalty on contested jumpers.",apply:function(){state.deadeye=Math.min(.35,state.deadeye+.12)},maxed:function(){return state.deadeye>=.349}},
 {icon:"♜",name:"DEEP BAG",desc:"Defenders take longer to adapt to repeated moves.",apply:function(){state.antiSpam=Math.min(4,state.antiSpam+1)},maxed:function(){return state.antiSpam>=4}}
];

// ---------- Audio (off by default; toggled in the pause menu or title screen) ----------
var AC=null,masterGain=null;
function audioInit(){
  if(!store.settings.sound)return;
  try{
    if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();masterGain=AC.createGain();masterGain.gain.value=1;masterGain.connect(AC.destination)}
    if(AC.state==="suspended")AC.resume();
  }catch(e){}
}
function soundOn(){return store.settings.sound&&AC&&AC.state==="running"}
function tone(freq,dur,type,vol,slide,delay){
  if(!soundOn())return;
  var t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
  o.type=type||"sine";o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
  g.gain.setValueAtTime(vol||.04,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(masterGain);o.start(t);o.stop(t+dur+.02);
}
function noise(dur,vol,hp){
  if(!soundOn())return;
  var len=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
  for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  var s=AC.createBufferSource(),g=AC.createGain();s.buffer=buf;g.gain.value=vol||.025;
  if(hp){var f=AC.createBiquadFilter();f.type="highpass";f.frequency.value=hp;s.connect(f);f.connect(g)}else s.connect(g);
  g.connect(masterGain);s.start();
}
var sfx={
 ui:function(){tone(420,.07,"square",.022,650)},
 bounce:function(){tone(110,.07,"sine",.05,62)},
 squeak:function(){tone(1650,.035,"sawtooth",.01,1000)},
 cross:function(){noise(.055,.02,800);tone(240,.06,"triangle",.02,390)},
 read:function(){tone(520,.06,"triangle",.03,780);tone(780,.08,"triangle",.025,1170,.05)},
 pure:function(){tone(660,.09,"sine",.035,990);tone(990,.11,"sine",.03,1320,.055)},
 swish:function(){noise(.22,.06,2400);tone(880,.05,"sine",.01,1200)},
 rim:function(){tone(320,.14,"square",.03,190);tone(547,.1,"triangle",.02,410);tone(1210,.05,"sine",.012,900)},
 dunk:function(){tone(90,.2,"sine",.08,42);noise(.12,.06,300)},
 block:function(){tone(160,.12,"square",.035,80)},
 buzzer:function(){tone(196,.45,"sawtooth",.035,180)}
};

// ---------- Layout ----------
// L.camY shifts the whole court down if the HUD would otherwise overlap the shot clock / backboard
// (e.g. notched phones in standalone mode). L.topLimit is the highest screen y the ball may reach.
var L={hudBottom:80,camY:0,topLimit:90},bgDirty=true;
function layout(){
  var app=$("app").getBoundingClientRect(),hb=hudEl.getBoundingClientRect();
  L.hudBottom=hb.bottom-app.top;
  var clockTop=H*.165-W*.055-28; // shot clock sits on top of the backboard
  L.camY=Math.max(0,L.hudBottom+6-clockTop);
  L.topLimit=L.hudBottom+14-L.camY;
}
function resize(){
  var r=canvas.getBoundingClientRect();DPR=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(r.width*DPR);canvas.height=Math.round(r.height*DPR);
  W=r.width;H=r.height;ctx.setTransform(DPR,0,0,DPR,0,0);
  if(!running){player.x=player.tx=W/2;player.y=player.ty=H*.82;defender.x=W/2;defender.y=H*.555}
  layout();bgDirty=true;
}
window.addEventListener("resize",resize);resize();

// ---------- HUD ----------
// ui() runs every frame; only touch the DOM when a value actually changes.
function setTxt(el,v){if(el&&el._t!==v){el._t=v;el.textContent=v}}
function setCls(el,v){if(el&&el._c!==v){el._c=v;el.className=v}}
function setW(el,v){if(el&&el._w!==v){el._w=v;el.style.width=v}}
var pipEls=[],shownScore=0;
function buildPips(container){
  var out=[];container.innerHTML="";
  for(var i=0;i<10;i++){var p=document.createElement("i");p.className="pip";container.appendChild(p);out.push(p)}
  return out;
}
pipEls=buildPips(pipsEl);
function pipClass(i){
  var r=state.results[i],c="pip";
  if(r)c+=" "+r;else if(running&&i===state.pos-1)c+=" now";
  if(i===4||i===9)c+=" boss";
  return c;
}
function ui(){
  shownScore=shownScore<state.score?Math.min(state.score,shownScore+Math.max(4,Math.ceil((state.score-shownScore)*.18))):state.score;
  setTxt(scoreEl,String(shownScore));
  setTxt(bestLabel,"Best "+store.stats.best);
  setW(heatEl,Math.round(state.heat)+"%");
  setCls(heatTrack,"heatTrack"+(state.heat>=100?" fire":""));
  setTxt(comboEl,"x"+state.combo);
  setCls(comboEl,"comboPill"+(state.combo>=3||state.heat>=75?" hot":""));
  setTxt(roundLabel,state.pos+"/"+state.max+" · "+defender.name+(defender.boss?" · RIVAL":""));
  for(var i=0;i<10;i++)setCls(pipEls[i],pipClass(i));
}
// Perfect-release window, shared by shoot() and the on-screen meter so they always agree.
var SHOT_SWEET=.72;
function perfectWindow(){return .055*state.shotWindow+(state.heat>=100?.018:0)}
var shotSweetEl=$("shotSweet");
function syncShotMeter(){
  var w=perfectWindow();
  shotSweetEl.style.left=((SHOT_SWEET-w)*100)+"%";shotSweetEl.style.width=(w*200)+"%";
}
// Put the meter just above the finger (or bottom-center for keyboard).
function placeShotMeter(x,y){
  var app=$("app").getBoundingClientRect();
  if(x==null){shotMeter.classList.remove("atFinger");shotMeter.style.left="";shotMeter.style.top="";return}
  var lx=clamp(x-app.left,95,W-95),ly=clamp(y-app.top-86,L.hudBottom+10,H-40);
  shotMeter.classList.add("atFinger");shotMeter.style.left=lx+"px";shotMeter.style.top=ly+"px";
}
function clearCharge(){
  pointer.down=false;pointer.charge=0;keyCharge.down=false;
  shotMeter.classList.remove("active");shotFill.style.width="0%";
}
function showCallout(main,sub){
  calloutMain.textContent=main;calloutSub.textContent=sub||"";
  callout.classList.remove("show");void callout.offsetWidth;callout.classList.add("show");
}

// ---------- Stance + read system ----------
function setStance(id){
  var s=stanceDefs[id]||stanceDefs.press;
  if(defender.stance!==s.id)defender.stanceT=0;
  defender.stance=s.id;defender.stanceLabel=s.label;defender.stanceHint=s.hint;defender.stanceCoach=s.coach;defender.stanceColor=s.color;defender.stanceGlyph=s.glyph;ui();
}
function pickStance(exclude){
  var pool;
  if(defender.type==="reacher")pool=["reach","press","sag"];
  else if(defender.type==="wall")pool=["cut","sag","press"];
  else if(defender.type==="gambler")pool=["reach","press","cut","sag"];
  else pool=["press","sag","cut","reach"];
  if(exclude&&pool.length>1)pool=pool.filter(function(x){return x!==exclude});
  setStance(pool[Math.floor(Math.random()*pool.length)]);
}
function adaptTo(move){
  var map={cross:"sag",hesi:"sag",step:"reach",drive:"cut",shot:"press"};setStance(map[move]||"press");
}
function registerMove(move){
  state.moves++;
  if(state.lastMove===move)state.repeat++;else{state.lastMove=move;state.repeat=1}
  if(state.repeat>state.antiSpam){state.repeat=1;state.readStreak=0;state.space=clamp(state.space-18,0,100);state.advantage=0;adaptTo(move);showCallout("HE'S ON IT","mix up your bag");sfx.block();haptic(30);ui();return true}
  return false;
}
function tryRead(move){
  if(state.advantage>0)return "open";
  if(registerMove(move))return "adapted";
  var s=stanceDefs[defender.stance],correct=s.counter.indexOf(move)>=0;
  if(correct){
    defender.readsWon++;state.reads++;state.readStreak++;state.bestReadStreak=Math.max(state.bestReadStreak,state.readStreak);state.styleBank+=75;state.heat=clamp(state.heat+8,0,100);
    if(defender.boss&&defender.readsWon<defender.readsNeeded){defender.stun=.18;state.space=clamp(state.space+20,0,100);showCallout("RIVAL ADAPTS",defender.readsWon+"/"+defender.readsNeeded+" reads");sfx.read();haptic(12);pickStance(defender.stance);return "partial"}
    state.advantage=1.25+state.advantageBonus+(state.heat>=100?.25:0);state.space=100;defender.stun=.5+state.stunBonus;showCallout("READ 'EM","+75 style banked");burst(defender.x,defender.y+8,12,"#e9ff3f");sfx.read();haptic(15);ui();return "win";
  }
  state.readStreak=0;state.space=clamp(state.space-14,0,100);defender.commit=.24;state.heat=clamp(state.heat-2,0,100);floater("NOT THERE",player.x,player.y-56,"#ff657a");ui();return "lose";
}
function shotClockViolation(){
  if(paused||ball.shot)return;paused=true;state.timeouts++;state.misses++;state.results[state.pos-1]="miss";state.combo=1;state.readStreak=0;state.styleBank=0;state.heat=clamp(state.heat-10,0,100);sfx.buzzer();haptic([60,40,60]);showCallout("SHOT CLOCK","possession lost");ui();nextPossession(false);
}
function floater(txt,x,y,color,big){floaters.push({txt:txt,x:x,y:y,t:0,life:big?1:.8,color:color||"#fff",big:!!big})}
function burst(x,y,n,color,power){
  power=power||1;
  for(var i=0;i<(n||16);i++)particles.push({x:x,y:y,vx:rand(-180,180)*power,vy:rand(-230,-40)*power,t:0,life:rand(.4,.85),r:rand(1.5,4),color:color||"#e9ff3f"});
}
function trail(x,y,color){streaks.push({x:x,y:y,vx:rand(-25,25),vy:rand(30,90),t:0,life:.25,r:rand(2,5),color:color})}
function slowMo(scale,dur){timeScale=scale;slowT=dur}
