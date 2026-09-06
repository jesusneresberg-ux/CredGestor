// CrediGestor v10 — modo Web/compacto, gráficos personalizáveis e hierarquia visual dos empréstimos.
(function(){
  'use strict';

  const MODELS_V10={
    bar:'Colunas',
    horizontal:'Barras horizontais',
    line:'Linha',
    area:'Área',
    dots:'Pontos',
    donut:'Rosca',
    pie:'Pizza'
  };
  const PALETTES_V10={
    oceano:{name:'Oceano',received:'#2563eb',out:'#f97316',colors:['#2563eb','#06b6d4','#4f46e5','#8b5cf6','#f97316','#14b8a6','#22c55e','#eab308','#ec4899','#0ea5e9','#6366f1','#f43f5e']},
    esmeralda:{name:'Esmeralda',received:'#059669',out:'#dc2626',colors:['#059669','#10b981','#14b8a6','#0d9488','#84cc16','#eab308','#f97316','#dc2626','#16a34a','#0891b2','#65a30d','#ea580c']},
    sunset:{name:'Pôr do sol',received:'#e11d48',out:'#7c3aed',colors:['#fb7185','#e11d48','#f97316','#f59e0b','#8b5cf6','#7c3aed','#db2777','#ea580c','#facc15','#a855f7','#be123c','#c026d3']},
    violeta:{name:'Violeta',received:'#7c3aed',out:'#06b6d4',colors:['#7c3aed','#8b5cf6','#a855f7','#c026d3','#06b6d4','#0ea5e9','#6366f1','#4f46e5','#d946ef','#22d3ee','#9333ea','#0284c7']},
    vibrante:{name:'Vibrante',received:'#0ea5e9',out:'#ef4444',colors:['#0ea5e9','#22c55e','#eab308','#f97316','#ef4444','#8b5cf6','#ec4899','#14b8a6','#6366f1','#84cc16','#f59e0b','#06b6d4']},
    grafite:{name:'Grafite',received:'#334155',out:'#64748b',colors:['#0f172a','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#1e293b','#3f3f46','#52525b','#71717a','#27272a','#a1a1aa']}
  };

  const style=document.createElement('style');
  style.textContent=`
    :root{--v10-app-max:520px}
    body[data-v10-layout="compact"]{--v10-app-max:520px}
    body[data-v10-layout="wide"]{--v10-app-max:980px}
    .app-shell{max-width:var(--v10-app-max)!important}
    .bottom-nav{width:min(var(--v10-app-max),100%)!important}
    .fab{right:max(18px,calc((100vw - var(--v10-app-max))/2 + 18px))!important}

    .v10-loan-client{font-size:18px;font-weight:900;line-height:1.18;color:var(--text);letter-spacing:-.01em}
    .v10-loan-contract{font-size:12px;font-weight:400;color:var(--muted);margin-top:4px;line-height:1.3}
    .v10-loan-doc{font-size:10px;color:var(--muted);margin-top:3px}

    .v10-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v10-setting-card{border:1px solid var(--line);border-radius:16px;padding:11px;background:rgba(148,163,184,.055)}
    .v10-setting-card label{display:block;font-size:11px;font-weight:850;color:var(--muted);margin-bottom:7px}
    .v10-setting-card select{width:100%;border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 11px}
    .v10-palettes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
    .v10-palette{border:1px solid var(--line);background:#fff;border-radius:14px;padding:9px 8px;text-align:left;color:var(--text)}
    .v10-palette.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 16%,transparent)}
    .v10-palette-name{display:block;font-size:10px;font-weight:850;margin-top:6px}
    .v10-swatches{display:flex;gap:3px;height:11px}
    .v10-swatches i{flex:1;border-radius:999px;display:block}
    .v10-setting-help{font-size:10px;color:var(--muted);line-height:1.45;margin-top:9px}

    .v10-finance-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0 2px}
    .v10-finance-summary .card{padding:13px}
    .v10-finance-summary .kicker{font-size:10px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    .v10-finance-summary strong{font-size:20px;display:block;margin-top:4px}
    .v10-chart-grid{display:grid;grid-template-columns:1fr;gap:12px}
    .v10-chart-card{overflow:hidden;padding:14px}
    .v10-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
    .v10-chart-head h3{font-size:14px;margin:0 0 3px}
    .v10-chart-head small{font-size:10px;color:var(--muted)}
    .v10-chart-total{text-align:right;white-space:nowrap}
    .v10-chart-total b{display:block;font-size:15px}
    .v10-chart-total span{font-size:9px;color:var(--muted)}
    .v10-svg-wrap{width:100%;overflow:hidden;border-radius:14px;background:linear-gradient(180deg,rgba(148,163,184,.055),rgba(255,255,255,.02));border:1px solid rgba(148,163,184,.10)}
    .v10-svg-wrap svg{display:block;width:100%;height:auto}
    .v10-donut-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;margin-top:8px}
    .v10-donut-legend div{display:flex;align-items:center;gap:6px;min-width:0;font-size:10px;color:var(--muted)}
    .v10-donut-legend i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
    .v10-donut-legend span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v10-model-badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:800;background:rgba(148,163,184,.10);color:var(--muted)}
    .v10-payers{overflow:hidden}
    .v10-payer{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid var(--line)}
    .v10-payer:last-child{border-bottom:0}
    .v10-payer-rank{width:28px;height:28px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:900;background:rgba(37,99,235,.09);color:var(--accent)}
    .v10-payer-name{font-size:13px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v10-payer small{display:block;color:var(--muted);font-size:9px;margin-top:2px}
    .v10-payer strong{font-size:12px}

    @media(min-width:900px){
      body[data-v10-layout="auto"]{--v10-app-max:980px}
      body[data-v10-layout="auto"] .view,body[data-v10-layout="wide"] .view{padding-left:24px;padding-right:24px}
      body[data-v10-layout="auto"] .v10-chart-grid,body[data-v10-layout="wide"] .v10-chart-grid{grid-template-columns:1fr 1fr}
      body[data-v10-layout="auto"] .v10-finance-summary,body[data-v10-layout="wide"] .v10-finance-summary{grid-template-columns:repeat(4,1fr)}
      body[data-v10-layout="auto"] .modal,body[data-v10-layout="wide"] .modal{width:min(720px,100%)}
    }
    @media(max-width:480px){
      .v10-settings-grid{grid-template-columns:1fr}
      .v10-palettes{grid-template-columns:repeat(2,1fr)}
      .v10-loan-client{font-size:16px}
    }
  `;
  document.head.appendChild(style);

  function ensureSettingsV10(){
    if(!state.settings||typeof state.settings!=='object')state.settings={};
    if(!['auto','compact','wide'].includes(state.settings.layoutV10))state.settings.layoutV10='auto';
    if(!Object.hasOwn(MODELS_V10,state.settings.chartModelV10))state.settings.chartModelV10='bar';
    if(!Object.hasOwn(PALETTES_V10,state.settings.chartPaletteV10))state.settings.chartPaletteV10='oceano';
    const period=Number(state.settings.chartMonthsV10);
    if(![3,6,12].includes(period))state.settings.chartMonthsV10=6;
  }
  ensureSettingsV10();

  function applyLayoutV10(){
    ensureSettingsV10();
    document.body.dataset.v10Layout=state.settings.layoutV10;
  }
  applyLayoutV10();

  if(typeof applySettings==='function'){
    const applySettingsBeforeV10=applySettings;
    applySettings=function(){applySettingsBeforeV10();applyLayoutV10()};
  }

  function cleanV10(v=''){
    return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }

  // Em Empréstimos, o cliente passa a ser a informação principal.
  function styleLoanCardsV10(){
    document.querySelectorAll('.loan-card').forEach(card=>{
      const ref=card.querySelector('.edit-loan2');if(!ref)return;
      const cl=(state.clients||[]).find(x=>x.id===ref.dataset.client);
      const k=(cl?.contracts||[]).find(x=>x.id===ref.dataset.loan);if(!cl||!k)return;
      const main=card.querySelector('.loan-main-row');if(!main)return;
      const textBox=main.querySelector('.avatar')?.nextElementSibling;if(!textBox)return;
      textBox.innerHTML=`<div class="v10-loan-client">${esc(cl.name||'Cliente')}</div><div class="v10-loan-contract">${esc(k.title||'Empréstimo')}</div>${cl.cpf?`<div class="v10-loan-doc">CPF ${esc(typeof formatCPF2==='function'?formatCPF2(cl.cpf):cl.cpf)}</div>`:''}`;
    });
  }
  if(typeof renderLoans2==='function'){
    const renderLoansBeforeV10=renderLoans2;
    renderLoans2=function(){const out=renderLoansBeforeV10();styleLoanCardsV10();return out};
  }

  function monthKeyV10(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  function dateKeyV10(v){
    if(!v)return '';
    const s=String(v);
    const iso=s.match(/^(\d{4})-(\d{2})/);if(iso)return `${iso[1]}-${iso[2]}`;
    const d=new Date(v);if(Number.isNaN(d.getTime()))return '';
    return monthKeyV10(d);
  }
  function lastMonthsV10(n){
    const now=new Date(),out=[];
    for(let i=n-1;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      out.push({key:monthKeyV10(d),label:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),full:d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})});
    }
    return out;
  }
  function receivedSeriesV10(months){
    const map=Object.fromEntries(months.map(m=>[m.key,0]));
    (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>(k.payments||[]).forEach(p=>{
      const key=dateKeyV10(p.paidAt)||(/^\d{4}-\d{2}/.test(String(p.reference||''))?String(p.reference).slice(0,7):'');
      if(Object.hasOwn(map,key))map[key]+=Number(p.amount)||0;
    })));
    return months.map(m=>({...m,value:map[m.key]||0}));
  }
  function outflowSeriesV10(months){
    const map=Object.fromEntries(months.map(m=>[m.key,0]));
    (state.clients||[]).forEach(cl=>(cl.contracts||[]).forEach(k=>{
      const key=dateKeyV10(k.startDate)||dateKeyV10(k.createdAt);if(Object.hasOwn(map,key))map[key]+=Number(k.initialPrincipal)||0;
      (k.movements||[]).filter(m=>m.type==='increase').forEach(m=>{const mk=dateKeyV10(m.date)||dateKeyV10(m.createdAt);if(Object.hasOwn(map,mk))map[mk]+=Number(m.amount)||0});
    }));
    return months.map(m=>({...m,value:map[m.key]||0}));
  }
  function topPayersV10(limit=7){
    return (state.clients||[]).map(c=>({c,total:(c.contracts||[]).reduce((sum,k)=>sum+(k.payments||[]).reduce((t,p)=>t+(Number(p.amount)||0),0),0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,limit);
  }
  function compactMoneyV10(v){
    const n=Number(v)||0;
    if(Math.abs(n)>=1_000_000)return `R$ ${(n/1_000_000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`;
    if(Math.abs(n)>=1_000)return `R$ ${(n/1_000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`;
    return `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
  }
  function safeColorV10(c,fallback='#2563eb'){return /^#[0-9a-f]{6}$/i.test(String(c))?c:fallback}
  function mixHexV10(hex,to='#ffffff',amount=.35){
    const a=safeColorV10(hex).slice(1),b=safeColorV10(to).slice(1);
    const out=[0,2,4].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
    return '#'+out;
  }
  function xmlV10(s=''){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))}

  function arcPathV10(cx,cy,ro,ri,a0,a1){
    const polar=(r,a)=>{const rad=(a-90)*Math.PI/180;return [cx+r*Math.cos(rad),cy+r*Math.sin(rad)]};
    const p1=polar(ro,a0),p2=polar(ro,a1),p3=polar(ri,a1),p4=polar(ri,a0),large=(a1-a0)>180?1:0;
    return `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${ro} ${ro} 0 ${large} 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} L ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} A ${ri} ${ri} 0 ${large} 0 ${p4[0].toFixed(2)} ${p4[1].toFixed(2)} Z`;
  }

  function chartSvgV10(series,kind,model,palette){
    const W=720,H=286,L=50,R=18,T=28,B=45,IW=W-L-R,IH=H-T-B,n=Math.max(1,series.length);
    const max=Math.max(1,...series.map(x=>Number(x.value)||0));
    const base=kind==='received'?palette.received:palette.out;
    const light=mixHexV10(base,'#ffffff',.45);
    const id=`v10g${kind}${Math.random().toString(36).slice(2,7)}`;
    const total=series.reduce((t,x)=>t+(Number(x.value)||0),0);

    if(model==='donut'||model==='pie'){
      const cx=360,cy=137,ro=98,ri=model==='pie'?0:60;
      let angle=0,paths='';
      if(total<=0){paths=`<circle cx="${cx}" cy="${cy}" r="${(ro+ri)/2}" fill="none" stroke="#cbd5e1" stroke-width="${ro-ri}" opacity=".45"/>`;}
      else series.forEach((x,i)=>{
        const value=Number(x.value)||0;if(value<=0)return;
        const sweep=(value/total)*359.6,a0=angle,a1=angle+sweep,colour=palette.colors[i%palette.colors.length];angle=a1;
        if(model==='pie'){const polar=(r,a)=>{const rad=(a-90)*Math.PI/180;return [cx+r*Math.cos(rad),cy+r*Math.sin(rad)]};const p1=polar(ro,a0),p2=polar(ro,a1),large=(a1-a0)>180?1:0;paths+=`<path d="M ${cx} ${cy} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${ro} ${ro} 0 ${large} 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z" fill="${colour}"><title>${xmlV10(x.full||x.label)}: ${xmlV10(brl(value))}</title></path>`;}else paths+=`<path d="${arcPathV10(cx,cy,ro,ri,a0,a1)}" fill="${colour}"><title>${xmlV10(x.full||x.label)}: ${xmlV10(brl(value))}</title></path>`;
      });
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico circular"><g>${paths}</g><text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${xmlV10(compactMoneyV10(total))}</text><text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="10" fill="#64748b">TOTAL</text></svg>`;
    }

    const y=(v)=>T+IH-(Math.max(0,Number(v)||0)/max)*IH;
    const x=(i)=>L+((i+.5)/n)*IW;
    let grid='';
    for(let i=0;i<=4;i++){
      const yy=T+(IH*i/4),val=max*(1-i/4);
      grid+=`<line x1="${L}" x2="${W-R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#94a3b8" stroke-opacity=".16" stroke-width="1"/><text x="${L-7}" y="${(yy+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8">${xmlV10(compactMoneyV10(val).replace('R$ ',''))}</text>`;
    }
    const labels=series.map((s,i)=>`<text x="${x(i).toFixed(1)}" y="${H-18}" text-anchor="middle" font-size="9" fill="#64748b">${xmlV10(s.label)}</text>`).join('');
    const defs=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${base}"/></linearGradient><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${base}" stop-opacity=".40"/><stop offset="100%" stop-color="${base}" stop-opacity=".03"/></linearGradient></defs>`;

    if(model==='horizontal'){
      const HH=Math.max(286,70+n*28),left=88,right=24,top=20,rowH=(HH-52)/n,maxV=Math.max(1,...series.map(s=>Number(s.value)||0));
      const marks=series.map((s,i)=>{const value=Number(s.value)||0,w=((W-left-right)*(value/maxV)),yy=top+i*rowH+4,h=Math.max(10,rowH-9);return `<text x="${left-8}" y="${(yy+h*.68).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748b">${xmlV10(s.label)}</text><rect x="${left}" y="${yy.toFixed(1)}" width="${Math.max(value?3:1,w).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(8,h/2).toFixed(1)}" fill="${palette.colors[i%palette.colors.length]}"><title>${xmlV10(s.full||s.label)}: ${xmlV10(brl(value))}</title></rect><text x="${Math.min(W-right-2,left+w+6).toFixed(1)}" y="${(yy+h*.68).toFixed(1)}" font-size="8" font-weight="700" fill="#64748b">${xmlV10(compactMoneyV10(value).replace('R$ ',''))}</text>`}).join('');
      return `<svg viewBox="0 0 ${W} ${HH}" role="img" aria-label="Gráfico de barras horizontais">${marks}</svg>`;
    }

    if(model==='bar'){
      const bw=Math.max(10,Math.min(42,(IW/n)*.52));
      const marks=series.map((s,i)=>{const value=Number(s.value)||0,yy=y(value),hh=Math.max(value?3:1,T+IH-yy);return `<rect x="${(x(i)-bw/2).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(9,bw/3).toFixed(1)}" fill="url(#${id})"><title>${xmlV10(s.full||s.label)}: ${xmlV10(brl(value))}</title></rect>${n<=6?`<text x="${x(i).toFixed(1)}" y="${Math.max(12,yy-7).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="#64748b">${xmlV10(compactMoneyV10(value).replace('R$ ',''))}</text>`:''}`}).join('');
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">${defs}${grid}${marks}${labels}</svg>`;
    }

    const pts=series.map((s,i)=>[x(i),y(s.value),Number(s.value)||0,s]).map(p=>p);
    const linePath=pts.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const areaPath=`M ${pts[0][0].toFixed(1)} ${(T+IH).toFixed(1)} ${pts.map((p,i)=>`${i?'L':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L ${pts[pts.length-1][0].toFixed(1)} ${(T+IH).toFixed(1)} Z`;
    let marks='';
    if(model==='area')marks+=`<path d="${areaPath}" fill="url(#${id}a)"/>`;
    if(model==='line'||model==='area')marks+=`<path d="${linePath}" fill="none" stroke="${base}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(model==='dots')marks+=pts.map(p=>`<line x1="${p[0].toFixed(1)}" x2="${p[0].toFixed(1)}" y1="${(T+IH).toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${base}" stroke-opacity=".22" stroke-width="3"/>`).join('');
    marks+=pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${model==='dots'?7:5}" fill="${palette.colors[i%palette.colors.length]}" stroke="#fff" stroke-width="2"><title>${xmlV10(p[3].full||p[3].label)}: ${xmlV10(brl(p[2]))}</title></circle>${n<=6?`<text x="${p[0].toFixed(1)}" y="${Math.max(12,p[1]-9).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="#64748b">${xmlV10(compactMoneyV10(p[2]).replace('R$ ',''))}</text>`:''}`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico ${xmlV10(MODELS_V10[model]||model)}">${defs}${grid}${marks}${labels}</svg>`;
  }

  function donutLegendV10(series,palette){
    return `<div class="v10-donut-legend">${series.map((s,i)=>`<div title="${esc(s.full||s.label)}: ${esc(brl(s.value))}"><i style="background:${palette.colors[i%palette.colors.length]}"></i><span>${esc(s.label)} • ${esc(compactMoneyV10(s.value))}</span></div>`).join('')}</div>`;
  }
  function chartCardV10(title,subtitle,series,kind){
    ensureSettingsV10();const model=state.settings.chartModelV10,palette=PALETTES_V10[state.settings.chartPaletteV10],total=series.reduce((t,x)=>t+(Number(x.value)||0),0),avg=series.length?total/series.length:0;
    return `<div class="card v10-chart-card"><div class="v10-chart-head"><div><h3>${esc(title)}</h3><small>${esc(subtitle)}</small><div style="margin-top:5px"><span class="v10-model-badge">${esc(MODELS_V10[model])}</span></div></div><div class="v10-chart-total"><b>${brl(total)}</b><span>média ${compactMoneyV10(avg)}/mês</span></div></div><div class="v10-svg-wrap">${chartSvgV10(series,kind,model,palette)}</div>${(model==='donut'||model==='pie')?donutLegendV10(series,palette):''}</div>`;
  }

  function enhancedDashboardV10(){
    const holder=document.getElementById('financeChartsV6');if(!holder)return;
    ensureSettingsV10();
    const months=lastMonthsV10(Number(state.settings.chartMonthsV10)||6),received=receivedSeriesV10(months),outflow=outflowSeriesV10(months),payers=topPayersV10();
    const totalIn=received.reduce((t,x)=>t+x.value,0),totalOut=outflow.reduce((t,x)=>t+x.value,0),net=totalIn-totalOut;
    const biggestIn=received.slice().sort((a,b)=>b.value-a.value)[0],biggestOut=outflow.slice().sort((a,b)=>b.value-a.value)[0];
    holder.innerHTML=`
      <div class="section-title"><h2>Gráficos financeiros</h2><small>${state.settings.chartMonthsV10} meses • ${esc(MODELS_V10[state.settings.chartModelV10])}</small></div>
      <div class="v10-finance-summary">
        <div class="card"><div class="kicker">Recebimentos</div><strong class="money success">${brl(totalIn)}</strong><small class="muted">no período</small></div>
        <div class="card"><div class="kicker">Saídas</div><strong class="money danger">${brl(totalOut)}</strong><small class="muted">no período</small></div>
        <div class="card"><div class="kicker">Diferença</div><strong class="money ${net>=0?'success':'danger'}">${brl(net)}</strong><small class="muted">entradas − saídas</small></div>
        <div class="card"><div class="kicker">Maior movimento</div><strong class="money">${brl(Math.max(biggestIn?.value||0,biggestOut?.value||0))}</strong><small class="muted">${(biggestIn?.value||0)>=(biggestOut?.value||0)?'recebimento':'saída'}</small></div>
      </div>
      <div class="v10-chart-grid">
        ${chartCardV10('Recebimentos','Pagamentos registrados por mês.',received,'received')}
        ${chartCardV10('Saídas','Capital liberado e acréscimos de saldo.',outflow,'out')}
      </div>
      <div class="section-title"><h2>Maiores pagadores</h2><small>histórico total</small></div>
      <div class="card v10-payers">${payers.length?payers.map((x,i)=>`<div class="v10-payer"><div class="v10-payer-rank">${i+1}</div><div><div class="v10-payer-name">${esc(x.c.name)}</div><small>Total recebido deste cliente</small></div><strong class="money">${brl(x.total)}</strong></div>`).join(''):'<div class="empty">Os maiores pagadores aparecerão após registrar pagamentos.</div>'}</div>`;
  }
  if(typeof renderDashboard==='function'){
    const renderDashboardBeforeV10=renderDashboard;
    renderDashboard=function(){const out=renderDashboardBeforeV10();enhancedDashboardV10();return out};
  }

  function paletteButtonsV10(){
    return Object.entries(PALETTES_V10).map(([key,p])=>`<button type="button" class="v10-palette ${state.settings.chartPaletteV10===key?'active':''}" data-v10-palette="${key}"><span class="v10-swatches">${p.colors.slice(0,6).map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="v10-palette-name">${esc(p.name)}</span></button>`).join('');
  }
  function injectSettingsV10(){
    if(document.getElementById('chartSettingsV10'))return;
    ensureSettingsV10();
    const title=[...document.querySelectorAll('.section-title h2')].find(x=>x.textContent.trim()==='Personalização');
    const card=title?.closest('.section-title')?.nextElementSibling;if(!card)return;
    card.insertAdjacentHTML('afterend',`<div id="chartSettingsV10"><div class="section-title"><h2>Formato e gráficos</h2><small>web e dashboard</small></div><div class="card">
      <div class="v10-settings-grid">
        <div class="v10-setting-card"><label>Formato de exibição</label><select id="layoutSelectV10"><option value="auto" ${state.settings.layoutV10==='auto'?'selected':''}>Automático</option><option value="compact" ${state.settings.layoutV10==='compact'?'selected':''}>Compacto / celular</option><option value="wide" ${state.settings.layoutV10==='wide'?'selected':''}>Amplo / web</option></select></div>
        <div class="v10-setting-card"><label>Modelo dos gráficos</label><select id="chartModelV10">${Object.entries(MODELS_V10).map(([k,n])=>`<option value="${k}" ${state.settings.chartModelV10===k?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="v10-setting-card"><label>Período exibido</label><select id="chartMonthsV10"><option value="3" ${Number(state.settings.chartMonthsV10)===3?'selected':''}>Últimos 3 meses</option><option value="6" ${Number(state.settings.chartMonthsV10)===6?'selected':''}>Últimos 6 meses</option><option value="12" ${Number(state.settings.chartMonthsV10)===12?'selected':''}>Últimos 12 meses</option></select></div>
        <div class="v10-setting-card"><label>Paleta atual</label><div style="font-size:14px;font-weight:850;margin-top:10px">${esc(PALETTES_V10[state.settings.chartPaletteV10].name)}</div><div class="v10-setting-help">As cores abaixo alteram apenas os gráficos; o tema geral continua independente.</div></div>
      </div>
      <div class="section-title compact-title"><h2>Cores dos gráficos</h2><small>escolha uma paleta</small></div>
      <div class="v10-palettes">${paletteButtonsV10()}</div>
      <div class="v10-setting-help">O modo Automático usa a visualização ampla em telas grandes e mantém o formato compacto no celular.</div>
    </div></div>`);
    document.getElementById('layoutSelectV10').onchange=e=>{state.settings.layoutV10=e.target.value;saveState();applyLayoutV10()};
    document.getElementById('chartModelV10').onchange=e=>{state.settings.chartModelV10=e.target.value;saveState();renderSettings()};
    document.getElementById('chartMonthsV10').onchange=e=>{state.settings.chartMonthsV10=Number(e.target.value)||6;saveState();renderSettings()};
    document.querySelectorAll('[data-v10-palette]').forEach(b=>b.onclick=()=>{state.settings.chartPaletteV10=b.dataset.v10Palette;saveState();renderSettings()});
  }
  if(typeof renderSettings==='function'){
    const renderSettingsBeforeV10=renderSettings;
    renderSettings=function(){const out=renderSettingsBeforeV10();injectSettingsV10();return out};
  }

  // Reaplica a versão aprimorada na tela que já estiver aberta.
  applyLayoutV10();
  if(currentView==='dashboard')renderDashboard();
  else if(currentView==='loans'&&typeof renderLoans2==='function')renderLoans2();
  else if(currentView==='settings')renderSettings();
})();
