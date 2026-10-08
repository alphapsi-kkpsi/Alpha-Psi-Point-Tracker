const APP_KEY = "alphaPsiPointTrackerStateV1";
const SESSION_KEY = "alphaPsiPointTrackerSessionV1";

const LOGO_MAIN = "assets/kkpsi-logo.jpg";

const roles = ["Admin", "Executive Member", "Brother"];
const statuses = ["Active", "Conditional"];
const attendanceStatuses = ["Present", "Absent", "Late"];
const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const bandSections = [
  "Woodwinds",
  "Brass",
  "Percussion",
  "Guard",
  "Drum Majors/Marching Techs",
];
const committees = ["M&E", "W&M", "S&B", "A&P", "H&T"];
const conditionalIgnoredActions = new Set([
  "Late to Committee Meeting Without Approved Letter",
  "Late to Meeting / Song Rehearsal Without Approved Letter",
  "Not Working a Fundraiser Shift",
  "Not Attending a Mandatory Function",
  "Absent from Committee Meeting Without Approved Letter",
  "Absent from Meeting / Song Rehearsal Without Approved Letter",
]);

const positiveRuleSeeds = [
  ["attending-convention", "Attending Convention", 25],
  ["attending-social-event", "Attending Social Event (Non-Mandatory Function)", 20],
  ["attending-higher-level-workshops", "Attending Higher-Level Workshops", 10],
  ["helpful-towards-other-music-orgs", "Helpful Towards Other Music Orgs.", 10],
  ["outside-committee", "Going to a Committee Meeting Outside of Assignment", 10],
  ["mandatory-function", "Attending a Mandatory Function", 5],
  ["multiple-fundraiser-shifts", "Working Multiple Fundraiser Shifts", 3],
  ["helping-set-up", "Helping With Set Up", 2],
  ["helping-tear-down", "Helping With Tear Down", 2],
  ["exec-discretion-positive", "Executive Council Discretion (Positive)", null],
];

const negativeRuleSeeds = [
  ["phone-out", "Phone Out in Rehearsal / Meetings", -3],
  ["disruptive-rehearsal", "Disruptive / Disrespectful Rehearsal Etiquette", -3],
  ["disruptive-meetings", "Repeatedly Disruptive / Disrespectful / Off-Topic in Meetings", -3],
  ["cursing-letters", "Cursing in Letters", -5],
  ["cursing-pins", "Cursing in Pin(s)", -5],
  ["late-committee", "Late to Committee Meeting Without Approved Letter", -10],
  ["late-meeting", "Late to Meeting / Song Rehearsal Without Approved Letter", -10],
  ["late-band", "Late to Band Ensemble Rehearsal Without Approved Letter", -10],
  ["late-fundraiser", "Late to Fundraiser Shift", -1],
  ["missed-fundraiser", "Not Working a Fundraiser Shift", -2],
  ["missed-mandatory-function", "Not Attending a Mandatory Function", -15],
  ["absent-committee", "Absent from Committee Meeting Without Approved Letter", -20],
  ["absent-meeting", "Absent from Meeting / Song Rehearsal Without Approved Letter", -20],
  ["absent-band", "Absent from Band Ensemble Without Approved Letter", -20],
  ["exec-discretion-negative", "Executive Council Discretion (Negative)", null],
];

let state = loadState();
let session = loadSession();
let view = {
  tab: "home",
  trackerPath: [],
  trackerMemberId: null,
  attendancePath: [],
  adminSection: "members",
  adminAttendancePath: [],
  adminRecordsPath: [],
  pointMode: null,
  editingMemberId: null,
  modal: null,
};

const app = document.querySelector("#app");

function createDefaultState() {
  const adminId = uid("member");
  return {
    members: [
      {
        id: adminId,
        firstName: "Fisher",
        lastName: "Boone",
        email: "frboone1@buffs.wtamu.edu",
        buffId: "1123822",
        status: "Active",
        role: "Admin",
        assignments: {
          marchingBand: true,
          section: "Brass",
          concertBand: false,
          symphonicBand: false,
          committee: "M&E",
        },
        attendancePermissions: emptyAttendancePermissions(),
      },
    ],
    loginCredentials: [
      {
        memberId: adminId,
        email: "frboone1@buffs.wtamu.edu",
        buffId: "1123822",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    pointRules: {
      positive: positiveRuleSeeds.map(([id, name, value]) => ({ id, name, value })),
      negative: negativeRuleSeeds.map(([id, name, value]) => ({ id, name, value })),
    },
    functions: [
      {
        id: uid("function"),
        title: "Chapter Function",
        date: todayISO(),
        mandatory: true,
        assignedMemberIds: [],
      },
    ],
    settings: defaultSystemSettings(),
    fundraisers: [],
    fundraiserShiftRulesVersion: 1,
    customBandEnsembles: [],
    customCommittees: [],
    extraBusinessMeetings: [],
    committeeSettings: {},
    deletedBusinessMeetingDates: [],
    attendanceRequirements: {},
    attendanceRecords: [],
    pointRecords: [],
    alerts: [],
  };
}

function emptyAttendancePermissions() {
  return {
    Woodwinds: false,
    Brass: false,
    Percussion: false,
    Guard: false,
    "Drum Majors/Marching Techs": false,
    "Concert Band": false,
    "Symphonic Band": false,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_KEY) || "null");
    if (!saved) return createDefaultState();
    return normalizeState(saved);
  } catch {
    return createDefaultState();
  }
}

function normalizeState(saved) {
  const defaults = createDefaultState();
  const members = (saved.members || defaults.members).map((member) => ({
    ...member,
    id: member.id || uid("member"),
    email: String(member.email || "").trim(),
    buffId: String(member.buffId || "").trim(),
    assignments: {
      ...defaults.members[0].assignments,
      ...(member.assignments || {}),
    },
    attendancePermissions: {
      ...emptyAttendancePermissions(),
      ...(member.attendancePermissions || {}),
    },
  }));
  return {
    ...defaults,
    ...saved,
    settings: { ...defaultSystemSettings(), ...(saved.settings || {}) },
    members,
    loginCredentials: normalizeLoginCredentials(saved.loginCredentials || defaults.loginCredentials, members),
    pointRules: {
      positive: mergeRules(defaults.pointRules.positive, saved.pointRules?.positive),
      negative: mergeRules(defaults.pointRules.negative, saved.pointRules?.negative).map((rule) => {
        if (saved.fundraiserShiftRulesVersion !== 1) {
          if (rule.id === "late-fundraiser" && rule.value === -10) return { ...rule, value: -1 };
          if (rule.id === "missed-fundraiser" && rule.value === -15) return { ...rule, value: -2 };
        }
        return rule;
      }),
    },
    fundraiserShiftRulesVersion: 1,
    functions: (saved.functions || defaults.functions).map((item) => ({
      ...item,
      id: item.id || uid("function"),
      title: item.title || "Function",
      date: item.date || todayISO(),
      mandatory: item.mandatory !== false,
      assignedMemberIds: item.assignedMemberIds || [],
    })),
    fundraisers: (saved.fundraisers || []).map((item) => ({
      ...item,
      id: item.id || uid("fundraiser"),
      title: item.title || "Fundraiser",
      date: item.date || todayISO(),
      mandatory: true,
    })),
    customBandEnsembles: (saved.customBandEnsembles || []).map((item) => ({
      ...item,
      id: item.id || uid("band"),
      title: item.title || "Band Ensemble",
    })),
    customCommittees: (saved.customCommittees || []).map((item) => ({
      id: item.id || uid("committee"),
      title: item.title || "Committee",
    })),
    extraBusinessMeetings: (saved.extraBusinessMeetings || []).map((item) => ({
      id: item.id || uid("business"),
      title: item.title || "Business Meeting",
      date: item.date || todayISO(),
      time: item.time || "13:30",
    })),
    committeeSettings: saved.committeeSettings || {},
    deletedBusinessMeetingDates: saved.deletedBusinessMeetingDates || [],
    attendanceRequirements: saved.attendanceRequirements || {},
    attendanceRecords: (saved.attendanceRecords || []).map((record) => ({
      ...record,
      id: record.id || uid("attendance"),
      date: record.date || todayISO(),
      statuses: record.statuses || [],
      points: record.points || [],
      createdAt: record.createdAt || new Date().toISOString(),
    })),
    pointRecords: (saved.pointRecords || []).map((record) => ({
      ...record,
      id: record.id || uid("point"),
      date: record.date || todayISO(),
      createdAt: record.createdAt || new Date().toISOString(),
    })),
    alerts: saved.alerts || [],
  };
}

function mergeRules(defaultRules, savedRules = []) {
  return defaultRules.map((rule) => {
    const saved = savedRules.find((item) => item.id === rule.id);
    return saved ? { ...rule, ...saved } : rule;
  }).concat(savedRules.filter((saved) => !defaultRules.some((rule) => rule.id === saved.id)));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBuffId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "");
}

function normalizeLoginCredentials(savedCredentials = [], members = state.members) {
  const savedByMember = new Map((savedCredentials || []).map((credential) => [credential.memberId, credential]));
  return members
    .filter((member) => normalizeEmail(member.email) && normalizeBuffId(member.buffId))
    .map((member) => {
      const saved = savedByMember.get(member.id) || {};
      const now = new Date().toISOString();
      return {
        memberId: member.id,
        email: normalizeEmail(member.email),
        buffId: normalizeBuffId(member.buffId),
        createdAt: saved.createdAt || now,
        updatedAt: saved.updatedAt || now,
      };
    });
}

function repairLoginCredentials(persist = false) {
  const previous = JSON.stringify(state.loginCredentials || []);
  state.loginCredentials = normalizeLoginCredentials(state.loginCredentials || [], state.members || []);
  if (persist || previous !== JSON.stringify(state.loginCredentials)) saveState();
}

function syncLoginForMember(member) {
  if (!state.loginCredentials) state.loginCredentials = [];
  state.loginCredentials = state.loginCredentials.filter((credential) => credential.memberId !== member.id);
  const email = normalizeEmail(member.email);
  const buffId = normalizeBuffId(member.buffId);
  if (!email || !buffId) return;
  const now = new Date().toISOString();
  state.loginCredentials.push({
    memberId: member.id,
    email,
    buffId,
    createdAt: now,
    updatedAt: now,
  });
}

function findMemberForLogin(email, buffId) {
  const normalized = normalizeEmail(email);
  const cleanBuffId = normalizeBuffId(buffId);
  if (!normalized || !cleanBuffId) return null;
  repairLoginCredentials(true);
  const credential = (state.loginCredentials || []).find(
    (item) => normalizeEmail(item.email) === normalized && normalizeBuffId(item.buffId) === cleanBuffId,
  );
  if (credential) {
    const member = state.members.find((item) => item.id === credential.memberId);
    if (member) return member;
  }

  const member = state.members.find(
    (item) => normalizeEmail(item.email) === normalized && normalizeBuffId(item.buffId) === cleanBuffId,
  );
  if (member) {
    syncLoginForMember(member);
    saveState();
  }
  return member || null;
}

