// BUCKETS — game-3.js
// update(), all canvas rendering, and the main loop().
// World coordinates are fractions of W/H (unchanged from v0.3 so tuning still holds).
// The world is drawn shifted down by L.camY so the HUD never covers the hoop.

var FONT="Inter,system-ui,-apple-system,sans-serif";
var RIM_Y_F=.205,BACK_Y_F=.165,COURT_TOP_F=.17;
function rimY(){return H*RIM_Y_F}
// Depth scale: things further up the court (toward the hoop) draw smaller.
function depth(y){return clamp(lerp(.72,1,(y-H*.25)/(H*.82-H*.25)),.64,1.06)}
// Ball position relative to the player while dribbling (low point touches the floor line).
function dribbleOffset(bounce){return lerp(-2,34,bounce)}

// ======================= UPDATE =======================
function update(rawDt){
  if(menuOpen)return;
  if(slowT>0){slowT-=rawDt;if(slowT<=0){slowT=0;timeScale=1}}
  var dt=rawDt*timeScale;
  time+=dt;
  updateFX(dt);
  ui();
  if(!running||paused)return;
  if(freeze>0){freeze-=dt;return}
  if(!ball.shot){state.clock-=dt;if(state.clock<=0){state.clock=0;ui();shotClockViolation();return}}
  if(state.advantage>0){state.advantage=Math.max(0,state.advantage-dt);if(state.advantage===0)pickStance(defender.stance)}
  state.space=clamp(state.space-dt*(state.advantage>0?5:11),0,100);
  if(player.stun>0)player.stun-=dt;if(player.aT>0)player.aT-=dt;
  // Moves end when their timer runs out (shot poses hold until the ball lands).
  if(player.aT<=0&&player.action!=="idle"&&!ball.shot)player.action="idle";
  if(defender.stun>0)defender.stun-=dt;if(defender.commit>0)defender.commit-=dt;
  var prevDribble=player.dribble;
  player.dribble+=dt*(player.action==="drive"?12:8);
  var ox=player.x;player.x=lerp(player.x,player.tx,1-Math.pow(.0006,dt));player.y=lerp(player.y,player.ty,1-Math.pow(.0012,dt));
  player.lean=clamp((player.x-ox)*.18,-.28,.28);
  // One bounce sound per dribble, timed to when the ball hits the floor (fixes doubles on 120Hz screens).
  if(!ball.shot&&Math.floor(player.dribble-.5)!==Math.floor(prevDribble-.5))sfx.bounce();

  if(!ball.shot){
    var s=depth(player.y);
    var handSide=player.action==="cross"?(player.facing||1):(Math.sin(player.dribble*.8)>0?1:-1);
    var bounce=Math.abs(Math.sin(player.dribble*Math.PI));
    ball.x=player.x+handSide*(14+4*(1-bounce))*s;ball.y=player.y+dribbleOffset(bounce)*s;ball.spin+=dt*9;
  }else{
    ball.t+=dt;var t=clamp(ball.t/ball.dur,0,1);
    ball.x=lerp(ball.sx,ball.tx,t);ball.y=lerp(ball.sy,ball.ty,t)-Math.sin(Math.PI*t)*ball.arc;ball.spin+=dt*16;
    if(player.action==="dunk"){player.air=Math.sin(Math.PI*t)*18}
    if(Math.random()<.8)trail(ball.x,ball.y,ball.perfect?"#e9ff3f":"rgba(255,122,24,.8)");
    if(t>=1){ball.shot=false;player.air=0;resolveShot()}
  }

  if(defender.stun<=0&&!ball.shot){
    defender.trashT-=dt;
    var targetX=player.x;
    if(defender.type==="reacher")targetX+=Math.sin(time*5)*12;
    if(defender.type==="wall")targetX=lerp(defender.x,player.x,.35);
    if(defender.type==="gambler")targetX+=Math.sin(time*3.7)*24;
    defender.tx=clamp(targetX,35,W-35);
    var gap=defender.stance==="press"||defender.stance==="reach"?H*.125:defender.stance==="sag"?H*.205:H*.16;
    defender.ty=clamp(player.y-gap,H*.32,H*.64);
    if(defender.commit>0)defender.tx+=player.facing*26;
    defender.x=lerp(defender.x,defender.tx,1-Math.pow(defender.type==="shadow"?.003:.012,dt));
    defender.y=lerp(defender.y,defender.ty,1-Math.pow(.02,dt));
    if(d2(player,defender)<43&&player.action!=="drive"){
      if(state.ghostReady)state.ghostReady=false;
      else{player.stun=.18;player.ty+=10;state.heat=clamp(state.heat-3,0,100)}
    }
  }

  var chargeStart=(pointer.down&&!pointer.moved)?pointer.t0:(keyCharge.down?keyCharge.t0:0);
  if(chargeStart){
    var held=(performance.now()-chargeStart)/1000;
    if(held>HOLD_DELAY){
      pointer.charge=chargeFromHeld(held);
      if(!shotMeter.classList.contains("active")){syncShotMeter();shotMeter.classList.add("active")}
      shotFill.style.width=(pointer.charge*100)+"%";
    }
  }
}

