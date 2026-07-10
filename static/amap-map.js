(async function(){
  const cfg=await fetch('/api/client-config').then(r=>r.json()).catch(()=>({}));
  if(!cfg.key||!cfg.security)return;
  window._AMapSecurityConfig={securityJsCode:cfg.security};
  const loaded=await new Promise(resolve=>{const s=document.createElement('script');s.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.key)}&plugin=AMap.HeatMap,AMap.MassMarks`;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s)});
  if(!loaded||!window.AMap)return;
  document.querySelector('.map-panel').classList.add('amap-ready');
  const map=new AMap.Map('amapBase',{viewMode:'2D',zoom:10,center:[120.15,30.27],mapStyle:'amap://styles/whitesmoke',showLabel:true});
  let heatLayers={},massLayers={},polygons=[],boundaryPaths=[],coverageLayers=[],lastCoverageData=null,comparePolygons=[],lastPoints={},heatRadius=7,currentLayer='heat',fittedOnce=false,compareMode=false,map2=null,compareHeat=null,comparePoints=[],syncing=false,compareBrands=['瑞幸咖啡','蜜雪冰城'],refreshSeq=0;
  const brandOrder=['瑞幸咖啡','蜜雪冰城','库迪咖啡','古茗','星巴克'];
  const gradients={"瑞幸咖啡":{.10:'#b8f4fa',.35:'#62d9f4',.58:'#2d9df0',.78:'#2859d9',1:'#32168f'},"蜜雪冰城":{.10:'#fff3a6',.35:'#ffd35c',.58:'#ff963f',.78:'#ef4b32',1:'#c91424'},"库迪咖啡":{.10:'#d8f8bd',.35:'#92e36f',.58:'#38c96d',.78:'#099a72',1:'#006b55'},"古茗":{.10:'#ffe3f1',.35:'#f6a5d5',.58:'#e45bb4',.78:'#bf268c',1:'#86156b'},"星巴克":{.10:'#d7ead6',.35:'#91c78d',.58:'#4d9b56',.78:'#14743a',1:'#004b2f'}};
  const pointColors={"瑞幸咖啡":"#2679ee","蜜雪冰城":"#e62f2f","库迪咖啡":"#0a9f73","古茗":"#c93298","星巴克":"#006241"};
  function pointIcon(color){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="${color}" fill-opacity=".78" stroke="white" stroke-width="2"/><circle cx="9" cy="9" r="2.2" fill="white" fill-opacity=".85"/></svg>`;return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
  window.__amapDebug={map,get map2(){return map2},get compareBrands(){return compareBrands},get heatRadius(){return heatRadius},get massLayerBrands(){return Object.keys(massLayers)}};
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
  document.addEventListener('click',e=>{if(e.target.closest('#districtFilters')||e.target.closest('#brandFilters'))setTimeout(()=>compareMode?startCompare():refresh(),250);const layer=e.target.closest('[data-layer]');if(layer)setLayer(layer.dataset.layer)});
  const ruler=document.querySelector('#ruler');
  ruler?.addEventListener('input',()=>{if(!document.querySelector('[data-mode="radius"]')?.classList.contains('active'))return;heatRadius=Math.round(6+(+ruler.value*.55));Object.entries(heatLayers).forEach(([brand,h])=>{if(h.setOptions)h.setOptions({radius:heatRadius});h.setDataSet({data:lastPoints[brand]||[],max:6})});if(compareHeat){if(compareHeat.setOptions)compareHeat.setOptions({radius:heatRadius});compareHeat.setDataSet({data:comparePoints,max:6})}if(currentLayer==='coverage')drawCoverage(lastCoverageData);window.__amapHeatRadius=heatRadius});
  ['#coverageMode','#coverageType','#overlapThreshold','#blindBrand','#baseBrand','#compareBrand','#compareView'].forEach(sel=>document.querySelector(sel)?.addEventListener('change',()=>{updateCoverageModeUI();refresh()}));
  async function startCompare(){
    if(currentLayer==='coverage'){document.querySelector('[data-layer="heat"]')?.click()}
    compareBrands=pickCompareBrands();
    compareMode=true;document.querySelector('.map-panel').classList.add('compare-mode');document.querySelector('#compareBtn').textContent='退出对比';map.resize();
    if(!map2){map2=new AMap.Map('amapCompare',{viewMode:'2D',zoom:map.getZoom(),center:map.getCenter(),mapStyle:'amap://styles/whitesmoke',showLabel:true});const sync=(a,b)=>{if(syncing||!b)return;syncing=true;b.setZoomAndCenter(a.getZoom(),a.getCenter(),true);setTimeout(()=>syncing=false,30)};map.on('moveend',()=>sync(map,map2));map.on('zoomend',()=>sync(map,map2));map2.on('moveend',()=>sync(map2,map));map2.on('zoomend',()=>sync(map2,map))}
    document.querySelector('.left-label').textContent=compareBrands[0];document.querySelector('.right-label').textContent=compareBrands[1];
    comparePolygons.forEach(p=>map2.remove(p));comparePolygons=[];if(compareHeat){compareHeat.hide();compareHeat=null}
    const ds=activeDistricts(),p=new URLSearchParams({brands:compareBrands[1]});if(ds.length)p.set('districts',ds.join(','));const data=await fetch('/api/dashboard?'+p).then(r=>r.json());
    Object.values(data.boundaries||{}).forEach(raw=>paths(raw).forEach(path=>{const poly=new AMap.Polygon({path,strokeColor:'#b52932',strokeWeight:1.4,strokeOpacity:.75,fillColor:'#fff0d0',fillOpacity:.07,zIndex:8});comparePolygons.push(poly);map2.add(poly)}));comparePoints=(data.stores||[]).filter(s=>s.lng&&s.lat).map(s=>({lng:s.lng,lat:s.lat,count:1}));compareHeat=new AMap.HeatMap(map2,{radius:heatRadius,opacity:[.14,.88],gradient:gradients[compareBrands[1]],zooms:[8,18]});compareHeat.setDataSet({data:comparePoints,max:6});await refresh();map.resize();map2.resize();map2.setZoomAndCenter(map.getZoom(),map.getCenter(),true);window.__amapCompareLinked={left:compareBrands[0],right:compareBrands[1],zoom:map.getZoom(),zoom2:map2.getZoom()}
  }
  function stopCompare(){compareMode=false;compareHeat=null;comparePoints=[];comparePolygons=[];document.querySelector('.map-panel').classList.remove('compare-mode');document.querySelector('#compareBtn').textContent='左右对比';if(map2){map2.destroy();map2=null;document.querySelector('#amapCompare').innerHTML=''}map.resize();refresh()}
  document.querySelector('#compareBtn')?.addEventListener('click',()=>compareMode?stopCompare():startCompare());
})();
