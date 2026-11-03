# The UX tab — its own plan

*2026-11-02. For review.*

## What the person sees

The analytics application fills the tab. Beside it, the chat is a surface, not an argument: it names
the product and the screen they are looking at, answers about it, and offers the actions that belong
to that screen — never an action this place does not have. Anything it offers, it can do.

## What stands

The application draws inside the tab, the welcome appears once per conversation, and the UX door
answers a turn. The chat column is the room's own seat, with the shared frame and conversation.

## The steps

1. **The readout.** Product analytics, the conversation's own name and id, and the token usage the
   server already returns, drawn above the thread. No navigation and no change of section.
   Proof: the ids drawn are the ones the thread reads.
2. **New chat and Download at the conversation's identity**, through `/api/ux/chat/new` and the
   thread the view is drawing; removed from the output's quick links and the input's placeholder.
   Proof: both work from one place and appear nowhere else.
3. **The functions slot under the input.** A named slot on the seat, a `ux-functions` element in it,
   beginning with Add context. Proof: the slot renders under the input and carries only actions this
   screen has.
4. **The thread's own output.** The PostHog message rows, tool results, the working state, reset and
   retry, ported into `ux/posthog-output.ts` in this room's type and space. Proof: those features draw
   in the UX thread.
5. **Add context, fully.** Insights, dashboards, events, actions, notebooks; attached tags beside the
   action; the next turn carries them. Proof: an attached insight is named in the next answer.
6. **Location actions.** Shown only where the place has one, beginning with Web analytics' Export all
   as CSV and Session Attribution Explorer, each calling the application's own action. Proof: those
   two run from the chat and a place without one shows none.
7. **The tracking contract.** Product changed, location action opened, location action ran, context
   added or removed, with stable keys. Proof: the four events are emitted where the registry says.

## The known fault

The preset prompts reach the UX door and the analytics application's own agent refuses them. That is
step 1 of the truth: until the door answers its own presets, nothing above it can be trusted. I would
put it before the readout.

## Recommendation

Fix the preset refusal first. Then the readout and the two actions, which are small and visible. The
output port and Add context are the large pieces and should be one pass each. Tracking last, because
its destinations are the UX designers' work, not ours.

## Still open

- Narrow the topic list to the three subjects the studio asks about.
- Further section metrics only when the server supplies them.
- The customer-facing frontend where products and actions are configured.
