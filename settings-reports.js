// Settings and reports share the app's persisted chapter state. No credentials are exported.
function defaultSystemSettings() {
  return {
    version: 1, chapterName: "Alpha Psi Point Tracker", alertEmail: "alphapsi@kkpsi.org",
    requiredFundraiserShifts: 2, fundraisersMandatory: true, extraShiftsEnabled: true,
    conditionalAbsenceExempt: true, conditionalLateExempt: true, conditionalCleanStart: true,
    probationEnabled: true, probationThreshold: -50, emailPromptsEnabled: true,
    executiveAttendance: true, executivePoints: true, defaultFunctionMandatory: true,
    fallStartMonth: 8, weekStartsOn: 1, businessDay: 5, businessTime: "13:30",
    marchingSections: ["Woodwinds", "Brass", "Percussion", "Guard", "Drum Majors/Marching Techs"],
    inactiveEnsembles: [], inactiveCommittees: [], hiddenAttendanceCategories: [],
  };
}
function systemSettings() { return { ...defaultSystemSettings(), ...(state.settings || {}) }; }
function currentBandSections() { return systemSettings().marchingSections; }
function allCommitteeNames() { return [...committees, ...state.customCommittees.map((item) => item.title)]; }
function fundraiserShiftStatuses(entry) {
  if (Array.isArray(entry.shifts)) return entry.shifts;
  return entry.shift1 && entry.shift2 ? [entry.shift1, entry.shift2] : [];
}
function fundraiserConfiguration(record) {
  const historicalCount = record?.statuses?.map(fundraiserShiftStatuses).find((shifts) => shifts.length)?.length;
  return {
    requiredShiftCount: record?.requiredShiftCount ?? historicalCount ?? (record ? 2 : systemSettings().requiredFundraiserShifts),
    fundraiserMandatory: record?.fundraiserMandatory ?? (record ? true : systemSettings().fundraisersMandatory),
    extraShiftsEnabled: record?.extraShiftsEnabled ?? (record ? true : systemSettings().extraShiftsEnabled),
  };
}
function settingsNumber(name, label, value, min, max, help) {
  return `<label class="field"><span>${escapeHtml(label)}</span><input type="number" name="${name}" value="${value}" min="${min}" max="${max}" step="1" required><small>${escapeHtml(help)}</small></label>`;
}
function settingsCheck(name, label, checked, help = "") {
  return `<label class="settings-check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span>${escapeHtml(label)}${help ? `<small>${escapeHtml(help)}</small>` : ""}</span></label>`;
}
function renderSystemSettings() {
  if (currentMember()?.role !== "Admin") return "";
  const s = systemSettings();
  const builtins = [{id:"marching-band",title:"Marching Band"},{id:"concert-band",title:"Concert Band"},{id:"symphonic-band",title:"Symphonic Band"}];
  return `<section class="settings-page"><h2>Settings</h2>
    <p class="muted">Configure the chapter without changing code. Only Admins can save settings.</p>
    <div class="notice">Saved point records keep their original values. Rule changes apply to new attendance and new point submissions. Editing attendance recalculates it using current point values. Existing fundraiser records keep their saved shift requirements. Calendar changes regroup the same records; they do not delete them.</div>
    ${view.settingsMessage ? `<p class="notice" role="status">${escapeHtml(view.settingsMessage)}</p>` : ""}
    <form id="systemSettingsForm" class="stack">
      <details class="panel" open><summary>Chapter & calendar</summary><div class="settings-fields">
        <label class="field"><span>Chapter / tracker name</span><input name="chapterName" maxlength="100" value="${escapeHtml(s.chapterName)}" required></label>
        <label class="field"><span>Alert email address</span><input name="alertEmail" type="email" value="${escapeHtml(s.alertEmail)}" required><small>Used for the app's prefilled alert emails.</small></label>
        <label class="field"><span>Academic year / fall starts in</span><select name="fallStartMonth">${['February','March','April','May','June','July','August','September','October','November','December'].map((month,index)=>`<option value="${index+2}" ${s.fallStartMonth===index+2?'selected':''}>${month}</option>`).join('')}</select><small>Spring runs from January through the month before fall, including summer records.</small></label>
        <label class="field"><span>First day of each week</span><select name="weekStartsOn">${weekDays.map((day,index)=>`<option value="${index}" ${index===s.weekStartsOn?'selected':''}>${day}</option>`).join('')}</select></label>
        <label class="field"><span>Recurring business meeting day</span><select name="businessDay">${weekDays.map((day,index)=>`<option value="${index}" ${index===s.businessDay?'selected':''}>${day}</option>`).join('')}</select></label>
        <label class="field"><span>Recurring business meeting time</span><input type="time" name="businessTime" value="${escapeHtml(s.businessTime)}" required></label>
      </div></details>
      <details class="panel" open><summary>Fundraiser attendance</summary><div class="settings-fields">
        ${settingsNumber("requiredFundraiserShifts","Shifts to record per member",s.requiredFundraiserShifts,1,20,"Each shift has its own Present, Absent, and Late buttons. Changes apply to new records.")}
        ${settingsCheck("fundraisersMandatory","Fundraisers are mandatory",s.fundraisersMandatory,"When off, absent fundraiser shifts have no deduction. Late shifts still use the late rule.")}
        ${settingsCheck("extraShiftsEnabled","Allow extra-shift bonuses",s.extraShiftsEnabled,"Show Extra Shifts Worked and award the bonus for each extra shift.")}
        <p class="muted">Set per-shift deductions and extra-shift bonuses in Point values below.</p>
      </div></details>
      <details class="panel"><summary>Conditional members & probation</summary><div class="settings-fields">
        ${settingsCheck("conditionalAbsenceExempt","Exempt Conditional members from attendance absence deductions",s.conditionalAbsenceExempt)}
        ${settingsCheck("conditionalLateExempt","Exempt Conditional members from attendance late deductions",s.conditionalLateExempt)}
        ${settingsCheck("conditionalCleanStart","Give a clean start when Active changes to Conditional",s.conditionalCleanStart,"If the current-term balance is negative, add a one-time Conditional Member Override to reach zero. Positive balances and historical records stay intact. Later manual deductions still count.")}
        ${settingsCheck("probationEnabled","Enable probation alerts",s.probationEnabled)}
        ${settingsNumber("probationThreshold","Probation alert at or below",s.probationThreshold,-10000,-1,"Current-term point balance. An alert does not change a member's status.")}
        ${settingsCheck("emailPromptsEnabled","Open prefilled alert emails",s.emailPromptsEnabled,"The app opens your email app; you choose whether to send. Turn off to keep alerts inside the tracker only.")}
      </div></details>
      <details class="panel"><summary>Access & event visibility</summary><div class="settings-fields">
        ${settingsCheck("executiveAttendance","Executive Members can submit attendance",s.executiveAttendance)}
        ${settingsCheck("executivePoints","Executive Members can submit manual points",s.executivePoints)}
        ${settingsCheck("defaultFunctionMandatory","New Functions default to mandatory",s.defaultFunctionMandatory)}
        <p class="muted">Admins retain access. Brother attendance permissions are managed in Member Info & Permissions. Hiding a category keeps all saved records.</p>
        ${[["category","Band Ensembles"],["business","Business Meetings"],["committees","Committee Meetings"],["functions","Functions"],["fundraisers","Fundraisers"]].map(([id,label])=>settingsCheck(`category:${id}`,`Show ${label}`,!s.hiddenAttendanceCategories.includes(id))).join('')}
      </div></details>
      <details class="panel"><summary>Band ensembles & marching sections</summary><p class="muted">Uncheck Available to archive an ensemble. History stays available in reports. Built-in ensembles use their existing member assignments.</p>
        <div class="settings-catalog">${builtins.map(item=>`<div class="catalog-row"><strong>${item.title}</strong>${settingsCheck(`ensemble:${item.id}`,"Available",!s.inactiveEnsembles.includes(item.id))}</div>`).join('')}
        ${state.customBandEnsembles.map(item=>`<div class="catalog-row"><label class="field"><span>Ensemble name</span><input name="ensembleTitle:${escapeHtml(item.id)}" value="${escapeHtml(item.title)}" required></label>${settingsCheck(`ensemble:${item.id}`,"Available",!s.inactiveEnsembles.includes(item.id))}<label class="field"><span>Attendance roster</span><select name="ensembleRoster:${escapeHtml(item.id)}"><option value="all" ${item.rosterMode!=='assigned'?'selected':''}>All members</option><option value="assigned" ${item.rosterMode==='assigned'?'selected':''}>Assigned members only</option></select></label></div>`).join('')}</div>
        <label class="field"><span>Add ensembles — one name per line</span><textarea name="newEnsembles" placeholder="Jazz Band&#10;Pep Band"></textarea><small>New ensembles begin with all members. Choose Assigned members only and set assignments in Member Info & Permissions if needed.</small></label>
        <label class="field"><span>Marching sections — one name per line</span><textarea name="marchingSections" required>${escapeHtml(s.marchingSections.join('\n'))}</textarea><small>Removing a section hides it from new attendance. Existing assignments and records are preserved.</small></label>
      </details>
      <details class="panel"><summary>Committees</summary><p class="muted">Archive committees without deleting records. Rename custom committees here. Meeting day and time are set under Attendance Events → Committee Meetings.</p>
        <div class="settings-catalog">${allCommitteeNames().map(name=>{const custom=state.customCommittees.find(item=>item.title===name);return `<div class="catalog-row">${custom?`<label class="field"><span>Committee name</span><input name="committeeTitle:${escapeHtml(custom.id)}" value="${escapeHtml(name)}" required></label>`:`<strong>${escapeHtml(name)}</strong>`}${settingsCheck(`committee:${name}`,"Available",!s.inactiveCommittees.includes(name))}</div>`}).join('')}</div>
        <label class="field"><span>Add committees — one name per line</span><textarea name="newCommittees"></textarea></label>
      </details>
      <details class="panel"><summary>Point values & custom point rules</summary><p class="muted">Positive values earn points; negative values deduct points. Fundraiser values apply per shift. Changes also appear under Point Assignments.</p>
        ${["positive","negative"].map(type=>`<h3>${type==='positive'?'Positive':'Negative'} points</h3><div class="settings-catalog">${state.pointRules[type].map(rule=>`<div class="catalog-row"><label class="field"><span>Rule name</span><input name="ruleName:${type}:${escapeHtml(rule.id)}" value="${escapeHtml(rule.name)}" required></label>${rule.value===null?'<span class="muted">Entered per submission</span>':settingsNumber(`ruleValue:${type}:${rule.id}`,"Points",rule.value,type==='positive'?0:-10000,type==='positive'?10000:0,"")}</div>`).join('')}</div>`).join('')}
        <h3>Add a manual point rule</h3><div class="settings-fields"><label class="field"><span>New rule name (optional)</span><input name="newRuleName" maxlength="150"></label><label class="field"><span>Type</span><select name="newRuleType"><option value="positive">Positive</option><option value="negative">Negative</option></select></label>${settingsNumber("newRuleValue","Points",0,-10000,10000,"Use a positive number for an award or a negative number for a deduction.")}</div>
      </details>
      <p class="notice" data-settings-error hidden role="alert"></p>
      <div class="settings-save"><button type="submit" class="primary">Save Settings</button><span class="muted">Changes apply to everyone after saving.</span></div>
    </form></section>`;
}
function parseSettingsForm(form) {
  const previous = systemSettings();
  const next = {...previous};
  const text = name => String(form.get(name)||'').trim();
  const names = name => text(name).split('\n').map(value=>value.trim()).filter(Boolean);
  const integer = (name,min,max) => { const value=Number(form.get(name)); if(!Number.isInteger(value)||value<min||value>max) throw new Error(`Check ${name}: use a whole number from ${min} to ${max}.`); return value; };
  next.chapterName=text('chapterName'); next.alertEmail=text('alertEmail');
  if(!next.chapterName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.alertEmail)) throw new Error('Enter a chapter name and valid alert email address.');
  for(const name of ['fundraisersMandatory','extraShiftsEnabled','conditionalAbsenceExempt','conditionalLateExempt','conditionalCleanStart','probationEnabled','emailPromptsEnabled','executiveAttendance','executivePoints','defaultFunctionMandatory']) next[name]=form.get(name)==='on';
  next.requiredFundraiserShifts=integer('requiredFundraiserShifts',1,20);
  next.probationThreshold=integer('probationThreshold',-10000,-1);
  next.fallStartMonth=integer('fallStartMonth',2,12);next.weekStartsOn=integer('weekStartsOn',0,6);next.businessDay=integer('businessDay',0,6);
  next.businessTime=text('businessTime');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.businessTime))throw new Error('Enter a valid business meeting time.');
  const unique = (values,label) => {if(new Set(values.map(value=>slug(value))).size!==values.length || values.some(value=>!slug(value)))throw new Error(`${label} names must be distinct and contain letters or numbers.`);};
  next.marchingSections=names('marchingSections');if(!next.marchingSections.length)throw new Error('Keep at least one marching section.');unique(next.marchingSections,'Section');
  const ensembles=state.customBandEnsembles.map(item=>({...item,title:text(`ensembleTitle:${item.id}`),rosterMode:form.get(`ensembleRoster:${item.id}`)==='assigned'?'assigned':'all'}));
  ensembles.push(...names('newEnsembles').map(title=>({id:uid('band'),title,rosterMode:'all'})));
  unique(['Marching Band','Concert Band','Symphonic Band',...ensembles.map(item=>item.title)],'Ensemble');
  next.inactiveEnsembles=['marching-band','concert-band','symphonic-band',...state.customBandEnsembles.map(item=>item.id)].filter(id=>form.get(`ensemble:${id}`)!=='on');
  const custom=state.customCommittees.map(item=>({...item,title:text(`committeeTitle:${item.id}`)}));
  custom.push(...names('newCommittees').map(title=>({id:uid('committee'),title})));
  unique([...committees,...custom.map(item=>item.title)],'Committee');
  const renamed = new Map(state.customCommittees.map(item=>[item.title,custom.find(nextItem=>nextItem.id===item.id).title]));
  next.inactiveCommittees=allCommitteeNames().filter(name=>form.get(`committee:${name}`)!=='on').map(name=>renamed.get(name)||name);
  next.hiddenAttendanceCategories=['category','business','committees','functions','fundraisers'].filter(id=>form.get(`category:${id}`)!=='on');
  const pointRules={};
  for(const type of ['positive','negative'])pointRules[type]=state.pointRules[type].map(rule=>({...rule,name:text(`ruleName:${type}:${rule.id}`)||rule.name,value:rule.value===null?null:integer(`ruleValue:${type}:${rule.id}`,type==='positive'?0:-10000,type==='positive'?10000:0)}));
  if(text('newRuleName')){const type=form.get('newRuleType')==='negative'?'negative':'positive';pointRules[type].push({id:uid('custom-rule'),name:text('newRuleName'),value:integer('newRuleValue',type==='positive'?0:-10000,type==='positive'?10000:0)});}
  return {settings:next,ensembles,custom,renamed,pointRules};
}
function saveSystemSettings(form) {
  if(currentMember()?.role!=='Admin') throw new Error('Only Admins can change settings.');
  const parsed=parseSettingsForm(form); // Validate every field before changing state.
  for(const [oldName,newName] of parsed.renamed){if(oldName===newName)continue;
    for(const member of state.members)if(member.assignments?.committee===oldName)member.assignments.committee=newName;
    if(state.committeeSettings[committeeKey(oldName)])state.committeeSettings[committeeKey(newName)]={...state.committeeSettings[committeeKey(oldName)]};
  }
  state.settings={...parsed.settings,updatedAt:new Date().toISOString(),updatedByMemberId:currentMember().id};
  state.customBandEnsembles=parsed.ensembles;state.customCommittees=parsed.custom;state.pointRules=parsed.pointRules;
  saveState();view.settingsMessage='Settings saved.';
  view.attendancePath=[];view.adminAttendancePath=[];
}

