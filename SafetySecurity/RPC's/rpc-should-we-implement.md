# RPCs (Supabase / Postgres): what they are, and whether you need them

This note is for deciding **if** and **when** to use **RPCs** in your stack—explained in a simple way first, then with enough detail to make a real choice.

---

## Part 1 — Like you’re 12

Imagine your app is a **classroom** and the database is a **locked supply closet**.

- **Normal database rules (RLS)** are like: “You may only touch **your own** box on **your** shelf.” That works great for simple stuff.
- Sometimes you need a **teacher** (the database) to do something **special** in one go: “Take **this** form from **that** student, stamp it, file it, and update **two** different shelves **together**—and only if the rules say it’s allowed.”

An **RPC** is you **ringing a bell** with one word: *“Do the special procedure named X.”*  
The **procedure** (a Postgres **function**) runs **inside** the database. Your app doesn’t have to do five separate steps and hope nothing breaks in the middle.

**Do you *have* to use RPCs?**  
No. They’re a **tool**, not a rule.

**When are they a good idea?**  
When the “teacher procedure” keeps things **fair**, **safe**, and **simple** for the app.

---

## Part 2 — What an RPC actually is (still plain language)

- **RPC** = **Remote Procedure Call**: the client (or your server) calls a **named function** on the database, e.g. `acknowledge_website_transfer()`, instead of only `select` / `insert` / `update` on tables.
- In **Supabase**, that usually means: **`supabase.rpc('function_name')`** (from a logged-in user or from your server).

The function is written in **SQL/PLpgSQL** and lives in **Postgres**, same as your tables.

---

## Part 3 — Why people use them (the real reasons)

### 1. **Rules that must hold no matter what**

If the rule is “only update **my** row” and that’s already enforced by **RLS**, you might **not** need an RPC.

If the rule is trickier—e.g. “only if **paid amount ≥ target** and **notes exist**”—you can put that check **inside** the function so every caller gets the **same** behavior. That’s **one source of truth**.

### 2. **`SECURITY DEFINER` (runs with elevated trust)**

Some updates are awkward with normal RLS (e.g. user must close a row in **`in_review`**, but RLS only allows edits while **`submitted`**).

A **security definer** function runs as the function **owner** (often a privileged role), but **you** still write code that says: “only `where user_id = auth.uid()`” so users can’t touch others’ data.

That’s powerful and **must be written carefully**—wrong `WHERE` = security bug.

### 3. **Several steps, one transaction**

Example: set a timestamp on **profiles** and set **website_requests** to **closed**.  
If one fails, both roll back. Doing that in **one function** avoids half-finished states.

### 4. **Less duplicated logic**

Same rules from the **Next.js server** (admin client) **and** from the **browser** (anon/authenticated) can drift apart. A function keeps the **core rule** in the database.

---

## Part 4 — Reasons *not* to use RPCs (or to use fewer)

- **Harder to read** for people who only know TypeScript: logic is split between app and SQL.
- **Migrations and reviews**: every change to behavior needs a **migration** and careful review, especially for `SECURITY DEFINER`.
- **Testing**: you test SQL functions differently than React/Next code.
- **Sometimes RLS + server-only code is enough**: if **only** your **server** (with **service role** or trusted server actions) ever performs the action, you can enforce rules in **one** TypeScript module and skip an RPC.

---

## Part 5 — Do **you** need to implement RPCs for Freeplug?

### You **already did** (in this repo)

Your migrations define things like:

- Handoff acknowledgment (`acknowledge_website_transfer`)
- Closing an open request from the customer side (`cancel_own_website_request`)

So the question isn’t “should we ever use RPCs?”—you **already chose yes** for those flows.

### Going forward: decision checklist

| Situation | RPC often makes sense? |
|-----------|-------------------------|
| User-triggered action, **must** respect strict DB rules, might use **security definer** | **Yes** |
| Multiple tables must update **together** | **Yes** |
| Only **your** Next server talks to DB with **service role**, simple update | **Often no** (server action is fine) |
| Pure CRUD, already covered by **RLS** | **Usually no** |

**Bottom line:**  
- **Required for the product?** Only if you want those behaviors **enforced in the database** the way you designed (handoff + cancel)—**yes**, keep them.  
- **Required for every feature?** **No.** Use RPCs when they **buy** you safety, atomicity, or simpler RLS—not by default.

---

## Part 6 — Safety note (short)

Any **`SECURITY DEFINER`** function should:

- Set a safe **`search_path`** (you use `public`—good pattern).
- **Scope every write** with `auth.uid()` (or equivalent) so one user cannot act as another.
- Be **granted** only to roles that should call it (`authenticated`, etc.).

---

## Summary

- **RPC** = call a **Postgres function** from the app; good for **strict rules**, **multi-step updates**, and **tricky RLS** situations.
- **Not mandatory** for everything—many features are fine with **RLS + server code**.
- **For your project:** you **already use** RPCs where they fit; **keep** them for those flows, and **add** new ones only when this doc’s checklist says they earn their complexity.
