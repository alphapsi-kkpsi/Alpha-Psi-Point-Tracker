// Run: node tests/settings-reports.test.cjs (no test dependencies).
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const storage = new Map();
const context = vm.createContext({
  console, Date, Math, JSON, FormData, Map, Set, window: {},
  localStorage: {getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value)},
  sessionStorage: {getItem: () => null},
  document: {querySelector: () => null, querySelectorAll: () => [], addEventListener() {}},
});
const run = code => vm.runInContext(code, context);
const value = code => JSON.parse(run(`JSON.stringify(${code})`));
for (const file of ['settings-reports.js','app.js']) run(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
run(`todayISO = () => '2026-10-08'; state.members[0].id='admin'; session={memberId:'admin'};
state.members.push({...state.members[0],id:'brother',role:'Brother',firstName:'Test',lastName:'Member',status:'Active'});
function settingsForm() {
 const f=new FormData(),s=systemSettings();
 for(const [key,item] of Object.entries(s))if(typeof item==='boolean'){if(item)f.set(key,'on');}else if(['string','number'].includes(typeof item))f.set(key,item);
 f.set('marchingSections',s.marchingSections.join('\\n'));
 for(const id of ['marching-band','concert-band','symphonic-band',...state.customBandEnsembles.map(x=>x.id)])if(!s.inactiveEnsembles.includes(id))f.set('ensemble:'+id,'on');
 for(const item of state.customBandEnsembles){f.set('ensembleTitle:'+item.id,item.title);f.set('ensembleRoster:'+item.id,item.rosterMode||'all');}
 for(const name of allCommitteeNames())if(!s.inactiveCommittees.includes(name))f.set('committee:'+name,'on');
 for(const item of state.customCommittees)f.set('committeeTitle:'+item.id,item.title);
 for(const id of ['category','business','committees','functions','fundraisers'])if(!s.hiddenAttendanceCategories.includes(id))f.set('category:'+id,'on');
 for(const type of ['positive','negative'])for(const rule of state.pointRules[type]){f.set('ruleName:'+type+':'+rule.id,rule.name);if(rule.value!==null)f.set('ruleValue:'+type+':'+rule.id,rule.value);}
 return f;
}
function fundForm(count,day='2026-10-08'){const f=new FormData();f.set('eventKind','fundraiser');f.set('eventId','fund');f.set('eventLabel','Fundraiser');f.set('date',day);for(const member of state.members){for(let i=1;i<=count;i++)f.set('shift'+i+':'+member.id,i===1?'Late':'Absent');f.set('extraShifts:'+member.id,'2');}return f;}`);
// Older chapters get compatible defaults; older two-shift records retain their requirements.
assert.equal(run('normalizeState({...state,settings:undefined}).settings.requiredFundraiserShifts'),2);
run(`var f=settingsForm(); f.set('requiredFundraiserShifts','3'); f.set('newEnsembles','Jazz Ensemble');f.set('newCommittees','Outreach');f.set('newRuleName','Extra service');f.set('newRuleType','positive');f.set('newRuleValue','8');saveSystemSettings(f);state=loadState()`);
assert.equal(run('systemSettings().requiredFundraiserShifts'),3);
assert.equal(run('state.pointRules.positive.find(x=>x.name==="Extra service").value'),8);
assert.equal(run('state.customBandEnsembles[0].title'),'Jazz Ensemble');
run('state.attendanceRecords=[createAttendanceRecord(fundForm(3),currentMember())]');
assert.equal(run('state.attendanceRecords[0].points[0].points'),1); // -1 -2 -2 +6
run(`state.settings.requiredFundraiserShifts=1;state.settings.fundraisersMandatory=false;var existing=createAttendanceRecord(fundForm(3),currentMember());var optional=createAttendanceRecord(fundForm(1,'2026-10-09'),currentMember());`);
assert.equal(run('existing.requiredShiftCount'),3);assert.equal(run('existing.points[0].points'),1);
assert.equal(run('optional.points[0].points'),5); // late still counts; required record count is one
assert.equal(run(`fundraiserConfiguration({statuses:[{memberId:'brother',shift1:'Present',shift2:'Late'}]}).requiredShiftCount`),2);
// Conditional policies can be switched off independently; stored scores never change implicitly.
run(`var before=JSON.stringify(state.attendanceRecords);state.members[1].status='Conditional';`);
assert.equal(run(`pointsForAttendanceStatus({eventKind:'band'},state.members[1],'Late').points`),0);
run('state.settings.conditionalLateExempt=false');assert.equal(run(`pointsForAttendanceStatus({eventKind:'band'},state.members[1],'Late').points`),-10);
assert.equal(run(`pointsForAttendanceStatus({eventKind:'band'},state.members[1],'Absent').points`),0);
run('state.settings.conditionalAbsenceExempt=false');assert.equal(run(`pointsForAttendanceStatus({eventKind:'band'},state.members[1],'Absent').points`),-20);
assert.equal(run('JSON.stringify(state.attendanceRecords)===before'),true);
// Archive/rename catalogs without touching records; preserve assignments and schedules.
run(`state.members[1].assignments.committee='Outreach';var f=settingsForm();f.delete('ensemble:'+state.customBandEnsembles[0].id);f.set('committeeTitle:'+state.customCommittees[0].id,'Service');f.set('ensembleRoster:'+state.customBandEnsembles[0].id,'assigned');saveSystemSettings(f)`);
assert.equal(run('state.members[1].assignments.committee'),'Service');assert.equal(run('JSON.stringify(state.attendanceRecords)===before'),true);
assert.equal(run(`attendanceChoices(currentMember(),[{type:'category'}],true).items.some(x=>x.label==='Jazz Ensemble')`),false);
assert.equal(run(`membersForAttendanceEvent({eventKind:'custom-band',eventId:state.customBandEnsembles[0].id}).length`),0);
// Invalid settings are atomic, and non-admin writes are rejected.
run(`var snapshot=JSON.stringify(state);var f=settingsForm();f.set('requiredFundraiserShifts','0')`);
assert.throws(()=>run('saveSystemSettings(f)'),/whole number/);assert.equal(run('JSON.stringify(state)===snapshot'),true);
run(`session={memberId:'brother'}`);assert.throws(()=>run('saveSystemSettings(settingsForm())'),/Only Admins/);
run(`session={memberId:'admin'};state.settings={...defaultSystemSettings(),emailPromptsEnabled:false};state.attendanceRecords=[];state.pointRecords=[
{id:'a',memberId:'brother',date:'2025-08-01',createdAt:'2025-08-02',points:1},
{id:'b',memberId:'brother',date:'2026-07-31',createdAt:'2026-08-01',points:2},
{id:'c',memberId:'brother',date:'2026-08-01',createdAt:'2026-08-01',points:3},
{id:'private',memberId:'admin',date:'2026-08-02',createdAt:'2026-08-02',points:99}];`);
assert.deepEqual(value(`recordsForPeriod({type:'year',label:'2025-2026'}).map(x=>x.id)`),['b','a']);
assert.deepEqual(value(`recordsForPeriod({type:'term',label:'Spring 2026'}).map(x=>x.id)`),['b']);
assert.deepEqual(value(`recordsForPeriod({type:'week',label:'Boundary',start:'2026-07-27',end:'2026-08-02',term:'Spring 2026'}).map(x=>x.id)`),['b']);
assert.deepEqual(value(`fullReportRecords(state.members[1],{memberId:'admin',sort:'oldest'}).map(x=>x.id)`),['a','b','c']);
assert.equal(run(`getTermDateRange('Spring 2026').end`),'2026-07-31');
assert.equal(run(`getWeekRange('2026-08-02').start`),'2026-07-27');
run('state.settings.weekStartsOn=0');assert.equal(run(`getWeekRange('2026-08-02').start`),'2026-08-02');
run(`state.settings.executivePoints=false;state.members[1].role='Executive Member'`);assert.equal(run('allowedTabs(state.members[1]).some(x=>x.id==="points")'),false);assert.equal(run('canViewAllPoints(state.members[1])'),true);
console.log('Settings/report tests passed: migrations, history snapshots, points, catalog archiving, validation, roles, report filters and calendar boundaries.');
// Multi-member manual records keep individual IDs and shared details for both signs.
for (const [type, actionId, points] of [['positive','helping-set-up',2],['negative','phone-out',-3]]) {
  run(`var bulk=new FormData();bulk.append('memberId','admin');bulk.append('memberId','brother');bulk.append('memberId','brother');bulk.set('actionId','${actionId}');bulk.set('notes','Shared note');var batch=createPointRecords(bulk,currentMember(),'${type}');`);
  assert.deepEqual(value('batch.map(r=>r.memberId)'),['admin','brother']);
  assert.equal(run('new Set(batch.map(r=>r.id)).size'),2);
  assert.equal(run(`batch.every(r=>r.points===${points}&&r.notes==='Shared note'&&r.recordingMemberId==='admin')`),true);
}
assert.throws(()=>run(`createPointRecords(new FormData(),currentMember(),'positive')`),/Select at least one/);
run(`bulk.append('memberId','missing')`);
assert.throws(()=>run(`createPointRecords(bulk,currentMember(),'negative')`),/no longer available/);
console.log('Multi-member point record tests passed.');
// Help always exists, but procedures reflect the signed-in role.
for (const role of ['Brother','Executive Member','Admin']) {
  run(`var helpMember={...state.members[1],role:'${role}'};var topics=helpSections(helpMember);`);
  assert.equal(run(`allowedTabs(helpMember).some(t=>t.id==='help')`),true);
  assert.equal(run(`topics.some(t=>t.group==='Brother functions')`),true);
  assert.equal(run(`topics.some(t=>t.group==='Executive functions')`),role!=='Brother');
  assert.equal(run(`topics.some(t=>t.group==='Admin functions')`),role==='Admin');
  assert.equal(run(`topics.every(t=>t.steps.length>=3&&t.picture.length===3)`),true);
  assert.equal(run(`renderHelp(helpMember).includes('data-help-search')`),true);
  assert.equal(run(`renderHelp(helpMember).includes('<svg')`),true);
}
assert.equal(run(`helpIllustration('<script>', ['a&b']).includes('&lt;script&gt;')`),true);
run(`var helpSnapshot=JSON.stringify(state);renderHelp(currentMember());`);
assert.equal(run(`JSON.stringify(state)===helpSnapshot`),true);
console.log('Role-specific Help tests passed.');
// Chapter goals validate atomically and count net chapter points within their own dates.
run(`state.pointRecords=[{id:'g1',memberId:'admin',date:'2026-10-01',points:80},{id:'g2',memberId:'brother',date:'2026-10-02',points:-10},{id:'old',memberId:'admin',date:'2026-09-30',points:999},{id:'future',memberId:'admin',date:'2026-10-20',points:999}];state.attendanceRecords=[];
function goalForm(){const f=settingsForm();f.append('chapterGoalId','goal-test');f.set('goalName:goal-test','Pizza');f.set('goalTarget:goal-test','100');f.set('goalReward:goal-test','Chapter pizza night');f.set('goalStart:goal-test','2026-10-01');f.set('goalEnd:goal-test','2026-10-31');f.set('goalVisible:goal-test','on');return f;}
var gf=goalForm();saveSystemSettings(gf);var goal=systemSettings().chapterGoals[0];`);
assert.equal(run('chapterGoalProgress(goal).points'),70);
assert.equal(run('chapterGoalProgress(goal).remaining'),30);
assert.equal(run('chapterGoalProgress(goal).percent'),70);
run(`state.pointRecords.push({id:'reach',memberId:'brother',date:'2026-10-08',points:30})`);
assert.equal(run('chapterGoalProgress(goal).status'),'Goal reached');
run(`state.pointRecords.push({id:'deduct',memberId:'brother',date:'2026-10-08',points:-150})`);
assert.equal(run('chapterGoalProgress(goal).points'),-50);
assert.equal(run('chapterGoalProgress(goal).percent'),0);
assert.equal(run('chapterGoalProgress(goal).remaining'),150);
assert.equal(run(`chapterGoalProgress({...goal,start:'2026-11-01',end:'2026-11-30'}).status`),'Upcoming');
assert.equal(run(`chapterGoalProgress({...goal,end:'2026-10-02'}).status`),'Ended');
assert.equal(run(`chapterGoalProgress({...goal,end:'2026-10-02',target:50}).status`),'Completed');
run(`var beforeGoal=JSON.stringify(state);gf.set('goalTarget:goal-test','0')`);
assert.throws(()=>run('saveSystemSettings(gf)'),/whole numbers/);
assert.equal(run('JSON.stringify(state)===beforeGoal'),true);
run(`gf=goalForm();gf.set('goalStart:goal-test','2026-11-01')`);
assert.throws(()=>run('saveSystemSettings(gf)'),/dates/);
run(`gf=goalForm();gf.set('goalEnd:goal-test','2026-02-30')`);
assert.throws(()=>run('saveSystemSettings(gf)'),/dates/);
run(`gf=goalForm();gf.set('goalReward:goal-test','')`);
assert.throws(()=>run('saveSystemSettings(gf)'),/reward/);
for(const role of ['Brother','Executive Member','Admin']) {
  run(`state.members[1].role='${role}';session={memberId:'brother'};view.fullReport=null;view.trackerPath=[];`);
  assert.equal(run(`renderTracker(currentMember()).includes('Chapter pizza night')`),true);
}
run(`session={memberId:'admin'};state.settings.chapterGoals[0].reward='<script>alert(1)</script>'`);
assert.equal(run(`renderChapterGoals().includes('&lt;script&gt;')`),true);
run(`state.settings.chapterGoals[0].visible=false`);
assert.equal(run('renderChapterGoals()'),'');
run(`state.settings.chapterGoals=[]`);
assert.equal(run('renderChapterGoals()'),'');
run(`session={memberId:'brother'};state.members[1].role='Brother'`);
assert.throws(()=>run('saveSystemSettings(goalForm())'),/Only Admins/);
console.log('Chapter goal tests passed.');
