# Alpha Psi Point Tracker

This is the first working version of the fraternity attendance and point tracking app from the idea document.

Open `index.html` in a browser to use it. The seeded admin login is:

- School Email: `frboone1@buffs.wtamu.edu`
- Buff ID: `1123822`

The app currently stores data in the browser on this device. Email alerts are prepared through the user's mail app with `mailto:` links; a production version will need a backend service for real multi-user sync, passkeys, and automatic email delivery.

## Conditional member attendance policy

Conditional members receive no negative points for absences from any event, whether mandatory or optional. This includes each required fundraiser shift and absence rules submitted through Submit Points. Existing late-attendance rules and extra-shift bonuses still apply.

Attendance is scored when submitted or edited. Previously saved records retain their recorded scores until edited and saved; member status at the time of an older event is not stored.
