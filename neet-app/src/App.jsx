import { useState, useEffect } from "react";

const SHEET_URL = "https://script.google.com/macros/s/AKfycbyWYqV3Y9eEy90aW69tgrWtLEml3fCqGAPefvpboUBNIgcuAuGt3wU-pwyKhLS111yNVw/exec";
async function logSheet(name, email, phone, action) {
  if (!SHEET_URL || SHEET_URL === "YOUR_APPS_SCRIPT_URL") return;
  try {
    const device = /Mobile|iPhone|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
    const ts = new Date().toLocaleString("en-IN");
    // Hidden iframe form POST — works cross-origin without CORS restrictions
    const iframe = document.createElement("iframe");
    iframe.name = "hidden_iframe_" + Date.now();
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = SHEET_URL;
    form.target = iframe.name;
    form.style.display = "none";

    const fields = { name, email, phone, action, device, ts };
    Object.entries(fields).forEach(([key, val]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = val;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      document.body.removeChild(form);
      document.body.removeChild(iframe);
    }, 5000);
  } catch(_) {}
}

const DB="n26s", SE="n26ss";
const rDB=()=>{try{return JSON.parse(localStorage.getItem(DB)||"{}");}catch{return{};}};
const wDB=d=>{try{localStorage.setItem(DB,JSON.stringify(d));}catch{}};
const rSes=()=>{try{return JSON.parse(localStorage.getItem(SE)||"null");}catch{return null;}};
const wSes=u=>{try{localStorage.setItem(SE,JSON.stringify(u));}catch{}};
const cSes=()=>{try{localStorage.removeItem(SE);}catch{}};

function dbReg(n,e,p){
  if(!n.trim())return{ok:false,msg:"Full name required."};
  if(!e.includes("@"))return{ok:false,msg:"Valid email required."};
  if(p.replace(/\D/g,"").length<10)return{ok:false,msg:"Valid 10-digit phone required."};
  const db=rDB(),users=db.users||[];
  if(users.find(u=>u.email===e.trim().toLowerCase()))return{ok:false,msg:"Email already registered. Sign in."};
  const user={id:`U${Date.now()}`,name:n.trim(),email:e.trim().toLowerCase(),phone:p.trim(),joinedAt:new Date().toISOString(),progress:{}};
  db.users=[...users,user];wDB(db);wSes(user);return{ok:true,user};
}
function dbLogin(e,p){
  if(!e.includes("@"))return{ok:false,msg:"Valid email required."};
  if(!p.trim())return{ok:false,msg:"Phone required."};
  const db=rDB();
  const user=(db.users||[]).find(u=>u.email===e.trim().toLowerCase()&&u.phone===p.trim());
  if(!user)return{ok:false,msg:"No account found. Check credentials or register."};
  wDB(db);wSes(user);return{ok:true,user};
}
function dbSaveProg(uid,key,val){const db=rDB(),u=(db.users||[]).find(u=>u.id===uid);if(!u)return;u.progress={...u.progress,[key]:val};wDB(db);wSes(u);}
const dbUsers=()=>(rDB().users||[]);

const T={bg:"#f2f2f7",card:"#fff",border:"rgba(60,60,67,0.12)",text:"#1c1c1e",sub:"#8a8a8e",faint:"#f2f2f7",inset:"#e5e5ea",bio:"#30d158",che:"#0a84ff",phy:"#ff9f0a",red:"#ff453a",purple:"#bf5af2",F:"-apple-system,sans-serif"};

