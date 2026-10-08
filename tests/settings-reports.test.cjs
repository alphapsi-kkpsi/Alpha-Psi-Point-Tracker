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
