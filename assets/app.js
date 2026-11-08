(() => {
'use strict';
const $=id=>document.getElementById(id);
const STORE='sessiondesk_v1';
const views=['overview','clients','calendar','activity','payments','settings'];
const labels={overview:'Overview',clients:'Clients',calendar:'Calendar',activity:'Session history',payments:'Payments',settings:'Settings'};
const icon=(name,size=17)=>'<svg width="'+size+'" height="'+size+'" aria-hidden="true"><use href="#i-'+name+'"></use></svg>';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid=()=>globalThis.crypto?.randomUUID?.()||'sd-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const iso=()=>new Date().toISOString();
const dayKey=date=>{const d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const today=()=>dayKey(new Date());
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const dateLabel=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const timeLabel=d=>new Date(d).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
const longDate=d=>new Date(d).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const left=c=>Math.max(0,(Number(c.total)||0)-(Number(c.used)||0));
const initials=name=>String(name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
function normalize(raw){
 return {
  businessName:String(raw?.businessName||'').slice(0,100),
  clients:Array.isArray(raw?.clients)?raw.clients.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string').slice(0,20000):[],
  events:Array.isArray(raw?.events)?raw.events.filter(e=>e&&typeof e.clientId==='string'&&typeof e.type==='string').slice(0,5000):[],
  appointments:Array.isArray(raw?.appointments)?raw.appointments.filter(a=>a&&typeof a.id==='string'&&typeof a.startsAt==='string').slice(0,5000):[],
  settings:{industry:String(raw?.settings?.industry||'Coaching / lessons'),lowThreshold:Number.isFinite(Number(raw?.settings?.lowThreshold))?Number(raw.settings.lowThreshold):2}
 };
}
let db=normalize(null);
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved)db=normalize(saved);}catch(e){console.warn('Local data unavailable',e);}
let view='overview',query='',filter='all',activityFilter='all',selected=today(),month=new Date(new Date().getFullYear(),new Date().getMonth(),1),toastTimer,installPrompt;
const getClient=id=>db.clients.find(c=>c.id===id);
const actives=()=>db.clients.filter(c=>!c.archived);
const limit=()=>Math.min(20,Math.max(0,Number(db.settings.lowThreshold)||0));
const low=()=>actives().filter(c=>left(c)<=limit());
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800);}
function save(){if(window.sessiondeskCloud?.active){window.sessiondeskCloud.queueSave(db);}else{try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){toast('Could not save. Export a backup.');}}render();}
function log(type,c,amount=0,detail=''){db.events.unshift({id:uid(),type,clientId:c.id,clientName:c.name,amount:Number(amount)||0,detail:detail.slice(0,300),when:iso()});db.events=db.events.slice(0,5000);}
function status(c){if(c.archived)return['Archived','muted'];if(left(c)===0)return['Renew now','bad'];if(left(c)<=limit())return['Running low','warning'];return['Active',''];}
const pill=(text,kind='')=>'<span class="pill '+kind+'">'+esc(text)+'</span>';
const button=(action,label,style='')=>'<button class="btn '+style+'" type="button" data-action="'+action+'">'+label+'</button>';
function heading(tag,title,desc,actions=''){return '<section class="page-title"><div><span class="eyebrow">'+esc(tag)+'</span><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div><div class="actions">'+actions+'</div></section>';}
function card(title,subtitle,content,extra=''){return '<section class="card panel"><div class="panel-heading"><div><h2>'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+extra+'</div>'+content+'</section>';}
function empty(title,desc,action='',label=''){return '<div class="empty"><div class="empty-emoji">'+icon('package',22)+'</div><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p>'+(action?button(action,esc(label),'blue'):'')+'</div>';}
function metric(label,value,desc,ico,style=''){return '<article class="card metric '+style+'"><div class="icon-box">'+icon(ico)+'</div><div class="label">'+esc(label)+'</div><strong>'+esc(value)+'</strong><div class="meta">'+esc(desc)+'</div></article>';}
function eventText(e){const n=Number(e.amount)||0;return e.type==='session'?n+' session'+(n===1?'':'s')+' completed':e.type==='renew'?n+' sessions added':e.type==='paid'?money(n)+' payment recorded':e.type==='create'?'Client added':e.type==='edit'?'Client updated':e.type==='archive'?'Client archived':e.type==='unarchive'?'Client restored':e.type==='appointment'?'Appointment scheduled':e.type==='appointment_cancel'?'Appointment cancelled':'Record changed';}
function chart(){
 const days=[];
 for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dayKey(d);days.push({label:d.toLocaleDateString(undefined,{weekday:'short'}),count:db.events.filter(e=>e.type==='session'&&dayKey(e.when)===key).reduce((n,e)=>n+(Number(e.amount)||0),0),current:i===0});}
 const max=Math.max(1,...days.map(x=>x.count));
 return '<div class="bar-chart" role="img" aria-label="Sessions in past seven days">'+days.map(x=>'<div class="bar-slot '+(x.current?'today':'')+'"><div class="bar-area"><div class="bar" style="height:'+Math.max(2,100*x.count/max)+'%" title="'+x.count+' sessions"></div></div><span class="day">'+x.label+'</span></div>').join('')+'</div>';
}
function rows(items,kind='clients'){
 if(!items.length)return empty('All clear','Nothing to show here yet.');
 return '<div class="mini-list">'+items.map(item=>{
  const isClient=kind==='clients',name=isClient?item.name:item.clientName;
  const subtitle=isClient?(item.service||'General sessions'):eventText(item);
  const trail=isClient?pill(left(item)+' left',status(item)[1]):dateLabel(item.when);
  return '<div class="list-row"><div class="avatar">'+esc(initials(name))+'</div><div class="grow"><div class="row-title">'+esc(name)+'</div><div class="row-sub">'+esc(subtitle)+'</div></div><div class="row-trail">'+trail+'</div>'+(isClient?'<button class="link-button" data-action="detail" data-id="'+esc(item.id)+'" aria-label="Client details">'+icon('chevron',15)+'</button>':'')+'</div>';
 }).join('')+'</div>';
}
function overview(){
 const active=actives(),renewal=low(),weekstart=new Date();weekstart.setHours(0,0,0,0);weekstart.setDate(weekstart.getDate()-((weekstart.getDay()+6)%7));
 const week=db.events.filter(e=>e.type==='session'&&new Date(e.when)>=weekstart).reduce((n,e)=>n+(Number(e.amount)||0),0);
 const current=new Date();const received=db.events.filter(e=>{const d=new Date(e.when);return e.type==='paid'&&d.getMonth()===current.getMonth()&&d.getFullYear()===current.getFullYear();}).reduce((n,e)=>n+(Number(e.amount)||0),0);
 const upcoming=db.appointments.filter(a=>a.status==='scheduled'&&new Date(a.startsAt).getTime()>=Date.now()-1800000).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).slice(0,5);
 const upcomingHtml=upcoming.length?'<div class="mini-list">'+upcoming.map(a=>{const c=getClient(a.clientId);return '<div class="list-row"><div class="avatar orange">'+icon('calendar')+'</div><div class="grow"><div class="row-title">'+esc(c?.name||'Client')+'</div><div class="row-sub">'+dateLabel(a.startsAt)+' · '+timeLabel(a.startsAt)+'</div></div></div>';}).join('')+'</div>':empty('An open calendar','Add an appointment to see it here.','new-appointment','Schedule a session');
 return heading(longDate(new Date()),'Your business, in motion.',(db.businessName?db.businessName+' · ':'')+'Everything you need to stay on top of clients.',button('new-appointment',icon('calendar')+' Schedule')+button('quick-session',icon('plus')+' Log session','blue'))+
 '<div class="grid kpis">'+metric('Active clients',active.length,'Across your current roster','users')+metric('Sessions remaining',active.reduce((n,c)=>n+left(c),0),'Available package credits','package','mint')+metric('Need a renewal',renewal.length,'At '+limit()+' sessions or fewer','alert','gold')+metric('Recorded this month',money(received),'Manual payment records only','wallet','rose')+'</div>'+
 '<div class="split">'+card('Sessions this week',week+' completed since Monday',chart(),'<button class="link-button" data-view="activity">History →</button>')+card('Upcoming appointments','Your next scheduled sessions',upcomingHtml,'<button class="link-button" data-view="calendar">Calendar →</button>')+'</div>'+
 '<div class="split">'+card('Renewal watchlist','Clients running low',renewal.length?rows(renewal.slice(0,6)):empty('All caught up','No packages need renewal.'),'<button class="link-button" data-view="clients" data-filter="low">See all →</button>')+card('Recent activity','Your latest updates',db.events.length?rows(db.events.slice(0,5),'events'):empty('No activity yet','Your session history appears here.'),'<button class="link-button" data-view="activity">View all →</button>')+'</div>'+
 '<div class="notice"><strong>Your work, organized.</strong> Sessions, payments and appointments are entered manually. No client is charged automatically. '+(window.sessiondeskCloud?.active?'Cloud syncing is enabled.':'Local records stay in this browser; download backups regularly.')+'</div>';
}
function clientProgress(c){const pct=Math.round(Math.max(0,Math.min(100,left(c)/Math.max(1,Number(c.total)||1)*100)));return '<div>'+left(c)+' / '+Number(c.total||0)+'<div class="progress"><span class="'+(left(c)===0?'bad':left(c)<=limit()?'warn':'')+'" style="width:'+pct+'%"></span></div></div>';}
function clientList(){
 const list=db.clients.filter(c=>filter==='archived'?c.archived:filter==='low'?!c.archived&&left(c)<=limit():filter==='active'?!c.archived&&left(c)>limit():!c.archived).filter(c=>[c.name,c.service,c.contact].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>left(a)-left(b)||a.name.localeCompare(b.name));
 if(!list.length)return empty('No matching clients','Try another filter or add your first client.','new-client','Add client');
 const desktop='<div class="card table-wrap"><table class="table"><thead><tr><th>Client</th><th>Package balance</th><th>Status</th><th>Package value</th><th>Actions</th></tr></thead><tbody>'+list.map(c=>{const st=status(c);return '<tr><td><div class="name-cell"><div class="avatar">'+esc(initials(c.name))+'</div><div><strong>'+esc(c.name)+'</strong><small>'+esc(c.service||'General sessions')+'</small></div></div></td><td>'+clientProgress(c)+'</td><td>'+pill(st[0],st[1])+'</td><td>'+money(c.price)+'</td><td><button class="btn small" data-action="detail" data-id="'+esc(c.id)+'">Details →</button></td></tr>';}).join('')+'</tbody></table></div>';
 const mobile='<div class="client-cards">'+list.map(c=>{const st=status(c);return '<article class="card client-card"><div class="cc-top"><div class="avatar">'+esc(initials(c.name))+'</div><div class="grow"><div class="row-title">'+esc(c.name)+'</div><div class="row-sub">'+esc(c.service||'General sessions')+'</div></div>'+pill(st[0],st[1])+'</div><div class="cc-main"><div><strong>'+left(c)+'</strong><span style="font-size:11px;color:#8593a6"> / '+c.total+' left</span></div><span>'+money(c.price)+'</span></div>'+clientProgress(c)+'<div class="cc-actions"><button class="btn blue small" data-action="session" data-id="'+esc(c.id)+'" '+(c.archived||left(c)===0?'disabled':'')+'>Log session</button><button class="btn small" data-action="detail" data-id="'+esc(c.id)+'">Details →</button></div></article>';}).join('')+'</div>';
 return desktop+mobile;
}
function clients(){
 return heading('Your people','Client directory','Every package, balance and client detail in one place.',button('new-client',icon('plus')+' New client','blue'))+
 '<div class="toolbar"><div class="field-search">'+icon('search')+'<input class="input" id="clientSearch" type="search" aria-label="Search clients" placeholder="Search clients, services or contacts…" value="'+esc(query)+'"></div>'+
 '<select id="clientFilter" aria-label="Filter clients">'+[['all','All active'],['low','Need renewal'],['active','Healthy packages'],['archived','Archived']].map(([v,l])=>'<option value="'+v+'" '+(v===filter?'selected':'')+'>'+l+'</option>').join('')+'</select></div><div id="clientsResults">'+clientList()+'</div>';
}
function dayAppointments(key){return db.appointments.filter(a=>dayKey(a.startsAt)===key).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));}
function calGrid(){
 const start=new Date(month.getFullYear(),month.getMonth(),1),pad=(start.getDay()+6)%7,total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),cells=Math.ceil((pad+total)/7)*7;
 let html='<div class="cal-week">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div>'+d+'</div>').join('')+'</div><div class="cal-days">';
 for(let i=0;i<cells;i++){
  const d=i-pad+1;
  if(d<1||d>total){html+='<div class="cal-day blank" aria-hidden="true"></div>';continue;}
  const date=dayKey(new Date(month.getFullYear(),month.getMonth(),d)),n=dayAppointments(date).filter(a=>a.status!=='cancelled').length;
  html+='<button class="cal-day '+(date===selected?'selected ':'')+(date===today()?'today':'')+'" data-action="select-day" data-date="'+date+'" aria-label="'+date+' with '+n+' appointments"><span class="num">'+d+'</span><span class="dots">'+Array(Math.min(n,3)).fill('<span></span>').join('')+'</span></button>';
 }
 return html+'</div>';
}
function calendar(){
 const current=dayAppointments(selected);
 const list=current.length?'<div class="appt-list">'+current.map(a=>{const c=getClient(a.clientId);return '<div class="appt"><div class="appt-time">'+timeLabel(a.startsAt)+'</div><div class="grow"><div class="row-title">'+esc(c?.name||'Client')+'</div><div class="row-sub">'+Number(a.duration||60)+' min · '+esc(a.notes||'Session')+'</div><div style="margin-top:8px">'+pill(a.status||'scheduled',a.status==='cancelled'?'muted':'blue')+'</div></div><div class="actions">'+(a.status==='scheduled'?'<button class="btn very-small" data-action="complete-appointment" data-id="'+esc(a.id)+'" aria-label="Complete appointment">✓</button><button class="btn very-small" data-action="edit-appointment" data-id="'+esc(a.id)+'">Edit</button><button class="btn very-small danger" data-action="cancel-appointment" data-id="'+esc(a.id)+'">×</button>':'')+'</div></div>';}).join('')+'</div>':empty('Nothing scheduled','Pick another date or add a session.','new-appointment','New appointment');
 const header='<div class="calendar-head"><div><h2>'+month.toLocaleDateString(undefined,{month:'long',year:'numeric'})+'</h2><p style="font-size:11px;color:#8391a4;margin:3px 0">Select a day to view appointments</p></div><div class="actions"><button class="btn small" data-action="calendar-prev">←</button><button class="btn small" data-action="calendar-today">Today</button><button class="btn small" data-action="calendar-next">→</button></div></div>';
 return heading('Stay on schedule','Calendar','Appointments are entered manually and do not send invitations.',button('new-appointment',icon('plus')+' New appointment','blue'))+
 '<div class="calendar-layout"><section class="card panel">'+header+calGrid()+'</section>'+card(longDate(selected+'T12:00:00'),current.length+' appointments',list)+'</div>'+
 '<div class="notice" style="margin-top:18px"><strong>Calendar tip:</strong> Mark an appointment complete to deduct one prepaid session. Cancelling does not use a session.</div>';
}
function activityRows(items){
 if(!items.length)return empty('No activity yet','Add a client or record a session to start a timeline.');
 return '<div>'+items.slice(0,150).map(e=>{const d=new Date(e.when);return '<div class="entry"><div class="datebox"><strong>'+d.getDate()+'</strong><small>'+d.toLocaleDateString(undefined,{month:'short'})+'</small></div><div class="grow"><div class="row-title">'+esc(e.clientName)+'</div><div class="row-sub">'+esc(eventText(e))+(e.detail?' · '+esc(e.detail):'')+'</div></div><div class="row-trail">'+timeLabel(e.when)+'</div></div>';}).join('')+'</div>';
}
function activity(){
 const records=db.events.filter(e=>activityFilter==='all'||e.type===activityFilter);
 return heading('Your records','Session history','A searchable-friendly timeline of activity, renewals and payments.',button('quick-session',icon('plus')+' Log session','blue'))+
 '<div class="toolbar"><span style="color:#8190a4;font-size:12px">'+records.length+' activity records</span><select id="historyFilter">'+[['all','All activity'],['session','Completed sessions'],['renew','Renewals'],['paid','Payments']].map(([v,l])=>'<option value="'+v+'" '+(v===activityFilter?'selected':'')+'>'+l+'</option>').join('')+'</select></div>'+card('Activity timeline','Most recent first',activityRows(records));
}
function payments(){
 const records=db.events.filter(e=>e.type==='paid'),total=records.reduce((n,e)=>n+Number(e.amount||0),0),now=new Date(),monthSum=records.filter(e=>{const d=new Date(e.when);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((n,e)=>n+Number(e.amount||0),0);
 const content=records.length?'<div class="mini-list">'+records.slice(0,80).map(e=>'<div class="list-row"><div class="avatar green">'+icon('wallet')+'</div><div class="grow"><div class="row-title">'+esc(e.clientName)+'</div><div class="row-sub">'+dateLabel(e.when)+(e.detail?' · '+esc(e.detail):'')+'</div></div><strong>'+money(e.amount)+'</strong></div>').join('')+'</div>':empty('No payments recorded','Log a payment after receiving money from a client.','quick-payment','Record payment');
 return heading('Manual bookkeeping','Payments','Payments recorded here are not bank transfers or charges.',button('quick-payment',icon('plus')+' Record payment','blue'))+
 '<div class="grid kpis">'+metric('Recorded total',money(total),'All time','wallet')+metric('This month',money(monthSum),'Manually entered','wallet','mint')+metric('Payment entries',records.length,'All time','activity','gold')+metric('Average payment',money(records.length?total/records.length:0),'Per entry','package','rose')+'</div>'+
 card('Payment activity','Bookkeeping records only',content)+'<div class="notice" style="margin-top:17px"><strong>Important:</strong> Recording a payment does not process a transaction, issue an invoice or create a tax document.</div>';
}
function settings(){
 const form='<form id="settingsForm"><div class="form-grid"><div class="field full"><label for="businessName">Business name</label><input class="input" id="businessName" name="businessName" maxlength="100" value="'+esc(db.businessName)+'" placeholder="e.g. My Coaching Studio"></div>'+
 '<div class="field"><label for="industry">Industry</label><select id="industry" name="industry">'+['Coaching / lessons','Fitness / personal training','Pilates / wellness','Tutoring / education','Consulting / services','Other'].map(x=>'<option '+(x===db.settings.industry?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'+
 '<div class="field"><label for="lowThreshold">Renewal threshold (sessions)</label><input class="input" id="lowThreshold" name="lowThreshold" type="number" min="0" max="20" value="'+limit()+'"></div></div><div class="modal-actions"><button class="btn blue" type="submit">Save preferences</button></div></form>';
 const backup='<p style="font-size:12px;color:#8391a4;margin:0 0 12px">Keep a copy of your records even when cloud sync is enabled.</p><div class="stack">'+button('export-backup',icon('download')+' Download full backup')+button('export-csv',icon('download')+' Export clients CSV')+button('import-backup',icon('package')+' Restore backup')+button('install-app',icon('plus')+' Install app')+'</div>';
 const account='<p style="font-size:12px;color:#8190a4">Local mode saves on your device; optional cloud accounts require owner setup.</p>'+button('open-account',icon('cloud')+' Cloud account','blue');
 return heading('Make it yours','Workspace settings','Customize, back up and manage your business.')+
 '<div class="settings-layout"><div class="stack">'+card('Business profile','Shown in reminders and exports',form)+card('Account & sync','Optional cloud storage',account)+'</div><div class="stack">'+card('Data & backups','Download and restore your records',backup)+card('About SessionDesk','Built for independent professionals','<p style="font-size:12px;color:#8190a4">Version 2.0 · Client management, packages, calendar, payment logging and offline-ready workspace. Avoid storing sensitive health or financial details in this starter app.</p>')+'</div></div>';
}
const pages={overview,clients,calendar,activity,payments,settings};
function render(){
 $('appMain').innerHTML=pages[view]()+ '<footer class="app-foot"><span>© '+new Date().getFullYear()+' SessionDesk · Independent professional workspace</span><span>Local-first · '+(navigator.onLine?'Online':'Offline')+' · <a href="/help.html" target="_blank" rel="noopener">Help & data safety</a></span></footer>';
 $('breadcrumb').textContent=labels[view];document.title=labels[view]+' · SessionDesk';
 document.querySelectorAll('.nav-link').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 $('navClients').textContent=actives().length;
}
function show(viewName,newFilter=''){
 if(!views.includes(viewName))return;
 view=viewName;if(view==='clients'&&newFilter)filter=newFilter;
 $('sidebar').classList.remove('open');$('mobileShade').classList.remove('show');
 render();window.scrollTo(0,0);
}
function clientDialog(id=''){
 const c=getClient(id),f=$('clientForm');f.reset();
 for(const key of ['id','name','service','contact','total','price','notes'])f.elements[key].value=c?.[key]??(key==='total'?4:key==='price'?0:'');
 $('clientDialogTitle').textContent=c?'Edit client':'Add a client';$('clientDialog').showModal();
}
function actionDialog(type,id=''){
 const list=actives();if(!list.length)return toast('Add a client first.');
 const f=$('actionForm');f.reset();f.elements.action.value=type;
 $('actionClient').innerHTML=list.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' ('+left(c)+' left)</option>').join('');
 f.elements.id.value=list.some(c=>c.id===id)?id:list[0].id;
 $('actionCountField').hidden=type==='paid';$('actionPaymentField').hidden=type!=='paid';
 $('actionCount').required=type!=='paid';$('actionAmount').required=type==='paid';
 $('actionTitle').textContent=type==='paid'?'Record payment':type==='renew'?'Add package sessions':'Log completed session';
 $('actionSubtitle').textContent=type==='paid'?'Records money manually; no payments are processed.':'Adjust your client’s remaining package sessions.';
 $('actionCountLabel').textContent=type==='renew'?'Sessions to add':'Sessions completed';
 $('actionDialog').showModal();
}
function appointmentDialog(id=''){
 const list=actives();if(!list.length)return toast('Add an active client first.');
 const a=db.appointments.find(x=>x.id===id),f=$('appointmentForm');f.reset();
 $('apptClient').innerHTML=list.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
 f.elements.id.value=a?.id||'';
 if(a&&list.some(c=>c.id===a.clientId))f.elements.clientId.value=a.clientId;
 const dt=a?new Date(a.startsAt):new Date(selected+'T09:00:00');
 f.elements.date.value=dayKey(dt);f.elements.time.value=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
 f.elements.duration.value=a?.duration||60;f.elements.notes.value=a?.notes||'';
 $('appointmentTitle').textContent=a?'Edit appointment':'Schedule a session';$('appointmentDialog').showModal();
}
function detail(id){
 const c=getClient(id);if(!c)return;
 const st=status(c),events=db.events.filter(e=>e.clientId===id).slice(0,12);
 $('detailContent').innerHTML='<div class="detail-head"><div class="avatar">'+esc(initials(c.name))+'</div><div class="grow"><h3>'+esc(c.name)+'</h3><p>'+esc(c.service||'General sessions')+' · '+esc(c.contact||'No contact')+'</p></div>'+pill(st[0],st[1])+'</div>'+
 '<div class="detail-stats"><div class="detail-stat"><strong>'+left(c)+'</strong><small>Sessions left</small></div><div class="detail-stat"><strong>'+money(c.price)+'</strong><small>Package price</small></div><div class="detail-stat"><strong>'+money(c.collected||0)+'</strong><small>Recorded payments</small></div></div>'+
 '<div class="detail-actions"><button class="btn blue small" data-action="session" data-id="'+esc(id)+'" '+(c.archived||left(c)===0?'disabled':'')+'>Log session</button><button class="btn small" data-action="renew" data-id="'+esc(id)+'" '+(c.archived?'disabled':'')+'>Add sessions</button><button class="btn small" data-action="paid" data-id="'+esc(id)+'" '+(c.archived?'disabled':'')+'>Record payment</button><button class="btn small" data-action="edit-client" data-id="'+esc(id)+'">Edit</button></div>'+
 '<div class="detail-actions"><button class="btn small" data-action="reminder" data-id="'+esc(id)+'">Copy renewal message</button><button class="btn small '+(c.archived?'':'danger')+'" data-action="archive" data-id="'+esc(id)+'">'+(c.archived?'Restore client':'Archive client')+'</button></div>'+
 (c.notes?'<h4>Internal notes</h4><div class="detail-notes">'+esc(c.notes)+'</div>':'')+'<h4>Client history</h4>'+activityRows(events);
 $('detailDialog').showModal();
}
$('clientForm').addEventListener('submit',event=>{
 event.preventDefault();const f=event.currentTarget,id=f.elements.id.value,name=f.elements.name.value.trim(),total=Number(f.elements.total.value),price=Number(f.elements.price.value),old=getClient(id);
 if(!name||!Number.isInteger(total)||total<1||total>10000||!Number.isFinite(price)||price<0||price>10000000)return toast('Check the name, sessions and price.');
 if(old){if(total<Number(old.used||0))return toast('Total cannot be below sessions already used.');
  Object.assign(old,{name,service:f.elements.service.value.trim(),contact:f.elements.contact.value.trim(),total,price,notes:f.elements.notes.value.trim()});log('edit',old);
 }else{const c={id:uid(),name,service:f.elements.service.value.trim(),contact:f.elements.contact.value.trim(),total,used:0,price,collected:0,archived:false,notes:f.elements.notes.value.trim(),createdAt:iso()};db.clients.push(c);log('create',c);}
 $('clientDialog').close();save();toast(old?'Client updated':'Client added');
});
$('actionForm').addEventListener('submit',event=>{
 event.preventDefault();const f=event.currentTarget,c=getClient(f.elements.id.value),type=f.elements.action.value,count=Number(f.elements.count.value),amount=Number(f.elements.amount.value);
 if(!c||c.archived)return toast('Select an active client.');
 if(type==='paid'){if(!Number.isFinite(amount)||amount<=0||amount>10000000)return toast('Enter a positive amount.');c.collected=Number(c.collected||0)+amount;log('paid',c,amount,f.elements.note.value.trim());}
 else{if(!Number.isInteger(count)||count<1||count>10000)return toast('Enter a valid session count.');
  if(type==='session'&&count>left(c))return toast('Not enough sessions left. Renew first.');
  if(type==='session')c.used=Number(c.used||0)+count;
  if(type==='renew')c.total=Number(c.total||0)+count;
  log(type,c,count,f.elements.note.value.trim());
 }
 $('actionDialog').close();save();toast(type==='paid'?'Payment recorded':type==='renew'?'Package renewed':'Session logged');
});
$('appointmentForm').addEventListener('submit',event=>{
 event.preventDefault();const f=event.currentTarget,c=getClient(f.elements.clientId.value),dt=new Date(f.elements.date.value+'T'+f.elements.time.value+':00'),duration=Number(f.elements.duration.value),old=db.appointments.find(a=>a.id===f.elements.id.value);
 if(!c||c.archived||isNaN(dt)||!Number.isInteger(duration)||duration<15||duration>480)return toast('Check appointment details.');
 const fields={clientId:c.id,startsAt:dt.toISOString(),duration,notes:f.elements.notes.value.trim()};
 if(old){if(old.status!=='scheduled')return toast('This appointment can no longer be edited.');Object.assign(old,fields);}
 else{db.appointments.push({id:uid(),...fields,status:'scheduled',createdAt:iso()});log('appointment',c);}
 $('appointmentDialog').close();selected=dayKey(dt);month=new Date(dt.getFullYear(),dt.getMonth(),1);save();toast(old?'Appointment updated':'Appointment scheduled');
});
$('appMain').addEventListener('submit',event=>{
 if(event.target.id!=='settingsForm')return;event.preventDefault();
 const f=event.target;db.businessName=f.elements.businessName.value.trim();db.settings.industry=f.elements.industry.value;db.settings.lowThreshold=Math.min(20,Math.max(0,Number(f.elements.lowThreshold.value)||0));save();toast('Settings saved');
});
$('appMain').addEventListener('input',event=>{
 if(event.target.id!=='clientSearch')return;
 query=event.target.value;$('clientsResults').innerHTML=clientList();
});
$('appMain').addEventListener('change',event=>{
 if(event.target.id==='clientFilter'){filter=event.target.value;render();}
 if(event.target.id==='historyFilter'){activityFilter=event.target.value;render();}
});
const download=(file,text,mime)=>{const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);};
function exportBackup(){download('sessiondesk-'+today()+'.json',JSON.stringify({version:2,exportedAt:iso(),...db},null,2),'application/json');toast('Backup downloaded');}
function exportCsv(){const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const rows=[['Name','Service','Contact','Sessions Total','Used','Remaining','Package USD','Payments Recorded USD','Archived','Notes']];db.clients.forEach(c=>rows.push([c.name,c.service,c.contact,c.total,c.used,left(c),c.price,c.collected||0,c.archived?'Yes':'No',c.notes]));download('sessiondesk-clients-'+today()+'.csv','\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('CSV downloaded');}
$('importFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{if(file.size>5*1024*1024)throw new Error('File too large');
  const raw=JSON.parse(await file.text());if(!Array.isArray(raw.clients)||!Array.isArray(raw.events))throw new Error('Not a SessionDesk backup');
  if(!confirm('Replace your existing records with this backup? Export a backup first.'))return;
  db=normalize(raw);save();toast('Backup restored');
 }catch(e){toast('Restore failed: '+e.message);}finally{event.target.value='';}
});
async function reminder(id){
 const c=getClient(id);if(!c)return;
 const text='Hi '+c.name.split(' ')[0]+', quick update from '+(db.businessName||'your coach')+': you have '+left(c)+' session(s) remaining in your package. Would you like to schedule or renew?';
 try{await navigator.clipboard.writeText(text);toast('Reminder copied');}catch(e){toast('Clipboard permission unavailable');}
}
function action(name,id,buttonEl){
 if(name==='new-client')return clientDialog();
 if(name==='edit-client'){$('detailDialog').close();return clientDialog(id);}
 if(name==='detail')return detail(id);
 if(['session','renew','paid'].includes(name)){$('detailDialog').close();return actionDialog(name,id);}
 if(name==='quick-session')return actionDialog('session');
 if(name==='quick-payment')return actionDialog('paid');
 if(name==='new-appointment')return appointmentDialog();
 if(name==='edit-appointment')return appointmentDialog(id);
 if(name==='select-day'){selected=buttonEl.dataset.date;return render();}
 if(name==='calendar-prev'||name==='calendar-next'){month=new Date(month.getFullYear(),month.getMonth()+(name==='calendar-next'?1:-1),1);selected=dayKey(month);return render();}
 if(name==='calendar-today'){month=new Date(new Date().getFullYear(),new Date().getMonth(),1);selected=today();return render();}
 if(name==='cancel-appointment'){const a=db.appointments.find(x=>x.id===id);if(!a||a.status!=='scheduled'||!confirm('Cancel this appointment?'))return;a.status='cancelled';const c=getClient(a.clientId);if(c)log('appointment_cancel',c);save();return toast('Appointment cancelled');}
 if(name==='complete-appointment'){
  const a=db.appointments.find(x=>x.id===id),c=getClient(a?.clientId);
  if(!a||a.status!=='scheduled')return;
  if(!c||c.archived||left(c)<1)return toast('This client needs an active package with at least one session.');
  if(!confirm('Mark appointment complete and deduct one session for '+c.name+'?'))return;
  a.status='completed';a.completedAt=iso();c.used=Number(c.used||0)+1;log('session',c,1,'From calendar appointment');save();return toast('Session deducted');
 }
 if(name==='reminder')return reminder(id);
 if(name==='archive'){const c=getClient(id);if(!c)return;if(!c.archived&&!confirm('Archive '+c.name+'? History will stay available.'))return;c.archived=!c.archived;log(c.archived?'archive':'unarchive',c);$('detailDialog').close();save();return toast(c.archived?'Client archived':'Client restored');}
 if(name==='export-backup')return exportBackup();
 if(name==='export-csv')return exportCsv();
 if(name==='import-backup')return $('importFile').click();
 if(name==='open-account')return $('accountDialog').showModal();
 if(name==='install-app'){if(installPrompt){installPrompt.prompt();installPrompt=null;}else toast('Use your browser menu → Add to Home Screen / Install app.');}
}
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-close]');if(close){$(close.dataset.close)?.close();return;}
 const nav=event.target.closest('[data-view]');if(nav){show(nav.dataset.view,nav.dataset.filter||'');return;}
 const a=event.target.closest('[data-action]');if(a)action(a.dataset.action,a.dataset.id||'',a);
});
$('menuToggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('mobileShade').classList.toggle('show');});
$('mobileShade').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('mobileShade').classList.remove('show');});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.sessiondeskBridge={read:()=>JSON.parse(JSON.stringify(db)),set:raw=>{db=normalize(raw);render();}};
render();
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(console.warn));
})();