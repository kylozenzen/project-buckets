// BUCKETS — game-2.js
// Run flow: possessions, upgrades, moves (hesi, cross, stepback, drive), shot resolution.

function freshState(){
  return {pos:1,max:10,score:0,heat:0,combo:1,bestCombo:1,makes:0,misses:0,perfects:0,shotWindow:1,stunBonus:0,bully:false,magnet:0,ghost:false,ghostReady:false,quickFirst:false,clockMax:8.5,clock:8.5,space:18,advantage:0,advantageBonus:0,reads:0,readStreak:0,bestReadStreak:0,lastMove:"",repeat:0,antiSpam:2,deadeye:0,styleBank:0,timeouts:0,results:[],dunks:0,moves:0};
}
function resetBall(){ball.x=player.x+12;ball.y=player.y-2;ball.shot=false;ball.t=0;ball.spin=0;ball.kind="jumper";ball.post="";ball.pt=0}
function resetRun(){
  runToken++;
  state=freshState();shownScore=0;
  running=true;paused=false;menuOpen=false;time=0;freeze=0;shake=0;netT=0;timeScale=1;slowT=0;particles.length=0;streaks.length=0;floaters.length=0;
  startOverlay.classList.add("hidden");upgradeOverlay.classList.add("hidden");endOverlay.classList.add("hidden");pauseOverlay.classList.add("hidden");
  gestureHint.classList.remove("gone");
  spawnPossession();ui();sfx.ui();
  if(window.notifyArcade)notifyArcade("game_started",{});
}
function spawnPossession(){
  clearCharge();paused=false;state.ghostReady=state.ghost;state.clock=state.clockMax;state.space=18;state.advantage=0;state.styleBank=0;
  if(state.quickFirst)state.heat=clamp(state.heat+10,0,100);
  player.x=player.tx=W/2;player.y=player.ty=H*.82;player.action="idle";player.aT=0;player.stun=0;player.air=0;
  var d=defenderTypes[(state.pos-1)%defenderTypes.length];
  defender.type=d.type;defender.name=d.name;defender.accent=d.accent;defender.num=d.num;defender.boss=(state.pos===5||state.pos===10);if(defender.boss){defender.name="THE RIVAL";defender.accent="#e9ff3f";defender.num="1"}
  defender.readsNeeded=defender.boss?2:1;defender.readsWon=0;if(defender.boss)state.clock=state.clockMax+1.5;defender.x=W/2+rand(-28,28);defender.y=H*.555;defender.tx=defender.x;defender.ty=defender.y;defender.stun=0;defender.commit=0;defender.trashT=rand(1.5,3.5);
  pickStance();resetBall();ui();
  var tok=runToken;
  if(defender.boss)setTimeout(function(){if(tok===runToken&&running&&!paused)showCallout("RIVAL ROUND","win two reads")},120);
}
function upgradeMoment(){
  paused=true;upgradeGrid.innerHTML="";
  var pool=upgrades.filter(function(u){return !(u.maxed&&u.maxed())});
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),tmp=pool[i];pool[i]=pool[j];pool[j]=tmp}
  pool=pool.slice(0,3);
  var buttons=[];
  pool.forEach(function(u){
    var b=document.createElement("button");b.type="button";b.className="upgrade";b.disabled=true;
    b.innerHTML="<strong><i>"+u.icon+"</i>"+u.name+"</strong><small>"+u.desc+"</small>";
    b.addEventListener("click",function(){audioInit();sfx.ui();u.apply();upgradeOverlay.classList.add("hidden");spawnPossession()});
    upgradeGrid.appendChild(b);buttons.push(b);
  });
  upgradeOverlay.classList.remove("hidden");
  // Short lockout so a thumb still on the glass from the last shot can't pick by accident.
  setTimeout(function(){buttons.forEach(function(b){b.disabled=false})},380);
}
function nextPossession(made){
  paused=true;var tok=runToken;
  setTimeout(function(){
    if(tok!==runToken)return;
    state.pos++;
    if(state.pos>state.max){endRun();return}
    if(made && (state.makes===2||state.makes===5||state.makes===8)){upgradeMoment()}
    else spawnPossession();
  },920);
}
function endRun(){
  running=false;paused=true;state.pos=state.max;
  var st=store.stats,hadBest=st.best>0,newBest=state.score>st.best&&state.score>0;
  st.runs++;st.buckets+=state.makes;st.perfects+=state.perfects;st.reads+=state.reads;st.dunks+=state.dunks;st.bestCombo=Math.max(st.bestCombo,state.bestCombo);
  if(newBest)st.best=state.score;
  saveStore();
  finalScore.textContent=state.score;madeStat.textContent=state.makes;bestComboStat.textContent="x"+state.bestCombo;perfectStat.textContent=state.reads;
  $("newBest").classList.toggle("hidden",!(newBest&&hadBest));
  $("endBest").innerHTML="Best <b>"+st.best+"</b> · run "+st.runs;
  var ep=buildPips($("endPips"));for(var i=0;i<10;i++)ep[i].className="pip"+(state.results[i]?" "+state.results[i]:"");
  if(state.makes>=8){endKicker.textContent="Court owned";endText.textContent="Somebody is already lying about guarding you."}
  else if(state.makes>=5){endKicker.textContent="Respect earned";endText.textContent="Good run. The fence crowd definitely noticed."}
  else{endKicker.textContent="Run complete";endText.textContent="A few buckets short. Run it back."}
  if(newBest&&hadBest){endText.textContent="New personal best. "+endText.textContent;haptic([30,50,30,50,60])}
  ui();
  endOverlay.classList.remove("hidden");
  if(window.notifyArcade){notifyArcade("score_submitted",{score:state.score,makes:state.makes});notifyArcade("game_completed",{score:state.score,makes:state.makes,reads:state.reads,bestCombo:state.bestCombo,newBest:newBest})}
}

