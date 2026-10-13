# The Product zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Product room's records
live in `wireframe-lab/PRODUCT-ROOM.md`, the root `CHANGELOG.md`, and the git history.*

---

## 2026-10-05 — the log starts

**What this folder is.** The Product zone's own shelf. The Product room embeds the app builder —
its hosted tools are services of their own (`builder`, `builder-engine`; the README's
"The rooms' tools are services of their own" table names them) — and its record so far lives in
`wireframe-lab/PRODUCT-ROOM.md` and `wireframe-lab/PRODUCT-TEAM-SOLUTION.md`.

Entries land here as the zone's work lands.

---

## 2026-10-06 — the stage loads, the store is clean, the engine is in the repository

**The room's stage loads again** (fixed at the engine, both edits local-only; the full
forensics live in `wireframe-lab/CHANGELOG.md`): preview URLs now use the path form
(`http://localhost:4000/preview/<id>/`), and a slashless request redirects to it so a built
page's relative links resolve. Verified live with a proof build; the owner's own follow-up
prompt completed in the same project (`product-idea-h65`).

**The store is clean.** The 34 click-born empty shells were deleted through the engine's own
delete route — each verified empty first. Two real projects remain (`product-idea`,
`product-idea-h65`); full copy at `~/Raibach_IDS-vcaas-data-backup-2026-10-06/`; the
**Product Team** category row is untouched.

**The engine is backed up** (owner: *"the engine is one of the most important things that we
just did and it needs to be backed up. You can git-ignore DeepSeek credentials and still put
the core of the application."*): the builder app and its engine enter this repository on the
working branch — 179 files, mirroring main's import — with the DeepSeek key
(`local-vcaas/.env`), the engine's store (`data/`) and build output kept out. Commit `6bf8d0b`,
pushed to `origin/pre-removal-build`.

## 2026-10-06 — the room's chat runs the application (absorbed, verified live)

Owner, 2026-10-06: *"I want to absorb that chat into our chat … I don't want two different
chat setting side-by-side."* And, settling the shape the same day: *"we're not taking Grace's
behavior in the chat. We're using the application's behavior in the chat"* — *"just a styling
treatment to the existing capabilities."* The room's one chat now carries the application's
own behavior on the existing chat capabilities: the person's turn is a prompt to the local app
builder, the thread drawn is the engine's conversation, the reply is the builder's own
sentence. The engine stays the record; the platform row is a disposable CARRIER (mechanics and
the three defects the first live send found: `wireframe-lab/CHANGELOG.md`, same date).

**Verified live:** a habit tracker built from a turn typed in the room ("Habits from the
room" on the stage); a follow-up turn answered by the builder without touching the files
("Already in place — …"); a cold-start turn built a reading-list page; the stage remounts on
each finished build. The room's rail is reduced to Chat/Trace/Tools/Approve/Evals/Settings
(stubs as agreed); "Agent" waits for its My Projects replacement.

## 2026-10-06 — projects persist like packages (the room comes back to what you left)

Confirmed with the owner and verified live: a product project IS a package — its
conversations are your return visits ("five different edit processes over a month to one
project"). Entering the room now REOPENS the project last touched instead of birthing one per
click; the package persists (hidden from the console's cards until published — the same draft
rule every package follows); renaming writes the builder's label and the package title
together; an unnamed visit takes its first prompt as its name; and an empty project shows one
welcome line before the application takes over. Verified on `product-idea-hyj` (kept after a
sync, marked draft, resumed by the room) with the published cards (h65, product-idea)
unchanged. Mechanics: `wireframe-lab/CHANGELOG.md`, same date.

**Next (agreed in discussion; not yet built).** The room's chrome and styling pass: the
builder app's real buttons/icons on the controls the wireframe draws; text colours fixed for
the white ground; the rename control; the door for starting a NEW idea; the remaining rail
stubs (Trace/Tools/Approve/Evals). No separate projects surface — the package's own
conversations are the projects (owner, 2026-10-06). **The handoff sheet — "IDs for Design" —
lands in this folder once those elements are built**, carrying the real IDs, bindings and
declared events for the drawing side (owner, 2026-10-06: *"may need to be done after you've
built it"*).

**2026-10-11 — the builder and its engine live on the box.**
The Product room's tool is deployed to raibach-cloud-3 as two services on the shared network:
the builder UI (`basePath /builder`, behind the door's `/builder*`) and the builder engine
(`wireframe-lab/ai-app-builder-open/local-vcaas/server.mjs`, dependency-free, `/preview*`),
both recorded in `wireframe-lab/raibach-cloud-3/ids/docker-compose.yml`. The engine's
`VCAAS_BASE_URL` is passed as a BUILD argument — the build's lockdown guard refuses to compile
without it — and resolves to the door itself, so preview URLs are path-form:
`/preview/<projectId>/`.
Verified live: `/builder` 200; `/preview/product-idea-078/` 200 serving a real project
("Aurelle — Handmade Leather Handbags"); engine health `{"ok":true,"key":true}`; the room's
store (the owner's own projects) restored with the studio database — see
`console/CHANGELOG.md`, same date.
