/* Alpha Psi configurable administration and historical reporting. */
(function () {
  const defaults = {requiredShifts:2, fundraiserMandatory:true, ensembles:["Concert Band","Symphonic Band"], committees:["M&E","W&M","S&B","A&P","H&T"]};
  const settings = () => Object.assign({},defaults,state.chapterSettings || {});
  const opt = (value,label,selected) => '<option value="'+escapeHtml(value)+'"'+(selected===value?' selected':'')+'>'+escapeHtml(label)+'</option>';
  const oldAdmin = renderAdmin, oldSection = renderAdminSection, oldTracker = renderTracker, oldTrackerDetail = renderTrackerDetail, oldRecords = renderAdminRecordLevel;
  const oldBindAdmin = bindAdminEvents, oldBindTracker = bindTrackerEvents;
  const oldPoints = pointsForAttendanceStatus, oldTable = renderFundraiserAttendanceTable, oldStatuses = attendanceStatusesFromForm, oldImpacts = attendancePointImpacts;
  const oldCommittees = allCommittees;
  const years = () => [...new Set([...state.pointRecords,...state.attendanceRecords].map(r=>getAcademicYear(r.date)))].sort().reverse();
  function fullButton(id) {return '<button class="secondary small-action" data-full-record="'+escapeHtml(id)+'">Full Record Report</button>';}
  function fullReport(viewer) {
    const id = canViewAllPoints(viewer) ? view.fullRecordId : viewer.id;
    const person = state.members.find(m=>m.id===id);
    if (!person) return '';
    const year = view.fullRecordYear || '', term = view.fullRecordTerm || '';
    let records = recordsForRange('0000-01-01','9999-12-31').filter(r=>r.memberId===id);
    if(year) records=records.filter(r=>getAcademicYear(r.date)===year);
    if(term) records=records.filter(r=>getTerm(r.date)===term);
    const terms=year?[...new Set([...state.pointRecords,...state.attendanceRecords].filter(r=>getAcademicYear(r.date)===year).map(r=>getTerm(r.date)))].sort((a,b)=>termSortValue(b)-termSortValue(a)):[];
    const order=view.fullRecordOrder==='oldest'?1:-1;
    records.sort((a,b)=>order*(String(a.date).localeCompare(String(b.date))||String(a.createdAt).localeCompare(String(b.createdAt))));
    return '<section class="panel"><div class="section-head"><h2>Full Record Report — '+escapeHtml(formatMember(person))+'</h2><button class="secondary small-action" data-full-close>Close</button></div>'+
      '<div class="form-grid"><label class="field"><span>Sort</span><select data-full-order>'+opt('newest','Newest to oldest',view.fullRecordOrder||'newest')+opt('oldest','Oldest to newest',view.fullRecordOrder)+'</select></label>'+
      '<label class="field"><span>Academic year</span><select data-full-year>'+opt('','All academic years',year)+years().map(y=>opt(y,y,year)).join('')+'</select></label>'+
      '<label class="field"><span>Semester</span><select data-full-term>'+opt('','All semesters',term)+terms.map(t=>opt(t,t,term)).join('')+'</select></label></div>'+
      renderRecordLog(records,'No records for the selected filters.')+'</section>';
  }
  renderTracker = function(member) {
    const html=oldTracker(member);
    return html.replace('</div>\n    '+(view.trackerPath.length?'':'__NEVER__'),'</div>\n    '+(view.trackerPath.length?'':'__NEVER__')) // no-op
      .replace(/(<\/div>\s*)(<div class="button-list">|<div class="empty">|<div class="metric-row">)/, '$1'+fullButton(canViewAllPoints(member)&&view.trackerMemberId||member.id)+(view.fullRecordId?fullReport(member):'')+'$2')
      .replace(/(<\/div>\s*)$/, '$1'+(html.includes('data-full-record')?'':fullButton(member.id))+(view.fullRecordId?fullReport(member):''));
  };
  renderTrackerDetail = function(member,term,week) {
    const html=oldTrackerDetail(member,term,week);
    if(!canViewAllPoints(member)||!view.trackerMemberId) return html;
    return html.replace('data-clear-tracker-member', 'data-clear-tracker-member').replace('<div class="divider"></div>',fullButton(view.trackerMemberId)+'<div class="divider"></div>');
  };
  renderAdmin = function(member) {return oldAdmin(member).replace(/(<button class="[^"]*" data-admin-section="members">Member Info & Permissions<\/button>)/, '$1<button class="'+(view.adminSection==='settings'?'active':'')+'" data-admin-section="settings">Settings</button>');};
  function settingsForm() {
    const s=settings();
    return '<form id="chapterSettingsForm" class="panel stack"><h2>Chapter Settings</h2><p class="muted">These settings affect future submissions. Previously recorded points are preserved.</p>'+
      '<label class="field"><span>Required fundraiser shifts per brother</span><input type="number" name="requiredShifts" min="1" max="20" required value="'+s.requiredShifts+'"></label>'+
      '<label class="field"><span>Fundraisers mandatory?</span><select name="fundraiserMandatory">'+opt('yes','Yes',s.fundraiserMandatory?'yes':'no')+opt('no','No',s.fundraiserMandatory?'yes':'no')+'</select></label>'+
      '<label class="field"><span>Band ensembles (one per line)</span><textarea name="ensembles">'+escapeHtml(s.ensembles.join('\n'))+'</textarea></label>'+
      '<label class="field"><span>Committees (one per line)</span><textarea name="committees">'+escapeHtml(s.committees.join('\n'))+'</textarea></label>'+
      '<p class="muted">Use Point Assignments to change scoring. Existing custom ensembles and committees remain available.</p><button class="primary" type="submit">Save Settings</button></form>';
  }
  renderAdminSection=function(member){return view.adminSection==='settings'?settingsForm():oldSection(member);};
  allCommittees=function(){return [...new Set([...settings().committees,...state.customCommittees.map(c=>c.title)])];};
  pointsForAttendanceStatus=function(event,member,status){
    if(event.eventKind==='fundraiser'&&!settings().fundraiserMandatory&&(status==='Absent'||status==='Late')) return {points:0,action:'Optional fundraiser'};
    return oldPoints(event,member,status);
  };
  renderFundraiserAttendanceTable=function(members,record,locked){
    const count=settings().requiredShifts;
    if(count===2) return oldTable(members,record,locked);
    const saved=new Map((record?.statuses||[]).map(e=>[e.memberId,e]));
    return '<p class="muted">'+count+' shifts required per member.</p><div class="table-wrap"><table><thead><tr><th>Member</th><th>Required shifts</th><th>Extra shifts worked</th></tr></thead><tbody>'+
      members.map(m=>{const e=saved.get(m.id)||{};return '<tr><td>'+escapeHtml(formatMember(m))+'</td><td>'+Array.from({length:count},(_,i)=>{const n=i+1,v=(e.shifts||[])[i]||e['shift'+n]||'';return '<label class="field"><span>Shift '+n+'</span><select name="shift'+n+':'+escapeHtml(m.id)+'" '+(locked?'disabled':'')+'>'+opt('','Choose',v)+attendanceStatuses.map(a=>opt(a,a,v)).join('')+'</select></label>';}).join('')+'</td><td><label class="field"><span>Extra Shifts Worked</span><input type="number" min="0" step="1" name="extraShifts:'+escapeHtml(m.id)+'" value="'+Number(e.extraShifts||0)+'" '+(locked?'disabled':'')+'></label></td></tr>';}).join('')+
      '</tbody></table></div>';
  };
  attendanceStatusesFromForm=function(form,event){
    if(event.eventKind!=='fundraiser'||settings().requiredShifts===2) return oldStatuses(form,event);
    const entries=[];
    for(const member of membersForAttendanceEvent(event)){
      const shifts=Array.from({length:settings().requiredShifts},(_,i)=>String(form.get('shift'+(i+1)+':'+member.id)||''));
      if(!shifts.every(s=>attendanceStatuses.includes(s))) throw new Error('Complete all shifts for '+formatMember(member)+'.');
      const extraShifts=Number(form.get('extraShifts:'+member.id)||0);
      if(!Number.isSafeInteger(extraShifts)||extraShifts<0) throw new Error('Invalid extra shifts for '+formatMember(member)+'.');
      entries.push({memberId:member.id,shifts,shift1:shifts[0],shift2:shifts[1],extraShifts,status:shifts.includes('Absent')?'Absent':shifts.includes('Late')?'Late':'Present'});
    }
    return entries;
  };
  attendancePointImpacts=function(event,entries){
    if(event.eventKind!=='fundraiser'||settings().requiredShifts===2) return oldImpacts(event,entries);
    return entries.map(e=>{
      const member=state.members.find(m=>m.id===e.memberId);
      if(!member)return null;
      const values=e.shifts.map(s=>pointsForAttendanceStatus(event,member,s).points);
      const penaltyPoints=values.reduce((a,b)=>a+b,0);
      const bonusPoints=e.extraShifts*ruleImpact('positive','multiple-fundraiser-shifts').points;
      return {memberId:e.memberId,points:penaltyPoints+bonusPoints,penaltyPoints,bonusPoints,note:values.map((v,i)=>'Shift '+(i+1)+': '+signedPoints(v)).join('; ')+'; Extra shifts: '+signedPoints(bonusPoints)};
    }).filter(Boolean);
  };
  function range(period){
    if(period.type==='year'){const y=Number(period.label.split('-')[0]);return {start:y+'-08-01',end:(y+1)+'-07-31'};}
    if(period.type==='term')return getTermDateRange(period.label);
    return normalizeWeekSelection(period);
  }
  function download(period){
    const r=range(period), entries=recordsForRange(r.start,r.end);
    const clean=v=>escapeHtml(String(v??''));
    const body=state.members.slice().sort((a,b)=>formatMember(a).localeCompare(formatMember(b))).map(m=>{
      const rows=entries.filter(e=>e.memberId===m.id);
      if(!rows.length)return '';
      return '<section><h2>'+clean(formatMember(m))+'</h2>'+[['Attendance Events',rows.filter(e=>e.source!=='Point Record')],['Manual Point Records',rows.filter(e=>e.source==='Point Record')]].map(([heading,list])=>'<h3>'+heading+'</h3>'+(list.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt))).map(e=>'<p>'+clean(e.date)+' — '+clean(e.title)+' — '+clean(e.attendanceStatus||'')+' — '+clean(signedPoints(e.points))+' points'+(e.notes?' — '+clean(e.notes):'')+'</p>').join('')||'<p>No records</p>')).join('')+'</section>';
    }).join('');
    const popup=window.open('','_blank');
    if(!popup){alert('Allow pop-ups to download the report.');return;}
    popup.document.write('<!doctype html><html><head><title>Alpha Psi Records — '+clean(period.label)+'</title><style>body{font:12px Arial;margin:28px}h2{border-bottom:1px solid #999}section{break-inside:avoid-page;margin-bottom:20px}p{margin:5px 0}</style></head><body><h1>Alpha Psi Records — '+clean(period.label)+'</h1><p>'+clean(r.start)+' through '+clean(r.end)+'</p>'+(body||'<p>No records</p>')+'<script>window.onload=function(){window.print()}<\/script></body></html>');
    popup.document.close();
  }
  renderAdminRecordLevel=function(path){
    const html=oldRecords(path);
    if(path.length>=3)return html;
    let periods=[];
    if(path.length===0) periods=availableRecordTimeline().map(y=>({type:'year',label:y.year}));
    if(path.length===1) periods=(availableRecordTimeline().find(y=>y.year===path[0].label)?.terms||[]).map(t=>({type:'term',label:t.label}));
    if(path.length===2) periods=availableRecordWeeks(path[1].label).map(w=>({type:'week',label:w.label,id:w.id,start:w.start,end:w.end}));
    return html+'<div class="stack">'+periods.map(p=>'<button class="secondary small-action" data-download-records="'+escapeHtml(JSON.stringify(p))+'">Download Records — '+escapeHtml(p.label)+' (PDF)</button>').join('')+'</div>';
  };
  bindTrackerEvents=function(){
    oldBindTracker();
    document.querySelectorAll('[data-full-record]').forEach(b=>b.addEventListener('click',()=>{view.fullRecordId=b.dataset.fullRecord;render();}));
    document.querySelector('[data-full-close]')?.addEventListener('click',()=>{view.fullRecordId=null;render();});
    document.querySelector('[data-full-order]')?.addEventListener('change',e=>{view.fullRecordOrder=e.target.value;render();});
    document.querySelector('[data-full-year]')?.addEventListener('change',e=>{view.fullRecordYear=e.target.value;view.fullRecordTerm='';render();});
    document.querySelector('[data-full-term]')?.addEventListener('change',e=>{view.fullRecordTerm=e.target.value;render();});
  };
  bindAdminEvents=function(member){
    oldBindAdmin(member);
    document.querySelector('#chapterSettingsForm')?.addEventListener('submit',e=>{
      e.preventDefault();
      if(member.role!=='Admin')return;
      const f=new FormData(e.currentTarget),requiredShifts=Number(f.get('requiredShifts'));
      if(!Number.isSafeInteger(requiredShifts)||requiredShifts<1||requiredShifts>20)return;
      const lines=v=>String(f.get(v)||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      state.chapterSettings={requiredShifts,fundraiserMandatory:f.get('fundraiserMandatory')==='yes',ensembles:lines('ensembles'),committees:lines('committees')};
      saveState();render();
    });
    document.querySelectorAll('[data-download-records]').forEach(b=>b.addEventListener('click',()=>download(JSON.parse(b.dataset.downloadRecords))));
  };
})();
