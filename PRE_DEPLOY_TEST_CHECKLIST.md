# Pre-Deploy Test Checklist

- [x] Fan login works on the first try.
- [x] Fan billing page opens without `Failed to fetch` or crashing.
- [x] Uploading a new profile picture works and the photo still appears in the app.
[x] Creator can complete Stripe Connect setup and return to the app cleanly.
- [x] Creator withdraw button only allows the Stripe-safe amount and no longer fails from the old payout logic.
- [x] A fan cannot book the same creator slot if it is already taken.
- [x] A fan cannot book overlapping 1-on-1 sessions with different creators.
- [x] Same-day booking is blocked and the earliest allowed date is still the next day.
- [x] Booking joinability updates automatically when the join window opens.
- [x] A creator sees booking joinability update automatically too.
- [x] Fan cancellation more than 24 hours before start gives a full refund.
- [x] Fan cancellation within 24 hours gives a 50% refund.
- [x] Creator cancellation gives a full refund.
- [x] If both miss the call and auto-cancel triggers, the fan gets a full refund.
- [x] If the creator joins and the fan no-shows, the fan only gets a 50% refund.
- [x] If the fan joins and the creator no-shows, the fan gets a full refund.
- [x] Creator goes live and the fan side reflects it without manual refresh.
- [x] Fan joining the live queue appears on the creator side without manual refresh.
- [x] `Admit next` updates both creator and fan sides correctly.
- [x] Ending a live session clears the live state and does not leave obviously stale queue behavior.
- [x] Review submission only works after a completed booking.
- [x] A fan cannot leave a second review for the same completed booking.
- [x] Old auth/cookie issues do not come back after normal use.
- [x] Payment history and earnings pages do not do weird repeated refresh loops.
- [x] Payout history statuses and errors look understandable to a normal user.
