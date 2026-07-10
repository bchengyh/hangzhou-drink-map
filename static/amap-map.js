(async function(){
  const cfg=await fetch('/api/client-config').then(r=>r.json()).catch(()=>({}));
  if(!cfg.key||!cfg.security)return;
  window._AMapSecurityConfig={securityJsCode:cfg.security};
  const loaded=await new Promise(resolve=>{const s=document.createElement('script');s.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.key)}&plugin=AMap.HeatMap,AMap.MassMarks`;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s)});
  if(!loaded||!window.AMap)return;
  document.querySelector('.map-panel').classList.add('amap-ready');
  const map=new AMap.Map('amapBase',{viewMode:'2D',zoom:10,center:[120.15,30.27],mapStyle:'amap://styles/whitesmoke',showLabel:true});
  let heatLayers={},massLayers={},polygons=[],boundaryPaths=[],coverageLayers=[],metroLayers=[],compareMetroLayers=[],lastCoverageData=null,comparePolygons=[],lastPoints={},heatRadius=7,currentLayer='heat',fittedOnce=false,compareMode=false,map2=null,compareHeat=null,comparePoints=[],syncing=false,compareBrands=['瑞幸咖啡','蜜雪冰城'],refreshSeq=0;
  const brandOrder=['瑞幸咖啡','蜜雪冰城','库迪咖啡','古茗','星巴克'];
  const gradients={"瑞幸咖啡":{.10:'#b8f4fa',.35:'#62d9f4',.58:'#2d9df0',.78:'#2859d9',1:'#32168f'},"蜜雪冰城":{.10:'#fff3a6',.35:'#ffd35c',.58:'#ff963f',.78:'#ef4b32',1:'#c91424'},"库迪咖啡":{.10:'#d8f8bd',.35:'#92e36f',.58:'#38c96d',.78:'#099a72',1:'#006b55'},"古茗":{.10:'#ffe3f1',.35:'#f6a5d5',.58:'#e45bb4',.78:'#bf268c',1:'#86156b'},"星巴克":{.10:'#d7ead6',.35:'#91c78d',.58:'#4d9b56',.78:'#14743a',1:'#004b2f'}};
  const pointColors={"瑞幸咖啡":"#2679ee","蜜雪冰城":"#e62f2f","库迪咖啡":"#0a9f73","古茗":"#c93298","星巴克":"#006241"};
  const metroLines=[
    {name:'1号线',color:'#E51C23',label:[120.172,30.266],path:[[120.238,30.167],[120.219,30.181],[120.211,30.204],[120.205,30.229],[120.197,30.244],[120.181,30.257],[120.172,30.266],[120.159,30.274],[120.174,30.290],[120.212,30.291],[120.223,30.299],[120.269,30.313],[120.317,30.319],[120.350,30.315],[120.384,30.313],[120.415,30.309]]},
    {name:'2号线',color:'#F28C00',label:[120.132,30.286],path:[[120.270,30.124],[120.260,30.155],[120.248,30.194],[120.239,30.220],[120.225,30.238],[120.207,30.254],[120.181,30.266],[120.164,30.270],[120.144,30.278],[120.132,30.286],[120.111,30.296],[120.091,30.309],[120.073,30.328],[120.055,30.348]]},
    {name:'4号线',color:'#6F2DA8',label:[120.206,30.245],path:[[120.159,30.158],[120.169,30.180],[120.184,30.207],[120.197,30.231],[120.206,30.245],[120.211,30.259],[120.214,30.276],[120.224,30.292],[120.205,30.300],[120.190,30.317],[120.181,30.340],[120.176,30.360]]},
    {name:'5号线',color:'#00A3A1',label:[120.122,30.309],path:[[119.998,30.279],[120.028,30.286],[120.061,30.296],[120.091,30.309],[120.122,30.309],[120.151,30.306],[120.174,30.290],[120.181,30.257],[120.190,30.237],[120.197,30.207],[120.205,30.182],[120.230,30.166],[120.260,30.151],[120.285,30.135]]},
    {name:'6号线',color:'#0072BC',label:[120.240,30.218],path:[[119.966,30.048],[120.041,30.078],[120.081,30.113],[120.147,30.154],[120.190,30.181],[120.226,30.212],[120.240,30.218],[120.254,30.243],[120.269,30.275],[120.276,30.303],[120.253,30.327]]},
    {name:'7号线',color:'#8A1538',label:[120.244,30.236],path:[[120.158,30.240],[120.185,30.244],[120.211,30.252],[120.244,30.236],[120.260,30.214],[120.286,30.190],[120.326,30.175],[120.382,30.181],[120.447,30.229]]},
    {name:'9号线',color:'#B78500',label:[120.286,30.322],path:[[120.200,30.244],[120.219,30.259],[120.241,30.278],[120.269,30.313],[120.286,30.322],[120.323,30.361],[120.339,30.389],[120.303,30.421]]},
    {name:'10号线',color:'#C8A2C8',label:[120.128,30.314],path:[[120.130,30.270],[120.132,30.286],[120.128,30.314],[120.127,30.334],[120.126,30.355],[120.128,30.378]]},
    {name:'16号线',color:'#7AC143',label:[119.989,30.279],path:[[119.724,30.230],[119.806,30.245],[119.891,30.258],[119.998,30.279],[120.033,30.285]]},
    {name:'19号线',color:'#00AEEF',label:[120.170,30.300],path:[[119.998,30.319],[120.035,30.315],[120.079,30.305],[120.124,30.301],[120.170,30.300],[120.205,30.300],[120.244,30.302],[120.292,30.284],[120.365,30.248],[120.447,30.229]]}
  ];
  function pointIcon(color){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="${color}" fill-opacity=".78" stroke="white" stroke-width="2"/><circle cx="9" cy="9" r="2.2" fill="white" fill-opacity=".85"/></svg>`;return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
  window.__amapDebug={map,get map2(){return map2},get compareBrands(){return compareBrands},get heatRadius(){return heatRadius},get massLayerBrands(){return Object.keys(massLayers)},get metroLayerCount(){return metroLayers.length}};
  function metroEnabled(){return document.querySelector('#metroToggle')?.checked!==false}
  function clearMetro(targetMap,bucket){bucket.forEach(x=>targetMap.remove(x));bucket.length=0}
  function drawMetro(targetMap,bucket){
    if(!targetMap)return;clearMetro(targetMap,bucket);document.body.classList.toggle('metro-on',metroEnabled());
    if(!metroEnabled())return;
    metroLines.forEach(line=>{
      const halo=new AMap.Polyline({path:line.path,strokeColor:'#fffdf8',strokeWeight:7,strokeOpacity:.72,zIndex:9,bubble:true});
      const rail=new AMap.Polyline({path:line.path,strokeColor:line.color,strokeWeight:3,strokeOpacity:.68,zIndex:10,lineJoin:'round',lineCap:'round',bubble:true});
      const label=new AMap.Text({text:line.name,position:line.label||line.path[Math.floor(line.path.length/2)],anchor:'center',zIndex:11,style:{'background-color':'rgba(255,253,248,.86)','border':'1px solid rgba(214,201,188,.9)','border-radius':'999px','box-shadow':'0 2px 8px rgba(0,0,0,.08)','padding':'2px 6px','font-size':'10px','font-weight':'700','color':line.color}});
      targetMap.add([halo,rail,label]);bucket.push(halo,rail,label);
    });
  }
  function paths(raw){return String(raw||'').split('|').map(part=>part.split(';').map(p=>p.split(',').map(Number)).filter(p=>p.length===2&&!p.some(isNaN))).filter(p=>p.length>2)}
  function activeDistricts(){const names=['上城','拱墅','西湖','滨江','萧山','余杭','临平','钱塘'];return [...document.querySelectorAll('#districtFilters .chip')].filter(x=>x.classList.contains('active')).map(x=>names.includes(x.textContent)?x.textContent+'区':x.textContent)}
  function activeBrands(){return [...document.querySelectorAll('#brandFilters input:checked')].map(x=>x.parentElement.textContent.trim())}
  function pickCompareBrands(){const bs=activeBrands(),picked=[];[...bs,...brandOrder].forEach(b=>{if(brandOrder.includes(b)&&!picked.includes(b)&&picked.length<2)picked.push(b)});return picked.length===2?picked:['瑞幸咖啡','蜜雪冰城']}
  function coverageBrands(){const bs=activeBrands(),mode=document.querySelector('#coverageMode')?.value,type=document.querySelector('#coverageType')?.value,target=document.querySelector('#blindBrand')?.value;if(currentLayer==='coverage'&&mode==='compare')return [...new Set([document.querySelector('#baseBrand')?.value||'瑞幸咖啡',document.querySelector('#compareBrand')?.value||'星巴克'])];if(currentLayer==='coverage'&&type==='brandBlind')return [...new Set([...(bs.length?bs:brandOrder),target].filter(Boolean))];return bs}
  async function refresh(){const seq=++refreshSeq,p=new URLSearchParams(),ds=activeDistricts(),bs=currentLayer==='coverage'?coverageBrands():activeBrands();if(ds.length)p.set('districts',ds.join(','));p.set('brands',compareMode?compareBrands[0]:(bs.length?bs.join(','):'__none__'));const data=await fetch('/api/dashboard?'+p).then(r=>r.json());if(seq!==refreshSeq)return;draw(data)}
  function updateCoverageModeUI(){document.body.classList.toggle('compare-analysis',(document.querySelector('#coverageMode')?.value||'combo')==='compare')}
  function setLayer(type){if(type==='coverage'&&compareMode)stopCompare();currentLayer=type;document.body.classList.toggle('coverage-active',type==='coverage');updateCoverageModeUI();Object.values(heatLayers).forEach(x=>type==='heat'?x.show():x.hide());Object.values(massLayers).forEach(x=>type==='point'?x.show():x.hide());coverageLayers.forEach(x=>type==='coverage'?x.show():x.hide());if(type==='coverage')drawCoverage(lastCoverageData)}
  function radiusKm(){const r=document.querySelector('#ruler');return Math.max(.2,(+(r?.value||2))/10)}
  function distKm(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
  function inside(pt,poly){let x=pt[0],y=pt[1],hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi))hit=!hit}return hit}
  function clearCoverage(){coverageLayers.forEach(p=>map.remove(p));coverageLayers=[]}
  function setCoverageStats(matched,total,label){window.__coverageStats={matched,total,label};const a=document.querySelector('#coverageCells'),b=document.querySelector('#coverageMeta');if(a)a.textContent=matched;if(b)b.textContent=total?`${label} · ${Math.round(matched/total*100)}%`:'覆盖分析样本'}
  function drawCoverage(data){
    clearCoverage();lastCoverageData=data;if(currentLayer!=='coverage'||!data){setCoverageStats(0,0,'覆盖分析样本');return}
    const mode=document.querySelector('#coverageMode')?.value||'combo',base=document.querySelector('#baseBrand')?.value||'瑞幸咖啡',comp=document.querySelector('#compareBrand')?.value||'星巴克',view=document.querySelector('#compareView')?.value||'baseOnly',selected=(mode==='compare'?[base,comp]:coverageBrands()).filter(b=>brandOrder.includes(b)),type=document.querySelector('#coverageType')?.value||'overlap',threshold=+(document.querySelector('#overlapThreshold')?.value||2),target=document.querySelector('#blindBrand')?.value||selected[0]||brandOrder[0];
    if(!selected.length||!boundaryPaths.length){setCoverageStats(0,0,'请先选择品牌');return}
    const all=boundaryPaths.flat(),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),rad=radiusKm(),step=Math.max(.003,Math.min(.012,rad/75)),scan=Math.max(.006,rad/111+step*1.8);
    const byBrand=Object.fromEntries(brandOrder.map(b=>[b,(data.stores||[]).filter(s=>s.brand===b&&s.lng&&s.lat)]));let total=0,matched=0;
    for(let lng=minX;lng<=maxX;lng+=step){for(let lat=minY;lat<=maxY;lat+=step){const center=[lng+step/2,lat+step/2];if(!boundaryPaths.some(poly=>inside(center,poly)))continue;total++;
      const cover=[];for(const b of selected){const stores=byBrand[b]||[];for(const s of stores){if(Math.abs(s.lng-center[0])>scan||Math.abs(s.lat-center[1])>scan)continue;if(distKm({lng:center[0],lat:center[1]},{lng:s.lng,lat:s.lat})<=rad){cover.push(b);break}}}
      const hasBase=cover.includes(base),hasComp=cover.includes(comp);let show=false,color='#6b42d9',opacity=.28;if(mode==='compare'){
        if(view==='baseOnly'){show=hasBase&&!hasComp;color='#1976d2';opacity=.30}
        else if(view==='compareOnly'){show=hasComp&&!hasBase;color='#0b8f61';opacity=.30}
        else if(view==='both'){show=hasBase&&hasComp;color='#6537d8';opacity=.38}
        else if(view==='neither'){show=!hasBase&&!hasComp;color='#df4b4b';opacity=.22}
        else {show=true;if(hasBase&&hasComp){color='#6537d8';opacity=.34}else if(hasBase){color='#1976d2';opacity=.26}else if(hasComp){color='#0b8f61';opacity=.26}else{color='#df4b4b';opacity=.18}}
        if(show)matched++;
      }else if(type==='covered'){show=cover.length>0;color='#58aef8';opacity=.18;if(show)matched++}
      else if(type==='overlap'){show=cover.length>=threshold;color='#6537d8';opacity=.38;if(show)matched++}
      else if(type==='blind'){show=cover.length===0;color='#df4b4b';opacity=.22;if(show)matched++}
      else {const hasTarget=cover.includes(target);show=!hasTarget;color='#df4b4b';opacity=.20;if(show)matched++}
      if(show){const path=[[lng,lat],[lng+step,lat],[lng+step,lat+step],[lng,lat+step]],p=new AMap.Polygon({path,strokeOpacity:0,fillColor:color,fillOpacity:opacity,zIndex:22,bubble:true});coverageLayers.push(p);map.add(p)}
    }}
    const compareLabels={baseOnly:`${comp}补位机会区`,compareOnly:`${base}相对空白区`,both:'双方重合竞争区',neither:'双方共同盲区',quad:'四象限全显示'},label=mode==='compare'?compareLabels[view]:(type==='covered'?'至少 1 品牌覆盖':type==='overlap'?`多品牌重合 ${threshold}+`:type==='blind'?'共同盲区':'指定品牌盲区');setCoverageStats(matched,total,label);window.__coverageLayerCount=coverageLayers.length;window.__coverageMode={mode,base,compare:comp,view,label,matched,total};
  }
  function draw(data){
    polygons.forEach(p=>map.remove(p));polygons=[];boundaryPaths=[];
    Object.values(data.boundaries||{}).forEach(raw=>paths(raw).forEach(path=>{boundaryPaths.push(path);const p=new AMap.Polygon({path,strokeColor:'#245797',strokeWeight:1.5,strokeOpacity:.8,fillColor:'#d9ecff',fillOpacity:.08,zIndex:8});polygons.push(p);map.add(p)}));
    Object.values(heatLayers).forEach(x=>x.hide());Object.values(massLayers).forEach(x=>x.setMap(null));heatLayers={};massLayers={};lastPoints={};
    brandOrder.forEach((brand,index)=>{const stores=(data.stores||[]).filter(s=>s.brand===brand&&s.lng&&s.lat),pts=stores.map(s=>({lng:s.lng,lat:s.lat,count:1}));if(!pts.length)return;lastPoints[brand]=pts;const h=new AMap.HeatMap(map,{radius:heatRadius,opacity:[.14,.88],gradient:gradients[brand],zooms:[8,18]});h.setDataSet({data:pts,max:6});heatLayers[brand]=h;const m=new AMap.MassMarks(stores.map(s=>({lnglat:[s.lng,s.lat],name:s.name,address:s.address,brand:s.brand})),{zIndex:120+index,opacity:.64,zooms:[8,20],style:{url:pointIcon(pointColors[brand]||'#2679ee'),anchor:new AMap.Pixel(6,6),size:new AMap.Size(12,12)}});m.setMap(map);massLayers[brand]=m});setLayer(currentLayer);
    lastCoverageData=data;drawCoverage(data);
    if(polygons.length&&!fittedOnce){fittedOnce=true;requestAnimationFrame(()=>{map.resize();setTimeout(()=>map.setFitView(polygons,false,[42,42,145,42]),120)})}
  }
  await refresh();
  drawMetro(map,metroLayers);
  document.addEventListener('click',e=>{if(e.target.closest('#districtFilters')||e.target.closest('#brandFilters'))setTimeout(()=>compareMode?startCompare():refresh(),250);const layer=e.target.closest('[data-layer]');if(layer)setLayer(layer.dataset.layer)});
  document.querySelector('#metroToggle')?.addEventListener('change',()=>{drawMetro(map,metroLayers);if(map2)drawMetro(map2,compareMetroLayers)});
  const ruler=document.querySelector('#ruler');
  ruler?.addEventListener('input',()=>{if(!document.querySelector('[data-mode="radius"]')?.classList.contains('active'))return;heatRadius=Math.round(6+(+ruler.value*.55));Object.entries(heatLayers).forEach(([brand,h])=>{if(h.setOptions)h.setOptions({radius:heatRadius});h.setDataSet({data:lastPoints[brand]||[],max:6})});if(compareHeat){if(compareHeat.setOptions)compareHeat.setOptions({radius:heatRadius});compareHeat.setDataSet({data:comparePoints,max:6})}if(currentLayer==='coverage')drawCoverage(lastCoverageData);window.__amapHeatRadius=heatRadius});
  ['#coverageMode','#coverageType','#overlapThreshold','#blindBrand','#baseBrand','#compareBrand','#compareView'].forEach(sel=>document.querySelector(sel)?.addEventListener('change',()=>{updateCoverageModeUI();refresh()}));
  async function startCompare(){
    if(currentLayer==='coverage'){document.querySelector('[data-layer="heat"]')?.click()}
    compareBrands=pickCompareBrands();
    compareMode=true;document.querySelector('.map-panel').classList.add('compare-mode');document.querySelector('#compareBtn').textContent='退出对比';map.resize();
    if(!map2){map2=new AMap.Map('amapCompare',{viewMode:'2D',zoom:map.getZoom(),center:map.getCenter(),mapStyle:'amap://styles/whitesmoke',showLabel:true});drawMetro(map2,compareMetroLayers);const sync=(a,b)=>{if(syncing||!b)return;syncing=true;b.setZoomAndCenter(a.getZoom(),a.getCenter(),true);setTimeout(()=>syncing=false,30)};map.on('moveend',()=>sync(map,map2));map.on('zoomend',()=>sync(map,map2));map2.on('moveend',()=>sync(map2,map));map2.on('zoomend',()=>sync(map2,map))}
    document.querySelector('.left-label').textContent=compareBrands[0];document.querySelector('.right-label').textContent=compareBrands[1];
    comparePolygons.forEach(p=>map2.remove(p));comparePolygons=[];if(compareHeat){compareHeat.hide();compareHeat=null}
    const ds=activeDistricts(),p=new URLSearchParams({brands:compareBrands[1]});if(ds.length)p.set('districts',ds.join(','));const data=await fetch('/api/dashboard?'+p).then(r=>r.json());
    Object.values(data.boundaries||{}).forEach(raw=>paths(raw).forEach(path=>{const poly=new AMap.Polygon({path,strokeColor:'#b52932',strokeWeight:1.4,strokeOpacity:.75,fillColor:'#fff0d0',fillOpacity:.07,zIndex:8});comparePolygons.push(poly);map2.add(poly)}));comparePoints=(data.stores||[]).filter(s=>s.lng&&s.lat).map(s=>({lng:s.lng,lat:s.lat,count:1}));compareHeat=new AMap.HeatMap(map2,{radius:heatRadius,opacity:[.14,.88],gradient:gradients[compareBrands[1]],zooms:[8,18]});compareHeat.setDataSet({data:comparePoints,max:6});await refresh();map.resize();map2.resize();map2.setZoomAndCenter(map.getZoom(),map.getCenter(),true);window.__amapCompareLinked={left:compareBrands[0],right:compareBrands[1],zoom:map.getZoom(),zoom2:map2.getZoom()}
  }
  function stopCompare(){compareMode=false;compareHeat=null;comparePoints=[];comparePolygons=[];compareMetroLayers=[];document.querySelector('.map-panel').classList.remove('compare-mode');document.querySelector('#compareBtn').textContent='左右对比';if(map2){map2.destroy();map2=null;document.querySelector('#amapCompare').innerHTML=''}map.resize();refresh()}
  document.querySelector('#compareBtn')?.addEventListener('click',()=>compareMode?stopCompare():startCompare());
})();