function fullRecordReportButton(memberId) {
  return `<button class="secondary small-action full-report-button" data-full-report="${escapeHtml(memberId || '')}">Full Record Report</button>`;
}
function reportMemberOptions() {
  const known=new Map(state.members.map(member=>[member.id,member]));
  for(const record of recordsForRange('0000-01-01','9999-12-31'))if(!known.has(record.memberId))known.set(record.memberId,{id:record.memberId,firstName:'Former member',lastName:record.memberId});
  return [...known.values()].sort(memberSort);
}
function fullReportRecords(member, selection) {
  const target=canViewAllPoints(member)?selection.memberId:member.id;
  return recordsForRange('0000-01-01','9999-12-31').filter(record=>record.memberId===target &&
    (!selection.year || getAcademicYear(record.date)===selection.year) &&
    (!selection.term || getTerm(record.date)===selection.term) &&
    (!selection.source || record.source===selection.source)).sort((a,b)=>selection.sort==='oldest'? -sortAdminRecordEntries(a,b):sortAdminRecordEntries(a,b));
}
function renderFullRecordReport(member) {
  const selection=view.fullReport;
  if(!canViewAllPoints(member))selection.memberId=member.id;
  const available=recordsForRange('0000-01-01','9999-12-31').filter(record=>record.memberId===selection.memberId);
  const records=fullReportRecords(member,selection);
  const years=[...new Set(available.map(record=>getAcademicYear(record.date)))].sort().reverse();
  const terms=[...new Set(available.filter(record=>!selection.year||getAcademicYear(record.date)===selection.year).map(record=>getTerm(record.date)))].sort((a,b)=>termSortValue(b)-termSortValue(a));
  const target=reportMemberOptions().find(item=>item.id===selection.memberId);
  const options=(values,chosen,all)=>`<option value="">${all}</option>${values.map(value=>`<option value="${escapeHtml(value)}" ${value===chosen?'selected':''}>${escapeHtml(value)}</option>`).join('')}`;
  return `<section><div class="section-head"><div><h1>Full Record Report</h1><p>${escapeHtml(formatMember(target||member))} · All recorded history</p></div><button class="secondary small-action" data-close-full-report>Back to Point Tracker</button></div>
    <div class="panel report-filters">
      ${canViewAllPoints(member)?`<label class="field"><span>Member</span><select data-report-filter="memberId">${reportMemberOptions().map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===selection.memberId?'selected':''}>${escapeHtml(formatMember(item))}</option>`).join('')}</select></label>`:''}
      <label class="field"><span>Sort records</span><select data-report-filter="sort"><option value="newest" ${selection.sort!=='oldest'?'selected':''}>Newest to oldest</option><option value="oldest" ${selection.sort==='oldest'?'selected':''}>Oldest to newest</option></select></label>
      <label class="field"><span>Academic year</span><select data-report-filter="year">${options(years,selection.year,'All academic years')}</select></label>
      <label class="field"><span>Semester</span><select data-report-filter="term">${options(terms,selection.term,'All semesters')}</select></label>
      <label class="field"><span>Record type</span><select data-report-filter="source">${options(['Attendance','Point Record'],selection.source,'All record types')}</select></label>
    </div>
    <div class="metric-row"><div class="metric"><span>Records shown</span><strong>${records.length}</strong></div><div class="metric"><span>Points in shown records</span><strong>${records.reduce((sum,record)=>sum+Number(record.points||0),0)}</strong></div></div>
    ${renderRecordLog(records,'No records match these filters.')}</section>`;
}
function recordsForPeriod(period) {
  const all=recordsForRange('0000-01-01','9999-12-31');
  if(period.type==='year')return all.filter(record=>getAcademicYear(record.date)===period.label);
  if(period.type==='term')return all.filter(record=>getTerm(record.date)===period.label);
  if(period.type==='week')return all.filter(record=>isInRange(record.date,period.start,period.end) && (!period.term||getTerm(record.date)===period.term));
  throw new Error('Choose an academic year, semester, or week.');
}
function periodDownloadButton(period) {
  return `<button class="secondary small-action period-download" data-download-period="${escapeHtml(JSON.stringify(period))}">Download Records</button>`;
}
function bindSettingsAndReports(member) {
  document.querySelector('#systemSettingsForm')?.addEventListener('submit',event=>{event.preventDefault();try{saveSystemSettings(new FormData(event.currentTarget));render();}catch(error){const notice=event.currentTarget.querySelector('[data-settings-error]');notice.textContent=error.message;notice.hidden=false;notice.scrollIntoView({block:'center'});}});
  document.querySelectorAll('[data-full-report]').forEach(button=>button.addEventListener('click',()=>{
    const id=canViewAllPoints(member)?(button.dataset.fullReport||view.trackerMemberId||member.id):member.id;
    view.fullReport={memberId:id,sort:'newest',year:'',term:'',source:''};render();
  }));
  document.querySelector('[data-close-full-report]')?.addEventListener('click',()=>{view.fullReport=null;render();});
  document.querySelectorAll('[data-report-filter]').forEach(select=>select.addEventListener('change',()=>{
    if(select.dataset.reportFilter==='memberId'&&!canViewAllPoints(currentMember()))return;
    view.fullReport[select.dataset.reportFilter]=select.value;
    if(select.dataset.reportFilter==='memberId'){view.fullReport.year='';view.fullReport.term='';}
    if(select.dataset.reportFilter==='year')view.fullReport.term='';render();
  }));
  document.querySelectorAll('[data-download-period]').forEach(button=>button.addEventListener('click',async()=>{
    if(currentMember()?.role!=='Admin')return;
    button.disabled=true;button.textContent='Preparing PDF…';
    try{const period=JSON.parse(button.dataset.downloadPeriod);const bytes=await createPeriodRecordsPdf(period);const blob=new Blob([bytes],{type:'application/pdf'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${slug(systemSettings().chapterName)}-records-${slug(period.label)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    catch(error){window.alert(`The PDF could not be downloaded: ${error.message}`);}
    finally{button.disabled=false;button.textContent='Download Records';}
  }));
}

async function createPeriodRecordsPdf(period) {
  if(currentMember()?.role!=='Admin')throw new Error('Only Admins can download chapter records.');
  const records=recordsForPeriod(period);
  if(!window.PDFLib || !window.fontkit)throw new Error('The PDF components did not load. Refresh and try again.');
  const {PDFDocument,rgb}=window.PDFLib;
  const pdf=await PDFDocument.create();pdf.registerFontkit(window.fontkit);
  const response=await fetch('vendor/DejaVuSans.ttf');if(!response.ok)throw new Error('The report font could not load.');
  const font=await pdf.embedFont(await response.arrayBuffer(),{subset:true});
  const supported=new Set(font.getCharacterSet());
  const clean=value=>Array.from(String(value??'').replace(/[\x00-\x08\x0b-\x1f]/g,' ')).map(char=>char==='\n'||supported.has(char.codePointAt(0))?char:'?').join('');
  const navy=rgb(0.06,0.14,0.32),gray=rgb(0.33,0.37,0.43),green=rgb(0.05,0.4,0.22);
  const width=612,height=792,margin=46,bottom=52,lineHeight=15;
  let page,y,memberTitle='',sectionTitle='';
  const draw=(text,size=10,color=gray,x=margin)=>{page.drawText(clean(text),{x,y,size,font,color});};
  function newPage(){page=pdf.addPage([width,height]);y=height-margin;
    for(const line of wrap(systemSettings().chapterName,15,width-margin*2)){draw(line,15,navy);y-=20;}y-=4;draw(`${period.label} | Chapter records`,10,gray);y-=20;
    page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:0.7,color:rgb(.8,.83,.88)});y-=25;
    if(memberTitle){for(const line of wrap(memberTitle,13,width-margin*2)){draw(line,13,navy);y-=18;}y-=5;}if(sectionTitle){draw(`${sectionTitle} (continued)`,11,navy);y-=21;}
  }
  function ensure(space){if(!page||y-space<bottom)newPage();}
  function wrap(text,size,maxWidth){
    const lines=[];
    for(const paragraph of clean(text).split('\n')){
      let line='';
      for(const word of paragraph.split(/\s+/)){
        if(!word)continue;
        const candidate=line?`${line} ${word}`:word;
        if(font.widthOfTextAtSize(candidate,size)<=maxWidth){line=candidate;continue;}
        if(line){lines.push(line);line='';}
        let chunk='';for(const char of word){if(chunk&&font.widthOfTextAtSize(chunk+char,size)>maxWidth){lines.push(chunk);chunk='';}chunk+=char;}line=chunk;
      }
      lines.push(line);
    }
    return lines;
  }
  function textBlock(text,size=10,color=gray){for(const line of wrap(text,size,width-margin*2)){ensure(lineHeight);draw(line,size,color);y-=lineHeight;}}
  const byMember=new Map();for(const record of records){if(!byMember.has(record.memberId))byMember.set(record.memberId,[]);byMember.get(record.memberId).push(record);}
  const members=reportMemberOptions().filter(member=>byMember.has(member.id));
  pdf.setTitle(`${systemSettings().chapterName} - ${period.label} records`);
  pdf.setSubject('Chapter attendance and manual point records, grouped by member');
  pdf.setCreator('Alpha Psi Point Tracker');
  if(!members.length){newPage();textBlock('No records in this period.',12,navy);}
  for(const member of members){
    memberTitle=formatMember(member);sectionTitle='';newPage();
    const personal=byMember.get(member.id);textBlock(`${personal.length} records | Period points: ${signedPoints(personal.reduce((sum,record)=>sum+Number(record.points||0),0))}`);y-=10;
    for(const [source,title] of [['Attendance','Attendance Events'],['Point Record','Manual Point Records']]){
      sectionTitle='';ensure(60);sectionTitle=title;textBlock(title,12,navy);y-=5;
      const items=personal.filter(record=>record.source===source).sort(sortAdminRecordEntries);
      if(!items.length){textBlock('No records in this category.');y-=12;continue;}
      for(const record of items){
        ensure(80);textBlock(`${record.date}  |  ${record.title}`,11,navy);
        textBlock(`Points: ${signedPoints(record.points)}`);
        if(record.attendanceStatus)textBlock(record.attendanceStatus);
        if(record.approvedLetterOverride)textBlock('Approved Letter Override',10,green);
        const recorder=state.members.find(item=>item.id===record.recordingMemberId);
        textBlock(`Recorded by: ${recorder?formatMember(recorder):'Former or unknown member'} | Submitted: ${record.createdAt || 'Unknown'}`,8);
        if(record.notes)textBlock(`Notes: ${record.notes}`);
        y-=9;
      }
      y-=10;
    }
  }
  const pages=pdf.getPages();pages.forEach((p,index)=>{
    p.drawLine({start:{x:margin,y:38},end:{x:width-margin,y:38},thickness:.5,color:rgb(.8,.83,.88)});
    p.drawText(`Page ${index+1} of ${pages.length}`,{x:margin,y:24,size:8,font,color:gray});
    const stamp=`Generated ${todayISO()}`;p.drawText(stamp,{x:width-margin-font.widthOfTextAtSize(stamp,8),y:24,size:8,font,color:gray});
  });
  return pdf.save();
}
