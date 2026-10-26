# PLAN — the UX tab's PostHog chat, and the shape of the Design seat

> Written 2026-10-24 after reading `rooms/design/ux/ux-chat.ts`, the Design seat's slots, the
> PostHog Max screen and its suggestion files. This plan changes no code. The existing Tools and
> UX conversation work is recorded in `PLAN-tools-and-ux-chat.md`; this document is the live
> instruction for the PostHog welcome and the seat's slots.
>
> **Executed, first slice (2026-10-24).** `rooms/design/ux/posthog-prechat.ts` draws the welcome;
> `ux-chat.ts` shows it only while the UX conversation has no person turn and sends or fills its
> presets through the seat's own input. The placeholder UX introduction is removed and filtered
> from the thread. The welcome is verified on 5001. Its first turn reaches the UX door, but the
> analytics application's own agent refuses the preset prompts with its own error; see
> `CHANGELOG.md`.
>
> **Executed, the bottom card (2026-10-24).** The reserved `chat-plugin-tray` card now carries the
> UX control: one icon, a menu of Untitled notebook and Discussions, and two panels in the chat
> output. The notebook saves on the UX conversation's metadata; the discussion is a separate
> conversation under the same UX package, and the seat's own input sends its words. Both draw the
> PostHog characters. The top readout, conversation identity (New chat/Download), Add context and
> the PostHog output features below are not built yet.

## What the person will experience

The person clicks Design. The Chat tab is the general room: Grace introduces herself once, then
talks about the design cards, the filters, the saved set-ups, what the system can do, what the
Design tab represents, and how tracking happens. This is the room for strategy and ideas. Every
general conversation lives here.

The person clicks Tools. The Figma tool opens, and the conversation beside it belongs to the tool.
It is not the Design conversation and it is not the UX conversation.

The person clicks UX. The Product analytics application opens in the left column. The right
column first shows PostHog's own welcome screen: its title and subtitle, its row of colourful
topic buttons, and the preset suggestion cards beneath them. The person chooses a topic or a
preset, or types their own question. The first question starts the UX conversation. The welcome
gives way to the conversation, and it does not return while that conversation has a person's turn
in it.

At the top of the UX chat, above the conversation, the person sees the section and its readouts:
the Product analytics name, the conversation's own identity, and the figures the server already
supplies, beginning with token usage. The conversation's New chat and Download actions live here
with that identity. They are not inside the conversation output.

Under the chat input, the person finds the UX functions: the actions that belong to the
conversation, such as adding the current section as context. The output area holds the
conversation itself, drawn with the features PostHog already provides, in our chat shell's design.

## The seat's law

The owner stated this on 2026-10-24, and it governs every choice below.

- The console inside Design behaves like the main console, narrowed to the Design tab's items.
  Grace can explain how she manages design cards and filters, how a saved set-up is created, and
  what the console can do in this room.
- The Chat tab is the one place for general conversation: the system, the Design tab, tracking,
  strategy and ideas.
- The Tools tab's conversation belongs to the tool. The UX tab's conversation belongs to Product
  analytics. Those conversations do not carry the general Design conversation, and the general
  conversation does not carry theirs.
- Grace introduces herself once. An introduction that has already been loaded is not loaded
  again on every entry.

## What is there today

- `rooms/design/ux/ux-chat.ts` is the exclusive UX view. It reads `/api/ux/chat/thread`, sends a
  turn to `/api/teacher/query` with the UX package and conversation ids, and captures the seat's
  own input. It draws the welcome before the first person turn, then the thread.
- The server no longer seeds a UX introduction. The PostHog welcome is the UX tab's introduction;
  a stored greeting would make the person meet two.
- The PostHog welcome exists in the framed application. The no-thread branch of
  `design/posthog-master/frontend/src/scenes/max/Max.tsx` composes `Intro` and
  `SidebarQuestionInputWithSuggestions`. `Intro.tsx` draws the title, subtitle, logomark, notice
  and changelog. `SidebarQuestionInputWithSuggestions.tsx` draws the topic buttons and the
  suggestion cards. `TopicBadges.tsx` holds the colourful product buttons and
  `TopicSuggestions`/`SuggestionCard.tsx` hold the preset cards. `suggestionTopics.tsx` holds the
  words, the prompts and the icons for Analytics, SQL, Session replay, Error tracking and the rest.