function saveState() {
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(memberId, remember) {
  session = { memberId, remember };
  if (remember) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function currentMember() {
  const stored = session || JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  if (!stored) return null;
  return state.members.find((member) => member.id === stored.memberId) || null;
}

function uid(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMember(member) {
  return `${member.firstName} ${member.lastName}`.trim();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISO(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function prettyDate(value) {
  if (!value) return "";
  const date = parseDate(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function prettyTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getAcademicYear(dateValue) {
  const date = parseDate(dateValue);
  const year = date.getFullYear();
  return date.getMonth() >= systemSettings().fallStartMonth - 1 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getTerm(dateValue) {
  const date = parseDate(dateValue);
  const year = date.getFullYear();
  return date.getMonth() >= systemSettings().fallStartMonth - 1 ? `Fall ${year}` : `Spring ${year}`;
}

function getWeekRange(dateValue) {
  const date = parseDate(dateValue);
  const day = date.getDay();
  const diff = -((day - systemSettings().weekStartsOn + 7) % 7);
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    id: toISO(start),
    label: `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")}-${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}`,
    start: toISO(start),
    end: toISO(end),
  };
}

function getTermDateRange(termLabel) {
  const [term, yearText] = termLabel.split(" ");
  const year = Number(yearText);
  const month = systemSettings().fallStartMonth;
  const boundary = `${year}-${String(month).padStart(2,"0")}-01`;
  if (term === "Fall") return { start: boundary, end: `${year}-12-31` };
  return { start: `${year}-01-01`, end: toISO(new Date(year, month - 1, 0, 12)) };
}

function isInRange(dateValue, start, end) {
  return dateValue >= start && dateValue <= end;
}

function signedPoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Custom";
  const number = Number(value);
  return number > 0 ? `+${number}` : `${number}`;
}

function pointClass(value) {
  const number = Number(value);
  if (number > 0) return "points-positive";
  if (number < 0) return "points-negative";
  return "points-neutral";
}

function allowedTabs(member) {
  const tabs = [{ id: "tracker", label: "Point Tracker" }];
  if (member.role === "Admin" || (member.role === "Executive Member" && systemSettings().executiveAttendance) || (member.role === "Brother" && hasAttendancePermission(member))) {
    tabs.push({ id: "attendance", label: "Submit Attendance" });
  }
  if (member.role === "Admin" || (member.role === "Executive Member" && systemSettings().executivePoints)) {
    tabs.push({ id: "points", label: "Submit Points" });
  }
  if (member.role === "Admin") {
    tabs.push({ id: "admin", label: "Admin" });
  }
  return tabs;
}

function allCommittees() {
  return allCommitteeNames().filter((name) => !systemSettings().inactiveCommittees.includes(name));
}

function committeeKey(label) {
  return slug(label);
}

function committeeSetting(label) {
  const key = committeeKey(label);
  if (!state.committeeSettings[key]) {
    state.committeeSettings[key] = {
      day: 5,
      time: "13:30",
      deletedDates: [],
    };
  }
  return state.committeeSettings[key];
}

function formatMeetingTime(time) {
  if (!time) return "";
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute}${suffix}`;
}

function activateCurrentWeekTracker() {
  const date = todayISO();
  const week = getWeekRange(date);
  view.tab = "tracker";
  view.trackerPath = [
    { type: "year", label: getAcademicYear(date) },
    { type: "term", label: getTerm(date) },
    { type: "week", label: week.label, id: week.id, start: week.start, end: week.end },
  ];
  view.trackerMemberId = null;
}

function hasAttendancePermission(member) {
  return Object.values(member.attendancePermissions || {}).some(Boolean);
}

function canViewAllPoints(member) {
  return member.role === "Admin" || member.role === "Executive Member";
}

function render() {
  const member = currentMember();
  if (!member) {
    renderLogin();
    return;
  }

  if (view.tab === "home") activateCurrentWeekTracker();
  ensureProbationAlertsForCurrentTerm();

  const visibleTabs = allowedTabs(member);
  if (view.tab !== "home" && !visibleTabs.some((tab) => tab.id === view.tab)) {
    activateCurrentWeekTracker();
  }

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-brand">
          <div class="mini-logo">
            <img src="${LOGO_MAIN}" alt="Alpha Psi logo" onload="this.nextElementSibling.classList.add('is-hidden')" onerror="this.classList.add('is-hidden')">
            <span>AP</span>
          </div>
          <div class="topbar-title">
            <strong>${escapeHtml(systemSettings().chapterName)}</strong>
            <span>${escapeHtml(formatMember(member))} - ${escapeHtml(member.role)}</span>
          </div>
        </div>
        <button class="ghost small-action" data-action="logout">Log Out</button>
      </header>
      <section class="content">${renderContent(member)}</section>
      <nav class="bottom-nav">
        ${visibleTabs
          .map(
            (tab) => `
              <button class="nav-button ${view.tab === tab.id ? "active" : ""}" data-tab="${tab.id}">
                ${escapeHtml(tab.label)}
              </button>
            `,
          )
          .join("")}
      </nav>
      ${view.modal ? renderModal(member) : ""}
    </div>
  `;
  bindAppEvents(member);
}

function renderLogin() {
  app.innerHTML = `
    <section class="screen compact">
      <form class="login-panel" id="loginForm">
        <div class="brand-lockup">
          <div class="brand-logo">
            <img src="${LOGO_MAIN}" alt="Alpha Psi logo" onload="this.nextElementSibling.classList.add('is-hidden')" onerror="this.classList.add('is-hidden')">
            <span>AP</span>
          </div>
          <div>
            <h1 class="brand-title">Alpha Psi Point Tracker</h1>
            <p class="brand-subtitle">Login</p>
          </div>
        </div>
        <label class="field">
          <span>School Email</span>
          <input name="email" type="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span>Buff ID</span>
          <input name="buffId" type="password" inputmode="numeric" autocomplete="current-password" required>
        </label>
        <label class="check-row">
          <input name="remember" type="checkbox">
          <span>Save login on this device</span>
        </label>
        <button class="primary" type="submit">Log In</button>
        <p class="status-text" id="loginStatus"></p>
      </form>
    </section>
  `;

  document.querySelector("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = normalizeEmail(form.get("email"));
    const buffId = normalizeBuffId(form.get("buffId"));
    const member = findMemberForLogin(email, buffId);
    if (!member) {
      document.querySelector("#loginStatus").textContent =
        "No matching member login found. Confirm the School Email and Buff ID saved for that member.";
      return;
    }
    saveSession(member.id, form.get("remember") === "on");
    activateCurrentWeekTracker();
    render();
  });
}

function renderContent(member) {
  if (view.tab === "home") {
    return `
      <div class="landing landing-empty" aria-label="Home"></div>
    `;
  }
  if (view.tab === "tracker") return renderTracker(member);
  if (view.tab === "attendance") return renderAttendance(member);
  if (view.tab === "points") return renderSubmitPoints(member);
  if (view.tab === "admin") return renderAdmin(member);
  return "";
}

function renderTracker(member) {
  if (view.fullReport) return renderFullRecordReport(member);
  const path = view.trackerPath;
  const title = path.length ? path[path.length - 1].label : "Point Tracker";
  return `
    <div class="section-head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(canViewAllPoints(member) ? "Chapter view" : "Personal view")}</p>
      </div>
      <div class="toolbar">
        ${
          path.length
            ? `<button class="secondary small-action" data-tracker-back>Back</button>`
            : ""
        }
      </div>
    </div>
    ${path.length < 3 ? fullRecordReportButton(canViewAllPoints(member) ? view.trackerMemberId : member.id) : ""}
    ${renderTrackerLevel(member)}
  `;
}

function availableTimeline() {
  const entries = [
    ...state.pointRecords.map((record) => record.date),
    ...state.attendanceRecords.map((record) => record.date),
    todayISO(),
  ];
  const years = new Map();
  for (const date of entries) {
    const year = getAcademicYear(date);
    if (!years.has(year)) years.set(year, new Set());
    years.get(year).add(getTerm(date));
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, terms]) => ({
      year,
      terms: [...terms].sort((a, b) => termSortValue(b) - termSortValue(a)),
    }));
}

function termSortValue(label) {
  const [term, year] = label.split(" ");
  return Number(year) * 10 + (term === "Fall" ? 2 : 1);
}

function renderTrackerLevel(member) {
  const path = view.trackerPath;
  const timeline = availableTimeline();

  if (path.length === 0) {
    return renderButtonList(
      timeline.map((item) => ({
        label: item.year,
        meta: `${item.terms.length} term${item.terms.length === 1 ? "" : "s"}`,
        action: "tracker-pick",
        value: JSON.stringify({ type: "year", label: item.year }),
      })),
      "No academic years yet.",
    );
  }

  if (path.length === 1) {
    const year = timeline.find((item) => item.year === path[0].label);
    return renderButtonList(
      (year?.terms || []).map((term) => ({
        label: term,
        meta: "Academic term",
        action: "tracker-pick",
        value: JSON.stringify({ type: "term", label: term }),
      })),
      "No academic terms yet.",
    );
  }

  if (path.length === 2) {
    const weeks = availableWeeks(path[1].label);
    return renderButtonList(
      weeks.map((week) => ({
        label: week.label,
        meta: "Monday-Sunday",
        action: "tracker-pick",
        value: JSON.stringify({ type: "week", label: week.label, id: week.id, start: week.start, end: week.end }),
      })),
      "No weeks yet.",
    );
  }

  return renderTrackerDetail(member, path[1].label, path[2]);
}

function availableWeeks(termLabel) {
  const range = getTermDateRange(termLabel);
  const dates = [
    ...state.pointRecords.map((record) => record.date),
    ...state.attendanceRecords.map((record) => record.date),
    todayISO(),
  ].filter((date) => isInRange(date, range.start, range.end));
  const weeks = new Map();
  for (const date of dates) {
    const week = getWeekRange(date);
    weeks.set(week.id, week);
  }
  return [...weeks.values()].sort((a, b) => b.id.localeCompare(a.id));
}

function renderButtonList(items, emptyText) {
  if (!items.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="button-list">
      ${items
        .map(
          (item) => `
            <div class="button-list-row">
              ${
                item.staticOnly
                  ? `
                    <div class="pill-button is-static">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.meta || "")}</span>
                    </div>
                  `
                  : `
                    <button class="pill-button" data-action="${item.action}" data-value="${escapeHtml(item.value)}">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.meta || "")}</span>
                    </button>
                  `
              }
              ${item.action === "admin-record-pick" && currentMember()?.role === "Admin" ? periodDownloadButton({...JSON.parse(item.value), ...(JSON.parse(item.value).type === "week" ? {term:view.adminRecordsPath[1]?.label} : {})}) : ""}
              ${
                item.deleteAction
                  ? `<button class="icon-button danger row-delete" data-action="${item.deleteAction}" data-value="${escapeHtml(item.deleteValue || item.value)}" aria-label="Delete ${escapeHtml(item.label)}">Delete</button>`
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTrackerDetail(member, termLabel, week) {
  const range = getTermDateRange(termLabel);
  const selectedWeek = normalizeWeekSelection(week);
  const chapterTermPoints = totalPointsForRange(null, range.start, range.end);
  const weekRecords = recordsForRange(selectedWeek.start > range.start ? selectedWeek.start : range.start, selectedWeek.end < range.end ? selectedWeek.end : range.end);

  if (canViewAllPoints(member)) {
    const selected = state.members.find((item) => item.id === view.trackerMemberId);
    if (selected) {
      const selectedRecords = weekRecords.filter((record) => record.memberId === selected.id);
      return `
        <div class="metric-row">
          <div class="metric"><span>${escapeHtml(formatMember(selected))}</span><strong>${totalPointsForRange(selected.id, range.start, range.end)}</strong></div>
          <div class="metric"><span>Chapter Points</span><strong>${chapterTermPoints}</strong></div>
        </div>
        ${fullRecordReportButton(selected.id)}
        <button class="secondary small-action" data-clear-tracker-member>All Members</button>
        <div class="divider"></div>
        ${renderRecordLog(selectedRecords, "No records for this member in this week.")}
      `;
    }

    const totals = state.members
      .map((item) => ({
        member: item,
        total: totalPointsForRange(item.id, range.start, range.end),
      }))
      .sort((a, b) => b.total - a.total || formatMember(a.member).localeCompare(formatMember(b.member)));
    return `
      <div class="metric-row">
        <div class="metric"><span>Chapter Points</span><strong>${chapterTermPoints}</strong></div>
        <div class="metric"><span>Selected Week</span><strong>${escapeHtml(selectedWeek.label)}</strong></div>
      </div>
      ${fullRecordReportButton(member.id)}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Term Total</th><th>Records This Week</th></tr></thead>
          <tbody>
            ${totals
              .map(
                ({ member: item, total }) => `
                  <tr>
                    <td><button class="member-button" data-tracker-member="${item.id}"><span>${escapeHtml(formatMember(item))}</span><span class="badge">${escapeHtml(item.role)}</span></button></td>
                    <td class="${pointClass(total)}">${total}</td>
                    <td>${weekRecords.filter((record) => record.memberId === item.id).length}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  const personalRecords = weekRecords.filter((record) => record.memberId === member.id);
  return `
    <div class="metric-row">
      <div class="metric"><span>Personal Points</span><strong>${totalPointsForRange(member.id, range.start, range.end)}</strong></div>
      <div class="metric"><span>Chapter Points</span><strong>${chapterTermPoints}</strong></div>
    </div>
    ${fullRecordReportButton(member.id)}
    ${renderRecordLog(personalRecords, "No records for this week.")}
  `;
}

function normalizeWeekSelection(week) {
  if (week?.start && week?.end) return week;
  const id = week?.id || todayISO();
  const hydrated = getWeekRange(id);
  return {
    ...hydrated,
    ...week,
    start: hydrated.start,
    end: hydrated.end,
    label: week?.label || hydrated.label,
  };
}

function recordsForRange(start, end) {
  const pointRecords = state.pointRecords
    .filter((record) => isInRange(record.date, start, end))
    .map((record) => ({
      id: record.id,
      memberId: record.memberId,
      title: record.actionName,
      date: record.date,
      createdAt: record.createdAt,
      recordingMemberId: record.recordingMemberId,
      notes: record.notes,
      points: record.points,
      source: "Point Record",
    }));

  const attendanceRecords = [];
  for (const record of state.attendanceRecords.filter((item) => isInRange(item.date, start, end))) {
    const impactsByMember = new Map((record.points || []).map((impact) => [impact.memberId, impact]));
    for (const status of record.statuses || []) {
      const impact = impactsByMember.get(status.memberId);
      const approvedLetterOverride = hasApprovedAttendanceLetter(record, impact);
      attendanceRecords.push({
        id: record.id,
        memberId: status.memberId,
        title: record.eventLabel,
        date: record.date,
        createdAt: record.createdAt,
        recordingMemberId: record.recordingMemberId,
        attendanceStatus: attendanceStatusLabel(status),
        approvedLetterOverride,
        notes: [approvedLetterOverride ? null : impact?.note, record.notes].filter(Boolean).join(" - "),
        points: effectiveAttendancePoints(record, impact),
        source: "Attendance",
      });
    }
  }
  return [...pointRecords, ...attendanceRecords].sort(sortAdminRecordEntries);
}

function renderRecordLog(records, emptyText) {
  if (!records.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="record-list">
      ${records
        .map((record) => {
          const member = state.members.find((item) => item.id === record.memberId);
          const recorder = state.members.find((item) => item.id === record.recordingMemberId);
          return `
            <article class="record-item">
              <div class="record-main">
                <strong>${escapeHtml(formatMember(member || {}))}</strong>
                <span class="${pointClass(record.points)}">${signedPoints(record.points)}</span>
              </div>
              <div>${escapeHtml(record.title)} - ${escapeHtml(record.source)}</div>
              <div class="muted">${prettyDate(record.date)} at ${prettyTime(record.createdAt)} - Recorded by ${escapeHtml(formatMember(recorder || {}))}</div>
              ${record.attendanceStatus ? `<div class="muted">${escapeHtml(record.attendanceStatus)}</div>` : ""}
              ${record.approvedLetterOverride ? `<div class="points-positive">Approved Letter Override</div>` : ""}
              ${record.notes ? `<div class="muted">${escapeHtml(record.notes)}</div>` : ""}
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function totalPointsForRange(memberId, start, end) {
  return recordsForRange(start, end)
    .filter((record) => !memberId || record.memberId === memberId)
    .reduce((sum, record) => sum + Number(record.points || 0), 0);
}

function renderAttendance(member) {
  const path = view.attendancePath;
  const title = path.length ? path[path.length - 1].label : "Submit Attendance";
  return `
    <div class="section-head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(pathLabel(path) || "Attendance events")}</p>
      </div>
      <div class="toolbar">
        ${path.length ? `<button class="secondary small-action" data-attendance-back>Back</button>` : ""}
      </div>
    </div>
    ${renderAttendanceLevel(member, path, false)}
  `;
}

function pathLabel(path) {
  return path.map((item) => item.label).join(" / ");
}

function renderAttendanceLevel(member, path, adminMode) {
  const choices = attendanceChoices(member, path, adminMode);
  if (choices.finalEvent) {
    return adminMode
      ? renderAdminAttendanceEvent(choices.finalEvent)
      : renderAttendanceEventForm(member, choices.finalEvent);
  }
  return renderButtonList(
    choices.items.map((item) => ({
      label: item.label,
      meta: item.meta,
      action: adminMode ? "admin-attendance-pick" : "attendance-pick",
      value: JSON.stringify(item),
      deleteAction: item.deleteAction,
      deleteValue: item.deleteValue,
      staticOnly: item.staticOnly,
    })),
    "No attendance events available.",
  );
}

function attendanceChoices(member, path, adminMode) {
  const fullAccess = member.role === "Admin" || member.role === "Executive Member" || adminMode;
  const permissions = member.attendancePermissions || {};

  if (path.length === 0) {
    const items = [];
    if (fullAccess || currentBandSections().some((section) => permissions[section]) || permissions["Concert Band"] || permissions["Symphonic Band"]) {
      items.push({ type: "category", label: "Band Ensembles", meta: "Marching, concert, symphonic" });
    }
    if (fullAccess) items.push({ type: "business", label: "Business Meetings", meta: `${weekDays[systemSettings().businessDay]}s at ${formatMeetingTime(systemSettings().businessTime)}` });
    if (fullAccess) items.push({ type: "committees", label: "Committee Meetings", meta: allCommittees().join(", ") });
    if (fullAccess) items.push({ type: "functions", label: "Functions", meta: `${state.functions.length} listed` });
    if (fullAccess) items.push({ type: "fundraisers", label: "Fundraisers", meta: `${state.fundraisers.length} listed` });
    return { items: items.filter((item) => !systemSettings().hiddenAttendanceCategories.includes(item.type)) };
  }

  const first = path[0].type;
  if (first === "category" && path.length === 1) {
    const items = [];
    if (fullAccess || currentBandSections().some((section) => permissions[section])) {
      items.push({ type: "ensemble", label: "Marching Band", meta: "Sections" });
    }
    if (fullAccess || permissions["Concert Band"]) {
      items.push({ type: "event", label: "Concert Band", meta: "Ensemble", eventKind: "band", eventId: "concert-band", staticOnly: adminMode });
    }
    if (fullAccess || permissions["Symphonic Band"]) {
      items.push({ type: "event", label: "Symphonic Band", meta: "Ensemble", eventKind: "band", eventId: "symphonic-band", staticOnly: adminMode });
    }
    if (fullAccess) {
      for (const item of state.customBandEnsembles) {
        items.push({
          type: "event",
          label: item.title,
          meta: "Band ensemble",
          eventKind: "custom-band",
          eventId: item.id,
          deleteAction: adminMode ? "delete-custom-band" : "",
          deleteValue: item.id,
          staticOnly: adminMode,
        });
      }
    }
    return { items: items.filter((item) => !systemSettings().inactiveEnsembles.includes(item.eventId || "marching-band")) };
  }

  if (first === "category" && path[1]?.type === "ensemble" && path.length === 2) {
    return {
      items: currentBandSections()
        .filter((section) => fullAccess || permissions[section])
        .map((section) => ({
          type: "event",
          label: section,
          meta: "Marching Band section",
          eventKind: "band",
          eventId: `marching-${slug(section)}`,
          staticOnly: adminMode,
        })),
    };
  }

  if (first === "business" && path.length === 1) {
    return {
      items: businessMeetingItems(adminMode),
    };
  }

  if (first === "committees" && path.length === 1) {
    return {
      items: allCommittees().map((committee) => {
        const setting = committeeSetting(committee);
        const custom = state.customCommittees.find((item) => item.title === committee);
        return {
          type: "event",
          label: committee,
          meta: `${weekDays[Number(setting.day)]}s, ${formatMeetingTime(setting.time)}`,
          eventKind: "committee",
          eventId: `committee-${slug(committee)}`,
          deleteAction: custom && adminMode ? "delete-custom-committee" : "",
          deleteValue: custom?.id || "",
        };
      }),
    };
  }

  if ((first === "functions" || first === "fundraisers") && path.length === 1) {
    const isFundraiser = first === "fundraisers";
    return {
      items: (isFundraiser ? state.fundraisers : state.functions)
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .map((item) => ({
          type: "event",
          label: item.title,
          meta: `${prettyDate(item.date)} - ${(isFundraiser ? systemSettings().fundraisersMandatory : item.mandatory) ? "Mandatory" : "Optional"}`,
          eventKind: isFundraiser ? "fundraiser" : "function",
          eventId: item.id,
          date: item.date,
        })),
    };
  }

  const event = path[path.length - 1];
  return { finalEvent: event, items: [] };
}

function currentTermFridays() {
  const term = getTerm(todayISO());
  const range = getTermDateRange(term);
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const dates = [];
  const cursor = new Date(start);
  while (cursor.getDay() !== systemSettings().businessDay) cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    dates.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  const deletedDates = new Set(state.deletedBusinessMeetingDates || []);
  return dates.filter((date) => !deletedDates.has(date)).reverse();
}

function businessMeetingItems(adminMode) {
  const generated = currentTermFridays().map((date) => ({
    type: "event",
    label: `Business Meeting - ${prettyDate(date)}`,
    meta: `${weekDays[systemSettings().businessDay]}, ${formatMeetingTime(systemSettings().businessTime)}`,
    eventKind: "business",
    eventId: `business-${date}`,
    date,
    staticOnly: adminMode,
    deleteAction: adminMode ? "delete-business-meeting" : "",
    deleteValue: `generated:${date}`,
  }));
  const range = getTermDateRange(getTerm(todayISO()));
  const extra = state.extraBusinessMeetings
    .filter((item) => isInRange(item.date, range.start, range.end))
    .map((item) => ({
      type: "event",
      label: `${item.title} - ${prettyDate(item.date)}`,
      meta: formatMeetingTime(item.time),
      eventKind: "business",
      eventId: item.id,
      date: item.date,
      staticOnly: adminMode,
      deleteAction: adminMode ? "delete-business-meeting" : "",
      deleteValue: `extra:${item.id}`,
    }));
  return [...generated, ...extra].sort((a, b) => b.date.localeCompare(a.date));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderAttendanceEventForm(member, event) {
  const eventDate = event.date || todayISO();
  const existing = state.attendanceRecords.find(
    (record) => record.eventId === event.eventId && record.date === eventDate,
  );
  const recorder = existing
    ? state.members.find((item) => item.id === existing.recordingMemberId)
    : null;
  const locked = Boolean(existing && member.role !== "Admin");
  const members = membersForAttendanceEvent(event);
  const selectedStatuses = new Map((existing?.statuses || []).map((item) => [item.memberId, item.status]));

  return `
    ${existing ? `<div class="notice">Attendance Recorded by ${escapeHtml(formatMember(recorder || {}))}</div>` : ""}
    ${renderAttendanceSubmissionSummary(existing)}
    <form id="attendanceForm" class="stack">
      <input type="hidden" name="eventId" value="${escapeHtml(event.eventId)}">
      <input type="hidden" name="eventKind" value="${escapeHtml(event.eventKind)}">
      <input type="hidden" name="eventLabel" value="${escapeHtml(event.label)}">
      <label class="field">
        <span>Date</span>
        <input name="date" type="date" value="${eventDate}" ${event.date ? "readonly" : ""} ${locked ? "disabled" : ""}>
      </label>
      ${event.eventKind === "fundraiser" ? renderFundraiserAttendanceTable(members, existing, locked) : `<div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Status</th></tr></thead>
          <tbody>
            ${members
              .map(
                (item) => `
                  <tr>
                    <td>
                      ${escapeHtml(formatMember(item))}
                      ${selectedStatuses.get(item.id) ? `<span class="badge good">Recorded</span>` : ""}
                      <br><span class="muted">${escapeHtml(item.role)}</span>
                    </td>
                    <td>
                      <div class="segment" data-status-group="${item.id}">
                        ${attendanceStatuses
                          .map(
                            (status) => `
                              <button type="button" data-status-choice="${status}" class="${selectedStatuses.get(item.id) === status ? "active" : ""}" ${locked ? "disabled" : ""}>${status}</button>
                            `,
                          )
                          .join("")}
                      </div>
                      <input type="hidden" name="status:${item.id}" value="${escapeHtml(selectedStatuses.get(item.id) || "")}">
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>`}
      <label class="field">
        <span>Notes</span>
        <textarea name="notes" ${locked ? "disabled" : ""}>${escapeHtml(existing?.notes || "")}</textarea>
      </label>
      <div class="form-actions">
        <button class="primary" type="submit" ${locked ? "disabled" : ""}>Submit</button>
      </div>
    </form>
  `;
}

function attendanceStatusLabel(entry) {
  const shifts = fundraiserShiftStatuses(entry);
  if (!shifts.length) return entry.status;
  return `${shifts.map((status, index) => `Shift ${index + 1}: ${status}`).join(" · ")} · Extra Shifts Worked: ${entry.extraShifts || 0}`;
}

function renderFundraiserAttendanceTable(members, record, locked = false) {
  const saved = new Map((record?.statuses || []).map((entry) => [entry.memberId, entry]));
  const config = fundraiserConfiguration(record);
  return `
    <p class="muted">Record ${config.requiredShiftCount} shifts per member. ${config.fundraiserMandatory ? "Attendance is mandatory." : "Attendance is optional; absence deductions are waived."}</p>
    ${record && record.statuses.some((entry) => !fundraiserShiftStatuses(entry).length) ? `<p class="notice">This older record has one attendance status per member. Select each shift to update it.</p>` : ""}
    <div class="table-wrap"><table>
      <thead><tr><th>Member</th><th>Shifts</th></tr></thead>
      <tbody>${members.map((member) => {
        const entry = saved.get(member.id) || {};
        const extras = Number(entry.extraShifts || 0);
        const options = [...new Set([...Array.from({ length: 11 }, (_, index) => index), extras])].sort((a, b) => a - b);
        return `<tr>
          <td>${escapeHtml(formatMember(member))}<br><span class="muted">${escapeHtml(member.role)}</span></td>
          <td><div class="fundraiser-shifts">
            ${Array.from({length: config.requiredShiftCount}, (_, index) => index + 1).map((shift) => `<div class="fundraiser-shift-row">
              <span>Shift ${shift}</span>
              <div>
                <div class="segment" data-fundraiser-status-group="${escapeHtml(member.id)}-${shift}" role="group" aria-label="${escapeHtml(formatMember(member))} Shift ${shift}">
                  ${attendanceStatuses.map((status) => `<button type="button" data-fundraiser-status-choice="${status}" class="${fundraiserShiftStatuses(entry)[shift - 1] === status ? "active" : ""}" ${locked ? "disabled" : ""}>${status}</button>`).join("")}
                </div>
                <input type="hidden" name="shift${shift}:${escapeHtml(member.id)}" value="${escapeHtml(fundraiserShiftStatuses(entry)[shift - 1] || "")}">
              </div>
            </div>`).join("")}
            ${config.extraShiftsEnabled ? `<label class="field"><span>Extra Shifts Worked</span>
              <select name="extraShifts:${escapeHtml(member.id)}" data-extra-shifts aria-label="Extra Shifts Worked for ${escapeHtml(formatMember(member))}" ${locked ? "disabled" : ""}>
                ${options.map((count) => `<option value="${count}" ${extras === count ? "selected" : ""}>${count}</option>`).join("")}
                <option value="more">More…</option>
              </select>
            </label>` : ""}
          </div></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="notice" data-fundraiser-error role="alert" hidden></p>
  `;
}

function renderAttendanceSubmissionSummary(record) {
  if (!record) return "";
  const impactsByMember = new Map((record.points || []).map((impact) => [impact.memberId, impact]));
  const rows = (record.statuses || [])
    .map((status) => ({
      member: state.members.find((item) => item.id === status.memberId),
      status: attendanceStatusLabel(status),
      impact: impactsByMember.get(status.memberId),
    }))
    .filter((row) => row.member)
    .sort((a, b) => memberSort(a.member, b.member));

  if (!rows.length) return "";

  return `
    <section class="panel tight">
      <h3>Submitted Record</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Status</th><th>Points</th><th>Record</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(formatMember(row.member))}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td class="${pointClass(effectiveAttendancePoints(record, row.impact))}">${signedPoints(effectiveAttendancePoints(record, row.impact))}</td>
                    <td>${escapeHtml(row.impact?.note || row.status)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function membersForAttendanceEvent(event) {
  if (event.eventKind === "business") return [...state.members].sort(memberSort);
  if (event.eventKind === "function") return [...state.members].sort(memberSort);
  if (event.eventKind === "fundraiser") return [...state.members].sort(memberSort);
  if (event.eventKind === "custom-band") {
    const ensemble = state.customBandEnsembles.find((item) => item.id === event.eventId);
    return state.members.filter((member) => ensemble?.rosterMode !== "assigned" || member.assignments?.customEnsembles?.includes(event.eventId)).sort(memberSort);
  }
  if (event.eventKind === "committee") {
    const committee = event.label;
    return state.members.filter((member) => member.assignments?.committee === committee).sort(memberSort);
  }
  if (event.eventKind === "band") {
    const label = event.label;
    return state.members.filter((member) => {
      if (currentBandSections().includes(label)) {
        return member.assignments?.marchingBand && member.assignments?.section === label;
      }
      if (label === "Concert Band") return member.assignments?.concertBand;
      if (label === "Symphonic Band") return member.assignments?.symphonicBand;
      return false;
    }).sort(memberSort);
  }
  return [...state.members].sort(memberSort);
}

function memberSort(a, b) {
  return formatMember(a).localeCompare(formatMember(b));
}

function renderSubmitPoints(member) {
  if (!view.pointMode) {
    return `
      <div class="section-head">
        <div>
          <h1>Submit Points</h1>
          <p>Point record type</p>
        </div>
      </div>
      <div class="grid two">
        <button class="pill-button" data-point-mode="positive">
          <strong>Create Positive Point Record</strong>
          <span>Add points</span>
        </button>
        <button class="pill-button" data-point-mode="negative">
          <strong>Create Negative Point Record</strong>
          <span>Remove points</span>
        </button>
      </div>
    `;
  }

  const type = view.pointMode;
  const rules = sortedRules(type);
  const title = type === "positive" ? "Create Positive Point Record" : "Create Negative Point Record";
  return `
    <div class="section-head">
      <div>
        <h1>${title}</h1>
        <p>${type === "positive" ? "Positive actions" : "Negative actions"}</p>
      </div>
      <button class="secondary small-action" data-point-mode-clear>Back</button>
    </div>
    <form id="pointForm" class="panel">
      <div class="form-grid">
        <label class="field">
          <span>Name</span>
          <select name="memberId" required>
            <option value="">Select member</option>
            ${state.members
              .slice()
              .sort(memberSort)
              .map((item) => `<option value="${item.id}">${escapeHtml(formatMember(item))}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Action</span>
          <select name="actionId" required>
            <option value="">Select action</option>
            ${rules
              .map((rule) => `<option value="${rule.id}">${escapeHtml(rule.name)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field extra-shifts is-hidden-field">
          <span>How Many Extra Shifts Worked?</span>
          <input name="extraShifts" type="number" min="1" step="1" value="1">
        </label>
        ${
          member.role === "Admin"
            ? `
              <label class="field discretion-points is-hidden-field">
                <span>Discretion Point Amount</span>
                <input name="discretionPoints" type="number" step="1" value="${type === "positive" ? 1 : -1}">
              </label>
            `
            : ""
        }
      </div>
      <label class="field">
        <span>Notes</span>
        <textarea name="notes"></textarea>
      </label>
      <div class="form-actions">
        <button class="primary" type="submit">Submit</button>
      </div>
    </form>
  `;
}

function sortedRules(type) {
  const rules = state.pointRules[type].slice();
  if (type === "positive") {
    return rules.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  }
  return rules.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
}

function renderAdmin(member) {
  if (member.role !== "Admin") return "";
  return `
    <div class="section-head">
      <div>
        <h1>Admin</h1>
        <p>Attendance, points, members, and permissions</p>
      </div>
    </div>
    <div class="admin-tabs">
      <button class="${view.adminSection === "settings" ? "active" : ""}" data-admin-section="settings">Settings</button>
      <button class="${view.adminSection === "attendance" ? "active" : ""}" data-admin-section="attendance">Attendance Events</button>
      <button class="${view.adminSection === "points" ? "active" : ""}" data-admin-section="points">Point Assignments</button>
      <button class="${view.adminSection === "records" ? "active" : ""}" data-admin-section="records">Records</button>
      <button class="${view.adminSection === "members" ? "active" : ""}" data-admin-section="members">Member Info & Permissions</button>
    </div>
    ${renderAdminSection(member)}
  `;
}

function renderAdminSection(member) {
  if (member.role !== "Admin") return "";
  if (view.adminSection === "settings") return renderSystemSettings();
  if (view.adminSection === "attendance") return renderAdminAttendance(member);
  if (view.adminSection === "points") return renderAdminPointRules();
  if (view.adminSection === "records") return renderAdminRecords();
  return renderMemberAdmin();
}

function renderAdminAttendance(member) {
  const path = view.adminAttendancePath;
  return `
    <div class="section-head">
      <div>
        <h2>${escapeHtml(path.length ? path[path.length - 1].label : "Attendance Events")}</h2>
        <p>${escapeHtml(pathLabel(path) || "Manage attendance events")}</p>
      </div>
      <div class="toolbar">
        ${path.length ? `<button class="secondary small-action" data-admin-attendance-back>Back</button>` : ""}
        ${renderAdminAttendanceAddButton(path)}
      </div>
    </div>
    ${renderAttendanceLevel(member, path, true)}
  `;
}

function renderAdminAttendanceAddButton(path) {
  if (
    path.length === 0 ||
    (path.length === 1 && ["category", "business", "committees", "functions", "fundraisers"].includes(path[0].type))
  ) {
    return `<button class="primary small-action" data-add-attendance-event>Add</button>`;
  }
  return "";
}

function renderAdminAttendanceEvent(event) {
  if (event.eventKind === "function" || event.eventKind === "fundraiser") {
    const items = event.eventKind === "fundraiser" ? state.fundraisers : state.functions;
    const item = items.find((item) => item.id === event.eventId);
    return item ? renderFunctionEditor(item, event.eventKind) : `<div class="empty">Event not found.</div>`;
  }

  if (event.eventKind === "committee") {
    return renderCommitteeEditor(event.label);
  }

  if (event.eventKind !== "function") {
    return `
      <section class="panel">
        <h3>${escapeHtml(event.label)}</h3>
        <div class="empty">No admin setup needed for this event.</div>
      </section>
    `;
  }

  return `<div class="empty">Function not found.</div>`;
}

function renderFunctionEditor(item, eventKind = "function") {
  const isFundraiser = eventKind === "fundraiser";
  const title = isFundraiser ? "Fundraiser" : "Function";
  return `
    <form id="functionEditForm" class="panel" data-event-kind="${eventKind}">
      <input type="hidden" name="functionId" value="${item.id}">
      <div class="form-grid">
        <label class="field">
          <span>${title} Title</span>
          <input name="title" value="${escapeHtml(item.title)}" aria-label="${title} title">
        </label>
        <label class="field">
          <span>Date</span>
          <input name="date" type="date" value="${escapeHtml(item.date || todayISO())}">
        </label>
        ${isFundraiser ? `<p class="muted">${systemSettings().fundraisersMandatory ? "Fundraisers are mandatory." : "Fundraisers are optional."} Change this in Admin → Settings.</p>` : `<label class="field">
          <span>Function Type</span>
          <select name="mandatory" aria-label="Function type">
          <option value="true" ${item.mandatory ? "selected" : ""}>Mandatory</option>
          <option value="false" ${!item.mandatory ? "selected" : ""}>Optional</option>
          </select>
        </label>`}
      </div>
      <div class="form-actions">
        <button class="secondary small-action" type="submit">Update</button>
        <button class="danger small-action" type="button" data-delete-function="${item.id}" data-event-kind="${eventKind}">Delete</button>
      </div>
    </form>
  `;
}

function renderCommitteeEditor(label) {
  const setting = committeeSetting(label);
  const occurrences = committeeOccurrences(label);
  return `
    <form id="committeeSettingsForm" class="panel">
      <input type="hidden" name="committee" value="${escapeHtml(label)}">
      <div class="form-grid">
        <label class="field">
          <span>Weekly Meeting Day</span>
          <select name="day">
            ${weekDays.map((day, index) => `<option value="${index}" ${Number(setting.day) === index ? "selected" : ""}>${day}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Weekly Meeting Time</span>
          <input name="time" type="time" value="${escapeHtml(setting.time || "13:30")}">
        </label>
      </div>
      <div class="form-actions">
        <button class="secondary small-action" type="submit">Update</button>
      </div>
    </form>
    <section class="panel">
      <h3>Meeting Occurrences</h3>
      ${
        occurrences.length
          ? `
            <div class="button-list">
              ${occurrences
                .map(
                  (date) => `
                    <div class="button-list-row">
                      <div class="pill-button is-static">
                        <strong>${escapeHtml(`${label} - ${prettyDate(date)}`)}</strong>
                        <span>${escapeHtml(`${weekDays[Number(setting.day)]}, ${formatMeetingTime(setting.time)}`)}</span>
                      </div>
                      <button class="icon-button danger row-delete" data-delete-committee-occurrence="${escapeHtml(label)}" data-date="${date}">Delete</button>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `
          : `<div class="empty">No meeting occurrences for this term.</div>`
      }
    </section>
  `;
}

function committeeOccurrences(label) {
  const setting = committeeSetting(label);
  const range = getTermDateRange(getTerm(todayISO()));
  const deletedDates = new Set(setting.deletedDates || []);
  const dates = [];
  const cursor = parseDate(range.start);
  const targetDay = Number(setting.day);
  while (cursor.getDay() !== targetDay) cursor.setDate(cursor.getDate() + 1);
  const end = parseDate(range.end);
  while (cursor <= end) {
    const iso = toISO(cursor);
    if (!deletedDates.has(iso)) dates.push(iso);
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates.sort((a, b) => b.localeCompare(a));
}

function renderAdminPointRules() {
  return `
    <div id="rulesForm" class="grid two">
      <section class="panel">
        <div class="panel-heading">
          <h3>Positive</h3>
          <button class="icon-button" data-edit-rules="positive" aria-label="Edit positive point assignments">Edit</button>
        </div>
        ${sortedRules("positive")
          .map(
            (rule) => `
              <div class="rule-row">
                <span>${escapeHtml(rule.name)}</span>
                ${
                  rule.value === null
                    ? `<span class="badge">No default</span>`
                    : `<input data-rule-input data-rule-type="positive" data-rule-id="${rule.id}" type="number" step="1" value="${rule.value}">`
                }
              </div>
            `,
          )
          .join("")}
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h3>Negative</h3>
          <button class="icon-button" data-edit-rules="negative" aria-label="Edit negative point assignments">Edit</button>
        </div>
        ${sortedRules("negative")
          .map(
            (rule) => `
              <div class="rule-row">
                <span>${escapeHtml(rule.name)}</span>
                ${
                  rule.value === null
                    ? `<span class="badge">No default</span>`
                    : `<input data-rule-input data-rule-type="negative" data-rule-id="${rule.id}" type="number" step="1" value="${rule.value}">`
                }
              </div>
            `,
          )
          .join("")}
      </section>
    </div>
  `;
}

function renderAdminRecords() {
  const path = view.adminRecordsPath;
  return `
    <div class="section-head">
      <div>
        <h2>${escapeHtml(path.length ? path[path.length - 1].label : "Records")}</h2>
        <p>${escapeHtml(pathLabel(path) || `${state.attendanceRecords.length + state.pointRecords.length} stored records`)}</p>
      </div>
      ${path.length ? `<button class="secondary small-action" data-admin-records-back>Back</button>` : ""}
    </div>
    ${path.length ? periodDownloadButton({...path[path.length - 1], ...(path.length === 3 ? {term:path[1].label} : {})}) : ""}
    <div class="admin-records-view">
      ${renderAdminRecordLevel(path)}
    </div>
  `;
}

function renderAdminRecordLevel(path) {
  const timeline = availableRecordTimeline();

  if (path.length === 0) {
    return renderButtonList(
      timeline.map((item) => ({
        label: item.year,
        meta: `${item.count} record${item.count === 1 ? "" : "s"}`,
        action: "admin-record-pick",
        value: JSON.stringify({ type: "year", label: item.year }),
      })),
      "No records have been submitted yet.",
    );
  }

  if (path.length === 1) {
    const year = timeline.find((item) => item.year === path[0].label);
    return renderButtonList(
      (year?.terms || []).map((term) => ({
        label: term.label,
        meta: `${term.count} record${term.count === 1 ? "" : "s"}`,
        action: "admin-record-pick",
        value: JSON.stringify({ type: "term", label: term.label }),
      })),
      "No terms with records yet.",
    );
  }

  if (path.length === 2) {
    const weeks = availableRecordWeeks(path[1].label);
    return renderButtonList(
      weeks.map((week) => ({
        label: week.label,
        meta: `${week.count} record${week.count === 1 ? "" : "s"}`,
        action: "admin-record-pick",
        value: JSON.stringify({ type: "week", label: week.label, id: week.id, start: week.start, end: week.end }),
      })),
      "No weeks with records yet.",
    );
  }

  const selectedWeek = normalizeWeekSelection(path[2]);
  const termRange = getTermDateRange(path[1].label);
  return renderAdminRecordList(adminRecordsForRange(selectedWeek.start > termRange.start ? selectedWeek.start : termRange.start, selectedWeek.end < termRange.end ? selectedWeek.end : termRange.end));
}

function availableRecordTimeline() {
  const years = new Map();
  for (const date of recordDates()) {
    const year = getAcademicYear(date);
    const term = getTerm(date);
    if (!years.has(year)) years.set(year, { count: 0, terms: new Map() });
    const yearEntry = years.get(year);
    yearEntry.count += 1;
    if (!yearEntry.terms.has(term)) yearEntry.terms.set(term, 0);
    yearEntry.terms.set(term, yearEntry.terms.get(term) + 1);
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, entry]) => ({
      year,
      count: entry.count,
      terms: [...entry.terms.entries()]
        .sort((a, b) => termSortValue(b[0]) - termSortValue(a[0]))
        .map(([label, count]) => ({ label, count })),
    }));
}

function recordDates() {
  return [
    ...state.pointRecords.map((record) => record.date),
    ...state.attendanceRecords.map((record) => record.date),
  ].filter(Boolean);
}

function availableRecordWeeks(termLabel) {
  const range = getTermDateRange(termLabel);
  const weeks = new Map();
  for (const date of recordDates().filter((item) => isInRange(item, range.start, range.end))) {
    const week = getWeekRange(date);
    const existing = weeks.get(week.id) || { ...week, count: 0 };
    existing.count += 1;
    weeks.set(week.id, existing);
  }
  return [...weeks.values()].sort((a, b) => b.id.localeCompare(a.id));
}

function adminRecordsForRange(start, end) {
  const pointEntries = state.pointRecords
    .filter((record) => isInRange(record.date, start, end))
    .map((record) => ({
      id: record.id,
      recordType: "point",
      source: "Point Record",
      title: record.actionName,
      memberId: record.memberId,
      date: record.date,
      createdAt: record.createdAt,
      recordingMemberId: record.recordingMemberId,
      notes: record.notes,
      points: record.points,
    }));

  const attendanceEntries = state.attendanceRecords
    .filter((record) => isInRange(record.date, start, end))
    .map((record) => ({
      id: record.id,
      recordType: "attendance",
      source: "Attendance",
      title: record.eventLabel,
      memberCount: (record.statuses || []).length,
      statusSummary: attendanceStatusSummary(record.statuses || []),
      date: record.date,
      createdAt: record.createdAt,
      recordingMemberId: record.recordingMemberId,
      notes: record.notes,
    }));

  return [...pointEntries, ...attendanceEntries].sort(sortAdminRecordEntries);
}

function sortAdminRecordEntries(a, b) {
  return (
    String(b.date || "").localeCompare(String(a.date || "")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

function attendanceStatusSummary(statuses) {
  const counts = new Map(attendanceStatuses.map((status) => [status, 0]));
  for (const entry of statuses) {
    for (const status of fundraiserShiftStatuses(entry).length ? fundraiserShiftStatuses(entry) : [entry.status]) {
      counts.set(status, (counts.get(status) || 0) + 1);
    }
  }
  return (statuses.some((entry) => fundraiserShiftStatuses(entry).length) ? "Shifts — " : "") + attendanceStatuses
    .filter((status) => counts.get(status))
    .map((status) => `${status}: ${counts.get(status)}`)
    .join(" / ");
}

function renderAdminRecordList(records) {
  if (currentMember()?.role !== "Admin") return "";
  if (!records.length) return `<div class="empty">No records in this week.</div>`;
  return `
    <div class="record-list admin-record-list">
      ${records
        .map((record) => {
          const member = state.members.find((item) => item.id === record.memberId);
          const recorder = state.members.find((item) => item.id === record.recordingMemberId);
          const details =
            record.recordType === "point"
              ? `${formatMember(member || {})} - ${signedPoints(record.points)}`
              : `${record.memberCount} member record${record.memberCount === 1 ? "" : "s"}${record.statusSummary ? ` - ${record.statusSummary}` : ""}`;
          return `
            <article class="record-item admin-record-item">
              <div class="record-main">
                <strong>${escapeHtml(record.title)}</strong>
                <span class="badge">${escapeHtml(record.source)}</span>
              </div>
              <div class="${record.recordType === "point" ? pointClass(record.points) : ""}">${escapeHtml(details)}</div>
              <div class="muted">${prettyDate(record.date)} at ${prettyTime(record.createdAt)} - Recorded by ${escapeHtml(formatMember(recorder || {}))}</div>
              ${record.notes ? `<div class="muted">${escapeHtml(record.notes)}</div>` : ""}
              ${record.recordType === "attendance" ? renderAttendanceLetterApprovals(record.id) : ""}
              <div class="record-actions">
                <button class="secondary small-action" data-edit-record-type="${record.recordType}" data-edit-record-id="${record.id}">Edit</button>
                <button class="danger small-action" data-delete-admin-record-type="${record.recordType}" data-delete-admin-record-id="${record.id}">Delete</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function hasApprovedAttendanceLetter(record, impact) {
  return attendanceDeductionPoints(impact) < 0 && record.approvedLetterMemberIds?.includes(impact.memberId) === true;
}

function attendanceDeductionPoints(impact) {
  return Math.min(0, Number(impact?.penaltyPoints ?? impact?.points ?? 0));
}

function effectiveAttendancePoints(record, impact) {
  const points = Number(impact?.points || 0);
  return hasApprovedAttendanceLetter(record, impact) ? points - attendanceDeductionPoints(impact) : points;
}

function renderAttendanceLetterApprovals(recordId) {
  if (currentMember()?.role !== "Admin") return "";
  const record = state.attendanceRecords.find((item) => item.id === recordId);
  if (!record) return "";
  return (record.points || [])
    .filter((impact) => attendanceDeductionPoints(impact) < 0)
    .map((impact) => {
      const member = state.members.find((item) => item.id === impact.memberId);
      return `
        <div class="attendance-letter-row">
          <span>${escapeHtml(member ? formatMember(member) : "Former member")} <span class="${pointClass(effectiveAttendancePoints(record, impact))}">(${signedPoints(effectiveAttendancePoints(record, impact))}${record.approvedLetterMemberIds?.includes(impact.memberId) ? `; ${signedPoints(attendanceDeductionPoints(impact))} waived` : ""})</span></span>
          <label class="check-row approved-letter-control">
            <input type="checkbox" data-approved-letter-record="${escapeHtml(record.id)}" data-approved-letter-member="${escapeHtml(impact.memberId)}" ${record.approvedLetterMemberIds?.includes(impact.memberId) ? "checked" : ""}>
            <span>Approved Letter</span>
          </label>
        </div>
      `;
    })
    .join("");
}

function setAttendanceLetterApproval(recordId, memberId, approved) {
  const admin = currentMember();
  if (admin?.role !== "Admin") return false;
  const record = state.attendanceRecords.find((item) => item.id === recordId);
  if (!record?.points?.some((impact) => impact.memberId === memberId && attendanceDeductionPoints(impact) < 0)) return false;
  const approvals = new Set(record.approvedLetterMemberIds || []);
  if (approved) approvals.add(memberId);
  else approvals.delete(memberId);
  record.approvedLetterMemberIds = [...approvals];
  record.updatedAt = new Date().toISOString();
  record.updatedByMemberId = admin.id;
  saveState();
  return true;
}

// Keep approval only while the same member still has the approved attendance status
// and a negative impact. Resubmitting attendance must not erase an unchanged approval.
function retainedAttendanceLetterApprovals(previous, next) {
  return (previous?.approvedLetterMemberIds || []).filter((memberId) =>
    next.points.some((impact) => impact.memberId === memberId && attendanceDeductionPoints(impact) < 0) &&
    previous.statuses.some((item) => item.memberId === memberId &&
      next.statuses.some((status) => status.memberId === memberId && status.status === item.status &&
        JSON.stringify(fundraiserShiftStatuses(status)) === JSON.stringify(fundraiserShiftStatuses(item)))),
  );
}

function renderMemberAdmin() {
  const grouped = roles.map((role) => ({
    role,
    members: state.members.filter((member) => member.role === role).sort(memberSort),
  }));

  return `
    <div class="grid">
      ${grouped
        .map(
          (group) => `
            <section class="panel">
              <h3>${escapeHtml(group.role)}</h3>
              ${
                group.members.length
                  ? group.members
                      .map(
                        (member) => `
                          <button class="member-button" data-edit-member="${member.id}">
                            <span>${escapeHtml(formatMember(member))}</span>
                            <span class="badge ${member.status === "Conditional" ? "warn" : "good"}">${escapeHtml(member.status)}</span>
                          </button>
                        `,
                      )
                      .join("")
                  : `<div class="empty">No members yet.</div>`
              }
            </section>
          `,
        )
        .join("")}
    </div>
    <button class="floating-add" data-add-member aria-label="Add member">+</button>
  `;
}

function renderModal(member) {
  if (view.modal.type === "member") return renderMemberModal(view.modal.memberId);
  if (view.modal.type === "function") return renderFunctionModal();
  if (view.modal.type === "attendanceEvent") return renderAttendanceEventModal(view.modal.context || {});
  if (view.modal.type === "pointRules") return renderPointRulesModal(view.modal.ruleType);
  if (view.modal.type === "record") return renderRecordEditModal(view.modal.recordType, view.modal.recordId);
  if (view.modal.type === "email") return renderEmailModal(view.modal.alertId);
  return "";
}

function renderMemberModal(memberId) {
  const isNew = !memberId;
  const member =
    state.members.find((item) => item.id === memberId) ||
    {
      id: "",
      firstName: "",
      lastName: "",
      email: "",
      buffId: "",
      status: "Active",
      role: "Brother",
      assignments: {
        marchingBand: false,
        section: "Woodwinds",
        concertBand: false,
        symphonicBand: false,
        committee: "M&E",
      },
      attendancePermissions: emptyAttendancePermissions(),
    };

  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal" id="memberForm" data-modal-card>
        <h2>${isNew ? "Add Member" : escapeHtml(formatMember(member))}</h2>
        <input type="hidden" name="memberId" value="${escapeHtml(member.id)}">
        <div class="form-grid">
          ${textInput("First Name", "firstName", member.firstName)}
          ${textInput("Last Name", "lastName", member.lastName)}
          ${textInput("School Email", "email", member.email, "email")}
          ${textInput("Buff ID", "buffId", member.buffId)}
          <label class="field status-field" ${member.role === "Brother" ? "" : `style="display:none"`}>
            <span>Status</span>
            <select name="status">
              ${statuses.map((status) => `<option value="${escapeHtml(status)}" ${member.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
            </select>
          </label>
          ${selectInput("Permission Set", "role", roles, member.role)}
        </div>
        <div class="notice">Login will be created from this member's School Email and Buff ID.</div>
        <div class="divider"></div>
        <h3>Assignments</h3>
        <div class="stack">
          <details class="assignment-details" open>
            <summary>Band Ensembles</summary>
            <div class="form-grid assignment-inner-grid">
              <div class="assignment-group">
                ${checkboxInput("Marching Band", "marchingBand", member.assignments.marchingBand)}
                <div class="marching-section-field" ${member.assignments.marchingBand ? "" : `style="display:none"`}>
                  ${selectInput("Marching Band Section Assignment", "section", currentBandSections(), member.assignments.section)}
                </div>
              </div>
              ${checkboxInput("Concert Band", "concertBand", member.assignments.concertBand)}
              ${checkboxInput("Symphonic Band", "symphonicBand", member.assignments.symphonicBand)}
              ${state.customBandEnsembles.map((ensemble) => checkboxInput(ensemble.title, `customEnsemble:${ensemble.id}`, member.assignments.customEnsembles?.includes(ensemble.id))).join("")}
            </div>
          </details>
          <div class="form-grid">
            ${selectInput("Committee Assignment", "committee", allCommittees(), member.assignments.committee)}
          </div>
        </div>
        <div id="attendancePermissionsBlock">
          ${renderAttendancePermissions(member)}
        </div>
        <div class="form-actions">
          <button class="primary" type="submit">Submit</button>
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
          ${isNew ? "" : `<button class="danger" type="button" data-delete-member="${member.id}">Delete</button>`}
        </div>
      </form>
    </div>
  `;
}

function textInput(label, name, value, type = "text") {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" required>
    </label>
  `;
}

function selectInput(label, name, options, selected) {
  options = [...new Set([...options, ...(selected && !options.includes(selected) ? [selected] : [])])];
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select name="${name}">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function checkboxInput(label, name, checked) {
  return `
    <label class="check-row">
      <input name="${name}" type="checkbox" ${checked ? "checked" : ""}>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderAttendancePermissions(member) {
  const shouldShow = member.role === "Brother";
  return `
    <div class="attendance-permissions-content" ${shouldShow ? "" : `style="display:none"`}>
      <div class="divider"></div>
      <h3>Attendance Permissions</h3>
      <div class="grid two">
        <section class="panel tight">
          <h4>Marching Band</h4>
          ${currentBandSections().map((section) => permissionRow(section, member.attendancePermissions?.[section])).join("")}
        </section>
        <section class="panel tight">
          <h4>Concert Band</h4>
          ${permissionRow("Concert Band", member.attendancePermissions?.["Concert Band"], false)}
          <h4>Symphonic Band</h4>
          ${permissionRow("Symphonic Band", member.attendancePermissions?.["Symphonic Band"], false)}
        </section>
      </div>
    </div>
  `;
}

function permissionRow(label, enabled, showLabel = true) {
  return `
    <div class="list-row permission-row ${showLabel ? "" : "no-label"}">
      ${showLabel ? `<span>${escapeHtml(label)}</span>` : ""}
      <div class="segment two" data-permission-group="${escapeHtml(label)}">
        <button type="button" data-permission-choice="true" class="${enabled ? "active" : ""}">YES</button>
        <button type="button" data-permission-choice="false" class="${!enabled ? "active" : ""}">NO</button>
      </div>
      <input type="hidden" name="permission:${escapeHtml(label)}" value="${enabled ? "true" : "false"}">
    </div>
  `;
}

function renderFunctionModal() {
  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal" id="functionForm" data-modal-card>
        <h2>Add Function</h2>
        <label class="field">
          <span>Function Title</span>
          <input name="title" required>
        </label>
        <label class="field">
          <span>Date</span>
          <input name="date" type="date" value="${todayISO()}" required>
        </label>
        <label class="field">
          <span>Function Type</span>
          <select name="mandatory">
            <option value="true" ${systemSettings().defaultFunctionMandatory ? "selected" : ""}>Mandatory</option>
            <option value="false" ${!systemSettings().defaultFunctionMandatory ? "selected" : ""}>Optional</option>
          </select>
        </label>
        <div class="form-actions">
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
          <button class="primary" type="submit">Add</button>
        </div>
      </form>
    </div>
  `;
}

function renderAttendanceEventModal(context) {
  const defaultType = attendanceAddTypeForPath(context.path || []);
  const showTypePicker = !context.path?.length;
  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal" id="attendanceEventForm" data-modal-card>
        <h2>Add Attendance Event</h2>
        ${
          showTypePicker
            ? `
              <label class="field">
                <span>Event Type</span>
                <select name="eventType">
                  <option value="band" ${defaultType === "band" ? "selected" : ""}>Band Ensemble</option>
                  <option value="business" ${defaultType === "business" ? "selected" : ""}>Business Meeting</option>
                  <option value="committee" ${defaultType === "committee" ? "selected" : ""}>Committee</option>
                  <option value="function" ${defaultType === "function" ? "selected" : ""}>Function</option>
                  <option value="fundraiser" ${defaultType === "fundraiser" ? "selected" : ""}>Fundraiser</option>
                </select>
              </label>
            `
            : `<input type="hidden" name="eventType" value="${defaultType}">`
        }
        <label class="field">
          <span>Title</span>
          <input name="title" required>
        </label>
        <label class="field event-date-field">
          <span>Date</span>
          <input name="date" type="date" value="${todayISO()}">
        </label>
        <label class="field event-time-field">
          <span>Time</span>
          <input name="time" type="time" value="13:30">
        </label>
        ${defaultType === "fundraiser" ? `<p class="muted">${systemSettings().fundraisersMandatory ? "Fundraisers are mandatory." : "Fundraisers are optional."} Change this in Admin → Settings.</p>` : `<label class="field function-type-field">
          <span>Function Type</span>
          <select name="mandatory">
            <option value="true" ${systemSettings().defaultFunctionMandatory ? "selected" : ""}>Mandatory</option>
            <option value="false" ${!systemSettings().defaultFunctionMandatory ? "selected" : ""}>Optional</option>
          </select>
        </label>`}
        <div class="form-actions">
          <button class="primary" type="submit">Add</button>
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function attendanceAddTypeForPath(path) {
  const first = path[0]?.type;
  if (first === "category") return "band";
  if (first === "business") return "business";
  if (first === "committees") return "committee";
  if (first === "functions") return "function";
  if (first === "fundraisers") return "fundraiser";
  return "function";
}

function renderPointRulesModal(type) {
  const title = type === "positive" ? "Positive Point Assignments" : "Negative Point Assignments";
  const rules = state.pointRules[type] || [];
  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal" id="pointRulesEditor" data-rule-type="${type}" data-modal-card>
        <h2>${title}</h2>
        <div class="stack">
          ${rules
            .map(
              (rule) => `
                <div class="rule-edit-row">
                  <input type="hidden" name="id:${rule.id}" value="${rule.id}">
                  <label class="field">
                    <span>Assignment</span>
                    <input name="name:${rule.id}" value="${escapeHtml(rule.name)}">
                  </label>
                  ${
                    rule.value === null
                      ? `<span class="badge">No default</span>`
                      : `
                        <label class="field">
                          <span>Points</span>
                          <input name="value:${rule.id}" type="number" step="1" value="${rule.value}">
                        </label>
                      `
                  }
                  <button class="danger small-action" type="button" data-delete-rule="${rule.id}" data-rule-type="${type}">Delete</button>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="divider"></div>
        <h3>Add Point Assignment</h3>
        <div class="rule-edit-row">
          <label class="field">
            <span>Assignment</span>
            <input name="newName">
          </label>
          <label class="field">
            <span>Points</span>
            <input name="newValue" type="number" step="1" value="${type === "positive" ? 1 : -1}">
          </label>
        </div>
        <div class="form-actions">
          <button class="primary" type="submit">Submit</button>
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function renderRecordEditModal(recordType, recordId) {
  if (recordType === "point") {
    const record = state.pointRecords.find((item) => item.id === recordId);
    return record ? renderPointRecordEditModal(record) : "";
  }
  if (recordType === "attendance") {
    const record = state.attendanceRecords.find((item) => item.id === recordId);
    return record ? renderAttendanceRecordEditModal(record) : "";
  }
  return "";
}

function renderPointRecordEditModal(record) {
  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal" id="pointRecordEditForm" data-modal-card>
        <h2>Edit Point Record</h2>
        <input type="hidden" name="recordId" value="${escapeHtml(record.id)}">
        <div class="form-grid">
          <label class="field">
            <span>Member</span>
            <select name="memberId" required>
              ${state.members
                .slice()
                .sort(memberSort)
                .map((item) => `<option value="${item.id}" ${record.memberId === item.id ? "selected" : ""}>${escapeHtml(formatMember(item))}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Date</span>
            <input name="date" type="date" value="${escapeHtml(record.date || todayISO())}" required>
          </label>
          <label class="field">
            <span>Record</span>
            <input name="actionName" value="${escapeHtml(record.actionName || "Point Record")}" required>
          </label>
          <label class="field">
            <span>Points</span>
            <input name="points" type="number" step="1" value="${Number(record.points || 0)}" required>
          </label>
        </div>
        <label class="field">
          <span>Notes</span>
          <textarea name="notes">${escapeHtml(record.notes || "")}</textarea>
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">Save</button>
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
          <button class="danger" type="button" data-delete-modal-record-type="point" data-delete-modal-record-id="${record.id}">Delete</button>
        </div>
      </form>
    </div>
  `;
}

function renderAttendanceRecordEditModal(record) {
  const members = attendanceRecordMembers(record);
  const selectedStatuses = new Map((record.statuses || []).map((item) => [item.memberId, item.status]));
  return `
    <div class="modal-backdrop" data-close-modal>
      <form class="modal wide-modal" id="attendanceRecordEditForm" data-modal-card>
        <h2>Edit Attendance Record</h2>
        <input type="hidden" name="recordId" value="${escapeHtml(record.id)}">
        <input type="hidden" name="eventId" value="${escapeHtml(record.eventId)}">
        <input type="hidden" name="eventKind" value="${escapeHtml(record.eventKind)}">
        <div class="form-grid">
          <label class="field">
            <span>Event</span>
            <input name="eventLabel" value="${escapeHtml(record.eventLabel)}" required>
          </label>
          <label class="field">
            <span>Date</span>
            <input name="date" type="date" value="${escapeHtml(record.date || todayISO())}" required>
          </label>
        </div>
        ${record.eventKind === "fundraiser" ? renderFundraiserAttendanceTable(members, record) : `<div class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Status</th></tr></thead>
            <tbody>
              ${members
                .map(
                  (item) => `
                    <tr>
                      <td>
                        ${escapeHtml(formatMember(item))}
                        <br><span class="muted">${escapeHtml(item.role)}</span>
                      </td>
                      <td>
                        <div class="segment" data-record-status-group="${item.id}">
                          ${attendanceStatuses
                            .map(
                              (status) => `
                                <button type="button" data-record-status-choice="${status}" class="${selectedStatuses.get(item.id) === status ? "active" : ""}">${status}</button>
                              `,
                            )
                            .join("")}
                        </div>
                        <input type="hidden" name="status:${item.id}" value="${escapeHtml(selectedStatuses.get(item.id) || "")}">
                      </td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>`}
        <label class="field">
          <span>Notes</span>
          <textarea name="notes">${escapeHtml(record.notes || "")}</textarea>
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">Save</button>
          <button class="ghost" type="button" data-close-modal-button>Cancel</button>
          <button class="danger" type="button" data-delete-modal-record-type="attendance" data-delete-modal-record-id="${record.id}">Delete</button>
        </div>
      </form>
    </div>
  `;
}

function renderEmailModal(alertId) {
  const alert = state.alerts.find((item) => item.id === alertId);
  if (!alert) return "";
  const href = alertMailto(alert);
  return `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" data-modal-card>
        <h2>Email Ready to Send</h2>
        <p class="muted">${escapeHtml(alert.subject)}</p>
        <div class="panel tight">${escapeHtml(alert.body)}</div>
        <p class="muted">This local prototype opens a prefilled email. The message is sent after it opens in your mail app.</p>
        <div class="form-actions">
          <a class="secondary small-action" href="${href}" data-open-email="${alert.id}">Send Email</a>
          <button class="primary" type="button" data-close-modal-button>Done</button>
        </div>
      </div>
    </div>
  `;
}

function alertMailto(alert) {
  return `mailto:${encodeURIComponent(systemSettings().alertEmail)}?subject=${encodeURIComponent(alert.subject)}&body=${encodeURIComponent(alert.body)}`;
}

function bindAppEvents(member) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      view.tab = button.dataset.tab;
      view.trackerMemberId = null;
      render();
    });
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", () => {
    clearSession();
    view = {
      tab: "home",
      trackerPath: [],
      trackerMemberId: null,
      attendancePath: [],
      adminSection: "members",
      adminAttendancePath: [],
      adminRecordsPath: [],
      pointMode: null,
      editingMemberId: null,
      modal: null,
    };
    render();
  });

  bindTrackerEvents();
  bindAttendanceEvents(member);
  bindPointEvents(member);
  bindAdminEvents(member);
  bindModalEvents(member);
  bindFundraiserAttendanceEvents();
  bindSettingsAndReports(member);
}

function bindFundraiserAttendanceEvents() {
  bindSegmentButtons("fundraiser-status-group", "fundraiser-status-choice");
  document.querySelectorAll("[data-extra-shifts]").forEach((select) => {
    let previousValue = select.value;
    select.addEventListener("change", () => {
      if (select.value !== "more") {
        previousValue = select.value;
        return;
      }
      const answer = window.prompt("How many extra shifts were worked?", "11");
      const count = Number(answer);
      if (answer === null || !Number.isSafeInteger(count) || count < 0) {
        select.value = previousValue;
        return;
      }
      if (![...select.options].some((option) => option.value === String(count))) {
        select.add(new Option(String(count), String(count)), select.options.length - 1);
      }
      select.value = String(count);
      previousValue = select.value;
    });
  });
}

function showAttendanceFormError(form, error) {
  const notice = form.querySelector("[data-fundraiser-error]");
  if (!notice) throw error;
  notice.textContent = error.message;
  notice.hidden = false;
}

function bindTrackerEvents() {
  document.querySelectorAll("[data-action='tracker-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      view.trackerPath.push(JSON.parse(button.dataset.value));
      view.trackerMemberId = null;
      render();
    });
  });
  document.querySelector("[data-tracker-back]")?.addEventListener("click", () => {
    view.trackerPath.pop();
    view.trackerMemberId = null;
    render();
  });
  document.querySelectorAll("[data-tracker-member]").forEach((button) => {
    button.addEventListener("click", () => {
      view.trackerMemberId = button.dataset.trackerMember;
      render();
    });
  });
  document.querySelector("[data-clear-tracker-member]")?.addEventListener("click", () => {
    view.trackerMemberId = null;
    render();
  });
}

function bindAttendanceEvents(member) {
  document.querySelectorAll("[data-action='attendance-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      view.attendancePath.push(JSON.parse(button.dataset.value));
      render();
    });
  });
  document.querySelector("[data-attendance-back]")?.addEventListener("click", () => {
    view.attendancePath.pop();
    render();
  });
  bindSegmentButtons("status-group", "status-choice");

  document.querySelector("#attendanceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!allowedTabs(currentMember()).some((tab) => tab.id === "attendance")) return;
    const form = new FormData(event.currentTarget);
    let record;
    try {
      record = createAttendanceRecord(form, member);
    } catch (error) {
      showAttendanceFormError(event.currentTarget, error);
      return;
    }
    const existingIndex = state.attendanceRecords.findIndex(
      (item) => item.eventId === record.eventId && item.date === record.date,
    );
    if (existingIndex >= 0) state.attendanceRecords.splice(existingIndex, 1, record);
    else state.attendanceRecords.push(record);
    const activeEvent = view.attendancePath[view.attendancePath.length - 1];
    if (activeEvent?.eventId === record.eventId) activeEvent.date = record.date;
    for (const impact of record.points) maybeCreateProbationAlert(impact.memberId);
    saveState();
    render();
  });
}

function bindPointEvents(member) {
  document.querySelectorAll("[data-point-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      view.pointMode = button.dataset.pointMode;
      render();
    });
  });
  document.querySelector("[data-point-mode-clear]")?.addEventListener("click", () => {
    view.pointMode = null;
    render();
  });
  const actionSelect = document.querySelector("#pointForm select[name='actionId']");
  actionSelect?.addEventListener("change", updatePointFormFields);
  updatePointFormFields();
  document.querySelector("#pointForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!allowedTabs(currentMember()).some((tab) => tab.id === "points")) return;
    const form = new FormData(event.currentTarget);
    const record = createPointRecord(form, member, view.pointMode);
    state.pointRecords.push(record);
    maybeCreateDiscretionAlert(record);
    maybeCreateProbationAlert(record.memberId);
    saveState();
    view.pointMode = null;
    render();
  });
}

function updatePointFormFields() {
  const form = document.querySelector("#pointForm");
  if (!form) return;
  const actionId = form.querySelector("select[name='actionId']").value;
  form.querySelector(".extra-shifts")?.classList.toggle("is-hidden-field", actionId !== "multiple-fundraiser-shifts");
  const discretion = actionId === "exec-discretion-positive" || actionId === "exec-discretion-negative";
  form.querySelector(".discretion-points")?.classList.toggle("is-hidden-field", !discretion);
}

function bindAdminEvents(member) {
  document.querySelectorAll("[data-approved-letter-record]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      setAttendanceLetterApproval(checkbox.dataset.approvedLetterRecord, checkbox.dataset.approvedLetterMember, checkbox.checked);
      render();
    });
  });
  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.addEventListener("click", () => {
      view.adminSection = button.dataset.adminSection;
      view.adminAttendancePath = [];
      view.adminRecordsPath = [];
      render();
    });
  });

  document.querySelectorAll("[data-action='admin-record-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      view.adminRecordsPath.push(JSON.parse(button.dataset.value));
      render();
    });
  });
  document.querySelector("[data-admin-records-back]")?.addEventListener("click", () => {
    view.adminRecordsPath.pop();
    render();
  });
  document.querySelectorAll("[data-edit-record-type]").forEach((button) => {
    button.addEventListener("click", () => {
      view.modal = {
        type: "record",
        recordType: button.dataset.editRecordType,
        recordId: button.dataset.editRecordId,
      };
      render();
    });
  });
  document.querySelectorAll("[data-delete-admin-record-type]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteRecord(button.dataset.deleteAdminRecordType, button.dataset.deleteAdminRecordId);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='admin-attendance-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      view.adminAttendancePath.push(JSON.parse(button.dataset.value));
      render();
    });
  });
  document.querySelector("[data-admin-attendance-back]")?.addEventListener("click", () => {
    view.adminAttendancePath.pop();
    render();
  });
  document.querySelector("[data-add-attendance-event]")?.addEventListener("click", () => {
    view.modal = { type: "attendanceEvent", context: { path: view.adminAttendancePath.slice() } };
    render();
  });

  document.querySelectorAll("[data-action='delete-business-meeting']").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.value || "";
      const [kind, id] = value.split(":");
      if (!id) return;
      if (kind === "generated") {
        if (!state.deletedBusinessMeetingDates.includes(id)) {
          state.deletedBusinessMeetingDates.push(id);
        }
        state.attendanceRecords = state.attendanceRecords.filter(
          (record) => !(record.eventKind === "business" && record.date === id),
        );
      } else {
        state.extraBusinessMeetings = state.extraBusinessMeetings.filter((item) => item.id !== id);
        state.attendanceRecords = state.attendanceRecords.filter((record) => record.eventId !== id);
      }
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='delete-custom-band']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.value;
      state.customBandEnsembles = state.customBandEnsembles.filter((item) => item.id !== id);
      state.attendanceRecords = state.attendanceRecords.filter((record) => record.eventId !== id);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='delete-custom-committee']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.value;
      const committee = state.customCommittees.find((item) => item.id === id);
      state.customCommittees = state.customCommittees.filter((item) => item.id !== id);
      if (committee) {
        delete state.committeeSettings[committeeKey(committee.title)];
        state.attendanceRecords = state.attendanceRecords.filter(
          (record) => record.eventId !== `committee-${slug(committee.title)}`,
        );
      }
      saveState();
      render();
    });
  });

  document.querySelector("#functionEditForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (currentMember()?.role !== "Admin") return;
    const isFundraiser = event.currentTarget.dataset.eventKind === "fundraiser";
    const form = new FormData(event.currentTarget);
    const item = (isFundraiser ? state.fundraisers : state.functions).find((fn) => fn.id === form.get("functionId"));
    if (item) {
      item.title = String(form.get("title")).trim() || item.title;
      item.date = String(form.get("date") || todayISO());
      item.mandatory = isFundraiser || form.get("mandatory") === "true";
      saveState();
    }
    render();
  });

  document.querySelectorAll("[data-delete-function]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentMember()?.role !== "Admin") return;
      const id = button.dataset.deleteFunction;
      if (button.dataset.eventKind === "fundraiser") {
        state.fundraisers = state.fundraisers.filter((item) => item.id !== id);
      } else {
        state.functions = state.functions.filter((item) => item.id !== id);
      }
      state.attendanceRecords = state.attendanceRecords.filter((record) => record.eventId !== id);
      view.adminAttendancePath.pop();
      saveState();
      render();
    });
  });

  document.querySelector("#committeeSettingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = String(form.get("committee"));
    const setting = committeeSetting(label);
    setting.day = Number(form.get("day"));
    setting.time = String(form.get("time") || "13:30");
    saveState();
    render();
  });

  document.querySelectorAll("[data-delete-committee-occurrence]").forEach((button) => {
    button.addEventListener("click", () => {
      const label = button.dataset.deleteCommitteeOccurrence;
      const date = button.dataset.date;
      const setting = committeeSetting(label);
      if (date && !setting.deletedDates.includes(date)) setting.deletedDates.push(date);
      state.attendanceRecords = state.attendanceRecords.filter(
        (record) => !(record.eventId === `committee-${slug(label)}` && record.date === date),
      );
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-rule-input]").forEach((input) => {
    input.addEventListener("input", () => updatePointRuleFromInput(input, false));
    input.addEventListener("change", () => updatePointRuleFromInput(input, true));
  });

  document.querySelectorAll("[data-edit-rules]").forEach((button) => {
    button.addEventListener("click", () => {
      view.modal = { type: "pointRules", ruleType: button.dataset.editRules };
      render();
    });
  });

  document.querySelectorAll("[data-edit-member]").forEach((button) => {
    button.addEventListener("click", () => {
      view.modal = { type: "member", memberId: button.dataset.editMember };
      render();
    });
  });
  document.querySelector("[data-add-member]")?.addEventListener("click", () => {
    view.modal = { type: "member", memberId: null };
    render();
  });
}