const TOPICS=[
  {id:"b1",sub:"Biology",name:"Molecular Basis of Inheritance",pyq:87,repeat:98,color:T.bio,
   concepts:["DNA: Chargaff's rules (A=T, G≡C), antiparallel strands","Replication: Helicase→Primase→DNA Pol III→Pol I→Ligase→Gyrase","Okazaki fragments on lagging strand only","Transcription→hnRNA→5'cap+poly-A+spliceosome removes introns","Translation: AUG start; UAA/UAG/UGA stop; A→P→E sites","Genetic code: Triplet, Universal, Non-overlapping, Degenerate","lac operon: allolactose (inducer) removes repressor; CAP-cAMP = positive regulation"],
   tip:"Draw replication fork labelling every enzyme — assertion-reason 3× in 10 years.",hack:"'TUN-CDU' = Triplet, Universal, Non-overlapping, Comma-less, Degenerate, Unambiguous."},
  {id:"b2",sub:"Biology",name:"Genetics & Inheritance",pyq:84,repeat:92,color:T.bio,
   concepts:["ABO: IᴬIᴮ codominant; ii=Group O","Incomplete dominance: Mirabilis jalapa F2=1:2:1","Colour blindness & haemophilia A=X-linked recessive","Down=trisomy 21; Klinefelter=47,XXY; Turner=45,XO","Sickle cell: Glu→Val at position 6 of β-globin","Crossing over at PACHYTENE — NOT Zygotene (#1 NEET trap)"],
   tip:"Crossing over at PACHYTENE — appears every 2 years as assertion-reason.",hack:"'Turner=Too few (45,XO). Klinefelter=eXtra X (47,XXY)'."},
  {id:"b3",sub:"Biology",name:"Biotechnology",pyq:81,repeat:90,color:T.bio,
   concepts:["EcoRI cuts 5'-G↓AATTC-3' → 5' sticky ends","pBR322: ampR+tetR; insertional inactivation identifies recombinants","PCR: 94°C denature→55°C anneal→72°C extend (Taq polymerase)","Southern=DNA, Northern=RNA, Western=protein","Bt toxin: cry1Ac/cry2Ab from Bacillus thuringiensis","Ti plasmid of Agrobacterium=plant transformation vector"],
   tip:"'DNA is South, RNA is North, Protein goes West' — never wrong in 10 years.",hack:"EcoRI palindrome: GAATTC reads same 5'→3' on both strands."},
  {id:"b4",sub:"Biology",name:"Human Physiology",pyq:80,repeat:90,color:T.bio,
   concepts:["SA node→AV node→Bundle of His→Purkinje fibres","ECG: P=atrial depol, QRS=ventricular depol, T=repol","GFR=125 mL/min (180 L/day filtered, 1.5 L excreted)","ADH: collecting duct→↑water reabsorption (from hypothalamus)","Renin→Angiotensin II→Aldosterone→↑Na⁺ reabsorption","Vital capacity=TV(500)+IRV(2500)+ERV(1000)=4000 mL"],
   tip:"GFR=125 mL/min and ECG wave sequence appear almost every year.",hack:"'P=Pump, QRS=Quivers, T=Then rests'."},
  {id:"b5",sub:"Biology",name:"Reproduction & Development",pyq:80,repeat:90,color:T.bio,
   concepts:["Primary oocyte: arrested at Prophase I (at birth)","Secondary oocyte: arrested at Metaphase II (at ovulation)","hCG from syncytiotrophoblast maintains corpus luteum","Day 14 LH surge=ovulation; corpus luteum Days 15–28","Acrosome from Golgi apparatus (hydrolytic enzymes)","IVF: ET at 8-cell. ZIFT: zygote. GIFT: gametes (needs patent tubes)"],
   tip:"2° oocyte at Metaphase II at ovulation — not primary oocyte at Prophase I.",hack:"'Primary Pauses Prophase, Secondary Stalls Metaphase'."},
  {id:"b6",sub:"Biology",name:"Ecology & Biodiversity",pyq:69,repeat:85,color:T.bio,
   concepts:["NPP=GPP−respiration by producers","10% law (Lindeman): only 10% energy to next trophic level","Pyramid of ENERGY always upright — NEVER inverted","Biomass pyramid CAN be inverted in aquatic ecosystems","Phosphorus cycle has NO gaseous phase","India's 4 hotspots: Himalaya, Indo-Burma, W.Ghats+Sri Lanka, Sundaland"],
   tip:"Pyramid of energy always upright — guaranteed mark every year.",hack:"'Phosphorus=No gas. Carbon=CO₂. Nitrogen=N₂.'"},
  {id:"b7",sub:"Biology",name:"Health, Disease & Animal Kingdom",pyq:74,repeat:87,color:T.bio,
   concepts:["Primary immune: IgM first. Secondary: IgG (rapid, stronger)","IgE binds mast cells→histamine→allergy","HIV attacks CD4+ T-helper cells; ELISA diagnosis; AZT treatment","Arthropoda: Malpighian tubules; open circulation; largest phylum","Echinodermata: water vascular system; radial symmetry in adult","Peripatus: connecting link Annelida↔Arthropoda"],
   tip:"IgE=allergy; IgM=primary; IgG=secondary — assertion-reason every 2 years.",hack:"'APC=Absent (flatworms), Pseudo (roundworms), Coelomate (all others)'."},
  {id:"c1",sub:"Chemistry",name:"Coordination Compounds",pyq:68,repeat:92,color:T.che,
   concepts:["Spectrochemical (strong→weak): CO>CN⁻>en>NH₃>H₂O>F⁻>Cl⁻>Br⁻>I⁻","Cr=[Ar]3d⁵4s¹; Cu=[Ar]3d¹⁰4s¹ (anomalous configs)","μ=√(n(n+2)) BM; n=unpaired electrons","Lanthanoid contraction: poor shielding by 4f electrons","SCN⁻=ambidentate ligand→linkage isomerism","cis-platin [Pt(NH₃)₂Cl₂]—cancer chemotherapy"],
   tip:"Spectrochemical series: strong field=low spin=fewer unpaired electrons.",hack:"'Can Naughty Nephews Ever Now Have Hot Feelings Clearly Brought Inward?'"},
  {id:"c2",sub:"Chemistry",name:"Equilibrium & Electrochemistry",pyq:69,repeat:90,color:T.che,
   concepts:["Kp=Kc(RT)^Δn — count GASEOUS moles only for Δn","Catalyst NEVER shifts equilibrium — classic assertion-reason trap!","Nernst: E=E°−(0.0591/n)×log Q at 25°C","ΔG°=−nFE°=−RT lnK","Faraday's 1st: m=ZIt; Z=M/nF","Molar conductance increases with dilution"],
   tip:"Catalyst NEVER shifts equilibrium — 5× in 10 years as assertion-reason.",hack:"'When Δn=0, Kp=Kc'. Only gaseous moles count."},
  {id:"c3",sub:"Chemistry",name:"Organic — Named Reactions",pyq:67,repeat:90,color:T.che,
   concepts:["Tollens (silver mirror): ALL aldehydes","Fehling (brick-red): ALIPHATIC aldehydes ONLY — NOT benzaldehyde","Iodoform test: CH₃CO− group (methyl ketones, ethanal, ethanol)","Cannizzaro: no α-H aldehydes + conc. NaOH→disproportionation","Carbylamine: ONLY primary amines+CHCl₃+KOH→isocyanide","Gabriel synthesis→ONLY primary amines"],
   tip:"Fehling with benzaldehyde=NEGATIVE. Tested every 2 years.",hack:"'Tollens=All, Fehling=Fat(aliphatic) only, Iodoform=CH₃CO-'."},
  {id:"c4",sub:"Chemistry",name:"Solutions & Kinetics",pyq:65,repeat:90,color:T.che,
   concepts:["Van't Hoff: NaCl i=2, BaCl₂ i=3, Al₂(SO₄)₃ i=5, glucose i=1","First-order t½=0.693/k — INDEPENDENT of concentration","t₇₅%=2×t½; t₈₇.₅%=3×t½","Arrhenius: ln k vs 1/T → slope=−Ea/R","Henry's law: solubility of gas∝partial pressure"],
   tip:"First-order t½ independent of concentration — 7× in 10 years!",hack:"'BOFF'=Boiling elevation, Osmotic pressure, Freezing depression, vapour pressure Fall."},
  {id:"p1",sub:"Physics",name:"Electrostatics",pyq:83,repeat:95,color:T.phy,
   concepts:["Gauss: Φ=Q_enclosed/ε₀; E inside conductor=0","Conductor surface: E=σ/ε₀; Single infinite sheet: E=σ/2ε₀ (TRAP!)","Capacitor energy: U=Q²/2C=CV²/2=QV/2","Battery off + dielectric K: C×K, V÷K, E÷K (Q constant)","Battery on + dielectric K: V constant, C×K, Q×K"],
   tip:"σ/ε₀ vs σ/2ε₀ — conductor surface vs single infinite sheet. 1 mark every year.",hack:"Dielectric: 'K boosts C, K kills E and V'."},
  {id:"p2",sub:"Physics",name:"Current Electricity & Magnetism",pyq:79,repeat:92,color:T.phy,
   concepts:["Drift velocity: vd=I/(nAe)","Wheatstone bridge balanced: P/Q=R/S","Potentiometer r=(L₁/L₂−1)×R","Cyclotron period T=2πm/qB — INDEPENDENT of velocity","Centre of circular loop: B=μ₀I/2R"],
   tip:"Cyclotron period independent of velocity — assertion-reason every 2–3 years.",hack:"'P/Q=R/S' — Wheatstone. Memorise once, never forget."},
  {id:"p3",sub:"Physics",name:"Optics & Modern Physics",pyq:73,repeat:90,color:T.phy,
   concepts:["Lens: 1/v−1/u=1/f; Mirror: 1/v+1/u=1/f (DIFFERENT signs!)","Young's double slit: β=λD/d","Brewster's angle: tanθ_B=n (reflected ray fully polarised)","Photoelectric: KE_max=hν−φ=eV₀; stopping potential∝FREQUENCY only","Bohr: Eₙ=−13.6Z²/n² eV; rₙ=0.529n²/Z Å","Mean life=1.44×half-life (mean life ALWAYS longer)"],
   tip:"Stopping potential∝frequency NOT intensity — 7× in 10 years.",hack:"Mean life=1.44×half-life. Carnot: ALWAYS KELVIN."},
  {id:"p4",sub:"Physics",name:"Mechanics & Thermodynamics",pyq:65,repeat:87,color:T.phy,
   concepts:["MI: disk=MR²/2, solid sphere=2MR²/5, hollow sphere=2MR²/3","Perpendicular axis theorem: ONLY for 2D flat bodies","SHM KE=PE when x=A/√2 (NOT x=A/2 — common trap!)","Carnot efficiency: η=1−T₂/T₁ (KELVIN only)","Adiabatic: Q=0; compression→temperature rises","Escape velocity=11.2 km/s for Earth"],
   tip:"SHM KE=PE at A/√2 not A/2 — costs marks every year.",hack:"Carnot: 'Always KELVIN'. Celsius gives wrong answer without exception."},
];

