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
    modules: ["colorTemp","pictureProfiles","colorSpaces","aces"],
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
  { name:"mountains", depth:300, draw:(ctx,W,H)=>{   // atmospheric haze; base fades to ground colour (no hard edge)
    const horizon=H*0.60;
    const g=ctx.createLinearGradient(0,H*0.42,0,horizon+2);
    g.addColorStop(0,"#9fb0c0"); g.addColorStop(1,"#5a7048");
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.moveTo(0,horizon+2);
    [[0,0.52],[0.15,0.45],[0.30,0.50],[0.46,0.43],[0.62,0.49],[0.80,0.46],[1,0.51]].forEach(([x,y])=>ctx.lineTo(x*W,y*H));
    ctx.lineTo(W,horizon+2); ctx.closePath(); ctx.fill();
  }},
  { name:"ground", depth:30, draw:(ctx,W,H)=>{
    const horizon=H*0.60, top=horizon-H*0.03;   // slight overlap up so parallax (crane) can't open a horizon seam
    const gnd=ctx.createLinearGradient(0,top,0,H);
    gnd.addColorStop(0,"#5a7048"); gnd.addColorStop(1,"#33452a");
    ctx.fillStyle=gnd; ctx.fillRect(0,top,W,H-top);
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
      const cw = Math.min(c.parentElement.clientWidth - 32, 900);
      const imgA = img.width/img.height;
      const ch = Math.round(cw/imgA);
      c.width=cw; c.height=ch;
      const ctx=c.getContext("2d");
      // The image stays as-is; the ratio is shown as a semi-transparent letterbox over it
      ctx.drawImage(img,0,0,cw,ch);
      const r=RATIOS[sel], ra=r.w/r.h;
      let cropW,cropH,cropX,cropY;
      if(ra>=imgA){ cropW=cw; cropH=cw/ra; cropX=0; cropY=(ch-cropH)/2; }   // wider → letterbox (top/bottom)
      else       { cropH=ch; cropW=ch*ra; cropY=0; cropX=(cw-cropW)/2; }   // taller → pillarbox (sides)
      // semi-transparent bars over the cropped-out areas (still visible underneath)
      ctx.fillStyle="rgba(6,6,9,0.62)";
      if(cropY>0.5){ ctx.fillRect(0,0,cw,cropY); ctx.fillRect(0,cropY+cropH,cw,ch-cropY-cropH); }
      if(cropX>0.5){ ctx.fillRect(0,0,cropX,ch); ctx.fillRect(cropX+cropW,0,cw-cropX-cropW,ch); }
      // frame around what the ratio keeps
      ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2;
      ctx.strokeRect(cropX+1,cropY+1,cropW-2,cropH-2);
      // action-safe guide inside the kept frame (EBU R 95, 5% inset)
      ctx.strokeStyle="rgba(245,158,11,0.35)"; ctx.setLineDash([5,5]); ctx.lineWidth=1;
      ctx.strokeRect(cropX+cropW*0.05,cropY+cropH*0.05,cropW*0.9,cropH*0.9);
      ctx.setLineDash([]);
      // label
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,172,26);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 13px monospace";
      ctx.fillText(`${r.label}  ${Math.round(cropW)}×${Math.round(cropH)}`,10,18);
    };
    img.src = image;
  },[sel,image]);
  return (
    <div>
      <InfoBox>
        The <strong>aspect ratio</strong> defines the proportional relationship between width and height. It determines framing, composition, and the emotional "feel" of the image. Cinematographers choose ratios deliberately — 2.39:1 feels epic and immersive; 1:1 feels intimate. The image stays fixed; the <strong>semi-transparent letterbox</strong> shows what each ratio <em>crops away</em> from the same frame (top/bottom bars for wider ratios, side bars for taller ones). The dashed amber line is the <strong>action safe area</strong> (5% inset), critical for broadcast delivery (EBU R 95).
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
      const W=Math.min(c.parentElement?.clientWidth-32||860,860);
      c.width=W; c.height=Math.round(W*9/16); const H=c.height;
      const ctx=c.getContext("2d");
      ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
      // Nested rectangles to scale (all share the bottom-left corner) → see how much
      // bigger each resolution is. 8K sets the scale.
      const pad=Math.round(W*0.03);
      const scale=(W-2*pad)/RESOLUTIONS[RESOLUTIONS.length-1].w;
      const ax=pad, ay=H-pad;
      const chip=(x,y,txt,active)=>{
        ctx.font=`${active?"bold ":""}11px monospace`; const tw=ctx.measureText(txt).width;
        ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(x-tw-6,y-13,tw+8,16);
        ctx.fillStyle=active?"#f59e0b":"#9ca3af"; ctx.fillText(txt,x-tw-2,y-1);
      };
      // selected box: image fill first (so outlines sit on top)
      const bw=R.w*scale, bh=R.h*scale, x=ax, y=ay-bh;
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,bw,bh); ctx.clip();
      const ir=img.width/img.height, br=bw/bh; let dw,dh,dx,dy;
      if(ir>br){ dh=bh; dw=bh*ir; dx=x-(dw-bw)/2; dy=y; } else { dw=bw; dh=bw/ir; dx=x; dy=y-(dh-bh)/2; }
      ctx.drawImage(img,dx,dy,dw,dh); ctx.restore();
      // all boxes as outlines on top (largest → smallest), selected in amber
      for(let i=RESOLUTIONS.length-1;i>=0;i--){
        const r=RESOLUTIONS[i], active=i===sel, w2=r.w*scale, h2=r.h*scale, x2=ax, y2=ay-h2;
        ctx.strokeStyle=active?"#f59e0b":"rgba(160,175,195,0.32)"; ctx.lineWidth=active?2.5:1;
        ctx.strokeRect(x2,y2,w2,h2);
        chip(x2+w2, y2+13, r.label, active);
      }
      // HUD
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,W,24);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
      ctx.fillText(`${R.w}×${R.h}  ·  ${R.mp} MP  ·  ${R.std}  ·  boxes drawn to scale`,10,16);
    };
    img.src=image;
  },[sel,image]);
  return (
    <div>
      <InfoBox>
        <strong>Resolution</strong> is the total pixel count of the image matrix. The nested boxes are drawn <strong>to scale</strong> — see how much larger each format is: 8K UHD holds <em>81×</em> the pixels of SD. <strong>Megapixels</strong> (MP) = W×H÷1,000,000. Note the difference between <em>UHD</em> (consumer, 3840×2160) and <em>DCI</em> (cinema, 4096×2160) — not the same standard. Higher resolution means more detail and larger files; at 4K+ individual pixels are imperceptible at normal viewing distances (ITU-R BT.2022).
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {RESOLUTIONS.map((r,i)=>(
          <button key={r.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{r.label}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
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

// Test pattern with saturated colour edges — where subsampling visibly smears chroma
// Low-res test pattern: colour bars with fine LUMA lines + a fine colour checker
function chromaPattern(ctx,W,H){
  const bars=[[235,235,235],[235,235,16],[16,235,235],[16,235,16],[235,16,235],[235,16,16],[16,16,235],[20,20,28]];
  const barsH=Math.round(H*0.6), bw=W/bars.length;
  bars.forEach((c,i)=>{ ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(Math.round(i*bw),0,Math.ceil(bw)+1,barsH); });
  // thin horizontal luma lines over the bars (high-freq LUMA → survives subsampling)
  ctx.fillStyle="rgba(0,0,0,0.85)";
  for(let y=2;y<barsH;y+=4) ctx.fillRect(0,y,W,1);
  // fine colour checker (high-freq CHROMA → mushes to grey/purple)
  for(let y=barsH;y<H;y++) for(let x=0;x<W;x++){ ctx.fillStyle=(((x>>1)+(y>>1))&1)?"#ff1810":"#1224ff"; ctx.fillRect(x,y,1,1); }
}
// Block-average chroma (Cb,Cr) per the scheme's sampling block; luma kept per-pixel
function chromaSubsample(d,W,H,scheme){
  const bw = scheme==="4:1:1"?4 : scheme==="4:4:4"?1 : 2;
  const bh = scheme==="4:2:0"?2 : 1;
  const Y=new Float32Array(W*H), Cb=new Float32Array(W*H), Cr=new Float32Array(W*H);
  for(let i=0,p=0;i<d.length;i+=4,p++){ const r=d[i],g=d[i+1],b=d[i+2];
    Y[p]=0.2126*r+0.7152*g+0.0722*b; Cb[p]=128-0.168736*r-0.331264*g+0.5*b; Cr[p]=128+0.5*r-0.418688*g-0.081312*b; }
  for(let by=0;by<H;by+=bh) for(let bx=0;bx<W;bx+=bw){
    let scb=0,scr=0,n=0;
    for(let y=by;y<Math.min(H,by+bh);y++) for(let x=bx;x<Math.min(W,bx+bw);x++){ const p=y*W+x; scb+=Cb[p]; scr+=Cr[p]; n++; }
    scb/=n; scr/=n;
    for(let y=by;y<Math.min(H,by+bh);y++) for(let x=bx;x<Math.min(W,bx+bw);x++){ const p=y*W+x; Cb[p]=scb; Cr[p]=scr; }
  }
  for(let i=0,p=0;i<d.length;i+=4,p++){ const y=Y[p],cb=Cb[p],cr=Cr[p];
    d[i]  =Math.max(0,Math.min(255,y+1.5748*(cr-128)));
    d[i+1]=Math.max(0,Math.min(255,y-0.1873*(cb-128)-0.4681*(cr-128)));
    d[i+2]=Math.max(0,Math.min(255,y+1.8556*(cb-128))); }
}

function ModuleChromaSubsampling() {
  const [sel, setSel] = useState(2);
  const [grid, setGrid] = useState(true);
  const S = SAMPLING[sel];
  const canvasRef = useRef();
  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    const IW=104, IH=58;
    const src=document.createElement("canvas"); src.width=IW; src.height=IH;
    chromaPattern(src.getContext("2d"), IW, IH);
    const srcData=src.getContext("2d").getImageData(0,0,IW,IH);
    const sub=document.createElement("canvas"); sub.width=IW; sub.height=IH;
    const subData=new ImageData(new Uint8ClampedArray(srcData.data), IW, IH);
    chromaSubsample(subData.data, IW, IH, S.label);
    sub.getContext("2d").putImageData(subData,0,0);
    // magnify side by side (original | subsampled)
    const W=Math.min(c.parentElement?.clientWidth-24||880,920);
    const gap=10, top=22, panelW=Math.floor((W-gap)/2), panelH=Math.round(panelW*IH/IW);
    c.width=W; c.height=panelH+top;
    const ctx=c.getContext("2d"); ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,c.height);
    ctx.drawImage(src,0,top,panelW,panelH);
    ctx.drawImage(sub,panelW+gap,top,panelW,panelH);
    // chroma-block grid on the subsampled panel
    if(grid && S.label!=="4:4:4"){
      const bw=S.label==="4:1:1"?4:2, bh=S.label==="4:2:0"?2:1;
      ctx.strokeStyle="rgba(255,255,255,0.16)"; ctx.lineWidth=1;
      const sx=panelW/IW, sy=panelH/IH;
      for(let x=0;x<=IW;x+=bw){ const px=Math.round(panelW+gap+x*sx)+0.5; ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,top+panelH);ctx.stroke(); }
      if(bh>1) for(let y=0;y<=IH;y+=bh){ const py=Math.round(top+y*sy)+0.5; ctx.beginPath();ctx.moveTo(panelW+gap,py);ctx.lineTo(W,py);ctx.stroke(); }
    }
    ctx.textAlign="left"; ctx.font="bold 12px monospace";
    ctx.fillStyle="#9ca3af"; ctx.fillText("4:4:4  (original)",4,15);
    ctx.fillStyle="#f59e0b"; ctx.fillText(`${S.label}${grid&&S.label!=="4:4:4"?"   — chroma blocks":""}`,panelW+gap+4,15);
  },[sel,grid]);
  return (
    <div>
      <InfoBox>
        <strong>Chroma subsampling</strong> exploits the eye's lower acuity for colour (chrominance) than brightness (luminance), so the colour information is stored at lower resolution than the luma. The notation <em>J:a:b</em> describes chroma sampling across a 2×4 pixel block. <strong>Luma (Y) is always kept per-pixel</strong>; only <strong>Cb</strong> (blue-difference) and <strong>Cr</strong> (red-difference) are reduced — there is no separate green channel (green is reconstructed). Compare the two panels: as you leave 4:4:4, the <strong>colour</strong> is averaged into blocks (the fine colour checker mushes, bar edges bleed) while the thin black <strong>luma</strong> lines stay razor-sharp. <strong>4:2:0</strong> = H.264/H.265 and camera codecs; <strong>4:2:2</strong> = broadcast production; green-screen/VFX need <strong>4:4:4</strong>.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {SAMPLING.map((s,i)=>(
          <button key={s.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{s.label}</button>
        ))}
        <button onClick={()=>setGrid(g=>!g)} style={{...styles.btnSecondary,...(grid?{borderColor:"#22d3ee",color:"#22d3ee"}:{})}}>
          Chroma grid: {grid?"ON":"OFF"}
        </button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12,display:"block",maxWidth:"100%",marginBottom:12}}>
        <canvas ref={canvasRef} style={{display:"block",width:"100%"}}/>
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
  "S-Log2":  x => 0.432699 * Math.log10(Math.max(0,155*x/219) + 0.037584) + 0.646596,   // Sony S-Log2 (18% grey → 0.32)
  "S-Log3":  x => x >= 0.01125 ? (420 + Math.log10((x + 0.01)/0.19)*261.5)/1023 : (x*(171.2102946-95)/0.01125 + 95)/1023,  // Sony S-Log3
  "Log-C":   x => x > 0.010591 ? 0.247190 * Math.log10(5.555556 * x + 0.052272) + 0.385537 : x * 5.367655 + 0.092809,
  "V-Log":   x => x < 0.01 ? 5.6 * x + 0.125 : 0.241514 * Math.log10(x + 0.00873) + 0.598206,
  "C-Log3":  x => x < 0.000511 ? 5.48228 * x + 0.073059 : 0.332424 * Math.log10(2.3069 * x + 0.888282) + 0.573261,
};
const LOG_COLORS = {
  "Linear":"#9ca3af","Rec.709":"#60a5fa","S-Log2":"#f59e0b","S-Log3":"#fb923c",
  "Log-C":"#34d399","V-Log":"#a78bfa","C-Log3":"#f472b6",
};

