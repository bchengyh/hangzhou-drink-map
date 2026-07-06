(async function(){
  const cfg=await fetch('/api/client-config').then(r=>r.json()).catch(()=>({}));
  if(!cfg.key||!cfg.security)return;
  window._AMapSecurityConfig={securityJsCode:cfg.security};
  const loaded=await new Promise(resolve=>{const s=document.createElement('script');s.src=`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.key)}&plugin=AMap.HeatMap,AMap.MassMarks`;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s)});
  if(!loaded||!window.AMap)return;
  const map=new AMap.Map('amapBase',{viewMode:'2D',zoom:10,center:[120.15,30.27],mapStyle:'amap://styles/whitesmoke',showLabel:true});
  let heatLayers={},massLayers={},polygons=[],lastPoints={},heatRadius=17,currentLayer='heat',fittedOnce=false,compareMode=false,map2=null,compareHeat=null,comparePoints=[],syncing=false;
  const gradients={"瑞幸咖啡":{.10:'#b8f4fa',.35:'#62d9f4',.58:'#2d9df0',.78:'#2859d9',1:'#32168f'},"蜜雪冰城":{.10:'#fff3a6',.35:'#ffd35c',.58:'#ff963f',.78:'#ef4b32',1:'#c91424'}};
  document.querySelector('.map-panel').classList.add('amap-ready');
  function paths(raw){return String(raw||'').split('|').map(part=>part.split(';').map(p=>p.split(',').map(Number)).filter(p=>p.length===2&&!p.some(isNaN))).filter(p=>p.length>2)}
  function activeDistricts(){const names=['上城','拱墅','西湖','滨江','萧山','余杭','临平','钱塘'];return [...document.querySelectorAll('#districtFilters .chip')].filter(x=>x.classList.contains('active')).map(x=>names.includes(x.textContent)?x.textContent+'区':x.textContent)}
  function activeBrands(){return [...document.querySelectorAll('#brandFilters input:checked')].map(x=>x.parentElement.textContent.trim())}
  async function refresh(){const p=new URLSearchParams(),ds=activeDistricts(),bs=activeBrands();if(ds.length)p.set('districts',ds.join(','));p.set('brands',compareMode?'瑞幸咖啡':(bs.length?bs.join(','):'__none__'));const data=await fetch('/api/dashboard?'+p).then(r=>r.json());draw(data)}
  function setLayer(type){currentLayer=type;Object.values(heatLayers).forEach(x=>type==='heat'?x.show():x.hide());Object.values(massLayers).forEach(x=>type==='point'?x.show():x.hide())}
  function draw(data){
    polygons.forEach(p=>map.remove(p));polygons=[];
    Object.values(data.boundaries||{}).forEach(raw=>paths(raw).forEach(path=>{const p=new AMap.Polygon({path,strokeColor:'#245797',strokeWeight:1.5,strokeOpacity:.8,fillColor:'#d9ecff',fillOpacity:.08,zIndex:8});polygons.push(p);map.add(p)}));
    Object.values(heatLayers).forEach(x=>x.hide());Object.values(massLayers).forEach(x=>x.setMap(null));heatLayers={};massLayers={};lastPoints={};
    ['瑞幸咖啡','蜜雪冰城'].forEach((brand,index)=>{const stores=(data.stores||[]).filter(s=>s.brand===brand&&s.lng&&s.lat),pts=stores.map(s=>({lng:s.lng,lat:s.lat,count:1}));if(!pts.length)return;lastPoints[brand]=pts;const h=new AMap.HeatMap(map,{radius:heatRadius,opacity:[.14,.88],gradient:gradients[brand],zooms:[8,18]});h.setDataSet({data:pts,max:6});heatLayers[brand]=h;const m=new AMap.MassMarks(stores.map(s=>({lnglat:[s.lng,s.lat],name:s.name,address:s.address,brand:s.brand})),{zIndex:120+index,opacity:.58,zooms:[8,20],style:{url:`https://a.amap.com/jsapi_demos/static/images/mass${index}.png`,anchor:new AMap.Pixel(5,5),size:new AMap.Size(9,9)}});m.setMap(map);massLayers[brand]=m});setLayer(currentLayer);
    if(polygons.length&&!fittedOnce){map.setFitView(polygons,false,[42,42,145,42]);fittedOnce=true}
  }
  await refresh();
  document.addEventListener('click',e=>{if(e.target.closest('#districtFilters')||e.target.closest('#brandFilters'))setTimeout(refresh,250);const layer=e.target.closest('[data-layer]');if(layer)setLayer(layer.dataset.layer)});
  const ruler=document.querySelector('#ruler');
  ruler?.addEventListener('input',()=>{if(!document.querySelector('[data-mode="radius"]')?.classList.contains('active'))return;heatRadius=Math.round(6+(+ruler.value*.55));Object.entries(heatLayers).forEach(([brand,h])=>{if(h.setOptions)h.setOptions({radius:heatRadius});h.setDataSet({data:lastPoints[brand]||[],max:6})});if(compareHeat){if(compareHeat.setOptions)compareHeat.setOptions({radius:heatRadius});compareHeat.setDataSet({data:comparePoints,max:6})}window.__amapHeatRadius=heatRadius});
  async function startCompare(){
    compareMode=true;document.querySelector('.map-panel').classList.add('compare-mode');document.querySelector('#compareBtn').textContent='退出对比';map.resize();
    if(!map2){map2=new AMap.Map('amapCompare',{viewMode:'2D',zoom:map.getZoom(),center:map.getCenter(),mapStyle:'amap://styles/whitesmoke',showLabel:true});const sync=(a,b)=>{if(syncing||!b)return;syncing=true;b.setZoomAndCenter(a.getZoom(),a.getCenter(),true);setTimeout(()=>syncing=false,30)};map.on('moveend',()=>sync(map,map2));map.on('zoomend',()=>sync(map,map2));map2.on('moveend',()=>sync(map2,map));map2.on('zoomend',()=>sync(map2,map))}
    const ds=activeDistricts(),p=new URLSearchParams({brands:'蜜雪冰城'});if(ds.length)p.set('districts',ds.join(','));const data=await fetch('/api/dashboard?'+p).then(r=>r.json());
    Object.values(data.boundaries||{}).forEach(raw=>paths(raw).forEach(path=>map2.add(new AMap.Polygon({path,strokeColor:'#b52932',strokeWeight:1.4,strokeOpacity:.75,fillColor:'#fff0d0',fillOpacity:.07,zIndex:8}))));comparePoints=(data.stores||[]).filter(s=>s.lng&&s.lat).map(s=>({lng:s.lng,lat:s.lat,count:1}));compareHeat=new AMap.HeatMap(map2,{radius:heatRadius,opacity:[.14,.88],gradient:gradients['蜜雪冰城'],zooms:[8,18]});compareHeat.setDataSet({data:comparePoints,max:6});await refresh();map.resize();map2.resize();map2.setZoomAndCenter(map.getZoom(),map.getCenter(),true)
  }
  function stopCompare(){compareMode=false;compareHeat=null;comparePoints=[];document.querySelector('.map-panel').classList.remove('compare-mode');document.querySelector('#compareBtn').textContent='左右对比';if(map2){map2.destroy();map2=null;document.querySelector('#amapCompare').innerHTML=''}map.resize();refresh()}
  document.querySelector('#compareBtn')?.addEventListener('click',()=>compareMode?stopCompare():startCompare());
})();
