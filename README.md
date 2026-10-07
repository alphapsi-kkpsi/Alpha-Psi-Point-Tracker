# Alpha Psi Point Tracker

This is the first working version of the fraternity attendance and point tracking app from the idea document.

Open `index.html` in a browser to use it. The seeded admin login is:

- School Email: `frboone1@buffs.wtamu.edu`
- Buff ID: `1123822`

The app currently stores data in the browser on this device. Email alerts are prepared through the user's mail app with `mailto:` links; a production version will need a backend service for real multi-user sync, passkeys, and automatic email delivery.

## Conditional member attendance policy

Conditional members receive no automatic attendance deductions for absences or lateness from any event, whether mandatory or optional. This includes each required fundraiser shift. Extra-shift bonuses still apply.

When an Admin changes an existing member from Active to Conditional, a negative current-term balance is offset once with a positive point record named **Conditional Member Override**, bringing that term's balance to zero. All previous records remain unchanged. Positive and zero balances receive no adjustment; creating a Conditional member or saving an already-Conditional member also creates no override.

The override is a recorded adjustment, not a permanent minimum balance. Subsequent negative points explicitly submitted through Submit Points by Admin or Executive Members remain in effect and can take the balance below zero. Opening the tracker, reloading, or saving the same Conditional status does not generate another override.

Attendance is scored when submitted or edited. Previously saved records retain their recorded scores until edited and saved; member status at the time of an older event is not stored.
