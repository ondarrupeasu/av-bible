import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// i18n — centralised strings (add ES/EU here)
// ─────────────────────────────────────────────
const STRINGS = {
  en: {
    appTitle: "AV Bible",
    appSubtitle: "Interactive Audiovisual Reference",
    backToHub: "← All Modules",
    uploadImage: "Upload your image",
    orUseDefault: "or use default",
    uploadBtn: "Upload Image",
    categories: {
      image: "Image & Signal",
      optics: "Optics & Sensor",
      color: "Color Science",
      defects: "Artifacts & Defects",
      narrative: "Narrative & Camera",
      scopes: "Monitoring & Scopes",
    },
    modules: {
      aspectRatio: { title: "Aspect Ratio", desc: "Explore how different ratios frame the world" },
      resolution: { title: "Resolution", desc: "From SD to 8K — pixels and perception" },
      chromaSubsampling: { title: "Chroma Subsampling", desc: "4:4:4, 4:2:2, 4:2:0 — color information loss" },
      raw: { title: "RAW vs Compressed", desc: "Latitude, detail and file size trade-offs" },
      frameRate: { title: "Frame Rate", desc: "24p, 25p, 50p, 120p — motion and time" },
      pictureProfiles: { title: "Picture Profiles & LOG", desc: "S-Log, Log-C, V-Log — capturing latitude" },
      colorSpaces: { title: "Color Spaces & Gamuts", desc: "Rec.709, P3, Rec.2020 — the color universe" },
      aces: { title: "ACES Pipeline", desc: "IDT → RRT → ODT — the color management framework" },
      colorTemp: { title: "Color Temperature", desc: "From candle to daylight — Kelvin scale" },
      rollingShutter: { title: "Rolling Shutter", desc: "Skew, wobble and jello — CMOS sensor artifacts" },
      moire: { title: "Moiré & Aliasing", desc: "Frequency interference and anti-aliasing" },
      banding: { title: "Banding & Bit Depth", desc: "8-bit vs 10-bit — tonal steps and posterization" },
      noise: { title: "Noise & ISO", desc: "Luminance vs chroma noise — sensor sensitivity" },
      vignetting: { title: "Vignetting", desc: "Light falloff at the edges of the frame" },
      chromaticAberration: { title: "Chromatic Aberration", desc: "Fringing and lens colour errors" },
      depthOfField: { title: "Depth of Field", desc: "Aperture, focal length and focus distance" },
      shotTypes: { title: "Shot Types", desc: "ECU to EWS — the visual language of framing" },
      cameraMovement: { title: "Camera Movement", desc: "Pan, tilt, track, zoom — motion vocabulary" },
      timecode: { title: "Timecode", desc: "SMPTE timecode — the language of synchronisation" },
      scopes: { title: "Scopes", desc: "Histogram, Waveform, Vectorscope & Parade — with live grading" },
    },
  },
};

const T = STRINGS.en;

// ─────────────────────────────────────────────
// Module registry
// ─────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "image", label: T.categories.image,
    modules: ["aspectRatio","resolution","chromaSubsampling","raw","frameRate"],
  },
  {
    id: "color", label: T.categories.color,
    modules: ["pictureProfiles","colorSpaces","aces","colorTemp"],
  },
  {
    id: "defects", label: T.categories.defects,
    modules: ["rollingShutter","moire","banding","noise","vignetting","chromaticAberration"],
  },
  {
    id: "optics", label: T.categories.optics,
    modules: ["depthOfField"],
  },
  {
    id: "narrative", label: T.categories.narrative,
    modules: ["shotTypes","cameraMovement","timecode"],
  },
  {
    id: "scopes", label: T.categories.scopes,
    modules: ["scopes"],
  },
];

// ─────────────────────────────────────────────
// Shared scene — one coherent world reused across modules
// (default image + Shot Types framing + Camera Movement + DoF).
// Normalised subject boxes let framing modules locate the person.
// ─────────────────────────────────────────────
const SCENE = {
  faceBox: { x:0.508, y:0.540, w:0.084, h:0.11 },   // head area — for ECU/CU
  bodyBox: { x:0.470, y:0.525, w:0.16,  h:0.31 },   // full figure — for MS/LS
};