const CAL=[
  {wk:"Wk 1",dates:"Mar 22–28",theme:"Biology Deep Revision",color:T.bio,days:[
    {d:"Sun Mar 22",t:"Molecular Basis of Inheritance — NCERT + 80 MCQs",h:10,mock:false},
    {d:"Mon Mar 23",t:"Genetics — cross types, sex-linked, chromosomal disorders",h:10,mock:false},
    {d:"Tue Mar 24",t:"Biotechnology Ch11+12 — PCR, vectors, NCERT examples",h:10,mock:false},
    {d:"Wed Mar 25",t:"Sexual Reproduction + Cell Cycle — diagrams from memory",h:10,mock:false},
    {d:"Thu Mar 26",t:"Ecosystem + Biodiversity — hotspots, pyramids, nutrient cycles",h:10,mock:false},
    {d:"Fri Mar 27",t:"Human Physiology Part 1: Digestion + Respiration",h:10,mock:false},
    {d:"Sat Mar 28",t:"🎯 MOCK TEST 1 — 180 Qs / 180 Min strict",h:12,mock:true,target:"≥ 560"},
  ]},
  {wk:"Wk 2",dates:"Mar 29–Apr 4",theme:"Biology Complete",color:T.bio,days:[
    {d:"Sun Mar 29",t:"Human Physiology: Circulation + Excretion — ECG, nephron, GFR",h:10,mock:false},
    {d:"Mon Mar 30",t:"Neural + Chemical Coordination — hormone tables",h:10,mock:false},
    {d:"Tue Mar 31",t:"Human Reproduction + Reproductive Health — ART methods",h:10,mock:false},
    {d:"Wed Apr 1", t:"Human Health & Disease + Animal Kingdom",h:10,mock:false},
    {d:"Thu Apr 2", t:"Animal Kingdom full table + Evolution (Hardy-Weinberg)",h:10,mock:false},
    {d:"Fri Apr 3", t:"Photosynthesis Z-scheme from memory + Plant Kingdom",h:10,mock:false},
    {d:"Sat Apr 4", t:"🎯 MOCK TEST 2",h:12,mock:true,target:"≥ 580"},
  ]},
  {wk:"Wk 3",dates:"Apr 5–11",theme:"Chemistry Intensive",color:T.che,days:[
    {d:"Sun Apr 5", t:"Solutions + Colligative Properties — NCERT + 40 PYQs",h:10,mock:false},
    {d:"Mon Apr 6", t:"Chemical Kinetics + Thermodynamics — Arrhenius, ΔG cases",h:10,mock:false},
    {d:"Tue Apr 7", t:"Equilibrium + Electrochemistry — Nernst numericals",h:10,mock:false},
    {d:"Wed Apr 8", t:"Coordination Compounds + d/f block",h:10,mock:false},
    {d:"Thu Apr 9", t:"p-Block + s-Block — XeF structures, hybridisations",h:10,mock:false},
    {d:"Fri Apr 10",t:"Organic: Hydrocarbons + Haloalkanes — SN1/SN2",h:10,mock:false},
    {d:"Sat Apr 11",t:"🎯 MOCK TEST 3",h:12,mock:true,target:"≥ 600"},
  ]},
  {wk:"Wk 4",dates:"Apr 12–18",theme:"Physics Intensive",color:T.phy,days:[
    {d:"Sun Apr 12",t:"Chemistry finish: Biomolecules + Polymers",h:10,mock:false},
    {d:"Mon Apr 13",t:"Physics: Electrostatics — 20 numericals (Gauss, capacitors)",h:10,mock:false},
    {d:"Tue Apr 14",t:"Physics: Current Electricity + Magnetism",h:10,mock:false},
    {d:"Wed Apr 15",t:"Physics: EMI + AC Circuits — LCR resonance",h:10,mock:false},
    {d:"Thu Apr 16",t:"Physics: Ray + Wave Optics problems",h:10,mock:false},
    {d:"Fri Apr 17",t:"Physics: Photoelectric + Bohr + radioactive decay",h:10,mock:false},
    {d:"Sat Apr 18",t:"🎯 MOCK TEST 4",h:12,mock:true,target:"≥ 620"},
  ]},
  {wk:"Wk 5",dates:"Apr 19–25",theme:"Mock Marathon",color:T.purple,days:[
    {d:"Sun Apr 19",t:"Physics: Gravitation + Thermodynamics — PYQ numericals",h:10,mock:false},
    {d:"Mon Apr 20",t:"🎯 MOCK TEST 5 + 3-hour deep error analysis",h:12,mock:true,target:"≥ 630"},
    {d:"Tue Apr 21",t:"Error correction — Mock 5 wrong answers only",h:10,mock:false},
    {d:"Wed Apr 22",t:"🎯 MOCK TEST 6",h:12,mock:true,target:"≥ 640"},
    {d:"Thu Apr 23",t:"Biology diagrams sprint — DNA fork, meiosis, nephron, ECG",h:10,mock:false},
    {d:"Fri Apr 24",t:"🎯 MOCK TEST 7 — 2PM–5PM exact exam conditions",h:12,mock:true,target:"≥ 650"},
    {d:"Sat Apr 25",t:"Error analysis + Chemistry named reactions",h:10,mock:false},
  ]},
  {wk:"Wk 6",dates:"Apr 26–May 2",theme:"Final Consolidation",color:T.red,days:[
    {d:"Sun Apr 26",t:"🎯 MOCK TEST 8 — 2PM to 5PM",h:11,mock:true,target:"≥ 655"},
    {d:"Mon Apr 27",t:"Biology flashcard rapid-fire — 60 sec per chapter",h:9,mock:false},
    {d:"Tue Apr 28",t:"Chemistry NCERT Inorganic line-by-line (Ch7,8,9)",h:9,mock:false},
    {d:"Wed Apr 29",t:"🎯 MOCK TEST 9 — treat as actual NEET",h:10,mock:true,target:"≥ 660"},
    {d:"Thu Apr 30",t:"Error book only — absolutely no new content",h:7,mock:false},
    {d:"Fri May 1", t:"Light revision — diagrams 30 min + reactions 20 min",h:4,mock:false},
    {d:"Sat May 2", t:"Day Before — flashcards 90 min, visit exam centre, sleep 10PM",h:2,mock:false},
  ]},
];

