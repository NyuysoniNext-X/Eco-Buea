import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PORT = process.env.PORT || 3000;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.csv':'text/csv; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' };

async function loadDb(){ const db=JSON.parse(await readFile(DB_PATH,'utf8')); for(const k of ['users','pickups','smartBins','materials','notifications','sessions','uploads','invoices','transactions','reviews','reports']) db[k] ||= []; return db; }
async function saveDb(db){ await writeFile(DB_PATH, JSON.stringify(db,null,2)); }
function send(res,status,data,type='application/json; charset=utf-8'){ res.writeHead(status,{ 'Content-Type':type, 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization' }); res.end(type.includes('json') ? JSON.stringify(data) : data); }
function publicUser(user){ if(!user) return null; const { password, ...safe } = user; return safe; }
function token(){ return crypto.randomBytes(32).toString('hex'); }
function authUser(req,db){ const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):''; const s=db.sessions.find(x=>x.token===t && (!x.expiresAt || new Date(x.expiresAt)>new Date())); return s ? db.users.find(u=>u.id===s.userId) : null; }
function createSession(db,user){ const session={ token:token(), userId:user.id, createdAt:new Date().toISOString(), expiresAt:new Date(Date.now()+1000*60*60*24*7).toISOString() }; db.sessions.push(session); return session.token; }
function requireRole(req,res,db,roles=[]){ const user=authUser(req,db); if(!user){ send(res,401,{error:'Authentication required'}); return null; } if(roles.length && !roles.includes(user.role)){ send(res,403,{error:'Not allowed for this role', required:roles, actual:user.role}); return null; } return user; }
function readBody(req){ return new Promise((resolve,reject)=>{ let body=''; req.on('data',c=>body+=c); req.on('end',()=>{ if(!body) return resolve({}); try{resolve(JSON.parse(body))}catch(e){reject(e)} }); }); }
function csv(rows){ if(!rows.length) return ''; const keys=Object.keys(rows[0]); return [keys.join(','), ...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(','))].join('\n'); }

async function serveStatic(req,res){ const url=new URL(req.url,`http://${req.headers.host}`); let pathname=decodeURIComponent(url.pathname); if(pathname==='/') pathname='/index.html'; const safePath=path.normalize(pathname).replace(/^\.\.(\/|\\|$)/,''); const filePath=path.join(__dirname,safePath); if(!filePath.startsWith(__dirname)) return send(res,403,'Forbidden','text/plain'); try{ const info=await stat(filePath); if(!info.isFile()) throw new Error('Not file'); res.writeHead(200,{ 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' }); createReadStream(filePath).pipe(res); }catch{ send(res,404,'Not found','text/plain'); } }

function liveLocations(db){
  return {
    generatedAt:new Date().toISOString(),
    center:{lat:4.1536,lng:9.2666},
    pickups:db.pickups.map(p=>({id:p.id,type:'pickup',status:p.status,wasteType:p.wasteType,quantityKg:p.quantityKg,neighborhood:p.neighborhood,address:p.address,location:p.location||{lat:4.1536,lng:9.2666}})),
    smartBins:db.smartBins.map(b=>({id:b.id,type:'smartBin',fillPercentage:b.fillPercentage,weightKg:b.weightKg,wasteType:b.type,neighborhood:b.neighborhood,location:b.location||{lat:4.1536,lng:9.2666}})),
    collectors:(db.collectors||[]).map(c=>({id:c.id,type:'collector',name:c.name,status:c.status,vehicle:c.vehicle,rating:c.rating,location:c.location||{lat:4.1536,lng:9.2666}}))
  };
}
function neighborhoodLocation(name){ const m={Molyko:[4.1596,9.2897],'Small Soppo':[4.1532,9.2698],Bonduma:[4.1488,9.2778],Bomaka:[4.1664,9.2527],Checkpoint:[4.1501,9.2418],'Buea Town':[4.1527,9.2341],'Great Soppo':[4.1442,9.2642]}; const v=m[name]||m.Molyko; return {lat:v[0]+(Math.random()-.5)*.006,lng:v[1]+(Math.random()-.5)*.006}; }
function jitterLocation(loc, i=0){ const t=Date.now()/10000+i; return {lat:Number((loc.lat + Math.sin(t)*0.0018).toFixed(6)), lng:Number((loc.lng + Math.cos(t)*0.0018).toFixed(6))}; }

async function handleApi(req,res){
  const url=new URL(req.url,`http://${req.headers.host}`); const parts=url.pathname.split('/').filter(Boolean); const db=await loadDb();
  if(req.method==='OPTIONS') return send(res,204,{});
  if(url.pathname==='/api/health') return send(res,200,{ok:true,service:'EcoCycle Buea Node API',firebase:false,supabase:false,features:['signup','login','sessions','rbac','photo-upload','otp-completion','invoices','csv-reports','smart-bin-auto-pickups']});
  if(req.method==='GET' && url.pathname==='/api/locations') return send(res,200,liveLocations(db));
  if(req.method==='GET' && url.pathname==='/api/locations/stream'){
    res.writeHead(200,{ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive', 'Access-Control-Allow-Origin':'*' });
    let tick=0;
    const push=()=>{
      const payload=liveLocations(db);
      payload.collectors=payload.collectors.map((c,i)=>({...c,location:jitterLocation(c.location,i+tick)}));
      res.write(`event: locations\ndata: ${JSON.stringify(payload)}\n\n`);
      tick++;
    };
    push(); const timer=setInterval(push,2500); req.on('close',()=>clearInterval(timer)); return;
  }


  // Auth
  if(req.method==='POST' && url.pathname==='/api/auth/signup'){
    const b=await readBody(req); if(!b.email && !b.phone) return send(res,400,{error:'Email or phone is required'});
    if(db.users.find(u=>u.email===b.email || u.phone===b.phone)) return send(res,409,{error:'User already exists'});
    const user={ id:`USR-${Date.now().toString().slice(-6)}`, name:b.name||'New User', email:b.email||'', phone:b.phone||'', role:b.role||'household', neighborhood:b.neighborhood||'Molyko', ecoCoinsBalance:0, verified:b.role==='collector'?false:true, idVerification:b.idVerification||'', vehicleInfo:b.vehicleInfo||'', licenseNumber:b.licenseNumber||'', password:b.password||'', createdAt:new Date().toISOString() };
    db.users.push(user); const sessionToken=createSession(db,user); await saveDb(db); return send(res,201,{user:publicUser(user),token:sessionToken});
  }
  if(req.method==='POST' && url.pathname==='/api/auth/login'){
    const b=await readBody(req); const login=b.emailOrPhone||b.email||b.phone||''; const user=db.users.find(u=>(u.email===login||u.phone===login)&&(!u.password||u.password===b.password));
    if(!user) return send(res,401,{error:'Invalid credentials'}); user.lastLoginAt=new Date().toISOString(); const sessionToken=createSession(db,user); await saveDb(db); return send(res,200,{user:publicUser(user),token:sessionToken});
  }
  if(req.method==='GET' && url.pathname==='/api/auth/me') return send(res,200,{user:publicUser(authUser(req,db))});
  if(req.method==='POST' && url.pathname==='/api/auth/logout'){ const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):''; db.sessions=db.sessions.filter(s=>s.token!==t); await saveDb(db); return send(res,200,{ok:true}); }

  // Users/admin
  if(req.method==='GET' && url.pathname==='/api/users'){ const u=requireRole(req,res,db,['admin','government']); if(!u) return; return send(res,200,db.users.map(publicUser)); }
  if(req.method==='PATCH' && parts[0]==='api' && parts[1]==='users' && parts[3]==='verify'){ const u=requireRole(req,res,db,['admin']); if(!u) return; const target=db.users.find(x=>x.id===parts[2]); if(!target) return send(res,404,{error:'User not found'}); target.verified=true; await saveDb(db); return send(res,200,publicUser(target)); }

  // Pickups
  if(req.method==='GET' && url.pathname==='/api/pickups') return send(res,200,db.pickups);
  if(req.method==='POST' && url.pathname==='/api/pickups'){
    const b=await readBody(req); const user=authUser(req,db);
    const pickup={ id:`PU-${Date.now().toString().slice(-5)}`, requesterId:user?.id||b.requesterId||null, requester:user?.name||b.requester||'Demo User', wasteType:b.wasteType||'Plastic', quantityKg:Number(b.quantityKg||1), neighborhood:b.neighborhood||'Molyko', address:b.address||'', preferredTime:b.preferredTime||null, photos:b.photos||[], location:b.location||neighborhoodLocation(b.neighborhood||'Molyko'), status:'pending', ecoCoinsAwarded:0, createdAt:new Date().toISOString() };
    db.pickups.unshift(pickup); db.notifications.unshift({id:`NT-${Date.now()}`,title:'Pickup Created',message:`${pickup.id} created in ${pickup.neighborhood}`,channel:'in_app',read:false,createdAt:new Date().toISOString()}); await saveDb(db); return send(res,201,pickup);
  }
  if(req.method==='PATCH' && parts[0]==='api' && parts[1]==='pickups' && parts[3]==='accept'){
    const user=authUser(req,db); const pickup=db.pickups.find(p=>p.id===parts[2]); if(!pickup) return send(res,404,{error:'Pickup not found'});
    pickup.status='accepted'; pickup.collectorId=user?.id||'COL-DEMO'; pickup.otpCode=String(Math.floor(1000+Math.random()*9000)); pickup.acceptedAt=new Date().toISOString();
    db.notifications.unshift({id:`NT-${Date.now()}`,title:'Pickup Accepted',message:`${pickup.id} accepted. Completion OTP: ${pickup.otpCode}`,channel:'in_app',read:false,createdAt:new Date().toISOString()}); await saveDb(db); return send(res,200,pickup);
  }
  if(req.method==='PATCH' && parts[0]==='api' && parts[1]==='pickups' && parts[3]==='complete'){
    const b=await readBody(req); const pickup=db.pickups.find(p=>p.id===parts[2]); if(!pickup) return send(res,404,{error:'Pickup not found'});
    if(pickup.otpCode && b.otpCode!==pickup.otpCode) return send(res,400,{error:'Invalid OTP'});
    pickup.status='completed'; pickup.completionPhoto=b.photo||pickup.completionPhoto||null; pickup.completedAt=new Date().toISOString(); pickup.ecoCoinsAwarded=pickup.ecoCoinsAwarded||Math.max(25,Math.round(pickup.quantityKg*3));
    const owner=db.users.find(u=>u.id===pickup.requesterId); if(owner) owner.ecoCoinsBalance=(owner.ecoCoinsBalance||0)+pickup.ecoCoinsAwarded;
    db.transactions.push({id:`TR-${Date.now()}`,userId:pickup.requesterId,type:'eco_coins_award',points:pickup.ecoCoinsAwarded,pickupId:pickup.id,createdAt:new Date().toISOString()}); await saveDb(db); return send(res,200,pickup);
  }

  // Uploads (base64/data URL for dependency-free demo)
  if(req.method==='POST' && url.pathname==='/api/uploads'){
    const b=await readBody(req); if(!b.dataUrl) return send(res,400,{error:'dataUrl is required'}); const upload={id:`UP-${Date.now()}`,fileName:b.fileName||'photo',mimeType:b.mimeType||'image/jpeg',dataUrl:b.dataUrl,pickupId:b.pickupId||null,createdAt:new Date().toISOString()}; db.uploads.push(upload); await saveDb(db); return send(res,201,upload);
  }
  if(req.method==='GET' && url.pathname==='/api/uploads') return send(res,200,db.uploads.map(u=>({...u,dataUrl:u.dataUrl?.slice(0,64)+'...'})));

  // Smart bins + auto pickup at >=80%
  if(req.method==='GET' && url.pathname==='/api/smart-bins') return send(res,200,db.smartBins);
  if(req.method==='PATCH' && parts[0]==='api' && parts[1]==='smart-bins'){
    const b=await readBody(req); const bin=db.smartBins.find(x=>x.id===parts[2]); if(!bin) return send(res,404,{error:'Bin not found'}); Object.assign(bin,b,{lastSyncedAt:new Date().toISOString()});
    if(Number(bin.fillPercentage)>=80 && !db.pickups.find(p=>p.smartBinId===bin.id && p.status!=='completed')) db.pickups.unshift({id:`PU-BIN-${Date.now().toString().slice(-5)}`,smartBinId:bin.id,requester:'Smart Bin System',wasteType:bin.type||'Mixed',quantityKg:bin.weightKg||1,neighborhood:bin.neighborhood,address:`Smart bin ${bin.id}`,status:'pending',ecoCoinsAwarded:0,createdAt:new Date().toISOString()});
    await saveDb(db); return send(res,200,bin);
  }

  // Materials marketplace
  if(req.method==='GET' && url.pathname==='/api/materials') return send(res,200,db.materials);
  if(req.method==='POST' && parts[0]==='api' && parts[1]==='materials' && parts[3]==='bids'){
    const b=await readBody(req); const mat=db.materials.find(m=>m.id===parts[2]); if(!mat) return send(res,404,{error:'Material not found'}); mat.bids ||= []; const bid={id:`BID-${Date.now()}`,amount:Number(b.amount||0),recyclerId:authUser(req,db)?.id||'REC-DEMO',createdAt:new Date().toISOString()}; mat.bids.push(bid); await saveDb(db); return send(res,201,bid);
  }

  // Invoices
  if(req.method==='GET' && url.pathname==='/api/invoices') return send(res,200,db.invoices);
  if(req.method==='POST' && url.pathname==='/api/invoices'){
    const b=await readBody(req); const pickup=db.pickups.find(p=>p.id===b.pickupId); const amount=Number(b.amount||((pickup?.quantityKg||1)*75)); const invoice={id:`INV-${Date.now().toString().slice(-6)}`,pickupId:b.pickupId||null,businessName:b.businessName||pickup?.requester||'EcoCycle Client',amount,currency:'XAF',status:'unpaid',lineItems:b.lineItems||[{description:'Waste collection service',quantity:pickup?.quantityKg||1,unitPrice:75,total:amount}],createdAt:new Date().toISOString()}; db.invoices.unshift(invoice); await saveDb(db); return send(res,201,invoice);
  }
  if(req.method==='GET' && parts[0]==='api' && parts[1]==='invoices' && parts[3]==='html'){
    const inv=db.invoices.find(i=>i.id===parts[2]); if(!inv) return send(res,404,'Invoice not found','text/plain'); const html=`<!doctype html><title>${inv.id}</title><style>body{font-family:Arial;padding:32px}h1{color:#1B5E20}.box{border:1px solid #ddd;border-radius:16px;padding:18px}</style><h1>EcoCycle Buea Invoice</h1><div class="box"><b>${inv.id}</b><p>Client: ${inv.businessName}</p><p>Status: ${inv.status}</p><p>Total: ${inv.amount} ${inv.currency}</p><p>Date: ${inv.createdAt}</p></div><script>window.print()</script>`; return send(res,200,html,'text/html; charset=utf-8');
  }

  // Reports/analytics
  if(req.method==='GET' && url.pathname==='/api/notifications') return send(res,200,db.notifications);
  if(req.method==='POST' && url.pathname==='/api/notifications'){ const b=await readBody(req); const n={id:`NT-${Date.now()}`,title:b.title||'Notification',message:b.message||'',channel:b.channel||'in_app',read:false,createdAt:new Date().toISOString()}; db.notifications.unshift(n); await saveDb(db); return send(res,201,n); }
  if(req.method==='GET' && url.pathname==='/api/analytics'){
    const totalKg=db.pickups.reduce((s,p)=>s+Number(p.quantityKg||0),0); return send(res,200,{totalKg,completedPickups:db.pickups.filter(p=>p.status==='completed').length,pendingPickups:db.pickups.filter(p=>p.status==='pending').length,recyclingRate:47,co2SavedKg:Math.round(totalKg*.68),smartBinAlerts:db.smartBins.filter(b=>b.fillPercentage>=80).length,jobsCreated:34});
  }
  if(req.method==='GET' && url.pathname==='/api/reports/monthly.json') return send(res,200,{generatedAt:new Date().toISOString(),pickups:db.pickups,smartBins:db.smartBins,materials:db.materials});
  if(req.method==='GET' && url.pathname==='/api/reports/monthly.csv') return send(res,200,csv(db.pickups),'text/csv; charset=utf-8');

  return send(res,404,{error:'API route not found'});
}

const server=http.createServer(async(req,res)=>{ try{ if(req.url.startsWith('/api/')) return await handleApi(req,res); return await serveStatic(req,res); }catch(error){ console.error(error); send(res,500,{error:'Internal server error',detail:error.message}); } });
server.listen(PORT,()=>{ console.log(`EcoCycle Buea running on http://localhost:${PORT}`); console.log('Direct Node.js backend active — no Firebase/Supabase required.'); });