- The Design seat is `rooms/design/chat/design-chat.ts`. It offers four places this plan uses:
  - `status-content`, the readout bar at the top of the chat;
  - `content-header`, the top of the response card;
  - `view`, the output area;
  - the input wrapper's bottom area, where `chat-plugin-tray` stands today.
- The UX view's `/new` and `/download` commands live in the input's placeholder and the quick
  links today. The owner's direction moves those actions to the conversation identity at the top.
- The framed PostHog application stays in the left column. Nothing in this plan mounts its React
  chat inside our seat. Its welcome and its conversation features are ported into room-owned files,
  because the framed app cannot give our shell a Lit element to draw.

## The shape

| Place | What it holds | Who owns it |
| --- | --- | --- |
| Top readout (`status-content`) | Product analytics, the conversation's name and id, token usage and later section metrics, New chat, Download | A new `ux-readout` view, slotted by the UX view |
| Output (`view`) | Before the first person turn: the PostHog welcome. After it: the UX conversation | `ux-chat.ts` chooses; `posthog-prechat.ts` draws the welcome; `posthog-output.ts` draws the conversation features |
| Bottom functions (the input wrapper's bottom area) | Add context and the UX actions that belong under the input | A new `ux-functions` view; the seat gains a named `functions` slot there |
| Input (the seat's own field) | The person's words, with a Product analytics placeholder | `ux-chat.ts` captures it; the seat draws it |
| Left column | The Product analytics application | The existing `leftColumn.ts` |

The top readout is not a breadcrumb. It does not navigate and it does not change the section. It
collects the facts of the section the person is in, the way the owner described.

## The steps

### Step 1 — one introduction for the UX tab

The PostHog welcome is the UX tab's introduction. The server-seeded UX introduction is a
placeholder and is removed when the welcome lands, so the person is not greeted twice. The Chat
tab keeps its own introduction, seeded once; the Tools tab keeps its own, seeded once.

The welcome is shown only when the UX conversation has no person turn. Once a person has spoken,
the welcome is gone. A reload with a person turn goes straight to the conversation. A reload with
only the seeded assistant message and no person turn shows the welcome, because the person has not
started the conversation yet. The server is the authority for whether a person turn exists.

### Step 2 — the PostHog welcome, in its own file

Create `rooms/design/ux/posthog-prechat.ts`. It draws:

- the title and subtitle from `Intro.tsx`, with the logomark and the notice that file carries;
- the row of colourful topic buttons from `TopicBadges.tsx`, with the same labels, icons and
  selected state;
- the suggestion cards for the selected topic from `TopicSuggestions.tsx` and
  `SuggestionCard.tsx`, with the same titles, descriptions and preset prompts;
- the topic list and prompts from `suggestionTopics.tsx`, copied as they are for the UX tab.

The file is Lit, because the seat is Lit. It does not import the framed application's React code,
its Kea store or its network doors. It is a faithful port of the visible welcome, not a second
application.

Choosing a topic selects its cards. Choosing a card places its prompt in the seat's own input and
sends it through the UX view's existing turn door. Choosing a docs-style row does the same. The
welcome draws no second input and invents no second conversation.

### Step 3 — the UX view chooses welcome or conversation

`ux-chat.ts` becomes the frame for the UX tab. It keeps the thread, the history read, the turn
door, the input capture and the failure drawing. It adds one decision: when the conversation has
no person turn, draw the welcome; otherwise draw the conversation. It stops drawing the
recent-chats list and the `/new`/`/download` quick links inside the output.

The welcome is a child of the UX view in the output area. The conversation is the same view's
thread once it begins. The PostHog conversation features that follow the welcome are ported into
`ux/posthog-output.ts`, which draws the message rows, the tool results, the working state, the
reset/retry actions and the other visible features the PostHog thread has. It uses our chat
shell's type and space; the welcome keeps PostHog's colourful treatment because the owner asked
for that screen as it is.

### Step 4 — the top readout and the conversation identity

Create `ux-readout.ts` and slot it to the seat's `status-content`. It shows:

- the section name, Product analytics;
- the conversation's own name and id, as the server supplied them;
- the token usage the server already returns, and the section metrics added later;
- New chat, which starts a new UX conversation through the existing `_newChat` path;
- Download, which downloads the thread the view is drawing.

The top readout is the only home for those two actions. The output does not carry them, and the
input's placeholder does not promise them. When the conversation changes, the readout reads the
same id the thread reads; there is no second copy.

### Step 5 — the bottom functions

> **Updated 2026-10-24.** The product-aware footer is planned in `PLAN-ux-chat-tools.md`. It
> replaces the single Add context description below: one shared product selector and Add context
> are the template, and a place's own actions are the exception. The notebook and discussion
> controls already sit in the reserved card.

Add a named `functions` slot to the seat's input wrapper, under the input, beside or in place of
the existing `chat-plugin-tray`. The UX view slots a `ux-functions` element there. It carries the
UX actions that belong under the input, beginning with Add context, which attaches the current
section to the next question. It does not carry New chat or Download; those live at the top with
the conversation.

### Step 6 — the server and the one conversation

The UX tab keeps one package and its conversations, created by
`PromptSessionsAPI.get_or_create_design_tab`. The welcome does not create a thread. The first
person turn creates or continues the UX conversation through Grace's own `/api/teacher/query`,
with the UX package id and conversation id. New chat starts a real new conversation under the
same UX package through `/api/ux/chat/new` and moves the package's primary pointer to it. The
discussion is a separate conversation under the same package. There is no shared Design
conversation and no fallback to the Design container. The old `/api/ux/posthog-chat` route is not
called; the PostHog agent is out of the active path.

### Step 7 — verification inside the React frame

On `localhost:5001`, inside the Design room:

- Design → UX: the Product analytics application is in the left column, and the PostHog welcome is
  in the right column with its title, subtitle, colourful topic buttons and preset cards.
- Pick a topic and a preset. The prompt enters the seat's own input and sends to the UX door. The
  welcome gives way to the conversation, and the answer is drawn in the thread.
- Reload. The conversation with the person's turn is drawn; the welcome does not return. A fresh
  UX conversation with no person turn shows the welcome once.
- New chat and Download are at the top with the conversation identity, and they are not in the
  output. New chat starts a new UX conversation; Download downloads the current one.
- The top readout shows Product analytics, the conversation identity and the token figures.
- The bottom area holds the UX functions under the input.
- Design → Chat and Design → Tools are unchanged. Their introductions appear once and their
  conversations are their own.
- `npm run typecheck` is zero. No build, preview or tunnel rebuild without the owner's word.

## What this plan does not do

- It does not change the PostHog application's screens, data or left frame.
- It does not change the Figma ingestion tool.
- It does not finish the Design chat file's split or remove the Product, Governance and Composer
  code it still carries. That is the separate Stage 5 cut.
- It does not add a second input, a popup, a fallback sentence or a dismiss button.
- It does not move the main console's behaviour into the Design console in this step. The seat's
  law above is the direction; the console's own filters and saved set-ups are their own later cut.

## The decisions I recommend

- **One introduction:** the PostHog welcome is the UX introduction; remove the server-seeded UX
  intro when the welcome lands. The Chat and Tools introductions stay as they are, each seeded
  once.
- **The topic list:** copy PostHog's `HOMEPAGE_SUGGESTION_TOPICS` as they are for the first pass.
  Narrowing them to the three subjects the studio asks about is a later, evidence-based edit.
- **The top metrics:** start with the section, the conversation identity and token usage. Add
  further metrics only when the server supplies them; do not invent a number.
- **The bottom functions:** start with Add context, the function the current UX view already has.
  The other PostHog actions follow when they have a real door.
- **The output:** port the visible PostHog thread features into `posthog-output.ts` after the
  welcome, the readout and the functions are standing. The welcome is the first slice because it
  is the screen the person meets first.