function contactShadow(ctx, cx, cy, rx, ry, a){
  ctx.fillStyle=`rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,7); ctx.fill();
}

function drawFigure(ctx, cx, feetY, h){
  const headR=h*0.09, headCY=feetY-h+headR, neckY=headCY+headR*0.72;
  const shoulderY=headCY+headR*1.9, hipY=feetY-h*0.46;
  ctx.save();
  contactShadow(ctx,cx,feetY,h*0.13,h*0.026,0.20);
  // trousers (tapered)
  ctx.fillStyle="#2b3750";
  ctx.beginPath(); ctx.moveTo(cx-h*0.068,hipY); ctx.lineTo(cx-h*0.006,hipY); ctx.lineTo(cx-h*0.018,feetY); ctx.lineTo(cx-h*0.078,feetY); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+h*0.006,hipY); ctx.lineTo(cx+h*0.068,hipY); ctx.lineTo(cx+h*0.078,feetY); ctx.lineTo(cx+h*0.018,feetY); ctx.closePath(); ctx.fill();
  // coat / torso (tapered trapezoid + rounded shoulders)
  ctx.fillStyle="#a4523f";
  ctx.beginPath();
  ctx.moveTo(cx-h*0.092,shoulderY); ctx.lineTo(cx+h*0.092,shoulderY);
  ctx.lineTo(cx+h*0.072,hipY+h*0.01); ctx.lineTo(cx-h*0.072,hipY+h*0.01); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx,shoulderY,h*0.092,h*0.03,0,Math.PI,0); ctx.fill();
  // shaded left half (key light from upper-right)
  ctx.fillStyle="rgba(0,0,0,0.13)";
  ctx.beginPath(); ctx.moveTo(cx,shoulderY-h*0.012); ctx.lineTo(cx-h*0.092,shoulderY); ctx.lineTo(cx-h*0.072,hipY+h*0.01); ctx.lineTo(cx,hipY+h*0.01); ctx.closePath(); ctx.fill();
  // neck
  ctx.fillStyle="#c4895a"; ctx.fillRect(cx-h*0.02,neckY,h*0.04,headR*1.05);
  // head with soft form shading
  const hg=ctx.createRadialGradient(cx+headR*0.35,headCY-headR*0.35,headR*0.15,cx,headCY,headR*1.15);
  hg.addColorStop(0,"#ecbb8b"); hg.addColorStop(1,"#bd825a");
  ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(cx,headCY,headR,0,7); ctx.fill();
  // hair
  ctx.fillStyle="#3b2b1d"; ctx.beginPath(); ctx.arc(cx,headCY-headR*0.14,headR*0.98,Math.PI*1.05,Math.PI*2-0.05); ctx.fill();
  // features (subtle, adult — read at close-ups)
  ctx.fillStyle="#2b2018";
  ctx.beginPath(); ctx.arc(cx-headR*0.3,headCY-headR*0.02,headR*0.09,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+headR*0.3,headCY-headR*0.02,headR*0.09,0,7); ctx.fill();
  ctx.strokeStyle="rgba(120,80,55,0.55)"; ctx.lineWidth=headR*0.06; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(cx,headCY+headR*0.02); ctx.lineTo(cx+headR*0.06,headCY+headR*0.26); ctx.stroke();
  ctx.strokeStyle="rgba(150,80,65,0.6)"; ctx.lineWidth=headR*0.07;
  ctx.beginPath(); ctx.moveTo(cx-headR*0.2,headCY+headR*0.5); ctx.lineTo(cx+headR*0.22,headCY+headR*0.48); ctx.stroke();
  ctx.restore();
}

// ── Shared scene as depth-sorted layers (far → near) ─────────────
// depth = arbitrary "metres" for DoF; nearer layers get more parallax on dolly.
const SCENE_LAYERS = [
  { name:"sky", depth:600, draw:(ctx,W,H)=>{
    const horizon=H*0.60;
    const sky=ctx.createLinearGradient(0,0,0,horizon);
    sky.addColorStop(0,"#33506a"); sky.addColorStop(0.6,"#5f7f90"); sky.addColorStop(1,"#7e969b");
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,horizon);
    const sunX=W*0.80, sunY=H*0.16, sunR=H*0.045;
    const glow=ctx.createRadialGradient(sunX,sunY,sunR*0.3,sunX,sunY,sunR*5);
    glow.addColorStop(0,"rgba(255,244,214,0.9)"); glow.addColorStop(0.25,"rgba(255,224,160,0.4)"); glow.addColorStop(1,"rgba(255,220,160,0)");
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(sunX,sunY,sunR*5,0,7); ctx.fill();
    ctx.fillStyle="#fdf3d4"; ctx.beginPath(); ctx.arc(sunX,sunY,sunR,0,7); ctx.fill();
  }},
  { name:"mountains", depth:300, draw:(ctx,W,H)=>{   // atmospheric haze — desaturated, light
    const horizon=H*0.60;
    ctx.fillStyle="#9fb0c0";
    ctx.beginPath(); ctx.moveTo(0,horizon);
    [[0,0.52],[0.15,0.45],[0.30,0.50],[0.46,0.43],[0.62,0.49],[0.80,0.46],[1,0.51]].forEach(([x,y])=>ctx.lineTo(x*W,y*H));
    ctx.lineTo(W,horizon); ctx.closePath(); ctx.fill();
  }},
  { name:"hills", depth:110, draw:(ctx,W,H)=>{
    const horizon=H*0.60;
    ctx.fillStyle="#6a8468";
    ctx.beginPath(); ctx.moveTo(0,horizon);
    [[0,0.585],[0.25,0.555],[0.5,0.585],[0.75,0.555],[1,0.585]].forEach(([x,y])=>ctx.lineTo(x*W,y*H));
    ctx.lineTo(W,horizon); ctx.closePath(); ctx.fill();
  }},
  { name:"ground", depth:30, draw:(ctx,W,H)=>{
    const horizon=H*0.60;
    const gnd=ctx.createLinearGradient(0,horizon,0,H);
    gnd.addColorStop(0,"#5a7048"); gnd.addColorStop(1,"#33452a");
    ctx.fillStyle=gnd; ctx.fillRect(0,horizon,W,H-horizon);
    // road (perspective)
    const vpX=W*0.46;
    const rg=ctx.createLinearGradient(0,horizon,0,H);
    rg.addColorStop(0,"#5f6167"); rg.addColorStop(1,"#7a7c82");
    ctx.fillStyle=rg;
    ctx.beginPath(); ctx.moveTo(vpX-1,horizon); ctx.lineTo(vpX+1,horizon); ctx.lineTo(W*0.66,H); ctx.lineTo(W*0.30,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(238,236,222,0.75)"; ctx.lineWidth=Math.max(1,W*0.004); ctx.setLineDash([H*0.05,H*0.045]);
    ctx.beginPath(); ctx.moveTo(vpX,horizon); ctx.lineTo(W*0.48,H); ctx.stroke(); ctx.setLineDash([]);
  }},
  { name:"house", depth:20, draw:(ctx,W,H)=>{
    const horizon=H*0.60;
    // background trees (hazed)
    const bgTree=(x,y,s)=>{ ctx.fillStyle="#5a4326"; ctx.fillRect(x-s*0.14,y,s*0.28,s*1.3); ctx.fillStyle="#4a6a48"; ctx.beginPath();ctx.arc(x,y,s,0,7);ctx.fill(); };
    bgTree(W*0.665,horizon-H*0.016,H*0.022); bgTree(W*0.72,horizon-H*0.006,H*0.017); bgTree(W*0.90,horizon-H*0.018,H*0.03);
    const hx=W*0.055, hy=H*0.44, hw=W*0.155, hh=H*0.185;
    contactShadow(ctx,hx+hw*0.5,hy+hh,hw*0.62,H*0.014,0.22);
    // walls (subtle vertical shade)
    const wg=ctx.createLinearGradient(hx,0,hx+hw,0);
    wg.addColorStop(0,"#8a6144"); wg.addColorStop(1,"#6f4a31");
    ctx.fillStyle=wg; ctx.fillRect(hx,hy,hw,hh);
    ctx.fillStyle="#5e3a26"; ctx.beginPath(); ctx.moveTo(hx-hw*0.08,hy); ctx.lineTo(hx+hw*0.5,hy-hh*0.52); ctx.lineTo(hx+hw*1.08,hy); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#f2cf88"; ctx.fillRect(hx+hw*0.12,hy+hh*0.24,hw*0.2,hh*0.26); ctx.fillRect(hx+hw*0.68,hy+hh*0.24,hw*0.2,hh*0.26);
    ctx.fillStyle="#43301f"; ctx.fillRect(hx+hw*0.42,hy+hh*0.5,hw*0.16,hh*0.5);
  }},
  { name:"midtree", depth:8, draw:(ctx,W,H)=>{
    const mtX=W*0.26, mtY=H*0.65, mtR=H*0.078;
    contactShadow(ctx,mtX,mtY+mtR*1.7,mtR*0.9,H*0.016,0.24);
    ctx.fillStyle="#3a2917"; ctx.fillRect(mtX-mtR*0.11,mtY,mtR*0.22,mtR*1.8);
    ctx.fillStyle="#3f6a3c"; [[0,0],[-0.6,0.14],[0.6,0.18],[0,-0.52]].forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(mtX+dx*mtR,mtY+dy*mtR,mtR*0.72,0,7);ctx.fill();});
    ctx.fillStyle="rgba(255,240,200,0.10)"; ctx.beginPath();ctx.arc(mtX+mtR*0.3,mtY-mtR*0.3,mtR*0.55,0,7);ctx.fill(); // sun-side highlight
  }},
  { name:"subject", depth:5, draw:(ctx,W,H)=> drawFigure(ctx, W*0.55, H*0.82, H*0.28) },
  { name:"foreground", depth:1.8, draw:(ctx,W,H)=>{
    // near bush (bottom-left)
    ctx.fillStyle="#2c4a22"; [[0,0],[0.5,0.08],[-0.5,0.1],[0.25,-0.4]].forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(W*0.10+dx*W*0.07,H*0.98+dy*H*0.12,W*0.066,0,7);ctx.fill();});
    ctx.fillStyle="rgba(255,240,200,0.08)"; ctx.beginPath();ctx.arc(W*0.12,H*0.9,W*0.05,0,7);ctx.fill();
    // near fence post (bottom-right)
    contactShadow(ctx,W*0.875,H*1.0,W*0.03,H*0.012,0.25);
    ctx.fillStyle="#4f3d29"; ctx.fillRect(W*0.865,H*0.70,W*0.022,H*0.30);
    ctx.fillStyle="#5f4a32"; ctx.fillRect(W*0.842,H*0.74,W*0.068,H*0.022);
  }},
];

// Composite all layers → the flat shared scene (default image, Shot Types, …)
function drawScene(ctx, W, H){ SCENE_LAYERS.forEach(l=>l.draw(ctx,W,H)); }

function generateDefaultImageDataURL() {
  const c = document.createElement("canvas");
  c.width = 960; c.height = 540;
  drawScene(c.getContext("2d"), 960, 540);
  return c.toDataURL("image/jpeg",0.92);
}

// ─────────────────────────────────────────────
// Shared ImageUploader
// ─────────────────────────────────────────────
function ImageUploader({ userImage, onUpload }) {
  const ref = useRef();
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <button onClick={()=>ref.current.click()} style={styles.btnSecondary}>
        📁 {T.uploadBtn}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{
          const f=e.target.files[0];
          if(!f)return;
          const reader=new FileReader();
          reader.onload=ev=>onUpload(ev.target.result);
          reader.readAsDataURL(f);
        }}
      />
      {userImage && <span style={{color:"#9ca3af",fontSize:12}}>Custom image active</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Aspect Ratio
// ─────────────────────────────────────────────
const RATIOS = [
  { label:"1:1", w:1, h:1, note:"Instagram, social media" },
  { label:"4:3", w:4, h:3, note:"SD television, classic film" },
  { label:"16:9", w:16, h:9, note:"HD/UHD broadcast, YouTube" },
  { label:"1.85:1", w:1.85, h:1, note:"US widescreen theatrical" },
  { label:"2.39:1", w:2.39, h:1, note:"Anamorphic / CinemaScope" },
  { label:"2.76:1", w:2.76, h:1, note:"Ultra Panavision (Ben-Hur, Hateful Eight)" },
  { label:"9:16", w:9, h:16, note:"Vertical video, TikTok, Reels" },
  { label:"21:9", w:21, h:9, note:"Ultrawide monitor" },
];

function ModuleAspectRatio({ image }) {
  const [sel, setSel] = useState(2);
  const canvasRef = useRef();
  useEffect(()=>{
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current; if(!c)return;
      const r = RATIOS[sel];
      const maxW = Math.min(c.parentElement.clientWidth - 32, 900);
      const maxH = 460;
      let cw, ch;
      if(r.w/r.h > maxW/maxH){ cw=maxW; ch=maxW*r.h/r.w; }
      else{ ch=maxH; cw=maxH*r.w/r.h; }
      c.width=cw; c.height=ch;
      const ctx=c.getContext("2d");
      // letterbox fill
      ctx.fillStyle="#000"; ctx.fillRect(0,0,cw,ch);
      // cover-fit
      const ir=img.width/img.height;
      let sx,sy,sw,sh;
      if(ir>r.w/r.h){ sw=img.height*(r.w/r.h); sh=img.height; sx=(img.width-sw)/2; sy=0; }
      else{ sh=img.width/(r.w/r.h); sw=img.width; sy=(img.height-sh)/2; sx=0; }
      ctx.drawImage(img,sx,sy,sw,sh,0,0,cw,ch);
      // safe area guide
      ctx.strokeStyle="rgba(245,158,11,0.5)"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.strokeRect(cw*0.05,ch*0.05,cw*0.9,ch*0.9);
      ctx.setLineDash([]);
      // label
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(8,8,120,24);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 13px monospace";
      ctx.fillText(`${r.label}  ${Math.round(cw)}×${Math.round(ch)}`,14,24);
    };
    img.src = image;
  },[sel,image]);
  return (
    <div>
      <InfoBox>
        The <strong>aspect ratio</strong> defines the proportional relationship between width and height. It determines framing, composition, and the emotional "feel" of the image. Cinematographers choose ratios deliberately — 2.39:1 feels epic and immersive; 1:1 feels intimate. The dashed amber line shows the <strong>action safe area</strong> (5% inset), critical for broadcast delivery (EBU R 95).
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {RATIOS.map((r,i)=>(
          <button key={r.label} onClick={()=>setSel(i)}
            style={i===sel ? styles.btnActive : styles.btnChip}>
            {r.label}
          </button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 {RATIOS[sel].note}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Resolution
// ─────────────────────────────────────────────
const RESOLUTIONS = [
  { label:"SD 576p", w:720, h:576, std:"PAL / ITU-R BT.601", mp:0.41 },
  { label:"HD 720p", w:1280, h:720, std:"HD / ITU-R BT.709", mp:0.92 },
  { label:"FHD 1080p", w:1920, h:1080, std:"Full HD / ITU-R BT.709", mp:2.07 },
  { label:"2K DCI", w:2048, h:1080, std:"DCI / SMPTE 428", mp:2.21 },
  { label:"4K UHD", w:3840, h:2160, std:"UHDTV-1 / ITU-R BT.2020", mp:8.29 },
  { label:"4K DCI", w:4096, h:2160, std:"DCI 4K / SMPTE 428", mp:8.85 },
  { label:"8K UHD", w:7680, h:4320, std:"UHDTV-2 / ITU-R BT.2020", mp:33.18 },
];

function ModuleResolution({ image }) {
  const [sel, setSel] = useState(2);
  const canvasRef = useRef();
  const R = RESOLUTIONS[sel];
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      const maxW=Math.min(c.parentElement?.clientWidth-32||860,860);
      c.width=maxW; c.height=Math.round(maxW*9/16);
      const ctx=c.getContext("2d");
      // draw downscaled version to simulate resolution
      const tmp=document.createElement("canvas");
      const scaleDown=Math.min(R.w/img.width,R.h/img.height,1);
      tmp.width=Math.round(img.width*scaleDown||R.w);
      tmp.height=Math.round(img.height*scaleDown||R.h);
      tmp.getContext("2d").drawImage(img,0,0,tmp.width,tmp.height);
      // scale back up with pixelation
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(tmp,0,0,c.width,c.height);
      // pixel grid at low res
      if(sel<=1){
        ctx.strokeStyle="rgba(245,158,11,0.15)"; ctx.lineWidth=1;
        const px=c.width/tmp.width;
        for(let x=0;x<c.width;x+=px){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}
        for(let y=0;y<c.height;y+=Math.round(c.height/tmp.height)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke();}
      }
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,c.width,28);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
      ctx.fillText(`${R.w}×${R.h}  |  ${R.mp} MP  |  ${R.std}`,10,18);
    };
    img.src=image;
  },[sel,image]);
  return (
    <div>
      <InfoBox>
        <strong>Resolution</strong> is the total pixel count of the image matrix. It determines detail rendition, archival quality and delivery specification. <strong>Megapixels</strong> (MP) = W×H÷1,000,000. Note the difference between <em>UHD</em> (consumer, 3840×2160) and <em>DCI</em> (cinema, 4096×2160) — not the same standard. At SD you can see the pixel grid; at 4K+ individual pixels are imperceptible at normal viewing distances (ITU-R BT.2022 viewing conditions).
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {RESOLUTIONS.map((r,i)=>(
          <button key={r.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{r.label}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%",imageRendering:"pixelated"}}/>
      </div>
      <div style={{...styles.statRow,marginTop:12}}>
        <StatBadge label="Width" value={`${R.w} px`}/>
        <StatBadge label="Height" value={`${R.h} px`}/>
        <StatBadge label="Megapixels" value={`${R.mp} MP`}/>
        <StatBadge label="Standard" value={R.std}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Chroma Subsampling
// ─────────────────────────────────────────────
const SAMPLING = [
  { label:"4:4:4", yBlocks:1, cbBlocks:1, crBlocks:1, note:"Full color information per pixel. Cinema cameras, high-end broadcast, VFX. No chroma compression.", bandwidth:"3x" },
  { label:"4:2:2", yBlocks:1, cbBlocks:0.5, crBlocks:0.5, note:"Cb and Cr sampled every 2 pixels horizontally. Broadcast standard (SDI, HDCAM SR). EBU recommendation for production.", bandwidth:"2x" },
  { label:"4:2:0", yBlocks:1, cbBlocks:0.25, crBlocks:0.25, note:"Cb and Cr sampled every 2 pixels horizontally AND vertically. Consumer codecs: H.264/H.265, AVCHD, most camera recording formats.", bandwidth:"1.5x" },
  { label:"4:1:1", yBlocks:1, cbBlocks:0.25, crBlocks:0.25, note:"Cb and Cr sampled every 4 pixels horizontally. NTSC DV, DVCPRO. Horizontal color smearing on fine details.", bandwidth:"1.5x" },
];

function ChromaBlock({ scheme }) {
  const s=SAMPLING.find(x=>x.label===scheme)||SAMPLING[0];
  const cellSize=28;
  const cols=4, rows=2;
  return (
    <div style={{display:"flex",gap:24,flexWrap:"wrap",marginBottom:16}}>
      {["Y (Luma)","Cb (Blue-diff)","Cr (Red-diff)"].map((ch,ci)=>{
        const fill=ci===0?1:(ci===1?s.cbBlocks:s.crBlocks);
        const color=ci===0?"#e5e7eb":ci===1?"#60a5fa":"#f87171";
        return (
          <div key={ch}>
            <div style={{color:"#9ca3af",fontSize:11,marginBottom:4}}>{ch}</div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},${cellSize}px)`,gap:2}}>
              {Array.from({length:cols*rows}).map((_,i)=>{
                const col=i%cols, row=Math.floor(i/cols);
                // determine if this cell has data
                let hasData=false;
                if(ci===0) hasData=true;
                else if(scheme==="4:4:4") hasData=true;
                else if(scheme==="4:2:2") hasData=(col%2===0);
                else if(scheme==="4:2:0") hasData=(col%2===0&&row%2===0);
                else if(scheme==="4:1:1") hasData=(col%4===0);
                return (
                  <div key={i} style={{
                    width:cellSize,height:cellSize,borderRadius:3,
                    background:hasData?color:"#1f2937",
                    border:`1px solid ${hasData?color+"88":"#374151"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,color:"#000",fontWeight:"bold",
                  }}>{hasData?"●":""}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModuleChromaSubsampling({ image }) {
  const [sel, setSel] = useState(1);
  const S = SAMPLING[sel];
  const canvasRef = useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      const maxW=Math.min(c.parentElement?.clientWidth-32||780,780);
      c.width=maxW; c.height=Math.round(maxW*9/16);
      const ctx=c.getContext("2d");
      const tmp=document.createElement("canvas");
      tmp.width=c.width; tmp.height=c.height;
      tmp.getContext("2d").drawImage(img,0,0,c.width,c.height);
      const imageData=tmp.getContext("2d").getImageData(0,0,c.width,c.height);
      const d=imageData.data;
      // Convert to YCbCr, subsample, convert back
      const ySampled=[], cbSampled=[], crSampled=[];
      for(let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2];
        ySampled.push(0.2126*r+0.7152*g+0.0722*b);
        cbSampled.push(128-0.168736*r-0.331264*g+0.5*b);
        crSampled.push(128+0.5*r-0.418688*g-0.081312*b);
      }
      // Apply subsampling
      const W=c.width;
      for(let py=0;py<c.height;py++){
        for(let px=0;px<W;px++){
          const idx=(py*W+px)*4;
          const Y=ySampled[py*W+px];
          let cbSrc=px, crSrc=px, cbRow=py, crRow=py;
          if(sel>=1) cbSrc=Math.floor(px/2)*2;
          if(sel>=1) crSrc=Math.floor(px/2)*2;
          if(sel===2||sel===3) cbRow=Math.floor(py/2)*2;
          if(sel===2||sel===3) crRow=Math.floor(py/2)*2;
          if(sel===3) cbSrc=Math.floor(px/4)*4;
          if(sel===3) crSrc=Math.floor(px/4)*4;
          const cb=cbSampled[cbRow*W+cbSrc];
          const cr=crSampled[crRow*W+crSrc];
          const R=Math.max(0,Math.min(255,Y+1.5748*(cr-128)));
          const G=Math.max(0,Math.min(255,Y-0.1873*(cb-128)-0.4681*(cr-128)));
          const B=Math.max(0,Math.min(255,Y+1.8556*(cb-128)));
          d[idx]=R; d[idx+1]=G; d[idx+2]=B;
        }
      }
      ctx.putImageData(imageData,0,0);
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,c.width,26);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
      ctx.fillText(`Chroma Subsampling: ${S.label}  |  Bandwidth: ${S.bandwidth}`,10,17);
    };
    img.src=image;
  },[sel,image]);
  return (
    <div>
      <InfoBox>
        <strong>Chroma subsampling</strong> exploits the human visual system's lower acuity for color (chrominance) vs brightness (luminance). The notation <em>J:a:b</em> describes sample distribution across 2 rows of 4 pixels: J=luma samples, a=Cb samples row 1, b=Cb samples row 2. <strong>4:2:0</strong> is standard in H.264/H.265 and most camera codecs. <strong>4:2:2</strong> is the broadcast production standard. Green-screen and VFX always require <strong>4:4:4</strong>.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {SAMPLING.map((s,i)=>(
          <button key={s.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{s.label}</button>
        ))}
      </div>
      <ChromaBlock scheme={S.label}/>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%",marginBottom:12}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 {S.note}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Picture Profiles & LOG
// ─────────────────────────────────────────────
const LOG_CURVES = {
  "Linear":  x => x,
  "Rec.709": x => x < 0.018 ? x * 4.5 : 1.099 * Math.pow(x, 0.45) - 0.099,
  "S-Log2":  x => x <= 0 ? 0.030001222851889303 : 0.432699 * Math.log10(x / 0.01 + 1) + 0.616596 + 0.03,
  "S-Log3":  x => x < 0.01125 ? x * 5.26315 + 0.092864 : 0.2098553 * Math.log10((x + 0.01) / (0.18 + 0.01)) + 0.420810,
  "Log-C":   x => x > 0.010591 ? 0.247190 * Math.log10(5.555556 * x + 0.052272) + 0.385537 : x * 5.367655 + 0.092809,
  "V-Log":   x => x < 0.01 ? 5.6 * x + 0.125 : 0.241514 * Math.log10(x + 0.00873) + 0.598206,
  "C-Log3":  x => x < 0.000511 ? 5.48228 * x + 0.073059 : 0.332424 * Math.log10(2.3069 * x + 0.888282) + 0.573261,
};
const LOG_COLORS = {
  "Linear":"#9ca3af","Rec.709":"#60a5fa","S-Log2":"#f59e0b","S-Log3":"#fb923c",
  "Log-C":"#34d399","V-Log":"#a78bfa","C-Log3":"#f472b6",
};

function ModulePictureProfiles({ image }) {
  const [active, setActive] = useState(["Rec.709","S-Log2","Log-C"]);
  const [hoveredX, setHoveredX] = useState(null);
  const canvasRef = useRef();
  const graphRef = useRef();
  const W=320, H=240;

  const toggle = name => setActive(prev =>
    prev.includes(name) ? prev.filter(x=>x!==name) : [...prev,name]
  );

  useEffect(()=>{
    const gc=graphRef.current; if(!gc)return;
    gc.width=W; gc.height=H;
    const ctx=gc.getContext("2d");
    ctx.clearRect(0,0,W,H);
    // grid
    ctx.strokeStyle="#1f2937"; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const x=i*(W/4), y=i*(H/4);
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    }
    // diagonal reference
    ctx.strokeStyle="#374151"; ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(W,0);ctx.stroke();
    ctx.setLineDash([]);
    // axes labels
    ctx.fillStyle="#4b5563"; ctx.font="10px monospace";
    ctx.fillText("Input (scene light)",W/2-40,H-4);
    ctx.save();ctx.translate(10,H/2);ctx.rotate(-Math.PI/2);
    ctx.fillText("Output (code value)",0,0);ctx.restore();
    // hover line
    if(hoveredX!==null){
      ctx.strokeStyle="#f59e0b44"; ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(hoveredX*W,0);ctx.lineTo(hoveredX*W,H);ctx.stroke();
    }
    // curves
    Object.entries(LOG_CURVES).forEach(([name,fn])=>{
      if(!active.includes(name)) return;
      ctx.strokeStyle=LOG_COLORS[name]; ctx.lineWidth=2;
      ctx.beginPath();
      for(let i=0;i<=W;i++){
        const x=i/W;
        const y=Math.max(0,Math.min(1,fn(x)));
        const px=i, py=H-(y*H);
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.stroke();
    });
  },[active,hoveredX]);

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      c.width=c.parentElement?.clientWidth-32||300;
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      const tmp=document.createElement("canvas");
      tmp.width=c.width; tmp.height=c.height;
      tmp.getContext("2d").drawImage(img,0,0,c.width,c.height);
      const idata=tmp.getContext("2d").getImageData(0,0,c.width,c.height);
      const d=idata.data;
      // apply first active curve
      const curveName=active.find(n=>n!=="Rec.709")||active[0]||"Rec.709";
      const fn=LOG_CURVES[curveName]||LOG_CURVES["Rec.709"];
      const baseFn=LOG_CURVES["Rec.709"];
      for(let i=0;i<d.length;i+=4){
        for(let ch=0;ch<3;ch++){
          const linearVal=d[i+ch]/255;
          const linear=linearVal<0.081 ? linearVal/4.5 : Math.pow((linearVal+0.099)/1.099,1/0.45);
          const enc=Math.max(0,Math.min(1,fn(linear)));
          d[i+ch]=Math.round(enc*255);
        }
      }
      ctx.putImageData(idata,0,0);
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,c.width,26);
      ctx.fillStyle=LOG_COLORS[curveName]||"#f59e0b"; ctx.font="bold 12px monospace";
      ctx.fillText(`Preview: ${curveName}`,10,17);
    };
    img.src=image;
  },[active,image]);

  return (
    <div>
      <InfoBox>
        <strong>Picture profiles</strong> define how scene luminance is mapped to code values. <strong>LOG curves</strong> compress a wide dynamic range (up to 14+ stops) into the recording medium's tonal range, preserving highlight and shadow detail at the cost of a flat, desaturated look that requires <em>colour grading</em> in post. This is not a defect — it is intentional latitude capture. Each manufacturer defines their own LOG: Sony S-Log2/S-Log3, ARRI Log-C, Panasonic V-Log, Canon C-Log3. The graph shows the <strong>OETF (Opto-Electronic Transfer Function)</strong> per ITU-R BT.2100.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.keys(LOG_CURVES).map(name=>(
          <button key={name} onClick={()=>toggle(name)}
            style={{...styles.btnChip, ...(active.includes(name)?{borderColor:LOG_COLORS[name],color:LOG_COLORS[name],background:LOG_COLORS[name]+"22"}:{})}}>
            {name}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:8}}>
          <canvas ref={graphRef} style={{display:"block",cursor:"crosshair"}}
            onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setHoveredX((e.clientX-r.left)/r.width);}}
            onMouseLeave={()=>setHoveredX(null)}
          />
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
            {active.map(name=>(
              <span key={name} style={{fontSize:10,color:LOG_COLORS[name],fontFamily:"monospace"}}>■ {name}</span>
            ))}
          </div>
        </div>
        <div style={{background:"#111",borderRadius:8,padding:16,flex:1,minWidth:200}}>
          <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Color Spaces & Gamuts
// ─────────────────────────────────────────────
const GAMUTS = {
  "sRGB / Rec.709": { color:"#60a5fa", points:[[0.64,0.33],[0.30,0.60],[0.15,0.06]], note:"Standard for web, consumer displays, HD broadcast (ITU-R BT.709)" },
  "DCI-P3":         { color:"#34d399", points:[[0.68,0.32],[0.265,0.69],[0.15,0.06]], note:"Digital cinema projection (SMPTE ST 2087). ~25% wider than Rec.709" },
  "Rec.2020":       { color:"#f59e0b", points:[[0.708,0.292],[0.170,0.797],[0.131,0.046]], note:"UHDTV / HDR standard (ITU-R BT.2020). Covers ~75% of visible spectrum" },
  "ACES AP1":       { color:"#a78bfa", points:[[0.713,0.293],[0.165,0.830],[0.128,0.044]], note:"ACES working/grading space (ACEScct). Covers near-Rec.2020 gamut" },
  "ACES AP0":       { color:"#f472b6", points:[[0.7347,0.2653],[0.0000,1.0000],[0.0001,-0.0770]], note:"ACES scene-referred exchange space. Encompasses entire visible spectrum" },
};

function ModuleColorSpaces() {
  const [active, setActive] = useState(["sRGB / Rec.709","DCI-P3","Rec.2020"]);
  const canvasRef = useRef();
  const W=480, H=480;
  // Plot window with room for AP0 (green at y=1.0, blue at y=-0.077) and margins for labels
  const X0=-0.05, X1=0.80, Y0=-0.10, Y1=1.05;
  const ML=32, MB=26, MT=14, MR=14;

  const toggle=name=>setActive(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name]);

  // Real CIE 1931 spectral locus (2° observer), 380–700 nm every 5 nm → (x,y)
  const LOCUS = [
    [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0049],[0.1733,0.0048],
    [0.1730,0.0048],[0.1726,0.0048],[0.1721,0.0048],[0.1714,0.0051],[0.1703,0.0058],
    [0.1689,0.0069],[0.1669,0.0086],[0.1644,0.0109],[0.1611,0.0138],[0.1566,0.0177],
    [0.1510,0.0227],[0.1440,0.0297],[0.1355,0.0399],[0.1241,0.0578],[0.1096,0.0868],
    [0.0913,0.1327],[0.0687,0.2007],[0.0454,0.2950],[0.0235,0.4127],[0.0082,0.5384],
    [0.0039,0.6548],[0.0139,0.7502],[0.0389,0.8120],[0.0743,0.8338],[0.1142,0.8262],
    [0.1547,0.8059],[0.1929,0.7816],[0.2296,0.7543],[0.2658,0.7243],[0.3016,0.6923],
    [0.3373,0.6589],[0.3731,0.6245],[0.4087,0.5896],[0.4441,0.5547],[0.4788,0.5202],
    [0.5125,0.4866],[0.5448,0.4544],[0.5752,0.4242],[0.6029,0.3965],[0.6270,0.3725],
    [0.6482,0.3514],[0.6658,0.3340],[0.6801,0.3197],[0.6915,0.3083],[0.7006,0.2993],
    [0.7079,0.2920],[0.7140,0.2859],[0.7190,0.2809],[0.7230,0.2770],[0.7260,0.2740],
    [0.7283,0.2717],[0.7300,0.2700],[0.7311,0.2689],[0.7320,0.2680],[0.7327,0.2673],
    [0.7334,0.2666],[0.7340,0.2660],[0.7344,0.2656],[0.7346,0.2654],[0.7347,0.2653],
  ];

  const mapXY=(x,y)=>([
    Math.round(ML + ((x-X0)/(X1-X0))*(W-ML-MR)),
    Math.round(MT + (1-(y-Y0)/(Y1-Y0))*(H-MT-MB)),
  ]);

  // Chromaticity (x,y) → displayable sRGB (D65). Out-of-gamut clamped + normalised.
  const xyToRGB=(x,y)=>{
    if(y<=0) return null;
    const X=x/y, Y=1, Z=(1-x-y)/y;
    let r= 3.2406*X -1.5372*Y -0.4986*Z;
    let g=-0.9689*X +1.8758*Y +0.0415*Z;
    let b= 0.0557*X -0.2040*Y +1.0570*Z;
    r=Math.max(0,r); g=Math.max(0,g); b=Math.max(0,b);
    const m=Math.max(r,g,b); if(m>0){ r/=m; g/=m; b/=m; }
    const enc=v=> v<=0.0031308 ? 12.92*v : 1.055*Math.pow(v,1/2.4)-0.055;
    return [Math.round(enc(r)*255),Math.round(enc(g)*255),Math.round(enc(b)*255)];
  };

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=W; c.height=H;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
    const locusPath=()=>{ ctx.beginPath(); LOCUS.forEach(([x,y],i)=>{ const [px,py]=mapXY(x,y); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }); ctx.closePath(); };
    // Per-pixel true chromaticity fill, masked to the spectral locus
    const off=document.createElement("canvas"); off.width=W; off.height=H;
    const img=off.getContext("2d").createImageData(W,H); const dd=img.data;
    for(let py=0;py<H;py++){
      for(let px=0;px<W;px++){
        const x=X0+((px-ML)/(W-ML-MR))*(X1-X0);
        const y=Y0+(1-(py-MT)/(H-MT-MB))*(Y1-Y0);
        const rgb=xyToRGB(x,y);
        if(rgb){ const i=(py*W+px)*4; dd[i]=rgb[0]; dd[i+1]=rgb[1]; dd[i+2]=rgb[2]; dd[i+3]=255; }
      }
    }
    off.getContext("2d").putImageData(img,0,0);
    ctx.save(); locusPath(); ctx.clip(); ctx.drawImage(off,0,0); ctx.restore();
    // Locus outline + line of purples
    locusPath(); ctx.strokeStyle="rgba(255,255,255,0.45)"; ctx.lineWidth=1.2; ctx.stroke();
    // White point D65
    const [wpx,wpy]=mapXY(0.3127,0.3290);
    ctx.fillStyle="#000"; ctx.beginPath();ctx.arc(wpx,wpy,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath();ctx.arc(wpx,wpy,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e5e7eb"; ctx.font="10px monospace";ctx.fillText("D65",wpx+6,wpy+4);
    // Gamut triangles (outline over the true-colour field)
    Object.entries(GAMUTS).forEach(([name,{color,points}])=>{
      if(!active.includes(name)) return;
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.fillStyle=color+"14";
      ctx.beginPath();
      points.forEach(([x,y],i)=>{ const [px,py]=mapXY(x,y); i?ctx.lineTo(px,py):ctx.moveTo(px,py); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // primary corner dots
      points.forEach(([x,y])=>{ const [px,py]=mapXY(x,y); ctx.fillStyle=color; ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill(); });
      const cx=points.reduce((s,[x])=>s+x,0)/3, cy=points.reduce((s,[,y])=>s+y,0)/3;
      const [lx,ly]=mapXY(cx,cy);
      ctx.fillStyle=color; ctx.font="bold 10px monospace";
      ctx.fillText(name.split(" ")[0],lx-14,ly);
    });
    // axes
    ctx.fillStyle="#6b7280"; ctx.font="10px monospace";
    ctx.fillText("x",W-12,H-4); ctx.fillText("y",4,12);
    ctx.fillStyle="#4b5563";
    for(let v=0;v<=0.8001;v+=0.2){ const [px]=mapXY(v,0); ctx.fillText(v.toFixed(1),px-8,H-4); }
    for(let v=0;v<=1.0001;v+=0.2){ const [,py]=mapXY(0,v); ctx.fillText(v.toFixed(1),4,py+4); }
  },[active]);

  return (
    <div>
      <InfoBox>
        The <strong>CIE 1931 chromaticity diagram</strong> maps all visible colours as (x,y) coordinates. Colour spaces are defined as triangular <strong>gamuts</strong> within this diagram — the larger the triangle, the more colours it can represent. <strong>sRGB/Rec.709</strong> covers standard screens. <strong>DCI-P3</strong> covers cinema projection. <strong>Rec.2020</strong> is the HDR broadcast target. <strong>ACES AP0</strong> encompasses the entire visible spectrum — the scene-referred exchange space in the ACES pipeline (SMPTE ST 2065-1). All rendering in post-production is a mapping from a wider gamut into the delivery target.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.entries(GAMUTS).map(([name,{color}])=>(
          <button key={name} onClick={()=>toggle(name)}
            style={{...styles.btnChip,...(active.includes(name)?{borderColor:color,color:color,background:color+"22"}:{})}}>
            {name}
          </button>
        ))}
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12,display:"inline-block"}}>
        <canvas ref={canvasRef} style={{display:"block"}}/>
      </div>
      {active.length>0 && (
        <div style={{marginTop:12}}>
          {active.map(name=>(
            <p key={name} style={{...styles.noteText,color:GAMUTS[name].color}}>
              ■ <strong>{name}:</strong> {GAMUTS[name].note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Rolling Shutter
// ─────────────────────────────────────────────
function ModuleRollingShutter() {
  const [speed, setSpeed] = useState(5);
  const [running, setRunning] = useState(true);
  const canvasRef = useRef();
  const animRef = useRef();
  const posRef = useRef(0);

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=480; c.height=270;
    const ctx=c.getContext("2d");
    const readoutTime=0.4; // fraction of frame time for global readout
    let frame=0;
    const draw=()=>{
      if(!running){animRef.current=requestAnimationFrame(draw);return;}
      frame++;
      ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,480,270);
      // Draw stripes (static scene)
      for(let y=0;y<270;y+=30){
        ctx.fillStyle=y%60===0?"#1f2937":"#111827";
        ctx.fillRect(0,y,480,30);
      }
      // Moving object (vertical bar going right)
      const objX=(posRef.current*3)%480;
      posRef.current+=speed;
      const skewPx=speed*readoutTime*8; // skew proportional to speed and readout time
      // Draw with skew
      ctx.fillStyle="#f59e0b";
      ctx.beginPath();
      ctx.moveTo(objX-20+skewPx, 0);
      ctx.lineTo(objX+20+skewPx, 0);
      ctx.lineTo(objX+20-skewPx, 270);
      ctx.lineTo(objX-20-skewPx, 270);
      ctx.closePath(); ctx.fill();
      // Scan line indicator
      const scanY=(frame*4)%270;
      ctx.strokeStyle="rgba(96,165,250,0.4)"; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,scanY);ctx.lineTo(480,scanY);ctx.stroke();
      // Labels
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,480,22);
      ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
      ctx.fillText(`Object speed: ${speed}  |  Skew: ${(skewPx).toFixed(0)}px  |  Blue line = sensor readout row`,8,14);
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[speed,running]);

  return (
    <div>
      <InfoBox>
        <strong>Rolling shutter</strong> (also called <em>focal plane shutter artifact</em>) occurs in CMOS sensors that read lines sequentially from top to bottom, not all at once (unlike global shutter). Fast-moving objects or camera pans are captured at different time instants per row, creating <strong>skew</strong> (vertical objects lean), <strong>wobble</strong> (jello effect on vibration) and <strong>partial exposure</strong> during flash. Mitigation: faster readout speeds (modern sensors), global shutter mode, slower panning technique. SMPTE has no specific standard for this artifact — it is a sensor architecture characteristic.
      </InfoBox>
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <label style={styles.label}>
          Object speed: <strong style={{color:"#f59e0b"}}>{speed}</strong>
          <input type="range" min={1} max={20} value={speed} onChange={e=>setSpeed(+e.target.value)} style={styles.slider}/>
        </label>
        <button onClick={()=>setRunning(r=>!r)} style={styles.btnSecondary}>
          {running?"⏸ Pause":"▶ Play"}
        </button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 At high speeds, the yellow bar visibly leans (skews) due to the sequential line readout. This is rolling shutter. Blue line shows the sensor's current read row.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Moiré & Aliasing
// ─────────────────────────────────────────────
function ModuleMoire() {
  const [freq1, setFreq1] = useState(12);
  const [freq2, setFreq2] = useState(14);
  const [showAA, setShowAA] = useState(false);
  const canvasRef = useRef();

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=480; c.height=300;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,480,300);
    // Generate moiré
    const idata=ctx.getImageData(0,0,480,300);
    const d=idata.data;
    for(let y=0;y<300;y++){
      for(let x=0;x<480;x++){
        const pattern1=Math.sin(x*freq1*0.08)*Math.sin(y*freq1*0.08)>0?255:0;
        const pattern2=Math.sin(x*freq2*0.08+0.3)*Math.sin(y*freq2*0.08-0.3)>0?255:0;
        const combined=(pattern1+pattern2)/2;
        let val=combined;
        if(showAA){
          // Simple blur simulation
          val=Math.round(combined*0.6+128*0.4);
        }
        const idx=(y*480+x)*4;
        d[idx]=val; d[idx+1]=val; d[idx+2]=val; d[idx+3]=255;
      }
    }
    ctx.putImageData(idata,0,0);
    ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,480,22);
    ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
    ctx.fillText(`Grid A: ${freq1} | Grid B: ${freq2} | AA filter: ${showAA?"ON":"OFF"}`,8,14);
  },[freq1,freq2,showAA]);

  return (
    <div>
      <InfoBox>
        <strong>Moiré</strong> is an interference pattern that appears when two regular grids of similar—but not identical—frequencies overlap. In camera sensors, it occurs when fine repetitive detail in the scene (fabric weave, brick patterns, window blinds) approaches the <strong>Nyquist frequency</strong> (half the sensor's pixel pitch). The sensor cannot resolve the pattern unambiguously and produces false-colour banding. Solution: <strong>optical low-pass filter (OLPF)</strong> or careful focal length/distance choice. <strong>Aliasing</strong> is the more general term for any sampling artifact. The <em>Shannon–Nyquist theorem</em> requires sampling at ≥2× the highest frequency present.
      </InfoBox>
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <label style={styles.label}>Grid A freq: <strong style={{color:"#f59e0b"}}>{freq1}</strong>
          <input type="range" min={2} max={30} value={freq1} onChange={e=>setFreq1(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>Grid B freq: <strong style={{color:"#f59e0b"}}>{freq2}</strong>
          <input type="range" min={2} max={30} value={freq2} onChange={e=>setFreq2(+e.target.value)} style={styles.slider}/>
        </label>
        <button onClick={()=>setShowAA(a=>!a)}
          style={{...styles.btnSecondary,...(showAA?{borderColor:"#34d399",color:"#34d399"}:{})}}>
          {showAA?"AA Filter: ON":"AA Filter: OFF"}
        </button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 Move Grid A and B to similar values to see moiré intensify. Enable AA to see how filtering reduces the artifact (at the cost of some sharpness).</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Banding & Bit Depth
// ─────────────────────────────────────────────
function ModuleBanding() {
  const [bits, setBits] = useState(10);
  const [tint, setTint] = useState("sky");
  const canvasRef = useRef();
  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    const W=Math.min(c.parentElement?.clientWidth-32||840,840);
    c.width=W; c.height=Math.round(W*0.42);
    const ctx=c.getContext("2d");
    const gradH=c.height-30;
    const steps=Math.pow(2,bits);
    // Endpoints per tint — full 0..1 luminance range so quantization steps stay visible
    const ramps={
      gray:[[16,16,20],[240,240,245]],
      sky :[[12,22,46],[150,180,225]],
      skin:[[40,20,16],[240,205,180]],
    };
    const [a,b]=ramps[tint]||ramps.sky;
    for(let x=0;x<W;x++){
      const t=x/(W-1);
      const q=Math.round(t*(steps-1))/(steps-1); // quantize to the chosen bit depth
      const r=Math.round(a[0]+(b[0]-a[0])*q);
      const g=Math.round(a[1]+(b[1]-a[1])*q);
      const bl=Math.round(a[2]+(b[2]-a[2])*q);
      ctx.fillStyle=`rgb(${r},${g},${bl})`;
      ctx.fillRect(x,0,1,gradH);
    }
    ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,gradH,W,30);
    ctx.fillStyle="#9ca3af"; ctx.font="12px monospace";
    ctx.fillText(`${bits}-bit  ·  ${steps.toLocaleString()} tonal steps  ·  ${bits<=7?"posterization visible":bits<=9?"subtle steps":"smooth"}`,10,gradH+20);
  },[bits,tint]);
  return (
    <div>
      <InfoBox>
        <strong>Bit depth</strong> defines the number of discrete tonal steps per channel: <em>2ⁿ steps</em>. At <strong>8-bit</strong> (256 steps), smooth gradients — especially in skies or skin — show <strong>banding</strong> (posterization): visible tonal jumps. At <strong>10-bit</strong> (1024 steps) the jumps are ~4× smaller and visually imperceptible in most content. <strong>12-bit</strong> (4096) and <strong>16-bit</strong> (65,536) are common in RAW and high-end cinema workflows. H.265 Main 10 Profile and ProRes 4444 support 10-bit. H.264 is natively 8-bit. Banding is also exacerbated by heavy colour grading on 8-bit footage.
      </InfoBox>
      <div style={{marginBottom:12}}>
        <label style={styles.label}>
          Bit depth: <strong style={{color:"#f59e0b"}}>{bits}-bit ({Math.pow(2,bits)} steps)</strong>
          <input type="range" min={2} max={16} value={bits} onChange={e=>setBits(+e.target.value)} style={styles.slider}/>
        </label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          {[2,4,6,8,10,12,14,16].map(b=>(
            <button key={b} onClick={()=>setBits(b)} style={b===bits?styles.btnActive:styles.btnChip}>{b}-bit</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10,alignItems:"center"}}>
          <span style={{color:"#6b7280",fontSize:11,fontFamily:"monospace"}}>Gradient:</span>
          {[["gray","Gray"],["sky","Sky"],["skin","Skin"]].map(([k,lbl])=>(
            <button key={k} onClick={()=>setTint(k)} style={k===tint?styles.btnActive:styles.btnChip}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Noise & ISO
// ─────────────────────────────────────────────
function ModuleNoise({ image }) {
  const [iso, setIso] = useState(3);
  const [showChroma, setShowChroma] = useState(true);
  const canvasRef = useRef();
  const isoValues = [100,200,400,800,1600,3200,6400,12800,25600];
  const isoVal = isoValues[iso];
  const noiseAmount = iso/isoValues.length;

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      c.width=Math.min(c.parentElement?.clientWidth-32||840,840);
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,c.width,c.height);
      const idata=ctx.getImageData(0,0,c.width,c.height);
      const d=idata.data;
      const luma_noise=noiseAmount*80;
      const chroma_noise=showChroma?noiseAmount*120:0;
      for(let i=0;i<d.length;i+=4){
        const ln=(Math.random()-0.5)*luma_noise*2;
        const cn_rg=showChroma?(Math.random()-0.5)*chroma_noise:0;
        const cn_bg=showChroma?(Math.random()-0.5)*chroma_noise:0;
        d[i]=Math.max(0,Math.min(255,d[i]+ln+cn_rg));
        d[i+1]=Math.max(0,Math.min(255,d[i+1]+ln-cn_rg*0.5));
        d[i+2]=Math.max(0,Math.min(255,d[i+2]+ln+cn_bg));
      }
      ctx.putImageData(idata,0,0);
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,c.width,22);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
      ctx.fillText(`ISO ${isoVal}  |  ${showChroma?"Luma + Chroma noise":"Luma noise only"}`,10,15);
    };
    img.src=image;
  },[iso,showChroma,image]);

  return (
    <div>
      <InfoBox>
        <strong>ISO</strong> (SMPTE S-2008-100-2) is the sensor gain index. Increasing ISO amplifies the photosensitive signal — and with it, the <strong>noise</strong> (photon shot noise + electronic thermal noise). <strong>Luminance noise</strong> appears as random brightness variation — visually similar to film grain, often acceptable. <strong>Chroma noise</strong> is random colour variation — green/magenta/red speckles — visually unpleasant and hard to grade. At high ISOs, chroma noise dominates. Noise reduction in post (DaVinci Resolve NR, DFT Neat Video) separates and processes these independently. <em>Native ISO</em> is the sensor's base sensitivity where the signal-to-noise ratio is optimal — typically ISO 800 or 3200 in modern cinema sensors.
      </InfoBox>
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <label style={styles.label}>
          ISO: <strong style={{color:"#f59e0b"}}>{isoVal}</strong>
          <input type="range" min={0} max={8} value={iso} onChange={e=>setIso(+e.target.value)} style={styles.slider}/>
        </label>
        <button onClick={()=>setShowChroma(c=>!c)}
          style={{...styles.btnSecondary,...(showChroma?{borderColor:"#f472b6",color:"#f472b6"}:{})}}>
          Chroma noise: {showChroma?"ON":"OFF"}
        </button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Shot Types
// Framings anchored to the shared scene's subject (cx,cy centre + s = size,
// both normalised; scene is 16:9 so a square-in-normalised crop is 16:9).
// ─────────────────────────────────────────────
const SHOTS = [
  { label:"ECU", name:"Extreme Close-Up", cx:0.55, cy:0.572, s:0.055, note:"Extreme detail: eye, mouth, hand. Maximum emotional intensity. Ingmar Bergman, Sergio Leone." },
  { label:"BCU", name:"Big Close-Up", cx:0.55, cy:0.585, s:0.10, note:"Face fills frame, chin may be cut. Used in drama for emotional revelation." },
  { label:"CU", name:"Close-Up", cx:0.55, cy:0.605, s:0.16, note:"Head and shoulders. Standard interview framing. Establishes emotional connection." },
  { label:"MCU", name:"Medium Close-Up", cx:0.55, cy:0.635, s:0.235, note:"Chest up. American TV standard. Conversational intimacy without losing context." },
  { label:"MS", name:"Medium Shot", cx:0.55, cy:0.66, s:0.33, note:"Waist up. Allows gesture and body language. Most common in dialogue scenes." },
  { label:"MLS", name:"Medium Long Shot", cx:0.548, cy:0.685, s:0.45, note:"Knees up. Character + immediate environment. Natural, everyday framing." },
  { label:"LS", name:"Long Shot", cx:0.545, cy:0.66, s:0.62, note:"Full body with context. Shows character in space. Establishes spatial relationships." },
  { label:"VLS", name:"Very Long Shot", cx:0.53, cy:0.60, s:0.82, note:"Character recognisable but environment dominant. Scale and isolation." },
  { label:"EWS", name:"Extreme Wide Shot", cx:0.50, cy:0.50, s:1.00, note:"Establishing shot. Tiny figure in vast landscape. Pure environment statement." },
];

function ModuleShotTypes() {
  const [sel, setSel] = useState(4);
  const sceneRef = useRef();
  const frameRef = useRef();
  const resultRef = useRef();
  const S = SHOTS[sel];

  useEffect(()=>{
    if(!sceneRef.current){
      const s=document.createElement("canvas"); s.width=960; s.height=540;
      drawScene(s.getContext("2d"),960,540); sceneRef.current=s;
    }
    const scene=sceneRef.current;
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const half=S.s/2;
    const cx=clamp(S.cx,half,1-half), cy=clamp(S.cy,half,1-half);
    const crop={x:cx-half,y:cy-half,w:S.s,h:S.s};

    // LEFT — full scene with the frame marked
    const fc=frameRef.current;
    if(fc){
      const FW=Math.min(fc.parentElement?.clientWidth-24||640,760);
      fc.width=FW; fc.height=Math.round(FW*9/16);
      const fx=fc.getContext("2d");
      fx.drawImage(scene,0,0,fc.width,fc.height);
      const rx=crop.x*fc.width, ry=crop.y*fc.height, rw=crop.w*fc.width, rh=crop.h*fc.height;
      fx.fillStyle="rgba(6,6,9,0.6)";
      fx.fillRect(0,0,fc.width,ry);
      fx.fillRect(0,ry+rh,fc.width,fc.height-(ry+rh));
      fx.fillRect(0,ry,rx,rh);
      fx.fillRect(rx+rw,ry,fc.width-(rx+rw),rh);
      fx.strokeStyle="#f59e0b"; fx.lineWidth=2; fx.strokeRect(rx,ry,rw,rh);
      fx.fillStyle="rgba(0,0,0,0.7)"; fx.fillRect(0,0,fc.width,26);
      fx.fillStyle="#f59e0b"; fx.font="bold 13px monospace";
      fx.fillText(`${S.label} — ${S.name}`,10,18);
    }
    // RIGHT — the resulting frame
    const rc=resultRef.current;
    if(rc){
      const RW=Math.min(rc.parentElement?.clientWidth-24||340,380);
      rc.width=RW; rc.height=Math.round(RW*9/16);
      const rx=rc.getContext("2d");
      rx.drawImage(scene, crop.x*scene.width, crop.y*scene.height, crop.w*scene.width, crop.h*scene.height, 0,0,rc.width,rc.height);
      rx.strokeStyle="#1f2937"; rx.lineWidth=1; rx.strokeRect(0.5,0.5,rc.width-1,rc.height-1);
    }
  },[sel]);

  return (
    <div>
      <InfoBox>
        Shot types define the <strong>field of view</strong> and the <strong>psychological distance</strong> between the camera and the subject — the basic vocabulary of visual language, not mere technical decisions but <em>narrative choices</em>. Here the amber frame on the left shows what each shot captures of the <strong>same staged scene</strong>; the right panel is the resulting image. Note how tighter shots isolate the subject emotionally while wider shots emphasise environment and scale. In multicamera production the director assigns shot types per camera in the rundown to ensure coverage variety and editorial rhythm.
      </InfoBox>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {SHOTS.map((s,i)=>(
          <button key={s.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{s.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 380px",minWidth:260,background:"#111",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>FRAMING ON SCENE</div>
          <canvas ref={frameRef} style={{display:"block",width:"100%"}}/>
        </div>
        <div style={{flex:"0 1 auto",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:"#a78bfa",fontSize:10,fontFamily:"monospace",marginBottom:6,letterSpacing:"0.08em"}}>RESULTING SHOT</div>
          <canvas ref={resultRef} style={{display:"block",maxWidth:"100%"}}/>
        </div>
      </div>
      <p style={styles.noteText}>📌 {S.note}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: ACES Pipeline (static diagram)
// ─────────────────────────────────────────────
function ModuleACES() {
  const nodes = [
    { id:"scene", label:"Scene", sub:"Real world light", x:10, y:50, color:"#60a5fa" },
    { id:"idt", label:"IDT", sub:"Input Device Transform", x:22, y:50, color:"#a78bfa" },
    { id:"ap0", label:"ACES AP0", sub:"Scene-referred\nExchange space\nSMPTE ST 2065-1", x:38, y:50, color:"#f472b6" },
    { id:"rrt", label:"RRT", sub:"Reference Rendering\nTransform", x:55, y:50, color:"#f59e0b" },
    { id:"odt", label:"ODT", sub:"Output Device Transform\n(P3-D60, Rec.709,\nRec.2020-ST2084…)", x:72, y:50, color:"#34d399" },
    { id:"display", label:"Display", sub:"Output-referred\nimage", x:87, y:50, color:"#60a5fa" },
  ];
  const [hovered, setHovered] = useState(null);
  const descriptions = {
    scene:"The physical light captured by the camera sensor — photons hitting the photosites.",
    idt:"The IDT (Input Device Transform) converts camera-native, manufacturer-specific data (e.g. Sony S-Gamut3/S-Log3) into the ACES AP0 scene-referred space. One IDT per camera model.",
    ap0:"ACES AP0 is the master exchange space. It encompasses the entire visible spectrum (and beyond). All scene data lives here as scene-linear light. SMPTE ST 2065-1.",
    rrt:"The RRT (Reference Rendering Transform) is a fixed, standardised tone mapping from scene-linear to a perceptually optimal display-referred image. Think of it as the 'look' of ACES — applied identically everywhere.",
    odt:"The ODT (Output Device Transform) adapts the RRT output to a specific display — P3-DCI for cinema projector, Rec.709 for TV monitor, Rec.2020-ST2084 for HDR TV. One ODT per delivery target.",
    display:"The final display-referred output: what the audience sees on their specific device.",
  };
  return (
    <div>
      <InfoBox>
        <strong>ACES</strong> (Academy Color Encoding System, SMPTE ST 2065) is the industry-standard colour management and interchange framework, developed by the Academy of Motion Picture Arts and Sciences. It solves the problem of consistent colour across cameras, displays, and delivery formats. The pipeline is: Camera → <strong>IDT</strong> → <strong>AP0</strong> (scene-linear) → <strong>RRT</strong> (tone map) → <strong>ODT</strong> → Display. The creative grade (CDL, LUTs) lives between AP0 and RRT, in <strong>ACEScct</strong> or <strong>ACEScc</strong> (log-like working spaces). Supported natively in DaVinci Resolve, Nuke, SCRATCH, and most modern NLEs.
      </InfoBox>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:20,overflowX:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:0,minWidth:600}}>
          {nodes.map((node,i)=>(
            <div key={node.id} style={{display:"flex",alignItems:"center",flex:1}}>
              <div
                onMouseEnter={()=>setHovered(node.id)}
                onMouseLeave={()=>setHovered(null)}
                style={{
                  background:hovered===node.id?node.color+"22":"#111827",
                  border:`2px solid ${node.color}`,
                  borderRadius:8, padding:"10px 8px", textAlign:"center",
                  cursor:"pointer", transition:"all 0.2s", flex:1,
                  boxShadow:hovered===node.id?`0 0 16px ${node.color}44`:"none",
                }}>
                <div style={{color:node.color,fontWeight:"bold",fontSize:12,fontFamily:"monospace"}}>{node.label}</div>
                <div style={{color:"#9ca3af",fontSize:9,marginTop:3,whiteSpace:"pre-line",lineHeight:1.3}}>{node.sub}</div>
              </div>
              {i<nodes.length-1 && (
                <div style={{color:"#374151",fontSize:18,margin:"0 4px",flexShrink:0}}>→</div>
              )}
            </div>
          ))}
        </div>
        {hovered && (
          <div style={{marginTop:16,background:"#111",border:"1px solid #1f2937",borderRadius:6,padding:12}}>
            <p style={{color:"#e5e7eb",fontSize:13,margin:0}}>{descriptions[hovered]}</p>
          </div>
        )}
      </div>
      <div style={{marginTop:16,display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
          {label:"Working spaces",val:"ACEScct / ACEScc (log-like, used for grading)"},
          {label:"Exchange",val:"ACES AP0 (scene-linear, SMPTE ST 2065-1)"},
          {label:"Grading gamut",val:"ACES AP1 (slightly smaller, more practical)"},
        ].map(({label,val})=>(
          <div key={label} style={{background:"#111",border:"1px solid #1f2937",borderRadius:6,padding:"8px 12px",flex:1,minWidth:160}}>
            <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace"}}>{label}</div>
            <div style={{color:"#e5e7eb",fontSize:12,marginTop:2}}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Depth of Field
// ─────────────────────────────────────────────
function ModuleDepthOfField() {
  const [fstop, setFstop] = useState(2.8);
  const [focal, setFocal] = useState(50);
  const [distance, setDistance] = useState(3);
  const canvasRef = useRef();

  // Simplified DoF calculation (thin lens, circle of confusion 0.03mm for 35mm equiv)
  const CoC = 0.03;
  const focalMm = focal;
  const distanceMm = distance * 1000;
  const N = fstop;
  const Dn = (distanceMm * (distanceMm - focalMm)) / (distanceMm - focalMm + N * CoC * distanceMm / focalMm);
  const Df = (distanceMm * (distanceMm - focalMm)) / (distanceMm - focalMm - N * CoC * distanceMm / focalMm);
  const dof = Math.max(0, (isFinite(Df)?Df:99999) - Dn);
  const dofM = dof / 1000;

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=480; c.height=200;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,480,200);
    // Scene depth representation
    const sceneDepth=10; // meters
    const focusX=(distance/sceneDepth)*440+20;
    const nearX=Math.max(20,(Dn/1000/sceneDepth)*440+20);
    const farX=Math.min(460,(Math.min(isFinite(Df)?Df/1000:100,sceneDepth)/sceneDepth)*440+20);
    // Blur zones
    const bgrad=ctx.createLinearGradient(20,0,460,0);
    bgrad.addColorStop(0,"rgba(96,165,250,0.3)");
    bgrad.addColorStop(nearX/480,"rgba(96,165,250,0.05)");
    bgrad.addColorStop(farX/480,"rgba(96,165,250,0.05)");
    bgrad.addColorStop(1,"rgba(96,165,250,0.3)");
    ctx.fillStyle=bgrad; ctx.fillRect(20,40,440,120);
    // Sharp zone
    ctx.fillStyle="rgba(52,211,153,0.15)";
    ctx.fillRect(nearX,40,farX-nearX,120);
    // Focus marker
    ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(focusX,30);ctx.lineTo(focusX,170);ctx.stroke();
    ctx.fillStyle="#f59e0b"; ctx.font="10px monospace";
    ctx.fillText(`Focus: ${distance}m`,focusX-20,22);
    // DoF zone markers
    if(nearX>20){
      ctx.strokeStyle="#34d399"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(nearX,40);ctx.lineTo(nearX,170);ctx.stroke();
    }
    if(farX<460){
      ctx.strokeStyle="#34d399";
      ctx.beginPath();ctx.moveTo(farX,40);ctx.lineTo(farX,170);ctx.stroke();
    }
    ctx.setLineDash([]);
    // Bokeh circles (out of focus areas)
    for(let x=20;x<nearX-10;x+=15){
      const blur=((nearX-x)/(nearX-20))*12*N;
      ctx.strokeStyle=`rgba(245,158,11,${Math.min(0.6,blur/20)})`;
      ctx.lineWidth=Math.max(1,blur*0.3);
      ctx.beginPath();ctx.arc(x+Math.random()*5,100+Math.random()*30-15,blur*0.5,0,Math.PI*2);ctx.stroke();
    }
    // Axis
    ctx.strokeStyle="#374151"; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(20,170);ctx.lineTo(460,170);ctx.stroke();
    for(let m=0;m<=sceneDepth;m+=2){
      const x=(m/sceneDepth)*440+20;
      ctx.fillStyle="#4b5563"; ctx.font="9px monospace";
      ctx.fillText(`${m}m`,x-6,185);
      ctx.strokeStyle="#1f2937";
      ctx.beginPath();ctx.moveTo(x,166);ctx.lineTo(x,172);ctx.stroke();
    }
    // Legend
    ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.fillRect(0,0,480,22);
    ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
    ctx.fillText(`f/${fstop}  ${focal}mm  @${distance}m  |  DoF: ${dofM>50?"∞":dofM.toFixed(2)+"m"}  |  Near: ${(Dn/1000).toFixed(2)}m  Far: ${isFinite(Df)&&Df/1000<50?(Df/1000).toFixed(2)+"m":"∞"}`,8,14);
  },[fstop,focal,distance]);

  return (
    <div>
      <InfoBox>
        <strong>Depth of Field (DoF)</strong> is the range of distances within which subjects appear acceptably sharp. It is determined by: <em>aperture</em> (smaller f-stop = wider aperture = shallower DoF), <em>focal length</em> (longer lens = shallower DoF), and <em>subject distance</em> (closer subject = shallower DoF). The mathematical model uses the <strong>Circle of Confusion (CoC)</strong> — the maximum acceptable blur circle diameter for the sensor/film format (typically 0.03mm for 35mm). Beyond the <em>hyperfocal distance</em>, everything from half that distance to infinity is sharp. Shallow DoF is a primary tool for subject isolation; deep DoF places everything in context.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:12}}>
        <label style={styles.label}>
          Aperture: <strong style={{color:"#f59e0b"}}>f/{fstop}</strong>
          <input type="range" min={1.0} max={22} step={0.1} value={fstop} onChange={e=>setFstop(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>
          Focal length: <strong style={{color:"#f59e0b"}}>{focal}mm</strong>
          <input type="range" min={10} max={300} step={5} value={focal} onChange={e=>setFocal(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>
          Focus distance: <strong style={{color:"#f59e0b"}}>{distance}m</strong>
          <input type="range" min={0.5} max={10} step={0.1} value={distance} onChange={e=>setDistance(+e.target.value)} style={styles.slider}/>
        </label>
      </div>
      <div style={{...styles.statRow,marginBottom:12}}>
        <StatBadge label="DoF" value={dofM>50?"∞":dofM.toFixed(2)+"m"}/>
        <StatBadge label="Near limit" value={(Dn/1000).toFixed(2)+"m"}/>
        <StatBadge label="Far limit" value={isFinite(Df)&&Df/1000<50?(Df/1000).toFixed(2)+"m":"∞"}/>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Vignetting
// ─────────────────────────────────────────────
function ModuleVignetting({ image }) {
  const [amount, setAmount] = useState(0.5);
  const [feather, setFeather] = useState(0.6);
  const canvasRef = useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      c.width=Math.min(c.parentElement?.clientWidth-32||840,840);
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,c.width,c.height);
      if(amount>0){
        const cx=c.width/2, cy=c.height/2;
        const r=Math.sqrt(cx*cx+cy*cy);
        const grad=ctx.createRadialGradient(cx,cy,r*feather,cx,cy,r);
        grad.addColorStop(0,"rgba(0,0,0,0)");
        grad.addColorStop(1,`rgba(0,0,0,${amount})`);
        ctx.fillStyle=grad; ctx.fillRect(0,0,c.width,c.height);
      }
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,c.width,22);
      ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
      ctx.fillText(`Vignetting: ${Math.round(amount*100)}%  |  Feather: ${Math.round(feather*100)}%`,8,14);
    };
    img.src=image;
  },[amount,feather,image]);
  return (
    <div>
      <InfoBox>
        <strong>Vignetting</strong> is light falloff towards the edges and corners of the frame. It has three causes: <em>optical vignetting</em> (lens barrel physically blocks oblique rays at wide apertures — disappears on stopping down), <em>mechanical vignetting</em> (filter holders, matte boxes), and <em>natural vignetting</em> (cos⁴θ law — inherent in all imaging systems, also called pixel vignetting in digital sensors). In cinematography, artificial vignetting is deliberately added in post as a compositional tool to draw focus toward the centre. Corrected in-camera via lens correction profiles, or in post via DaVinci Resolve lens correction.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:12}}>
        <label style={styles.label}>
          Amount: <strong style={{color:"#f59e0b"}}>{Math.round(amount*100)}%</strong>
          <input type="range" min={0} max={1} step={0.01} value={amount} onChange={e=>setAmount(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>
          Feather: <strong style={{color:"#f59e0b"}}>{Math.round(feather*100)}%</strong>
          <input type="range" min={0} max={0.99} step={0.01} value={feather} onChange={e=>setFeather(+e.target.value)} style={styles.slider}/>
        </label>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Chromatic Aberration
// ─────────────────────────────────────────────
function ModuleChromaticAberration({ image }) {
  const [amount, setAmount] = useState(3);
  const canvasRef = useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      c.width=Math.min(c.parentElement?.clientWidth-32||840,840);
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      // Draw R, G, B channels with offset
      const offsets=[[-amount,0],[0,0],[amount,0]];
      const blends=["rgba(255,0,0,0.8)","rgba(0,255,0,0.6)","rgba(0,0,255,0.8)"];
      ctx.fillStyle="#000"; ctx.fillRect(0,0,c.width,c.height);
      offsets.forEach(([dx,dy],i)=>{
        ctx.globalCompositeOperation=i===0?"screen":"screen";
        ctx.drawImage(img,dx,dy,c.width,c.height);
      });
      // Re-draw with channel separation via tinting
      if(amount>0){
        ctx.clearRect(0,0,c.width,c.height);
        ctx.globalCompositeOperation="source-over";
        // Red channel shifted left
        ctx.globalAlpha=1;
        const offC=document.createElement("canvas"); offC.width=c.width; offC.height=c.height;
        const offCtx=offC.getContext("2d");
        offCtx.drawImage(img,0,0,c.width,c.height);
        // Separate channels
        const idata=offCtx.getImageData(0,0,c.width,c.height);
        const r_=new ImageData(c.width,c.height);
        const g_=new ImageData(c.width,c.height);
        const b_=new ImageData(c.width,c.height);
        for(let i=0;i<idata.data.length;i+=4){
          r_.data[i]=idata.data[i]; r_.data[i+3]=255;
          g_.data[i+1]=idata.data[i+1]; g_.data[i+3]=255;
          b_.data[i+2]=idata.data[i+2]; b_.data[i+3]=255;
        }
        const rC=document.createElement("canvas"); rC.width=c.width; rC.height=c.height; rC.getContext("2d").putImageData(r_,0,0);
        const gC=document.createElement("canvas"); gC.width=c.width; gC.height=c.height; gC.getContext("2d").putImageData(g_,0,0);
        const bC=document.createElement("canvas"); bC.width=c.width; bC.height=c.height; bC.getContext("2d").putImageData(b_,0,0);
        ctx.globalCompositeOperation="screen";
        ctx.drawImage(rC,-amount,0);
        ctx.drawImage(gC,0,0);
        ctx.drawImage(bC,amount,0);
        ctx.globalCompositeOperation="source-over";
      } else {
        ctx.drawImage(img,0,0,c.width,c.height);
      }
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,c.width,22);
      ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
      ctx.fillText(`Chromatic aberration: ${amount}px lateral shift`,8,14);
    };
    img.src=image;
  },[amount,image]);
  return (
    <div>
      <InfoBox>
        <strong>Chromatic aberration (CA)</strong> is a lens defect caused by the inability of the optical system to focus all wavelengths of light at the same point (<em>dispersion</em>). <strong>Lateral CA</strong> (transverse) shifts colour channels horizontally — visible as coloured fringing (typically red/cyan or green/magenta) on high-contrast edges, especially near corners. <strong>Longitudinal CA</strong> (axial) affects focus plane — purple fringing in front of focus, green behind. Minimised by apochromatic (APO) lens designs. Corrected in post via channel offset (DaVinci, Lightroom, Resolve lens correction). Prime lenses generally show less CA than zooms at equivalent focal lengths.
      </InfoBox>
      <div style={{marginBottom:12}}>
        <label style={styles.label}>
          CA amount: <strong style={{color:"#f59e0b"}}>{amount}px</strong>
          <input type="range" min={0} max={12} step={0.5} value={amount} onChange={e=>setAmount(+e.target.value)} style={styles.slider}/>
        </label>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Frame Rate
// ─────────────────────────────────────────────
function ModuleFrameRate() {
  const [fps, setFps] = useState(24);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef();
  const animRef = useRef();
  // clock = accumulated real time (ms) of the pendulum motion; samples = last shown frames
  const stateRef = useRef({clock:0,lastReal:0,nextSample:0,samples:[],frame:0});

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=800; c.height=340;
    const ctx=c.getContext("2d");
    const W=c.width, H=c.height;
    const PERIOD=1600;              // ms per full swing — fixed, independent of fps
    const AMP=0.95;                 // rad
    const cx=W/2, cy=54, len=210;
    const interval=1000/fps;
    const st=stateRef.current;
    const angleAt=ms=>AMP*Math.sin((ms/PERIOD)*Math.PI*2);
    const bob=ms=>{const a=angleAt(ms);return [cx+Math.sin(a)*len, cy+Math.cos(a)*len];};

    const draw=(now)=>{
      if(!st.lastReal) st.lastReal=now;
      const dt=now-st.lastReal; st.lastReal=now;
      if(playing){
        st.clock+=dt;                       // real motion advances at real speed
        while(st.clock>=st.nextSample){      // emit one displayed frame per 1/fps
          st.samples.push(st.nextSample);
          st.frame++;
          st.nextSample+=interval;
          if(st.samples.length>8) st.samples.shift();
        }
      }
      ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,W,H);
      // Floor + pivot
      ctx.strokeStyle="#1f2937"; ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,H-24);ctx.lineTo(W,H-24);ctx.stroke();
      // Trail of the last shown frames (older = fainter) — this IS the temporal sampling
      const s=st.samples;
      for(let i=0;i<s.length-1;i++){
        const [bx,by]=bob(s[i]);
        ctx.globalAlpha=0.10+0.10*(i/s.length);
        ctx.fillStyle="#f59e0b";
        ctx.beginPath();ctx.arc(bx,by,18,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
      // Current shown frame (sample-and-hold): rod + bob
      const cur=s.length?s[s.length-1]:0;
      const [px,py]=bob(cur);
      ctx.strokeStyle="#4b5563"; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(px,py);ctx.stroke();
      ctx.fillStyle="#f59e0b"; ctx.beginPath();ctx.arc(px,py,18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#1f2937"; ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fill();
      // Readout
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,W,28);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 13px monospace";
      ctx.fillText(`${fps} fps  ·  1 frame every ${interval.toFixed(1)} ms  ·  swing period ${PERIOD} ms (constant)  ·  frame ${st.frame}`,12,18);
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[fps,playing]);

  return (
    <div>
      <InfoBox>
        <strong>Frame rate</strong> (fps / Hz) defines how many still images are captured and displayed per second, creating the illusion of motion. <strong>24p</strong> is the cinematic standard — its motion cadence is deeply embedded in audience perception of "film". <strong>25p</strong> is the European broadcast standard (PAL, aligned with 50Hz power). <strong>50p/60p</strong> is used for sport and high-motion content. <strong>120p+</strong> is used for slow-motion (overcranking) — recorded at 120fps, played at 25fps = 4.8× slow motion. Higher frame rates also reduce motion blur per frame (shorter effective exposure per frame), which can create the controversial <em>soap opera effect</em> (HFR) seen in Peter Jackson's Hobbit trilogy (48fps, HFR-3D). SMPTE ST 2036-4 governs UHD-2 frame rates.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {[12,24,25,30,48,50,60,120].map(f=>(
          <button key={f} onClick={()=>setFps(f)} style={f===fps?styles.btnActive:styles.btnChip}>{f}p</button>
        ))}
        <button onClick={()=>setPlaying(p=>!p)} style={styles.btnSecondary}>{playing?"⏸ Pause":"▶ Play"}</button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Color Temperature
// ─────────────────────────────────────────────
const KELVIN_POINTS = [
  { K:1800, label:"Candle", color:"#ff6000", scene:"Candlelit interior, fire" },
  { K:2700, label:"Tungsten", color:"#ff8c00", scene:"Incandescent bulb, halogen" },
  { K:3200, label:"Studio Tungsten", color:"#ffa030", scene:"TV/film tungsten fixture. Camera WB standard." },
  { K:4000, label:"Warm white LED", color:"#ffc060", scene:"Modern LED panels, warm setting" },
  { K:5500, label:"Daylight", color:"#fff0d0", scene:"Noon sunlight, flash. Camera WB standard." },
  { K:6500, label:"D65 / Overcast", color:"#f0f4ff", scene:"Cloudy sky. Display calibration reference (sRGB)." },
  { K:7500, label:"Blue sky shade", color:"#d0e8ff", scene:"Open shade under blue sky" },
  { K:9000, label:"Deep blue sky", color:"#b0d0ff", scene:"Clear sky, no direct sun. Blue hour." },
  { K:10000, label:"Clear blue sky", color:"#a0c8ff", scene:"Extreme blue sky. Rare in practice." },
];

function ModuleColorTemp() {
  const [sel, setSel] = useState(4);
  const K = KELVIN_POINTS[sel];
  return (
    <div>
      <InfoBox>
        <strong>Colour temperature</strong> (measured in Kelvin, K) describes the colour of a light source by comparing it to a theoretical <em>black body radiator</em> heated to that temperature. Counter-intuitively: <strong>lower K = warmer (reddish)</strong>; <strong>higher K = cooler (bluish)</strong>. The camera's <strong>white balance</strong> compensates: if you set WB to 3200K with daylight (5500K) source, the image goes blue — this is intentional for creative effect. The <strong>D65</strong> (6500K) standard is the reference white for sRGB, Rec.709 and Rec.2020 (ITU-R BT.709, clause 1). In the ACES pipeline, all IDTs normalise to D60 (6000K) — slightly warmer than D65.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {KELVIN_POINTS.map((k,i)=>(
          <button key={k.K} onClick={()=>setSel(i)}
            style={{...styles.btnChip,...(i===sel?{borderColor:k.color,color:k.color,background:k.color+"22"}:{})}}>
            {k.label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{
          width:160,height:220,borderRadius:12,
          background:`linear-gradient(180deg,${K.color},rgba(0,0,0,0.3))`,
          border:"1px solid #1f2937",display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"flex-end",padding:16,
        }}>
          <div style={{color:"#000",fontWeight:"bold",fontSize:24,textShadow:"0 0 10px rgba(255,255,255,0.5)"}}>{K.K}K</div>
          <div style={{color:"#000",fontSize:12,marginTop:4,textShadow:"0 0 8px rgba(255,255,255,0.8)"}}>{K.label}</div>
        </div>
        <div style={{flex:1,minWidth:200}}>
          <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:8,padding:16,marginBottom:12}}>
            <div style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",marginBottom:4}}>SCENE CONTEXT</div>
            <div style={{color:"#e5e7eb"}}>{K.scene}</div>
          </div>
          {/* Gradient bar */}
          <div style={{borderRadius:8,overflow:"hidden",height:32,
            background:"linear-gradient(90deg,#ff4000,#ff8c00,#ffc060,#fff0d0,#f0f4ff,#b0d0ff,#80b0ff)"
          }}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{color:"#6b7280",fontSize:10}}>1800K</span>
            <span style={{color:"#6b7280",fontSize:10}}>← Warm · Cool →</span>
            <span style={{color:"#6b7280",fontSize:10}}>10000K</span>
          </div>
          <div style={styles.statRow}>
            <StatBadge label="WB Shift" value={K.K<5500?"Add blue":"Add orange"}/>
            <StatBadge label="Hex" value={K.color}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: RAW vs Compressed
// ─────────────────────────────────────────────
function ModuleRAW({ image }) {
  const [exposure, setExposure] = useState(0);
  const [mode, setMode] = useState("RAW");
  const canvasRef = useRef();

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      c.width=Math.min(c.parentElement?.clientWidth-32||840,840);
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,c.width,c.height);
      const idata=ctx.getImageData(0,0,c.width,c.height);
      const d=idata.data;
      const gain=Math.pow(2,exposure);
      for(let i=0;i<d.length;i+=4){
        for(let ch=0;ch<3;ch++){
          let v=d[i+ch]/255;
          if(mode==="RAW"){
            // RAW: linear headroom, recoverable highlights
            v=Math.min(v*gain,1.0);
          } else {
            // 8-bit compressed: clipping, no headroom
            v=Math.min(v,1.0);
            v=Math.min(v*gain,1.0);
            // add slight compression artifact noise
            v=Math.round(v*255)/255;
            if(exposure>1) v=Math.min(1,v+(Math.random()-0.5)*0.02);
          }
          d[i+ch]=Math.round(v*255);
        }
      }
      ctx.putImageData(idata,0,0);
      // Highlight clipping indicator (zebra stripes at >95%)
      if(exposure>0.5){
        for(let i=0;i<d.length;i+=4){
          if(d[i]>240&&d[i+1]>240&&d[i+2]>240){
            const px=i/4;
            const x=px%c.width, y=Math.floor(px/c.width);
            if((x+y)%8<4){
              ctx.fillStyle="rgba(255,0,0,0.7)";
              ctx.fillRect(x,y,1,1);
            }
          }
        }
      }
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,c.width,22);
      ctx.fillStyle=mode==="RAW"?"#34d399":"#f87171"; ctx.font="bold 12px monospace";
      ctx.fillText(`${mode} mode  |  EV ${exposure>=0?"+":""}${exposure}  |  ${mode==="RAW"?"Recoverable highlights":"Clipped, no recovery"}`,10,15);
    };
    img.src=image;
  },[exposure,mode,image]);

  return (
    <div>
      <InfoBox>
        <strong>RAW</strong> is the unprocessed sensor data — each photosite value before demosaicing, white balance, or tone mapping. It preserves full bit depth (12–16 bit), full dynamic range latitude, and defers all processing decisions to post. <strong>Compressed formats</strong> (H.264, H.265, AVCHD) apply in-camera processing — white balance, noise reduction, sharpening, colour science — and then compress the result. The key difference for exposure: RAW retains highlight headroom (typically 2–3 stops above clipping for recovery). Compressed clips above the camera's baked knee curve — no recovery possible. This is why LOG profiles recorded to ProRes/BRAW/XAVC-I offer a middle ground: processed but higher bit depth and LOG tone curve preserving more of the sensor's range.
      </InfoBox>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        {["RAW","H.264"].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            style={{...styles.btnChip,...(mode===m?{borderColor:m==="RAW"?"#34d399":"#f87171",color:m==="RAW"?"#34d399":"#f87171",background:m==="RAW"?"#34d39922":"#f8717122"}:{})}}>
            {m}
          </button>
        ))}
        <label style={styles.label}>
          Exposure: <strong style={{color:"#f59e0b"}}>{exposure>=0?"+":""}{exposure} EV</strong>
          <input type="range" min={-3} max={3} step={0.5} value={exposure} onChange={e=>setExposure(+e.target.value)} style={styles.slider}/>
        </label>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 At +1.5 EV and above, red zebra stripes show clipped highlights. In RAW mode, those areas retain more recoverable headroom than compressed formats.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Camera Movement
// ─────────────────────────────────────────────
const MOVEMENTS = [
  { label:"Pan", note:"Horizontal rotation around the camera's vertical axis. Camera stays in place. Follows action or reveals the scene.", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    const panX=Math.sin(t*0.7)*c.width*0.25;
    // Scene
    for(let i=0;i<8;i++){
      const x=((i/8)*c.width+panX)%c.width; const y=c.height*0.3+Math.sin(i)*20;
      ctx.fillStyle="#1f2937"; ctx.fillRect(x-20,y,40,c.height*0.5);
      ctx.fillStyle="#f59e0b33"; ctx.fillRect(x-8,y+30,16,20);
    }
    // Frame indicator
    const fw=c.width*0.5; const fh=c.height*0.7;
    const fx=(c.width-fw)/2, fy=(c.height-fh)/2;
    ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2; ctx.strokeRect(fx,fy,fw,fh);
    ctx.fillStyle="#f59e0b"; ctx.font="11px monospace";
    ctx.fillText(`← PAN → ${Math.round(Math.sin(t*0.7)*30)}°`,fx+8,fy+16);
  }},
  { label:"Tilt", note:"Vertical rotation around the camera's horizontal axis. Looks up or down. Establishes scale or follows vertical movement.", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    const tiltY=Math.sin(t*0.7)*c.height*0.25;
    // Building
    for(let i=0;i<12;i++){
      const y=((i/12)*c.height+tiltY)%c.height;
      ctx.fillStyle="#1f2937"; ctx.fillRect(c.width*0.35,y-5,c.width*0.3,12);
    }
    const fw=c.width*0.6; const fh=c.height*0.5;
    const fx=(c.width-fw)/2, fy=(c.height-fh)/2;
    ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2; ctx.strokeRect(fx,fy,fw,fh);
    ctx.fillStyle="#60a5fa"; ctx.font="11px monospace";
    ctx.fillText(`↑ TILT ${Math.round(Math.sin(t*0.7)*20)}° ↓`,fx+8,fy+16);
  }},
  { label:"Dolly/Track", note:"Camera physically moves along its optical axis (in/out) or laterally. True perspective change — background relationship shifts. Different from zoom.", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    const scale=1+Math.sin(t*0.5)*0.3;
    const cx=c.width/2, cy=c.height/2;
    // Draw perspective grid
    for(let i=1;i<5;i++){
      const s=i*scale*0.2;
      const w=c.width*s, h=c.height*s;
      ctx.strokeStyle=`rgba(31,41,55,${i*0.3})`; ctx.lineWidth=1;
      ctx.strokeRect(cx-w/2,cy-h/2,w,h);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-w/2,cy-h/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+w/2,cy-h/2); ctx.stroke();
    }
    ctx.strokeStyle="#34d399"; ctx.lineWidth=2;
    const s=0.6*scale;
    ctx.strokeRect(cx-c.width*s/2,cy-c.height*s/2,c.width*s,c.height*s);
    ctx.fillStyle="#34d399"; ctx.font="11px monospace";
    ctx.fillText(`DOLLY IN/OUT  scale: ×${scale.toFixed(2)}`,cx-c.width*s/2+8,cy-c.height*s/2+16);
  }},
  { label:"Crane/Jib", note:"Camera moves vertically (up/down) while maintaining horizontal position. Reveals or conceals — epic 'God's eye view' effect.", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    const craneY=Math.sin(t*0.5)*c.height*0.3;
    // Ground plane perspective
    ctx.fillStyle="#111827";
    ctx.beginPath(); ctx.moveTo(0,c.height*0.7-craneY); ctx.lineTo(c.width,c.height*0.7-craneY); ctx.lineTo(c.width,c.height); ctx.lineTo(0,c.height); ctx.closePath(); ctx.fill();
    // Buildings at horizon
    [80,160,260,360,430].forEach((x,i)=>{
      const h=60+i*20;
      ctx.fillStyle="#1f2937";
      const drawY=c.height*0.7-craneY-h;
      ctx.fillRect(x,drawY,40,h);
    });
    ctx.strokeStyle="#a78bfa"; ctx.lineWidth=2;
    ctx.strokeRect(c.width*0.2,c.height*0.2,c.width*0.6,c.height*0.5);
    ctx.fillStyle="#a78bfa"; ctx.font="11px monospace";
    ctx.fillText(`CRANE  height: ${craneY>0?"+":" "}${Math.round(craneY*0.05)}m`,c.width*0.2+8,c.height*0.2+16);
  }},
  { label:"Handheld", note:"Camera held by operator. Organic, unstable movement. Conveys documentary realism, urgency or intimacy (Dogme 95, Bourne series).", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    // Shake simulation
    const shakeX=Math.sin(t*7.3)*4+Math.sin(t*13.1)*2+Math.sin(t*31)*1;
    const shakeY=Math.sin(t*5.7)*3+Math.sin(t*11.9)*2+Math.sin(t*27)*1;
    const shakeR=Math.sin(t*4.1)*0.015;
    ctx.save();
    ctx.translate(c.width/2+shakeX,c.height/2+shakeY);
    ctx.rotate(shakeR);
    ctx.translate(-c.width/2,-c.height/2);
    // Scene
    ctx.fillStyle="#1a2f44"; ctx.fillRect(60,80,160,160); // building
    ctx.fillStyle="#3d2b1f"; ctx.fillRect(280,120,100,120);
    ctx.fillStyle="#2d5a1b"; ctx.beginPath();ctx.arc(200,200,40,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.strokeStyle="#f87171"; ctx.lineWidth=2;
    ctx.strokeRect(c.width*0.15,c.height*0.1,c.width*0.7,c.height*0.75);
    ctx.fillStyle="#f87171"; ctx.font="11px monospace";
    ctx.fillText(`HANDHELD  shake: ${Math.round(Math.abs(shakeX+shakeY))}px`,c.width*0.15+8,c.height*0.1+16);
  }},
  { label:"Zoom", note:"Optical zoom: lens focal length changes. Subject magnifies but perspective STAYS SAME (no parallax shift). Contrast with dolly: different spatial effect.", animate:(c,t)=>{
    const ctx=c.getContext("2d"); ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,c.width,c.height);
    const zoom=1+Math.sin(t*0.5)*0.4;
    const cx=c.width/2, cy=c.height/2;
    // Scene stays in fixed perspective
    ctx.save(); ctx.translate(cx,cy); ctx.scale(zoom,zoom); ctx.translate(-cx,-cy);
    ctx.fillStyle="#1a2f44"; ctx.fillRect(160,60,160,180);
    ctx.fillStyle="#3d2b1f"; ctx.fillRect(60,140,80,100);
    ctx.fillStyle="#2d5a1b"; ctx.beginPath();ctx.arc(380,160,40,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2;
    const fw=c.width/zoom, fh=c.height/zoom;
    ctx.strokeRect((c.width-fw)/2,(c.height-fh)/2,fw,fh);
    ctx.fillStyle="#f59e0b"; ctx.font="11px monospace";
    ctx.fillText(`ZOOM  ×${zoom.toFixed(2)}  (perspective unchanged)`,20,20);
  }},
];

function ModuleCameraMovement() {
  const [sel, setSel] = useState(0);
  const canvasRef = useRef();
  const animRef = useRef();
  const tRef = useRef(0);

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=800; c.height=400;
    const move=MOVEMENTS[sel];
    const draw=()=>{
      tRef.current+=0.016;
      move.animate(c,tRef.current);
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[sel]);

  return (
    <div>
      <InfoBox>
        Camera movements are a primary tool of visual storytelling. <strong>Rotational movements</strong> (pan, tilt) keep the camera in place and rotate it. <strong>Translational movements</strong> (dolly/track, crane) physically move the camera through space — changing perspective relationships between subjects and background. <strong>The zoom is NOT a camera movement</strong> — it changes focal length, which magnifies the image but does not create parallax. The <em>Hitchcock dolly-zoom</em> (Vertigo effect) combines both simultaneously in opposition to create a dreamlike spatial distortion. Handheld and Steadicam are mounting-defined movements with distinct aesthetic signatures.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {MOVEMENTS.map((m,i)=>(
          <button key={m.label} onClick={()=>{setSel(i);tRef.current=0;}} style={i===sel?styles.btnActive:styles.btnChip}>{m.label}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 {MOVEMENTS[sel].note}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Timecode
// ─────────────────────────────────────────────
function ModuleTimecode() {
  const [fps, setFps] = useState(25);
  const [running, setRunning] = useState(true);
  const [df, setDf] = useState(false);
  const frameRef = useRef(0);
  const [tc, setTc] = useState("00:00:00:00");
  useEffect(()=>{
    if(!running)return;
    const interval=1000/fps;
    const id=setInterval(()=>{
      frameRef.current++;
      const totalFrames=frameRef.current;
      const f=totalFrames%fps;
      const totalSec=Math.floor(totalFrames/fps);
      const s=totalSec%60;
      const m=Math.floor(totalSec/60)%60;
      const h=Math.floor(totalSec/3600);
      const sep=df&&(fps===30||fps===60)?";":",";
      setTc(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}${sep}${String(Math.round(f)).padStart(2,"0")}`);
    },interval);
    return()=>clearInterval(id);
  },[fps,running,df]);

  return (
    <div>
      <InfoBox>
        <strong>SMPTE timecode</strong> (SMPTE ST 12-1) is the standard time addressing system for audiovisual media. Format: <em>HH:MM:SS:FF</em> (hours, minutes, seconds, frames). The separator <strong>":"</strong> denotes non-drop frame (NDF); <strong>";"</strong> denotes <strong>drop-frame (DF)</strong> — where frame numbers 0 and 1 are skipped at the start of each minute (except every 10th minute) to keep timecode aligned with real clock time in 29.97fps (NTSC colour). 25fps and 24fps are always non-drop. Timecode is embedded in SDI via SMPTE ST 12-1, in MXF/MOV files, and transmitted over LTC (Linear Timecode, analogue audio) or VITC (Vertical Interval Timecode, within video signal). Critical for <strong>multi-camera sync</strong>, audio post sync, and broadcast automation.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
        {[24,25,30,48,50,60].map(f=>(
          <button key={f} onClick={()=>{setFps(f);frameRef.current=0;}} style={f===fps?styles.btnActive:styles.btnChip}>{f}fps</button>
        ))}
        <button onClick={()=>setRunning(r=>!r)} style={styles.btnSecondary}>{running?"⏸":"▶"}</button>
        <button onClick={()=>setDf(d=>!d)} style={{...styles.btnSecondary,...(df?{borderColor:"#f59e0b",color:"#f59e0b"}:{})}}>
          Drop-frame: {df?"ON":"OFF"}
        </button>
        <button onClick={()=>frameRef.current=0} style={styles.btnSecondary}>Reset</button>
      </div>
      <div style={{
        background:"#0d1117",border:"1px solid #1f2937",borderRadius:12,
        padding:"24px 32px",display:"inline-block",fontFamily:"monospace",
        letterSpacing:"0.15em",fontSize:48,color:"#f59e0b",
        textShadow:"0 0 20px #f59e0b88",
      }}>
        {tc}
      </div>
      <div style={styles.statRow}>
        <StatBadge label="Frame rate" value={`${fps} fps`}/>
        <StatBadge label="Frame interval" value={`${(1000/fps).toFixed(3)} ms`}/>
        <StatBadge label="Mode" value={df?"Drop-frame":"Non-drop"}/>
        <StatBadge label="Separator" value={df&&(fps===30||fps===60)?";":","}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Scopes (Histogram / Waveform / Vectorscope / Parade)
// ─────────────────────────────────────────────
// Rec.709 luma + YCbCr for the vectorscope graticule
const luma709 = (r,g,b) => 0.2126*r+0.7152*g+0.0722*b;
const toCbCr = (r,g,b) => ([          // r,g,b in 0..1 → Cb,Cr in -0.5..0.5
  -0.168736*r-0.331264*g+0.5*b,
   0.5*r-0.418688*g-0.081312*b,
]);

function drawScope(sc, d, IW, IH, type){
  const ctx=sc.getContext("2d");
  const BG="#07090d";
  if(type==="histogram"){
    const SW=512, SH=300; sc.width=SW; sc.height=SH;
    const rH=new Float32Array(256),gH=new Float32Array(256),bH=new Float32Array(256),lH=new Float32Array(256);
    for(let i=0;i<d.length;i+=4){
      rH[d[i]]++; gH[d[i+1]]++; bH[d[i+2]]++;
      lH[Math.round(luma709(d[i],d[i+1],d[i+2]))]++;
    }
    ctx.fillStyle=BG; ctx.fillRect(0,0,SW,SH);
    ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    for(let p=0;p<=4;p++){ const x=(p/4)*SW; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,SH-16);ctx.stroke(); }
    const mx=Math.max(...rH,...gH,...bH,...lH)||1;
    const plot=(H,color)=>{
      ctx.strokeStyle=color; ctx.lineWidth=1.2; ctx.beginPath();
      for(let i=0;i<256;i++){ const x=i/255*SW, y=(SH-16)-(H[i]/mx)*(SH-26); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
    };
    plot(lH,"rgba(255,255,255,0.55)"); plot(rH,"rgba(239,68,68,0.85)");
    plot(gH,"rgba(34,197,94,0.85)"); plot(bH,"rgba(59,130,246,0.85)");
    ctx.fillStyle="#374151"; ctx.font="10px monospace";
    ctx.fillText("Blacks",4,SH-4); ctx.fillText("Mid",SW/2-12,SH-4); ctx.fillText("Whites",SW-48,SH-4);
    return;
  }
  if(type==="waveform"||type==="parade"){
    const SW=540, SH=300; sc.width=SW; sc.height=SH;
    const parade=type==="parade";
    const panels=parade?3:1;
    const gutter=parade?8:0;
    const pw=(SW-(panels-1)*gutter)/panels;
    const acc=new Float32Array(SW*SH);
    const chColor=parade?[[239,68,68],[34,197,94],[59,130,246]]:[[120,230,150]];
    // accumulate: x maps within each panel, value height inverted
    for(let y=0;y<IH;y++){
      for(let x=0;x<IW;x++){
        const i=(y*IW+x)*4;
        for(let p=0;p<panels;p++){
          const val=parade? d[i+p]/255 : luma709(d[i],d[i+1],d[i+2])/255;
          const px=Math.round(p*(pw+gutter) + (x/IW)*pw);
          const py=Math.round((SH-14) - val*(SH-24));
          if(px>=0&&px<SW&&py>=0&&py<SH) acc[py*SW+px]++;
        }
      }
    }
    const out=ctx.createImageData(SW,SH); const od=out.data;
    for(let k=0;k<od.length;k+=4){ od[k]=7;od[k+1]=9;od[k+2]=13;od[k+3]=255; }
    let mx=0; for(let k=0;k<acc.length;k++) if(acc[k]>mx)mx=acc[k];
    const norm=mx*0.18+1e-6;
    for(let k=0;k<acc.length;k++){
      if(acc[k]<=0) continue;
      const px=k%SW; const p=parade?Math.min(2,Math.floor(px/(pw+gutter))):0;
      const c=chColor[p]; const t=Math.min(1,acc[k]/norm);
      od[k*4]=Math.min(255,od[k*4]+c[0]*t);
      od[k*4+1]=Math.min(255,od[k*4+1]+c[1]*t);
      od[k*4+2]=Math.min(255,od[k*4+2]+c[2]*t);
    }
    ctx.putImageData(out,0,0);
    // IRE guides on top
    ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.fillStyle="#374151"; ctx.font="9px monospace"; ctx.lineWidth=1;
    for(let p=0;p<=100;p+=25){ const y=(SH-14)-(p/100)*(SH-24); ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(SW,y);ctx.stroke(); ctx.fillText(p+"",2,y-2); }
    if(parade){ ["R","G","B"].forEach((n,p)=>{ ctx.fillStyle=`rgb(${chColor[p].join(",")})`; ctx.fillText(n,p*(pw+gutter)+4,12); }); }
    return;
  }
  if(type==="vectorscope"){
    const SW=320, SH=320; sc.width=SW; sc.height=SH;
    const cx=SW/2, cy=SH/2, scale=SH*0.92; // Cb,Cr ±0.5 → radius
    const acc=new Float32Array(SW*SH);
    for(let i=0;i<d.length;i+=4){
      const [cb,cr]=toCbCr(d[i]/255,d[i+1]/255,d[i+2]/255);
      const px=Math.round(cx+cb*scale), py=Math.round(cy-cr*scale);
      if(px>=0&&px<SW&&py>=0&&py<SH) acc[py*SW+px]++;
    }
    const out=ctx.createImageData(SW,SH); const od=out.data;
    for(let k=0;k<od.length;k+=4){ od[k]=7;od[k+1]=9;od[k+2]=13;od[k+3]=255; }
    let mx=0; for(let k=0;k<acc.length;k++) if(acc[k]>mx)mx=acc[k];
    const norm=mx*0.12+1e-6;
    for(let k=0;k<acc.length;k++){ if(acc[k]<=0)continue; const t=Math.min(1,acc[k]/norm);
      od[k*4+1]=Math.min(255,od[k*4+1]+210*t); od[k*4]=Math.min(255,od[k*4]+40*t); }
    ctx.putImageData(out,0,0);
    // graticule
    ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(cx,cy,scale*0.5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-scale*0.5,cy);ctx.lineTo(cx+scale*0.5,cy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy-scale*0.5);ctx.lineTo(cx,cy+scale*0.5);ctx.stroke();
    // 75% colour targets
    const targets=[["R",[0.75,0,0]],["Yl",[0.75,0.75,0]],["G",[0,0.75,0]],["Cy",[0,0.75,0.75]],["B",[0,0,0.75]],["Mg",[0.75,0,0.75]]];
    targets.forEach(([n,[r,g,b]])=>{
      const [cb,cr]=toCbCr(r,g,b);
      const px=cx+cb*scale, py=cy-cr*scale;
      ctx.strokeStyle="rgba(255,255,255,0.55)"; ctx.strokeRect(px-5,py-5,10,10);
      ctx.fillStyle="#9ca3af"; ctx.font="9px monospace"; ctx.fillText(n,px+7,py+3);
    });
    // skin-tone line (I-line): direction of a typical skin vector
    const [scb,scr]=toCbCr(0.86,0.60,0.48);
    const mag=Math.hypot(scb,scr);
    ctx.strokeStyle="rgba(245,158,11,0.5)"; ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+scb/mag*scale*0.5,cy-scr/mag*scale*0.5);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="rgba(245,158,11,0.8)"; ctx.font="9px monospace"; ctx.fillText("skin",cx+scb/mag*scale*0.32+4,cy-scr/mag*scale*0.32);
    return;
  }
}

const SCOPE_TYPES=[["waveform","Waveform"],["histogram","Histogram"],["parade","RGB Parade"],["vectorscope","Vectorscope"]];

function ModuleScopes({ image }) {
  const [scope, setScope] = useState("waveform");
  const [lift, setLift] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [gain, setGain] = useState(1);
  const [sat, setSat] = useState(1);
  const [temp, setTemp] = useState(0);
  const previewRef = useRef();
  const scopeRef = useRef();
  const reset=()=>{setLift(0);setGamma(1);setGain(1);setSat(1);setTemp(0);};
  const graded = lift!==0||gamma!==1||gain!==1||sat!==1||temp!==0;

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const pv=previewRef.current, sc=scopeRef.current;
      if(!pv||!sc) return;
      const IW=Math.min(pv.parentElement?.clientWidth-32||520,560);
      const IH=Math.round(IW*9/16);
      pv.width=IW; pv.height=IH;
      const pctx=pv.getContext("2d");
      pctx.drawImage(img,0,0,IW,IH);
      const idata=pctx.getImageData(0,0,IW,IH);
      const d=idata.data;
      const tR=1+0.35*temp, tB=1-0.35*temp;
      for(let i=0;i<d.length;i+=4){
        let r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
        r*=tR; b*=tB;                                  // temperature
        r=Math.pow(Math.min(1,Math.max(0,r*gain+lift)),1/gamma);   // lift/gamma/gain
        g=Math.pow(Math.min(1,Math.max(0,g*gain+lift)),1/gamma);
        b=Math.pow(Math.min(1,Math.max(0,b*gain+lift)),1/gamma);
        const L=luma709(r,g,b);                        // saturation
        r=L+sat*(r-L); g=L+sat*(g-L); b=L+sat*(b-L);
        d[i]=Math.max(0,Math.min(255,r*255));
        d[i+1]=Math.max(0,Math.min(255,g*255));
        d[i+2]=Math.max(0,Math.min(255,b*255));
      }
      pctx.putImageData(idata,0,0);
      drawScope(sc, d, IW, IH, scope);
    };
    img.src=image;
  },[image,lift,gamma,gain,sat,temp,scope]);

  const sliders=[
    ["Lift",lift,setLift,-0.2,0.2,0.01,0],
    ["Gamma",gamma,setGamma,0.4,2.2,0.01,1],
    ["Gain",gain,setGain,0.4,2,0.01,1],
    ["Saturation",sat,setSat,0,2,0.01,1],
    ["Temperature",temp,setTemp,-1,1,0.01,0],
  ];

  return (
    <div>
      <InfoBox>
        <strong>Scopes</strong> are objective measurement tools — far more reliable than the camera LCD for exposure and colour decisions. The <strong>Histogram</strong> shows the tonal distribution per channel. The <strong>Waveform</strong> maps luminance (vertical, in IRE) against horizontal image position — the standard for checking exposure and clipping across the frame (EBU R 103). The <strong>RGB Parade</strong> splits the waveform into R, G, B side-by-side — the colourist's tool for white balance and channel balance. The <strong>Vectorscope</strong> plots chrominance on a polar diagram: distance from centre = saturation, angle = hue; the boxes are 75% colour targets and the amber line is the <em>skin-tone line</em>. Drag the grading sliders and watch each scope respond in real time.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {SCOPE_TYPES.map(([k,lbl])=>(
          <button key={k} onClick={()=>setScope(k)} style={k===scope?styles.btnActive:styles.btnChip}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start",marginBottom:14}}>
        <div style={{flex:"1 1 420px",minWidth:280,background:"#111",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>GRADED PREVIEW{graded?"":" (neutral)"}</div>
          <canvas ref={previewRef} style={{display:"block",width:"100%"}}/>
        </div>
        <div style={{flex:"0 1 auto",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:"#22d3ee",fontSize:10,fontFamily:"monospace",marginBottom:6,letterSpacing:"0.08em"}}>
            {SCOPE_TYPES.find(s=>s[0]===scope)[1].toUpperCase()}
          </div>
          <canvas ref={scopeRef} style={{display:"block",maxWidth:"100%"}}/>
        </div>
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",letterSpacing:"0.06em"}}>GRADING</span>
          <button onClick={reset} style={{...styles.btnSecondary,fontSize:11,padding:"4px 10px"}}>Reset</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {sliders.map(([name,val,setter,min,max,step,def])=>(
            <label key={name} style={styles.label}>
              <span>{name}: <strong style={{color:val===def?"#6b7280":"#22d3ee"}}>{(+val).toFixed(2)}</strong></span>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e=>setter(+e.target.value)}
                style={{...styles.slider,width:"100%",accentColor:"#22d3ee"}}/>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared UI Components
// ─────────────────────────────────────────────
function InfoBox({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{marginBottom:16}}>
      <button onClick={()=>setOpen(o=>!o)} style={{...styles.btnSecondary,fontSize:11,padding:"4px 10px"}}>
        {open?"▼ Hide explanation":"▶ Show explanation"}
      </button>
      {open && (
        <div style={{marginTop:8,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:"12px 16px",color:"#d1d5db",fontSize:13,lineHeight:1.7}}>
          {children}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div style={{background:"#111",border:"1px solid #1f2937",borderRadius:6,padding:"6px 12px",minWidth:80}}>
      <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace"}}>{label}</div>
      <div style={{color:"#f59e0b",fontSize:12,fontFamily:"monospace",fontWeight:"bold"}}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = {
  btnActive: {
    padding:"6px 12px",borderRadius:6,border:"2px solid #f59e0b",
    background:"#f59e0b22",color:"#f59e0b",cursor:"pointer",
    fontSize:12,fontFamily:"monospace",fontWeight:"bold",
  },
  btnChip: {
    padding:"6px 12px",borderRadius:6,border:"1px solid #374151",
    background:"transparent",color:"#9ca3af",cursor:"pointer",
    fontSize:12,fontFamily:"monospace",transition:"all 0.15s",
  },
  btnSecondary: {
    padding:"6px 14px",borderRadius:6,border:"1px solid #374151",
    background:"#111",color:"#9ca3af",cursor:"pointer",
    fontSize:12,fontFamily:"monospace",
  },
  label: {
    color:"#9ca3af",fontSize:12,display:"flex",flexDirection:"column",gap:4,
  },
  slider: {
    accentColor:"#f59e0b",width:140,
  },
  noteText: {
    color:"#6b7280",fontSize:12,marginTop:8,fontStyle:"italic",
  },
  statRow: {
    display:"flex",gap:8,flexWrap:"wrap",
  },
};

// ─────────────────────────────────────────────
// Module registry map
// ─────────────────────────────────────────────
const MODULE_COMPONENTS = {
  aspectRatio: ModuleAspectRatio,
  resolution: ModuleResolution,
  chromaSubsampling: ModuleChromaSubsampling,
  raw: ModuleRAW,
  frameRate: ModuleFrameRate,
  pictureProfiles: ModulePictureProfiles,
  colorSpaces: ModuleColorSpaces,
  aces: ModuleACES,
  colorTemp: ModuleColorTemp,
  rollingShutter: ModuleRollingShutter,
  moire: ModuleMoire,
  banding: ModuleBanding,
  noise: ModuleNoise,
  vignetting: ModuleVignetting,
  chromaticAberration: ModuleChromaticAberration,
  depthOfField: ModuleDepthOfField,
  shotTypes: ModuleShotTypes,
  cameraMovement: ModuleCameraMovement,
  timecode: ModuleTimecode,
  scopes: ModuleScopes,
};

const CATEGORY_COLORS = {
  image:"#60a5fa", color:"#f59e0b", defects:"#f87171",
  optics:"#34d399", narrative:"#a78bfa", scopes:"#22d3ee",
};

// ─────────────────────────────────────────────
// Hub Card
// ─────────────────────────────────────────────
function HubCard({ id, catColor, onClick }) {
  const mod = T.modules[id];
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        background:hov?"#111827":"#0d1117",
        border:`1px solid ${hov?catColor+"66":"#1f2937"}`,
        borderRadius:10,padding:"16px",cursor:"pointer",
        transition:"all 0.18s",
        boxShadow:hov?`0 0 20px ${catColor}22`:"none",
      }}>
      <div style={{color:catColor,fontSize:10,fontFamily:"monospace",fontWeight:"bold",marginBottom:6,letterSpacing:"0.1em",textTransform:"uppercase"}}>
        {T.categories[CATEGORIES.find(c=>c.modules.includes(id))?.id]}
      </div>
      <div style={{color:"#f3f4f6",fontWeight:"bold",fontSize:14,marginBottom:4}}>{mod.title}</div>
      <div style={{color:"#6b7280",fontSize:12,lineHeight:1.5}}>{mod.desc}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function AVBible() {
  const [activeModule, setActiveModule] = useState(null);
  const [userImage, setUserImage] = useState(null);
  const [defaultImage, setDefaultImage] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(()=>{
    setDefaultImage(generateDefaultImageDataURL());
  },[]);

  const image = userImage || defaultImage || "";

  const filteredCategories = CATEGORIES.map(cat=>({
    ...cat,
    modules: cat.modules.filter(id=>{
      if(!search) return true;
      const mod=T.modules[id];
      return mod.title.toLowerCase().includes(search.toLowerCase()) ||
             mod.desc.toLowerCase().includes(search.toLowerCase());
    }),
  })).filter(cat=>cat.modules.length>0);

  const ActiveComp = activeModule ? MODULE_COMPONENTS[activeModule] : null;
  const activeMod = activeModule ? T.modules[activeModule] : null;
  const activeCat = activeModule ? CATEGORIES.find(c=>c.modules.includes(activeModule)) : null;

  return (
    <div style={{
      minHeight:"100vh",background:"#060609",color:"#e5e7eb",
      fontFamily:"system-ui,-apple-system,sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom:"1px solid #1f2937",padding:"16px 24px",
        display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",
        background:"#0a0a0f",
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{
            fontSize:22,fontWeight:"bold",letterSpacing:"0.05em",
            background:"linear-gradient(90deg,#f59e0b,#fb923c)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>
            AV Bible
          </div>
          <div style={{color:"#4b5563",fontSize:11,fontFamily:"monospace"}}>Interactive Audiovisual Reference</div>
        </div>
        {activeModule && (
          <button onClick={()=>setActiveModule(null)} style={{...styles.btnSecondary,fontSize:12}}>
            ← All Modules
          </button>
        )}
        {!activeModule && (
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search modules…"
            style={{
              background:"#0d1117",border:"1px solid #1f2937",borderRadius:6,
              padding:"6px 12px",color:"#e5e7eb",fontSize:12,fontFamily:"monospace",
              outline:"none",width:180,
            }}
          />
        )}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{...styles.btnSecondary,cursor:"pointer",fontSize:11}}>
            📁 Upload Image
            <input type="file" accept="image/*" style={{display:"none"}}
              onChange={e=>{
                const f=e.target.files[0]; if(!f)return;
                const reader=new FileReader();
                reader.onload=ev=>setUserImage(ev.target.result);
                reader.readAsDataURL(f);
              }}
            />
          </label>
          {userImage && (
            <button onClick={()=>setUserImage(null)} style={{...styles.btnSecondary,fontSize:11}}>
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeModule && ActiveComp ? (
        <div style={{maxWidth:1080,margin:"0 auto",padding:"24px 20px"}}>
          <div style={{marginBottom:16}}>
            <div style={{color:CATEGORY_COLORS[activeCat?.id]||"#f59e0b",fontSize:11,fontFamily:"monospace",fontWeight:"bold",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>
              {T.categories[activeCat?.id]}
            </div>
            <h1 style={{margin:0,fontSize:26,fontWeight:"bold",color:"#f3f4f6"}}>{activeMod.title}</h1>
            <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>{activeMod.desc}</p>
          </div>
          <ActiveComp image={image} userImage={userImage}/>
        </div>
      ) : (
        <div style={{maxWidth:1280,margin:"0 auto",padding:"24px 20px"}}>
          {/* Hero */}
          {!search && (
            <div style={{
              marginBottom:32,padding:"24px 28px",
              background:"linear-gradient(135deg,#0d1117,#111827)",
              border:"1px solid #1f2937",borderRadius:12,
            }}>
              <h2 style={{margin:"0 0 8px",fontSize:20,color:"#f3f4f6"}}>
                {Object.values(MODULE_COMPONENTS).length} Interactive Modules
              </h2>
              <p style={{margin:0,color:"#6b7280",fontSize:13,maxWidth:600}}>
                Visual, hands-on reference for image science, colour theory, sensor artifacts, optics, and cinematic technique. Upload your own image to use across all modules.
              </p>
            </div>
          )}
          {/* Categories */}
          {filteredCategories.map(cat=>(
            <div key={cat.id} style={{marginBottom:32}}>
              <div style={{
                display:"flex",alignItems:"center",gap:10,marginBottom:12,
                borderBottom:"1px solid #1f2937",paddingBottom:8,
              }}>
                <div style={{
                  width:8,height:8,borderRadius:"50%",
                  background:CATEGORY_COLORS[cat.id],
                  boxShadow:`0 0 8px ${CATEGORY_COLORS[cat.id]}`,
                }}/>
                <span style={{color:CATEGORY_COLORS[cat.id],fontWeight:"bold",fontSize:13,fontFamily:"monospace",letterSpacing:"0.05em",textTransform:"uppercase"}}>
                  {T.categories[cat.id]}
                </span>
                <span style={{color:"#374151",fontSize:12}}>{cat.modules.length} modules</span>
              </div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",
                gap:10,
              }}>
                {cat.modules.map(id=>(
                  <HubCard key={id} id={id} catColor={CATEGORY_COLORS[cat.id]} onClick={()=>setActiveModule(id)}/>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length===0 && (
            <div style={{textAlign:"center",padding:48,color:"#4b5563"}}>
              No modules match "<span style={{color:"#f59e0b"}}>{search}</span>"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
