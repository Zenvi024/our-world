# 🌼 Our World — Zen & Jay's Anniversary Website

**Project brief, build plan, and launch runbook**
Prepared for the AI that will build this (planned: Claude Fable 5.2 in Claude Code on the web) and for Zen.
This file lives as `CLAUDE.md` in the root of the GitHub repo so Claude Code reads it at the start of every session.

---

## 0. Kickoff prompt (Zen pastes this as the first message in Claude Code)

```
Read CLAUDE.md in full before doing anything. It is the complete brief for this project,
including my preferences, the feature list, the data model, and the rules you must follow.

You are a senior front-end engineer with strong Supabase experience. You are building
Batch 1 of "Our World," a private, mobile-first, Minecraft-inspired couple website that
is my second-anniversary gift to my boyfriend, Jay. It must be live on Vercel and loaded
with our photos by Thursday night, November 12, 2026, because I give it to him on Friday,
November 13, 2026 (our anniversary) via a QR code.

Start with Milestone 0 in section 11: ask me the open questions in section 12 (no more
than five at once), then propose the file structure and the full SQL migration. Stop and
wait for my approval before writing app code.

Work milestone by milestone. After each milestone, stop and output:
✅ What was completed
🧪 Exactly how I should test it on the branch's Vercel preview link (desktop and iPhone)
⏭️ What the next milestone will do

Stop and ask me before you: delete any file, add any dependency not listed in section 7,
change the database schema after I approve it, use any secret key, or build anything
outside Batch 1. Only build what this brief asks for.
```

---

## 1. The story (why this exists)

- **Who:** Vinzen Josh L. Borja ("Zen," the builder and giver) and his boyfriend, Enrico ("Jay," the recipient). Both use the site; it is a shared space for the two of them, not a one-way greeting.
- **Anniversary:** Together since **November 13, 2024**. Friday, **November 13, 2026**, is their **second anniversary**.
- **How it's given:** Zen will give Jay a **QR code** that opens the site. It will be **hosted on Vercel**.
- **Background:** Jay has made Zen websites before for Zen's birthdays: websites of birthday greetings full of their nice little moments. Zen wants this one to be different: **functional**, something they actually use and **fill up together over the years**.
- **Why Minecraft:** They play Minecraft together. The whole site should feel like their shared Minecraft world.
- **Zen's four words for the vibe:** **cutesy, functional, romantic, Minecraft-themed.** Also "cute and aesthetic."
- **The heart of it:** The calendar serves as **their gallery of dates**, so they keep their photos there and **never forget what they did on this day or that day**. Example from Zen: if they had a date on February 14 or February 25, a photo goes in that day's slot.

---

## 2. Zen's preferences and nuances (preserve these)

- Zen wants the site to look **as close to Minecraft as possible**. He asked whether assets directly from Minecraft could be used. **Decision:** do **not** use Mojang's game files (textures, sounds, logo or wordmark, official font files, or any character/mob art). Instead, create an **original pixel-art look inspired by block-building games**, drawn in CSS, SVG, or canvas by you, so it still feels like their Minecraft world while being entirely original. Do not mention or explain this choice anywhere in the site itself.
- **Jay really likes the color green and lilies.** Use a grassy green palette and a **lily of the valley** motif (original pixel art).
- Photos should **"stack"** on a day, like item stacks in an inventory, with a **number** showing how many.
- Photos must **shrink/compress** before upload and must **handle iPhone HEIC files.**
- The entrance should be a **title screen with a single "Play" button**, not a boring login form.
- Batch planning is Zen's: **Batch 1 = get the inventory calendar up and running** plus the confirmed small features. **Anniversary mode goes in Batch 2** because Zen hasn't fully designed it yet.
- Formatting conventions for all UI text: **perfect grammar**; **12-hour time** (e.g., 7:30 PM, never 19:30); **Philippine pesos (₱)** for any money; **SI units** (km); time zone **Asia/Manila**.
- Zen built and deployed a similar stack before ("Zen's Life OS": **Vite + vanilla JS + Supabase + Vercel**) but has forgotten the launch steps, so walk him through deployment clearly (see section 13).

---

## 3. Feature status at a glance

