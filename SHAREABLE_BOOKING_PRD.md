# Shareable Booking Link PRD

## 1. Summary

Friendsly should let a creator share a public booking link that a fan can open and use to book a paid call with as few steps as possible.

The booking flow must support both:
- fans who already have a Friendsly account
- fans who do not have an account and want to continue as guest

The product should optimize for conversion on the first booking while still giving Friendsly a clean path to fan identity, reminders, booking management, and call join access later.

---

## 2. Problem

Today, account-first booking flows create extra friction for fans who just want to book one call quickly.

If a fan clicks a creator's shareable link and immediately hits a signup wall, likely outcomes are:
- higher drop-off before payment
- lower conversion on creator-shared traffic
- a worse mobile experience

At the same time, Friendsly still needs enough identity and access control to:
- confirm the booking
- send reminders
- let the fan return later
- let the fan join the call securely

---

## 3. Goal

Allow any creator to share one public booking link that drives a fan into a fast booking flow with either:
- login
- standard fan account creation
- guest checkout

---

## 4. Product Principle

The first booking should feel like a checkout flow, not a platform onboarding flow.

---

## 5. Users

### Creator
A creator who wants to share a single URL on social media, in DMs, or in bio links so fans can book a paid call directly.

### Existing fan
A fan who already has a Friendsly account and wants a fast repeat booking experience.

### New fan
A fan who has never used Friendsly before and may not want to create an account before paying.

---

## 6. Scope

### In scope
- public creator booking page
- creator-specific shareable URL
- slot selection
- identity step with login and guest option
- payment
- confirmation
- reminder and return flow
- guest access for booking management and join-call access

### Out of scope for V1
- referral attribution and influencer commission systems
- multi-creator marketplace bundles
- subscription products
- advanced CRM automation
- full creator self-serve page design customization

---

## 7. Primary User Flow

1. Creator shares public booking URL.
2. Fan opens booking page.
3. Fan sees creator, offer, price, and available times.
4. Fan selects a slot.
5. Fan chooses one of:
   - log in
   - create fan account
   - continue as guest
6. Fan completes payment.
7. Friendsly confirms the booking.
8. Fan receives email and/or SMS confirmation with access links.
9. Fan returns later to manage the booking or join the call.

---

## 8. User Flow Variants

### A. Existing account
1. Fan opens share link.
2. Fan selects slot.
3. Fan logs in or is already logged in.
4. Fan pays.
5. Booking is attached to their account.

### B. New fan who creates a standard Friendsly account
1. Fan opens share link.
2. Fan selects slot.
3. Fan creates a Friendsly fan account with the current signup flow.
4. Friendsly creates a full account.
5. Fan pays.
6. Booking is attached to that account.

### C. New fan who does not want an account
1. Fan opens share link.
2. Fan selects slot.
3. Fan chooses guest checkout.
4. Fan enters minimal contact info.
5. Fan pays.
6. Friendsly creates a guest record linked to the booking.
7. Fan later returns through a secure booking link or by claiming the booking into a full account.

---

## 9. UX Requirements

### Booking page
The public booking page must show:
- creator name
- creator photo
- call type or package
- duration
- price
- available time slots
- primary CTA

The page should avoid distracting navigation and should be mobile-first.

### Identity step
The identity step must happen after slot selection, not before.

The screen must offer:
- login for existing users
- current fan account creation for new users
- guest checkout option

The copy should not force "create account" framing too early. It should emphasize confirming or securing the booking.

The account creation path should use the existing Friendsly signup pattern:
- full name
- email
- password

### Payment step
The payment screen should be the last major step before confirmation.

### Confirmation step
The confirmation screen must show:
- creator
- date and time
- timezone
- booking status
- reminder expectations
- manage booking access
- join-call instructions

---

## 10. Functional Requirements

### FR1. Shareable link generation
The system must support a public booking route per creator, such as:
- `/book/:creatorSlug`

### FR2. Public availability viewing
Unauthenticated visitors must be able to view available booking times for the creator.

### FR3. Slot selection before identity gate
The fan must be able to choose a slot before being required to log in or continue as guest.

### FR4. Multiple identity options
The system must support:
- existing account login
- new account creation via the current fan signup flow
- guest checkout

### FR5. Guest checkout
Guest checkout must require only the minimum needed to complete and support the booking:
- name
- email and/or phone
- payment details

### FR6. Booking ownership
Every booking must be tied to one identifiable fan record, either:
- authenticated user account
- guest/unclaimed record

### FR7. Confirmation delivery
The system must send a booking confirmation through at least one reliable channel:
- email
- SMS if available