function ModulePictureProfiles({ image }) {
  const [active, setActive] = useState(["Rec.709"]);
  const [hoveredX, setHoveredX] = useState(null);
  const canvasRef = useRef();
  const graphRef = useRef();
  const W=320, H=240;

  const toggle = name => setActive([name]);   // single-select

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
      const curveName=active[0]||"Rec.709";
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
// Gamut primaries in CIE 1931 xy (verified against colour-science datasets)
const GAMUTS = {
  "sRGB / Rec.709": { color:"#60a5fa", points:[[0.640,0.330],[0.300,0.600],[0.150,0.060]], note:"Web, consumer displays, HD broadcast (ITU-R BT.709)." },
  "DCI-P3":         { color:"#34d399", points:[[0.680,0.320],[0.265,0.690],[0.150,0.060]], note:"Digital cinema projection (SMPTE ST 2087). ~25% wider than Rec.709." },
  "Rec.2020":       { color:"#f59e0b", points:[[0.708,0.292],[0.170,0.797],[0.131,0.046]], note:"UHDTV / HDR target (ITU-R BT.2020). ~75% of the visible spectrum." },
  "DaVinci WG":     { color:"#22d3ee", points:[[0.8000,0.3130],[0.1682,0.9877],[0.0790,-0.1155]], note:"DaVinci Wide Gamut — Resolve's internal working space." },
  "ARRI AWG3":      { color:"#a3e635", points:[[0.6840,0.3130],[0.2210,0.8480],[0.0861,-0.1020]], note:"ARRI ALEXA Wide Gamut 3 — the camera's native encoding." },
  "Sony SG3.Cine":  { color:"#fb923c", points:[[0.766,0.275],[0.225,0.800],[0.089,-0.087]], note:"Sony S-Gamut3.Cine — practical cine variant of S-Gamut3." },
  "Canon Cinema":   { color:"#e879f9", points:[[0.7400,0.2700],[0.1700,1.1400],[0.0800,-0.1000]], note:"Canon Cinema Gamut — its green primary is imaginary (beyond the visible spectrum)." },
  "RED Wide Gamut": { color:"#ef4444", points:[[0.780308,0.304253],[0.121595,1.493994],[0.095612,-0.084589]], note:"REDWideGamutRGB — very large; green sits far beyond the visible spectrum." },
  "ACES AP1":       { color:"#a78bfa", points:[[0.713,0.293],[0.165,0.830],[0.128,0.044]], note:"ACES working/grading gamut (ACEScc / ACEScct)." },
  "ACES AP0":       { color:"#f9a8d4", points:[[0.7347,0.2653],[0.0000,1.0000],[0.0001,-0.0770]], note:"ACES AP0 — scene-referred exchange space; encloses the entire visible spectrum (SMPTE ST 2065-1)." },
};

// Real CIE 1931 spectral locus (2° observer), 380–700 nm every 5 nm → (x,y)
const CIE_LOCUS = [
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
// Chromaticity (x,y) → displayable sRGB (D65). Out-of-gamut clamped + normalised.
function cieXYtoRGB(x,y){
  if(y<=0) return null;
  const X=x/y, Y=1, Z=(1-x-y)/y;
  let r= 3.2406*X -1.5372*Y -0.4986*Z, g=-0.9689*X +1.8758*Y +0.0415*Z, b= 0.0557*X -0.2040*Y +1.0570*Z;
  r=Math.max(0,r); g=Math.max(0,g); b=Math.max(0,b);
  const m=Math.max(r,g,b); if(m>0){ r/=m; g/=m; b/=m; }
  const enc=v=> v<=0.0031308 ? 12.92*v : 1.055*Math.pow(v,1/2.4)-0.055;
  return [Math.round(enc(r)*255),Math.round(enc(g)*255),Math.round(enc(b)*255)];
}

function ModuleColorSpaces() {
  const [active, setActive] = useState(["sRGB / Rec.709"]);
  const canvasRef = useRef();
  const toggle=name=>setActive(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name]);

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    const ML=34, MB=24, MT=14, MR=14;
    const W=Math.min(c.parentElement?.clientWidth-24||520,540);
    // Dynamic ranges: fit the locus + every active gamut (camera greens go far above y=1)
    let xs=CIE_LOCUS.map(p=>p[0]).concat([0.3127]), ys=CIE_LOCUS.map(p=>p[1]).concat([0.3290]);
    active.forEach(n=>GAMUTS[n]?.points.forEach(([x,y])=>{xs.push(x);ys.push(y);}));
    const X0=Math.min(...xs)-0.03, X1=Math.max(...xs)+0.03, Y0=Math.min(...ys)-0.03, Y1=Math.max(...ys)+0.05;
    const plotW=W-ML-MR, unit=plotW/(X1-X0), H=Math.round(MT+MB+(Y1-Y0)*unit);
    c.width=W; c.height=H;
    const ctx=c.getContext("2d");
    const mapXY=(x,y)=>([ Math.round(ML+((x-X0)/(X1-X0))*plotW), Math.round(MT+(1-(y-Y0)/(Y1-Y0))*(H-MT-MB)) ]);
    ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
    const locusPath=()=>{ ctx.beginPath(); CIE_LOCUS.forEach(([x,y],i)=>{ const [px,py]=mapXY(x,y); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }); ctx.closePath(); };
    // true-colour chromaticity fill masked to the locus
    const off=document.createElement("canvas"); off.width=W; off.height=H;
    const img=off.getContext("2d").createImageData(W,H); const dd=img.data;
    for(let py=0;py<H;py++) for(let px=0;px<W;px++){
      const x=X0+((px-ML)/plotW)*(X1-X0), y=Y0+(1-(py-MT)/(H-MT-MB))*(Y1-Y0);
      const rgb=cieXYtoRGB(x,y);
      if(rgb){ const i=(py*W+px)*4; dd[i]=rgb[0]; dd[i+1]=rgb[1]; dd[i+2]=rgb[2]; dd[i+3]=255; }
    }
    off.getContext("2d").putImageData(img,0,0);
    ctx.save(); locusPath(); ctx.clip(); ctx.drawImage(off,0,0); ctx.restore();
    locusPath(); ctx.strokeStyle="rgba(255,255,255,0.45)"; ctx.lineWidth=1.2; ctx.stroke();
    const [wpx,wpy]=mapXY(0.3127,0.3290);
    ctx.fillStyle="#000"; ctx.beginPath();ctx.arc(wpx,wpy,4,0,7);ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath();ctx.arc(wpx,wpy,2.5,0,7);ctx.fill();
    ctx.fillStyle="#e5e7eb"; ctx.font="10px monospace"; ctx.fillText("D65",wpx+6,wpy+4);
    Object.entries(GAMUTS).forEach(([name,{color,points}])=>{
      if(!active.includes(name)) return;
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.fillStyle=color+"12";
      ctx.beginPath(); points.forEach(([x,y],i)=>{ const [px,py]=mapXY(x,y); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }); ctx.closePath(); ctx.fill(); ctx.stroke();
      points.forEach(([x,y])=>{ const [px,py]=mapXY(x,y); ctx.fillStyle=color; ctx.beginPath();ctx.arc(px,py,2.5,0,7);ctx.fill(); });
      const cx=points.reduce((s,[x])=>s+x,0)/3, cy=points.reduce((s,[,y])=>s+y,0)/3; const [lx,ly]=mapXY(cx,cy);
      ctx.fillStyle=color; ctx.font="bold 10px monospace"; ctx.fillText(name.split(" ")[0],lx-14,ly);
    });
    ctx.fillStyle="#6b7280"; ctx.font="10px monospace";
    ctx.fillText("x",W-12,H-4); ctx.fillText("y",4,12);
    ctx.fillStyle="#4b5563";
    for(let v=Math.ceil(Math.max(0,X0)/0.2)*0.2; v<=X1; v+=0.2){ const [px]=mapXY(v,0); ctx.fillText(v.toFixed(1),px-8,H-4); }
    for(let v=Math.ceil(Math.max(0,Y0)/0.2)*0.2; v<=Y1; v+=0.2){ const [,py]=mapXY(0,v); ctx.fillText(v.toFixed(1),4,py+4); }
  },[active]);

  return (
    <div>
      <InfoBox>
        The <strong>CIE 1931 chromaticity diagram</strong> maps every visible colour as an (x,y) coordinate; colour spaces are triangular <strong>gamuts</strong> whose corners are the red/green/blue primaries. Delivery spaces (<strong>Rec.709</strong>, <strong>DCI-P3</strong>, <strong>Rec.2020</strong>) sit inside the horseshoe. <strong>Camera and working gamuts</strong> (DaVinci WG, ARRI, Sony, Canon, RED, ACES) are much larger — some use <em>imaginary primaries</em> outside the visible spectrum (Canon/RED greens climb past y=1), which is why their triangles extend beyond the horseshoe. The diagram auto-scales to fit whatever you enable. Grading is always a mapping from a wider capture gamut into the delivery target.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {Object.entries(GAMUTS).map(([name,{color}])=>(
          <button key={name} onClick={()=>toggle(name)}
            style={{...styles.btnChip,...(active.includes(name)?{borderColor:color,color:color,background:color+"22"}:{})}}>
            {name}
          </button>
        ))}
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
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
        <canvas ref={canvasRef} style={{display:"block",width:"100%",maxWidth:720}}/>
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
        <canvas ref={canvasRef} style={{display:"block",width:"100%",maxWidth:720}}/>
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
        <div style={{color:"#9ca3af",fontSize:12,marginBottom:8}}>Bit depth: <strong style={{color:"#f59e0b"}}>{bits}-bit ({Math.pow(2,bits).toLocaleString()} steps)</strong></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
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
      // Frame outline only (no dim overlay → no hard contrast line at the crop edge).
      // Dark backing stroke keeps the amber frame readable on both sky and ground.
      fx.strokeStyle="rgba(0,0,0,0.55)"; fx.lineWidth=4; fx.strokeRect(rx,ry,rw,rh);
      fx.strokeStyle="#f59e0b"; fx.lineWidth=2; fx.strokeRect(rx,ry,rw,rh);
      // corner ticks
      fx.strokeStyle="#f59e0b"; fx.lineWidth=2; const tk=Math.min(rw,rh)*0.12;
      [[rx,ry,1,1],[rx+rw,ry,-1,1],[rx,ry+rh,1,-1],[rx+rw,ry+rh,-1,-1]].forEach(([px,py,sx,sy])=>{
        fx.beginPath(); fx.moveTo(px+sx*tk,py); fx.lineTo(px,py); fx.lineTo(px,py+sy*tk); fx.stroke();
      });
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
// Approximate real-world distance (m) of each scene layer, for DoF blur.
const LAYER_DIST = { sky:600, mountains:300, hills:120, ground:22, house:16, midtree:8, subject:5, foreground:1.8 };

function ModuleDepthOfField() {
  const [fstop, setFstop] = useState(2.8);
  const [focal, setFocal] = useState(50);
  const [distance, setDistance] = useState(5);
  const canvasRef = useRef();
  const sideRef = useRef();

  // Thin-lens DoF limits (CoC 0.03mm, 35mm format). All in mm.
  const CoC=0.03, f=focal, N=fstop, s=distance*1000;
  const Hmm = f*f/(N*CoC)+f;                 // hyperfocal
  const Dn = (s*(Hmm-f))/(Hmm+s-2*f);
  const farInf = (Hmm-s)<=0;
  const Df = farInf ? Infinity : (s*(Hmm-f))/(Hmm-s);
  const dofM = farInf ? Infinity : (Df-Dn)/1000;

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    const W=Math.min(c.parentElement?.clientWidth-32||840,840);
    c.width=W; c.height=Math.round(W*9/16); const H=c.height;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
    const Dfmm=distance*1000;
    const blurFor=depthM=>{
      const D=depthM*1000;
      const coc=(f*f/(N*Math.max(1,Dfmm-f)))*Math.abs(D-Dfmm)/D;   // CoC in mm
      return Math.min(24, coc*22);                                 // → display px
    };
    // Scene layers, each blurred by its distance from the focus plane
    SCENE_LAYERS.forEach(l=>{
      const b=blurFor(LAYER_DIST[l.name] ?? l.depth);
      ctx.save();
      ctx.filter = b>0.4 ? `blur(${b.toFixed(1)}px)` : "none";
      ctx.translate(W/2,H/2); ctx.scale(1.06,1.06); ctx.translate(-W/2,-H/2);   // overscan hides blurred edges
      l.draw(ctx,W,H);
      ctx.restore();
    });
    ctx.filter="none";
    // HUD on the front view
    ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,W,24);
    ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
    ctx.fillText(`f/${fstop}  ${focal}mm  focus ${distance}m  ·  DoF ${dofM===Infinity?"∞":dofM.toFixed(2)+"m"}`,10,16);

    // SIDE VIEW — depth cross-section with the in-focus "force field"
    const sc=sideRef.current; if(!sc) return;
    const SW=W, SH=Math.round(W*0.34); sc.width=SW; sc.height=SH;
    const sx=sc.getContext("2d");
    sx.fillStyle="#0d1117"; sx.fillRect(0,0,SW,SH);
    const x1=54, x2=SW-22, groundY=SH-28, K=9;
    const dmap=d=> x1 + (d/(d+K))*(x2-x1);            // hyperbolic depth mapping (∞ → x2)
    sx.strokeStyle="#1f2937"; sx.lineWidth=1; sx.beginPath();sx.moveTo(x1,groundY);sx.lineTo(x2,groundY);sx.stroke();
    // DoF "force field" band around the focus plane
    const dnX=dmap(Dn/1000), dfX=farInf?x2:dmap(Df/1000);
    const g=sx.createLinearGradient(dnX,0,dfX,0);
    g.addColorStop(0,"rgba(52,211,153,0.06)");g.addColorStop(0.5,"rgba(52,211,153,0.30)");g.addColorStop(1,"rgba(52,211,153,0.06)");
    sx.fillStyle=g; sx.fillRect(dnX,18,Math.max(2,dfX-dnX),groundY-18);
    sx.strokeStyle="rgba(52,211,153,0.6)"; sx.setLineDash([4,3]);
    sx.beginPath();sx.moveTo(dnX,18);sx.lineTo(dnX,groundY);sx.stroke();
    sx.beginPath();sx.moveTo(dfX,18);sx.lineTo(dfX,groundY);sx.stroke(); sx.setLineDash([]);
    // lens cone from the camera to the focus band
    sx.strokeStyle="rgba(148,163,184,0.22)"; sx.beginPath();sx.moveTo(x1,groundY-7);sx.lineTo(dfX,20);sx.moveTo(x1,groundY-7);sx.lineTo(dfX,groundY);sx.stroke();
    // distance ticks
    sx.textAlign="center"; sx.font="9px monospace";
    [1,2,5,10,20,40].forEach(d=>{ const x=dmap(d); sx.strokeStyle="#374151"; sx.beginPath();sx.moveTo(x,groundY);sx.lineTo(x,groundY+4);sx.stroke(); sx.fillStyle="#4b5563"; sx.fillText(d+"m",x,groundY+15); });
    sx.fillStyle="#4b5563"; sx.fillText("∞",x2,groundY+15);
    // focus plane
    const fX=dmap(distance);
    sx.strokeStyle="#f59e0b"; sx.lineWidth=2; sx.beginPath();sx.moveTo(fX,12);sx.lineTo(fX,groundY);sx.stroke();
    sx.fillStyle="#f59e0b"; sx.fillText("focus",fX,9);
    // camera
    sx.fillStyle="#9ca3af"; sx.fillRect(x1-15,groundY-13,15,13);
    sx.beginPath();sx.moveTo(x1,groundY-10);sx.lineTo(x1+7,groundY-6.5);sx.lineTo(x1,groundY-3);sx.closePath();sx.fill();
    // element markers (lit green when inside the DoF band)
    [["bush",1.8,"#2c4a22"],["subject",5,"#c0563d"],["tree",8,"#3f6a3c"],["house",16,"#8a5a3c"]].forEach(([lbl,d,col])=>{
      const x=dmap(d), sharp = d>=Dn/1000 && d<=(farInf?1e9:Df/1000);
      sx.fillStyle=col; sx.fillRect(x-4,groundY-22,8,22);
      sx.strokeStyle=sharp?"#34d399":"rgba(255,255,255,0.18)"; sx.lineWidth=sharp?2:1; sx.strokeRect(x-4,groundY-22,8,22);
      sx.fillStyle=sharp?"#34d399":"#6b7280"; sx.fillText(lbl,x,groundY-26);
    });
    sx.textAlign="left"; sx.fillStyle="#22d3ee"; sx.font="bold 11px monospace";
    sx.fillText("SIDE VIEW — green zone = in focus (moves & widens with your settings)",8,14);
  },[fstop,focal,distance]);

  return (
    <div>
      <InfoBox>
        <strong>Depth of Field (DoF)</strong> is the range of distances that appears acceptably sharp. It depends on <em>aperture</em> (smaller f-stop = wider = shallower DoF), <em>focal length</em> (longer = shallower), and <em>focus distance</em> (closer = shallower). Here the <strong>scene elements at different distances</strong> (foreground bush ~1.8 m, subject ~5 m, tree ~8 m, house ~16 m, hills/mountains far away) blur according to a thin-lens <strong>Circle of Confusion</strong> model (0.03 mm, 35 mm format). Open the aperture or move focus and watch which planes fall out of focus. The <strong>side view</strong> below is a bird's-eye cross-section: the camera on the left, distance running right, and the green <strong>in-focus zone</strong> (the depth of field) as a band that moves with the focus plane and <em>widens</em> as you stop down or shorten the lens — elements light up green when they fall inside it. Beyond the <em>hyperfocal distance</em> everything to infinity is sharp. Shallow DoF isolates the subject; deep DoF holds context.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:12}}>
        <label style={styles.label}>
          Aperture: <strong style={{color:"#f59e0b"}}>f/{fstop}</strong>
          <input type="range" min={1.2} max={22} step={0.1} value={fstop} onChange={e=>setFstop(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>
          Focal length: <strong style={{color:"#f59e0b"}}>{focal}mm</strong>
          <input type="range" min={16} max={200} step={1} value={focal} onChange={e=>setFocal(+e.target.value)} style={styles.slider}/>
        </label>
        <label style={styles.label}>
          Focus distance: <strong style={{color:"#f59e0b"}}>{distance}m</strong>
          <input type="range" min={1} max={40} step={0.5} value={distance} onChange={e=>setDistance(+e.target.value)} style={styles.slider}/>
        </label>
      </div>
      <div style={{...styles.statRow,marginBottom:12}}>
        <StatBadge label="DoF" value={dofM===Infinity?"∞":dofM.toFixed(2)+"m"}/>
        <StatBadge label="Near limit" value={(Dn/1000).toFixed(2)+"m"}/>
        <StatBadge label="Far limit" value={farInf?"∞":(Df/1000).toFixed(2)+"m"}/>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12,display:"block",maxWidth:"100%",marginBottom:10}}>
        <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>FRONT VIEW (what the lens sees)</div>
        <canvas ref={canvasRef} style={{display:"block",width:"100%",borderRadius:4}}/>
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12,display:"block",maxWidth:"100%"}}>
        <canvas ref={sideRef} style={{display:"block",width:"100%"}}/>
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
// Black-body colour temperature → sRGB (Tanner Helland approximation)
function kelvinToRGB(K){
  const t=K/100; const cl=v=>Math.max(0,Math.min(255,v));
  let r,g,b;
  r = t<=66 ? 255 : 329.698727*Math.pow(t-60,-0.1332047);
  g = t<=66 ? 99.4708025861*Math.log(t)-161.1195681661 : 288.1221695283*Math.pow(t-60,-0.0755148492);
  b = t>=66 ? 255 : (t<=19 ? 0 : 138.5177312231*Math.log(t-10)-305.0447927307);
  return [cl(r),cl(g),cl(b)];
}
const CAMERA_WB = [
  { K:3200, label:"Tungsten", icon:"💡" },
  { K:4000, label:"Fluorescent", icon:"🏢" },
  { K:5500, label:"Daylight", icon:"☀️" },
  { K:6500, label:"Cloudy", icon:"☁️" },
  { K:7500, label:"Shade", icon:"⛅" },
];
const LIGHT_SOURCES = [
  { K:1900, label:"Candle / fire", icon:"🕯️" },
  { K:2700, label:"Tungsten bulb", icon:"💡" },
  { K:3200, label:"Studio tungsten", icon:"🎬" },
  { K:4000, label:"Warm LED", icon:"🔆" },
  { K:4500, label:"Fluorescent", icon:"🏢" },
  { K:5500, label:"Midday sun", icon:"☀️" },
  { K:6500, label:"Overcast", icon:"☁️" },
  { K:7500, label:"Open shade", icon:"⛅" },
];