// Effects keep animating between possessions (they used to freeze when input locked).
function updateFX(dt){
  if(shake>0)shake=Math.max(0,shake-dt*30);
  if(netT>0)netT=Math.max(0,netT-dt);
  defender.stanceT+=dt;
  if(ball.post){
    ball.pt+=dt;var g=H*1.15;
    if(ball.post==="drop"&&ball.pt<.02){ball.vx=0;ball.vy=H*.12;ball.ground=H*.262}
    ball.vy+=g*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.spin+=dt*(ball.post==="drop"?4:12);
    if(ball.y>ball.ground){ball.y=ball.ground;if(Math.abs(ball.vy)>H*.12)sfx.bounce();ball.vy*=-.48;ball.vx*=.78}
  }
  for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;if(p.t>p.life)particles.splice(i,1)}
  for(var j=streaks.length-1;j>=0;j--){var q=streaks[j];q.t+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.t>q.life)streaks.splice(j,1)}
  for(var k=floaters.length-1;k>=0;k--){var f=floaters[k];f.t+=dt;f.y-=24*dt;if(f.t>f.life)floaters.splice(k,1)}
  // On fire: embers rise off the player.
  if(running&&state.heat>=100&&Math.random()<dt*28){var s=depth(player.y);streaks.push({x:player.x+rand(-14,14)*s,y:player.y+rand(-10,30)*s,vx:rand(-12,12),vy:-rand(50,110),t:0,life:.55,r:rand(1.5,3.2),color:Math.random()<.5?"#e9ff3f":"#ffb22f"})}
  // Retire the gesture hint once the player has the idea.
  if(running&&!gestureHint.classList.contains("gone")&&(coachActive()||state.moves>=4||state.pos>=3))gestureHint.classList.add("gone");
}

// ======================= STATIC BACKGROUND (cached) =======================
var bg=document.createElement("canvas"),bgx=bg.getContext("2d");
var vig=document.createElement("canvas"),vgx=vig.getContext("2d");
function seeded(seed){return function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646}}
function courtHalf(y){var top=H*COURT_TOP_F;return lerp(W*.3,W*.56,clamp((y-top)/(H-top),0,1.2))}
function cx(u,y){return W/2+u*courtHalf(y)}