const HACKS=[
  {icon:"📖",title:"3-Read NCERT Cycle",tag:"Memory",color:T.bio,body:"Read NCERT Biology 3 times: 1st=understand flow, 2nd=mark every bold term and diagram, 3rd=close book and recall. After 3 reads you retain 85%+ of exam-ready content.",action:"Chapter 1 should take under 18 minutes on Read 3. Time yourself."},
  {icon:"⚡",title:"Derive Before Memorise",tag:"Physics",color:T.phy,body:"Never memorise a formula without deriving it once from scratch. When you derive Nernst or lens formula yourself, you can reconstruct it under pressure even when memory fails.",action:"Derivation notebook — 1 page per formula. Review weekly in 10 minutes."},
  {icon:"🔗",title:"Concept Chaining",tag:"Biology",color:T.che,body:"Connect topics in chains: DNA→Replication→Transcription→Translation→Mutation→Genetic disease. One chain covers 15–20 exam questions and makes assertion-reason trivial.",action:"Draw your concept chain on one A4 paper. If it fits cleanly, understanding is complete."},
  {icon:"⏱",title:"The 50-Second Rule",tag:"Strategy",color:T.purple,body:"Every NEET question must be solved in under 50 seconds on average. Flag anything taking over 90 seconds, skip immediately, return after Biology and Chemistry.",action:"Mock timing: Bio 50 min → Chem 40 min → Phy 70 min → Review 20 min."},
  {icon:"🗺",title:"Organic Reaction Map",tag:"Chemistry",color:"#ff6b35",body:"Draw all named reactions on one A3 sheet as a flowchart — aldehyde at centre, arrows to Tollens, Fehling, iodoform, aldol, Cannizzaro, Clemmensen, Wolff-Kishner. One visual=8–10 marks.",action:"Redraw from memory every Sunday. 5 minutes without notes = you own it."},
  {icon:"🌙",title:"Sleep–Learn Cycle",tag:"Brain Science",color:T.che,body:"Study hardest topics just before sleep. Hippocampus consolidates long-term memory during deep sleep. Study-then-sleep=23% higher retention.",action:"No screens 30 min before bed. Flashcards only (no new content) for 10 minutes."},
  {icon:"📋",title:"Error Log Method",tag:"Mock Strategy",color:T.phy,body:"For every mock test wrong answer write: topic, why wrong, correct approach in one line. By Mock 5 you will see 60% of errors from the same 5 topics. Fix those 5=+40 marks.",action:"Review error log every 3 days. This separates 640 scorers from 680 scorers."},
  {icon:"🔢",title:"Number Anchoring",tag:"Physics",color:T.bio,body:"Anchor key numbers: GFR=125 mL/min, TV=500 mL, escape velocity=11.2 km/s, c=3×10⁸ m/s, h=6.63×10⁻³⁴ J·s. These appear in NEET numericals every single year.",action:"Write 20 anchor numbers on a sticky note. Glance 3× daily for one week."},
];

