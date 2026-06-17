/* EcoCycle live maps: no API key required. Uses Leaflet + OSM when online, and a live CSS fallback when offline. */
const BUEA_CENTER = { lat: 4.1536, lng: 9.2666 };
const BOUNDS = { minLat: 4.135, maxLat: 4.175, minLng: 9.225, maxLng: 9.300 };
let liveMapState = { map: null, leaflet: false, markers: {}, fallbackRoot: null, last: null, userMarker: null };

function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
function loadCss(href){const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
async function tryLeaflet(){
  if(window.L) return true;
  try{loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'); await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'); return !!window.L}catch{return false}
}
function project(loc){
  const x=((loc.lng-BOUNDS.minLng)/(BOUNDS.maxLng-BOUNDS.minLng))*100;
  const y=(1-((loc.lat-BOUNDS.minLat)/(BOUNDS.maxLat-BOUNDS.minLat)))*100;
  return {x:Math.max(2,Math.min(98,x)),y:Math.max(2,Math.min(98,y))};
}
function markerIcon(item){return item.type==='collector'?'🚛':item.type==='smartBin'?'🗑️':'📍'}
function markerClass(item){return item.type==='collector'?'collector':item.type==='smartBin'?(item.fillPercentage>=80?'bin alert':'bin'):'pickup'}
function itemTitle(item){
  if(item.type==='collector') return `${item.name} · ${item.vehicle} · ${item.status}`;
  if(item.type==='smartBin') return `${item.id} · ${item.neighborhood} · ${item.fillPercentage}% full`;
  return `${item.id} · ${item.wasteType} · ${item.status} · ${item.neighborhood}`;
}
function allItems(data){return [...(data.pickups||[]),...(data.smartBins||[]),...(data.collectors||[])]}
async function fetchLocations(){return await api('/api/locations') || {center:BUEA_CENTER,pickups:[],smartBins:[],collectors:[]}}
function initFallback(el){
  el.innerHTML = `<div class="live-fallback"><div class="fallback-grid"></div><div class="fallback-label">Buea Live Map · OSM fallback mode</div></div>`;
  liveMapState.fallbackRoot = el.querySelector('.live-fallback');
}
function renderFallback(data){
  const root=liveMapState.fallbackRoot; if(!root) return;
  root.querySelectorAll('.live-dot').forEach(x=>x.remove());
  allItems(data).forEach(item=>{const pos=project(item.location||BUEA_CENTER); const d=document.createElement('button'); d.className=`live-dot ${markerClass(item)}`; d.style.left=pos.x+'%'; d.style.top=pos.y+'%'; d.title=itemTitle(item); d.innerHTML=markerIcon(item); d.onclick=()=>showMapInfo(item); root.appendChild(d)});
}
function showMapInfo(item){const box=document.getElementById('mapInfo'); if(!box)return; box.innerHTML=`<b>${itemTitle(item)}</b><p class="muted" style="margin:4px 0">Lat: ${item.location?.lat} · Lng: ${item.location?.lng}</p>${item.type==='pickup'?`<p>Status: ${item.status} · ${item.quantityKg} kg</p>`:''}${item.type==='smartBin'?`<p>Weight: ${item.weightKg} kg · ${item.fillPercentage>=80?'Auto pickup needed':'Normal'}</p>`:''}`}
function upsertLeafletMarker(item){
  const L=window.L, id=item.type+'-'+item.id, loc=item.location||BUEA_CENTER;
  const html=`<div class="leaflet-emoji ${markerClass(item)}">${markerIcon(item)}</div>`;
  const icon=L.divIcon({html,className:'eco-marker',iconSize:[34,34],iconAnchor:[17,17]});
  if(liveMapState.markers[id]) liveMapState.markers[id].setLatLng([loc.lat,loc.lng]).setIcon(icon).bindPopup(itemTitle(item));
  else liveMapState.markers[id]=L.marker([loc.lat,loc.lng],{icon}).addTo(liveMapState.map).bindPopup(itemTitle(item)).on('click',()=>showMapInfo(item));
}
function renderLeaflet(data){allItems(data).forEach(upsertLeafletMarker)}
function renderLiveMap(data){liveMapState.last=data; if(liveMapState.leaflet) renderLeaflet(data); else renderFallback(data); updateStats(data)}
function updateStats(data){const el=document.getElementById('mapStats'); if(!el)return; const alerts=(data.smartBins||[]).filter(b=>b.fillPercentage>=80).length; el.innerHTML=`<div class="metric"><span>Pickups</span><b>${data.pickups?.length||0}</b><p class="muted">Live requests</p></div><div class="metric"><span>Collectors</span><b>${data.collectors?.length||0}</b><p class="muted">Moving markers</p></div><div class="metric"><span>Bin Alerts</span><b>${alerts}</b><p class="muted">80%+ full</p></div><div class="metric"><span>Updated</span><b>${new Date().toLocaleTimeString()}</b><p class="muted">Real-time stream</p></div>`}
async function initLiveMap(){
  const el=document.getElementById('liveMap'); if(!el)return;
  const ok=await tryLeaflet();
  if(ok){ liveMapState.leaflet=true; liveMapState.map=L.map(el).setView([BUEA_CENTER.lat,BUEA_CENTER.lng],14); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(liveMapState.map); }
  else initFallback(el);
  const first=await fetchLocations(); renderLiveMap(first);
  if(window.EventSource){ const es=new EventSource('/api/locations/stream'); es.addEventListener('locations',e=>renderLiveMap(JSON.parse(e.data))); es.onerror=()=>setInterval(async()=>renderLiveMap(await fetchLocations()),5000); }
  else setInterval(async()=>renderLiveMap(await fetchLocations()),5000);
}
function locateMe(){
  if(!navigator.geolocation) return toast('Geolocation is not supported by this browser');
  navigator.geolocation.watchPosition(pos=>{
    const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
    if(liveMapState.leaflet){ const L=window.L; if(!liveMapState.userMarker) liveMapState.userMarker=L.marker([loc.lat,loc.lng],{icon:L.divIcon({html:'<div class="leaflet-emoji user">📱</div>',className:'eco-marker',iconSize:[34,34]})}).addTo(liveMapState.map).bindPopup('Your live location'); else liveMapState.userMarker.setLatLng([loc.lat,loc.lng]); liveMapState.map.setView([loc.lat,loc.lng],15); }
    else{ const data=liveMapState.last||{pickups:[],smartBins:[],collectors:[]}; data.collectors=[...(data.collectors||[]),{id:'YOU',type:'collector',name:'Your live location',vehicle:'Phone GPS',status:'online',location:loc}]; renderFallback(data); }
  }, err=>toast('Location permission denied or unavailable: '+err.message), {enableHighAccuracy:true,maximumAge:5000,timeout:10000});
}
document.addEventListener('DOMContentLoaded',initLiveMap);