function buildBg(){
  bgDirty=false;
  var hh=H+L.camY;
  bg.width=Math.round(W*DPR);bg.height=Math.round(hh*DPR);
  var c=bgx;c.setTransform(DPR,0,0,DPR,0,0);c.translate(0,L.camY);
  var R=seeded(7);
  // Sky
  var g=c.createLinearGradient(0,-L.camY,0,H*.5);g.addColorStop(0,"#05060c");g.addColorStop(.7,"#10122a");g.addColorStop(1,"#1d1838");c.fillStyle=g;c.fillRect(0,-L.camY,W,H*.6+L.camY);
  for(var i=0;i<40;i++){c.fillStyle="rgba(255,255,255,"+(.15+R()*.45)+")";var sz=R()<.15?1.6:1;c.fillRect(R()*W,-L.camY+R()*(H*.3+L.camY),sz,sz)}
  // Moon
  var mx=W*.8,my=H*.12;var mg=c.createRadialGradient(mx,my,0,mx,my,60);mg.addColorStop(0,"rgba(233,255,63,.12)");mg.addColorStop(1,"rgba(233,255,63,0)");c.fillStyle=mg;c.fillRect(mx-60,my-60,120,120);
  c.fillStyle="#e8ecd2";c.beginPath();c.arc(mx,my,11,0,Math.PI*2);c.fill();c.fillStyle="#10122a";c.beginPath();c.arc(mx+5,my-3,10,0,Math.PI*2);c.fill();
  // Far skyline (haze) + near skyline with lit windows
  drawSkyline(c,R,H*.36,"#141529",.5,40,90);
  drawSkyline(c,R,H*.42,"#0a0b13",1,70,150);
  // Neon rooftop sign
  var sx=W*.035,sy=H*.245;c.save();c.font="900 11px "+FONT;c.textAlign="left";c.shadowColor="#e9ff3f";c.shadowBlur=14;c.fillStyle="#e9ff3f";c.fillText("NOBODY",sx,sy);c.shadowBlur=0;c.restore();
  c.strokeStyle="rgba(255,255,255,.18)";c.lineWidth=1;c.beginPath();c.moveTo(sx+5,sy+3);c.lineTo(sx+5,sy+14);c.moveTo(sx+40,sy+3);c.lineTo(sx+40,sy+14);c.stroke();
  // Fence with crowd silhouettes behind it
  drawCrowd(c,R);
  drawFence(c);
  // Court
  drawCourt(c,R);
  // Hoop stanchion (behind everything else on the court)
  var bx=W/2,bt=H*BACK_Y_F;
  c.fillStyle="#0c0d12";rr(c,bx-5,bt+W*.05,10,H*COURT_TOP_F+18-(bt+W*.05),3);c.fill();
  c.fillStyle="rgba(0,0,0,.45)";c.beginPath();c.ellipse(bx,H*COURT_TOP_F+18,26,5,0,0,Math.PI*2);c.fill();
  // Light poles + pools
  drawLight(c,26,H*.47,H*.19,1);drawLight(c,W-26,H*.47,H*.19,-1);

  // Vignette (screen space, drawn last each frame)
  vig.width=Math.round(W*DPR);vig.height=Math.round(H*DPR);var v=vgx;v.setTransform(DPR,0,0,DPR,0,0);
  var vg=v.createRadialGradient(W/2,H*.55,Math.min(W,H)*.35,W/2,H*.55,Math.max(W,H)*.78);vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.62)");v.fillStyle=vg;v.fillRect(0,0,W,H);
}
function drawSkyline(c,R,base,color,winAlpha,minH,maxH){
  var x=-10;
  while(x<W+10){
    var bw=34+R()*52,bh=minH+R()*(maxH-minH);
    c.fillStyle=color;c.fillRect(x,base-bh,bw,bh+H*.2);
    if(R()<.25){c.fillRect(x+bw*.3,base-bh-10,bw*.25,10)} // rooftop box
    if(R()<.12){c.fillRect(x+bw*.6,base-bh-24,2,24)}       // antenna
    if(winAlpha>.6){
      for(var wy=base-bh+10;wy<base-6;wy+=13)for(var wx=x+6;wx<x+bw-8;wx+=10){
        var r=R();if(r<.22){c.fillStyle=r<.05?"rgba(233,255,63,.55)":"rgba(255,214,140,"+(.18+R()*.25)+")";c.fillRect(wx,wy,4,5)}
      }
    }else{
      for(var wy2=base-bh+10;wy2<base-6;wy2+=16)for(var wx2=x+6;wx2<x+bw-8;wx2+=12){if(R()<.12){c.fillStyle="rgba(180,190,255,.12)";c.fillRect(wx2,wy2,3,4)}}
    }
    x+=bw+2;
  }
}
function drawCrowd(c,R){
  var base=H*.58,top=H*.47;
  for(var row=0;row<2;row++){
    var y0=base-row*14;
    for(var x=-6;x<W+6;x+=11+R()*6){
      if(x>W*.2&&x<W*.8&&row===0&&R()<.3)continue;
      var hgt=26+R()*10,shade=12+Math.floor(R()*14);
      c.fillStyle="rgb("+shade+","+shade+","+(shade+8)+")";
      c.beginPath();c.arc(x,y0-hgt,5.5,0,Math.PI*2);c.fill();
      rr(c,x-8,y0-hgt+5,16,hgt,6);c.fill();
      if(R()<.06){c.fillStyle="rgba(233,255,63,.6)";c.fillRect(x-1,y0-hgt-14,2,9)} // phone light
    }
  }
}
function drawFence(c){
  var top=H*.32,bot=H*.58;c.save();c.globalAlpha=.2;c.strokeStyle="#c8cdd8";c.lineWidth=.8;
  c.beginPath();
  for(var x=-H;x<W+H;x+=14){c.moveTo(x,bot);c.lineTo(x+(bot-top),top)}
  for(x=0;x<W+H;x+=14){c.moveTo(x,top);c.lineTo(x-(bot-top),bot)}
  c.stroke();
  c.globalAlpha=.55;line(c,0,top,W,top,2.5,"#5d626e");line(c,0,bot,W,bot,2,"#5d626e");
  for(x=8;x<W;x+=W/6){line(c,x,top-4,x,bot,3,"#4a4e59")}
  c.restore();
}
function drawCourt(c,R){
  var top=H*COURT_TOP_F,bot=H+40;
  // Asphalt slab
  c.beginPath();c.moveTo(cx(-1,top),top);c.lineTo(cx(1,top),top);c.lineTo(cx(1,bot),bot);c.lineTo(cx(-1,bot),bot);c.closePath();
  var ag=c.createLinearGradient(0,top,0,H);ag.addColorStop(0,"#121318");ag.addColorStop(1,"#1a1b20");c.fillStyle=ag;c.fill();
  c.save();c.clip();
  // Grain + patches + cracks
  for(var i=0;i<1400;i++){var gy=top+R()*(H-top),gx=R()*W;c.fillStyle=R()<.5?"rgba(255,255,255,.035)":"rgba(0,0,0,.18)";c.fillRect(gx,gy,1+R()*1.5,1)}
  for(i=0;i<5;i++){var py=top+H*.1+R()*H*.6,pxx=R()*W;c.fillStyle="rgba(0,0,0,.14)";c.beginPath();c.ellipse(pxx,py,20+R()*40,6+R()*12,R(),0,Math.PI*2);c.fill()}
  c.strokeStyle="rgba(0,0,0,.45)";c.lineWidth=1;
  for(i=0;i<4;i++){var x0=R()*W,y0=top+R()*H*.7;c.beginPath();c.moveTo(x0,y0);for(var k=0;k<5;k++){x0+=R()*36-18;y0+=6+R()*16;c.lineTo(x0,y0)}c.stroke()}
  // Paint
  var lineCol="rgba(236,238,228,.42)",faint="rgba(236,238,228,.22)";
  var laneTop=top,laneBot=H*.49,lu=.3;
  // key (lime-tinted)
  c.beginPath();c.moveTo(cx(-lu,laneTop),laneTop);c.lineTo(cx(lu,laneTop),laneTop);c.lineTo(cx(lu,laneBot),laneBot);c.lineTo(cx(-lu,laneBot),laneBot);c.closePath();
  c.fillStyle="rgba(233,255,63,.055)";c.fill();c.strokeStyle=lineCol;c.lineWidth=2.2;c.stroke();
  // lane hash marks
  for(i=1;i<=3;i++){var hy=lerp(laneTop,laneBot,i*.22);line(c,cx(-lu,hy),hy,cx(-lu,hy)-7,hy,2.2,faint);line(c,cx(lu,hy),hy,cx(lu,hy)+7,hy,2.2,faint)}
  // free-throw circle
  var frx=courtHalf(laneBot)*lu;c.beginPath();c.ellipse(W/2,laneBot,frx,frx*.36,0,Math.PI,Math.PI*2);c.strokeStyle=lineCol;c.stroke();
  c.setLineDash([7,7]);c.beginPath();c.ellipse(W/2,laneBot,frx,frx*.36,0,0,Math.PI);c.strokeStyle=faint;c.stroke();c.setLineDash([]);
  // three-point arc (projected half-circle around the spot under the rim)
  var yc=H*.19,D=H*.46,Ru=.88;c.beginPath();
  for(var a=-90;a<=90;a+=3){var th=a*Math.PI/180,yy=yc+Math.cos(th)*D,xx=cx(Math.sin(th)*Ru,yy);if(a===-90)c.moveTo(xx,yy);else c.lineTo(xx,yy)}
  c.strokeStyle=lineCol;c.lineWidth=2.4;c.stroke();
  // baseline + sidelines
  line(c,cx(-1,top),top,cx(1,top),top,2.4,lineCol);
  line(c,cx(-.97,top),top,cx(-.97,H),H,2.4,faint);line(c,cx(.97,top),top,cx(.97,H),H,2.4,faint);
  // restricted arc
  c.beginPath();c.ellipse(W/2,yc,courtHalf(yc)*.16,10,0,0,Math.PI);c.strokeStyle=faint;c.lineWidth=2;c.stroke();
  // Painted words on the asphalt
  c.save();c.translate(W*.1,H*.8);c.rotate(-1.24);c.fillStyle="rgba(255,255,255,.055)";c.font="900 30px "+FONT;c.fillText("TRUST NOBODY",0,0);c.restore();
  c.save();c.translate(W/2,H*.93);c.scale(1,.45);c.fillStyle="rgba(233,255,63,.06)";c.font="900 54px "+FONT;c.textAlign="center";c.fillText("BUCKETS",0,0);c.restore();
  c.restore();
  // Court edge highlight
  c.strokeStyle="rgba(233,255,63,.12)";c.lineWidth=1.5;c.beginPath();c.moveTo(cx(-1,top),top);c.lineTo(cx(-1,bot),bot);c.moveTo(cx(1,top),top);c.lineTo(cx(1,bot),bot);c.stroke();
}
function drawLight(c,x,baseY,topY,dir){
  line(c,x,baseY,x,topY,3,"rgba(150,155,170,.35)");
  line(c,x,topY,x+dir*16,topY-6,3,"rgba(150,155,170,.35)");
  var lx=x+dir*18,ly=topY-4;
  c.fillStyle="#fff8dc";rr(c,lx-6,ly-3,12,6,3);c.fill();
  var hg=c.createRadialGradient(lx,ly,0,lx,ly,40);hg.addColorStop(0,"rgba(255,248,220,.5)");hg.addColorStop(1,"rgba(255,248,220,0)");c.fillStyle=hg;c.fillRect(lx-40,ly-40,80,80);
  // light cone + pool on the court
  c.save();c.globalCompositeOperation="lighter";
  var px=W/2+dir*-W*.18,py=H*.52;
  var cg=c.createLinearGradient(lx,ly,px,py);cg.addColorStop(0,"rgba(255,246,210,.07)");cg.addColorStop(1,"rgba(255,246,210,0)");
  c.fillStyle=cg;c.beginPath();c.moveTo(lx,ly);c.lineTo(px-W*.3,py+H*.2);c.lineTo(px+W*.3,py+H*.2);c.closePath();c.fill();
  var pg=c.createRadialGradient(px,py+H*.12,0,px,py+H*.12,W*.5);pg.addColorStop(0,"rgba(255,246,210,.06)");pg.addColorStop(1,"rgba(255,246,210,0)");
  c.fillStyle=pg;c.save();c.translate(px,py+H*.12);c.scale(1,.45);c.beginPath();c.arc(0,0,W*.5,0,Math.PI*2);c.restore();c.fill();
  c.restore();
}