function updatePointRuleFromInput(input, shouldRender) {
  if (input.value === "" || input.value === "-") return;
  const value = Number(input.value);
  if (Number.isNaN(value)) return;
  const rule = state.pointRules[input.dataset.ruleType]?.find((item) => item.id === input.dataset.ruleId);
  if (!rule) return;
  rule.value = value;
  saveState();
  if (shouldRender) render();
}

function bindModalEvents(member) {
  document.querySelectorAll("[data-close-modal], [data-close-modal-button]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest("[data-modal-card]") && !event.target.matches("[data-close-modal-button]")) return;
      closeModal();
      render();
    });
  });

  document.querySelectorAll("[data-open-email]").forEach((link) => {
    link.addEventListener("click", () => {
      const alert = state.alerts.find((item) => item.id === link.dataset.openEmail);
      if (alert) {
        alert.acknowledged = true;
        alert.emailOpenedAt = new Date().toISOString();
        saveState();
      }
    });
  });

  document.querySelectorAll("[data-delete-member]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteMember;
      if (id === member.id) return;
      state.members = state.members.filter((item) => item.id !== id);
      state.loginCredentials = (state.loginCredentials || []).filter((credential) => credential.memberId !== id);
      state.pointRecords = state.pointRecords.filter((record) => record.memberId !== id);
      for (const record of state.attendanceRecords) {
        record.statuses = record.statuses.filter((status) => status.memberId !== id);
        record.points = record.points.filter((point) => point.memberId !== id);
      }
      saveState();
      view.modal = null;
      render();
    });
  });

  bindSegmentButtons("permission-group", "permission-choice");
  bindSegmentButtons("record-status-group", "record-status-choice");

  document.querySelector("#pointRecordEditForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = updatePointRecordFromForm(new FormData(event.currentTarget), member);
    if (record) maybeCreateProbationAlert(record.memberId);
    saveState();
    view.modal = null;
    render();
  });

  document.querySelector("#attendanceRecordEditForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    let record;
    try {
      record = updateAttendanceRecordFromForm(new FormData(event.currentTarget), member);
    } catch (error) {
      showAttendanceFormError(event.currentTarget, error);
      return;
    }
    if (record) {
      for (const impact of record.points) maybeCreateProbationAlert(impact.memberId);
    }
    saveState();
    view.modal = null;
    render();
  });

  document.querySelectorAll("[data-delete-modal-record-type]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteRecord(button.dataset.deleteModalRecordType, button.dataset.deleteModalRecordId);
      saveState();
      view.modal = null;
      render();
    });
  });

  const roleSelect = document.querySelector("#memberForm select[name='role']");
  roleSelect?.addEventListener("change", () => {
    const permissionsBlock = document.querySelector("#attendancePermissionsBlock .attendance-permissions-content");
    if (permissionsBlock) permissionsBlock.style.display = roleSelect.value === "Brother" ? "" : "none";
    const statusField = document.querySelector("#memberForm .status-field");
    if (statusField) statusField.style.display = roleSelect.value === "Brother" ? "" : "none";
  });

  const marchingCheckbox = document.querySelector("#memberForm input[name='marchingBand']");
  marchingCheckbox?.addEventListener("change", () => {
    const sectionField = document.querySelector("#memberForm .marching-section-field");
    if (sectionField) sectionField.style.display = marchingCheckbox.checked ? "" : "none";
  });

  document.querySelector("#memberForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (currentMember()?.role !== "Admin") return;
    const form = new FormData(event.currentTarget);
    const memberData = memberFromForm(form);
    const existingIndex = state.members.findIndex((item) => item.id === memberData.id);
    const previous = existingIndex >= 0 ? state.members[existingIndex] : null;
    addConditionalMemberOverride(previous, memberData, member);
    if (existingIndex >= 0) state.members.splice(existingIndex, 1, memberData);
    else state.members.push(memberData);
    syncLoginForMember(memberData);
    saveState();
    view.modal = null;
    render();
  });

  document.querySelector("#functionForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.functions.push({
      id: uid("function"),
      title: String(form.get("title")).trim() || "New Function",
      date: String(form.get("date") || todayISO()),
      mandatory: form.get("mandatory") === "true",
      assignedMemberIds: [],
    });
    saveState();
    view.modal = null;
    render();
  });

  const attendanceEventType = document.querySelector("#attendanceEventForm select[name='eventType']");
  attendanceEventType?.addEventListener("change", updateAttendanceEventFields);
  updateAttendanceEventFields();

  document.querySelector("#attendanceEventForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addAttendanceEventFromForm(form);
    saveState();
    view.modal = null;
    render();
  });

  document.querySelectorAll("[data-delete-rule]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.ruleType;
      const id = button.dataset.deleteRule;
      state.pointRules[type] = state.pointRules[type].filter((rule) => rule.id !== id);
      saveState();
      render();
    });
  });

  document.querySelector("#pointRulesEditor")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = event.currentTarget.dataset.ruleType;
    for (const rule of state.pointRules[type]) {
      const name = String(form.get(`name:${rule.id}`) || "").trim();
      if (name) rule.name = name;
      if (rule.value !== null && form.has(`value:${rule.id}`)) {
        rule.value = Number(form.get(`value:${rule.id}`) || 0);
      }
    }
    const newName = String(form.get("newName") || "").trim();
    if (newName) {
      state.pointRules[type].push({
        id: uid("rule"),
        name: newName,
        value: Number(form.get("newValue") || 0),
      });
    }
    saveState();
    view.modal = null;
    render();
  });
}

