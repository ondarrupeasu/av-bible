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
      histogram: { title: "Histogram & Waveform", desc: "Reading exposure and luminance distribution" },
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
    modules: ["shotTypes","cameraMovement","timecode","histogram"],
  },
];

// ─────────────────────────────────────────────
// Default image (640×360 gradient placeholder)
// ─────────────────────────────────────────────
const DEFAULT_IMAGE_URL = null; // will use canvas-generated

function generateDefaultImageDataURL() {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 360;
  const ctx = c.getContext("2d");
  // Sky gradient
  const sky = ctx.createLinearGradient(0,0,0,220);
  sky.addColorStop(0,"#1a1a2e"); sky.addColorStop(1,"#4a90d9");
  ctx.fillStyle = sky; ctx.fillRect(0,0,640,220);
  // Ground
  const gnd = ctx.createLinearGradient(0,220,0,360);
  gnd.addColorStop(0,"#2d5a1b"); gnd.addColorStop(1,"#1a3a0a");
  ctx.fillStyle = gnd; ctx.fillRect(0,220,640,140);
  // Sun
  const sun = ctx.createRadialGradient(500,80,5,500,80,60);
  sun.addColorStop(0,"#fff7aa"); sun.addColorStop(0.3,"#ffcc44"); sun.addColorStop(1,"rgba(255,200,0,0)");
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(500,80,60,0,Math.PI*2); ctx.fill();
  // Mountain silhouettes
  ctx.fillStyle="#1a2f44";
  [[0,220],[120,140],[240,180],[380,120],[520,160],[640,190],[640,220]].forEach(([x,y],i,a)=>{
    if(i===0){ctx.beginPath();ctx.moveTo(x,y);}else ctx.lineTo(x,y);
  });
  ctx.closePath(); ctx.fill();
  // House
  ctx.fillStyle="#3d2b1f";
  ctx.fillRect(60,250,80,70);
  ctx.fillStyle="#5a3e2b";
  ctx.beginPath();ctx.moveTo(50,250);ctx.lineTo(100,210);ctx.lineTo(150,250);ctx.closePath();ctx.fill();
  // Window
  ctx.fillStyle="#ffdd88";
  ctx.fillRect(75,265,25,25); ctx.fillRect(115,265,25,25);
  // Tree
  ctx.fillStyle="#2d5a1b";
  ctx.beginPath();ctx.arc(250,240,30,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(240,255,25,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#4a2d0a";
  ctx.fillRect(245,265,10,55);
  // Person silhouette
  ctx.fillStyle="#111";
  ctx.beginPath();ctx.arc(400,270,8,0,Math.PI*2);ctx.fill();
  ctx.fillRect(396,278,8,30);
  ctx.fillRect(390,285,28,4);
  ctx.fillRect(394,308,6,20); ctx.fillRect(402,308,6,20);
  // Road
  ctx.fillStyle="#444";
  ctx.beginPath();ctx.moveTo(300,360);ctx.lineTo(380,280);ctx.lineTo(420,280);ctx.lineTo(640,360);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#fff"; ctx.setLineDash([20,15]); ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(355,340);ctx.lineTo(390,290);ctx.stroke();
  ctx.setLineDash([]);
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
      const maxW = Math.min(c.parentElement.clientWidth - 32, 700);
      const maxH = 360;
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      const maxW=Math.min(c.parentElement?.clientWidth-32||640,640);
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      const maxW=Math.min(c.parentElement?.clientWidth-32||500,500);
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
  const W=320, H=320;

  const toggle=name=>setActive(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name]);

  // CIE 1931 horseshoe approximation points
  const HORSESHOE = [
    [0.1741,0.0050],[0.1740,0.0050],[0.1738,0.0049],[0.1736,0.0044],[0.1730,0.0036],
    [0.1714,0.0022],[0.1689,0.0008],[0.1664,0.0000],[0.1612,0.0000],[0.1490,0.0041],
    [0.1241,0.0217],[0.1096,0.0395],[0.0949,0.0600],[0.0784,0.0600],[0.0421,0.0521],
    [0.0318,0.0754],[0.0270,0.0965],[0.0295,0.1264],[0.0452,0.1718],[0.0642,0.2245],
    [0.0784,0.2764],[0.0913,0.3322],[0.1069,0.3957],[0.1282,0.4700],[0.1497,0.5441],
    [0.1761,0.6229],[0.2123,0.7100],[0.2558,0.7745],[0.3101,0.8160],[0.3728,0.8379],
    [0.4245,0.8270],[0.4860,0.7857],[0.5298,0.7318],[0.5623,0.6654],[0.5974,0.5765],
    [0.6280,0.4926],[0.6490,0.4117],[0.6680,0.3300],[0.6788,0.2702],[0.6900,0.2100],
    [0.7010,0.1480],[0.7190,0.0806],[0.7346,0.0265],[0.7347,0.0265],
  ];

  const mapXY=(x,y)=>([Math.round(x*W*0.85+W*0.07), Math.round(H-(y*H*0.90+H*0.06))]);

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=W; c.height=H;
    const ctx=c.getContext("2d");
    ctx.clearRect(0,0,W,H);
    // Draw CIE horseshoe
    ctx.beginPath();
    HORSESHOE.forEach(([x,y],i)=>{
      const [px,py]=mapXY(x,y);
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    });
    // close with straight line (line of purples)
    const [x0,y0]=mapXY(0.1741,0.0050);
    const [xl,yl]=mapXY(0.7347,0.0265);
    ctx.lineTo(xl,yl); ctx.closePath();
    ctx.strokeStyle="#374151"; ctx.lineWidth=1.5; ctx.stroke();
    // Spectral color fill approximation
    const grad=ctx.createLinearGradient(W*0.1,H*0.9,W*0.75,H*0.1);
    grad.addColorStop(0,"rgba(100,0,200,0.12)");
    grad.addColorStop(0.15,"rgba(0,0,255,0.12)");
    grad.addColorStop(0.3,"rgba(0,200,200,0.12)");
    grad.addColorStop(0.5,"rgba(0,200,0,0.12)");
    grad.addColorStop(0.7,"rgba(200,200,0,0.12)");
    grad.addColorStop(1,"rgba(255,0,0,0.12)");
    ctx.fillStyle=grad; ctx.fill();
    // White point D65
    const [wpx,wpy]=mapXY(0.3127,0.3290);
    ctx.fillStyle="#fff"; ctx.beginPath();ctx.arc(wpx,wpy,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#9ca3af"; ctx.font="10px monospace";ctx.fillText("D65",wpx+6,wpy+4);
    // Gamut triangles
    Object.entries(GAMUTS).forEach(([name,{color,points}])=>{
      if(!active.includes(name)) return;
      ctx.strokeStyle=color; ctx.lineWidth=2;
      ctx.fillStyle=color+"33";
      ctx.beginPath();
      points.forEach(([x,y],i)=>{
        const [px,py]=mapXY(x,y);
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // label at centroid
      const cx=points.reduce((s,[x])=>s+x,0)/3;
      const cy=points.reduce((s,[,y])=>s+y,0)/3;
      const [lx,ly]=mapXY(cx,cy);
      ctx.fillStyle=color; ctx.font="bold 9px monospace";
      ctx.fillText(name.split(" ")[0],lx-15,ly);
    });
    // axes
    ctx.fillStyle="#4b5563"; ctx.font="10px monospace";
    ctx.fillText("x",W-14,H-4); ctx.fillText("y",4,14);
    for(let v=0;v<=0.8;v+=0.2){
      const [px]=mapXY(v,0); const [,py]=mapXY(0,v);
      ctx.fillStyle="#374151";ctx.fillText(v.toFixed(1),px-8,H-2);
      ctx.fillText(v.toFixed(1),2,py+4);
    }
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
  const canvasRef = useRef();
  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=480; c.height=200;
    const ctx=c.getContext("2d");
    const steps=Math.pow(2,bits);
    for(let x=0;x<480;x++){
      const t=x/480;
      const quantized=Math.round(t*(steps-1))/(steps-1);
      const v=Math.round(quantized*255);
      ctx.fillStyle=`rgb(${v},${v},${v})`;
      ctx.fillRect(x,0,1,160);
    }
    // Show banding lines
    if(bits<=8){
      ctx.strokeStyle="rgba(245,158,11,0.6)"; ctx.lineWidth=1;
      for(let s=0;s<steps;s++){
        const x=Math.round(s/steps*480);
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,160);ctx.stroke();
      }
    }
    ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,160,480,40);
    ctx.fillStyle="#9ca3af"; ctx.font="12px monospace";
    ctx.fillText(`Bit depth: ${bits}-bit  |  ${steps} tonal steps  |  ${bits<=8?"Banding visible":"Smooth gradient"}`,10,182);
  },[bits]);
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
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      c.width=Math.min(c.parentElement?.clientWidth-32||480,480);
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MODULE: Shot Types
// ─────────────────────────────────────────────
const SHOTS = [
  { label:"ECU", name:"Extreme Close-Up", crop:[0.30,0.00,0.40,0.25], note:"Extreme detail: eye, mouth, hand. Maximum emotional intensity. Ingmar Bergman, Sergio Leone." },
  { label:"BCU", name:"Big Close-Up", crop:[0.20,0.00,0.60,0.35], note:"Face fills frame, chin may be cut. Used in drama for emotional revelation." },
  { label:"CU", name:"Close-Up", crop:[0.15,0.00,0.70,0.50], note:"Head and shoulders. Standard interview framing. Establishes emotional connection." },
  { label:"MCU", name:"Medium Close-Up", crop:[0.10,0.00,0.80,0.60], note:"Chest up. American TV standard. Conversational intimacy without losing context." },
  { label:"MS", name:"Medium Shot", crop:[0.05,0.10,0.90,0.85], note:"Waist up. Allows gesture and body language. Most common in dialogue scenes." },
  { label:"MLS", name:"Medium Long Shot", crop:[0.02,0.15,0.96,0.95], note:"Knees up. Character + immediate environment. Natural, everyday framing." },
  { label:"LS", name:"Long Shot", crop:[0.00,0.10,1.00,1.00], note:"Full body with context. Shows character in space. Establishes spatial relationships." },
  { label:"VLS", name:"Very Long Shot", crop:[0.00,0.00,1.00,1.00], note:"Character recognisable but environment dominant. Scale and isolation." },
  { label:"EWS", name:"Extreme Wide Shot", crop:[0.00,0.00,1.00,1.00], note:"Establishing shot. Tiny figures in vast landscape. Pure environment statement." },
  { label:"2S", name:"Two Shot", crop:[0.00,0.05,1.00,0.95], note:"Two characters in frame. Dialogue and relationship dynamics." },
  { label:"OTS", name:"Over-the-Shoulder", crop:[0.00,0.00,1.00,1.00], note:"Foreground shoulder anchors perspective. Standard for dialogue coverage." },
  { label:"POV", name:"Point of View", crop:[0.00,0.00,1.00,1.00], note:"Camera as character's eyes. Subjective perspective. Hitchcock's tool." },
];

function ModuleShotTypes({ image }) {
  const [sel, setSel] = useState(2);
  const canvasRef = useRef();
  const S = SHOTS[sel];

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c)return;
      const maxW=Math.min(c.parentElement?.clientWidth-32||500,500);
      c.width=maxW; c.height=Math.round(maxW*9/16);
      const ctx=c.getContext("2d");
      // Draw full image dimmed
      ctx.globalAlpha=0.25;
      ctx.drawImage(img,0,0,c.width,c.height);
      ctx.globalAlpha=1;
      // Draw cropped area
      const [x1,y1,x2,y2]=S.crop;
      const cropX=x1*img.width, cropY=y1*img.height;
      const cropW=(x2-x1)*img.width, cropH=(y2-y1)*img.height;
      const destX=x1*c.width, destY=y1*c.height;
      const destW=(x2-x1)*c.width, destH=(y2-y1)*c.height;
      ctx.drawImage(img,cropX,cropY,cropW,cropH,destX,destY,destW,destH);
      // Crop indicator
      ctx.strokeStyle="#f59e0b"; ctx.lineWidth=2;
      ctx.strokeRect(destX,destY,destW,destH);
      // Label
      ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,c.width,28);
      ctx.fillStyle="#f59e0b"; ctx.font="bold 13px monospace";
      ctx.fillText(`${S.label} — ${S.name}`,10,18);
    };
    img.src=image;
  },[sel,image]);

  return (
    <div>
      <InfoBox>
        Shot types define the <strong>field of view</strong> and the <strong>psychological distance</strong> between the camera and the subject. They are the basic vocabulary of visual language — not mere technical decisions but <em>narrative choices</em>. The International vocabulary of cinematography (ISO 2834) codifies several of these. In multicamera production, the director assigns shot types to each camera in the rundown to ensure coverage variety and editorial rhythm.
      </InfoBox>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {SHOTS.map((s,i)=>(
          <button key={s.label} onClick={()=>setSel(i)} style={i===sel?styles.btnActive:styles.btnChip}>{s.label}</button>
        ))}
      </div>
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
        <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      c.width=Math.min(c.parentElement?.clientWidth-32||480,480);
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      c.width=Math.min(c.parentElement?.clientWidth-32||480,480);
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
  const stateRef = useRef({frame:0,lastTime:0});

  useEffect(()=>{
    const c=canvasRef.current; if(!c)return;
    c.width=480; c.height=200;
    const ctx=c.getContext("2d");
    const interval=1000/fps;
    let lastDraw=0;
    const draw=(now)=>{
      if(playing && now-lastDraw>=interval){
        stateRef.current.frame++;
        lastDraw=now;
        ctx.fillStyle="#0a0a0f"; ctx.fillRect(0,0,480,200);
        // Pendulum
        const f=stateRef.current.frame;
        const angle=Math.sin(f*0.08)*0.8;
        const cx=240, cy=30, length=120;
        const px=cx+Math.sin(angle)*length, py=cy+Math.cos(angle)*length;
        // Motion blur simulation
        if(fps<30){
          const blurSteps=Math.max(1,Math.round(30/fps));
          for(let b=blurSteps;b>=0;b--){
            const ba=Math.sin((f-b)*0.08)*0.8;
            const bx=cx+Math.sin(ba)*length, by=cy+Math.cos(ba)*length;
            ctx.globalAlpha=(1-b/blurSteps)*0.4;
            ctx.fillStyle="#f59e0b";
            ctx.beginPath();ctx.arc(bx,by,16,0,Math.PI*2);ctx.fill();
          }
          ctx.globalAlpha=1;
        }
        ctx.strokeStyle="#4b5563"; ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(px,py);ctx.stroke();
        ctx.fillStyle="#f59e0b"; ctx.beginPath();ctx.arc(px,py,16,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#1f2937"; ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
        // Floor
        ctx.strokeStyle="#1f2937"; ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(0,180);ctx.lineTo(480,180);ctx.stroke();
        // Frame counter
        ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,480,26);
        ctx.fillStyle="#f59e0b"; ctx.font="bold 13px monospace";
        ctx.fillText(`${fps} fps  |  Frame ${f}  |  Interval: ${(1000/fps).toFixed(1)}ms  |  Motion blur: ${fps<25?"high":fps<50?"medium":"low"}`,10,17);
      }
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
      c.width=Math.min(c.parentElement?.clientWidth-32||480,480);
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
    c.width=480; c.height=240;
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
      <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block",maxWidth:"100%"}}>
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
// MODULE: Histogram
// ─────────────────────────────────────────────
function ModuleHistogram({ image }) {
  const [showWaveform, setShowWaveform] = useState(false);
  const canvasRef = useRef();
  const histRef = useRef();
  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; const h=histRef.current;
      if(!c||!h)return;
      c.width=Math.min(c.parentElement?.clientWidth-32||480,480);
      c.height=Math.round(c.width*9/16);
      const ctx=c.getContext("2d");
      ctx.drawImage(img,0,0,c.width,c.height);
      const idata=ctx.getImageData(0,0,c.width,c.height);
      const d=idata.data;
      // Build histogram
      const r_hist=new Array(256).fill(0);
      const g_hist=new Array(256).fill(0);
      const b_hist=new Array(256).fill(0);
      const luma_hist=new Array(256).fill(0);
      for(let i=0;i<d.length;i+=4){
        r_hist[d[i]]++;
        g_hist[d[i+1]]++;
        b_hist[d[i+2]]++;
        const luma=Math.round(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]);
        luma_hist[luma]++;
      }
      // Draw histogram
      h.width=256; h.height=120;
      const hctx=h.getContext("2d");
      hctx.fillStyle="#0d1117"; hctx.fillRect(0,0,256,120);
      const maxVal=Math.max(...luma_hist,...r_hist,...g_hist,...b_hist);
      const drawHist=(hist,color)=>{
        hctx.strokeStyle=color; hctx.lineWidth=1;
        hctx.beginPath();
        hist.forEach((v,i)=>{
          const y=120-(v/maxVal)*110;
          i===0?hctx.moveTo(i,y):hctx.lineTo(i,y);
        });
        hctx.stroke();
      };
      drawHist(luma_hist,"rgba(255,255,255,0.5)");
      drawHist(r_hist,"rgba(239,68,68,0.7)");
      drawHist(g_hist,"rgba(34,197,94,0.7)");
      drawHist(b_hist,"rgba(59,130,246,0.7)");
      // Zones
      hctx.strokeStyle="#1f2937"; hctx.lineWidth=1; hctx.setLineDash([2,2]);
      [0,128,255].forEach(x=>{
        hctx.beginPath();hctx.moveTo(x,0);hctx.lineTo(x,120);hctx.stroke();
      });
      hctx.setLineDash([]);
      hctx.fillStyle="#374151"; hctx.font="8px monospace";
      hctx.fillText("Blacks",2,10); hctx.fillText("Mids",110,10); hctx.fillText("Whites",200,10);
      // Draw exposure indicator
      if(!showWaveform){
        ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,c.width,22);
        ctx.fillStyle="#9ca3af"; ctx.font="11px monospace";
        ctx.fillText("Image preview — see histogram below",8,14);
      } else {
        // Waveform
        ctx.globalAlpha=0.6;
        const wvH=c.height*0.4;
        ctx.fillStyle="#000"; ctx.fillRect(0,c.height-wvH,c.width,wvH);
        ctx.globalAlpha=1;
        for(let x=0;x<c.width;x++){
          for(let y=0;y<c.height;y++){
            const pi=(y*c.width+x)*4;
            const lum=(0.2126*d[pi]+0.7152*d[pi+1]+0.0722*d[pi+2])/255;
            const wy=c.height-(wvH*lum+10);
            ctx.fillStyle="rgba(245,158,11,0.15)";
            ctx.fillRect(x,wy,1,1);
          }
        }
      }
    };
    img.src=image;
  },[image,showWaveform]);
  return (
    <div>
      <InfoBox>
        The <strong>histogram</strong> shows the frequency distribution of tonal values across the 0–255 range for each colour channel. A well-exposed image typically shows values spread across the range without clipping at either extreme. The <strong>waveform monitor</strong> (toggle below) maps tonal values vertically against horizontal image position — the professional tool for checking <strong>exposure linearity and clipping across the frame</strong> in broadcast (EBU R 103). The vectorscope (not shown) shows the chrominance distribution in a polar diagram. These tools are more reliable than the camera's LCD for exposure decisions on set.
      </InfoBox>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setShowWaveform(w=>!w)} style={{...styles.btnSecondary,...(showWaveform?{borderColor:"#f59e0b",color:"#f59e0b"}:{})}}>
          Waveform: {showWaveform?"ON":"OFF"}
        </button>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
        <div style={{background:"#111",borderRadius:8,padding:16,display:"inline-block"}}>
          <canvas ref={canvasRef} style={{display:"block",maxWidth:"100%"}}/>
        </div>
        <div style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:8}}>
          <div style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:4}}>HISTOGRAM</div>
          <canvas ref={histRef} style={{display:"block"}}/>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            {[["R","#ef4444"],["G","#22c55e"],["B","#3b82f6"],["Luma","#fff"]].map(([n,c])=>(
              <span key={n} style={{fontSize:10,color:c,fontFamily:"monospace"}}>■ {n}</span>
            ))}
          </div>
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
  histogram: ModuleHistogram,
};

const CATEGORY_COLORS = {
  image:"#60a5fa", color:"#f59e0b", defects:"#f87171",
  optics:"#34d399", narrative:"#a78bfa",
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
        <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px"}}>
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
        <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
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
