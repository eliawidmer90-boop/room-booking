const roomPanel = document.getElementById('room-panel');
const $ = selector => roomPanel.querySelector(selector) || document.querySelector(selector);
const $$ = selector => [...roomPanel.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zone = 'Africa/Windhoek';
const storageKey = 'kavango-room-booking-access-v1';
const dateParts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const dayOf = value => { const p=dateParts(value);return `${p.year}-${p.month}-${p.day}`; };
const dayStart = date => Date.parse(`${date}T00:00:00+02:00`);
const addDays = (date,n) => dayOf(new Date(dayStart(date)+n*86400000));
const clock = date => new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(date));
const prettyDay = (date,options={weekday:'long',day:'numeric',month:'long'}) => new Intl.DateTimeFormat('en-GB',{timeZone:zone,...options}).format(new Date(`${date}T12:00:00+02:00`));
const roomName = room => room === 'big' ? 'Big' : 'Small';
const newToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
let access={};
let storageAvailable=true;
try { access=JSON.parse(localStorage.getItem(storageKey)||'{}');if(!access || typeof access!=='object' || Array.isArray(access)) access={}; } catch {storageAvailable=false;}
const saveAccess = () => { try {localStorage.setItem(storageKey,JSON.stringify(access));}catch {storageAvailable=false;} };
const state={date:dayOf(new Date()),view:'day',mine:false,fullDay:false,bookings:[],loaded:false,loading:true,error:'',demo:null,serverOffset:0};
let requestSequence=0;
let formToken='';
let detailBooking=null;
let toastTimer;
const now = () => new Date(Date.now()+state.serverOffset);
const durationText = minutes => {const h=Math.floor(minutes/60),m=minutes%60;return [h ? `${h} ${h===1?'hour':'hours'}` : '',m ? `${m} minutes` : ''].filter(Boolean).join(' ');};
const bookingLength = b => Math.round((Date.parse(b.endAt)-Date.parse(b.startAt))/60000);
const bookingTitle = b => b.purpose || `${roomName(b.room)} conference room`;
const isMine = id => Boolean(access[id]?.token);
const sameDayBookings = date => state.bookings.filter(b=>Date.parse(b.startAt)<dayStart(date)+86400000 && Date.parse(b.endAt)>dayStart(date));
const filtered = rows => rows.filter(b=>!state.mine||isMine(b.id));

function toast(message) {
  clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;
  toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);
}