function canAct(){return running&&!paused&&!menuOpen&&!ball.shot&&player.stun<=0}
function hesitate(){
  if(!canAct())return;
  player.action="hesi";player.aT=.22;sfx.squeak();floater("HESI",player.x,player.y-52,"#55dcff");
  var read=tryRead("hesi");if(read==="win")defender.tx+=rand(-20,20);else if(read==="lose")state.heat=clamp(state.heat-1,0,100);ui();
}
function crossover(dir){
  if(!canAct())return;
  player.action="cross";player.aT=.3;player.facing=dir;player.tx=clamp(player.tx+dir*W*.23,46,W-46);sfx.cross();sfx.squeak();
  var read=tryRead("cross");
  if(read==="win"||read==="open"){defender.tx=clamp(defender.x-dir*42,38,W-38);state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo)}
  else if(read==="partial"){defender.tx=clamp(defender.x-dir*20,38,W-38)}
  else if(read==="lose"&&defender.type==="shadow"){player.stun=.12;floater("STAYED HOME",defender.x,defender.y-60,"#ff657a")}
  ui();
}
function stepback(){
  if(!canAct())return;
  player.action="step";player.aT=.36;player.ty=clamp(player.ty+H*.085,H*.41,H*.84);defender.commit=.3;defender.ty-=10;sfx.squeak();
  var read=tryRead("step");if(read==="win"||read==="open"){floater("SPACE",player.x,player.y-58,"#e9ff3f");state.space=100}else if(read==="lose")defender.ty+=16;ui();
}
function drive(){
  if(!canAct())return;
  if(player.y<H*.39){if(state.advantage>0||defender.stun>0||state.heat>=95)dunk();else layup();return}
  player.action="drive";player.aT=.42;sfx.squeak();
  var read=state.advantage>0?"open":tryRead("drive");
  if(read==="lose"&&(defender.stance==="cut"||defender.type==="wall")){
    if(state.ghostReady){state.ghostReady=false;floater("GHOST",player.x,player.y-60,"#55dcff")}
    else if(state.bully){defender.stun=.28;defender.ty-=26;defender.tx+=player.x<defender.x?34:-34;shake=5;floater("BULLY",player.x,player.y-60,"#ffb22f")}
    else{player.stun=.3;player.ty+=24;state.combo=1;state.space=0;state.heat=clamp(state.heat-7,0,100);sfx.block();haptic(35);showCallout("CUT OFF","try creating space");ui();return}
  }
  var burstAmt=(state.advantage>0?H*.22:H*.14);player.ty=clamp(player.ty-burstAmt,H*.28,H*.82);state.space=clamp(state.space+(state.advantage>0?8:-4),0,100);ui();
}

