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
      signals: "Signals & Connectivity",
      lighting: "Lighting",
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
      exposureTriangle: { title: "Exposure Triangle", desc: "Shutter, aperture, ISO — and the trade-offs" },
      falseColor: { title: "False Color", desc: "Exposure mapped to an IRE colour palette" },
      lut: { title: "LUTs", desc: "1D & 3D lookup tables — technical vs creative looks" },
      codecs: { title: "Compression & Codecs", desc: "Intra vs inter, DCT blocking, I/P/B frames, the codec table" },
      containers: { title: "Containers & Wrappers", desc: "MOV, MP4, MXF, MKV — codec ≠ container" },
      signals: { title: "Signals & Connectivity", desc: "HDMI, SDI, fibre, NDI, SRT, XLR, DMX — cables vs IP transports" },
      portraitLight: { title: "Portrait Lighting", desc: "Key position & patterns — Rembrandt, butterfly, loop, split" },
      dmx: { title: "DMX Lighting Control", desc: "Universe, addressing, fixture personalities, Art-Net/sACN" },
      lensDistortion: { title: "Lens Distortion", desc: "Barrel & pincushion — when straight lines bend" },
      interlacing: { title: "Interlacing & Combing", desc: "Fields, comb teeth on motion, deinterlacing" },
      halation: { title: "Halation & Bloom", desc: "Highlight glow — the red halo of film" },
      flicker: { title: "Flicker & Rolling Bands", desc: "50/60 Hz and PWM LED — banding and flicker" },
      focusBreathing: { title: "Focus Breathing", desc: "Field of view shifting as you rack focus" },
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
    modules: ["aspectRatio","resolution","chromaSubsampling","raw","codecs","containers","frameRate","exposureTriangle"],
  },
  {
    id: "color", label: T.categories.color,
    modules: ["colorTemp","pictureProfiles","colorSpaces","lut","aces"],
  },
  {
    id: "defects", label: T.categories.defects,
    modules: ["rollingShutter","moire","banding","noise","vignetting","chromaticAberration","lensDistortion","interlacing","halation","flicker","focusBreathing"],
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
    modules: ["scopes","falseColor"],
  },
  {
    id: "signals", label: T.categories.signals,
    modules: ["signals"],
  },
  {
    id: "lighting", label: T.categories.lighting,
    modules: ["portraitLight","dmx"],
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
// Green-screen scene: our figure on chroma green, with fine hair detail at the edges
function greenScreenScene(ctx,W,H){
  ctx.fillStyle="#14b83a"; ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(W*0.5,H*0.4,H*0.1,W*0.5,H*0.55,H*0.95);
  g.addColorStop(0,"rgba(255,255,255,0.05)"); g.addColorStop(1,"rgba(0,0,0,0.14)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  drawFigure(ctx, W*0.5, H*1.04, H*1.0);
  ctx.strokeStyle="#2f2216"; ctx.lineWidth=Math.max(1,H*0.006); ctx.lineCap="round";
  const hx=W*0.5, hy=H*0.05;
  for(let i=-5;i<=5;i++){ ctx.beginPath(); ctx.moveTo(hx+i*H*0.011,hy+H*0.02); ctx.quadraticCurveTo(hx+i*H*0.02,hy-H*0.045,hx+i*H*0.015,hy-H*0.065); ctx.stroke(); }
}
// Draw a magnified region of an RGBA buffer, optionally as chroma-only (luma flattened)
function drawLoupe(destCtx, data, IW, region, dx,dy,dw,dh, chromaOnly){
  const {x,y,w,h}=region;
  const tmp=document.createElement("canvas"); tmp.width=w; tmp.height=h;
  const td=tmp.getContext("2d").createImageData(w,h);
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    const sp=((y+j)*IW+(x+i))*4, dp=(j*w+i)*4;
    let r=data[sp],g=data[sp+1],b=data[sp+2];
    if(chromaOnly){ const cb=128-0.168736*r-0.331264*g+0.5*b, cr=128+0.5*r-0.418688*g-0.081312*b, Y=150;
      r=Y+1.5748*(cr-128); g=Y-0.1873*(cb-128)-0.4681*(cr-128); b=Y+1.8556*(cb-128); }
    td.data[dp]=Math.max(0,Math.min(255,r)); td.data[dp+1]=Math.max(0,Math.min(255,g)); td.data[dp+2]=Math.max(0,Math.min(255,b)); td.data[dp+3]=255;
  }
  tmp.getContext("2d").putImageData(td,0,0);
  destCtx.imageSmoothingEnabled=false; destCtx.drawImage(tmp,dx,dy,dw,dh);
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

function hslToRgb(h,s,l){
  h/=360; const a=s*Math.min(l,1-l);
  const f=n=>{ const k=(n+h*12)%12; return l-a*Math.max(-1,Math.min(k-3,9-k,1)); };
  return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
}
// Pixel-level chroma sampling grid: original → samples kept → reconstructed (interpolation)
function drawChromaGrid(canvas, scheme){
  const N=8, cell=24, pad=8, labelH=22, gap=26, gw=N*cell;
  const W=gw*3+gap*2+pad*2, H=labelH+gw+22; canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,H);
  const cl=v=>Math.max(0,Math.min(255,Math.round(v)));
  // the model's own edge: green screen → skin (a slanted silhouette edge)
  const GREEN=[22,178,66], SKIN=[228,180,138];
  const base=[]; for(let j=0;j<N;j++){ base[j]=[]; for(let i=0;i<N;i++){ const edge=2.4+j*0.55; base[j][i]= i<edge?GREEN:SKIN; } }
  const bw=scheme==="4:1:1"?4:scheme==="4:4:4"?1:2, bh=scheme==="4:2:0"?2:1;
  const YC=(r,g,b)=>[0.2126*r+0.7152*g+0.0722*b, 128-0.168736*r-0.331264*g+0.5*b, 128+0.5*r-0.418688*g-0.081312*b];
  const RGB=(Y,cb,cr)=>[Y+1.5748*(cr-128), Y-0.1873*(cb-128)-0.4681*(cr-128), Y+1.8556*(cb-128)];
  const grid=(ox,mode)=>{
    for(let j=0;j<N;j++) for(let i=0;i<N;i++){
      let [r,g,b]=base[j][i];
      if(mode==="kept" && !((i%bw===0)&&(j%bh===0))){ const [Y]=YC(r,g,b); r=g=b=Y; }
      else if(mode==="recon"){
        let scb=0,scr=0,n=0; const bi=Math.floor(i/bw)*bw, bj=Math.floor(j/bh)*bh;
        for(let y=bj;y<Math.min(N,bj+bh);y++)for(let x=bi;x<Math.min(N,bi+bw);x++){ const c=YC(...base[y][x]); scb+=c[1];scr+=c[2];n++; }
        const [Y]=YC(r,g,b); [r,g,b]=RGB(Y,scb/n,scr/n);
      }
      ctx.fillStyle=`rgb(${cl(r)},${cl(g)},${cl(b)})`; ctx.fillRect(ox+i*cell,labelH+j*cell,cell-1,cell-1);
      if(mode==="kept"&&(i%bw===0)&&(j%bh===0)){ ctx.strokeStyle="rgba(255,255,255,0.95)"; ctx.lineWidth=1.5; ctx.strokeRect(ox+i*cell+2.5,labelH+j*cell+2.5,cell-6,cell-6); }
    }
    ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1; ctx.strokeRect(ox,labelH,gw,gw);
  };
  ctx.font="11px monospace"; ctx.textAlign="center"; ctx.fillStyle="#9ca3af";
  ctx.fillText("model edge (green→skin)",pad+gw/2,14);
  ctx.fillText("chroma kept",pad+gw+gap+gw/2,14);
  ctx.fillText("reconstructed",pad+2*(gw+gap)+gw/2,14);
  grid(pad,"orig"); grid(pad+gw+gap,"kept"); grid(pad+2*(gw+gap),"recon");
  const kept=(N/bw)*(N/bh);
  ctx.textAlign="left"; ctx.fillStyle="#f59e0b"; ctx.font="bold 11px monospace";
  ctx.fillText(`chroma samples kept: ${kept} of ${N*N}   ·   luma still ${N*N}`,pad,H-6);
}
const CHROMA_IW=260, CHROMA_IH=146, CHROMA_REGION={x:96,y:4,w:74,h:60};
function ModuleChromaSubsampling() {
  const [sel, setSel] = useState(2);
  const [chromaOnly, setChromaOnly] = useState(false);
  const S = SAMPLING[sel];
  const sceneRef = useRef();
  const magRef = useRef();
  const gridRef = useRef();
  useEffect(()=>{
    if(gridRef.current) drawChromaGrid(gridRef.current, S.label);
    const IW=CHROMA_IW, IH=CHROMA_IH, region=CHROMA_REGION;
    const src=document.createElement("canvas"); src.width=IW; src.height=IH;
    greenScreenScene(src.getContext("2d"), IW, IH);
    const srcData=src.getContext("2d").getImageData(0,0,IW,IH).data;
    const subData=new Uint8ClampedArray(srcData);
    chromaSubsample(subData, IW, IH, S.label);
    // full scene (rendered at the selected subsampling) with the loupe rectangle
    const sc=sceneRef.current;
    if(sc){
      const W=Math.min(sc.parentElement?.clientWidth-24||520,560), H=Math.round(W*IH/IW);
      sc.width=W; sc.height=H;
      const ctx=sc.getContext("2d");
      const disp=document.createElement("canvas"); disp.width=IW; disp.height=IH;
      const dd=disp.getContext("2d").createImageData(IW,IH); dd.data.set(subData); disp.getContext("2d").putImageData(dd,0,0);
      ctx.imageSmoothingEnabled=true; ctx.drawImage(disp,0,0,W,H);
      const rx=region.x/IW*W, ry=region.y/IH*H, rw=region.w/IW*W, rh=region.h/IH*H;
      ctx.strokeStyle="#22d3ee"; ctx.lineWidth=2; ctx.setLineDash([5,4]); ctx.strokeRect(rx,ry,rw,rh); ctx.setLineDash([]);
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,20); ctx.fillStyle="#9ca3af"; ctx.font="11px monospace"; ctx.fillText(`model on green screen · ${S.label}${chromaOnly?" · chroma only":""}`,8,14);
    }
    // magnified edge comparison: 4:4:4 vs selected
    const mc=magRef.current;
    if(mc){
      const W=Math.min(mc.parentElement?.clientWidth-24||880,920), gap=10, top=22;
      const panelW=Math.floor((W-gap)/2), panelH=Math.round(panelW*region.h/region.w);
      mc.width=W; mc.height=panelH+top;
      const ctx=mc.getContext("2d");
      ctx.fillStyle="#07090d"; ctx.fillRect(0,0,W,mc.height);
      drawLoupe(ctx, srcData, IW, region, 0, top, panelW, panelH, chromaOnly);
      drawLoupe(ctx, subData, IW, region, panelW+gap, top, panelW, panelH, chromaOnly);
      if(S.label!=="4:4:4"){
        const bw=S.label==="4:1:1"?4:2, bh=S.label==="4:2:0"?2:1;
        const sx=panelW/region.w, sy=panelH/region.h;
        ctx.strokeStyle="rgba(255,255,255,0.14)"; ctx.lineWidth=1;
        for(let x=0;x<=region.w;x+=bw){ const px=Math.round(panelW+gap+x*sx)+0.5; ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,top+panelH);ctx.stroke(); }
        if(bh>1) for(let y=0;y<=region.h;y+=bh){ const py=Math.round(top+y*sy)+0.5; ctx.beginPath();ctx.moveTo(panelW+gap,py);ctx.lineTo(W,py);ctx.stroke(); }
      }
      ctx.textAlign="left"; ctx.font="bold 12px monospace";
      ctx.fillStyle="#9ca3af"; ctx.fillText(`4:4:4  (original)`,4,15);
      ctx.fillStyle="#f59e0b"; ctx.fillText(`${S.label}${S.label!=="4:4:4"?"  — invented edge colours":""}`,panelW+gap+4,15);
    }
  },[sel,chromaOnly]);
  return (
    <div>
      <InfoBox>
        <strong>Chroma subsampling</strong> stores colour at lower resolution than brightness, because the eye resolves detail (luma) far better than colour (chroma). This barely matters when you just watch — but it wrecks a <strong>chroma key</strong>. At the green-screen edge, the codec has to <strong>average the colour of blocks that straddle the subject and the green</strong>, <em>inventing</em> intermediate colours the pixels never had. The loupe shows that edge: in 4:4:4 the green→hair→skin transition is clean, per-pixel; at 4:2:2 → 4:2:0 → 4:1:1 the colour collapses into blocks and the edge turns ragged — a matte cut from it will chatter. Toggle <strong>chroma only</strong> to strip the luma and see just the colour breaking apart. This is why green-screen/VFX demand 4:4:4 (or at least 4:2:2), while 4:2:0 is fine for final delivery.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {SAMPLING.map((s,i)=>(
          <button key={s.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{s.label}</button>
        ))}
        <button onClick={()=>setChromaOnly(v=>!v)} style={{...styles.btnSecondary,...(chromaOnly?{borderColor:"#22d3ee",color:"#22d3ee"}:{})}}>
          Chroma only: {chromaOnly?"ON":"OFF"}
        </button>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"0 1 auto",background:"#111",borderRadius:8,padding:10}}>
          <canvas ref={sceneRef} style={{display:"block",maxWidth:"100%",borderRadius:4}}/>
        </div>
        <div style={{flex:"1 1 420px",minWidth:300,background:"#111",borderRadius:8,padding:10}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>LOUPE — the green / subject edge (pixel level)</div>
          <canvas ref={magRef} style={{display:"block",width:"100%"}}/>
        </div>
      </div>
      <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12,marginTop:12,display:"block",maxWidth:"100%",overflowX:"auto"}}>
        <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8}}>PIXEL SAMPLING (8×8) — which chroma samples the codec keeps</div>
        <canvas ref={gridRef} style={{display:"block",maxWidth:"100%"}}/>
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
    // Scene layers, each blurred by its distance from focus.
    // Blur via downscale→upscale (works in every browser; ctx.filter blur is unreliable in Safari).
    SCENE_LAYERS.forEach(l=>{
      const b=blurFor(LAYER_DIST[l.name] ?? l.depth);
      const lc=document.createElement("canvas"); lc.width=W; lc.height=H;
      const lctx=lc.getContext("2d");
      lctx.save(); lctx.translate(W/2,H/2); lctx.scale(1.06,1.06); lctx.translate(-W/2,-H/2); l.draw(lctx,W,H); lctx.restore();
      if(b<0.6){ ctx.drawImage(lc,0,0); }
      else {
        // progressive halving → smooth blur (no pixelation), then smooth upscale back
        const s=Math.max(0.05, 1/(1+b*0.5));
        const steps=Math.max(1,Math.ceil(Math.log2(1/s)));
        let cur=lc;
        for(let k=0;k<steps;k++){
          const nw=Math.max(2,Math.floor(cur.width/2)), nh=Math.max(2,Math.floor(cur.height/2));
          const t=document.createElement("canvas"); t.width=nw; t.height=nh;
          const tc=t.getContext("2d"); tc.imageSmoothingEnabled=true; tc.imageSmoothingQuality="high"; tc.drawImage(cur,0,0,nw,nh);
          cur=t;
        }
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high"; ctx.drawImage(cur,0,0,W,H);
      }
    });
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
// Interior room with a bright window (the classic latitude test): the window blows out;
// RAW keeps several stops of headroom outside, compressed clips at capture.
function rawSceneLinear(IW,IH){
  const W=IW, H=IH, wx0=0.40, wx1=0.88, wy0=0.13, wy1=0.72;
  const c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d");
  // ---- back wall (warm, dim) + floor
  let wall=g.createLinearGradient(0,0,0,H); wall.addColorStop(0,"#2c2519"); wall.addColorStop(1,"#17120b");
  g.fillStyle=wall; g.fillRect(0,0,W,H);
  g.fillStyle="#241a11"; g.beginPath(); g.moveTo(0,H*0.74); g.lineTo(W,H*0.70); g.lineTo(W,H); g.lineTo(0,H); g.closePath(); g.fill();
  g.strokeStyle="rgba(0,0,0,0.30)"; g.lineWidth=1;
  for(let i=1;i<8;i++){ const x=W*i/8; g.beginPath(); g.moveTo(x,H*0.72); g.lineTo(W*0.5+(x-W*0.5)*2.2,H); g.stroke(); }
  // ---- framed picture on the wall (shadow detail to recover)
  g.fillStyle="#0f0b07"; g.fillRect(W*0.06,H*0.16,W*0.15,H*0.24);
  g.fillStyle="#3a2c1e"; g.fillRect(W*0.075,H*0.185,W*0.12,H*0.19);
  g.fillStyle="#4a566e"; g.fillRect(W*0.088,H*0.20,W*0.094,H*0.11);
  g.fillStyle="#6b7a4a"; g.fillRect(W*0.088,H*0.31,W*0.094,H*0.065);
  // ---- window frame + bright exterior
  const rx=W*wx0, ry=H*wy0, rw=W*(wx1-wx0), rh=H*(wy1-wy0);
  g.fillStyle="#0c0a07"; g.fillRect(rx-W*0.022,ry-H*0.04,rw+W*0.044,rh+H*0.08);           // frame
  let sky=g.createLinearGradient(0,ry,0,ry+rh); sky.addColorStop(0,"#f0f5ff"); sky.addColorStop(0.65,"#dce9ff"); sky.addColorStop(1,"#cfe0f2");
  g.fillStyle=sky; g.fillRect(rx,ry,rw,rh);
  g.fillStyle="rgba(255,255,255,0.65)";
  for(const [cx,cy,cr] of [[0.24,0.28,0.11],[0.58,0.20,0.085],[0.82,0.40,0.10]]){ g.beginPath(); g.ellipse(rx+rw*cx,ry+rh*cy,rw*cr,rh*cr*0.62,0,0,7); g.fill(); }
  g.fillStyle="#9fb2cf"; g.beginPath(); g.moveTo(rx,ry+rh*0.70);                            // mountains
  g.lineTo(rx+rw*0.20,ry+rh*0.48); g.lineTo(rx+rw*0.37,ry+rh*0.64); g.lineTo(rx+rw*0.57,ry+rh*0.40);
  g.lineTo(rx+rw*0.80,ry+rh*0.62); g.lineTo(rx+rw,ry+rh*0.50); g.lineTo(rx+rw,ry+rh); g.lineTo(rx,ry+rh); g.closePath(); g.fill();
  g.fillStyle="#8fa06a"; g.beginPath(); g.moveTo(rx,ry+rh*0.86); g.quadraticCurveTo(rx+rw*0.5,ry+rh*0.74,rx+rw,ry+rh*0.88); g.lineTo(rx+rw,ry+rh); g.lineTo(rx,ry+rh); g.closePath(); g.fill();
  g.fillStyle="#ffffff"; g.beginPath(); g.arc(rx+rw*0.72,ry+rh*0.24,rh*0.11,0,7); g.fill();  // sun
  g.fillStyle="#0c0a07"; g.fillRect(rx+rw/2-W*0.006,ry,W*0.012,rh); g.fillRect(rx,ry+rh/2-H*0.009,rw,H*0.018); // mullions
  g.fillStyle="#1a130c"; g.fillRect(rx-W*0.035,ry+rh,rw+W*0.07,H*0.032);                    // sill
  // ---- foreground furniture (dark silhouettes)
  g.fillStyle="#0e0a07"; g.fillRect(W*0.07,H*0.72,W*0.27,H*0.035);                          // table top
  g.fillRect(W*0.09,H*0.755,W*0.02,H*0.20); g.fillRect(W*0.31,H*0.755,W*0.02,H*0.20);       // table legs
  g.fillStyle="#120d09"; g.beginPath(); g.moveTo(W*0.185,H*0.72); g.lineTo(W*0.205,H*0.72); g.lineTo(W*0.212,H*0.635); g.lineTo(W*0.178,H*0.635); g.closePath(); g.fill(); // vase
  g.strokeStyle="#17200f"; g.lineWidth=Math.max(2,W*0.006);
  for(const a of [-0.6,-0.2,0.15,0.5]){ g.beginPath(); g.moveTo(W*0.195,H*0.635); g.lineTo(W*0.195+Math.sin(a)*W*0.05,H*0.635-Math.cos(a)*H*0.11); g.stroke(); } // plant
  g.fillStyle="#0d0906"; g.fillRect(W*0.315,H*0.60,W*0.016,H*0.32); g.fillRect(W*0.315,H*0.80,W*0.13,H*0.022);   // chair back+seat
  g.fillRect(W*0.322,H*0.822,W*0.013,H*0.13); g.fillRect(W*0.428,H*0.822,W*0.013,H*0.13);   // chair legs
  // ---- warm lamp glow (colour in the shadows)
  g.fillStyle="#2a1c0d"; g.fillRect(W*0.125,H*0.46,W*0.028,H*0.22);
  g.beginPath(); g.moveTo(W*0.10,H*0.46); g.lineTo(W*0.178,H*0.46); g.lineTo(W*0.163,H*0.36); g.lineTo(W*0.115,H*0.36); g.closePath(); g.fillStyle="#3a2810"; g.fill();
  let lg=g.createRadialGradient(W*0.14,H*0.41,2,W*0.14,H*0.41,W*0.22); lg.addColorStop(0,"rgba(255,196,120,0.55)"); lg.addColorStop(1,"rgba(255,196,120,0)");
  g.fillStyle=lg; g.fillRect(0,0,W,H);
  // ---- to linear light; window region gets several stops of headroom
  const d=g.getImageData(0,0,W,H).data, buf=new Float32Array(W*H*3);
  const toLin=v=>{ v/=255; return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const u=x/W, v=y/H, p=(y*W+x)*4, q=(y*W+x)*3;
    const boost = (u>wx0&&u<wx1&&v>wy0&&v<wy1) ? 6.5 : 1;   // exterior sits above display white
    buf[q]=toLin(d[p])*boost; buf[q+1]=toLin(d[p+1])*boost; buf[q+2]=toLin(d[p+2])*boost;
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
  const pipRef = useRef({x:0.02, y:0.05});   // normalised top-left of the scope PIP — over the sky
  const frameRef = useRef(null);             // cached graded frame (so dragging doesn't re-grade)
  const dragRef = useRef(null);
  const reset=()=>{setLift(0);setGamma(1);setGain(1);setSat(1);setHue(0);};

  const drawPip=()=>{
    const pv=previewRef.current, f=frameRef.current; if(!pv||!f) return;
    const pctx=pv.getContext("2d");
    pctx.putImageData(f.idata,0,0);
    let cx=Math.round(pipRef.current.x*f.IW), cy=Math.round(pipRef.current.y*f.IH);
    cx=Math.max(4,Math.min(f.IW-f.pipW-4,cx)); cy=Math.max(18,Math.min(f.IH-f.pipH-4,cy));
    pipRef.current={x:cx/f.IW, y:cy/f.IH};
    pctx.fillStyle="rgba(0,0,0,0.5)"; pctx.fillRect(cx-3,cy-16,f.pipW+6,f.pipH+19);
    pctx.strokeStyle="rgba(34,211,238,0.6)"; pctx.lineWidth=1; pctx.strokeRect(cx-2.5,cy-15.5,f.pipW+5,f.pipH+18);
    pctx.fillStyle="#22d3ee"; pctx.font="bold 10px monospace"; pctx.fillText(SCOPE_TYPES.find(s=>s[0]===scope)[1].toUpperCase()+"  ·  drag",cx,cy-5);
    pctx.imageSmoothingEnabled=true; pctx.drawImage(f.sc,cx,cy,f.pipW,f.pipH);
  };

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
      const sc=document.createElement("canvas"); drawScope(sc,d,IW,IH,scope);
      const pipW=Math.round(IW*(scope==="vectorscope"?0.30:0.42)), pipH=Math.round(pipW*sc.height/sc.width);
      frameRef.current={idata, sc, IW, IH, pipW, pipH};
      drawPip();
    };
    img.src=image;
  },[image,lift,gamma,gain,sat,hue,scope]);

  const canvasXY=e=>{ const pv=previewRef.current, r=pv.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*pv.width, y:(e.clientY-r.top)/r.height*pv.height}; };
  const onDown=e=>{ const f=frameRef.current; if(!f)return; const {x,y}=canvasXY(e); const px=pipRef.current.x*f.IW, py=pipRef.current.y*f.IH; if(x>=px-4&&x<=px+f.pipW+4&&y>=py-16&&y<=py+f.pipH) dragRef.current={ox:x-px,oy:y-py}; };
  const onMove=e=>{ if(!dragRef.current)return; const f=frameRef.current; const {x,y}=canvasXY(e); pipRef.current={x:(x-dragRef.current.ox)/f.IW, y:(y-dragRef.current.oy)/f.IH}; drawPip(); };
  const onUp=()=>{ dragRef.current=null; };

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
        <canvas ref={previewRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          style={{display:"block",width:"100%",borderRadius:4,cursor:"grab"}}/>
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
// MODULE: Exposure Triangle
// ─────────────────────────────────────────────
const SHUTTERS=[1,2,4,8,15,30,50,60,125,250,500,1000,2000];   // 1/x s
const APERTURES=[1.4,2,2.8,4,5.6,8,11,16,22];
const ISOS=[100,200,400,800,1600,3200,6400,12800];
function ExpRow({name,arr,val,set,fmt,effect}){
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <span style={styles.label}>{name}: <strong style={{color:"#f59e0b"}}>{fmt(arr[val])}</strong></span>
        <span style={{color:"#6b7280",fontSize:11}}>{effect}</span>
      </div>
      <input type="range" min={0} max={arr.length-1} step={1} value={val} onChange={e=>set(+e.target.value)} style={{...styles.slider,width:"100%"}}/>
    </div>
  );
}
function ModuleExposureTriangle({ image }) {
  const [sh,setSh]=useState(6);   // index → 1/50
  const [ap,setAp]=useState(3);   // index → f/4
  const [iso,setIso]=useState(3); // index → 800
  const ref=useRef();
  const stops = Math.log2(50/SHUTTERS[sh]) + Math.log2(16/(APERTURES[ap]**2)) + Math.log2(ISOS[iso]/800);
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||760,760), H=Math.round(W*9/16);
      c.width=W; c.height=H; const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,W,H);
      const gain=Math.pow(2,stops);
      let id=ctx.getImageData(0,0,W,H), d=id.data;
      // brightness (exposure)
      for(let i=0;i<d.length;i+=4){ d[i]=Math.min(255,d[i]*gain); d[i+1]=Math.min(255,d[i+1]*gain); d[i+2]=Math.min(255,d[i+2]*gain); }
      // ISO noise (grows with sensitivity)
      const nAmp=Math.max(0,(iso-2))*3.2;
      if(nAmp>0.5) for(let i=0;i<d.length;i+=4){ const n=(Math.random()-0.5)*nAmp, cn=(Math.random()-0.5)*nAmp*0.7;
        d[i]=Math.max(0,Math.min(255,d[i]+n+cn)); d[i+1]=Math.max(0,Math.min(255,d[i+1]+n)); d[i+2]=Math.max(0,Math.min(255,d[i+2]+n-cn)); }
      ctx.putImageData(id,0,0);
      // motion blur from long shutter (horizontal smear)
      const blurPx=Math.round(Math.max(0,(6-sh))*3.4);   // slower shutter → more smear
      if(blurPx>0){
        const t=document.createElement("canvas"); t.width=W;t.height=H; const tc=t.getContext("2d");
        tc.globalAlpha=1/(blurPx*2+1);
        for(let k=-blurPx;k<=blurPx;k++) tc.drawImage(c,k,0);
        ctx.clearRect(0,0,W,H); ctx.globalAlpha=1; ctx.drawImage(t,0,0);
      }
      // DoF hint (wide aperture → soft background top band, cheap suggestion)
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,22);
      ctx.font="11px monospace"; ctx.fillStyle= Math.abs(stops)<0.25?"#34d399":stops>0?"#f59e0b":"#60a5fa";
      ctx.fillText(`1/${SHUTTERS[sh]}s   f/${APERTURES[ap]}   ISO ${ISOS[iso]}    ·    ${stops>0?"+":""}${stops.toFixed(1)} EV  ${Math.abs(stops)<0.25?"(balanced)":stops>0?"(over)":"(under)"}`,8,14);
    };
    img.src=image;
  },[sh,ap,iso,image,stops]);
  return (
    <div>
      <InfoBox>
        The <strong>exposure triangle</strong> is the three controls that set image brightness — and each carries a <em>side-effect</em>. <strong>Shutter</strong> (exposure time) also sets <em>motion blur</em>: a 180° shutter (1/50 at 25 fps) is the cinema norm; faster freezes motion, slower smears it. <strong>Aperture</strong> (f-stop) also sets <em>depth of field</em>: wide (f/1.4) throws the background out of focus, narrow (f/16) keeps it sharp. <strong>ISO</strong> (sensitivity) also sets <em>noise</em>: low is clean, high is grainy. Each full stop <em>doubles or halves</em> the light — so you can trade one for another and keep the same exposure (<strong>reciprocity</strong>). Watch the EV badge: keep it near <span style={{color:"#34d399"}}>balanced</span> while changing which side-effect you accept.
      </InfoBox>
      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 300px",minWidth:280}}>
          <ExpRow name="Shutter" arr={SHUTTERS} val={sh} set={setSh} fmt={v=>"1/"+v+"s"} effect="↔ motion blur"/>
          <ExpRow name="Aperture" arr={APERTURES} val={ap} set={setAp} fmt={v=>"f/"+v} effect="↔ depth of field"/>
          <ExpRow name="ISO" arr={ISOS} val={iso} set={setIso} fmt={v=>v} effect="↔ noise"/>
          <div style={{marginTop:8,padding:"8px 12px",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,fontSize:12,color:"#9ca3af",lineHeight:1.6}}>
            Try: open the aperture <em>and</em> speed up the shutter by the same number of stops — the brightness stays the same, but you swap deep focus for shallow, and motion blur for a frozen frame.
          </div>
        </div>
        <div style={{flex:"1 1 340px",minWidth:300,background:"#111",borderRadius:8,padding:12}}>
          <canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: False Color
// ─────────────────────────────────────────────
const FC_BANDS=[
  {max:2.5,col:[40,40,40],name:"crushed black"},
  {max:8,col:[80,40,160],name:"near black (purple)"},
  {max:20,col:[40,80,210],name:"shadows (blue)"},
  {max:40,col:[70,70,70],name:"low grey"},
  {max:47,col:[40,170,90],name:"18% mid grey (green)"},
  {max:53,col:[130,130,130],name:"mid grey"},
  {max:60,col:[220,130,180],name:"skin key (pink)"},
  {max:74,col:[200,200,200],name:"high grey"},
  {max:88,col:[220,180,40],name:"highlights (yellow)"},
  {max:97,col:[235,120,30],name:"near clip (orange)"},
  {max:101,col:[230,40,40],name:"clipped white (red)"},
];
function ModuleFalseColor({ image }) {
  const [on,setOn]=useState(true);
  const ref=useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||760,760), H=Math.round(W*9/16);
      c.width=W; c.height=H; const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,W,H);
      if(on){
        const id=ctx.getImageData(0,0,W,H), d=id.data;
        for(let i=0;i<d.length;i+=4){
          const ire=luma709(d[i],d[i+1],d[i+2])/255*100;
          let b=FC_BANDS[FC_BANDS.length-1];
          for(const x of FC_BANDS){ if(ire<=x.max){ b=x; break; } }
          d[i]=b.col[0]; d[i+1]=b.col[1]; d[i+2]=b.col[2];
        }
        ctx.putImageData(id,0,0);
      }
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,22);
      ctx.font="11px monospace"; ctx.fillStyle="#9ca3af";
      ctx.fillText(on?"FALSE COLOUR  ·  luma → IRE palette":"SOURCE",8,14);
    };
    img.src=image;
  },[on,image]);
  return (
    <div>
      <InfoBox>
        <strong>False colour</strong> paints every pixel by its <strong>luminance (IRE)</strong> instead of its real colour, so you can judge <em>exposure</em> at a glance — no guessing on an uncalibrated monitor. It is the on-set companion to the waveform. The palette is a convention (ARRI, Blackmagic and RED share the idea): <span style={{color:"#e02828"}}>red</span> = clipped highlights, <span style={{color:"#eb781e"}}>orange</span> just below clip, <span style={{color:"#dcb428"}}>yellow</span> bright, <span style={{color:"#28aa5a"}}>green</span> ≈ 18% middle grey, <span style={{color:"#2850d2"}}>blue</span> shadows, <span style={{color:"#5028a0"}}>purple</span> near black. The trick on set: expose a face so the skin sits around the pink/grey band, and make sure nothing you care about is red. Like a display LUT, it is a <em>monitoring overlay</em> — it never touches the recorded file.
      </InfoBox>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        {[["False colour",true],["Source",false]].map(([lbl,v])=>(
          <button key={lbl} onClick={()=>setOn(v)} style={on===v?styles.btnActive:styles.btnChip}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 340px",minWidth:300,background:"#111",borderRadius:8,padding:12}}>
          <canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/>
        </div>
        <div style={{flex:"1 1 200px",minWidth:190,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8,letterSpacing:"0.08em"}}>IRE LEGEND</div>
          {[...FC_BANDS].reverse().map((b,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{width:18,height:12,borderRadius:2,background:`rgb(${b.col[0]},${b.col[1]},${b.col[2]})`,flexShrink:0}}/>
              <span style={{color:"#9ca3af",fontSize:11,fontFamily:"monospace"}}>≤{b.max} IRE</span>
              <span style={{color:"#6b7280",fontSize:11}}>{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: LUTs
// ─────────────────────────────────────────────
const LUTS=[
  {id:"none",name:"None (source)",kind:"—",note:"The image as captured.",f:(r,g,b)=>[r,g,b]},
  {id:"rec709",name:"Log → Rec.709",kind:"technical",note:"A technical LUT expands flat Log footage into display contrast. Normalising, non-creative — the intended baseline before grading.",f:(r,g,b)=>{const s=v=>{v/=255; v=Math.min(1,Math.max(0,(v-0.09)/0.72)); v=v<=0?0:Math.pow(v,1/1.15); return 255*(v*v*(3-2*v));}; return [s(r),s(g),s(b)];}},
  {id:"teal",name:"Teal & Orange",kind:"creative",note:"The blockbuster look: push shadows toward teal, skin/highlights toward orange for complementary contrast.",f:(r,g,b)=>{const l=luma709(r,g,b)/255; const w=l; return [r+ (1-w)*-14 + w*26, g + (1-w)*10 + w*4, b + (1-w)*30 + w*-24];}},
  {id:"bleach",name:"Bleach Bypass",kind:"creative",note:"Silver-retention look: desaturated, high contrast, harsh. War films, gritty drama.",f:(r,g,b)=>{const l=luma709(r,g,b); const mix=v=>{let o=v*0.35+l*0.65; o=(o-128)*1.35+128; return o;}; return [mix(r),mix(g),mix(b)];}},
  {id:"night",name:"Day for Night",kind:"creative",note:"Fake night from a day exposure: crush and cool the image, hold a little moonlit highlight.",f:(r,g,b)=>{const mix=v=>v*0.45; return [mix(r)*0.8,mix(g)*0.95,mix(b)*1.5+12];}},
  {id:"warm",name:"Warm Film",kind:"creative",note:"Gentle film emulation: warm mids, soft lifted blacks, mild saturation.",f:(r,g,b)=>{const lift=v=>v*0.92+12; return [lift(r)*1.06,lift(g)*1.0,lift(b)*0.9];}},
];
function ModuleLUT({ image }) {
  const [lut,setLut]=useState("rec709");
  const [split,setSplit]=useState(true);
  const ref=useRef();
  const active=LUTS.find(l=>l.id===lut)||LUTS[0];
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||760,760), H=Math.round(W*9/16);
      c.width=W; c.height=H; const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,W,H);
      const id=ctx.getImageData(0,0,W,H), d=id.data;
      const x0= split? Math.floor(W*0.5):0;
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        if(split && x<x0) continue;
        const i=(y*W+x)*4; const o=active.f(d[i],d[i+1],d[i+2]);
        d[i]=Math.max(0,Math.min(255,o[0])); d[i+1]=Math.max(0,Math.min(255,o[1])); d[i+2]=Math.max(0,Math.min(255,o[2]));
      }
      ctx.putImageData(id,0,0);
      if(split){ ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x0,0); ctx.lineTo(x0,H); ctx.stroke();
        ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,H-20,88,20); ctx.fillRect(x0,H-20,90,20);
        ctx.font="11px monospace"; ctx.fillStyle="#9ca3af"; ctx.fillText("source",8,H-6); ctx.fillText("LUT",x0+8,H-6); }
      ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,W,22);
      ctx.font="11px monospace"; ctx.fillStyle="#f59e0b"; ctx.fillText(`${active.name}   [${active.kind}]`,8,14);
    };
    img.src=image;
  },[lut,split,image,active]);
  return (
    <div>
      <InfoBox>
        A <strong>LUT (Look-Up Table)</strong> is a precomputed map from input colour to output colour — no maths at play-time, just a table lookup, so it is fast and consistent everywhere. A <strong>1D LUT</strong> remaps each channel's curve independently (contrast, gamma). A <strong>3D LUT</strong> (a cube of nodes, e.g. 33×33×33, the <code>.cube</code> file) can remap <em>any</em> colour to any other — it can shift hue and saturation, which a 1D LUT cannot. Two very different jobs: a <strong>technical LUT</strong> (Log→Rec.709) just normalises footage to the display standard — the honest starting point; a <strong>creative LUT</strong> is a <em>look</em>. Applied as a <em>display/preview LUT</em> it is non-destructive monitoring; <em>baked in</em> it is permanent. A LUT is not a grade — it can't isolate a region or track a mask; it is a fixed global map.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {LUTS.map(l=>(
          <button key={l.id} onClick={()=>setLut(l.id)} style={lut===l.id?styles.btnActive:styles.btnChip}>{l.name}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
        <button onClick={()=>setSplit(s=>!s)} style={split?styles.btnActive:styles.btnChip}>{split?"Split view: ON":"Split view: OFF"}</button>
        <span style={{color:"#6b7280",fontSize:12}}>{active.kind!=="—" && <><strong style={{color:active.kind==="technical"?"#60a5fa":"#f59e0b"}}>{active.kind}</strong> · {active.note}</>}</span>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}>
        <canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Compression & Codecs
// ─────────────────────────────────────────────
const CODEC_TABLE=[
  {name:"H.264 / AVC", type:"Inter", comp:"DCT + motion pred.", depth:"8 (10 Hi10)", chroma:"4:2:0", alpha:"No", lic:"Licensed", use:"Delivery, streaming, cameras"},
  {name:"H.265 / HEVC", type:"Inter", comp:"DCT + motion pred.", depth:"8/10/12", chroma:"4:2:0→4:4:4", alpha:"No", lic:"Licensed", use:"4K / HDR delivery"},
  {name:"AV1", type:"Inter", comp:"DCT/ADST + pred.", depth:"8/10/12", chroma:"4:2:0→4:4:4", alpha:"No", lic:"Open · royalty-free", use:"Streaming (YouTube, Netflix)"},
  {name:"VP9", type:"Inter", comp:"DCT + pred.", depth:"8/10/12", chroma:"4:2:0→4:4:4", alpha:"Yes", lic:"Open · royalty-free", use:"YouTube / WebM"},
  {name:"ProRes", type:"Intra", comp:"DCT", depth:"10/12", chroma:"4:2:2 / 4:4:4", alpha:"Yes (4444)", lic:"Proprietary · Apple", use:"Editing / mastering"},
  {name:"DNxHR / DNxHD", type:"Intra", comp:"DCT", depth:"8/10/12", chroma:"4:2:2 / 4:4:4", alpha:"Yes (444)", lic:"Open · SMPTE VC-3", use:"Editing / mastering"},
  {name:"JPEG 2000", type:"Intra", comp:"Wavelet", depth:"8–16", chroma:"up to 4:4:4", alpha:"Yes", lic:"Open · ISO", use:"DCP (cinema), archive"},
  {name:"Camera RAW (BRAW/R3D)", type:"Intra", comp:"Wavelet / proprietary", depth:"12–16 log", chroma:"CFA (pre-debayer)", alpha:"No", lic:"Proprietary", use:"Acquisition · max latitude"},
];
function drawGOP(canvas, mode){
  const W=Math.min(canvas.parentElement?.clientWidth-24||640,640), H=150; canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext("2d"); ctx.clearRect(0,0,W,H);
  const seq = mode==="intra" ? ["I","I","I","I","I","I","I","I"] : ["I","B","B","P","B","B","P","B","B","I"];
  const n=seq.length, m=24, fw=(W-m*2)/n, fh=46, cy=H*0.52, col={I:"#f59e0b",P:"#60a5fa",B:"#a78bfa"};
  const cx=i=>m+i*fw+fw/2;
  // reference arrows
  const refIdx=t=>{}; // computed inline below
  const drawArrow=(x1,x2,up,c)=>{ const y0=up?cy-fh/2-4:cy+fh/2+4, peak=up?y0-26:y0+26, mid=(x1+x2)/2;
    ctx.strokeStyle=c; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x1,y0); ctx.quadraticCurveTo(mid,peak,x2,y0); ctx.stroke();
    const ang=Math.atan2(y0-peak,x2-mid); ctx.beginPath(); ctx.moveTo(x2,y0);
    ctx.lineTo(x2-7*Math.cos(ang-0.5),y0-7*Math.sin(ang-0.5)); ctx.lineTo(x2-7*Math.cos(ang+0.5),y0-7*Math.sin(ang+0.5)); ctx.closePath(); ctx.fillStyle=c; ctx.fill();
  };
  if(mode!=="intra"){
    for(let i=0;i<n;i++){
      if(seq[i]==="P"){ let p=i-1; while(p>=0&&seq[p]==="B")p--; if(p>=0) drawArrow(cx(p),cx(i),false,"#60a5fa88"); }
      if(seq[i]==="B"){ let a=i-1; while(a>=0&&seq[a]==="B")a--; let b=i+1; while(b<n&&seq[b]==="B")b++;
        if(a>=0) drawArrow(cx(a),cx(i),true,"#a78bfa66"); if(b<n) drawArrow(cx(b),cx(i),true,"#a78bfa66"); }
    }
  }
  seq.forEach((t,i)=>{ const x=cx(i)-fw*0.4, w=fw*0.8, y=cy-fh/2;
    ctx.fillStyle=col[t]+"22"; ctx.fillRect(x,y,w,fh); ctx.strokeStyle=col[t]; ctx.lineWidth=2; ctx.strokeRect(x,y,w,fh);
    ctx.fillStyle=col[t]; ctx.font="bold 17px monospace"; ctx.textAlign="center"; ctx.fillText(t,cx(i),cy+6);
  });
  ctx.textAlign="left"; ctx.font="10px monospace"; ctx.fillStyle="#6b7280";
  ctx.fillText(mode==="intra"?"every frame a full keyframe — cut anywhere, big files":"I keyframe · P forward · B both ways · small files",m,H-8);
}
function ModuleCodecs({ image }) {
  const [q,setQ]=useState(65);
  const [gop,setGop]=useState("long");
  const imgRef=useRef(), gopRef=useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=imgRef.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||600,600), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,W,H);
      if(q<100){
        const id=ctx.getImageData(0,0,W,H), d=id.data, blk=8;
        const mix=Math.pow((100-q)/100,1.3)*0.92, levels=Math.max(3,Math.round(q/100*38)+3), step=255/(levels-1);
        for(let by=0;by<H;by+=blk) for(let bx=0;bx<W;bx+=blk){
          let sr=0,sg=0,sb=0,nn=0; const ye=Math.min(H,by+blk), xe=Math.min(W,bx+blk);
          for(let y=by;y<ye;y++)for(let x=bx;x<xe;x++){const i=(y*W+x)*4; sr+=d[i];sg+=d[i+1];sb+=d[i+2];nn++;}
          const mr=sr/nn,mg=sg/nn,mb=sb/nn;
          for(let y=by;y<ye;y++)for(let x=bx;x<xe;x++){const i=(y*W+x)*4;
            d[i]=Math.round((d[i]*(1-mix)+mr*mix)/step)*step;
            d[i+1]=Math.round((d[i+1]*(1-mix)+mg*mix)/step)*step;
            d[i+2]=Math.round((d[i+2]*(1-mix)+mb*mix)/step)*step;
          }
        }
        ctx.putImageData(id,0,0);
      }
      ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";ctx.fillStyle="#f59e0b";
      ctx.fillText(`bitrate/quality: ${q}%   ${q<25?"— heavy 8×8 DCT blocking":q<60?"— visible macroblocks":"— near-transparent"}`,8,14);
    };
    img.src=image;
  },[q,image]);
  useEffect(()=>{ if(gopRef.current) drawGOP(gopRef.current,gop); },[gop]);
  return (
    <div>
      <InfoBox>
        A <strong>codec</strong> (coder-decoder) shrinks video two ways. <strong>Spatial (intra)</strong> compression works <em>inside</em> one frame — a DCT (or wavelet) throws away detail the eye barely sees; too little bitrate and the <strong>8×8 blocks</strong> show up as <em>macroblocking</em>. <strong>Temporal (inter)</strong> compression works <em>between</em> frames: only an <span style={{color:"#f59e0b"}}>I-frame</span> is complete; <span style={{color:"#60a5fa"}}>P-frames</span> store just the change from the previous frame and <span style={{color:"#a78bfa"}}>B-frames</span> interpolate from both sides. <strong>Intra-only</strong> codecs (ProRes, DNxHR) make every frame an I-frame — huge files but you can cut on any frame; <strong>long-GOP</strong> codecs (H.264/265) are tiny but must decode a whole group, which is why they scrub badly on a timeline. The other axes that define a codec: <em>bit depth</em> (8/10/12), <em>chroma</em> (4:2:0…4:4:4), <em>alpha</em>, and <em>open vs licensed</em>.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start",marginBottom:16}}>
        <div style={{flex:"1 1 300px",minWidth:280,background:"#111",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>SPATIAL — bitrate vs blocking</div>
          <canvas ref={imgRef} style={{display:"block",width:"100%",borderRadius:4}}/>
          <label style={{...styles.label,marginTop:10}}>
            Bitrate / quality: <strong style={{color:"#f59e0b"}}>{q}%</strong>
            <input type="range" min={3} max={100} step={1} value={q} onChange={e=>setQ(+e.target.value)} style={{...styles.slider,width:"100%"}}/>
          </label>
        </div>
        <div style={{flex:"1 1 300px",minWidth:280,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>TEMPORAL — GOP structure</div>
          <canvas ref={gopRef} style={{display:"block",width:"100%"}}/>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            {[["Intra-only","intra"],["Long-GOP","long"]].map(([lbl,v])=>(
              <button key={v} onClick={()=>setGop(v)} style={gop===v?styles.btnActive:styles.btnChip}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{overflowX:"auto",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8}}>
        <table style={{borderCollapse:"collapse",width:"100%",fontSize:11.5,fontFamily:"monospace",minWidth:720}}>
          <thead><tr style={{color:"#9ca3af",textAlign:"left"}}>
            {["Codec","Type","Compression","Bit depth","Chroma","Alpha","Licence","Typical use"].map(h=>(
              <th key={h} style={{padding:"8px 10px",borderBottom:"1px solid #1f2937",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {CODEC_TABLE.map((r,i)=>(
              <tr key={i} style={{color:"#d1d5db",background:i%2?"#0f1520":"transparent"}}>
                <td style={{padding:"7px 10px",color:"#f3f4f6",fontWeight:"bold",whiteSpace:"nowrap"}}>{r.name}</td>
                <td style={{padding:"7px 10px",color:r.type==="Intra"?"#f59e0b":"#60a5fa"}}>{r.type}</td>
                <td style={{padding:"7px 10px"}}>{r.comp}</td>
                <td style={{padding:"7px 10px"}}>{r.depth}</td>
                <td style={{padding:"7px 10px"}}>{r.chroma}</td>
                <td style={{padding:"7px 10px"}}>{r.alpha}</td>
                <td style={{padding:"7px 10px",color:/Open/.test(r.lic)?"#34d399":"#f87171"}}>{r.lic}</td>
                <td style={{padding:"7px 10px",color:"#9ca3af"}}>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Containers / Wrappers
// ─────────────────────────────────────────────
const CONTAINERS=[
  {ext:".mov", name:"QuickTime", lic:"Proprietary · Apple (spec public)", open:false,
   video:["ProRes","H.264","H.265","DNxHR","Cineform"], audio:["PCM","AAC","ALAC (multi)"], subs:"Limited (CEA-608/708)", tc:"Yes — dedicated track", meta:"Rich (timecode, reels, LUTs)",
   note:"The post-production standard on Mac. Holds almost any professional codec — a .mov can be ProRes or H.264, the extension tells you nothing about the codec."},
  {ext:".mp4", name:"MPEG-4 Part 14", lic:"Open · ISO/IEC", open:true,
   video:["H.264","H.265","AV1 (fMP4)"], audio:["AAC","MP3","AC-3"], subs:"Basic (tx3g)", tc:"Weak", meta:"Basic",
   note:"The universal delivery / streaming wrapper — plays everywhere, but a narrow codec list. Not a mastering format."},
  {ext:".mxf", name:"Material eXchange Format", lic:"Open · SMPTE", open:true,
   video:["XDCAM","AVC-Intra","DNxHD","JPEG 2000","ProRes (OP1a)"], audio:["PCM — many channels"], subs:"Yes (captions/AS-11)", tc:"Yes — robust", meta:"Very rich (broadcast)",
   note:"Broadcast & archive standard. Strict 'operational patterns' (OP1a…) keep facilities interoperable. Complex but bulletproof."},
  {ext:".mkv", name:"Matroska", lic:"Open", open:true,
   video:["Almost anything"], audio:["Anything, many tracks"], subs:"Excellent (SRT/ASS/PGS…)", tc:"Yes", meta:"Rich · chapters, attachments",
   note:"The most flexible wrapper — but not a broadcast or post interchange standard. Beloved for distribution and multi-language files."},
  {ext:".webm", name:"WebM", lic:"Open · royalty-free", open:true,
   video:["VP8","VP9","AV1"], audio:["Vorbis","Opus"], subs:"WebVTT", tc:"No", meta:"Basic",
   note:"A royalty-free subset of Matroska built for the open web (HTML5 <video>). Web-only in practice."},
  {ext:".avi", name:"Audio Video Interleave", lic:"Proprietary · Microsoft (legacy)", open:false,
   video:["DV","MJPEG","DivX/Xvid"], audio:["PCM","MP3"], subs:"No", tc:"No", meta:"Minimal",
   note:"Legacy from 1992. No proper timecode, awkward past 4 GB, no modern metadata. Avoid for new work."},
];
function ContainerRow({label,value,accent}){
  return (
    <div style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #161c26",fontSize:12.5}}>
      <span style={{color:"#6b7280",width:96,flexShrink:0,fontFamily:"monospace",fontSize:11}}>{label}</span>
      <span style={{color:accent||"#d1d5db"}}>{Array.isArray(value)?value.join(" · "):value}</span>
    </div>
  );
}
function ModuleContainers() {
  const [sel,setSel]=useState(".mov");
  const c=CONTAINERS.find(x=>x.ext===sel)||CONTAINERS[0];
  return (
    <div>
      <InfoBox>
        A <strong>container</strong> (or <em>wrapper</em>) is the file on disk — the box. The <strong>codec</strong> is what's inside it. They are <em>independent</em>: the same H.264 stream can live in a <code>.mp4</code>, a <code>.mov</code> or a <code>.mkv</code>; a <code>.mov</code> might hold ProRes <em>or</em> H.264. <strong>So the extension never tells you the codec</strong> — that is the single most common confusion. A container's job is to <em>multiplex</em> several tracks — video, one or more audio tracks, subtitles, <strong>timecode</strong> and metadata — and keep them in sync. What separates them is <em>what they're allowed to carry</em> and <em>how well</em>: <code>.mp4</code> for universal delivery, <code>.mov</code>/<code>.mxf</code> for professional post and broadcast, <code>.mkv</code> for maximum flexibility.
      </InfoBox>
      <div style={{background:"#0f1a10",border:"1px solid #1f3a24",borderRadius:8,padding:"10px 14px",marginBottom:14,color:"#86efac",fontSize:13}}>
        📦 <strong>Container ≠ codec.</strong> The box is not the same as what's inside it. <code>.mov</code> can hold ProRes or H.264 — you can't know from the extension alone.
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {CONTAINERS.map(x=>(
          <button key={x.ext} onClick={()=>setSel(x.ext)} style={sel===x.ext?styles.btnActive:styles.btnChip}>{x.ext}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 320px",minWidth:300,background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,padding:"14px 18px"}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
            <div><span style={{color:"#f59e0b",fontFamily:"monospace",fontSize:18,fontWeight:"bold"}}>{c.ext}</span> <span style={{color:"#9ca3af",fontSize:13}}>{c.name}</span></div>
            <span style={{fontSize:11,fontFamily:"monospace",padding:"3px 8px",borderRadius:4,background:c.open?"#134e2a":"#4c1d1d",color:c.open?"#86efac":"#fca5a5"}}>{c.open?"OPEN":"PROPRIETARY"}</span>
          </div>
          <div style={{color:"#6b7280",fontSize:11,marginBottom:8}}>{c.lic}</div>
          <ContainerRow label="🎬 video" value={c.video} accent="#93c5fd"/>
          <ContainerRow label="🔊 audio" value={c.audio} accent="#fcd34d"/>
          <ContainerRow label="💬 subtitles" value={c.subs}/>
          <ContainerRow label="⏱ timecode" value={c.tc}/>
          <ContainerRow label="🏷 metadata" value={c.meta}/>
        </div>
        <div style={{flex:"1 1 240px",minWidth:220,background:"#111",borderRadius:10,padding:"14px 18px",color:"#d1d5db",fontSize:13,lineHeight:1.7}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8,letterSpacing:"0.08em"}}>WHEN TO USE</div>
          {c.note}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Signals & Connectivity
// ─────────────────────────────────────────────
const CARRIES={video:["🎬","video"],audio:["🔊","audio"],data:["🖧","data"],control:["🎛","control"],tally:["🔴","tally"],power:["⚡","power"],tc:["⏱","timecode"]};
const SIGNALS=[
  {id:"hdmi",cat:"physical",name:"HDMI",conn:"HDMI Type-A",carries:["video","audio","control"],dist:"~5 m passive · ~15–30 m active/optical",bw:"up to 48 Gb/s (2.1)",lic:"Licensed",open:false,
   note:"Consumer/prosumer. The connector doesn't lock — it pulls out easily, so on set you tape it or use a clamp. No native long runs; convert to SDI or fibre for distance."},
  {id:"sdi",cat:"physical",name:"SDI (HD/3G/6G/12G)",conn:"BNC · 75Ω coax",carries:["video","audio","tc"],dist:"12G ~40–70 m · 3G ~100 m · HD ~140 m",bw:"12G-SDI = 12 Gb/s (2160p60)",lic:"Open · SMPTE",open:true,
   note:"The professional/broadcast cable. Locking BNC, long runs, embedded audio + timecode down one coax. Point-to-point, one direction."},
  {id:"fiber",cat:"physical",name:"Fibre optic",conn:"LC / SC · SMPTE 304 hybrid",carries:["video","audio","data","power"],dist:"Kilometres (single-mode)",bw:"Effectively unlimited",lic:"Open",open:true,
   note:"For very long runs — stadiums, outside broadcast. Needs converters at both ends. SMPTE hybrid cable also carries camera power and return signals."},
  {id:"eth",cat:"physical",name:"Ethernet",conn:"RJ45 / etherCON · Cat5e/6",carries:["data"],dist:"100 m per copper run · switches extend",bw:"1 / 2.5 / 10 GbE",lic:"Open · IEEE",open:true,
   note:"Not a video signal — it's the road the IP transports drive on. NDI, SRT, Dante and Art-Net all ride this. etherCON = rugged locking RJ45 for touring."},
  {id:"usbc",cat:"physical",name:"USB-C",conn:"USB-C",carries:["video","audio","data","power"],dist:"~1–2 m passive",bw:"up to 40 Gb/s (USB4/TB)",lic:"Open · USB-IF",open:true,
   note:"UVC webcams and capture devices, short runs. Handy, not a professional distribution cable."},
  {id:"xlr",cat:"physical",name:"XLR-3 (audio)",conn:"XLR 3-pin",carries:["audio"],dist:"~100 m balanced",bw:"—",lic:"Open",open:true,
   note:"⚠ Balanced analogue audio (mic/line). Looks identical to 3-pin DMX but carries a completely different signal — never cross the two."},
  {id:"dmx",cat:"physical",name:"DMX512",conn:"XLR 5-pin (std) / 3-pin (common)",carries:["data","control"],dist:"~300 m · 32 devices per run",bw:"512 channels / universe",lic:"Open · ANSI E1.11",open:true,
   note:"⚠ Digital lighting-control DATA over RS-485 — not audio, despite the XLR shell. Daisy-chain fixtures and terminate the last one. Detailed in the Lighting module."},
  {id:"ndi",cat:"ip",name:"NDI",conn:"rides on Ethernet / IP",carries:["video","audio","tally","control"],dist:"LAN (network-limited)",bw:"~100–250 Mb/s Full · HX low-bitrate",lic:"Proprietary · SDK free",open:false,
   note:"IP video over an ordinary LAN — NOT a cable. Full needs 1GbE+; HX is compressed for WiFi. Auto-discovery and tally are built in. See LiveMixR-style workflows."},
  {id:"srt",cat:"ip",name:"SRT",conn:"rides on IP / internet",carries:["video","audio"],dist:"Internet (WAN)",bw:"Adaptive",lic:"Open · royalty-free",open:true,
   note:"Reliable video over the unpredictable public internet: recovers lost packets (ARQ) and can encrypt. The go-to for contribution feeds over 4G/5G/home links."},
  {id:"rtmp",cat:"ip",name:"RTMP",conn:"rides on IP / internet",carries:["video","audio"],dist:"Internet (WAN)",bw:"Depends on encoder",lic:"Open · legacy",open:true,
   note:"The classic livestream ingest to YouTube/Twitch. Ageing (H.264/AAC only) but universally accepted by platforms for delivery."},
  {id:"dante",cat:"ip",name:"Dante",conn:"rides on Ethernet / IP",carries:["audio","data"],dist:"LAN",bw:"Hundreds of channels",lic:"Proprietary · Audinate",open:false,
   note:"Audio-over-IP, the install/live-sound standard. Not video. AES67 is the open layer that lets Dante interoperate with other AoIP systems."},
  {id:"artnet",cat:"ip",name:"Art-Net / sACN",conn:"rides on Ethernet / IP",carries:["control","data"],dist:"LAN",bw:"Many DMX universes",lic:"Open",open:true,
   note:"DMX over the network: many universes down one Ethernet cable to nodes that break out to physical DMX runs. The backbone of larger lighting rigs. See Lighting."},
];
function ModuleSignals() {
  const [sel,setSel]=useState("sdi");
  const s=SIGNALS.find(x=>x.id===sel)||SIGNALS[0];
  const phys=SIGNALS.filter(x=>x.cat==="physical"), ip=SIGNALS.filter(x=>x.cat==="ip");
  const Chip=x=>(
    <button key={x.id} onClick={()=>setSel(x.id)} style={sel===x.id?styles.btnActive:styles.btnChip}>{x.name}</button>
  );
  return (
    <div>
      <InfoBox>
        Signals are easiest to understand on <strong>three separate axes</strong>, because people constantly mix them up. <strong>(1) The physical interface</strong> — the cable and connector you can hold: HDMI, SDI (BNC coax), fibre, Ethernet (RJ45), USB-C, XLR. <strong>(2) The transport / protocol</strong> — <em>how</em> the data travels, especially over a network: <span style={{color:"#2dd4bf"}}>NDI, SRT, RTMP, Dante, Art-Net are NOT cables</span> — they ride <em>on top of</em> Ethernet/IP. <strong>(3) What it carries</strong> — video, audio, data, control, tally, power; some cables carry several at once (SDI = video + audio + timecode). Then judge each by <em>distance limits</em> and <em>open vs licensed</em>. The classic trap: a 3-pin <strong>XLR</strong> can be <em>balanced audio</em> or <em>DMX lighting data</em> — same plug, totally different signal.
      </InfoBox>
      <div style={{background:"#0f1a1a",border:"1px solid #164e46",borderRadius:8,padding:"10px 14px",marginBottom:14,color:"#5eead4",fontSize:13}}>
        🌐 <strong>Cables vs transports.</strong> Ethernet is the road; <strong>NDI, SRT, Dante, Art-Net</strong> are vehicles that drive on it. Asking "NDI or a cable?" is the wrong question — NDI <em>runs over</em> a cable.
      </div>
      <div style={{marginBottom:6,color:"#6b7280",fontSize:10,fontFamily:"monospace",letterSpacing:"0.08em"}}>PHYSICAL INTERFACES (cables &amp; connectors)</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{phys.map(Chip)}</div>
      <div style={{marginBottom:6,color:"#6b7280",fontSize:10,fontFamily:"monospace",letterSpacing:"0.08em"}}>IP TRANSPORTS / PROTOCOLS (ride on Ethernet)</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>{ip.map(Chip)}</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 340px",minWidth:300,background:"#0d1117",border:`1px solid ${s.cat==="ip"?"#164e46":"#1f2937"}`,borderRadius:10,padding:"14px 18px"}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:6}}>
            <span style={{color:"#f3f4f6",fontSize:17,fontWeight:"bold"}}>{s.name}</span>
            <span style={{fontSize:11,fontFamily:"monospace",padding:"3px 8px",borderRadius:4,background:s.cat==="ip"?"#134e4a":"#1e3a5f",color:s.cat==="ip"?"#5eead4":"#93c5fd"}}>
              {s.cat==="ip"?"IP TRANSPORT":"PHYSICAL CABLE"}
            </span>
          </div>
          <ContainerRow label="connector" value={s.conn} accent="#e5e7eb"/>
          <div style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #161c26",fontSize:12.5}}>
            <span style={{color:"#6b7280",width:96,flexShrink:0,fontFamily:"monospace",fontSize:11}}>carries</span>
            <span style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {s.carries.map(k=>(<span key={k} style={{color:"#d1d5db"}}>{CARRIES[k][0]} {CARRIES[k][1]}</span>))}
            </span>
          </div>
          <ContainerRow label="max distance" value={s.dist} accent="#fcd34d"/>
          <ContainerRow label="bandwidth" value={s.bw}/>
          <div style={{display:"flex",gap:10,padding:"7px 0",fontSize:12.5}}>
            <span style={{color:"#6b7280",width:96,flexShrink:0,fontFamily:"monospace",fontSize:11}}>licence</span>
            <span style={{color:s.open?"#86efac":"#fca5a5"}}>{s.lic}</span>
          </div>
        </div>
        <div style={{flex:"1 1 240px",minWidth:220,background:"#111",borderRadius:10,padding:"14px 18px",color:"#d1d5db",fontSize:13,lineHeight:1.7}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8,letterSpacing:"0.08em"}}>NOTES</div>
          {s.note}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Lens Distortion
// ─────────────────────────────────────────────
function ModuleLensDistortion({ image }) {
  const [k,setK]=useState(0.28);
  const [grid,setGrid]=useState(true);
  const ref=useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||640,640), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d");
      const src=document.createElement("canvas"); src.width=W;src.height=H; const sctx=src.getContext("2d");
      sctx.drawImage(img,0,0,W,H);
      if(grid){ sctx.strokeStyle="rgba(255,255,255,0.35)"; sctx.lineWidth=1;
        for(let x=0;x<=W;x+=W/12){ sctx.beginPath();sctx.moveTo(x,0);sctx.lineTo(x,H);sctx.stroke(); }
        for(let y=0;y<=H;y+=H/7){ sctx.beginPath();sctx.moveTo(0,y);sctx.lineTo(W,y);sctx.stroke(); } }
      const sd=sctx.getImageData(0,0,W,H).data, out=ctx.createImageData(W,H), od=out.data;
      const cx=W/2, cy=H/2, norm=Math.hypot(cx,cy);
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        const dx=(x-cx)/norm, dy=(y-cy)/norm, r2=dx*dx+dy*dy;
        const f=1+k*r2;                       // +k barrel, −k pincushion
        const sx=Math.round(cx+dx*f*norm), sy=Math.round(cy+dy*f*norm);
        const o=(y*W+x)*4;
        if(sx>=0&&sx<W&&sy>=0&&sy<H){ const s=(sy*W+sx)*4; od[o]=sd[s];od[o+1]=sd[s+1];od[o+2]=sd[s+2];od[o+3]=255; }
        else { od[o]=8;od[o+1]=8;od[o+2]=11;od[o+3]=255; }
      }
      ctx.putImageData(out,0,0);
      ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";ctx.fillStyle="#f87171";
      ctx.fillText(`${k>0.02?"barrel":k<-0.02?"pincushion":"rectilinear"}  ·  k = ${k.toFixed(2)}`,8,14);
    };
    img.src=image;
  },[k,grid,image]);
  return (
    <div>
      <InfoBox>
        <strong>Geometric distortion</strong> is a lens failing to keep straight lines straight. <strong>Barrel</strong> distortion bows lines <em>outward</em> (magnification falls toward the edges) — typical of wide-angle and fisheye lenses. <strong>Pincushion</strong> bows them <em>inward</em> — common at the long end of zooms. Many zooms are barrel at the wide end and pincushion at the tele end, passing through a near-perfect <em>rectilinear</em> point in between. It is corrected with lens profiles (in-camera or in post — Resolve, Lightroom, PTLens) using the model r′ = r(1 + k·r²). Watch the straight grid lines bow as you drag; the correction is simply the inverse warp.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <label style={styles.label}>
          Distortion: <strong style={{color:"#f59e0b"}}>{k>0.02?"barrel":k<-0.02?"pincushion":"none"} ({k.toFixed(2)})</strong>
          <input type="range" min={-0.4} max={0.4} step={0.01} value={k} onChange={e=>setK(+e.target.value)} style={{...styles.slider,width:220}}/>
        </label>
        <button onClick={()=>setGrid(g=>!g)} style={grid?styles.btnActive:styles.btnChip}>{grid?"Grid: ON":"Grid: OFF"}</button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}><canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/></div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Interlacing & Combing
// ─────────────────────────────────────────────
function ModuleInterlacing({ image }) {
  const [motion,setMotion]=useState(14);
  const [mode,setMode]=useState("interlaced");  // progressive | interlaced | bob
  const ref=useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||640,640), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d");
      // field 1 (even lines) at position 0, field 2 (odd lines) shifted by motion (captured 1/50s later)
      const fA=document.createElement("canvas"); fA.width=W;fA.height=H; fA.getContext("2d").drawImage(img,0,0,W,H);
      const fB=document.createElement("canvas"); fB.width=W;fB.height=H; fB.getContext("2d").drawImage(img,motion,0,W,H);
      const a=fA.getContext("2d").getImageData(0,0,W,H).data, b=fB.getContext("2d").getImageData(0,0,W,H).data;
      const out=ctx.createImageData(W,H), od=out.data;
      for(let y=0;y<H;y++){
        let srcData, useB=(y%2===1);
        if(mode==="progressive") useB=false;
        if(mode==="bob") useB=false;  // bob: drop one field, double the other (shown as line-doubled fieldA)
        const row = (mode==="bob") ? (Math.floor(y/2)*2) : y;   // duplicate even lines
        for(let x=0;x<W;x++){
          const o=(y*W+x)*4; const sd = useB? b : a; const s=(row*W+x)*4;
          od[o]=sd[s];od[o+1]=sd[s+1];od[o+2]=sd[s+2];od[o+3]=255;
        }
      }
      ctx.putImageData(out,0,0);
      ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";
      ctx.fillStyle=mode==="interlaced"?"#f87171":"#34d399";
      ctx.fillText(mode==="interlaced"?`INTERLACED — combing on motion (${motion}px/field)`:mode==="bob"?"BOB DEINTERLACE — one field, line-doubled":"PROGRESSIVE — whole frame at once",8,14);
    };
    img.src=image;
  },[motion,mode,image]);
  return (
    <div>
      <InfoBox>
        <strong>Interlacing</strong> (the <em>i</em> in 1080<strong>i</strong>, 576<strong>i</strong>) splits every frame into two <strong>fields</strong> — the odd lines, then the even lines — captured a <em>fraction of a second apart</em>. On a CRT it looked smooth; on a progressive display, anything that moves shows <strong>combing</strong> — interleaved teeth where the two fields no longer line up. <strong>Deinterlacing</strong> fixes it: <em>weave</em> (just recombine — fine for static shots), <em>bob</em> (throw away one field and line-double the other — softer but no teeth), or motion-adaptive (the good, expensive one). Modern acquisition is progressive (1080p, 2160p); interlacing survives in broadcast legacy and archive. Drag <em>motion</em> to see the teeth grow, then switch to <em>bob</em> to remove them.
      </InfoBox>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:8}}>
          {[["Progressive","progressive"],["Interlaced","interlaced"],["Bob deint.","bob"]].map(([lbl,v])=>(
            <button key={v} onClick={()=>setMode(v)} style={mode===v?styles.btnActive:styles.btnChip}>{lbl}</button>
          ))}
        </div>
        <label style={styles.label}>
          Motion: <strong style={{color:"#f59e0b"}}>{motion}px/field</strong>
          <input type="range" min={0} max={30} step={1} value={motion} onChange={e=>setMotion(+e.target.value)} style={{...styles.slider,width:180}}/>
        </label>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}><canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/></div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Halation & Bloom
// ─────────────────────────────────────────────
function ModuleHalation({ image }) {
  const [thr,setThr]=useState(0.72);
  const [amt,setAmt]=useState(0.7);
  const [halo,setHalo]=useState(true);
  const ref=useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||640,640), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,W,H);
      // extract highlights above threshold
      const id=ctx.getImageData(0,0,W,H), d=id.data;
      const hi=document.createElement("canvas"); hi.width=W;hi.height=H; const hc=hi.getContext("2d");
      const hid=hc.createImageData(W,H), hd=hid.data;
      for(let i=0;i<d.length;i+=4){ const l=luma709(d[i],d[i+1],d[i+2])/255;
        const m=l>thr?(l-thr)/(1-thr):0;
        if(halo){ hd[i]=Math.min(255,d[i]*m*1.1+40*m); hd[i+1]=d[i+1]*m*0.55; hd[i+2]=d[i+2]*m*0.4; } // reddish halation
        else { hd[i]=d[i]*m; hd[i+1]=d[i+1]*m; hd[i+2]=d[i+2]*m; }                                    // neutral bloom
        hd[i+3]=255;
      }
      hc.putImageData(hid,0,0);
      // blur the highlight layer (progressive downscale) and screen it back
      let cur=hi; const passes=3;
      for(let p=0;p<passes;p++){ const nw=Math.max(2,cur.width>>1),nh=Math.max(2,cur.height>>1);
        const t=document.createElement("canvas");t.width=nw;t.height=nh; const tc=t.getContext("2d");tc.imageSmoothingEnabled=true;tc.drawImage(cur,0,0,nw,nh); cur=t; }
      ctx.globalCompositeOperation="screen"; ctx.globalAlpha=amt; ctx.imageSmoothingEnabled=true;
      ctx.drawImage(cur,0,0,W,H); ctx.drawImage(cur,0,0,W,H);
      ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
      ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";ctx.fillStyle="#f59e0b";
      ctx.fillText(`${halo?"halation (red)":"bloom (neutral)"}  ·  threshold ${Math.round(thr*100)} IRE  ·  ${Math.round(amt*100)}%`,8,14);
    };
    img.src=image;
  },[thr,amt,halo,image]);
  return (
    <div>
      <InfoBox>
        <strong>Bloom</strong> is light bleeding out of bright areas — glare scattering in the lens and around sensor photosites, so highlights glow past their edges. <strong>Halation</strong> is the film cousin: light passes through the emulsion, reflects off the film backing and re-exposes the surrounding grains — classically a <em>red/orange</em> ring around highlights (tungsten bulbs, sunlit windows, neon), because the red-sensitive layer sits deepest. Kodak Vision3 and stocks without an anti-halation layer show it strongly; it's now faked in post for a filmic look (and baked into looks like teal-and-orange grades). Push <em>threshold</em> to pick which highlights glow, <em>amount</em> for strength, and toggle the red halation tint vs neutral bloom.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <label style={styles.label}>Threshold: <strong style={{color:"#f59e0b"}}>{Math.round(thr*100)} IRE</strong>
          <input type="range" min={0.3} max={0.95} step={0.01} value={thr} onChange={e=>setThr(+e.target.value)} style={{...styles.slider,width:160}}/></label>
        <label style={styles.label}>Amount: <strong style={{color:"#f59e0b"}}>{Math.round(amt*100)}%</strong>
          <input type="range" min={0} max={1} step={0.01} value={amt} onChange={e=>setAmt(+e.target.value)} style={{...styles.slider,width:160}}/></label>
        <button onClick={()=>setHalo(h=>!h)} style={halo?styles.btnActive:styles.btnChip}>{halo?"Halation (red)":"Bloom (neutral)"}</button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}><canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/></div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Flicker & Rolling Bands
// ─────────────────────────────────────────────
function ModuleFlicker({ image }) {
  const [freq,setFreq]=useState(50);
  const [shutter,setShutter]=useState(180);
  const [animate,setAnimate]=useState(true);
  const ref=useRef();
  useEffect(()=>{
    const img=new Image(); let raf=0,t0=null,alive=true;
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||640,640), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d");
      const depth=0.42*(1-shutter/360)+0.12;               // shorter shutter → deeper bands
      const cycles=freq/25;                                 // 50Hz≈2, 60Hz≈2.4 bands over the frame at 25fps
      const draw=(ph)=>{
        ctx.drawImage(img,0,0,W,H);
        for(let y=0;y<H;y+=2){
          const f=1-depth*0.5*(1+Math.sin(2*Math.PI*((y/H)*cycles - ph)));
          ctx.fillStyle=`rgba(0,0,0,${Math.max(0,1-f)})`; ctx.fillRect(0,y,W,2);
        }
        ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";ctx.fillStyle="#f87171";
        ctx.fillText(`${freq} Hz light  ·  ${shutter}° shutter  ·  rolling exposure bands`,8,14);
      };
      const loop=(t)=>{ if(!alive)return; if(t0==null)t0=t; draw(((t-t0)/1000)*0.7); raf=requestAnimationFrame(loop); };
      if(animate){ raf=requestAnimationFrame(loop); } else { draw(0); }
    };
    img.src=image;
    return ()=>{ alive=false; cancelAnimationFrame(raf); };
  },[freq,shutter,animate,image]);
  return (
    <div>
      <InfoBox>
        <strong>Flicker</strong> comes from lights that pulse faster than the eye can see. Mains lighting runs at <strong>2× the grid frequency</strong> (100 Hz on 50 Hz mains, 120 Hz on 60 Hz); cheap <strong>LED and HMI</strong> fixtures pulse via PWM dimming. If the camera's exposure time isn't an exact multiple of that pulse, each frame — or, with a rolling shutter, each <em>band of scan lines</em> — catches a different part of the cycle, so you get <strong>rolling brightness bands</strong> or whole-frame flicker. The fix on set is to match up: shoot 50i/25p under 50 Hz, 60i/30p under 60 Hz, keep the shutter at a matching angle (172.8°/180°), or use flicker-free fixtures. Global-shutter and film cameras flicker as a whole frame; CMOS rolling shutters show the moving bands here.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:8}}>
          {[50,60].map(v=>(<button key={v} onClick={()=>setFreq(v)} style={freq===v?styles.btnActive:styles.btnChip}>{v} Hz</button>))}
        </div>
        <label style={styles.label}>Shutter angle: <strong style={{color:"#f59e0b"}}>{shutter}°</strong>
          <input type="range" min={45} max={360} step={5} value={shutter} onChange={e=>setShutter(+e.target.value)} style={{...styles.slider,width:180}}/></label>
        <button onClick={()=>setAnimate(a=>!a)} style={animate?styles.btnActive:styles.btnChip}>{animate?"Roll: ON":"Roll: OFF"}</button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}><canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/></div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Focus Breathing
// ─────────────────────────────────────────────
function ModuleFocusBreathing({ image }) {
  const [focus,setFocus]=useState(0.5);
  const [amount,setAmount]=useState(0.6);
  const [animate,setAnimate]=useState(true);
  const ref=useRef();
  useEffect(()=>{
    const img=new Image(); let raf=0,t0=null,alive=true;
    img.onload=()=>{
      const c=ref.current; if(!c)return;
      const W=Math.min(c.parentElement?.clientWidth-32||640,640), H=Math.round(W*9/16);
      c.width=W;c.height=H; const ctx=c.getContext("2d");
      const draw=(fv)=>{
        const scale=1+amount*0.16*(fv-0.5)*2;              // focus near → FOV narrows (image grows)
        const dw=W*scale, dh=H*scale; ctx.fillStyle="#08080b"; ctx.fillRect(0,0,W,H);
        ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
        // fixed frame reference (crop marks) so the breathing is visible
        ctx.strokeStyle="rgba(255,255,255,0.5)"; ctx.lineWidth=1; const m=14, L=18;
        [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(([x,y,sx,sy])=>{
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+sx*L,y);ctx.moveTo(x,y);ctx.lineTo(x,y+sy*L);ctx.stroke();
        });
        ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(0,0,W,22);ctx.font="11px monospace";ctx.fillStyle="#f59e0b";
        ctx.fillText(`focus ${fv<0.45?"near":fv>0.55?"far":"mid"}  ·  FOV shift ${((scale-1)*100).toFixed(1)}%  (breathing)`,8,14);
      };
      const loop=(t)=>{ if(!alive)return; if(t0==null)t0=t; const fv=0.5+0.5*Math.sin((t-t0)/1000*1.1); draw(fv); raf=requestAnimationFrame(loop); };
      if(animate){ raf=requestAnimationFrame(loop); } else { draw(focus); }
    };
    img.src=image;
    return ()=>{ alive=false; cancelAnimationFrame(raf); };
  },[focus,amount,animate,image]);
  return (
    <div>
      <InfoBox>
        <strong>Focus breathing</strong> is a lens changing its <em>field of view</em> as you rack focus — pull from a near subject to a far one and the framing subtly zooms. It happens because moving the focusing group also shifts the effective focal length. It's distracting on a focus pull and makes match-cuts and VFX plates harder, so <strong>cine lenses</strong> are engineered to minimise it (internal-focus designs, floating elements) — one of the things you pay for over stills glass. Some cameras now offer electronic <em>breathing compensation</em> (a slight digital crop that counteracts it). Watch the image creep past the fixed crop marks as focus rolls near↔far.
      </InfoBox>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <label style={{...styles.label,opacity:animate?0.4:1}}>Focus: <strong style={{color:"#f59e0b"}}>{focus<0.45?"near":focus>0.55?"far":"mid"}</strong>
          <input type="range" min={0} max={1} step={0.01} value={focus} disabled={animate} onChange={e=>setFocus(+e.target.value)} style={{...styles.slider,width:180}}/></label>
        <label style={styles.label}>Breathing amount: <strong style={{color:"#f59e0b"}}>{Math.round(amount*100)}%</strong>
          <input type="range" min={0} max={1} step={0.01} value={amount} onChange={e=>setAmount(+e.target.value)} style={{...styles.slider,width:160}}/></label>
        <button onClick={()=>setAnimate(a=>!a)} style={animate?styles.btnActive:styles.btnChip}>{animate?"Auto rack: ON":"Auto rack: OFF"}</button>
      </div>
      <div style={{background:"#111",borderRadius:8,padding:12}}><canvas ref={ref} style={{display:"block",width:"100%",borderRadius:4}}/></div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Portrait Lighting (2.5D shaded bust)
// ─────────────────────────────────────────────
const LIGHT_PATTERNS=[
  {id:"butterfly",name:"Butterfly / Paramount",az:0,el:52,note:"Key straight in front and high — a small symmetrical shadow under the nose (the 'butterfly'). Glamour and beauty lighting."},
  {id:"loop",name:"Loop",az:33,el:40,note:"Key slightly off-axis and above — the nose casts a short shadow 'loop' down and to the side. The everyday, flattering key position."},
  {id:"rembrandt",name:"Rembrandt",az:52,el:48,note:"Further round — the nose shadow meets the cheek shadow, leaving a lit triangle under the far eye. Dramatic and classic."},
  {id:"split",name:"Split",az:90,el:6,note:"Key straight to one side — half the face lit, half in shadow. Tense, mysterious, high-contrast."},
  {id:"rim",name:"Rim / Back",az:150,el:26,note:"Key behind the subject — only the edge of the face and hair glow, separating them from the background. A separation light, not a key."},
];
function shadeBust(canvas, {az,el,intensity,softness,kelvin,fill}){
  const S=Math.min(canvas.parentElement?.clientWidth-24||360,360); canvas.width=S; canvas.height=S;
  const ctx=canvas.getContext("2d"); const img=ctx.createImageData(S,S), d=img.data;
  const azr=az*Math.PI/180, elr=el*Math.PI/180;
  const L=[Math.sin(azr)*Math.cos(elr), -Math.sin(elr), Math.cos(azr)*Math.cos(elr)]; // to-light
  const kt=kelvinToRGB(kelvin), lc=[kt[0]/255,kt[1]/255,kt[2]/255];
  const hcx=S*0.5, hcy=S*0.46, R=S*0.32;
  const specSharp= softness<0.5? 40:14; const term=0.04+softness*0.5; // terminator softness
  const skin=[232,188,150];
  // face relief height field (nose ridge, brow, eye sockets, mouth)
  const dfn=(X,Y)=>{ let h=0;
    h += 0.34*Math.exp(-X*X*40)*Math.exp(-Math.pow((Y-0.14)/0.24,2));                    // nose ridge → tip
    h += 0.07*Math.exp(-Math.pow((Y+0.30)/0.09,2))*Math.exp(-X*X*3);                      // brow ridge
    h -= 0.11*(Math.exp(-((X-0.33)**2*40+(Y+0.02)**2*52))+Math.exp(-((X+0.33)**2*40+(Y+0.02)**2*52))); // eye sockets
    h -= 0.05*Math.exp(-((Y-0.56)**2*70+X*X*9));                                          // mouth line
    return h; };
  const eps=0.012;
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i=(y*S+x)*4; d[i+3]=255;
    const nx=(x-hcx)/R, ny=(y-hcy)/(R*1.12); let r2=nx*nx+ny*ny;   // slightly oval head
    if(r2<=1){
      const nz=Math.sqrt(1-r2);
      const hx=(dfn(nx+eps,ny)-dfn(nx-eps,ny))/(2*eps), hy=(dfn(nx,ny+eps)-dfn(nx,ny-eps))/(2*eps);
      let NX=nx-hx, NY=ny-hy, NZ=nz; const ln=Math.hypot(NX,NY,NZ); NX/=ln;NY/=ln;NZ/=ln;
      const nd=NX*L[0]+NY*L[1]+NZ*L[2];
      const diff=Math.max(0,(nd+term)/(1+term)); const dsm=diff*diff*(3-2*diff);
      const rf2=2*nd; let sp=Math.max(0, rf2*NZ-L[2]); sp=Math.pow(sp,specSharp)*(nd>0?1:0);
      const amb=0.10+fill*0.16;
      // base colour: skin, darker in eye sockets / mouth, hair on top & sides
      let base=skin;
      const inHair = ny < -0.42 || (r2>0.72 && ny<0.15);           // hairline cap + temples
      const inEye = (Math.hypot((nx-0.33)*1.1,(ny+0.02))<0.12)||(Math.hypot((nx+0.33)*1.1,(ny+0.02))<0.12);
      if(inHair) base=[60,44,32];
      else if(inEye) base=[70,58,52];
      for(let ch=0;ch<3;ch++){ let v=base[ch]*(amb+intensity*dsm*lc[ch]); if(!inHair&&!inEye) v+=255*sp*intensity*0.5*lc[ch]; d[i+ch]=Math.max(0,Math.min(255,v)); }
      // pupils
      if((Math.hypot(nx-0.33,ny+0.02)<0.045)||(Math.hypot(nx+0.33,ny+0.02)<0.045)){ d[i]*=0.4;d[i+1]*=0.4;d[i+2]*=0.45; }
      continue;
    }
    // shoulders (torso) — a wide rounded form below
    const tx=(x-hcx)/(S*0.42), ty=(y-(S*0.98))/(S*0.34);
    if(ty> -1 && ty<0 && Math.abs(tx)<1){
      const tnz=Math.sqrt(Math.max(0,1-tx*tx*0.9)); const tnorm=[tx*0.9,-0.2,tnz]; const tl=Math.hypot(...tnorm);
      const nd=(tnorm[0]*L[0]+tnorm[1]*L[1]+tnorm[2]*L[2])/tl; const diff=Math.max(0,(nd+term)/(1+term));
      const cloth=[70,84,110], amb=0.14+fill*0.14;
      for(let ch=0;ch<3;ch++){ d[i+ch]=Math.max(0,Math.min(255,cloth[ch]*(amb+intensity*diff*diff*lc[ch]))); }
      continue;
    }
    // background gradient
    const bg=18+ (1-y/S)*10; d[i]=bg*0.7;d[i+1]=bg*0.75;d[i+2]=bg;
  }
  ctx.putImageData(img,0,0);
  ctx.fillStyle="rgba(0,0,0,0.55)";ctx.fillRect(0,0,S,20);ctx.font="11px monospace";ctx.fillStyle="#facc15";
  ctx.textAlign="left"; ctx.fillText("FRONT — shaded by key (N·L + specular)",8,14);
}
function drawTopDown(canvas, az, dist){
  const W=Math.min(canvas.parentElement?.clientWidth-24||300,300), H=W; canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d"); ctx.clearRect(0,0,W,H);
  const cx=W/2, cy=H*0.54, R=W*0.13;
  // camera at bottom
  ctx.fillStyle="#374151"; ctx.beginPath(); ctx.moveTo(cx-12,H-8); ctx.lineTo(cx+12,H-8); ctx.lineTo(cx+7,H-24); ctx.lineTo(cx-7,H-24); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#6b7280"; ctx.font="9px monospace"; ctx.textAlign="center"; ctx.fillText("camera",cx,H-2);
  // head from above (nose toward camera = down)
  ctx.fillStyle="#5b4636"; ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.fill();
  ctx.fillStyle="#7a5c44"; ctx.beginPath(); ctx.moveTo(cx-4,cy+R-2); ctx.lineTo(cx+4,cy+R-2); ctx.lineTo(cx,cy+R+7); ctx.closePath(); ctx.fill(); // nose
  // azimuth ring
  ctx.strokeStyle="#1f2937"; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.arc(cx,cy,R+dist,0,7); ctx.stroke(); ctx.setLineDash([]);
  // light marker: az measured from camera axis (front=down toward camera)
  const a=(az)*Math.PI/180; const lx=cx+Math.sin(a)*(R+dist), ly=cy+Math.cos(a)*(R+dist);
  // beam
  const g=ctx.createRadialGradient(lx,ly,2,lx,ly,dist*1.1); g.addColorStop(0,"rgba(250,204,21,0.5)"); g.addColorStop(1,"rgba(250,204,21,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly,dist*1.1,0,7); ctx.fill();
  ctx.strokeStyle="rgba(250,204,21,0.5)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(cx,cy); ctx.stroke();
  ctx.fillStyle="#facc15"; ctx.beginPath(); ctx.arc(lx,ly,7,0,7); ctx.fill();
  ctx.fillStyle="#0b0b0e"; ctx.font="bold 9px monospace"; ctx.fillText("KEY",lx,ly+3);
  ctx.fillStyle="#6b7280"; ctx.font="9px monospace"; ctx.textAlign="left"; ctx.fillText("drag the key light →  azimuth "+Math.round(az)+"°",8,14);
  return {cx,cy,lx,ly};
}
function ModulePortraitLight() {
  const [az,setAz]=useState(33),[el,setEl]=useState(40),[intensity,setInt]=useState(0.95),[soft,setSoft]=useState(0.4),[kelvin,setKelvin]=useState(5500),[fill,setFill]=useState(0.4),[pattern,setPattern]=useState("loop");
  const [dist]=useState(70);
  const frontRef=useRef(), topRef=useRef(), dragRef=useRef(false);
  useEffect(()=>{ if(frontRef.current) shadeBust(frontRef.current,{az,el,intensity,softness:soft,kelvin,fill}); },[az,el,intensity,soft,kelvin,fill]);
  useEffect(()=>{ if(topRef.current) drawTopDown(topRef.current,az,dist); },[az,dist]);
  const applyPattern=p=>{ const pt=LIGHT_PATTERNS.find(x=>x.id===p); if(pt){ setPattern(p); setAz(pt.az); setEl(pt.el); } };
  const onTop=(e)=>{
    if(!dragRef.current) return; const c=topRef.current, r=c.getBoundingClientRect();
    const x=(e.clientX-r.left)*(c.width/r.width), y=(e.clientY-r.top)*(c.height/r.height);
    const cx=c.width/2, cy=c.height*0.54; let a=Math.atan2(x-cx,y-cy)*180/Math.PI; // 0=down(front)
    a=Math.max(-170,Math.min(170,a)); setAz(a); setPattern("");
  };
  const curNote=LIGHT_PATTERNS.find(x=>x.id===pattern)?.note;
  return (
    <div>
      <InfoBox>
        The <strong>key light</strong> is the main light that models the face — and <em>where you put it</em> is the single biggest creative choice in portraiture. Swing it around the subject (azimuth) and raise it (elevation) and the shadow of the nose and brow carves out the classic <strong>patterns</strong>: <em>butterfly</em>, <em>loop</em>, <em>Rembrandt</em>, <em>split</em>. Raise the light for a natural top-down key; drop it for an eerie under-light. <strong>Soft</strong> sources (big, close — softbox, bounce) give gentle, wide shadow edges; <strong>hard</strong> sources (small, far — bare bulb, sun) give crisp terminators and bright speculars. <strong>Fill</strong> lifts the shadow side to set the contrast ratio; <strong>colour temperature</strong> sets the mood. This is a 2.5D model — the face is shaded live by the light direction (N·L + specular). Drag the key around the top-down diagram, or pick a pattern.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {LIGHT_PATTERNS.map(p=>(
          <button key={p.id} onClick={()=>applyPattern(p.id)} style={pattern===p.id?styles.btnActive:styles.btnChip}>{p.name}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 300px",minWidth:260,background:"#0d1117",borderRadius:8,padding:12,textAlign:"center"}}>
          <canvas ref={frontRef} style={{display:"block",width:"100%",maxWidth:360,margin:"0 auto",borderRadius:4}}/>
        </div>
        <div style={{flex:"1 1 260px",minWidth:240,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:12,textAlign:"center"}}>
          <canvas ref={topRef}
            onPointerDown={e=>{dragRef.current=true; e.currentTarget.setPointerCapture(e.pointerId); onTop(e);}}
            onPointerMove={onTop}
            onPointerUp={e=>{dragRef.current=false;}}
            style={{display:"block",width:"100%",maxWidth:300,margin:"0 auto",cursor:"grab",touchAction:"none"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:18,flexWrap:"wrap",marginTop:14}}>
        <label style={styles.label}>Azimuth: <strong style={{color:"#f59e0b"}}>{Math.round(az)}°</strong>
          <input type="range" min={-170} max={170} step={1} value={az} onChange={e=>{setAz(+e.target.value);setPattern("");}} style={{...styles.slider,width:170}}/></label>
        <label style={styles.label}>Elevation: <strong style={{color:"#f59e0b"}}>{Math.round(el)}°</strong>
          <input type="range" min={-30} max={80} step={1} value={el} onChange={e=>{setEl(+e.target.value);setPattern("");}} style={{...styles.slider,width:150}}/></label>
        <label style={styles.label}>Softness: <strong style={{color:"#f59e0b"}}>{Math.round(soft*100)}%</strong>
          <input type="range" min={0} max={1} step={0.01} value={soft} onChange={e=>setSoft(+e.target.value)} style={{...styles.slider,width:130}}/></label>
        <label style={styles.label}>Fill: <strong style={{color:"#f59e0b"}}>{Math.round(fill*100)}%</strong>
          <input type="range" min={0} max={1} step={0.01} value={fill} onChange={e=>setFill(+e.target.value)} style={{...styles.slider,width:120}}/></label>
        <label style={styles.label}>Key colour: <strong style={{color:"#f59e0b"}}>{kelvin}K</strong>
          <input type="range" min={2800} max={8000} step={100} value={kelvin} onChange={e=>setKelvin(+e.target.value)} style={{...styles.slider,width:140}}/></label>
      </div>
      {curNote && <div style={{marginTop:12,padding:"10px 14px",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,color:"#d1d5db",fontSize:13,lineHeight:1.6}}><strong style={{color:"#facc15"}}>{LIGHT_PATTERNS.find(x=>x.id===pattern)?.name}:</strong> {curNote}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: DMX Lighting Control
// ─────────────────────────────────────────────
const DMX_FIXTURES=[
  {id:"dimmer",name:"Dimmer (1ch)",addr:1,chans:[{n:"Intensity",v:255}]},
  {id:"par",name:"RGB PAR (4ch)",addr:11,chans:[{n:"Dimmer",v:255},{n:"Red",v:255},{n:"Green",v:40},{n:"Blue",v:120}]},
  {id:"mover",name:"Moving head (8ch)",addr:21,chans:[{n:"Pan",v:128},{n:"Tilt",v:90},{n:"Dimmer",v:220},{n:"Red",v:80},{n:"Green",v:180},{n:"Blue",v:255},{n:"Strobe",v:0},{n:"Gobo",v:0}]},
];
function ModuleDMX() {
  const [fixtures,setFixtures]=useState(()=>DMX_FIXTURES.map(f=>({...f,chans:f.chans.map(c=>({...c}))})));
  const [sel,setSel]=useState("par");
  const gridRef=useRef();
  const f=fixtures.find(x=>x.id===sel)||fixtures[0];
  // build the 512 universe from fixtures
  const universe=(()=>{ const u=new Array(512).fill(0); fixtures.forEach(fx=>fx.chans.forEach((c,i)=>{ if(fx.addr+i-1<512) u[fx.addr+i-1]=c.v; })); return u; })();
  useEffect(()=>{
    const c=gridRef.current; if(!c)return;
    const cols=32, rows=16, cell=Math.floor((Math.min(c.parentElement?.clientWidth-24||512,512))/cols);
    const W=cols*cell, H=rows*cell; c.width=W;c.height=H; const ctx=c.getContext("2d"); ctx.clearRect(0,0,W,H);
    // map which channels belong to which fixture
    const owner=new Array(512).fill(-1); fixtures.forEach((fx,fi)=>fx.chans.forEach((_,i)=>{ if(fx.addr+i-1<512) owner[fx.addr+i-1]=fi; }));
    const fcol=["#f59e0b","#34d399","#60a5fa"];
    for(let idx=0;idx<512;idx++){ const x=(idx%cols)*cell, y=Math.floor(idx/cols)*cell, v=universe[idx];
      ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fillRect(x+1,y+1,cell-2,cell-2);
      const o=owner[idx]; if(o>=0){ ctx.strokeStyle=fcol[o%3]; ctx.lineWidth=1.5; ctx.strokeRect(x+1.5,y+1.5,cell-3,cell-3); }
    }
    ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.strokeRect(0.5,0.5,W-1,H-1);
  },[fixtures,universe]);
  const setChan=(ci,v)=>setFixtures(fs=>fs.map(fx=>fx.id===sel?{...fx,chans:fx.chans.map((c,i)=>i===ci?{...c,v}:c)}:fx));
  const setAddr=(v)=>setFixtures(fs=>fs.map(fx=>fx.id===sel?{...fx,addr:Math.max(1,Math.min(512-fx.chans.length+1,v))}:fx));
  // fixture visual output (colour + intensity)
  const rgbOf=fx=>{ const get=n=>{const c=fx.chans.find(c=>c.n===n);return c?c.v:null;};
    const dim=(get("Dimmer")??get("Intensity")??255)/255; let r=get("Red"),g=get("Green"),b=get("Blue");
    if(r==null){r=g=b=255;} return [Math.round(r*dim),Math.round(g*dim),Math.round(b*dim)]; };
  return (
    <div>
      <InfoBox>
        <strong>DMX512</strong> is how one controller talks to many lights. A <strong>universe</strong> is <strong>512 channels</strong>, each a value <strong>0–255</strong>. A fixture is <em>patched</em> to a <strong>start address</strong> and then occupies a run of channels according to its <strong>personality</strong> (its channel map): a simple dimmer uses 1 channel, an RGB PAR 3–4, a moving head 8–32 (pan, tilt, colour, gobo, strobe…). Set a fixture to address 11 and its channels land on 11, 12, 13… — so you must leave room and never overlap two fixtures (unless you <em>want</em> them to move together). Physically it's a daisy-chain over XLR (RS-485); terminate the last fixture. When 512 channels aren't enough you add universes and send them over the network with <strong>Art-Net</strong> or <strong>sACN</strong> — the same DMX values, now riding on Ethernet to nodes that break out to the lamps. Change a channel below and watch it light up in the 512-channel grid.
      </InfoBox>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {fixtures.map((fx,i)=>(
          <button key={fx.id} onClick={()=>setSel(fx.id)} style={sel===fx.id?styles.btnActive:styles.btnChip}>
            <span style={{color:["#f59e0b","#34d399","#60a5fa"][i%3]}}>●</span> {fx.name} @{fx.addr}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{flex:"1 1 300px",minWidth:280,background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:"#f3f4f6",fontWeight:"bold"}}>{f.name}</span>
            <label style={{color:"#9ca3af",fontSize:12}}>start addr <input type="number" min={1} max={512} value={f.addr} onChange={e=>setAddr(+e.target.value)} style={{width:56,background:"#111",border:"1px solid #374151",color:"#f59e0b",borderRadius:4,padding:"2px 6px",fontFamily:"monospace"}}/></label>
          </div>
          <div style={{color:"#6b7280",fontSize:11,fontFamily:"monospace",marginBottom:10}}>occupies ch {f.addr}–{f.addr+f.chans.length-1}</div>
          {f.chans.map((c,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#9ca3af"}}><span style={{color:"#6b7280",fontFamily:"monospace"}}>ch {f.addr+i}</span> · {c.n}</span>
                <strong style={{color:"#f59e0b",fontFamily:"monospace"}}>{c.v}</strong>
              </div>
              <input type="range" min={0} max={255} step={1} value={c.v} onChange={e=>setChan(i,+e.target.value)} style={{...styles.slider,width:"100%"}}/>
            </div>
          ))}
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:12}}>
            <span style={{color:"#6b7280",fontSize:11,fontFamily:"monospace"}}>output</span>
            <span style={{width:44,height:44,borderRadius:"50%",background:`rgb(${rgbOf(f).join(",")})`,boxShadow:`0 0 18px rgb(${rgbOf(f).join(",")})`,display:"inline-block",border:"1px solid #333"}}/>
          </div>
        </div>
        <div style={{flex:"1 1 300px",minWidth:280,background:"#111",borderRadius:8,padding:14}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:8,letterSpacing:"0.08em"}}>UNIVERSE 1 — 512 CHANNELS (patched fixtures outlined)</div>
          <canvas ref={gridRef} style={{display:"block",width:"100%"}}/>
          <div style={{marginTop:10,color:"#6b7280",fontSize:11,lineHeight:1.6}}>Each square is one channel (0–255 → black→white). Coloured outlines are the three patched fixtures. Add universes + <strong style={{color:"#2dd4bf"}}>Art-Net / sACN</strong> when 512 isn't enough.</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Module registry map
// ─────────────────────────────────────────────
const MODULE_COMPONENTS = {
  aspectRatio: ModuleAspectRatio,
  exposureTriangle: ModuleExposureTriangle,
  falseColor: ModuleFalseColor,
  lut: ModuleLUT,
  codecs: ModuleCodecs,
  containers: ModuleContainers,
  signals: ModuleSignals,
  portraitLight: ModulePortraitLight,
  dmx: ModuleDMX,
  lensDistortion: ModuleLensDistortion,
  interlacing: ModuleInterlacing,
  halation: ModuleHalation,
  flicker: ModuleFlicker,
  focusBreathing: ModuleFocusBreathing,
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
  optics:"#34d399", narrative:"#a78bfa", scopes:"#22d3ee", signals:"#2dd4bf", lighting:"#facc15",
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