function closeModal() {
  if (view.modal?.type === "email") {
    const alert = state.alerts.find((item) => item.id === view.modal.alertId);
    if (alert) {
      alert.acknowledged = true;
      saveState();
    }
  }
  view.modal = null;
}

function updateAttendanceEventFields() {
  const form = document.querySelector("#attendanceEventForm");
  if (!form) return;
  const type = String(form.querySelector("[name='eventType']")?.value || "function");
  form.querySelector(".event-date-field")?.classList.toggle("is-hidden-field", type === "band" || type === "committee");
  form.querySelector(".event-time-field")?.classList.toggle("is-hidden-field", ["band", "function", "fundraiser"].includes(type));
  form.querySelector(".function-type-field")?.classList.toggle("is-hidden-field", type !== "function");
  const mandatorySelect = form.querySelector("[name='mandatory']");
  if (mandatorySelect) mandatorySelect.disabled = type !== "function";
}

function addAttendanceEventFromForm(form) {
  if (currentMember()?.role !== "Admin") return;
  const type = String(form.get("eventType"));
  const title = String(form.get("title") || "").trim();
  if (!title) return;
  if (type === "band") {
    state.customBandEnsembles.push({ id: uid("band"), title });
    return;
  }
  if (type === "committee") {
    const item = { id: uid("committee"), title };
    state.customCommittees.push(item);
    state.committeeSettings[committeeKey(title)] = {
      day: 5,
      time: "13:30",
      deletedDates: [],
    };
    return;
  }
  if (type === "business") {
    state.extraBusinessMeetings.push({
      id: uid("business"),
      title,
      date: String(form.get("date") || todayISO()),
      time: String(form.get("time") || "13:30"),
    });
    return;
  }
  const isFundraiser = type === "fundraiser";
  (isFundraiser ? state.fundraisers : state.functions).push({
    id: uid(isFundraiser ? "fundraiser" : "function"),
    title,
    date: String(form.get("date") || todayISO()),
    mandatory: isFundraiser || form.get("mandatory") === "true",
    assignedMemberIds: [],
  });
}

