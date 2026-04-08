# Friendsly — Learning Guide

A plain-English walkthrough of every technology decision in this project.
Written for someone who knows HTML/CSS but is new to Next.js, TypeScript, and Tailwind.

---

## Table of Contents
1. [What is Next.js App Router?](#1-what-is-nextjs-app-router)
2. [How Routing Works (Folders = URLs)](#2-how-routing-works)
3. [Route Groups — the `(fan)` folder trick](#3-route-groups)
4. [Layouts — wrapping pages without repeating code](#4-layouts)
5. [Server vs. Client Components](#5-server-vs-client-components)
6. [TypeScript Interfaces — what they are and why](#6-typescript-interfaces)
7. [Tailwind CSS — utility-first styling](#7-tailwind-css)
8. [The `cn()` helper — combining classes safely](#8-the-cn-helper)
9. [Component Variants with `cva`](#9-cva-component-variants)
10. [How the Button component works](#10-button-component-breakdown)
11. [How Mock Data flows through the app](#11-mock-data-flow)
12. [The Booking Modal — step-by-step state machine](#12-booking-modal-state-machine)
13. [How Supabase will replace mock data](#13-supabase-future-integration)
14. [How Daily.co video works here](#14-dailyco-integration)
15. [Glossary](#15-glossary)
21. [Stripe Payments](#21-stripe-payments)

---

## 1. What is Next.js App Router?

Next.js is a framework built on top of React. It handles routing, server-side rendering, code splitting, and optimization for you.

**App Router** (introduced in Next.js 13) is the new way to build Next.js apps. Instead of a `pages/` folder, you use an `app/` folder. Each subfolder can have a `page.tsx` file that becomes a URL.

```
app/
  page.tsx          → yoursite.com/
  discover/
    page.tsx        → yoursite.com/discover
  profile/
    [id]/
      page.tsx      → yoursite.com/profile/1  (or /2, /3, etc.)
```

The `[id]` brackets make it a **dynamic route** — any value can go there.

---

## 2. How Routing Works

**Every `page.tsx` = one URL.** The folder path maps directly to the URL.

```
app/dashboard/page.tsx       →  /dashboard
app/profile/[id]/page.tsx    →  /profile/luna  or  /profile/42
app/waiting-room/[id]/page.tsx → /waiting-room/1
```

To read the dynamic part (`[id]`) inside the page, you access `params`:

```tsx
// In app/profile/[id]/page.tsx
export default function ProfilePage({ params }: { params: { id: string } }) {
  console.log(params.id) // → "1", "2", whatever was in the URL
}
```

---

## 3. Route Groups

The `(fan)` and `(creator)` folders in our project have parentheses. This is a **Route Group**.

**The key rule: parentheses folders are INVISIBLE in the URL.**

```
app/(fan)/discover/page.tsx    →  /discover  (NOT /fan/discover)
app/(creator)/dashboard/page.tsx → /dashboard
```

Why use them? So you can have DIFFERENT layouts for different sections:
- All fan pages share `(fan)/layout.tsx` → fan sidebar
- All creator pages share `(creator)/layout.tsx` → creator sidebar
- The root `app/layout.tsx` wraps EVERYTHING

---

## 4. Layouts

A `layout.tsx` file wraps all pages below it in the folder tree.

```tsx
// app/(creator)/layout.tsx
export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <CreatorSidebar />     {/* Always visible */}
      <main>{children}</main> {/* Page content swaps here */}
    </div>
  )
}
```

When a user visits `/dashboard`, Next.js renders:
```
app/layout.tsx
  └── app/(creator)/layout.tsx
        └── app/(creator)/dashboard/page.tsx
```

Each layout's `{children}` prop gets replaced by the next layout or page below it. Think of it like Russian nesting dolls.

---

## 5. Server vs. Client Components

This is one of the most important concepts in Next.js App Router.

### Server Components (default)
- Every `.tsx` file is a Server Component by default
- They run on the SERVER — the user never downloads this code
- They CAN fetch data directly (database calls, APIs)
- They CANNOT use `useState`, `useEffect`, or browser events

### Client Components
- Add `"use client"` at the very top of the file
- They run in the BROWSER
- They CAN use `useState`, `useEffect`, `usePathname`, `onClick`
- They CANNOT directly access server-only resources

```tsx
"use client"  // ← This makes it a client component

import { useState } from "react"

export function BookingModal() {
  const [step, setStep] = useState("select")  // ✅ Works because of "use client"
  // ...
}
```

**Rule of thumb:** Only add `"use client"` when you need interactivity. Keep as many components as possible as Server Components — they're faster.

---

## 6. TypeScript Interfaces

TypeScript adds type safety to JavaScript. An **interface** describes the shape of a data object.

```typescript
// Without TypeScript:
const creator = { name: "Luna", rating: 4.9, isLive: true }
// Could accidentally do: creator.rateing  (typo!) — no error caught

// With TypeScript interface:
interface Creator {
  name: string
  rating: number
  isLive: boolean
}

const creator: Creator = { name: "Luna", rating: 4.9, isLive: true }
// creator.rateing  → TypeScript ERROR! "rateing" doesn't exist on Creator ✅
```

In our app, all interfaces live in `types/index.ts`. This means every component that works with a Creator object is guaranteed to have the same fields.

---

## 7. Tailwind CSS

Tailwind is a "utility-first" CSS framework. Instead of writing CSS files, you add small utility classes directly to HTML.

```tsx
// Traditional CSS approach:
// .card { background: #1A1535; border-radius: 16px; padding: 20px; }
// <div class="card">...</div>

// Tailwind approach:
<div className="bg-brand-surface rounded-2xl p-5">...</div>
```

Each class does ONE thing:
- `bg-brand-surface` → background color
- `rounded-2xl` → border radius
- `p-5` → padding (5 × 4px = 20px)
- `flex` → `display: flex`
- `gap-3` → gap between flex children
- `text-sm` → font size
- `font-bold` → font weight
- `hover:text-white` → text becomes white on hover
- `md:hidden` → hidden on medium screens and up

We've extended Tailwind in `tailwind.config.ts` with custom colors like `brand-primary`, `brand-surface`, etc.

---

## 8. The `cn()` Helper

```typescript
import { cn } from "@/lib/utils"
```

The `cn()` function combines Tailwind class strings safely. You need it because:

1. **Conditional classes** are messy without it:
```tsx
// Without cn() — ugly and error-prone:
className={"base-style" + (isActive ? " active-style" : "")}

// With cn() — clean:
className={cn("base-style", isActive && "active-style")}
```

2. **Conflicting Tailwind classes** get resolved:
```tsx
cn("p-4", "p-6")  // → "p-6"  (later class wins, not "p-4 p-6")
```

Under the hood, `cn()` uses two libraries:
- `clsx` — handles conditionals
- `tailwind-merge` — resolves Tailwind conflicts

---

## 9. CVA — Component Variants

`cva` (class-variance-authority) is how our Button component has multiple looks without messy if/else chains.

```typescript
const buttonVariants = cva(
  "base-classes-here",  // Always applied
  {
    variants: {
      variant: {
        primary: "bg-purple-600 text-white",
        ghost:   "bg-transparent text-gray-400",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
      }
    }
  }
)

// Usage:
<Button variant="primary" size="lg">Click me</Button>
```

Instead of writing:
```tsx
if (variant === "primary") className = "bg-purple-600..."
else if (variant === "ghost") className = "bg-transparent..."
```

You define it once in cva and it just works.

---

## 10. Button Component Breakdown

Let's trace exactly what happens when you write `<Button variant="gold" size="lg">Book Now</Button>`:

```tsx
// components/ui/button.tsx

const buttonVariants = cva(
  // 1. These base classes ALWAYS apply:
  "inline-flex items-center rounded-xl font-semibold transition-all ...",
  {
    variants: {
      variant: {
        gold: "bg-gradient-gold text-brand-bg shadow-glow-gold",
        // ^ These get added when variant="gold"
      },
      size: {
        lg: "h-12 px-7 text-base",
        // ^ These get added when size="lg"
      }
    }
  }
)

// 2. The component renders a <button> with the computed classes:
const Button = ({ variant, size, className, ...props }) => (
  <button
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
)
```

Final className becomes:
`"inline-flex items-center rounded-xl font-semibold transition-all bg-gradient-gold text-brand-bg shadow-glow-gold h-12 px-7 text-base"`

---

## 11. Mock Data Flow

Every piece of fake data lives in `lib/mock-data.ts`. Here's how it flows to the UI:

```
lib/mock-data.ts
  exports MOCK_CREATORS (array of Creator objects)
       ↓
app/(fan)/discover/page.tsx
  imports { MOCK_CREATORS }
  maps over them → renders <InfluencerCard creator={creator} />
       ↓
components/fan/InfluencerCard.tsx
  receives creator as a prop
  displays creator.name, creator.rating, etc.
```

The `creator` prop is typed as `Creator` (from `types/index.ts`), so TypeScript ensures you only access fields that exist on the Creator interface.

**To replace mock data with real data:** Change the import in `discover/page.tsx` from the mock array to a Supabase query:

```tsx
// Before (mock):
import { MOCK_CREATORS } from "@/lib/mock-data"
const creators = MOCK_CREATORS

// After (Supabase):
const { data: creators } = await supabase.from("creators").select("*")
```

Everything else stays the same.

---

## 12. Booking Modal State Machine

The `BookingModal` component uses a **state machine pattern** — the UI is driven by a `step` state variable that can only have specific values.

```
step: "select" → "details" → "confirm" → "success"
```

```tsx
type Step = "select" | "details" | "confirm" | "success"
const [step, setStep] = useState<Step>("select")

// Each step renders a different form:
{step === "select" && <DateTimePicker />}
{step === "details" && <TopicInput />}
{step === "confirm" && <ReviewAndPay />}
{step === "success" && <SuccessMessage />}
```

Why this pattern instead of multiple modals? You keep all the form state in one place, and going backwards ("← Back") is as simple as `setStep("select")`.

---

## 13. Supabase Future Integration

[Supabase](https://supabase.com) is a Firebase alternative that gives you a PostgreSQL database, authentication, and real-time subscriptions.

**Database tables you'll need:**
```sql
creators (id, name, username, bio, category, call_price, call_duration, is_live, ...)
bookings (id, creator_id, fan_id, date, time, status, price, topic, ...)
queue_entries (id, creator_id, fan_id, position, joined_at, ...)
messages (id, creator_id, username, message, created_at, ...)
```

**Replacing a mock array:**
```tsx
// Currently in discover/page.tsx:
const creators = MOCK_CREATORS

// Future with Supabase (this runs on the server — no "use client" needed):
const supabase = createServerComponentClient({ cookies })
const { data: creators } = await supabase
  .from("creators")
  .select("*")
  .eq("is_active", true)
  .order("rating", { ascending: false })
```

**Auth (login/signup):**
```tsx
// Sign up:
const { data, error } = await supabase.auth.signUp({ email, password })

// Sign in:
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Get current user:
const { data: { user } } = await supabase.auth.getUser()
```

---

## 14. Daily.co Integration

[Daily.co](https://www.daily.co) provides the video call infrastructure. When you "Go Live" or "Join a Call," the video streams through Daily.co.

**How it'll work:**

1. Creator clicks "Start Session" → your server creates a Daily.co room via their API
2. Daily.co returns a room URL + access token
3. You render `<DailyProvider>` with the token — this connects the user to the room
4. Creator's view shows their camera + the fan's camera
5. "Admit Next" kicks the current fan and brings in the next one from the queue

```tsx
// Future implementation sketch:
import { DailyProvider, useLocalSessionId, useParticipantIds } from "@daily-co/react-components"

function LiveCallUI({ roomUrl, token }) {
  return (
    <DailyProvider url={roomUrl} token={token}>
      <CreatorVideo />
      <FanVideo />
      <Controls />
    </DailyProvider>
  )
}
```

The placeholder `<div>` elements in our `LiveConsole.tsx` will be replaced with these components.

---

## 15. Mock Auth System — Cheat Sheet

### How it works in 4 steps

```
1. User signs up  →  createPendingProfile()  →  localStorage + cookie="pending|uuid"
2. User picks role  →  setRole("creator")  →  cookie="creator|uuid"
3. User visits /dashboard  →  middleware reads cookie  →  allows access
4. User visits /login again  →  middleware reads cookie  →  redirects to /dashboard
```

### Where is the data stored?

| Data | Storage Location | Key | Who can read it |
|------|-----------------|-----|----------------|
| Full profile (name, bio, role) | `localStorage` | `mock_profiles` | Browser only |
| Session (role + id) | `document.cookie` | `mock_session_role` | Browser + Server (middleware) |

**To inspect in DevTools:**
- `Application → Local Storage → http://localhost:3000 → mock_profiles`
- `Application → Cookies → http://localhost:3000 → mock_session_role`

### The two-layer strategy explained

Why not just use localStorage for everything?

`middleware.ts` runs on the **server** before the page is sent to the browser. The server has no access to localStorage — it can only read cookies (which are sent with every HTTP request as a header).

So we use:
- **Cookie** = the "key card" that opens the door (middleware checks this)
- **localStorage** = the full profile data (client reads this after the door is open)

This is exactly how real Supabase auth works — their session JWT lives in a cookie, and your profile data lives in the database.

### Cookie format

```
mock_session_role = "fan|550e8400-e29b-41d4-a716-446655440000"
                     ^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     role     userId (from crypto.randomUUID())

Possible values:
  "pending|..."    → signed up but hasn't picked a role yet
  "fan|..."        → fully logged in fan
  "creator|..."    → fully logged in creator
```

### How roles control the UI

```
cookie role = "fan"     → FanSidebar shown, /discover is home
cookie role = "creator" → CreatorSidebar shown, /dashboard is home
cookie role = "pending" → redirected to /onboarding/role
no cookie               → redirected to /login
```

The sidebar components check `useAuthContext().user.role` to decide which nav to show. The middleware enforces the same rules server-side before the page even renders.

### The AuthContext chain

```
lib/hooks/useAuth.ts        ← The actual logic (login, signup, etc.)
       ↓
lib/context/AuthContext.tsx  ← Wraps useAuth() in React Context
       ↓
app/layout.tsx               ← <AuthProvider> wraps the whole app
       ↓
Any component                ← const { user } = useAuthContext()
```

Think of it like a water tower: `useAuth.ts` is the pump, `AuthContext` is the tower, and `useAuthContext()` is the tap in every house.

### How to swap for real Supabase auth

The `AuthContext` interface never changes. You only replace the internals of `useAuth.ts` and `mock-auth.ts`:

```typescript
// MOCK (current)                        // SUPABASE (future)
login(email, password)                  → supabase.auth.signInWithPassword({ email, password })
signup(email, password, full_name)      → supabase.auth.signUp({ email, password }) + insert profile row
logout()                                → supabase.auth.signOut()
getProfile()                            → supabase.from('profiles').select().eq('id', userId).single()
saveProfile(profile)                    → supabase.from('profiles').upsert(profile)
setCookieSession(role, id)              → handled automatically by @supabase/ssr
middleware.ts cookie check              → createMiddlewareClient(req, res).auth.getSession()
```

Every component using `useAuthContext()` stays **exactly the same**.

---

## 16. Combined Login + Sign Up Page

The app's entry point (`/`) is a single page with two tabs: **Sign In** and **Create Account**.

### Why one page instead of two?

The original design had separate `/login` and `/signup` pages, and the landing page asked users to pick their role (Fan or Creator) before they even signed up. That caused a double role-selection bug — users picked a role on the landing page, then were asked to pick again during onboarding.

The fix: one entry point at `/`, no role selection until **after** you've created an account.

```
/  (login tab, default)     → validates credentials → reads cookie → redirects to /discover or /dashboard
/  (create account tab)     → creates profile       → always goes to /onboarding/role
```

### How the redirect works after sign-in

```tsx
async function handleSignIn(e: FormEvent) {
  await login(email, password);
  // Read the cookie that login() just set:
  const cookie = document.cookie.split("; ")
    .find(c => c.startsWith("mock_session_role="))?.split("=")[1] ?? "";
  const role = cookie.split("|")[0];
  if (role === "creator") router.push("/dashboard");
  else if (role === "fan")     router.push("/discover");
  else                         router.push("/onboarding/role");
}
```

We read the cookie directly instead of waiting for React state to update. Cookie updates are synchronous; React state updates are asynchronous.

---

## 17. Creator Discovery — How New Creators Appear on the Fan Page

When a creator completes onboarding, they're saved to a **Creator Registry** in localStorage. The fan's Discover page reads this registry and shows real creators alongside the mock seed data.

### The data flow

```
Creator completes onboarding
       ↓
saveRegisteredCreator(profile)   ← lib/mock-auth.ts
  → stores CreatorProfile in localStorage["registered_creators"]
       ↓
Fan visits /discover
       ↓
getRegisteredCreators()          ← lib/mock-auth.ts
  → reads localStorage["registered_creators"]
  → converts each CreatorProfile → Creator card (via creatorProfileToCard())
       ↓
Shown in "New Creators" section above the mock grid
```

### Why a separate localStorage key?

`mock_profiles` (the current user's session) holds one profile at a time. The registry `registered_creators` holds **all** creator profiles so fans can discover them. They serve different purposes and must stay separate.

### The shape conversion

`CreatorProfile` (auth shape) ≠ `Creator` (display card shape). The converter fills in display-only defaults for new creators who haven't set up packages yet:

```typescript
function creatorProfileToCard(profile: CreatorProfile): Creator {
  return {
    id: profile.id,
    name: profile.full_name,
    username: `@${profile.username}`,
    callPrice: 0,               // No packages set yet
    followers: "New",
    rating: 0,
    nextAvailable: "Set up packages to start booking",
    // ...
  };
}
```

### What fans see for new creators

- **Pricing**: "Packages TBD" (instead of $0)
- **Button**: "Coming Soon" (disabled, not clickable)
- **Section**: "New Creators — Just joined the platform"

This prevents confusion when a creator hasn't set up call packages yet.

---

## 18. How Package Persistence Works (Creator → Fan sync)

This is one of the trickiest parts of the mock system, so it's worth understanding clearly.

### The problem it solves

When a creator adds a call package in `/management`, that data needs to show up on the fan's `/discover` and `/profile/[id]` pages. But those are two completely separate browser sessions (different accounts). How does data get from one to the other?

**Answer: localStorage is shared across all accounts in the same browser.** We use a dedicated key `creator_packages` that any page can read — whether you're logged in as a creator or a fan.

### The flow

```
Creator goes to /management
       ↓
Adds a "30-min call for $50" package
       ↓
saveCreatorPackages(creatorId, packages)   ← lib/mock-auth.ts
  → writes to localStorage["creator_packages"][creatorId]
  → ALSO updates localStorage["registered_creators"] with the new min price
       ↓
Fan visits /discover or /profile/[id]
       ↓
getCreatorPackages(creatorId)
  → reads localStorage["creator_packages"][creatorId]
  → returns the packages array
       ↓
Fan sees real packages with real prices and a "Book a Call" button
```

### Why two updates happen at once

`saveCreatorPackages` does two things:
1. Saves the full packages list to `creator_packages`
2. Finds the cheapest active package price and updates that creator's `hourly_rate` in `registered_creators`

Step 2 is what makes the price badge on the Discover grid update automatically — the grid reads `callPrice` from the registered creator object, which is now kept in sync.

### What each localStorage key holds

| Key | Format | Purpose |
|-----|--------|---------|
| `mock_profiles` | `{ [userId]: profile }` | All user profiles (auth data) |
| `registered_creators` | `CreatorProfile[]` | Creator profiles visible on /discover |
| `creator_packages` | `{ [creatorId]: CallPackage[] }` | Each creator's call packages |
| `mock_session_role` (cookie) | `"fan|uuid"` | Active session — readable by middleware |

---

## 19. Profile Photos — How the Image Upload Works

### What happens when you pick a photo

1. The user clicks the camera icon in Settings
2. A hidden `<input type="file">` opens the file picker
3. When a file is selected, `FileReader.readAsDataURL(file)` converts it to a **base64 string**
4. That string (e.g. `"data:image/jpeg;base64,/9j/4AAQ..."`) is saved in the user's profile as `avatar_url`
5. The `Avatar` component receives `imageUrl` and renders an `<img>` tag instead of the initials circle

### What is base64?

Base64 is a way to represent binary data (like an image file) as plain text. Instead of storing a file path, you store the entire image as a long string directly in localStorage. It works great for small images but would be too slow for large ones.

**In production with Supabase:** You'd upload the file to Supabase Storage and save just the URL (`https://...supabase.co/storage/...`). The concept is the same — just the storage location changes.

### The Avatar component

The `Avatar` component now accepts an optional `imageUrl` prop:

```tsx
// With initials (old behavior, still works):
<Avatar initials="SV" color="bg-violet-600" size="md" />

// With photo:
<Avatar initials="SV" color="bg-violet-600" size="md" imageUrl={user.avatar_url} />
```

When `imageUrl` is provided, the component shows an `<img>` with `object-cover` (fills the circle without stretching). When it's not provided, it falls back to the colored circle with initials.

---

## 20. Profile Strength — How the Score Is Calculated

The profile strength percentage on the dashboard is calculated from the actual state of your profile. It's not a fake number.

### The scoring breakdown (adds up to 100%)

| Field | Points | Why it matters |
|-------|--------|----------------|
| Full name set | 20% | Fans need to know who you are |
| Username set | 10% | Your @handle for sharing |
| Avatar color chosen | 5% | Visual identity |
| Profile photo uploaded | 15% | Photos build trust |
| Bio written | 25% | Explains what you offer |
| Category selected | 15% | Helps fans find you |
| At least one active package | 10% | Fans can't book without it |
| **Total** | **100%** | |

### How to reach 100%

1. Complete all onboarding fields (name, bio, category) — **75%**
2. Upload a profile photo in Settings — **+15% = 90%**
3. Create at least one active package in Manage Offerings — **+10% = 100%**

### How it's implemented

```typescript
const profileStrength = (() => {
  let score = 0;
  if (user.full_name) score += 20;
  if (user.username) score += 10;
  if (user.avatar_color) score += 5;
  if (user.avatar_url) score += 15;          // profile photo
  if (user.bio) score += 25;
  if (user.category) score += 15;
  const pkgs = getCreatorPackages(user.id);
  if (pkgs.some(p => p.isActive)) score += 10; // has active package
  return score;
})();
```

This runs inside the Dashboard component. Every time the user's data changes (e.g. they save settings), React re-renders the dashboard and the bar updates automatically.

---

## 21. Stripe Payments

Stripe is the real payment processor used to charge fans when they book a call.

### Why two keys?
Stripe gives you two API keys:
- **Publishable key** (`pk_test_...`) — safe to put in browser code. Used by Stripe Elements (the card input) to tokenize card details on Stripe's servers.
- **Secret key** (`sk_test_...`) — NEVER goes in browser code. Used server-side only to create payment intents and process charges.

These are stored in `.env.local` (never committed to git).

### How a payment works — step by step

```
Fan clicks "Review & Pay"
       ↓
Browser calls POST /api/create-payment-intent
       ↓
Our server (route.ts) uses the SECRET key to create a PaymentIntent
Stripe returns a client_secret (a one-time token)
       ↓
Browser gets client_secret, passes it to <Elements>
Stripe Elements renders a card input form (card number, expiry, CVC)
       ↓
Fan clicks "Pay Now"
stripe.confirmPayment() sends card data directly to Stripe's servers
(our server NEVER sees the raw card number — Stripe handles it)
       ↓
Stripe charges the card, returns success/failure
       ↓
On success → booking confirmed, show success screen
```

### Files involved

| File | Role |
|------|------|
| `.env.local` | Stores both API keys (never committed to git) |
| `app/api/create-payment-intent/route.ts` | Server-side API: creates PaymentIntent using secret key |
| `components/fan/BookingModal.tsx` | Client-side: hosts `<Elements>` and calls `stripe.confirmPayment()` |

### Key concepts

**PaymentIntent** — a Stripe object representing "I want to charge $X". Created server-side, returned as a `client_secret` to the browser. The browser uses this to confirm the payment without ever needing the secret key.

**Stripe Elements** — pre-built UI components from Stripe. The card input field you see in the modal is actually rendered inside an iframe by Stripe, so the raw card number never touches our code.

**`<Elements>` provider** — like React Context, it wraps the part of the UI that needs access to Stripe. The `PaymentElement` and `useStripe()` hook only work inside `<Elements>`.

**Test cards** — in test mode, use these card numbers:
- `4242 4242 4242 4242` — always succeeds
- `4000 0000 0000 0002` — always declines
- Any future expiry date and any 3-digit CVC work.

### Production checklist (before going live)
- [ ] Replace `pk_test_` / `sk_test_` keys with `pk_live_` / `sk_live_` keys
- [ ] Set up a Stripe webhook to mark bookings as "paid" after payment confirmation
- [ ] Store the PaymentIntent ID alongside the booking in Supabase for reconciliation
- [ ] Enable Stripe Radar for fraud protection
- [ ] Wire Stripe Connect onboarding + real creator payouts (current app only tracks payout rows/balances in Supabase)

---

## 22. Glossary

| Term | What it means |
|------|---------------|
| **Component** | A reusable piece of UI — like a LEGO brick. A function that returns JSX. |
| **JSX** | HTML-like syntax inside JavaScript/TypeScript files. `<div className="p-4">` |
| **Props** | Inputs passed to a component: `<Button variant="gold">` — `variant` is a prop |
| **State** | Data that changes over time, causing the UI to re-render: `const [open, setOpen] = useState(false)` |
| **Hook** | A React function starting with `use`. `useState`, `useEffect`, `usePathname` |
| **Server Component** | Runs on the server, no interactivity. Faster. Default in App Router. |
| **Client Component** | Runs in browser. Needs `"use client"`. Handles state, events. |
| **Route Group** | A folder in `(parentheses)` — invisible in the URL, only for organization |
| **Dynamic Route** | `[id]` in a folder name — matches any value in that URL position |
| **Layout** | A wrapper component that persists across page navigations |
| **Tailwind** | Utility CSS classes applied directly in HTML — no CSS files |
| **cva** | A library for defining component style variants cleanly |
| **cn()** | Utility that merges Tailwind classes, handles conditionals |
| **TypeScript Interface** | A type definition describing the shape of an object |
| **Supabase** | Backend-as-a-service: PostgreSQL database + Auth + Storage |
| **Daily.co** | Video infrastructure API for live video calls |
| **Mock Data** | Fake hardcoded data used during development before the real backend exists |
| **`@/` import** | Shorthand for the project root: `@/components/ui/button` = `./components/ui/button` |
| **base64** | A way to encode a file (like an image) as plain text so it can be stored in localStorage |
| **FileReader** | A browser API that reads files selected by the user and converts them to base64 strings |
| **localStorage** | Browser storage that persists between page refreshes. Max ~5MB. Shared across all accounts on the same browser. |
| **Profile strength** | A % score (0–100) calculated from how complete a creator's profile is. Reaches 100% when all fields + a package are set. |

---

## 23. Recent Features Added During Development

### Pricing Label Standardization
All pricing information across the application (on Discover cards and the Creator Profile) has been updated to prefix the cost with **"Starts at"** (e.g. "Starts at $25 per session"). This sets clearer expectations for fans before they view specific package variations.

### Dynamic Avatar Uploads
The onboarding flows for both Creators and Fans were augmented to let users upload profile pictures via a sleek UI featuring a primary `Camera` icon overlay. It uses the `FileReader` API to instantly encode the selected picture as a base64 DataURL and sets it to the user's `avatar_url`. An option to "Remove photo" is also included to revert to the colored initials.

### Booking Navigation
The availability calendar component logic (now shared in `BookingModal.tsx` and the profile's page context) was improved with explicit pagination. A `weekOffset` state tracks how many weeks into the future the fan is viewing. Clicking "Prev" or "Next" seamlessly shifts the displayed days in 7-day increments up to 3 weeks ahead.

### Creator Review System
Fans can now submit genuine reviews after a session. To power this securely, database policies were set ensuring fans can only insert reviews for creators they have interacted with. A new `Recent Reviews` feed automatically appears on the creator's profile pulling directly from the Supabase `reviews` table, replacing the static 'No reviews yet' state.

### Database Booking Persistence
The app no longer relies on mock-data for its booking scheduling flow! Upon a successful synchronous Stripe `PaymentIntent` confirmation within the fan's `BookingModal`, the system securely inserts a new row straight into the Supabase `public.bookings` ledger. While doing this, the platform fees were transitioned: Fans now pay a 2.5% premium at booking checkout, saving exactly `sessionPrice * 1.025` to the gross ledger.

### Creator Earnings & Payout Logic
The Creator Dashboard and Settings -> Billing tabs were upgraded from static mock arrays to dynamically polling via Supabase!
- **Dynamic Dashboard Calculations**: The lifetime total earnings stat automatically calculates exactly 85% of their total `bookings` price, representing their net gross cut from the scheduled calls.
- **Available Balances**: The `settings/page.tsx` compares total earnings against the historical data living natively inside the new `public.payouts` relational table to securely resolve current "Available to Withdraw" amounts. Clicking the robust gold "Withdraw" button inserts a pending transaction request that automatically refreshes their payout history list in real time.

Important limitation:
- this is app-side accounting, not full Stripe Connect payout execution yet
- bookings and live queue both contribute to creator earnings math
- real creator bank payouts still need proper Connect onboarding + transfer orchestration before production launch

### Live Queue Settlement Notes
- live queue uses manual-capture PaymentIntents, not normal one-shot booking charges
- fans are pre-authorized for a max hold amount first
- when the queue entry completes, the server captures only the actual used amount
- the unused remainder of the authorization is released/refunded
- Stripe list views may still visually emphasize the original authorization amount, so PaymentIntent details are the true source of the final captured amount

### Availability / Scheduling Notes
- creator availability is now stored in Supabase, not only mock state
- availability can be package-specific
- creator timezone is saved and fan-side booking times are converted into the fan's local timezone
- creators can choose booking start increments of `15`, `30`, or `60` minutes
- creators can announce a future live time with timezone so fans see a countdown on Discover/profile