// ======================= HOOP =======================
function drawBackboard(){
  var x=W/2,bt=H*BACK_Y_F,bw=W*.34,bh=W*.11,top=bt-bh/2;
  // shot clock on top of the backboard
  var cw=58,ch=24,cy=top-ch-3,danger=running&&state.clock<=3;
  rr(ctx,x-cw/2,cy,cw,ch,5);ctx.fillStyle="#050608";ctx.fill();ctx.strokeStyle=danger?"rgba(255,77,109,.8)":"rgba(255,255,255,.18)";ctx.lineWidth=1.5;ctx.stroke();
  ctx.font="900 16px "+FONT;ctx.textAlign="center";ctx.textBaseline="middle";
  var clockTxt=running?Math.max(0,state.clock).toFixed(1):"8.5";
  ctx.fillStyle=danger?(Math.sin(time*18)>0?"#ff4d6d":"#ff8fa3"):"#e9ff3f";
  ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.fillText(clockTxt,x,cy+ch/2+1);ctx.shadowBlur=0;ctx.textBaseline="alphabetic";
  line(ctx,x-14,cy+ch,x-14,top,2,"rgba(255,255,255,.2)");line(ctx,x+14,cy+ch,x+14,top,2,"rgba(255,255,255,.2)");
  // board
  ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillRect(x-bw/2+4,top+bh,bw-8,6);
  rr(ctx,x-bw/2,top,bw,bh,6);var gg=ctx.createLinearGradient(0,top,0,top+bh);gg.addColorStop(0,"rgba(220,230,245,.2)");gg.addColorStop(1,"rgba(220,230,245,.07)");ctx.fillStyle=gg;ctx.fill();
  ctx.strokeStyle="rgba(245,247,250,.85)";ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle="#e9ff3f";ctx.lineWidth=2.2;ctx.strokeRect(x-23,bt-12,46,25);
  // glare
  ctx.save();rr(ctx,x-bw/2,top,bw,bh,6);ctx.clip();ctx.fillStyle="rgba(255,255,255,.07)";ctx.beginPath();ctx.moveTo(x-bw/2+20,top);ctx.lineTo(x-bw/2+48,top);ctx.lineTo(x-bw/2+18,top+bh);ctx.lineTo(x-bw/2-10,top+bh);ctx.fill();ctx.restore();
}
function rimRX(){return W*.075}
function drawRimBack(){
  var x=W/2,y=rimY();
  line(ctx,x,y-4,x,H*BACK_Y_F+W*.03,4,"#d9581a"); // bracket
  ctx.strokeStyle="#c9521a";ctx.lineWidth=4.5;ctx.beginPath();ctx.ellipse(x,y,rimRX(),6,0,Math.PI,Math.PI*2);ctx.stroke();
}
function drawNetAndRimFront(){
  var x=W/2,y=rimY(),rx=rimRX();
  var snap=netT>0?netT/.45:0;                       // 1 → 0 after a make
  var stretch=1+Math.sin(snap*Math.PI)*.35;
  var sway=Math.sin(time*30)*3*snap;
  var len=36*stretch,botW=rx*.55;
  ctx.strokeStyle="rgba(240,240,232,.62)";ctx.lineWidth=1.3;
  for(var i=0;i<=6;i++){
    var u=i/6*2-1,x0=x+u*rx,x1=x+u*botW+sway;
    ctx.beginPath();ctx.moveTo(x0,y+2);ctx.quadraticCurveTo(x+u*rx*.8+sway*.5,y+len*.55,x1,y+len);ctx.stroke();
  }
  for(i=1;i<=3;i++){var ty=y+len*i/3.4,w=lerp(rx,botW,i/3.4);ctx.beginPath();ctx.ellipse(x+sway*i/3,ty,w,3.2,0,0,Math.PI*2);ctx.stroke()}
  // diagonal weave
  ctx.strokeStyle="rgba(240,240,232,.28)";
  for(i=0;i<6;i++){var ua=i/6*2-1,ub=(i+1)/6*2-1;ctx.beginPath();ctx.moveTo(x+ua*rx,y+2);ctx.lineTo(x+ub*botW+sway,y+len);ctx.moveTo(x+ub*rx,y+2);ctx.lineTo(x+ua*botW+sway,y+len);ctx.stroke()}
  // front of rim
  ctx.strokeStyle="#ff6b24";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(x,y,rx,6,0,0,Math.PI);ctx.stroke();
  ctx.strokeStyle="rgba(255,200,150,.55)";ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(x,y-1,rx,5,0,.3,Math.PI-.3);ctx.stroke();
}

