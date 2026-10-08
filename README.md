# Alpha Psi Point Tracker

A static HTML/CSS/JavaScript chapter attendance and point tracker, with Firebase Authentication and Firestore synchronization through `firebase-sync.js`.

## Admin Settings

Open **Admin → Settings** to configure:

- Chapter name, alert email, fall/academic-year start month, week start day, and recurring business meeting schedule.
- Required fundraiser shifts, mandatory/optional attendance, and extra-shift bonuses.
- Conditional absence/late exemptions and the one-time clean-start override.
- Probation alerts, their point threshold, and prefilled email prompts.
- Executive attendance/point submission access, default Function type, and visible attendance categories.
- Available ensembles, custom ensemble names and all-member/assigned-member rosters, and marching sections.
- Available committees, custom committee names, and new committees.
- Point rule names/values and additional manual point rules.

Save Settings applies changes to the chapter's shared state. Archiving an ensemble or committee hides it from new attendance without deleting its records. Configure custom ensemble membership in **Member Info & Permissions**. Configure committee meeting days/times in **Attendance Events → Committee Meetings**.

Existing records retain their recorded points. Editing attendance explicitly recalculates points with current rules. Fundraiser records save their shift count, mandatory status, and bonus availability, so changing chapter defaults does not silently change old shift requirements. Older two-shift records remain editable with two shifts. Point-value defaults remain -1 per late fundraiser shift, -2 per absent shift, and +3 per extra shift.

## Conditional-member defaults

Conditional members have no automatic absence or late-attendance deductions, including fundraiser shifts. Extra-shift bonuses still apply. Admins can configure these policies in Settings.

When an Admin changes an existing member from Active to Conditional, a negative current-term balance is offset once with a positive **Conditional Member Override** record. History stays intact; positive and zero balances receive no adjustment. Saving an already-Conditional member does not create another override. Later manually submitted deductions still count and can take the member below zero.

## Full Record Report

The **Full Record Report** button is available on year, semester, and week selection screens, on individual member views for Admin/Executive users, and above Brothers' logged records. Admins and Executives can choose members; Brothers can view only their own history through the app. Reports default to all years and provide newest/oldest ordering plus academic-year, semester, and record-type filters.

Calendar periods cover the full year: with the default August start, Fall is August–December and Spring is January–July. Summer records remain included. Changing calendar settings regroups records without changing them.

## Period PDF downloads

Under **Admin → Records**, each academic-year, semester, and week button has **Download Records** below it. A download is also available inside the selected period. PDFs contain that period's records grouped alphabetically by member, with **Attendance Events** followed by **Manual Point Records**, each newest first. They include effective points, fundraiser shift details, approved-letter overrides, recorder information, and notes. Week downloads at semester boundaries contain only records from the selected semester.

PDF creation happens in the browser, using local vendored copies of pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, and DejaVu Sans. Report data is not sent to a PDF service. License notices are in `vendor/`.

## Development and verification

Serve the repository with a static HTTP server; no build step is required. `settings-reports.js` must load before `app.js`; the PDF libraries must be available for exports.

Run the dependency-free logic checks with:

```sh
node tests/settings-reports.test.cjs
node --check app.js
node --check settings-reports.js
```

Settings and reports enforce role checks in the application. The existing `firestore.rules` allows chapter-state access to signed-in users and does not provide server-side field/role isolation; frontend role checks are not a replacement for backend authorization.