function ModuleColorTemp() {
  const [wb, setWb] = useState(2);   // Daylight
  const [src, setSrc] = useState(5); // Midday sun
  const canvasRef = useRef();
  const wbK=CAMERA_WB[wb].K, srcK=LIGHT_SOURCES[src].K;
  // White-balance cast: light colour corrected by the camera's assumed white → tint on neutrals
  const s=kelvinToRGB(srcK), w=kelvinToRGB(wbK);
  let g=[s[0]/w[0], s[1]/w[1], s[2]/w[2]]; const mx=Math.max(...g); g=g.map(v=>v/mx);
  const cast=[Math.round(g[0]*255),Math.round(g[1]*255),Math.round(g[2]*255)];
  const castCss=`rgb(${cast[0]},${cast[1]},${cast[2]})`;
  const dK=wbK-srcK;
  const verdict = Math.abs(dK)<=300 ? ["Neutral — whites stay white (WB matches the light)","#34d399"]
    : dK>0 ? ["Warm / orange cast — camera WB is set higher than the light","#f59e0b"]
           : ["Cool / blue cast — camera WB is set lower than the light","#60a5fa"];
  const tint=(base)=>`rgb(${Math.round(base[0]*cast[0]/255)},${Math.round(base[1]*cast[1]/255)},${Math.round(base[2]*cast[2]/255)})`;

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    const W=Math.min(c.parentElement?.clientWidth-32||560,600); c.width=W; c.height=Math.round(W*9/16);
    const ctx=c.getContext("2d");
    drawScene(ctx,c.width,c.height);
    ctx.globalCompositeOperation="multiply"; ctx.fillStyle=castCss; ctx.fillRect(0,0,c.width,c.height);
    ctx.globalCompositeOperation="source-over";
    ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,c.width,24);
    ctx.fillStyle="#f59e0b"; ctx.font="bold 12px monospace";
    ctx.fillText(`WB ${wbK}K  ·  light ${srcK}K  ·  ${dK>0?"+":""}${dK}K`,10,16);
  },[wb,src,castCss]);

  const Row=({items,active,onPick,swatchK})=>(
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {items.map((it,i)=>(
        <button key={i} onClick={()=>onPick(i)} style={{
          ...(i===active?styles.btnActive:styles.btnChip),
          display:"flex",alignItems:"center",gap:5,
        }}>
          <span style={{width:12,height:12,borderRadius:3,display:"inline-block",background:`rgb(${kelvinToRGB(it.K).join(",")})`,border:"1px solid #0006"}}/>
          {it.icon} {it.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <InfoBox>
        <strong>Colour temperature</strong> (Kelvin) describes a light's colour vs a black-body radiator: <strong>lower K = warmer (reddish)</strong>, <strong>higher K = cooler (bluish)</strong>. The camera's <strong>white balance</strong> tells it what colour to treat as white. When <em>WB matches the light</em>, whites stay white. When they differ, you get a <strong>cast</strong>: set WB higher than the light → warm/orange image; set it lower → blue image. Pick a camera WB mode and a real light source below and watch the cast on the scene. This mismatch is often used <em>creatively</em> (e.g. tungsten WB under daylight for a cold look). D65 (6500K) is the reference white for sRGB/Rec.709.
      </InfoBox>
      <div style={{marginBottom:12}}>
        <div style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",marginBottom:6}}>📷 CAMERA WHITE BALANCE</div>
        <Row items={CAMERA_WB} active={wb} onPick={setWb}/>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",marginBottom:6}}>💡 SCENE LIGHT SOURCE</div>
        <Row items={LIGHT_SOURCES} active={src} onPick={setSrc}/>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 360px",minWidth:280,background:"#111",borderRadius:8,padding:12}}>
          <canvas ref={canvasRef} style={{display:"block",width:"100%",borderRadius:4}}/>
          <div style={{marginTop:8,color:verdict[1],fontSize:13,fontWeight:"bold"}}>{verdict[0]}</div>
        </div>
        <div style={{flex:"0 1 auto",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8}}>NEUTRAL REFERENCES</div>
          {[["White",[245,245,245]],["Grey",[150,150,150]],["Skin",[224,172,120]]].map(([lbl,base])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{width:44,height:28,borderRadius:4,background:tint(base),border:"1px solid #0008"}}/>
              <span style={{color:"#9ca3af",fontSize:12,fontFamily:"monospace"}}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: RAW vs Compressed
// ─────────────────────────────────────────────
// Scene-linear test image with real headroom (sky/sun go well above 1.0)
function rawSceneLinear(IW,IH){
  const buf=new Float32Array(IW*IH*3);
  for(let y=0;y<IH;y++) for(let x=0;x<IW;x++){
    const p=(y*IW+x)*3, u=x/IW, v=y/IH; let r,g,b;
    if(v<0.6){ // sky with cloud texture + a bright sun (into the headroom)
      const base=0.5+(0.6-v)/0.6*2.0;
      const cloud=0.55+0.45*(0.5+0.5*Math.sin(u*15+v*6))*(0.6+0.4*Math.sin(u*5-v*3));
      let s=base*cloud;
      const dd=Math.hypot(u-0.80,(v-0.17)*1.5); s+=Math.max(0,(0.11-dd))/0.11*4.5;
      r=s*1.03; g=s; b=s*0.86;
    } else { // ground with texture + a dark and a bright object (shadow/highlight detail)
      const base=0.10+(v-0.6)/0.4*0.30;
      const tex=0.8+0.35*Math.sin(u*26)*Math.sin(v*22+u*4);
      r=base*tex*0.78; g=base*tex*0.92; b=base*tex*0.55;
      if(Math.hypot(u-0.3,v-0.8)<0.06) { r*=0.25; g*=0.25; b*=0.25; }        // deep shadow
      if(Math.hypot(u-0.62,v-0.82)<0.05){ r+=2.2; g+=2.2; b+=2.0; }          // specular highlight
    }
    buf[p]=Math.max(0,r); buf[p+1]=Math.max(0,g); buf[p+2]=Math.max(0,b);
  }
  return buf;
}

function ModuleRAW() {
  const [exposure, setExposure] = useState(0);
  const [mode, setMode] = useState("RAW");
  const imgRef = useRef();
  const wfRef = useRef();
  const sceneRef = useRef(null);
  const dimRef = useRef({IW:0,IH:0});

  useEffect(()=>{
    const ic=imgRef.current, wc=wfRef.current; if(!ic||!wc) return;
    const W=Math.min(ic.parentElement?.clientWidth-24||440,480);
    const IW=Math.round(W), IH=Math.round(W*9/16);
    ic.width=IW; ic.height=IH;
    if(!sceneRef.current || dimRef.current.IW!==IW){ sceneRef.current=rawSceneLinear(IW,IH); dimRef.current={IW,IH}; }
    const scene=sceneRef.current, gain=Math.pow(2,exposure);
    const enc=v=> v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;
    const ictx=ic.getContext("2d"); const idata=ictx.createImageData(IW,IH); const d=idata.data;
    const clip=new Uint8Array(IW*IH);
    for(let p=0,i=0;p<IW*IH;p++,i+=4){
      for(let ch=0;ch<3;ch++){
        let lin=scene[p*3+ch];
        if(mode!=="RAW") lin=Math.min(lin,1.0);   // compressed clips at capture (no headroom)
        lin*=gain;                                  // exposure
        let disp=lin; if(disp>=1){ disp=1; clip[p]=1; }
        d[i+ch]=Math.round(enc(disp)*255);
      }
      d[i+3]=255;
    }
    // waveform from the displayed luma (before zebra)
    const WW=W, WH=Math.round(W*0.6); wc.width=WW; wc.height=WH;
    const acc=new Float32Array(WW*WH);
    for(let y=0;y<IH;y++) for(let x=0;x<IW;x++){
      const i=(y*IW+x)*4, lum=luma709(d[i],d[i+1],d[i+2])/255;
      const wx=Math.floor(x/IW*WW), wy=Math.floor((WH-8)-lum*(WH-16));
      if(wx>=0&&wx<WW&&wy>=0&&wy<WH) acc[wy*WW+wx]++;
    }
    // zebra on display-clipped highlights
    for(let p=0,i=0;p<IW*IH;p++,i+=4){ if(clip[p]){ const x=p%IW,y=(p/IW)|0; if((x+y)%6<3){ d[i]=255;d[i+1]=45;d[i+2]=45; } } }
    ictx.putImageData(idata,0,0);
    ictx.fillStyle="rgba(0,0,0,0.7)"; ictx.fillRect(0,0,IW,20);
    ictx.fillStyle=mode==="RAW"?"#34d399":"#f87171"; ictx.font="bold 11px monospace";
    ictx.fillText(`${mode}  ·  EV ${exposure>=0?"+":""}${exposure}`,8,14);
    // render waveform
    const wctx=wc.getContext("2d"); const out=wctx.createImageData(WW,WH); const od=out.data;
    for(let k=0;k<od.length;k+=4){ od[k]=7;od[k+1]=9;od[k+2]=13;od[k+3]=255; }
    let mx=0; for(let k=0;k<acc.length;k++) if(acc[k]>mx)mx=acc[k]; const norm=mx*0.2+1e-6;
    const col=mode==="RAW"?[120,230,150]:[240,120,120];
    for(let k=0;k<acc.length;k++){ if(acc[k]<=0)continue; const t=Math.min(1,acc[k]/norm);
      od[k*4]=Math.min(255,od[k*4]+col[0]*t); od[k*4+1]=Math.min(255,od[k*4+1]+col[1]*t); od[k*4+2]=Math.min(255,od[k*4+2]+col[2]*t); }
    wctx.putImageData(out,0,0);
    wctx.strokeStyle="rgba(255,255,255,0.07)"; wctx.fillStyle="#374151"; wctx.font="9px monospace"; wctx.lineWidth=1;
    for(let pp=0;pp<=100;pp+=25){ const y=(WH-8)-(pp/100)*(WH-16); wctx.beginPath();wctx.moveTo(18,y);wctx.lineTo(WW,y);wctx.stroke(); wctx.fillText(pp+"",2,y+3); }
    wctx.strokeStyle="rgba(248,113,113,0.55)"; const yc=(WH-8)-(WH-16); wctx.beginPath();wctx.moveTo(18,yc+0.5);wctx.lineTo(WW,yc+0.5);wctx.stroke();
    wctx.fillStyle="rgba(248,113,113,0.9)"; wctx.fillText("clip",WW-26,yc+11);
  },[exposure,mode]);

  return (
    <div>
      <InfoBox>
        <strong>RAW</strong> keeps the unprocessed sensor data with <strong>highlight headroom</strong> — several stops of luminance sit <em>above</em> the display clip point, waiting to be pulled back. <strong>Compressed</strong> formats (H.264/H.265) bake the exposure and <em>clip at capture</em>: anything above white is thrown away for good. Here the scene is over-exposed (the sky and sun clip, shown by the red zebras). Now pull <strong>Exposure</strong> down and watch the <strong>waveform</strong>: in <span style={{color:"#34d399"}}>RAW</span> the highlights come back down <em>with detail</em> (the trace spreads out below the clip line — recovered cloud/sun texture). In <span style={{color:"#f87171"}}>H.264</span> the clipped highlights just move down as a <em>flat line</em> — no detail returns, because it was never recorded. LOG to ProRes/BRAW is the middle ground.
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
          <input type="range" min={-5} max={2} step={0.5} value={exposure} onChange={e=>setExposure(+e.target.value)} style={{...styles.slider,width:200}}/>
        </label>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 300px",minWidth:260,background:"#111",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>IMAGE</div>
          <canvas ref={imgRef} style={{display:"block",width:"100%",borderRadius:4}}/>
        </div>
        <div style={{flex:"1 1 260px",minWidth:220,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:mode==="RAW"?"#34d399":"#f87171",fontSize:10,fontFamily:"monospace",marginBottom:6,letterSpacing:"0.08em"}}>WAVEFORM (luma, IRE)</div>
          <canvas ref={wfRef} style={{display:"block",width:"100%"}}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Camera Movement
// ─────────────────────────────────────────────
const MOVES = [
  { key:"pan", label:"Pan", color:"#f59e0b", note:"Rotation around the camera's vertical axis — the camera stays put and turns. Reveals space or follows action. Being a rotation, it produces almost no parallax." },
  { key:"tilt", label:"Tilt", color:"#60a5fa", note:"Rotation around the horizontal axis — the camera looks up or down from a fixed position. Establishes height and scale." },
  { key:"track", label:"Track / Truck", color:"#34d399", note:"The camera physically travels sideways (dolly/slider). Watch the PARALLAX: near objects slide past faster than far ones — the true signature of a translational move." },
  { key:"dolly", label:"Dolly in/out", color:"#34d399", note:"The camera physically moves toward/away from the subject. Near objects grow much faster than the background → the spatial relationship changes. This is NOT a zoom." },
  { key:"zoom", label:"Zoom", color:"#f472b6", note:"Focal length changes — everything magnifies UNIFORMLY, with NO parallax. Compare with dolly: here the background relationship stays identical. Optical, not physical." },
  { key:"crane", label:"Crane / Jib", color:"#a78bfa", note:"The camera rises or descends. Near foreground shifts vertically more than the background — parallax again betrays the physical move." },
  { key:"handheld", label:"Handheld", color:"#f87171", note:"Operator-held: organic, unstable jitter and micro-rotation. Documentary realism, urgency, intimacy (Dogme 95, the Bourne films)." },
];

// Per-layer transform for a movement. p = parallax factor (near = larger).
function moveTransform(move, osc, t, p, W, H){
  let dx=0, dy=0, rot=0, sc=1;
  if(move==="pan") dx=osc*W*0.09;               // rotation ≈ uniform shift, ~no parallax
  else if(move==="tilt") dy=osc*H*0.09;
  else if(move==="track") dx=osc*W*0.085*p;     // translation → parallax
  else if(move==="crane") dy=osc*H*0.085*p;
  else if(move==="dolly") sc=1+osc*0.14*p;      // near scales more → perspective change
  else if(move==="zoom") sc=1+osc*0.14;         // uniform → no parallax
  else if(move==="handheld"){ dx=Math.sin(t*7.3)*5+Math.sin(t*13.1)*3; dy=Math.sin(t*5.7)*4+Math.sin(t*11.9)*2; rot=Math.sin(t*4.1)*0.012; }
  return {dx,dy,rot,sc};
}

function ModuleCameraMovement() {
  const [sel, setSel] = useState(3); // dolly — the headline demo
  const canvasRef = useRef();
  const animRef = useRef();
  const M = MOVES[sel];

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=800; c.height=450;
    const W=c.width, H=c.height, O=1.22;   // overscan hides edges when layers shift
    const ctx=c.getContext("2d");
    const move=M.key;
    const parallax=d=>Math.max(0.04,Math.min(3.2, 5/d));
    let t0=null;
    const draw=(now)=>{
      if(t0===null) t0=now;
      const t=(now-t0)/1000, osc=Math.sin(t*0.9);
      ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
      SCENE_LAYERS.forEach(l=>{
        const {dx,dy,rot,sc}=moveTransform(move,osc,t,parallax(l.depth),W,H);
        ctx.save();
        ctx.translate(W/2+dx, H/2+dy); ctx.rotate(rot); ctx.scale(O*sc,O*sc); ctx.translate(-W/2,-H/2);
        l.draw(ctx,W,H);
        ctx.restore();
      });
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,W,26);
      ctx.fillStyle=M.color; ctx.font="bold 13px monospace";
      const tag = move==="dolly"?"DOLLY — background relationship CHANGES (parallax)":move==="zoom"?"ZOOM — uniform magnify, NO parallax":M.label.toUpperCase();
      ctx.fillText(tag,12,18);
      animRef.current=requestAnimationFrame(draw);
    };
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[sel]);

  return (
    <div>
      <InfoBox>
        Camera movements are a primary tool of visual storytelling — and all act on the <strong>same scene</strong> here so you can compare them. <strong>Rotations</strong> (pan, tilt) keep the camera in place and turn it. <strong>Translations</strong> (track, dolly, crane) physically move the camera through space, so nearer objects shift more than distant ones — <strong>parallax</strong> is the tell. <strong>Zoom is NOT a camera movement</strong>: it changes focal length and magnifies everything uniformly, with no parallax. Compare <em>Dolly</em> and <em>Zoom</em> back-to-back — the background relationship changes on the dolly and stays fixed on the zoom. Combining both in opposition gives the <em>Hitchcock dolly-zoom</em> (Vertigo effect).
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {MOVES.map((m,i)=>(
          <button key={m.key} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{m.label}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
      <p style={styles.noteText}>📌 {M.note}</p>
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

      {/* Drop-frame visual explainer */}
      <div style={{marginTop:20,background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:"16px 18px"}}>
        <div style={{color:"#f59e0b",fontSize:13,fontWeight:"bold",fontFamily:"monospace",marginBottom:8}}>What is drop-frame?</div>
        <p style={{color:"#d1d5db",fontSize:13,lineHeight:1.6,margin:"0 0 14px"}}>
          NTSC video runs at <strong>29.97 fps</strong>, but timecode counts a whole <strong>30 frames every second</strong>.
          Counting 30 when only 29.97 actually happen makes the timecode run <strong>ahead of the real clock</strong> —
          about <strong style={{color:"#f87171"}}>+3.6 s every hour</strong>. <strong>Drop-frame</strong> fixes this by
          <em> skipping the frame numbers</em> <code style={{color:"#f59e0b"}}>;00</code> and <code style={{color:"#f59e0b"}}>;01</code> at
          the start of every minute — <strong>except every 10th minute</strong>. (No actual video frames are lost — only frame
          <em> numbers</em> are skipped.) 24, 25 and true 30 fps are always non-drop.
        </p>
        {/* drift bars */}
        <div style={{marginBottom:14}}>
          {[["Real clock, 1 h",100,"#34d399","01:00:00"],["Non-drop TC after 1 h real time",100.1,"#f59e0b","01:00:03;18 (ahead)"]].map(([lbl,w,col,val])=>(
            <div key={lbl} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af",fontFamily:"monospace",marginBottom:2}}>
                <span>{lbl}</span><span style={{color:col}}>{val}</span>
              </div>
              <div style={{height:10,background:"#1f2937",borderRadius:5,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${w}%`,maxWidth:"100%",background:col,opacity:0.8}}/>
              </div>
            </div>
          ))}
          <div style={{fontSize:11,color:"#f87171",fontFamily:"monospace",marginTop:2}}>↑ without drop-frame, timecode drifts ahead of real time</div>
        </div>
        {/* minute skip pattern */}
        <div style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",marginBottom:6}}>At each new minute (29.97 DF):</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Array.from({length:11},(_,m)=>{
            const keep=m%10===0;
            return (
              <div key={m} style={{
                minWidth:64,padding:"6px 8px",borderRadius:6,textAlign:"center",fontFamily:"monospace",fontSize:11,
                background:keep?"#12261a":"#2a1416",border:`1px solid ${keep?"#34d39955":"#f8717155"}`,
              }}>
                <div style={{color:"#9ca3af"}}>min {String(m).padStart(2,"0")}</div>
                <div style={{color:keep?"#34d399":"#f87171",fontWeight:"bold",marginTop:2}}>{keep?"keep all":"skip ;00 ;01"}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:11,color:"#6b7280",fontFamily:"monospace",marginTop:8}}>
          2 frames × 54 minutes (all but every 10th) = <strong style={{color:"#e5e7eb"}}>108 frame numbers skipped per hour</strong> → timecode = wall-clock time.
        </div>
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
    const lH=new Float32Array(256);
    for(let i=0;i<d.length;i+=4) lH[Math.round(luma709(d[i],d[i+1],d[i+2]))]++;
    ctx.fillStyle=BG; ctx.fillRect(0,0,SW,SH);
    ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    for(let p=0;p<=4;p++){ const x=(p/4)*SW; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,SH-16);ctx.stroke(); }
    const mx=Math.max(...lH)||1;
    // monochrome luma histogram, filled
    ctx.beginPath(); ctx.moveTo(0,SH-16);
    for(let i=0;i<256;i++){ const x=i/255*SW, y=(SH-16)-(lH[i]/mx)*(SH-26); ctx.lineTo(x,y); }
    ctx.lineTo(SW,SH-16); ctx.closePath();
    ctx.fillStyle="rgba(226,232,240,0.7)"; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle="#6b7280"; ctx.font="10px monospace";
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

// Luma-preserving hue rotation (SVG feColorMatrix), r,g,b in 0..1
function hueRotateRGB(r,g,b,deg){
  const a=deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
  return [
    r*(0.213+c*0.787-s*0.213)+g*(0.715-c*0.715-s*0.715)+b*(0.072-c*0.072+s*0.928),
    r*(0.213-c*0.213+s*0.143)+g*(0.715+c*0.285+s*0.140)+b*(0.072-c*0.072-s*0.283),
    r*(0.213-c*0.213-s*0.787)+g*(0.715-c*0.715+s*0.715)+b*(0.072+c*0.928+s*0.072),
  ];
}

function ModuleScopes({ image }) {
  const [scope, setScope] = useState("waveform");
  const [lift, setLift] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [gain, setGain] = useState(1);
  const [sat, setSat] = useState(1);
  const [hue, setHue] = useState(0);
  const previewRef = useRef();
  const reset=()=>{setLift(0);setGamma(1);setGain(1);setSat(1);setHue(0);};

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const pv=previewRef.current; if(!pv) return;
      const IW=Math.min(pv.parentElement?.clientWidth-24||640,820);
      const IH=Math.round(IW*9/16);
      pv.width=IW; pv.height=IH;
      const pctx=pv.getContext("2d");
      pctx.drawImage(img,0,0,IW,IH);
      const idata=pctx.getImageData(0,0,IW,IH); const d=idata.data;
      for(let i=0;i<d.length;i+=4){
        let r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
        r=Math.pow(Math.min(1,Math.max(0,r*gain+lift)),1/gamma);   // lift/gamma/gain
        g=Math.pow(Math.min(1,Math.max(0,g*gain+lift)),1/gamma);
        b=Math.pow(Math.min(1,Math.max(0,b*gain+lift)),1/gamma);
        const L=luma709(r,g,b); r=L+sat*(r-L); g=L+sat*(g-L); b=L+sat*(b-L);   // saturation
        if(hue!==0){ [r,g,b]=hueRotateRGB(r,g,b,hue); }                         // hue rotate
        d[i]=Math.max(0,Math.min(255,r*255)); d[i+1]=Math.max(0,Math.min(255,g*255)); d[i+2]=Math.max(0,Math.min(255,b*255));
      }
      pctx.putImageData(idata,0,0);
      // scope rendered as a PIP overlay in the bottom-left (like a camera monitor)
      const sc=document.createElement("canvas");
      drawScope(sc,d,IW,IH,scope);
      const m=Math.round(IW*0.018);
      const pipW=Math.round(IW*(scope==="vectorscope"?0.30:0.42));
      const pipH=Math.round(pipW*sc.height/sc.width);
      const px=m, py=IH-pipH-m;
      pctx.fillStyle="rgba(0,0,0,0.5)"; pctx.fillRect(px-3,py-16,pipW+6,pipH+19);
      pctx.strokeStyle="rgba(34,211,238,0.6)"; pctx.lineWidth=1; pctx.strokeRect(px-2.5,py-15.5,pipW+5,pipH+18);
      pctx.fillStyle="#22d3ee"; pctx.font="bold 10px monospace"; pctx.fillText(SCOPE_TYPES.find(s=>s[0]===scope)[1].toUpperCase(),px,py-5);
      pctx.imageSmoothingEnabled=true;
      pctx.drawImage(sc,px,py,pipW,pipH);
    };
    img.src=image;
  },[image,lift,gamma,gain,sat,hue,scope]);

  const sliders=[
    ["Lift",lift,setLift,-0.2,0.2,0.01,0,""],
    ["Gamma",gamma,setGamma,0.4,2.2,0.01,1,""],
    ["Gain",gain,setGain,0.4,2,0.01,1,""],
    ["Saturation",sat,setSat,0,2,0.01,1,""],
    ["Hue",hue,setHue,-180,180,1,0,"°"],
  ];

  return (
    <div>
      <InfoBox>
        <strong>Scopes</strong> are objective measurement tools — more reliable than the camera LCD for exposure and colour. Pick a scope; it appears as a <strong>picture-in-picture overlay</strong> on the image, the way a camera or monitor shows it. The <strong>Histogram</strong> (monochrome luma) shows the tonal distribution. The <strong>Waveform</strong> maps luminance (IRE) against horizontal position — the standard for exposure and clipping (EBU R 103). The <strong>RGB Parade</strong> splits it into R/G/B for white balance. The <strong>Vectorscope</strong> plots chrominance on a polar diagram (distance = saturation, angle = hue) with 75% targets and the amber skin-tone line. Grade below and watch the scope respond — <em>Hue</em> rotates every colour, so the vectorscope trace spins around the centre.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {SCOPE_TYPES.map(([k,lbl])=>(
          <button key={k} onClick={()=>setScope(k)} style={k===scope?styles.btnActive:styles.btnChip}>{lbl}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12,marginBottom:12,display:"block",maxWidth:"100%"}}>
        <canvas ref={previewRef} style={{display:"block",width:"100%",borderRadius:4}}/>
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",letterSpacing:"0.06em"}}>GRADING</span>
          <button onClick={reset} style={{...styles.btnSecondary,fontSize:11,padding:"4px 10px"}}>Reset</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {sliders.map(([name,val,setter,min,max,step,def,unit])=>(
            <label key={name} style={styles.label}>
              <span>{name}: <strong style={{color:val===def?"#6b7280":"#22d3ee"}}>{unit==="°"?Math.round(val)+"°":(+val).toFixed(2)}</strong></span>
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
