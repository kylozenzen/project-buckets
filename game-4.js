// BUCKETS — game-4.js
// Input handling (touch + keyboard) and mobile browser lock.

function lockMobileBrowser(){
  var root=document.documentElement,body=document.body,app=document.getElementById("app");
  [root,body,app,canvas].forEach(function(el){
    if(!el)return;
    el.style.webkitUserSelect="none";
    el.style.userSelect="none";
    el.style.webkitTouchCallout="none";
    el.style.webkitTapHighlightColor="transparent";
    el.style.overscrollBehavior="none";
  });
  root.style.overflow="hidden";
  root.style.touchAction="none";
  body.style.overflow="hidden";
  body.style.touchAction="none";
  body.style.position="fixed";
  body.style.inset="0";
  body.style.width="100%";
  body.style.height="100%";
  if(app){app.style.touchAction="none";app.style.overflow="hidden"}
  canvas.style.touchAction="none";

  // Block page scroll/bounce, but let menu cards scroll on short screens.
  document.addEventListener("touchmove",function(e){if(e.target.closest&&e.target.closest(".card"))return;e.preventDefault()},{passive:false});
  ["gesturestart","gesturechange","gestureend"].forEach(function(type){
    document.addEventListener(type,function(e){e.preventDefault()},{passive:false});
  });
  ["contextmenu","dragstart","selectstart"].forEach(function(type){
    document.addEventListener(type,function(e){e.preventDefault()});
  });
  document.addEventListener("dblclick",function(e){e.preventDefault()},{passive:false});
  window.addEventListener("scroll",function(){window.scrollTo(0,0)},{passive:true});
}
lockMobileBrowser();

function down(e){
  if(!running||paused||menuOpen)return;audioInit();placeShotMeter(e.clientX,e.clientY);pointer.down=true;pointer.id=e.pointerId;pointer.sx=pointer.x=e.clientX;pointer.sy=pointer.y=e.clientY;pointer.t0=performance.now();pointer.moved=false;pointer.charge=0;
  try{canvas.setPointerCapture(e.pointerId)}catch(err){}
}
function move(e){
  if(!pointer.down||e.pointerId!==pointer.id)return;pointer.x=e.clientX;pointer.y=e.clientY;
  var dx=pointer.x-pointer.sx,dy=pointer.y-pointer.sy;if(Math.sqrt(dx*dx+dy*dy)>20){pointer.moved=true;shotMeter.classList.remove("active")}
}
function up(e){
  if(!pointer.down||e.pointerId!==pointer.id)return;
  var dx=e.clientX-pointer.sx,dy=e.clientY-pointer.sy,mag=Math.sqrt(dx*dx+dy*dy),held=(performance.now()-pointer.t0)/1000;
  pointer.down=false;shotMeter.classList.remove("active");shotFill.style.width="0%";
  if(mag>30){
    if(Math.abs(dx)>Math.abs(dy))crossover(dx>0?1:-1);
    else if(dy<0)drive();else stepback();
  }else if(held>.16){shoot(chargeFromHeld(held))}
  else hesitate();
}
canvas.addEventListener("pointerdown",down,{passive:true});canvas.addEventListener("pointermove",move,{passive:true});canvas.addEventListener("pointerup",up,{passive:true});canvas.addEventListener("pointercancel",clearCharge,{passive:true});
window.addEventListener("blur",clearCharge);

window.addEventListener("keydown",function(e){
  if((e.key==="Escape"||e.key==="p"||e.key==="P")&&running){e.preventDefault();if(menuOpen)closePause();else openPause();return}
  if(!running||paused||menuOpen)return;
  if(e.key===" ")e.preventDefault();
  if(e.repeat)return;
  audioInit();
  if(e.key==="ArrowLeft"||e.key==="a")crossover(-1);
  else if(e.key==="ArrowRight"||e.key==="d")crossover(1);
  else if(e.key==="ArrowUp"||e.key==="w")drive();
  else if(e.key==="ArrowDown"||e.key==="s")stepback();
  else if(e.key==="h")hesitate();
  // Space works like holding a finger down: hold to charge, release to shoot.
  else if(e.key===" "&&!keyCharge.down&&!pointer.down){keyCharge.down=true;keyCharge.t0=performance.now();pointer.charge=0;placeShotMeter(null)}
});
window.addEventListener("keyup",function(e){
  if(e.key!==" "||!keyCharge.down)return;
  e.preventDefault();
  var held=(performance.now()-keyCharge.t0)/1000;
  clearCharge();
  if(!running||paused||menuOpen)return;
  if(held>.16)shoot(chargeFromHeld(held));else hesitate();
});