// ======================= PEOPLE =======================
var SKIN_P="#b97552",SKIN_D="#8e5d40",HAIR="#14151b";
function limb(x1,y1,x2,y2,x3,y3,w,col){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.stroke()}
function groundShadow(x,y,s,a){ctx.fillStyle="rgba(0,0,0,"+(a||.42)+")";ctx.beginPath();ctx.ellipse(x,y,24*s,7*s,0,0,Math.PI*2);ctx.fill()}

// Pose: crouch (px down), spread (feet apart), lean (radians), arms {l:[ex,ey,hx,hy], r:[...]} relative to shoulders.
function poseFor(o,isPlayer){
  var p={crouch:3,spread:7,lean:0,l:[-17,-50,-17,-38],r:[17,-50,17,-38],bob:Math.sin(time*8+(isPlayer?0:1))*1.2};
  if(isPlayer){
    var a=player.action;
    var bSide=ball.x>player.x?1:-1;
    var hy=clamp((ball.y-player.y)/depth(player.y)-43,-58,-24); // hand tracks the ball when it's up
    if(!ball.shot&&!ball.post){if(bSide>0)p.r=[17,-52,(ball.x-player.x)/depth(player.y),hy-6];else p.l=[-17,-52,(ball.x-player.x)/depth(player.y),hy-6]}
    if(a==="cross"){p.spread=13;p.crouch=7}
    else if(a==="hesi"){p.crouch=0;p.lean=0}
    else if(a==="step"){p.crouch=6;p.spread=10}
    else if(a==="drive"){p.crouch=8;p.spread=11;p.lean=player.lean*.6}
    else if(a==="shot"){p.crouch=0;p.l=[-11,-84,-6,-100];p.r=[11,-84,6,-102]}
    else if(a==="layup"){p.crouch=0;p.l=[-16,-58,-20,-46];p.r=[10,-86,4,-104]}
    else if(a==="dunk"){p.crouch=0;p.l=[-12,-86,-6,-104];p.r=[10,-88,3,-108]}
    if(player.stun>0){p.crouch=5;p.lean=Math.sin(time*40)*.05}
    p.lean+=player.lean;
  }else{
    var st=o.stance;
    if(o.stun>0){p.crouch=2;p.spread=9;p.l=[-20,-60,-26,-52];p.r=[20,-60,26,-52];p.lean=Math.sin(time*26)*.12}
    else if(st==="press"){p.crouch=9;p.spread=13;p.l=[-20,-52,-22,-40];p.r=[20,-52,22,-40]}
    else if(st==="reach"){p.crouch=7;p.spread=11;var sw=Math.sin(time*11);p.r=[18,-50,22+sw*6,-34+sw*5];p.l=[-15,-82,-12,-96]}
    else if(st==="sag"){p.crouch=1;p.spread=7;p.l=[-15,-50,-14,-40];p.r=[15,-50,14,-40];p.bob=Math.sin(time*4)*1.8}
    else if(st==="cut"){p.crouch=11;p.spread=17;p.l=[-28,-62,-38,-62];p.r=[28,-62,38,-62]}
  }
  return p;
}
function drawPerson(o,isPlayer){
  var s=depth(o.y),fx=o.x,fy=o.y+43*s-(isPlayer?player.air:0);
  groundShadow(o.x,o.y+43*s,s*(isPlayer&&player.air>2?.8:1));
  var p=poseFor(o,isPlayer),c=p.crouch;
  var jersey=isPlayer?"#f1f2ec":"#191c25",trim=isPlayer?"#e9ff3f":(o.accent||"#55dcff"),shorts=isPlayer?"#e4e6dd":"#12141b";
  var skin=isPlayer?SKIN_P:SKIN_D;
  ctx.save();ctx.translate(fx,fy+p.bob*s);ctx.scale(s,s);ctx.rotate(p.lean);
  // legs + shoes
  var sp=p.spread;
  limb(-5,-40+c,-(sp+2),-21+c*.5,-sp,-6,7.5,skin);limb(5,-40+c,sp+2,-21+c*.5,sp,-6,7.5,skin);
  ctx.fillStyle="#f4f5f0";ctx.beginPath();ctx.ellipse(-sp-1,-3,6.5,4,0,0,Math.PI*2);ctx.ellipse(sp+1,-3,6.5,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=trim;ctx.fillRect(-sp-7,-1.5,13,2);ctx.fillRect(sp-5,-1.5,13,2);
  // shorts
  rr(ctx,-13,-48+c,26,17,4);ctx.fillStyle=shorts;ctx.fill();ctx.fillStyle=trim;ctx.fillRect(-13,-36+c,3,5);ctx.fillRect(10,-36+c,3,5);
  // arms (drawn before the torso so shoulders tuck under the jersey)
  var shY=-66+c;
  limb(-12,shY,p.l[0],p.l[1]+c,p.l[2],p.l[3]+c,6.5,skin);
  limb(12,shY,p.r[0],p.r[1]+c,p.r[2],p.r[3]+c,6.5,skin);
  ctx.fillStyle=skin;ctx.beginPath();ctx.arc(p.l[2],p.l[3]+c,3.8,0,Math.PI*2);ctx.arc(p.r[2],p.r[3]+c,3.8,0,Math.PI*2);ctx.fill();
  // torso (tank top)
  ctx.beginPath();ctx.moveTo(-14,shY);ctx.lineTo(14,shY);ctx.lineTo(12,-45+c);ctx.lineTo(-12,-45+c);ctx.closePath();ctx.fillStyle=jersey;ctx.fill();
  ctx.strokeStyle=trim;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-14,shY);ctx.lineTo(-12,-45+c);ctx.moveTo(14,shY);ctx.lineTo(12,-45+c);ctx.stroke();
  ctx.beginPath();ctx.arc(0,shY-1,5,0,Math.PI);ctx.stroke();
  ctx.fillStyle=isPlayer?"#0b0d12":trim;ctx.font="900 11px "+FONT;ctx.textAlign="center";ctx.fillText(isPlayer?"00":(o.num||"11"),0,-51+c);
  // head
  ctx.fillStyle=skin;ctx.fillRect(-3,shY-6,6,6);
  ctx.beginPath();ctx.arc(0,-79+c,9.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=HAIR;
  if(isPlayer){ctx.beginPath();ctx.arc(0,-80+c,9.6,Math.PI*.95,Math.PI*2.05);ctx.fill();ctx.fillRect(-9.6,-81+c,19.2,5)} // back of head
  else{ctx.beginPath();ctx.arc(0,-81+c,9.4,Math.PI,Math.PI*2);ctx.fill()}
  ctx.fillStyle=trim;ctx.fillRect(-9.8,-84+c,19.6,3.2); // headband
  if(!isPlayer&&o.stun<=0){ctx.fillStyle="#0b0c10";ctx.fillRect(-4.5,-79+c,2.4,2.4);ctx.fillRect(2.1,-79+c,2.4,2.4)} // eyes
  ctx.restore();
  // dizzy stars
  if(!isPlayer&&o.stun>0){
    for(var i=0;i<3;i++){var a=time*7+i*2.1;ctx.fillStyle="#e9ff3f";ctx.font="900 "+(10*s)+"px "+FONT;ctx.textAlign="center";ctx.fillText("✦",o.x+Math.cos(a)*14*s,fy-92*s+Math.sin(a)*4*s)}
  }
}

// ======================= BALL =======================
function ballShadowPos(){
  if(ball.post)return {x:ball.x,y:ball.ground+2,h:ball.ground-ball.y};
  if(ball.shot){var t=clamp(ball.t/ball.dur,0,1),gy=lerp(player.y+43*depth(player.y),H*.235,t);return {x:ball.x,y:gy,h:gy-ball.y}}
  var fy=player.y+43*depth(player.y);return {x:ball.x,y:fy,h:fy-ball.y};
}
function drawBallShadow(){
  var sp=ballShadowPos(),k=clamp(1-sp.h/300,.25,1);
  ctx.fillStyle="rgba(0,0,0,"+(.38*k)+")";ctx.beginPath();ctx.ellipse(sp.x,sp.y,10*k,3.2*k,0,0,Math.PI*2);ctx.fill();
}
function drawBall(){
  var s=ball.shot||ball.post?lerp(1,.82,clamp((H*.5-ball.y)/(H*.3),0,1)):depth(player.y);
  var r=ball.r*s,x=ball.x,y=ball.y;
  ctx.save();ctx.translate(x,y);
  var g=ctx.createRadialGradient(-r*.35,-r*.35,r*.1,0,0,r);g.addColorStop(0,"#ffa25a");g.addColorStop(1,"#d9600f");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  ctx.rotate(ball.spin);
  ctx.strokeStyle="rgba(35,18,8,.85)";ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.moveTo(0,-r);ctx.bezierCurveTo(-r*.45,-r*.3,-r*.45,r*.3,0,r);ctx.moveTo(0,-r);ctx.bezierCurveTo(r*.45,-r*.3,r*.45,r*.3,0,r);ctx.stroke();
  ctx.restore();
  if(ball.perfect&&ball.shot){ctx.strokeStyle="rgba(233,255,63,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r+3,0,Math.PI*2);ctx.stroke()}
}
function ballBehindRim(){
  if(ball.post==="drop")return ball.y<rimY()+44;
  if(ball.shot&&ball.made){var t=ball.t/ball.dur;return t>.9}
  return false;
}

// ======================= READ UI ON THE COURT =======================
function drawFloorRings(){
  if(!running)return;
  var s=depth(player.y),fy=player.y+43*s;
  // space ring under the player
  var sp=clamp(state.space,0,100)/100,col=state.advantage>0?"#e9ff3f":sp>.6?"#e9ff3f":sp>.3?"#ffb22f":"#ff4d6d";
  ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,.08)";ctx.beginPath();ctx.ellipse(player.x,fy,30*s,9*s,0,0,Math.PI*2);ctx.stroke();
  if(sp>0){ctx.strokeStyle=col;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(player.x,fy,30*s,9*s,0,Math.PI/2,Math.PI/2+Math.PI*2*sp);ctx.stroke();ctx.globalAlpha=1}
  // open lane: chevrons from the player toward the rim
  if(state.advantage>0&&!ball.shot){
    var tx=W/2,ty=H*.24,n=6,pulse=(time*2.2)%1;
    for(var i=0;i<n;i++){
      var t=(i+pulse)/n,x=lerp(player.x,tx,t),y=lerp(fy-6,ty,t),a=Math.sin(Math.PI*t)*.75,k=depth(y);
      ctx.globalAlpha=a;ctx.strokeStyle="#e9ff3f";ctx.lineWidth=3*k;ctx.beginPath();ctx.moveTo(x-9*k,y+5*k);ctx.lineTo(x,y);ctx.lineTo(x+9*k,y+5*k);ctx.stroke();
    }
    ctx.globalAlpha=1;
    var pr=1+Math.sin(time*14)*.06;ctx.strokeStyle="rgba(233,255,63,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(player.x,fy,40*s*pr,13*s*pr,0,0,Math.PI*2);ctx.stroke();
  }
}
function drawStanceBadge(){
  if(!running&&!paused)return;
  var s=depth(defender.y),headY=defender.y+43*s-96*s;
  var y=Math.max(headY-14,rimY()+52);
  var open=state.advantage>0,stun=defender.stun>0;
  var label=open?"BEATEN":stun?"STUNNED":defender.stanceLabel,glyph=open||stun?"✦":defender.stanceGlyph;
  var col=open||stun?"#e9ff3f":defender.stanceColor;
  var pop=1+Math.max(0,.3-defender.stanceT)*1.4;
  ctx.save();ctx.translate(defender.x,y);ctx.scale(pop,pop);
  ctx.font="900 11px "+FONT;ctx.textAlign="center";ctx.textBaseline="middle";
  var txt=glyph+"  "+label+(defender.boss&&!open?"  "+defender.readsWon+"/"+defender.readsNeeded:"");
  var w=ctx.measureText(txt).width+22;
  rr(ctx,-w/2,-12,w,24,12);ctx.fillStyle="rgba(5,6,9,.86)";ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.stroke();
  ctx.fillStyle=col;ctx.fillText(txt,0,1);
  // little pointer
  ctx.beginPath();ctx.moveTo(-5,12);ctx.lineTo(5,12);ctx.lineTo(0,17);ctx.closePath();ctx.fillStyle=col;ctx.fill();
  ctx.restore();
  // name + coaching line under the badge (early possessions only)
  ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.font="800 8.5px "+FONT;ctx.fillStyle="rgba(255,255,255,.5)";
  ctx.fillText(defender.name,defender.x,y-18);
}
function coachText(){
  if(state.advantage>0)return "OPEN · TAP TO SHOOT or SWIPE ↑";
  return {press:"TAP or SWIPE ↔",sag:"HOLD, THEN RELEASE",reach:"SWIPE ↔ TO CROSS",cut:"SWIPE ↓ TO STEP BACK"}[defender.stance];
}
function coachActive(){return running&&store.stats.runs<2&&state.pos<=3}
function drawCoach(){
  // Teaching pill under the player for the first couple of runs.
  if(!coachActive()||paused||ball.shot)return;
  var s=depth(player.y),y=Math.min(player.y+43*s+26,H-58);
  var txt=coachText();ctx.font="900 10px "+FONT;ctx.textAlign="center";ctx.textBaseline="middle";
  var w=ctx.measureText(txt).width+22,a=.75+Math.sin(time*5)*.25,px=clamp(player.x,w/2+10,W-w/2-10);
  ctx.globalAlpha=a;rr(ctx,px-w/2,y-11,w,22,11);ctx.fillStyle=state.advantage>0?"#e9ff3f":"rgba(5,6,9,.85)";ctx.fill();
  ctx.strokeStyle=state.advantage>0?"#e9ff3f":defender.stanceColor;ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle=state.advantage>0?"#08090d":"#fff";ctx.fillText(txt,px,y+1);ctx.globalAlpha=1;ctx.textBaseline="alphabetic";
}

// ======================= EFFECTS =======================
function drawEffects(){
  for(var i=0;i<streaks.length;i++){var s=streaks[i],a=1-s.t/s.life;ctx.globalAlpha=a*.6;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r*a,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;
  for(i=0;i<particles.length;i++){var p=particles[i],pa=1-p.t/p.life;ctx.globalAlpha=pa;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*pa,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;ctx.textAlign="center";
  for(i=0;i<floaters.length;i++){var f=floaters[i],fa=1-f.t/f.life,pop=f.big?1+Math.max(0,.15-f.t)*3:1;ctx.globalAlpha=fa;ctx.font="900 "+Math.round((f.big?18:12)*pop)+"px "+FONT;
    ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillText(f.txt,f.x+1,f.y+2);ctx.fillStyle=f.color;ctx.fillText(f.txt,f.x,f.y)}
  ctx.globalAlpha=1;
  if(state.heat>=75&&running){var s2=depth(player.y),cy=player.y+10*s2,g=ctx.createRadialGradient(player.x,cy,0,player.x,cy,90*s2);g.addColorStop(0,state.heat>=100?"rgba(233,255,63,.13)":"rgba(255,120,24,.11)");g.addColorStop(1,"rgba(255,120,24,0)");ctx.fillStyle=g;ctx.fillRect(player.x-100,cy-100,200,200)}
}

// ======================= FRAME =======================
function draw(){
  if(bgDirty)buildBg();
  ctx.save();
  var sx=shake?rand(-shake,shake):0,sy=shake?rand(-shake*.5,shake*.5):0;ctx.translate(sx,sy);
  ctx.clearRect(-20,-20,W+40,H+40);
  ctx.drawImage(bg,0,0,bg.width,bg.height,0,0,W,H+L.camY);
  ctx.translate(0,L.camY);
  drawFloorRings();
  drawBackboard();drawRimBack();
  var behind=ballBehindRim();
  if(behind){drawBallShadow();drawBall()}
  drawNetAndRimFront();
  // people back-to-front
  var pd=defender.y<=player.y?[[defender,false],[player,true]]:[[player,true],[defender,false]];
  if(!behind)drawBallShadow();
  var ballInFrontOfAll=ball.shot||ball.post;
  for(var i=0;i<2;i++){
    drawPerson(pd[i][0],pd[i][1]);
    if(pd[i][1]&&!behind&&!ballInFrontOfAll)drawBall(); // dribble ball sits with the player
  }
  if(!behind&&ballInFrontOfAll)drawBall();
  drawStanceBadge();
  drawEffects();
  drawCoach();
  ctx.restore();
  ctx.drawImage(vig,0,0,vig.width,vig.height,0,0,W,H);
  if(running&&state.advantage>0){ctx.strokeStyle="rgba(233,255,63,"+(.18+Math.sin(time*10)*.08)+")";ctx.lineWidth=6;ctx.strokeRect(3,3,W-6,H-6)}
}
function loop(ts){
  var dt=Math.min(.033,(ts-last)/1000||0);last=ts;update(dt);draw();requestAnimationFrame(loop);
}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){bgDirty=true});
requestAnimationFrame(loop);