async function api(method='GET',body,query='') {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(`/api/bookings${query}`,{method,signal:controller.signal,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    let data;
    try {data=await response.json();}catch {throw new Error('The booking service could not be reached. Please try again.');}
    if(!response.ok) {const error=new Error(data.error||'Something went wrong. Please try again.');error.code=data.code;throw error;}
    return data;
  } catch(error) {
    if(error.name==='AbortError') throw new Error('The connection took too long. Please try again.');
    if(error instanceof TypeError) throw new Error('You appear to be offline. Reconnect and try again.');
    throw error;
  } finally {clearTimeout(timeout);}
}

function weekStart(date) { const dow=new Date(`${date}T12:00:00+02:00`).getUTCDay();return addDays(date,-((dow+6)%7)); }
function loadRange() {
  if(state.mine) return [dayOf(now()),addDays(dayOf(now()),366)];
  if(state.view==='day') return [state.date,state.date];
  const start=weekStart(state.date);return [start,addDays(start,6)];
}

async function loadSchedule({quiet=false}={}) {
  const seq=++requestSequence;
  state.loading=true;
  if(!quiet) {state.loaded=false;state.error='';render();}
  else renderSync();
  const [from,to]=loadRange();
  try {
    const data=await api('GET',undefined,`?from=${from}&to=${to}`);
    if(seq!==requestSequence) return;
    state.bookings=data.bookings;
    state.demo=data.demo;
    if(data.serverTime) state.serverOffset=Date.parse(data.serverTime)-Date.now();
    state.loaded=true;state.loading=false;state.error='';render();
  }catch(error){
    if(seq!==requestSequence) return;
    state.loaded=false;state.loading=false;state.error=error.message;render();
  }
}

function renderSync() {
  $('#sync-status').innerHTML=`<button class="sync-button" data-action="refresh" aria-label="Refresh schedule" ${state.loading?'disabled':''}>${icon('refresh')}${state.loading?'Refreshing…':'Refresh'}</button>`;
}

function render() {
  renderSync();
  $('#my-bookings').checked=state.mine;
  $('#schedule-title').textContent=state.mine?'My bookings':'Bookings';
  $('.schedule-toolbar').hidden=state.mine;
  $('[data-action="previous"]').setAttribute('aria-label',state.view==='day'?'Previous day':'Previous week');
  $('[data-action="next"]').setAttribute('aria-label',state.view==='day'?'Next day':'Next week');
  $('#date-heading').textContent=state.view==='day'?prettyDay(state.date,{weekday:'short',day:'numeric',month:'long',year:'numeric'}):`${prettyDay(weekStart(state.date),{day:'numeric',month:'short'})} – ${prettyDay(addDays(weekStart(state.date),6),{day:'numeric',month:'short',year:'numeric'})}`;
  $('#schedule-date').value=state.date;
  $$('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===state.view);b.setAttribute('aria-pressed',b.dataset.view===state.view);});
  $('#hours-toggle').hidden=state.view!=='day'||state.mine;
  $('#hours-toggle').textContent=state.fullDay?'Show working hours':'Show full day';
  const notice=$('#service-message');
  notice.hidden=!state.demo;
  if(state.demo) {notice.textContent='Local preview';notice.title='Bookings in this preview are saved only on this computer.';}
  const content=$('#schedule-content');
  content.setAttribute('aria-busy',state.loading);
  if(state.loading&&!state.loaded) {content.innerHTML='<div class="loading-state">Loading bookings…</div>';return;}
  if(state.error) {content.innerHTML=`<div class="empty-state"><h3>Bookings unavailable</h3><p>${esc(state.error)}</p><button class="button secondary" data-action="refresh">Try again</button></div>`;return;}
  if(state.mine) renderList();
  else if(state.view==='week') renderWeek();
  else renderDay();
}

function renderDay() {
  const bookings=filtered(sameDayBookings(state.date));
  const rooms=['big','small'];
  const base=dayStart(state.date);
  const startMinutes=b=>Math.max(0,(Date.parse(b.startAt)-base)/60000);
  const endMinutes=b=>Math.min(1440,(Date.parse(b.endAt)-base)/60000);
  let first=7,last=18;
  if(state.fullDay) {first=0;last=24;}
  else bookings.forEach(b=>{first=Math.min(first,Math.floor(startMinutes(b)/60));last=Math.max(last,Math.ceil(endMinutes(b)/60));});
  const height=(last-first)*60;
  const hours=Array.from({length:last-first},(_,i)=>first+i);
  const time=h=>`${String(h).padStart(2,'0')}:00`;
  const labels=hours.map(h=>`<span class="time-label" style="top:${(h-first)*60}px">${time(h)}</span>`).join('');
  const currentMinute=(now().valueOf()-base)/60000;
  const currentLine=currentMinute>=first*60&&currentMinute<last*60?`<div class="now-line" style="top:${currentMinute-first*60}px" aria-label="Current time ${clock(now())}"></div>`:'';
  $('#schedule-content').innerHTML=`<div class="day-scroll"><div class="day-grid" style="--rooms:${rooms.length};--hour-height:60px;--timeline-height:${height}px"><div class="day-columns-header"><span class="time-zone-cell">CAT</span>${rooms.map(room=>`<div class="room-column-header"><i class="room-dot ${room}"></i><strong>${roomName(room)}</strong><span>Conference room</span></div>`).join('')}</div><div class="timeline"><div class="time-axis">${labels}</div>${rooms.map(room=>`<div class="room-lane">${hours.map(h=>`<button class="time-slot" style="top:${(h-first)*60}px" data-slot="${room}|${state.date}|${time(h)}" aria-label="Select ${roomName(room)} room at ${time(h)}" ${base+h*3600000<now().valueOf()?'disabled':''}>${icon('plus')}Select time</button>`).join('')}${bookings.filter(b=>b.room===room).map(b=>{
    const top=startMinutes(b)-first*60;
    const length=endMinutes(b)-startMinutes(b);
    const compact=length<45;
    return `<button class="booking-block ${room} ${compact?'compact':''} ${length<=15?'micro':''}" style="top:${top+2}px;height:${Math.max(9,length-4)}px" data-booking="${b.id}" aria-label="${esc(`${bookingTitle(b)} · ${b.name} · ${clock(b.startAt)} to ${clock(b.endAt)}`)}"><span class="booking-time">${clock(b.startAt)} – ${clock(b.endAt)}</span><strong class="booking-name">${esc(b.name)}${isMine(b.id)?' · You':''}</strong>${!compact?`<span class="booking-purpose">${esc(b.purpose||'Room reservation')}</span>`:''}</button>`;
  }).join('')}</div>`).join('')}${currentLine}</div></div></div>`;
}

function renderWeek() {
  const first=weekStart(state.date);
  const rooms=['big','small'];
  $('#schedule-content').innerHTML=`<div class="week-scroll"><div class="week-grid">${Array.from({length:7},(_,i)=>addDays(first,i)).map(date=>{
    const rows=filtered(sameDayBookings(date));
    return `<div class="week-day"><div class="week-date ${date===dayOf(now())?'today':''}"><button class="week-date-button" data-week-date="${date}" aria-label="View ${prettyDay(date)}"><span>${prettyDay(date,{weekday:'short'}).toUpperCase()}</span><strong>${Number(date.slice(-2))}</strong></button></div>${rooms.map(room=>`<p class="week-room-label"><i class="room-dot ${room}"></i>${roomName(room)}</p>${rows.filter(b=>b.room===room).map(b=>`<button class="week-booking ${room}" data-booking="${b.id}"><span>${clock(b.startAt)} – ${clock(b.endAt)}${dayOf(new Date(b.startAt))!==date?' · continues':dayOf(new Date(b.endAt))!==date?' · next day':''}</span><strong>${esc(b.name)}</strong></button>`).join('')||'<p class="week-free">No bookings</p>'}`).join('')}</div>`;
  }).join('')}</div></div>`;
}

function renderList() {
  const rows=filtered(state.bookings).filter(b=>Date.parse(b.endAt)>now().valueOf());
  $('#schedule-content').innerHTML=rows.length?`<p class="list-caption">Upcoming bookings saved in this browser</p>${rows.map(b=>`<button class="list-booking" data-booking="${b.id}"><span class="list-booking-date">${prettyDay(dayOf(new Date(b.startAt)),{weekday:'short',day:'numeric',month:'short'})}</span><span class="list-booking-time">${clock(b.startAt)} – ${clock(b.endAt)}${dayOf(new Date(b.startAt))!==dayOf(new Date(b.endAt))?' +1 day':''}</span><div class="list-booking-title">${esc(bookingTitle(b))}<div class="list-booking-meta"><span class="room-tag ${b.room}"><i class="room-dot ${b.room}"></i>${roomName(b.room)}</span>${esc(b.name)}</div></div>${icon('chevron')}</button>`).join('')}`:`<div class="empty-state"><p>No upcoming bookings saved in this browser.</p></div>`;
}

function selectBookingTime(room='big',date=state.date,time,{focus=true}={}) {
  const form=$('#booking-form');
  form.elements.room.value=room;
  let chosen=date<dayOf(now())?dayOf(now()):date;
  let start=time;
  if(!start) {
    if(chosen===dayOf(now())) {
      const rounded=new Date(Math.ceil((now().valueOf()+60000)/900000)*900000);
      chosen=dayOf(rounded);start=clock(rounded);
    } else start='09:00';
  }
  form.elements.date.value=chosen;form.elements.date.min=dayOf(now());form.elements.date.max=addDays(dayOf(now()),366);
  form.elements.start.value=start;
  $('#form-error').hidden=true;
  updateEndTime();
  if(focus) {
    $('.booking-panel').scrollIntoView({block:'nearest'});
    (form.elements.name.value?form.elements.duration:form.elements.name).focus({preventScroll:true});
  }
}

function prepareBooking() {
  const form=$('#booking-form');
  form.reset();formToken=newToken();
  try {form.elements.name.value=localStorage.getItem('kavango-booker-name')||'';}catch{}
  selectBookingTime('big',state.date,undefined,{focus:false});
}

function syncFormDate() {
  if(state.date<dayOf(now())) return;
  const form=$('#booking-form');
  const start=Date.parse(`${state.date}T${form.elements.start.value}:00+02:00`);
  selectBookingTime(form.elements.room.value,state.date,start>now().valueOf()?form.elements.start.value:undefined,{focus:false});
}

function formDuration() {return $('#booking-form').elements.duration.value==='custom'?Number($('#custom-duration').value):Number($('#booking-form').elements.duration.value);}
function updateEndTime() {
  const form=$('#booking-form');
  $('#custom-duration-wrap').hidden=form.elements.duration.value!=='custom';
  $('#custom-duration').required=form.elements.duration.value==='custom';
  const start=new Date(`${form.elements.date.value}T${form.elements.start.value}:00+02:00`);
  const end=new Date(start.valueOf()+formDuration()*60000);
  $('#end-time').textContent=Number.isNaN(end.valueOf())?'—':`${clock(end)}${dayOf(end)!==form.elements.date.value?' (+1 day)':''}`;
}

$('#booking-form').addEventListener('input',updateEndTime);
$('#booking-form').addEventListener('change',event=>{
  updateEndTime();
  if(event.target.name==='date'&&event.target.validity.valid&&event.target.value) {
    state.date=event.target.value;state.mine=false;loadSchedule();
  }
});
$('#booking-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const input=Object.fromEntries(new FormData(form));input.duration=formDuration();input.cancelToken=formToken;
  const submit=$('#book-submit');submit.disabled=true;submit.textContent='Booking…';$('#form-error').hidden=true;
  try {
    const {booking}=await api('POST',input);
    access[booking.id]={token:formToken,endAt:booking.endAt};saveAccess();
    try {localStorage.setItem('kavango-booker-name',booking.name);}catch{}
    if(state.mine) {state.mine=false;state.view='day';}
    state.date=dayOf(new Date(booking.startAt));
    formToken=newToken();
    showDetail(booking,true);
    await loadSchedule();
  }catch(error){
    $('#form-error').textContent=error.message;$('#form-error').hidden=false;
    if(error.code==='CONFLICT') loadSchedule({quiet:true});
  }finally {submit.disabled=false;submit.textContent='Book room';}
});

function cancellationLink(b) {return `${location.origin}/#cancel=${b.id}.${access[b.id].token}`;}

function showDetail(b,success=false) {
  detailBooking=b;
  const own=isMine(b.id);
  const startDay=dayOf(new Date(b.startAt));
  const endDay=dayOf(new Date(b.endAt));
  $('#detail-content').innerHTML=`<div class="modal-header"><div><h2 id="detail-title">${success?'Booking confirmed':esc(bookingTitle(b))}</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Close booking details">${icon('x')}</button></div><div class="detail-summary"><div class="detail-row">${icon('rooms')}<div><label>Conference room</label><p>${roomName(b.room)}</p></div></div><div class="detail-row">${icon('calendar')}<div><label>Date</label><p>${prettyDay(startDay,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div></div><div class="detail-row">${icon('clock')}<div><label>Time · CAT</label><p>${clock(b.startAt)} – ${clock(b.endAt)}${endDay!==startDay?` (${prettyDay(endDay,{day:'numeric',month:'short'})})`:''}</p><small>${durationText(bookingLength(b))}</small></div></div><div class="detail-row">${icon('user')}<div><label>Booked by</label><p>${esc(b.name)}${own?' · You':''}</p>${b.department?`<small>${esc(b.department)}</small>`:''}</div></div>${b.purpose?`<div class="detail-row">${icon('list')}<div><label>Meeting</label><p>${esc(b.purpose)}</p></div></div>`:''}</div>${own?`<div class="private-link-box"><strong>${storageAvailable?'Keep this private cancellation link':'Save this link — this browser cannot remember your booking'}</strong><p>Use it to manage this booking on another device. Anyone with the link can cancel this booking.</p><div class="link-copy-row"><input id="cancel-link" readonly aria-label="Private cancellation link" value="${esc(cancellationLink(b))}"><button data-action="copy">${icon('copy')}Copy</button></div></div>`:''}<div class="detail-actions"><button class="button secondary" data-action="calendar">${icon('download')}Add to calendar</button>${own?`<button class="button secondary" data-action="cancel-prompt">Cancel booking</button>`:''}<button class="button primary" data-close="detail-dialog">${success?'Done':'Close'}</button></div><div id="cancel-confirmation" class="cancel-confirmation" hidden><strong>Cancel this booking?</strong><p>Your reserved time will become available to everyone.</p><button class="button danger" data-action="cancel-confirm">Yes, cancel booking</button><button class="button secondary" data-action="cancel-keep">Keep booking</button></div><p id="detail-error" class="form-error" role="alert" hidden></p>`;
  if(!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function exportCalendar(b) {
  const format=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const escapeText=value=>String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kavango East Education//Room Booking//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${b.id}@kavango-education-bookings`,`DTSTAMP:${format(new Date())}`,`DTSTART:${format(b.startAt)}`,`DTEND:${format(b.endAt)}`,`SUMMARY:${escapeText(bookingTitle(b))}`,`LOCATION:${roomName(b.room)} conference room\\, Directorate of Education\\, Rundu`,`DESCRIPTION:${escapeText(`Booked by ${b.name}${b.department ? ` · ${b.department}`:''}. All room schedule times use CAT (UTC+2).`)}`,'END:VEVENT','END:VCALENDAR'];
  const content=lines.map(line=>{
    let folded='',chunk='';
    for(const char of line) {if(new TextEncoder().encode(chunk+char).length>73){folded+=`${chunk}\r\n `;chunk='';}chunk+=char;}
    return folded+chunk;
  }).join('\r\n')+'\r\n';
  const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`${b.room}-room-${dayOf(new Date(b.startAt))}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function handleCancelLink() {
  const match=location.hash.match(/^#cancel=([0-9a-f-]{36})\.([0-9a-f]{64})$/i);
  if(!match) return;
  try {
    const {booking}=await api('GET',undefined,`?id=${match[1]}`);
    access[booking.id]={token:match[2],endAt:booking.endAt};saveAccess();
    state.date=dayOf(new Date(booking.startAt));
    history.replaceState(null,'',location.pathname+location.search);
    showDetail(booking);
    await loadSchedule();
  }catch(error){toast(error.message);}
}

document.addEventListener('click',async event=>{
  if(!roomPanel.contains(event.target)&&!$('#detail-dialog').contains(event.target)) return;
  const close=event.target.closest('[data-close]');
  if(close) {document.getElementById(close.dataset.close).close();return;}
  const view=event.target.closest('[data-view]');
  if(view) {state.view=view.dataset.view;state.mine=false;loadSchedule();return;}
  const slot=event.target.closest('[data-slot]');
  if(slot) {selectBookingTime(...slot.dataset.slot.split('|'));return;}
  const week=event.target.closest('[data-week-date]');
  if(week) {state.date=week.dataset.weekDate;state.view='day';state.mine=false;syncFormDate();loadSchedule();return;}
  const booking=event.target.closest('[data-booking]');
  if(booking) {const b=state.bookings.find(b=>b.id===booking.dataset.booking);if(b) showDetail(b);return;}
  const button=event.target.closest('[data-action]');
  if(!button) return;
  const action=button.dataset.action;
  if(action==='hours') {state.fullDay=!state.fullDay;render();}
  if(action==='today') {state.date=dayOf(now());syncFormDate();loadSchedule();}
  if(action==='refresh') loadSchedule({quiet:state.loaded});
  if(action==='previous'||action==='next') {state.date=addDays(state.date,(action==='previous'?-1:1)*(state.view==='day'?1:7));syncFormDate();loadSchedule();}
  if(action==='copy') {
    try {await navigator.clipboard.writeText($('#cancel-link').value);button.innerHTML=`${icon('check')}Copied`;toast('Private cancellation link copied.');}
    catch {$('#cancel-link').focus();$('#cancel-link').select();toast('Select and copy the private link above.');}
  }
  if(action==='calendar'&&detailBooking) exportCalendar(detailBooking);
  if(action==='cancel-prompt') $('#cancel-confirmation').hidden=false;
  if(action==='cancel-keep') $('#cancel-confirmation').hidden=true;
  if(action==='cancel-confirm'&&detailBooking) {
    button.disabled=true;button.textContent='Cancelling…';
    try {
      await api('DELETE',{id:detailBooking.id,cancelToken:access[detailBooking.id].token});
      delete access[detailBooking.id];saveAccess();$('#detail-dialog').close();toast('Booking cancelled. That time is available again.');await loadSchedule();
    }catch(error){$('#detail-error').textContent=error.message;$('#detail-error').hidden=false;button.disabled=false;button.textContent='Yes, cancel booking';}
  }
});
$('#schedule-date').addEventListener('change',event=>{if(event.target.value){state.date=event.target.value;syncFormDate();loadSchedule();}});
$('#my-bookings').addEventListener('change',event=>{state.mine=event.target.checked;loadSchedule();});
// Native dialogs provide Escape, focus trapping and focus restoration.
[$('#detail-dialog')].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.addEventListener('storage',event=>{if(event.key===storageKey){try{access=JSON.parse(event.newValue||'{}');render();}catch{}}});
window.addEventListener('hashchange',handleCancelLink);
window.addEventListener('online',()=>{if(!roomPanel.hidden)loadSchedule({quiet:true});});
document.addEventListener('booking-tab-change',event=>{if(event.detail==='rooms')loadSchedule({quiet:state.loaded});});
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(!roomPanel.hidden&&Date.now()-hiddenAt>60000)loadSchedule({quiet:true});});
setInterval(()=>{if(!document.hidden&&!roomPanel.hidden&&!$('#detail-dialog').open)loadSchedule({quiet:true});},60000);
prepareBooking();
render();
if(!roomPanel.hidden) await loadSchedule();
await handleCancelLink();