const Card=({children,style={}})=><div style={{background:T.card,borderRadius:16,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",...style}}>{children}</div>;
const Pill=({color,children,sm})=><span style={{background:`${color}18`,color,borderRadius:20,padding:sm?"1px 8px":"2px 10px",fontSize:sm?11:12,fontWeight:600}}>{children}</span>;
const Lbl=({children})=><div style={{fontSize:13,fontWeight:600,color:T.sub,textTransform:"uppercase",letterSpacing:0.4,marginBottom:8,marginTop:20}}>{children}</div>;
const Ring=({pct,color,size=56})=>{const r=(size-8)/2,circ=2*Math.PI*r,dash=(pct/100)*circ;return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.inset} strokeWidth={5}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"/></svg>;};

function Sheet({open,onClose,title,children}){
  useEffect(()=>{document.body.style.overflow=open?"hidden":"";return()=>{document.body.style.overflow="";};},[open]);
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:500}}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(8px)"}} onClick={onClose}/>
    <div style={{position:"absolute",bottom:0,left:0,right:0,background:T.card,borderRadius:"24px 24px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.14)"}}>
      <div style={{display:"flex",justifyContent:"center",padding:"10px 0 2px"}}><div style={{width:36,height:5,borderRadius:3,background:T.inset}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 20px 12px"}}>
        <div style={{fontSize:17,fontWeight:700,color:T.text}}>{title}</div>
        <button onClick={onClose} style={{background:T.faint,border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",fontSize:16,color:T.sub,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"0 16px 40px"}}>{children}</div>
    </div>
  </div>;
}

const inp={width:"100%",padding:"14px 16px",background:T.faint,border:"none",borderRadius:12,fontSize:16,color:T.text,outline:"none",boxSizing:"border-box",WebkitAppearance:"none"};

export default function App(){
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("home");
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("signin");
  const [form,setForm]=useState({name:"",email:"",phone:""});
  const [formErr,setFormErr]=useState("");
  const [sending,setSending]=useState(false);
  const [adminOpen,setAdminOpen]=useState(false);
  const [calOpen,setCalOpen]=useState(false);
  const [calWeek,setCalWeek]=useState(0);
  const [subject,setSubject]=useState("Biology");
  const [openTopic,setOpenTopic]=useState(null);
  const [openHack,setOpenHack]=useState(null);
  const [checked,setChecked]=useState({});
  const [mockIn,setMockIn]=useState({bio:"",phy:"",che:""});
  const [mockRes,setMockRes]=useState(null);
  const [toast,setToast]=useState(null);
  const [cd,setCd]=useState({d:0,h:0,m:0,s:0});

  useEffect(()=>{
    const s=rSes();
    if(s){setUser(s);setChecked(s.progress||{});}
  },[]);

  useEffect(()=>{
    const tick=()=>{const diff=new Date("2026-05-03T14:00:00")-new Date();if(diff<=0)return;setCd({d:Math.floor(diff/86400000),h:Math.floor((diff%86400000)/3600000),m:Math.floor((diff%3600000)/60000),s:Math.floor((diff%60000)/1000)});};
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[]);

  function showToast(m){setToast(m);setTimeout(()=>setToast(null),3000);}

  async function submitAuth(){
    setFormErr("");setSending(true);
    const r=authMode==="register"?dbReg(form.name,form.email,form.phone):dbLogin(form.email,form.phone);
    if(r.ok){
      await logSheet(r.user.name,r.user.email,r.user.phone,authMode==="register"?"Register":"Login");
      setUser(r.user);setChecked(r.user.progress||{});
      setAuthOpen(false);showToast(authMode==="register"?`Welcome, ${r.user.name.split(" ")[0]}! 🎉`:`Welcome back, ${r.user.name.split(" ")[0]}!`);
    }else setFormErr(r.msg);
    setSending(false);
  }

  function logout(){cSes();setUser(null);setChecked({});showToast("Signed out.");}
  function toggleCheck(id){const v=!checked[id];setChecked(p=>({...p,[id]:v}));if(user)dbSaveProg(user.id,id,v);}
  function calcMock(){
    const b=parseInt(mockIn.bio)||0,p=parseInt(mockIn.phy)||0,c=parseInt(mockIn.che)||0,total=b+p+c;
    let label,color;
    if(total>=660){label="AIR Top 20 Zone 🏆";color=T.bio;}
    else if(total>=640){label="Top 100 Territory 🌟";color=T.che;}
    else if(total>=600){label="Government MBBS ✅";color=T.phy;}
    else if(total>=540){label="On Track 📈";color=T.purple;}
    else{label="Start Now — Bio First ⚡";color=T.red;}
    setMockRes({total,b,p,c,label,color});
  }

  const filtT=TOPICS.filter(t=>t.sub===subject);
  const sColor=subject==="Biology"?T.bio:subject==="Chemistry"?T.che:T.phy;
  const doneCount=Object.values(checked).filter(Boolean).length;
  const topicPct=Math.round(doneCount/TOPICS.length*100);

  const TABS=[{id:"home",icon:"⊞",label:"Home"},{id:"prepare",icon:"📚",label:"Prepare"},{id:"hacks",icon:"💡",label:"Hacks"},{id:"track",icon:"🧮",label:"Score"}];

  return <div style={{fontFamily:T.F,background:T.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto"}}>
    {toast&&<div style={{position:"fixed",top:58,left:"50%",transform:"translateX(-50%)",background:"#1c1c1e",color:"#fff",borderRadius:24,padding:"10px 22px",fontSize:14,fontWeight:500,zIndex:1000,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:"90vw",textAlign:"center"}}>{toast}</div>}

    {/* AUTH SHEET */}
    <Sheet open={authOpen} onClose={()=>setAuthOpen(false)} title={authMode==="register"?"Create Account":"Sign In"}>
      <div style={{display:"flex",background:T.faint,borderRadius:12,padding:3,marginBottom:20}}>
        {["signin","register"].map(m=>(
          <button key={m} onClick={()=>{setAuthMode(m);setFormErr("");}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",background:authMode===m?T.card:"transparent",color:authMode===m?T.text:T.sub,cursor:"pointer",fontSize:15,fontWeight:authMode===m?600:400,boxShadow:authMode===m?"0 1px 6px rgba(0,0,0,0.1)":"none"}}>
            {m==="signin"?"Sign In":"Register"}
          </button>
        ))}
      </div>
      {authMode==="register"&&<><div style={{fontSize:12,color:T.sub,marginBottom:6}}>FULL NAME</div><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Your full name" style={{...inp,marginBottom:10}}/></>}
      <div style={{fontSize:12,color:T.sub,marginBottom:6}}>EMAIL</div>
      <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="you@example.com" style={{...inp,marginBottom:10}}/>
      <div style={{fontSize:12,color:T.sub,marginBottom:6}}>PHONE</div>
      <input type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="10-digit mobile" style={{...inp,marginBottom:formErr?10:20}}/>
      {formErr&&<div style={{color:T.red,fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fff0ef",borderRadius:10}}>{formErr}</div>}
      <button onClick={submitAuth} disabled={sending} style={{width:"100%",padding:"16px",background:sending?"#8a8a8e":"#1c1c1e",border:"none",borderRadius:14,color:"#fff",fontSize:16,fontWeight:600,cursor:sending?"default":"pointer"}}>
        {sending?"Saving…":authMode==="register"?"Create Account →":"Continue →"}
      </button>
      {SHEET_URL==="YOUR_APPS_SCRIPT_URL"&&<div style={{fontSize:12,color:T.sub,textAlign:"center",marginTop:14,lineHeight:1.6}}>🔒 Progress saves locally on this device.</div>}
    </Sheet>

    {/* ADMIN SHEET */}
    <Sheet open={adminOpen} onClose={()=>setAdminOpen(false)} title="Registered Students">
      <div style={{padding:"12px 14px",borderRadius:12,marginBottom:14,fontSize:13,lineHeight:1.6,background:SHEET_URL!=="YOUR_APPS_SCRIPT_URL"?"#f0fdf4":"#fff3cd",border:`1px solid ${SHEET_URL!=="YOUR_APPS_SCRIPT_URL"?T.bio+"30":"#ffc107"}`}}>
        {SHEET_URL!=="YOUR_APPS_SCRIPT_URL"?"✅ Google Sheets connected — all logins logged.":"⚠️ Paste your Apps Script URL on line 1 to collect data in Google Sheets."}
      </div>
      {(()=>{
        const users=dbUsers();
        if(!users.length)return <div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:48,marginBottom:12}}>📭</div><div style={{fontSize:16,fontWeight:600}}>No students yet</div></div>;
        return <>{users.map(u=>(
          <Card key={u.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontSize:16,fontWeight:700}}>{u.name}</div><div style={{fontSize:13,color:T.sub}}>{u.email}</div><div style={{fontSize:13,color:T.sub,fontWeight:500}}>{u.phone}</div></div>
              <Pill color={T.bio} sm>{Object.values(u.progress||{}).filter(Boolean).length} topics</Pill>
            </div>
            <div style={{fontSize:12,color:T.sub,marginTop:8}}>Joined {u.joinedAt?new Date(u.joinedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—"}</div>
          </Card>
        ))}</>;
      })()}
    </Sheet>

    {/* CALENDAR SHEET */}
    <Sheet open={calOpen} onClose={()=>setCalOpen(false)} title="42-Day Study Plan">
      <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
        {CAL.map((w,i)=>(
          <button key={i} onClick={()=>setCalWeek(i)} style={{flexShrink:0,padding:"8px 16px",borderRadius:20,border:`1.5px solid ${calWeek===i?w.color:T.border}`,background:calWeek===i?w.color:T.card,color:calWeek===i?"#fff":T.sub,cursor:"pointer",fontSize:13,fontWeight:calWeek===i?600:400,whiteSpace:"nowrap"}}>{w.wk}</button>
        ))}
      </div>
      {(()=>{const w=CAL[calWeek];return <>
        <div style={{background:w.color,borderRadius:14,padding:"14px 16px",marginBottom:12}}><div style={{color:"rgba(255,255,255,0.7)",fontSize:12,marginBottom:4}}>{w.dates}</div><div style={{color:"#fff",fontSize:17,fontWeight:700}}>{w.theme}</div></div>
        {w.days.map((d,i)=>(
          <div key={i} style={{background:d.mock?"#fffbeb":T.card,border:`1px solid ${d.mock?"#fcd34d":T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:8,display:"flex",gap:12}}>
            <div style={{minWidth:68,flexShrink:0}}>
              <div style={{fontSize:12,fontWeight:d.mock?700:500,color:d.mock?"#92400e":T.text}}>{d.d}</div>
              <div style={{fontSize:11,color:T.sub,marginTop:3}}>{d.h}h</div>
              {d.mock&&<div style={{marginTop:5,background:"#fcd34d",borderRadius:8,padding:"2px 7px",fontSize:10,fontWeight:700,color:"#92400e",display:"inline-block"}}>MOCK</div>}
            </div>
            <div style={{flex:1}}><div style={{fontSize:14,lineHeight:1.6}}>{d.t}</div>{d.target&&<div style={{fontSize:12,color:T.bio,marginTop:5,fontWeight:600}}>Target: {d.target}</div>}</div>
          </div>
        ))}</>;
      })()}
    </Sheet>

    {/* HEADER */}
    <div style={{position:"sticky",top:0,zIndex:200,background:"rgba(242,242,247,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontSize:17,fontWeight:700,letterSpacing:-0.3}}>NEET 2026</div>
        {user&&<div style={{fontSize:11,color:T.bio,marginTop:1}}>Hi, {user.name.split(" ")[0]} 👋</div>}
      </div>
      <div style={{display:"flex",gap:8}}>
        {user?(
          <>
            <button onClick={()=>setAdminOpen(true)} style={{background:T.faint,border:"none",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:13,color:T.text}}>Students</button>
            <button onClick={logout} style={{background:T.faint,border:"none",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:13,color:T.sub}}>Out</button>
          </>
        ):(
          <>
            <button onClick={()=>{setAuthMode("signin");setForm({name:"",email:"",phone:""});setFormErr("");setAuthOpen(true);}} style={{background:T.faint,border:"none",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:13,color:T.text}}>Sign In</button>
            <button onClick={()=>{setAuthMode("register");setForm({name:"",email:"",phone:""});setFormErr("");setAuthOpen(true);}} style={{background:"#1c1c1e",border:"none",borderRadius:20,padding:"6px 12px",cursor:"pointer",fontSize:13,color:"#fff",fontWeight:600}}>Register</button>
          </>
        )}
      </div>
    </div>

    <div style={{padding:"16px 16px 100px"}}>

      {/* HOME */}
      {tab==="home"&&<>
        <Card style={{background:"#1c1c1e",color:"#fff",marginBottom:12}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>Exam · May 3, 2026</div>
          <div style={{fontSize:24,fontWeight:700,letterSpacing:-0.8,marginBottom:18,lineHeight:1.2}}>NEET 2026<br/>Prepare · Practice · Track</div>
          <div style={{display:"flex"}}>
            {[{v:cd.d,u:"Days"},{v:cd.h,u:"Hrs"},{v:cd.m,u:"Min"},{v:cd.s,u:"Sec"}].map((t,i)=>(
              <div key={t.u} style={{flex:1,textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,0.1)":"none"}}>
                <div style={{fontSize:28,fontWeight:700,letterSpacing:-1,lineHeight:1}}>{String(t.v).padStart(2,"0")}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:4,textTransform:"uppercase"}}>{t.u}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
          <Card style={{display:"flex",gap:12,alignItems:"center"}}>
            <Ring pct={topicPct} color={T.bio} size={50}/>
            <div><div style={{fontSize:20,fontWeight:700}}>{topicPct}%</div><div style={{fontSize:12,color:T.sub}}>Topics done</div></div>
          </Card>
          <Card style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:T.sub,marginBottom:6}}>Score Target</div>
            <div style={{fontSize:22,fontWeight:700,color:"#1c1c1e"}}>650–691</div>
            <div style={{fontSize:11,color:T.sub}}>of 720 marks</div>
          </Card>
        </div>

        <Lbl>Score Targets</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:4}}>
          {[{l:"Biology",v:"340–355",c:T.bio},{l:"Chemistry",v:"155–168",c:T.che},{l:"Physics",v:"155–168",c:T.phy}].map(cx=>(
            <Card key={cx.l}>
              <div style={{fontSize:11,color:T.sub,marginBottom:6}}>{cx.l}</div>
              <div style={{fontSize:18,fontWeight:700,color:cx.c}}>{cx.v}</div>
              <div style={{fontSize:10,color:T.sub,marginTop:3}}>of {cx.l==="Biology"?"360":"180"}</div>
            </Card>
          ))}
        </div>

        {!user&&<Card style={{marginTop:8,textAlign:"center",padding:"22px 16px",border:`1.5px dashed ${T.border}`}}>
          <div style={{fontSize:28,marginBottom:10}}>🎯</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Save your progress</div>
          <div style={{fontSize:14,color:T.sub,marginBottom:18,lineHeight:1.6}}>Register free to track topics and mock scores.</div>
          <button onClick={()=>{setAuthMode("register");setForm({name:"",email:"",phone:""});setFormErr("");setAuthOpen(true);}} style={{background:"#1c1c1e",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:15,fontWeight:600,cursor:"pointer"}}>Get Started →</button>
        </Card>}

        <Lbl>AIR 1 Benchmark · NEET 2025</Lbl>
        <Card>
          <div style={{fontSize:13,color:T.sub,marginBottom:14}}>Mahesh Kumar · 686/720 · 22 mocks in 54 days</div>
          {[{s:"Biology",sc:"352/360",p:97.8,c:T.bio},{s:"Chemistry",sc:"168/180",p:93.3,c:T.che},{s:"Physics",sc:"166/180",p:92.2,c:T.phy}].map(r=>(
            <div key={r.s} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:14,fontWeight:500}}>{r.s}</span><span style={{fontSize:14,color:T.sub}}>{r.sc}</span></div>
              <div style={{height:4,background:T.inset,borderRadius:2}}><div style={{height:4,width:`${r.p}%`,background:r.c,borderRadius:2}}/></div>
            </div>
          ))}
          <div style={{padding:"12px 14px",background:T.faint,borderRadius:12,fontSize:13,color:T.sub,lineHeight:1.7}}>Max 4 wrong in Biology, 5 each in Chemistry and Physics. Negative marking kills ranks silently.</div>
        </Card>

        <Lbl>8 Golden Rules</Lbl>
        <Card>
          {["Biology first — finish in 50 min before Physics anxiety sets in","Never guess in Physics numericals — wrong = −5 marks effective","Read every word — 37% of NEET 2025 Biology Qs were reading traps","Exam order: Bio 50 min → Chem 40 min → Phy 70 min → Review 20 min","No new concepts after April 29 — consolidation beats new content","Error log is sacred — record every wrong mock: topic + reason + fix","22+ mock tests before May 3 — mock practice = exam muscle memory","Sleep 7–8 hours every night — memory consolidation requires deep sleep"].map((r,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"11px 0",borderBottom:i<7?`1px solid ${T.border}`:"none",alignItems:"flex-start"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:T.faint,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:T.sub,flexShrink:0,marginTop:1}}>{i+1}</div>
              <div style={{fontSize:13.5,lineHeight:1.6}}>{r}</div>
            </div>
          ))}
        </Card>
      </>}

      {/* PREPARE */}
      {tab==="prepare"&&<>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["Biology","Chemistry","Physics"].map(s=>{
            const c=s==="Biology"?T.bio:s==="Chemistry"?T.che:T.phy,active=subject===s;
            return <button key={s} onClick={()=>setSubject(s)} style={{flex:1,padding:"10px 0",borderRadius:12,border:`1.5px solid ${active?c:T.border}`,background:active?c:T.card,color:active?"#fff":T.sub,cursor:"pointer",fontSize:14,fontWeight:active?600:400,transition:"all .2s"}}>{s}</button>;
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:13,color:T.sub}}>{filtT.filter(t=>checked[t.id]).length}/{filtT.length} checked</span>
          <button onClick={()=>setCalOpen(true)} style={{background:T.che,border:"none",borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:13,color:"#fff",fontWeight:600}}>📅 42-Day Plan</button>
        </div>
        {filtT.map(topic=>{
          const isOpen=openTopic===topic.id;
          return <Card key={topic.id} style={{marginBottom:10,border:`1px solid ${isOpen?topic.color+"40":"transparent"}`,transition:"border-color .3s"}}>
            <div onClick={()=>setOpenTopic(p=>p===topic.id?null:topic.id)} style={{cursor:"pointer"}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <input type="checkbox" checked={!!checked[topic.id]} onClick={e=>e.stopPropagation()} onChange={()=>toggleCheck(topic.id)} style={{width:20,height:20,accentColor:topic.color,flexShrink:0,marginTop:2,cursor:"pointer"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:checked[topic.id]?T.sub:T.text,textDecoration:checked[topic.id]?"line-through":"none",marginBottom:8,lineHeight:1.4}}>{topic.name}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Pill color={T.red} sm>Must Do</Pill>
                    <span style={{fontSize:12,color:T.sub}}>📊 {topic.pyq} PYQs · {topic.repeat}% repeat</span>
                  </div>
                </div>
                <div style={{color:T.sub,fontSize:18,transform:isOpen?"rotate(180deg)":"none",transition:"transform .3s",flexShrink:0,marginTop:2}}>⌄</div>
              </div>
              <div style={{marginTop:10,marginLeft:32}}><div style={{height:3,background:T.inset,borderRadius:2}}><div style={{height:3,width:`${topic.repeat}%`,background:topic.repeat>=90?T.red:topic.color,borderRadius:2}}/></div></div>
            </div>
            {isOpen&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Key Concepts</div>
              {topic.concepts.map((c,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}><div style={{width:5,height:5,borderRadius:"50%",background:topic.color,marginTop:7,flexShrink:0}}/><span style={{fontSize:13.5,lineHeight:1.6}}>{c}</span></div>)}
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{background:T.faint,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Exam Tip</div><div style={{fontSize:13,lineHeight:1.7}}>{topic.tip}</div></div>
                <div style={{background:T.faint,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Memory Hack</div><div style={{fontSize:13,lineHeight:1.7}}>{topic.hack}</div></div>
              </div>
            </div>}
          </Card>;
        })}
      </>}

      {/* HACKS */}
      {tab==="hacks"&&<>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:26,fontWeight:700,letterSpacing:-0.8,marginBottom:4}}>Study Hacks</div>
          <div style={{fontSize:14,color:T.sub}}>Research-backed strategies from NEET toppers.</div>
        </div>
        {HACKS.map((h,i)=>{
          const isOpen=openHack===i;
          return <Card key={i} style={{marginBottom:10,border:`1px solid ${isOpen?h.color+"35":"transparent"}`}}>
            <div onClick={()=>setOpenHack(p=>p===i?null:i)} style={{cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",gap:12,alignItems:"center",flex:1}}>
                  <div style={{width:42,height:42,borderRadius:12,background:`${h.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{h.icon}</div>
                  <div><div style={{fontSize:15,fontWeight:600,marginBottom:4}}>{h.title}</div><Pill color={h.color} sm>{h.tag}</Pill></div>
                </div>
                <div style={{color:T.sub,fontSize:18,transform:isOpen?"rotate(180deg)":"none",transition:"transform .3s",flexShrink:0,marginTop:6}}>⌄</div>
              </div>
              {!isOpen&&<div style={{fontSize:13,color:T.sub,marginTop:10,lineHeight:1.6}}>{h.body.slice(0,80)}…</div>}
            </div>
            {isOpen&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:14,lineHeight:1.8,marginBottom:12}}>{h.body}</div>
              <div style={{background:T.faint,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:T.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Do This Today</div>
                <div style={{fontSize:13,lineHeight:1.7}}>{h.action}</div>
              </div>
            </div>}
          </Card>;
        })}
        <Lbl>20 Quick-Fire Tips</Lbl>
        <Card>
          {["Read all NCERT in-text questions — appear verbatim 3–4 times per year","Never leave Biology blank — trust your NCERT base","Write every formula derivation once — never memorise blindly","Bio 50 min → Chem 40 min → Phy 70 min → Review 20 min","Anomalous Cr and Cu configs appear every 2–3 years — write 10 times","ECG P-QRS-T sequence appears almost every year","Assertion-reason: judge A and R INDEPENDENTLY first","Draw DNA replication fork daily for 7 days — becomes motor memory","Never change answer in last 5 minutes — first instinct wins","Sleep 7 hours minimum — REM sleep consolidates memory","Review only your error log weekly — saves 2+ hours","XeF₂=linear, NOT bent. 'Bent' is the trap every 3 years","Sucrose=only common non-reducing sugar","Cyclotron period independent of velocity — classic assertion-reason","SHM: KE=PE at x=A/√2, NOT A/2 — costs marks every year","Carnot: ALWAYS use KELVIN — Celsius gives wrong answer","Catalyst never shifts equilibrium — tested every 2 years","GFR=125 mL/min — appears almost every year","No new content after April 29 — consolidation beats learning","On exam day: trust your preparation. Confidence is real."].map((t,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<19?`1px solid ${T.border}`:"none",alignItems:"flex-start"}}>
              <span style={{fontSize:12,fontWeight:700,color:T.sub,minWidth:22,textAlign:"right",flexShrink:0,marginTop:2}}>{i+1}</span>
              <span style={{fontSize:13.5,lineHeight:1.6}}>{t}</span>
            </div>
          ))}
        </Card>
      </>}

      {/* SCORE CALCULATOR */}
      {tab==="track"&&<>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:26,fontWeight:700,letterSpacing:-0.8,marginBottom:4}}>Score Calculator</div>
          <div style={{fontSize:14,color:T.sub}}>Enter your mock test marks to see your AIR range.</div>
        </div>
        <Card style={{marginBottom:12}}>
          {[{k:"bio",label:"Biology",max:360,color:T.bio},{k:"phy",label:"Physics",max:180,color:T.phy},{k:"che",label:"Chemistry",max:180,color:T.che}].map(f=>(
            <div key={f.k} style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><label style={{fontSize:15,fontWeight:600,color:f.color}}>{f.label}</label><span style={{fontSize:13,color:T.sub}}>max {f.max}</span></div>
              <input type="number" min="0" max={f.max} value={mockIn[f.k]} onChange={e=>setMockIn(p=>({...p,[f.k]:e.target.value}))} placeholder={`0 – ${f.max}`} style={{...inp,border:`1.5px solid ${f.color}30`}}/>
            </div>
          ))}
          <button onClick={calcMock} style={{width:"100%",padding:"16px",background:"#1c1c1e",border:"none",borderRadius:14,color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer"}}>Analyse →</button>
          {mockRes&&<div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${T.border}`}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:56,fontWeight:700,letterSpacing:-2,color:mockRes.color,lineHeight:1}}>{mockRes.total}</div>
              <div style={{fontSize:13,color:T.sub,marginTop:4}}>out of 720</div>
              <div style={{fontSize:16,fontWeight:600,color:mockRes.color,marginTop:8}}>{mockRes.label}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[["Bio",mockRes.b,360,T.bio],["Phy",mockRes.p,180,T.phy],["Che",mockRes.c,180,T.che]].map(([n,s,m,c])=>(
                <div key={n} style={{background:T.faint,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.sub,marginBottom:4}}>{n}</div>
                  <div style={{fontSize:22,fontWeight:700,color:c}}>{s}</div>
                  <div style={{fontSize:11,color:T.sub,marginTop:3}}>{Math.round(s/m*100)}%</div>
                </div>
              ))}
            </div>
          </div>}
        </Card>

        <Lbl>Score → AIR Mapping · NEET 2025</Lbl>
        <Card>
          {[{r:"685–720",air:"AIR 1–5",l:"Gold",c:"#b45309"},{r:"670–684",air:"AIR 6–50",l:"Elite",c:"#1c1c1e"},{r:"655–669",air:"AIR 51–200",l:"AIIMS",c:T.bio},{r:"640–654",air:"AIR 201–500",l:"Top Govt",c:T.che},{r:"620–639",air:"AIR 500–2K",l:"Govt MBBS",c:T.phy},{r:"580–619",air:"AIR 2K–8K",l:"State",c:T.purple},{r:"540–579",air:"AIR 8K–25K",l:"Private",c:T.sub}].map((row,i)=>(
            <div key={row.r} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<6?`1px solid ${T.border}`:"none"}}>
              <span style={{fontSize:16,fontWeight:700,color:row.c,letterSpacing:-0.3}}>{row.r}</span>
              <span style={{fontSize:13,color:T.sub}}>{row.air}</span>
              <Pill color={row.c} sm>{row.l}</Pill>
            </div>
          ))}
        </Card>

        <Lbl>Your Progress</Lbl>
        <Card style={{display:"flex",gap:16,alignItems:"center"}}>
          <Ring pct={topicPct} color={T.bio} size={60}/>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:700}}>{topicPct}%</div>
            <div style={{fontSize:13,color:T.sub,marginTop:2}}>{doneCount} of {TOPICS.length} topics completed</div>
            <div style={{height:4,background:T.inset,borderRadius:2,marginTop:10}}><div style={{height:4,width:`${topicPct}%`,background:"#1c1c1e",borderRadius:2,transition:"width 1s"}}/></div>
          </div>
        </Card>
      </>}
    </div>

    {/* BOTTOM TAB BAR */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(242,242,247,0.94)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,padding:"8px 0 20px",display:"flex",justifyContent:"space-around",zIndex:100}}>
      {TABS.map(n=>{
        const active=tab===n.id;
        return <button key={n.id} onClick={()=>setTab(n.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"4px 10px",border:"none",background:"transparent",cursor:"pointer",minWidth:52}}>
          <div style={{fontSize:20,lineHeight:1,filter:active?"none":"grayscale(100%) opacity(0.4)"}}>{n.icon}</div>
          <div style={{fontSize:10,fontWeight:active?600:400,color:active?"#1c1c1e":T.sub,letterSpacing:0.2}}>{n.label}</div>
        </button>;
      })}
    </div>
  </div>;
}