// Keep the ball's peak below the HUD: for a straight-line path plus sin(πt)*arc,
// find the largest arc whose highest point stays under L.topLimit.
function capArc(sx,sy,tx,ty,arc){
  var top=L.topLimit+ball.r,max=arc;
  for(var i=1;i<20;i++){var t=i/20,y=lerp(sy,ty,t),s=Math.sin(Math.PI*t);max=Math.min(max,(y-top)/s)}
  return Math.max(H*.05,max);
}
function launch(kind,dur,arc,made,perfect){
  ball.shot=true;ball.kind=kind;ball.t=0;ball.dur=dur;ball.sx=ball.x;ball.sy=ball.y;ball.tx=W/2;ball.ty=H*.205;
  ball.arc=capArc(ball.sx,ball.sy,ball.tx,ball.ty,arc);ball.made=made;ball.perfect=perfect;ball.post="";
}
function layup(){
  if(!canAct())return;
  registerMove("drive");player.action="layup";player.aT=.5;var contest=clamp(1-d2(player,defender)/115,0,1);var chance=.48+state.space*.002-contest*.28+state.heat*.0012;
  launch("layup",.5,H*.15,Math.random()<clamp(chance,.12,.88),false);player.tx=W/2;player.ty=H*.29;
}
function dunk(){
  if(!canAct())return;
  registerMove("drive");player.action="dunk";player.aT=.58;launch("dunk",.5,H*.17,true,false);
  player.tx=W/2;player.ty=H*.255;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);
}
function shoot(charge){
  if(!canAct())return;
  charge=clamp(charge,0,1);player.action="shot";player.aT=.5;
  var read=state.advantage>0?"open":tryRead("shot");
  var sweet=SHOT_SWEET,perfect=Math.abs(charge-sweet)<=perfectWindow();
  var hoop={x:W/2,y:H*.205};var contest=clamp(1-d2(player,defender)/150,0,.86);contest*=Math.max(.28,1-state.deadeye);if(state.advantage>0)contest*=.18;if(defender.stun>0)contest*=.2;if(defender.type==="wall")contest*=1.08;
  var timing=Math.max(0,1-Math.abs(charge-sweet)/.42);var spaceBonus=state.space*.0022;
  var chance=.12+timing*.55+spaceBonus-contest*.34+state.heat*.0012;
  if(read==="lose")chance-=.08;if(perfect)chance=Math.max(chance,state.advantage>0?.95:.74);
  var made=Math.random()<clamp(chance,.04,.97);
  if(!made&&Math.abs(charge-sweet)<.18&&Math.random()<state.magnet){made=true;floater("MAGNET",hoop.x,hoop.y+40,"#55dcff")}
  launch("jumper",.78,H*(.34+.08*charge),made,perfect);
  // Confirm the release instantly, but save the big PURE callout for when it actually drops.
  if(perfect){sfx.pure();haptic(10);floater("PERFECT RELEASE",player.x,player.y-62,"#e9ff3f")}else tone(330,.05,"triangle",.02,420);
}
// Called when the ball reaches the rim. Scores immediately; the drop/bounce plays out during the
// gap before the next possession.
function resolveShot(){
  var rimY=H*.205;
  state.results[state.pos-1]=ball.made?"make":"miss";
  if(ball.made){
    var base=ball.perfect?300:200,bonus=Math.max(0,state.combo-1)*50+state.styleBank;
    if(ball.kind==="dunk"){base=400;bonus=Math.max(0,state.combo-1)*70+state.styleBank;state.dunks++;state.heat=clamp(state.heat+18,0,100);sfx.dunk();shake=13;freeze=.08;flash(.35);haptic([40,30,60]);showCallout("POSTER","+"+(base+bonus))}
    else if(ball.kind==="layup"){base=250;sfx.swish();haptic(20);state.heat=clamp(state.heat+8,0,100);showCallout("TOUGH FINISH","+"+(base+bonus))}
    else{sfx.swish();state.heat=clamp(state.heat+(ball.perfect?17:10),0,100);
      if(ball.perfect){state.perfects++;showCallout("PURE","+"+(base+bonus));slowMo(.32,.38);flash(.28);haptic([20,40,30])}
      else{haptic(20);showCallout(state.styleBank?"CASH THE READ":"BUCKET","+"+(base+bonus))}}
    state.score+=base+bonus;state.makes++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);netT=.45;
    burst(W/2,rimY+18,ball.perfect?26:14,ball.perfect?"#e9ff3f":"#ffffff",ball.perfect?1.2:1);
    floater("+"+(base+bonus),W/2+46,rimY+30,"#e9ff3f",true);state.styleBank=0;if(state.heat>=100)floater("ON FIRE",player.x,player.y-68,"#ffb22f");
    ball.post="drop";ball.pt=0;ball.x=W/2;ball.y=rimY;
    ui();nextPossession(true);
  }else{
    sfx.rim();haptic(40);shake=5;state.misses++;state.combo=1;state.readStreak=0;state.styleBank=0;state.heat=clamp(state.heat-12,0,100);
    if(ball.perfect)showCallout("IN AND OUT","perfect release · unlucky");else showCallout("BRICK",state.space<45?"create more space":"keep shooting");
    burst(W/2,rimY,9,"#ff7a18");netT=.18;
    var side=Math.random()<.5?-1:1;ball.post="bounce";ball.pt=0;ball.x=W/2+side*W*.06;ball.y=rimY;ball.vx=side*rand(90,170);ball.vy=-rand(150,240);ball.ground=H*.27;
    ui();nextPossession(false);
  }
}
function flash(a){flashEl.style.transition="none";flashEl.style.opacity=String(a);void flashEl.offsetWidth;flashEl.style.transition="";setTimeout(function(){flashEl.style.opacity="0"},60)}