| Feature | Status |
|---|---|
| Title screen with single **Play** button + login | ✅ Batch 1 (Zen requested) |
| **Inventory calendar** with photo slots, stack counts, and "chest" day view | ✅ Batch 1 (core) |
| Photo compression + **HEIC** support | ✅ Batch 1 (Zen confirmed) |
| Bulk upload that auto-places photos by the date they were taken | ✅ Batch 1 (needed to preload two years of photos) |
| **XP bar** (days together / level = years) | ✅ Batch 1 (Zen liked it) |
| **Advancement pop-ups** | ✅ Batch 1 (Zen liked it) |
| **Lily of the valley** motif + green palette | ✅ Batch 1 (Zen liked it) |
| Hotbar navigation, settings (change password, sign out), home-screen icon | ✅ Batch 1 (small defaults) |
| **Book and quill letters** with scheduled/surprise delivery ("message in a bottle") | 🟡 Batch 1 stretch (so a letter can arrive on November 13); otherwise first item in Batch 2 |
| **Anniversary mode** (clickable montage of their years) | 🔜 Batch 2 (needs a design session with Zen first) |
| **Crafting table date generator** | 🔜 Batch 2 (Zen liked it) |
| **Date invitations / scheduling** with "Add to Google Calendar" | 🔜 Batch 2 (from Zen's original idea) |
| Full two-way Google Calendar sync | ⏸️ Deferred (too heavy for the deadline; use calendar links instead) |
| Splash text, quest log, day/night cycle, jukebox, countdown, email notifications, sounds | 💭 Proposed by the planning assistant; **not yet confirmed by Zen**. Do not build unless Zen says so. |

---

## 4. Batch 1 feature specs

### 4.1 Title screen and login ("Play")
- Full-screen title screen: an original pixel-art landscape (grass, sky, a few lilies of the valley), the site's title in chunky original block lettering (working title: **"Zen & Jay"**; ask Zen for the final name), and one big beveled **Play** button.
- **First visit on a device:** tapping Play opens a small pixel-styled panel to sign in (email + password). After that, the session persists, so on later visits **Play goes straight into the world**.
- Authentication: Supabase Auth, email + password. **Public sign-ups are disabled.** Exactly two accounts (Zen and Jay) are created manually by Zen in the Supabase dashboard.
- Optional (only if Zen confirms): rotating yellow "splash text" lines with their inside jokes.

### 4.2 Inventory calendar (the core)
- **Month view** styled as an inventory panel: a 7-column grid of beveled slots, with weekday headers **Monday through Sunday** (Zen listed Monday first; confirm).
- Opens on the current month (Asia/Manila). Previous/next buttons and a month/year jump. They can go back to **November 2024** and earlier.
- **Each day = one slot.** The day number sits in a corner. If the day has photos, the slot shows the **cover photo** as the "item," and a **stack count** in the bottom-right corner in a pixel font with a drop shadow (show the count only when there are 2 or more, like real item stacks).
- **Default rule:** the stack count = number of photos on that exact date (ask Zen if he would rather count separate dates/memories).
- Today's slot is highlighted. The anniversary (November 13) gets a special lily-of-the-valley frame every year.
- **Tap a slot → "chest" view** (modal styled like an opened chest): all photos and notes for that date, an **Add** button, a full-screen photo viewer, editing of title/note/caption, choosing the cover photo, and delete with confirmation. Include an **"On this day"** row showing memories from the same month and day in other years.
- **Data model idea:** a *memory* is one entry on one date (title, note, who added it) that holds one or more photos. Both Zen and Jay can add, edit, and view everything.
- **Prepare for Batch 2:** each memory has a `featured` flag and an optional `caption`, so Anniversary mode can later pull highlights.
- **Mobile-first:** it must look great and stay tappable on a 375 px–wide iPhone screen.

### 4.3 Photo pipeline (compression + HEIC)
- Accept JPEG, PNG, WebP, and **HEIC/HEIF** (iPhone).
- Convert HEIC in the browser with `heic2any` (lazy-load it only when a HEIC file appears, since it is large).
- Resize and compress with `browser-image-compression`: full image at max **1600 px** on the long edge in **WebP** (~0.8 quality), plus a **~320 px thumbnail** for slots. Fix orientation. Re-encoding strips location metadata, which is good for privacy.
- **Bulk upload:** select many photos at once → read each photo's capture date with `exifr` *before* compressing → show a review list grouped by date (editable) → upload. Photos without a capture date (screenshots, Messenger saves) ask for a date manually. This is how Zen preloads two years of photos on Thursday.
- Show upload progress with a pixel-style progress bar. Handle failures gracefully with a retry.
- Storage: a **private** Supabase Storage bucket; display images via signed URLs (cache them in memory during the session).

### 4.4 XP bar
- A segmented green bar above the hotbar, with the **level number** above it.
- **Level = full years together** (Level 2 from November 13, 2026). **Bar fill = progress** from the last anniversary to the next.
- Tapping it shows a small panel: "730 days together" (on November 13, 2026), plus days until the next anniversary. Compute all dates in Asia/Manila.

### 4.5 Advancement pop-ups
- A toast slides in at the top of the screen with an icon, a small header ("Advancement Made!"), and the advancement name, then slides away. Each advancement shows **once per user** (store unlocks in the database).
- Starter set (Zen may rename or add): **Welcome Home** (first time entering), **Two Years Strong** (on or after November 13, 2026), **First Memory** (first photo added), **Shutterbug** (50 photos), **Every Month** (a memory in all 12 months), **Valentine's** (a memory on February 14), **Pen Pal** (first letter sent), **Message in a Bottle** (first surprise letter received).
- A simple advancements screen shows unlocked and locked ones (locked ones are dim).

### 4.6 Lily of the valley motif and theme
- Original pixel-art lily of the valley (white bell-shaped flowers on a green stem) used as the **favicon**, the **home-screen icon**, loading indicator, and title-screen decoration.
- Palette: grass greens (lead color, for Jay), dirt browns, stone grays for UI panels, cream/white text panels. Chunky beveled panels and buttons, pixel-perfect edges (`image-rendering: pixelated`).
- Fonts: a free pixel font from Google Fonts (e.g., **VT323**, **Silkscreen**, or **Pixelify Sans**) for headings and labels, with a readable fallback for long text (letters, notes).
- Respect `prefers-reduced-motion`. Keep contrast readable.

### 4.7 Hotbar navigation, settings, home-screen app
- A 9-slot **hotbar** fixed at the bottom is the main navigation (Calendar, Letters, Advancements, Settings, with spare slots for Batch 2 features).
- **Settings:** change password, sign out, display name.
- Web app manifest + Apple touch icon so Jay can **Add to Home Screen** and open it like an app.

### 4.8 Book and quill letters (Batch 1 stretch)
- **Write:** an open-book writing screen (parchment page, pixel heading font, readable body font) with a title, the letter, and the sender's name.
- **Delivery options:**
  1. **Now**
  2. **On a date and time** (12-hour picker, Asia/Manila)
  3. **Surprise ("message in a bottle")**: the sender picks a range (e.g., within 7, 30, or 90 days) and the **server** picks a random moment in that range, between 8:00 AM and 10:00 PM Manila time, so even the sender doesn't know exactly when it arrives.
- **Hidden server-side:** the recipient cannot see an undelivered letter at all (enforced by Row Level Security, not just hidden in the UI), so nobody can peek with developer tools.
- **Inbox:** delivered letters appear as books; unread ones shimmer. The sender's "Sent" list shows "Drifting…" until delivered, then "Delivered," then "Read." The sender may cancel a letter before delivery.
- Zen will schedule a letter to arrive on **November 13, 2026**.
- No email notifications in Batch 1.

---

## 5. Batch 2 (do not build yet; documented so nothing is lost)

### 5.1 Anniversary mode (Zen's idea, still being designed)
- A button that launches a **clickable montage of their years together**, either like a **pre-made Minecraft-style quest/story** or an **animated, Minecraft-themed slideshow of their photos** with text Zen writes.
- Zen said he hasn't thought this through yet, so it needs a design conversation with him before building.
- Starting ideas to offer him: chapters per year ("Year One," "Year Two"), loading-screen style transitions between chapters, tap/click to advance, Zen's captions on each slide, featured memories pulled automatically, ending with an advancement unlock and a letter.

### 5.2 Crafting table date generator (Zen liked it)
- A crafting-grid screen: drop ingredients into slots (**Place, Food, Activity, Budget in ₱, Vibe**) → the output slot "crafts" a date idea card.
- Random crafting from ingredient lists that both of them can edit. Save favorite recipes to a list; later, send one as a date invitation.

### 5.3 Date invitations and scheduling (from Zen's original request)
- Propose a date (title, date, 12-hour time, place, note). The other person receives it as a **quest** to accept, decline, or suggest another time.
- Accepted dates appear on the calendar as upcoming (distinct slot style).
- **"Add to Google Calendar"** link plus a downloadable `.ics` file (Zen uses Google Calendar). Full two-way calendar sync is deferred.
- After the date passes, prompt them to add photos, which turns it into a memory.

### 5.4 Other Batch 2 candidates
- Advancements expansion, "Export everything" backup (memories JSON + photos ZIP), optional email notifications for delivered letters.

### 5.5 Ideas proposed but not confirmed by Zen
Splash text on the title screen (fits the Play screen), a quest log as a shared bucket list, a day/night cycle that follows Manila time, a "jukebox" with a shared playlist, a countdown to the next date, and toggleable original sound effects (muted by default). **Ask Zen before building any of these.**

---

## 6. Hard rules for the building AI

1. **No Mojang game files**: no extracted textures, sounds, logo, wordmark, official font files, or character/mob art. All art is original.
2. **Never put the Supabase service-role/secret key in front-end code or the repo.** Only the public URL and anon/publishable key go in the client. `.env.local` must be in `.gitignore`.
3. **Privacy:** every table and the storage bucket are locked down with Row Level Security to the two members. Sign-ups are disabled.
4. **Scope:** build only Batch 1. Do not add features, abstractions, or files beyond what the current milestone needs.
5. **Ask before:** deleting files, adding unlisted dependencies, changing the approved schema, or anything destructive.
6. **Mobile-first, iPhone Safari first.** Test layouts at 375 px wide and on desktop.
7. All UI text: correct grammar, 12-hour time, ₱, SI units, Asia/Manila.
8. Use hash-based routing (e.g., `#/calendar`) so Vercel needs no rewrite config.
9. After each milestone, stop and report ✅ / 🧪 / ⏭️ as described in the kickoff prompt.
10. Zen works in **Claude Code on the web**, so you may not be able to reach Supabase, and Zen cannot open a server you run. Put SQL in `supabase/migration.sql` for Zen to run in the dashboard, and rely on Vercel preview links for testing. Push one branch per milestone.

---

## 7. Tech stack

- **Front end:** Vite + vanilla JavaScript (ES modules) + plain CSS, matching Zen's Life OS so he can maintain it. No framework unless Zen approves.
- **Back end:** Supabase (Auth, Postgres, Storage). New project in the **Southeast Asia (Singapore)** region.
- **Hosting:** Vercel (Hobby/free), auto-deploying from a private GitHub repo.
- **Approved dependencies:** `@supabase/supabase-js`, `heic2any`, `browser-image-compression`, `exifr`; `qrcode` (dev only, to generate the gift QR image). Ask before adding anything else.
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Supabase free-plan facts to design around
- Free projects **pause after 1 week of inactivity** and must be restored manually. Add a **keep-alive**: a GitHub Actions workflow that calls a tiny `ping()` database function every 3 days. Explain it to Zen.
- **1 GB file storage** on the free plan. With compression (~250 KB per full image + thumbnail), that is roughly a few thousand photos.
- Only **2 active free projects** per account. Zen's Life OS already uses one, so this may be his second.
- **No automatic backups** on the free plan, so Zen should keep his originals in his phone/cloud gallery too.

---

## 8. Data model (sketch; refine in Milestone 0 and get Zen's approval)

```sql
-- Members (exactly two rows: Zen and Jay)
profiles (
  id uuid primary key references auth.users,
  display_name text not null,          -- "Zen", "Jay"
  created_at timestamptz default now()
)

-- One memory = one entry on one date
memories (
  id uuid primary key default gen_random_uuid(),
  memory_date date not null,           -- Asia/Manila calendar date
  title text,
  note text,
  caption text,                        -- for Anniversary mode later
  featured boolean default false,      -- for Anniversary mode later
  cover_photo_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references memories(id) on delete cascade,
  storage_path text not null,          -- full WebP
  thumb_path text not null,            -- thumbnail WebP
  taken_at timestamptz,                -- from EXIF when available
  width int, height int,
  sort_order int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id),
  recipient_id uuid references profiles(id),
  title text,
  body text not null,
  delivery_mode text check (delivery_mode in ('now','scheduled','surprise')),
  deliver_at timestamptz not null,     -- set by a server function for 'surprise'
  read_at timestamptz,
  cancelled boolean default false,
  created_at timestamptz default now()
)

advancement_unlocks (
  user_id uuid references profiles(id),
  advancement_key text,
  unlocked_at timestamptz default now(),
  primary key (user_id, advancement_key)
)
```

**Row Level Security (summary):**
- All tables: only authenticated users who exist in `profiles` can read/write.
- `letters` SELECT: `sender_id = auth.uid()` **or** (`recipient_id = auth.uid()` **and** `deliver_at <= now()` **and** not cancelled). INSERT only as yourself. The surprise time is chosen inside a `security definer` function (`send_letter`) so the client never chooses or sees it.
- Storage bucket `photos`: private; read/write only for members.
- `ping()` function for the keep-alive.

---

## 9. Non-functional requirements

- Fast on mobile data: lazy-load thumbnails, load full images only in the chest/photo viewer.
- Works in iPhone Safari and Chrome on desktop.
- Accessible: buttons have labels, focus states are visible, reduced-motion respected.
- Graceful empty states (an empty month should still look cute, e.g., a lily in an empty slot or a gentle "No memories yet" note).

---

## 10. Timeline

- **Tuesday, November 10:** planning (done).
- **Wednesday, November 11:** Milestones 0–2 (setup, login, calendar, photo uploads).
- **Thursday, November 12:** Milestones 3–5 (theme polish, XP bar, advancements, letters if time, deploy), then **Zen preloads two years of photos** and schedules a letter for November 13. Test on an iPhone.
- **Friday, November 13 (anniversary):** Zen gives Jay the QR code. Avoid deploying risky changes on Friday.

---

## 11. Milestones (Claude Code works in this order and stops after each)

- **M0 – Plan:** ask the open questions (section 12), propose file structure and the full SQL migration (tables, RLS, storage bucket and policies, `send_letter`, `ping`). Wait for approval.
- **M1 – Foundation:** Vite scaffold, Supabase client, title screen with Play, login panel, persistent session, hotbar shell, settings (change password, sign out).
- **M2 – Calendar + photos:** month view, slots with cover and stack counts, chest view, single and bulk upload with HEIC conversion, compression, and EXIF dates; edit/delete; "On this day."
- **M3 – Charm:** lily-of-the-valley art and palette polish, XP bar, advancement toasts + advancements screen, home-screen manifest/icons, empty states.
- **M4 – Letters (stretch):** compose, three delivery modes, inbox, sent list, read status, cancel.
- **M5 – Ship:** merge to `main` for the production deploy (section 13), add the keep-alive workflow, generate a QR code PNG of the live URL and commit it, and run the final test checklist.

---

## 12. Open questions to ask Zen in Milestone 0

1. What should the site be called (the title on the Play screen)? Working title: "Zen & Jay."
2. Which email will Jay's account use, and what temporary password should go on the gift card?
3. Should weeks start on Monday (as Zen listed) or Sunday?
4. Should the stack count be the number of **photos** on that date (default) or the number of separate **memories/dates**?
5. Does Zen want splash text on the title screen (and if so, his list of inside jokes)?

---

## 13. Launch runbook (step by step, for Zen; Claude Code should guide him through it)

Zen builds with **Claude Code on the web** (claude.ai/code), connected to a GitHub repo. Claude works in a cloud machine, pushes a branch, and Vercel turns every branch into a preview link Zen can open on his iPhone. Nothing has to run on his MacBook.

### A. GitHub repo (Wednesday morning)
1. github.com → **New repository** → name it (e.g., `our-world`) → **Private** → tick **Add a README** so the repo isn't empty → Create.
2. In the repo: **Add file → Upload files** → upload this `CLAUDE.md` to the root → Commit to `main`.

### B. Vercel (connect it early so every branch gets a preview link)
1. vercel.com → **Add New… → Project → Import** the `our-world` repo. Deploy it as is; the first deploy may be blank, which is fine.
2. After Supabase is set up (step C), go to **Settings → Environment Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, ticking **Production** and **Preview**. Redeploy afterward.
3. Optional: **Settings → Domains** to pick a nicer `.vercel.app` name.
4. How it works from here: every branch Claude pushes gets its own **preview URL** (shown on the GitHub pull request and in Vercel). Merging into `main` updates the real site.

### C. Supabase (back end)
1. supabase.com → **New project** → name it (e.g., `our-world`) → region **Southeast Asia (Singapore)** → save the database password somewhere safe.
2. **Authentication → Sign In / Providers:** keep Email enabled and **turn off "Allow new users to sign up."** (Labels may differ slightly.)
3. **Authentication → Users → Add user → Create new user:** create **your** account and **Jay's** account, ticking **Auto Confirm User** for both.
4. **SQL Editor:** paste and run the migration Claude writes in M0 (Claude saves it in the repo, e.g., `supabase/migration.sql`; copy it from GitHub).
5. **Project Settings → API (or API Keys):** copy the **Project URL** and the **anon / publishable** key into Vercel (step B2). **Never** put the service-role/secret key anywhere in the repo.
6. **Authentication → URL Configuration → Site URL** = your Vercel production link.
7. The cloud session does not need the Supabase keys; it only writes code. The keys live in Vercel.

### D. Build loop with Claude Code on the web
1. claude.ai/code → select the `our-world` repo and the `main` branch → choose **Fable 5.2** in the model picker if your plan offers it.
2. Paste the kickoff prompt from section 0.
3. For each milestone: Claude pushes a branch → open the branch's **Vercel preview link** on your iPhone and Mac → test → tell Claude what to fix → when happy, have Claude open a pull request and **merge it into `main`**.
4. Start each new milestone from the updated `main` so nothing gets lost. Sessions keep running if you close the tab, and you can check on them from the Claude mobile app.
5. Never paste keys or passwords into the chat or commit them; `.env.local` (if Claude creates one for reference) stays in `.gitignore`.

### E. Production
1. When Batch 1 is merged into `main`, Vercel publishes it to your production link automatically.
2. Test the production link (not a preview) on your iPhone before Thursday night's photo upload.

### F. Keep it alive
Claude adds the GitHub Actions keep-alive so the free Supabase project doesn't pause after a week without visits. It needs the Supabase URL and anon key stored as **GitHub repository secrets** (repo → Settings → Secrets and variables → Actions); Claude will tell you the exact names.

### G. Load it up (Thursday night)
1. Sign in on the live site and **bulk-upload** your photos; review the dates.
2. Mark a few favorites as **featured** (for Anniversary mode later).
3. Write a **book and quill letter** scheduled for **November 13, 2026** (if letters made it into Batch 1).
4. Sign in once as Jay on a private browser window to confirm he sees everything, then sign out.

### H. The gift
1. Claude Code generates a QR code PNG of the live link.
2. Print it on a card with Jay's email and temporary password (he can change it in Settings).

### I. Final test checklist
- [ ] Play → login works on iPhone Safari; session persists after closing the tab.
- [ ] HEIC upload works; photos are compressed; thumbnails load fast.
- [ ] Stack counts and the chest view are correct.
- [ ] XP bar shows Level 2 and 730 days on November 13, 2026.
- [ ] Advancement toasts appear once each.
- [ ] Jay's account sees all memories; an undelivered letter is invisible to him.
- [ ] Add to Home Screen shows the lily icon.
- [ ] Nothing secret is in the GitHub repo.

---

## 14. Decisions made with Zen (November 10, 2026)

These answer the open questions in section 12 and take priority over the working defaults above.

- **Site title:** "Our Little World," with "by Zen & Jay" beneath it on the Play screen.
- **Week start:** Monday.
- **Stack count:** the number of photos on that date.
- **Splash text:** yes, and it must be editable in the app. Splash texts live in the `splash_texts` table (members only) and are managed in Settings. They take turns on the title screen. Signed-out visitors only ever see a generic default line.
- **Jay's account:** already exists in Supabase Auth. Never ask Zen for passwords or keys.
- **Letters:** the app reads and writes letters only through the database functions `send_letter`, `get_letters`, `mark_letter_read`, and `cancel_letter`, so a surprise letter's arrival time stays hidden from both people.
- **Fonts:** Pixelify Sans for the logo only; Jersey 15 for headings and buttons; VT323 for small labels and numbers (its digits are the easiest to tell apart).
- **Supabase access from Claude Code:** the Supabase connector in the cloud session cannot see the `our-world` project, so Zen runs `supabase/migration.sql` himself in the SQL Editor.

---

## 15. Zen's later requests (November 10, 2026)

### Done
- Title screen is a cozy scene: a cottage with a red roof and birch walls, bonsai-style cherry blossom trees (after Zen's reference photo), snow-capped mountains fading into the sky, falling petals (Zen really likes these), chimney smoke, and two front-facing hopping capybaras modeled on the cream capybara toy at home (one carries an orange on its head, like the toy).
- A house button in the top-left of every in-world screen returns to the title screen.

### Also done (Milestone 3, with Zen's additions)
- **Goals** (Zen's idea for customizable advancements): the Goals screen holds a shared bucket list. Each goal has a title, notes, and an optional "from" and "to" date. Goals can be reordered with arrows, marked "Done!" (which pops up "Goal Reached!" once for each person), and moved back with "Not yet." The built-in advancements sit below them.
- **Ledger** (hotbar coin): expenses in pesos, who paid, shared equally or owed in full, a running "who owes whom" balance, and "Settle up."
- **Pokes:** a "Poke" button on the Play screen; the other person gets a dark pop-up.
- **Play screen as a notice board:** pokes every time; once a day per device, an anniversary countdown (within 30 days), "On this day" with last year's photo (tap to open that day), and a goal whose target window is here.
- **Sound:** original, synthesized click sounds and pop-up jingles (on by default) and an original music-box loop (off by default; note button on the Play screen). Both have switches in Settings and are remembered per device. There are no audio files.
- Goals, the ledger, and pokes use `supabase/migration-2.sql`, which Zen runs after `migration.sql`.

### Also done (Milestone 4 and the "make everything cozy" round)
- **Letters (Milestone 4):** a shelf of received letters (unread ones shimmer and say "New"), an open-book page for reading and writing, three ways to send (now, on a day and time in 12-hour Manila time, or a surprise within 7, 30, or 90 days), a "Letters you sent" list (Drifting…, Arrives …, Delivered, Read, Taken back), and "Take back" before delivery. A pop-up announces a newly arrived letter.
- **Heart reactions** on goals and letters, and **little replies** (comments) on letters.
- **Mood hearts** under every screen title: yours on the left (tap to set 0 to 5), your partner's on the right. At 2 hearts or fewer, the other person gets a pop-up.
- **Cozy look everywhere:** warm paper panels, wooden buttons and hotbar, sandy slots, and a handwriting font (Patrick Hand) for notes. Zen found the gray panels "boxy, robotic, corporate"; keep new screens skeuomorphic and warm.
- **Ledger as an open book with a quill:** tools (sticky-note balance, "Add an expense," "Settle up") sit beside the book; on wide screens they are on the left and the book opens to two pages. **Settle up accepts a partial amount.**
- **Goals as notes pinned to a wooden board.**
- **Music:** three original music-box pieces that take turns, and one speaker button (Play screen and every in-world header) that steps off, soft, medium, full. Settings has the same volume and a "Next tune" button.
- These use `supabase/migration-3.sql` (moods, goal_hearts, letter_hearts, letter_comments), run after the first two.

### Zen's corrections on the look (November 11, 2026) — these override the "cozy" round where they conflict
- **Keep it looking like Minecraft.** The Play button, the calendar and chest, the hotbar, menus, and ordinary buttons are gray stone, like an inventory. The warm "cozy" materials are only for objects: the book, the quest board, and the photo frame.
- **Names:** the calendar screen is called **Memory Chest**; goals are called **Quests** ("Our quests", "Add a quest", "Quest Complete!").
- **Hotbar icons**, hand-drawn in the blocky item style after Zen's references: a gold clock (Memory Chest), a book and quill (Letters), a blank map (Quests), an emerald (Ledger). Zen offered Mojang's own icon images; rule 1 in section 6 still stands, so these are original drawings of the same objects.
- **The book** (ledger and letters) follows Zen's book-and-quill reference: leather cover, plain cream pages with a spine, tan "Page 1 of 2" labels, pixel lettering. No handwriting font in the book.
- **Health and hunger** sit just above the XP bar: hearts on the left, drumsticks on the right, a name in the middle. The display alternates between Zen and Jay every few seconds (tap the name to switch); each person sets only their own. At 2 or fewer of either, the other gets a pop-up. Hunger uses `supabase/migration-4.sql`.
- **Desktop:** the calendar is larger. **Photo viewer:** the photo sits in a taped snapshot frame with its title and date.

### Milestone 5 (ship) — done
- Merged to `main`; the keep-alive workflow is `.github/workflows/keep-alive.yml` (needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repository secrets); the gift QR code is `gift/our-little-world-qr.png` (remake with `npm run qr`).

### "Daily life" round (November 11, 2026) — merged
Zen chose these from a list of suggestions. They need `supabase/migration-5.sql`.
- **Play screen:** tappable capybaras (they hop and pop a heart); a "Send…" menu with Poke, Hug, Kiss, Miss you, Eat na, and Drink your water; a Good night / Good morning button (the other person is told, and Zs rise from the roof); a campfire past the trees that is lit on days both visit, roars while both are online, and tells its streak when tapped; a sky that follows Manila time (dawn, day, dusk, night with stars and a moon).
- **Memory Chest:** Take me back (a random memory), Favorites, and Search.
- **Letters:** sealed "open when…" letters shown as envelopes, drafts kept on the device, and a pointer to a sealed letter when your own hearts drop to 2 or fewer.
- **Quests:** steps (a checklist inside each quest).
- **Ledger:** tap a line to edit it, treats that nobody owes, and totals for the month.
- **New hotbar slots:** Lists (shared lists kept in chests) and Question of the Day (answers stay hidden until both have answered).
- **Hotbar:** the selected item's name floats above the bar.
- **Sounds and motion:** a chest creak, a page turn, a pop when a photo lands, a swaying lily loader.
- **Avatars:** each person picks a capybara (Settings), shown beside their name on the meters.
- **Live updates:** a private Realtime channel carries "something changed" pings and who is online; the once-a-minute check remains as a fallback. Not testable from the cloud session.
- **Notifications:** an opt-in switch in Settings; they appear only while the site is open in the background (no push service). Not testable from the cloud session.
- **Settings:** a storage meter with an editable plan size, and Backup (one data file, plus photos as ZIP files).
- **Tidy-up:** unused icons and dead code removed. The style sheets are still layered from the two look changes; merging them into one is still to do.
- **Chosen for later by Zen:** the first-entry book for Jay (he will plan it first). **Declined:** a countdown sign and quest savings.

### Happybara and night mode (November 11, 2026) — merged
Zen asked for "everything about" Happybara, and for the Good night button to become a night-mode switch. Needs `supabase/migration-6.sql`.
- **Happybara** (hotbar egg, route `#/pet`): one shared capybara in a pixel room. Four needs run down with the clock, even while the site is closed: hunger (10 hours), thirst (6), fun (14), clean (30). Feed, Water, Play, and Bathe earn coins (2, 3, 5, 8) only when the need is below 85; feeding uses one meal from the pantry. Tapping the pet cuddles it (love +1, and 1 coin at most once an hour). Love raises its level (30 per level).
- **Shop:** food, furniture, and hats. (The first prices were replaced in the expansion below; they now live in the `pet_shop` table.)
- The pet sleeps from 10:00 PM to 6:00 AM Manila time (in its bed, if it has one), bathes in the tub if it has one, looks sad when a need is nearly empty, can be renamed (tap its name), and keeps a diary of who did what. A pop-up says when it needs something (at most once every 4 hours per device).
- Everything goes through the database functions `pet_care`, `pet_buy`, `pet_wear`, and `pet_rename`, so coins cannot be invented from the browser.
- **Night mode:** the moon button on the Play screen (and a switch in Settings, under Look) turns the scene to night and the whole site to a dark slate-blue palette (`src/styles/night.css`, `src/lib/theme.js`). Remembered per device. The book, quest board, sign, and photo frame keep their materials and are dimmed.
- **Good night and Good morning** moved into the "Send…" menu. They still set who is asleep (Zs on the roof, "zZ" beside the name), and sleep now wears off by itself after 12 hours.

### Happybara expansion, focus timer, angry cats, and Our Reviews (November 11, 2026) — merged
Zen wants to play Happybara with Jay "for many months," so the game was made much bigger and dearer. Needs `supabase/migration-7.sql` (after 6).
- **The house:** five rooms with tabs above the picture: living room (free), kitchen (250 coins, level 3), bedroom (450, level 6), bathroom (700, level 10), garden (1,000, level 15). Each has its own furniture (37 pieces in all). Feeding moves to the kitchen, baths to the bathroom tub, play to the garden, and sleep to the bedroom bed, once those exist.
- **Shop sections:** Food (meals, plus treats that turn coins into love), Rooms, Decor (furniture by room), Walls (5 wallpapers and 4 floors, applied to the room you are standing in), and Outfits (16 hats and 8 accessories; one of each can be worn).
- **Prices and level gates live only in the `pet_shop` table** (78 rows, about 10,800 coins in all). To retune, update that table; the site reads it. Names and pictures are keyed by `item_key` in `src/data/pet.js`, `src/art/rooms.js`, and `src/art/outfits.js`.
- **Income:** care as before; a **teamwork bonus** of 10 coins the first time each day both have cared; a **daily gift** of 5 coins each; and the **focus timer**.
- **Focus timer** (on the Happybara screen): 25 minutes on the database's clock, so it keeps going when the site is closed. Finishing pays 8 coins and 2 love, up to 6 paid sessions a day each. It finishes itself from any screen and shows a pop-up. It cannot tell whether you really focused; it only requires the 25 minutes to pass.
- **Tricks** are learned at levels 3, 6, 10, and 15 and show when the pet is tapped.
- **Angry cats** replaced the hunger meter: five cats on the right of the meters, happy by default; tap to turn 1 to 5 of them angry and red (`moods.angry`). The other person gets a lighthearted pop-up for each change, and another when the cats are happy again. The old `hunger` column is no longer used.
- **Title screen:** three capybaras with name tags. Zen's and Jay's wear the hat of the avatar each chose in Settings; the small one is Happybara in whatever it is wearing. The two big ones are named **Dook** (Zen's) and **Boop** (Jay's); the tags are matched by display name in `src/screens/title.js`, so if a display name changes, update `CAPYBARA_NAMES` there.
- **Our Reviews** (hotbar star; all nine slots are now used): cafés, restaurants, movies, shows, places. Each review has a name, where, a date, and separate 1-to-5 stars and words from each person, with filters, "Best first," and an average. Tables `reviews` and `review_ratings`.
- **Fixed:** the loader on the letter shelf wrapped and overflowed; night-mode menus lost their arrow.

### Play-screen tidy-up and fuller reviews (November 11, 2026) — merged
Needs `supabase/migration-8.sql` (after 7).
- **Night switch:** now a square sun-or-moon button under the speaker on the Play screen (the Settings switch stays).
- **"Our album" button:** a dimmed "Soon" button beside "Send…" under Play. It is a placeholder for the **anniversary album**: the first-entry book, an album of their memories through the years, which Zen will design together with Claude later. Tapping it only says it is still being made.
- **Our Reviews, fuller:** up to 6 photos per review (same compression and HEIC handling as memories; files live in the private bucket under `reviews/<review id>/`), shown on the card and in the snapshot frame; a price level (₱ to ₱₱₱); "would go again" / "would watch again" from each person; a search box; "Both loved it!" and "Split decision!" badges; and a button to open that day in the Memory Chest. Review photos count toward the storage meter, and reviews are in the data backup (their photo files are not in the photo ZIPs yet).

### Seasons, weather, and a livelier Play screen (November 11, 2026) — merged
No database file is needed for this round.
- **Seasons:** spring (the original look), summer, autumn, and winter, switched with a square button under the sun-or-moon switch (and a menu in Settings, under Look). Remembered per device. Each season recolors the trees, grass, bushes, and hills and changes what drifts through the air (petals, nothing, leaves, snow). Summer adds sunflowers, autumn pumpkins, winter a snowman and snow on the roof. The palettes are `LOOKS` in `src/art/landscape.js`.
- **Weather:** clear by default. A fourth square button under the season button (and a menu in Settings) steps through clear, rain, and a rainbow; remembered per device. In winter, "rain" falls as heavy snow. (It first changed by itself every three hours; Zen asked for clear skies unless he chooses otherwise.)
- **Little wonders:** butterflies by day in spring and summer, two birds crossing the sky now and then, fireflies from dusk (not in winter), and a shooting star about every half minute at night. Tapping the sky just after one makes a wish (a pop-up only; nothing is saved).
- **Dook and Boop act like their people:** a capybara whose person has said good night sleeps with closed eyes and Zs; when both have, the cottage windows go dark. While both people are online, the two sit on either side of the campfire and a heart rises between them now and then. (The Zs from the chimney are gone; the sleepers carry them.) The "together" part depends on live presence, which cannot be tested from the cloud session; it was checked with a test harness.
- **Mailbox:** a red mailbox left of the cottage. Its yellow flag goes up and an envelope peeks out while an unread letter waits; tapping it opens Letters.
- **Photo of the day:** a small taped snapshot in the top-left corner of the Play screen: one favorite memory a day (any memory with a photo if there are no favorites), the same for both people. Tapping it opens that day.
- **Monthsary marks:** every 13th from December 2024 on has a small lily in its Memory Chest slot, and the Play screen says "Monthsary 25!" on the day. November 13 keeps its anniversary frame instead.

### The anniversary album (November 12, 2026) — on the preview branch, not yet merged
Zen's design, from a voice note: a Minecraft-style storybook, from him to Jay, of their years together. Needs `supabase/migration-9.sql` (after 8).
- **What it is:** a full-screen beige storybook opened from the "Our album" button on the Play screen. Each spread has an animated pixel picture of the two of them on one page and Zen's words on the other (picture above words on a phone; side by side on a wide screen). The words write themselves; a tap finishes the sentence, and the next tap turns the page. About 3 to 5 minutes, at Jay's own pace, replayable.
- **What he wants Jay to feel:** calm, at peace, loved, and appreciated; mostly tender and romantic, a little whimsical at the embarrassing moments. Only Zen speaks in it. The running thread is "not always on the same page, but always in the same story," and it ends on blank pages: the next chapters are theirs to write.
- **Pages** (17, keyed by `scene`): cover, classroom, strength, pride, study, bouquet, samepage, ferriswheel, home, grab, storm, graduation, lawschool, dinner, baguio, fireworks, blank. The pictures are drawn in `src/art/story.js`; the two characters are in `src/art/people.js` ('a' is Zen: shorter, round face, round silver glasses, a mole under one eye; 'b' is Jay: taller, swept-up hair, dark glasses).
- **The world behind the book** changes with each page (time of day and season, `PAGE_WORLDS` in `src/data/album.js`), Dook and Boop walk along the bottom, and fireworks fill the sky at the end.
- **Music:** its own original piece, "Same Page" (`src/lib/sound.js`), which plays while the album is open even if the everyday music is off; a speaker button in the album mutes it.
- **Zen's editing:** only the album's author (Zen) sees "Edit page" (the date line, the words, leaving a page out, and tucking a real photo behind the picture, which Jay can reveal and which develops like instant film) and "Give it" / "Take it back." Until it is given, Jay's button stays "Soon" and the database returns him no pages at all.
- **Privacy:** the words live only in the database. Nothing of the story's text may go into the site's code, because the built site's files can be downloaded without signing in. Draft words were handed to Zen as a separate SQL file outside the repo.
- **Zen's notes on the look (November 12):** this is how he pictured it. The book must look like a book, not a thin passport: tall pages with page numbers (done). The Pride page follows his photo: night, the lawn in front of the Church of the Gesù (a white pyramid with a cross), both in masks, Jay in a mustard shirt making peace signs, Zen in a red patterned shirt with the rainbow flag over his shoulders like a cape; no other flags.
- **Still open:** whether the album should open by itself the first time Jay enters (now the button glows and says "New"); the music has not been heard by anyone yet.

### Advice given on a private chat (Zen asked; not built yet)
Feasible as a later milestone: a messages table, live updates through Supabase Realtime, emoji from the normal keyboard, and photos through the existing photo pipeline. The catch is notifications: without them a message is only seen when the site is open. Push notifications on iPhone need the site added to the Home Screen, permission granted, and a small server function with its own keys. Messages would be private to the two accounts but not end-to-end encrypted. Recommended after the anniversary, starting without push.

### Still to do, in this order (Zen asked that none of these be forgotten)
1. **Private chat** (see the advice above), if Zen confirms.
2. **Reminders for upcoming dates** beyond goals and the anniversary (ties into Batch 2 date invitations).
3. Batch 2 as written in section 5: Anniversary mode, crafting table date generator, date invitations.
4. Merging the layered style sheets into one.
