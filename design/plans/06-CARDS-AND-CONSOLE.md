# Cards, the console and the session — its own plan

*2026-11-02. For review. This is the plan that starts with the database.*

## What the person sees

The console holds cards. A card is not a page: it is a row that names a session, and pressing it
opens that session where it was left — its conversation, its screen, its work. A session grows. It can
be picked up by another person and continued. Everything done in it belongs to the person who did it,
and the session shows who did what.

## What stands

Cards are read from `prompt_sessions` and drawn by the console. A kept session reopens by its card,
with its title, address, notes and conversation. Sessions are per person, and a session can be read
from the console even when one of its conversations was started in Tools.

## The turn this plan makes

The interface stops being the place where state lives. A card is a row; a screen is a reading of rows;
a conversation is rows; an action is a row. The files draw and bind; the database holds the story.
That is what the next step should prove.

## The steps

1. **Read the database as it is and write down the story.** Every table that holds a session, a card, a
   conversation, a message, an action, a version, an approval, a person's part in it — what writes it,
   what reads it, and what is missing. A document, not code. This is the deep dive you named, and I
   agree it comes first: the four plans around this one all write rows, and none should invent a table.
2. **The card's row.** Title, category, status, logo, owner, and the person it is addressed to. The
   console reads it; a second console reads the same row. Proof: a saved session's card stands on both
   consoles with the same facts, from one read.
   *Partly built 2026-11-02.* A kept design session now stands on the **main console** as well as the
   Design console: `get_sessions` excluded every `design*` row, and now lets `design_session` through
   while the room's container, tab, catalogue, master and child rows stay excluded. Its own category
   (`design`) was added to `categories`, so the card wears the room's fill and ink. Verified on the
   assembled console: 12 cards, one of them `output-footer-area import` with fill `#1C2F4E`, title
   ink `#fb8d67`, text ink `#fff`. **Not yet:** one read for both consoles — each still runs its own
   query — and the logo and reviewer fields.
3. **The screen's row.** What the session was showing: the conversation in use, the scroll, the three
   form fields, the preview, the table's filter, and the heights of the five boxes. Written as the
   person works, read back on open. Proof: close the tab, reopen the card, and every one of those is
   where it was.
   *Built and proven on screen 2026-11-02: the scroll, the heights of the boxes a person sized by
   hand, and the table's filter are written with the conversation and restored on open. The filter
   was proven end to end — filtered to “footer” (5 of 73), left, accepted, reopened, restored. The
   same test found that a filter was not counted as unsaved work, so leaving discarded the session;
   the rule now counts a filter and a box size, and the question is asked.*
4. **The action's row.** Every press and every change, against the session and the person. Proof: two
   presses by one person write two rows; a second person's press writes a row naming them.
5. **A second person in the same session.** Sharing and reassignment: the session names its owner and
   the people who may work in it; a package can be assigned to a new owner. Proof: a second person
   opens the card, works, and their rows carry their name beside the owner's.
6. **The readout.** Save and every other act say what happened, in one line, where the person is
   looking.

## Recommendation

Step 1 first, and alone. The database is the story you say it is, and the other five plans are waiting
on knowing which rows exist. I would bring the database read back as a short document with a table of
tables and the gaps, and only then decide the order of 2 to 6.

Steps 2 and 3 are the ones that make reopening exact, and they are the ones a person feels. Step 4 is
the base the approval flow stands on. Step 5 is a decision about sharing that has no code yet.

## Still open

- Who may work in a session that is shared, and whether that is a role or a name.
- Whether Save is per person (each person's own save of the session) or one save for the session. You
  described a per-person record; that needs a row that says who saved what and when.