### FR8. Guest return access
Guests must be able to return later using:
- secure booking links sent in confirmation and reminder messages
- a booking lookup or booking-claim flow if the original link is lost

### FR9. Join-call access
Both authenticated users and guest users must be able to access the call join flow when the booking is in the valid join window.

### FR10. Optional account claiming
A guest user should be able to convert their guest booking history into a full Friendsly account later using the current signup flow and the same verified contact identity.

---

## 11. Non-Functional Requirements

### Speed
The mobile booking flow should feel short and responsive.

### Security
Guest access links must be secure, time-bounded, and revocable. In V1, guest recovery should be limited to explicit booking retrieval or later account claiming through the standard signup flow.

### Reliability
Confirmation and reminder delivery must be resilient enough that a fan can still recover access if they lose the original link.

### Mobile usability
The entire flow must work well on phones since creator-shared traffic will likely be mostly mobile.

---

## 12. Guest Account Model

For V1, "guest account" should mean:
- Friendsly stores a lightweight fan identity record
- the fan does not set a password
- the fan can access bookings through a secure booking link

Suggested states:
- `authenticated_user`
- `guest_unclaimed`
- `guest_claimed`

Practical meaning:
- `authenticated_user`: normal Friendsly account
- `guest_unclaimed`: booked without full account setup
- `guest_claimed`: originally guest, later converted into a full account path

---

## 13. Access Model

### Logged-in users
Logged-in fans access bookings through their standard Friendsly session.

### Guests
Guests access bookings through:
- booking confirmation links
- reminder links
- booking retrieval or booking-claim flow if the original link is lost

The system must not require a guest to remember a password they never created.

---

## 14. Edge Cases

The system should define behavior for:
- fan selects slot, then abandons before payment
- slot becomes unavailable during checkout
- fan books as guest, then later logs in with same email
- reminder email is lost or link expires
- fan wants to reschedule without an account
- guest tries to join from a new device
- multiple bookings exist for the same guest email

Recommended handling:
- reserve slots for a short checkout window if needed
- require revalidation of availability before final payment confirmation
- merge or associate guest bookings when identity matches with high confidence
- provide a clear "find my booking" or "claim this booking" recovery path

---

## 15. Acceptance Criteria

### Creator
- A creator can obtain a public booking link.
- The creator can share that link outside the app.

### Existing fan
- An existing fan can open the link, select a slot, pay, and see the booking in their account.

### New fan with login
- A new fan can create an account through the current Friendsly fan signup flow and complete the booking.

### New fan as guest
- A new fan can complete a booking without creating a password-based account.
- The booking is still recoverable later through a secure booking link or a claim flow.

### Return flow
- A guest fan can successfully open booking details later.
- A guest fan can join the call from a reminder link or booking access link.

### Recovery
- If a guest loses the original confirmation link, they can request a fresh access method.

---

## 16. Success Metrics

Primary metrics:
- shareable link to booking conversion rate
- slot selection to payment conversion rate
- payment completion rate for new fans

Secondary metrics:
- percentage of bookings completed as guest vs account
- guest-to-account claim rate after booking
- reminder-to-join conversion rate
- support tickets related to lost booking access

Guardrail metrics:
- failed join attempts
- duplicate fan identity records
- fraudulent or disputed bookings tied to guest flows

---

## 17. Risks

### Risk: forced login hurts conversion
Mitigation:
- keep guest checkout available
- place identity step after slot selection

### Risk: guest flows create support complexity
Mitigation:
- use secure booking links and a clear booking-claim flow
- standardize guest booking retrieval

### Risk: duplicate fan records
Mitigation:
- link guest and full accounts by verified email or phone where appropriate

### Risk: insecure guest access
Mitigation:
- use short-lived tokens
- limit what a guest can do from a stale or unverified link
- encourage booking claiming into a full account for longer-term access

---

## 18. Recommended V1 Decision

Friendsly should launch with:
- public creator booking links
- slot selection before identity friction
- login option for existing users
- current fan signup option for new users
- guest checkout option
- secure booking-link recovery and join flow for guests

This gives the best balance between:
- booking conversion
- fan convenience
- future retention
- operational reliability

---

## 19. Open Questions

- Should guest checkout require both email and phone, or just one?
- Should SMS reminders be required or optional in V1?
- Should guests be allowed to reschedule directly from the secure link, or should they first claim the booking into an account?
- Should a guest booking automatically convert into a full account after first successful signup with the same email?
- How aggressively should we merge guest identities with existing accounts that share an email or phone?

---

## 20. One-Sentence Requirement

Friendsly must let a creator share one public booking link that allows any fan to book a paid call with either login, the current fan account creation flow, or guest checkout, then return later through secure booking access to manage and join the call.