function bindSegmentButtons(groupAttr, choiceAttr) {
  document.querySelectorAll(`[data-${groupAttr}]`).forEach((group) => {
    group.querySelectorAll(`[data-${choiceAttr}]`).forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const input = group.parentElement.querySelector("input[type='hidden']");
        if (input) input.value = button.dataset[toDatasetKey(choiceAttr)];
      });
    });
  });
}

function toDatasetKey(attr) {
  return attr.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function addConditionalMemberOverride(previous, next, recordingMember) {
  // This is a single adjustment at a real status transition, never a running floor.
  if (!systemSettings().conditionalCleanStart || currentMember()?.role !== "Admin" || previous?.status !== "Active" || next.status !== "Conditional") return null;
  const date = todayISO();
  const term = getTerm(date);
  const range = getTermDateRange(term);
  const balance = totalPointsForRange(previous.id, range.start, range.end);
  if (balance >= 0) return null;
  const record = {
    id: uid("point"),
    memberId: previous.id,
    type: "positive",
    actionId: "conditional-member-override",
    actionName: "Conditional Member Override",
    points: -balance,
    notes: `Active to Conditional status change. ${term} balance before override: ${signedPoints(balance)}. Starting balance: 0.`,
    date,
    recordingMemberId: recordingMember.id,
    createdAt: new Date().toISOString(),
  };
  state.pointRecords.push(record);
  return record;
}

function memberFromForm(form) {
  const id = String(form.get("memberId") || "") || uid("member");
  const role = String(form.get("role"));
  const permissions = { ...emptyAttendancePermissions(), ...Object.fromEntries(currentBandSections().map((section) => [section, false])) };
  for (const key of Object.keys(permissions)) {
    permissions[key] = form.get(`permission:${key}`) === "true";
  }
  return {
    id,
    firstName: String(form.get("firstName")).trim(),
    lastName: String(form.get("lastName")).trim(),
    email: String(form.get("email")).trim(),
    buffId: String(form.get("buffId")).trim(),
    status: role === "Brother" ? String(form.get("status") || "Active") : "Active",
    role,
    assignments: {
      marchingBand: form.get("marchingBand") === "on",
      section: String(form.get("section")),
      concertBand: form.get("concertBand") === "on",
      symphonicBand: form.get("symphonicBand") === "on",
      customEnsembles: state.customBandEnsembles.filter((item) => form.get(`customEnsemble:${item.id}`) === "on").map((item) => item.id),
      committee: String(form.get("committee")),
    },
    attendancePermissions: role === "Brother" ? permissions : emptyAttendancePermissions(),
  };
}

function attendanceRecordMembers(record) {
  const event = {
    eventId: record.eventId,
    eventKind: record.eventKind,
    label: record.eventLabel,
  };
  const members = new Map(membersForAttendanceEvent(event).map((member) => [member.id, member]));
  for (const status of record.statuses || []) {
    const member = state.members.find((item) => item.id === status.memberId);
    if (member) members.set(member.id, member);
  }
  return [...members.values()].sort(memberSort);
}

function deleteRecord(recordType, recordId) {
  if (recordType === "point") {
    state.pointRecords = state.pointRecords.filter((record) => record.id !== recordId);
    return;
  }
  if (recordType === "attendance") {
    state.attendanceRecords = state.attendanceRecords.filter((record) => record.id !== recordId);
  }
}

function updatePointRecordFromForm(form, editingMember) {
  const record = state.pointRecords.find((item) => item.id === form.get("recordId"));
  if (!record) return null;
  const points = Number(form.get("points") || 0);
  record.memberId = String(form.get("memberId"));
  record.date = String(form.get("date") || todayISO());
  record.actionName = String(form.get("actionName") || "Point Record").trim() || "Point Record";
  record.points = Number.isNaN(points) ? 0 : points;
  record.type = record.points >= 0 ? "positive" : "negative";
  record.notes = String(form.get("notes") || "").trim();
  record.updatedAt = new Date().toISOString();
  record.updatedByMemberId = editingMember.id;
  return record;
}

function updateAttendanceRecordFromForm(form, editingMember) {
  if (currentMember()?.role !== "Admin") return null;
  const record = state.attendanceRecords.find((item) => item.id === form.get("recordId"));
  if (!record) return null;
  const previous = { ...record };
  const event = {
    eventId: String(form.get("eventId")),
    eventKind: String(form.get("eventKind")),
    label: String(form.get("eventLabel") || record.eventLabel).trim() || record.eventLabel,
  };
  const config = record.eventKind === "fundraiser" ? fundraiserConfiguration(record) : {};
  Object.assign(event, config);
  const statusesForMembers = attendanceStatusesFromForm(form, event);
  Object.assign(record, config);
  record.eventLabel = event.label;
  record.date = String(form.get("date") || todayISO());
  record.notes = String(form.get("notes") || "").trim();
  record.statuses = statusesForMembers;
  record.points = attendancePointImpacts(event, statusesForMembers);
  record.approvedLetterMemberIds = retainedAttendanceLetterApprovals(previous, record);
  record.updatedAt = new Date().toISOString();
  record.updatedByMemberId = editingMember.id;
  return record;
}

function createAttendanceRecord(form, recordingMember) {
  const event = {
    eventId: String(form.get("eventId")),
    eventKind: String(form.get("eventKind")),
    label: String(form.get("eventLabel")),
  };
  const date = String(form.get("date")) || todayISO();
  const previous = state.attendanceRecords.find((item) => item.eventId === event.eventId && item.date === date);
  const config = event.eventKind === "fundraiser" ? fundraiserConfiguration(previous) : {};
  Object.assign(event, config);
  const statusesForMembers = attendanceStatusesFromForm(form, event);
  const record = {
    ...config,
    id: previous?.id || uid("attendance"),
    eventId: event.eventId,
    eventKind: event.eventKind,
    eventLabel: event.label,
    date,
    notes: String(form.get("notes") || "").trim(),
    statuses: statusesForMembers,
    points: attendancePointImpacts(event, statusesForMembers),
    recordingMemberId: recordingMember.id,
    createdAt: new Date().toISOString(),
  };
  record.approvedLetterMemberIds = retainedAttendanceLetterApprovals(previous, record);
  return record;
}

function attendanceStatusesFromForm(form, event) {
  if (event.eventKind !== "fundraiser") {
    return [...form.entries()]
      .filter(([key, value]) => key.startsWith("status:") && value)
      .map(([key, value]) => ({ memberId: key.slice(7), status: String(value) }));
  }
  const entries = [];
  for (const member of membersForAttendanceEvent(event)) {
    const config = { ...fundraiserConfiguration(), ...event };
    const shifts = Array.from({length: config.requiredShiftCount}, (_, index) => String(form.get(`shift${index + 1}:${member.id}`) || ""));
    const extraShifts = config.extraShiftsEnabled ? Number(form.get(`extraShifts:${member.id}`) || 0) : 0;
    if (!shifts.every((status) => attendanceStatuses.includes(status))) {
      throw new Error(`Select all ${config.requiredShiftCount} shift statuses for ${formatMember(member)}.`);
    }
    if (!Number.isSafeInteger(extraShifts) || extraShifts < 0) {
      throw new Error(`Extra Shifts Worked must be a nonnegative whole number for ${formatMember(member)}.`);
    }
    const status = shifts.includes("Absent") ? "Absent" : shifts.includes("Late") ? "Late" : "Present";
    entries.push({ memberId: member.id, status, shifts, extraShifts });
  }
  return entries;
}

function attendancePointImpacts(event, statusesForMembers) {
  const impacts = [];
  for (const entry of statusesForMembers) {
    const member = state.members.find((item) => item.id === entry.memberId);
    if (!member) continue;
    if (event.eventKind === "fundraiser" && fundraiserShiftStatuses(entry).length) {
      const shifts = fundraiserShiftStatuses(entry).map((status) => pointsForAttendanceStatus(event, member, status));
      const penaltyPoints = shifts.reduce((sum, shift) => sum + shift.points, 0);
      const bonusPoints = (Number(entry.extraShifts) || 0) * ruleImpact("positive", "multiple-fundraiser-shifts").points;
      impacts.push({
        memberId: member.id,
        points: penaltyPoints + bonusPoints,
        penaltyPoints,
        bonusPoints,
        note: `${shifts.map((shift,index) => `Shift ${index + 1}: ${signedPoints(shift.points)}`).join("; ")}; Extra shifts: ${signedPoints(bonusPoints)}`,
      });
      continue;
    }
    const result = pointsForAttendanceStatus(event, member, entry.status);
    if (!result || result.points === 0) continue;
    impacts.push({
      memberId: member.id,
      points: result.points,
      note: result.action,
    });
  }
  return impacts;
}

function pointsForAttendanceStatus(event, member, status) {
  // Automatic attendance exemptions never alter already-stored records or manual deductions.
  if (member.status === "Conditional" && ((status === "Absent" && systemSettings().conditionalAbsenceExempt) || (status === "Late" && systemSettings().conditionalLateExempt))) {
    return { points: 0, action: `${status === "Absent" ? "Absence" : "Lateness"} exempt for Conditional status` };
  }
  if (status === "Present") {
    if (event.eventKind === "function") {
      const fn = state.functions.find((item) => item.id === event.eventId);
      return fn?.mandatory
        ? ruleImpact("positive", "mandatory-function")
        : ruleImpact("positive", "attending-social-event");
    }
    if (event.eventKind === "committee" && member.assignments?.committee !== event.label) {
      return ruleImpact("positive", "outside-committee");
    }
    return { points: 0, action: "Present" };
  }

  if (status === "Late") {
    if (event.eventKind === "fundraiser") return ruleImpact("negative", "late-fundraiser");
    if (event.eventKind === "committee") return conditionalImpact(member, "negative", "late-committee");
    if (event.eventKind === "band" || event.eventKind === "custom-band") return conditionalImpact(member, "negative", "late-band");
    return conditionalImpact(member, "negative", "late-meeting");
  }

  if (status === "Absent") {
    if (event.eventKind === "fundraiser") return (event.fundraiserMandatory ?? systemSettings().fundraisersMandatory) ? ruleImpact("negative", "missed-fundraiser") : { points: 0, action: "Absent from optional fundraiser" };
    if (event.eventKind === "committee") return conditionalImpact(member, "negative", "absent-committee");
    if (event.eventKind === "band" || event.eventKind === "custom-band") return conditionalImpact(member, "negative", "absent-band");
    if (event.eventKind === "function") {
      const fn = state.functions.find((item) => item.id === event.eventId);
      return fn?.mandatory
        ? conditionalImpact(member, "negative", "missed-mandatory-function")
        : { points: 0, action: "Absent from optional function" };
    }
    return conditionalImpact(member, "negative", "absent-meeting");
  }

  return { points: 0, action: status };
}

function conditionalImpact(member, type, ruleId) {
  const impact = ruleImpact(type, ruleId);

  return impact;
}

function ruleImpact(type, ruleId) {
  const rule = state.pointRules[type].find((item) => item.id === ruleId);
  return { points: Number(rule?.value || 0), action: rule?.name || ruleId };
}

function createPointRecord(form, recordingMember, type) {
  const rules = state.pointRules[type];
  const rule = rules.find((item) => item.id === form.get("actionId"));
  let points = Number(rule?.value || 0);
  if (rule?.id === "multiple-fundraiser-shifts") {
    points *= Number(form.get("extraShifts") || 1);
  }
  if (rule?.value === null) {
    points = Number(form.get("discretionPoints") || 0);
  }
  return {
    id: uid("point"),
    memberId: String(form.get("memberId")),
    type,
    actionId: rule?.id,
    actionName: rule?.name || "Point Record",
    points,
    notes: String(form.get("notes") || "").trim(),
    date: todayISO(),
    recordingMemberId: recordingMember.id,
    createdAt: new Date().toISOString(),
  };
}


function dispatchPendingEmails() {
  const pending = state.alerts.filter((alert) => !alert.emailDispatchedAt);
  if (!pending.length) return;
  autoDispatchAlertEmail(pending[0]);
}

function autoDispatchAlertEmail(alert) {
  if (!systemSettings().emailPromptsEnabled || !alert || alert.emailDispatchedAt) return;
  alert.acknowledged = true;
  alert.emailOpenedAt = new Date().toISOString();
  alert.emailDispatchedAt = alert.emailOpenedAt;
  saveState();
  window.location.assign(alertMailto(alert));
}

function maybeCreateDiscretionAlert(record) {
  if (!record.actionId?.startsWith("exec-discretion")) return;
  const member = state.members.find((item) => item.id === record.memberId);
  const recorder = state.members.find((item) => item.id === record.recordingMemberId);
  const alert = {
    id: uid("alert"),
    type: "discretion",
    subject: `Executive Council Discretion Point Record`,
    body: `${formatMember(member || {})} received ${signedPoints(record.points)} points for ${record.actionName}.\n\nRecorded by: ${formatMember(recorder || {})}\nDate: ${prettyDate(record.date)}\nNotes: ${record.notes || "None"}`,
    createdAt: record.createdAt,
    acknowledged: false,
  };
  state.alerts.push(alert);
  autoDispatchAlertEmail(alert);
  return alert;
}

function maybeCreateProbationAlert(memberId) {
  const term = getTerm(todayISO());
  const range = getTermDateRange(term);
  const total = totalPointsForRange(memberId, range.start, range.end);
  const member = state.members.find((item) => item.id === memberId);
  if (!systemSettings().probationEnabled || !member || total > systemSettings().probationThreshold) return;
  const alreadySent = state.alerts.some(
    (alert) => alert.type === "probation" && alert.memberId === memberId && alert.term === term,
  );
  if (alreadySent) return;
  const alert = {
    id: uid("alert"),
    type: "probation",
    memberId,
    term,
    subject: `${formatMember(member)} moved to probation status`,
    body: `${formatMember(member)} has been moved to probation status.`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
  state.alerts.push(alert);
  autoDispatchAlertEmail(alert);
  return alert;
}

function ensureProbationAlertsForCurrentTerm() {
  const alerts = [];
  const term = getTerm(todayISO());
  const range = getTermDateRange(term);
  for (const member of state.members) {
    const total = totalPointsForRange(member.id, range.start, range.end);
    if (systemSettings().probationEnabled && total <= systemSettings().probationThreshold) {
      const alert = maybeCreateProbationAlert(member.id);
      if (alert) alerts.push(alert);
    }
  }
  if (alerts.length) saveState();
  return alerts;
}

document.addEventListener("DOMContentLoaded", () => {
  repairLoginCredentials(true);
  dispatchPendingEmails();
  render();
});
