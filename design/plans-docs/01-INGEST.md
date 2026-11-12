# The ingest — its own plan

*2026-11-02, completed 2026-11-03. All five steps are built; each step names its proof.*

## What the person sees

They paste a Figma address and press Submit. The answer tells them what it could not read or draw,
in plain sentences, each naming the value the design states and the value that was carried. When the
design uses a face this system does not ship, the chat says so and offers to replace it or to ask
for it to be added; asking for it to be added enters the approval queue.

## What stands

The two-pass read is built and reconciled on two nodes. Four writers that invented values are gone.
The refusal list is built and reads as a list. The fidelity accounting runs on every submit. The
facts table now names the channel each fact was drawn from (REST, MCP, or both). The missing face is
a conversation in the Tools chat: the system says which face it does not ship, and the person can
keep the system's face or ask for theirs to be added; asking writes a row in the approval queue.

## The steps

**All five steps are built — steps 1 to 4 on 2026-11-02, step 5 on 2026-11-03.**

1. **The check reads the five styled spans it is given.** The file states five text-style ranges on
   `functions-label`, the draft draws five styled spans, and only the check cannot find them. Proof:
   its two findings clear and the node reads two fewer failures.
2. **`arcData` and `styles` get an examination entry each.** Neither is a renderer failure; both are
   the pipeline saying nothing. An entry either states what is done with the value or states that the
   component will not carry it. Proof: neither appears in a refusal for a node that states it.
3. **The drawing takes a value from the second channel.** Built: every reconciled fact now carries
   `chosen`, and `figma_twopass.apply` writes a second-channel value into the document the renderer
   reads. Proof taken: a fact marked `mcp` changed the document's layer name and a fact marked
   `rest` left its position alone. On every measured node the chosen source is REST, and the facts
   table names it per row — Layer · Fact · Figma stated · Drawn · Source · Verdict (built
   2026-11-03). The path exists so the day a fact is second-channel-only, the drawing follows it.
4. **The accounting closes.** Built: `account()` counts each (layer, fact) once, checks that the
   three buckets add up to the rows read, and the gate blocks when they do not. Proof taken: a clean
   report closes at 7 = 5 drawn + 2 accepted + 0 missing, and one repeated row opens it and adds a
   blocker naming the repeated fact.
5. **The missing face becomes a conversation, not a notice.** **Built 2026-11-03.** The draft
   already states the family it carries. When the ingest reads a family this system does not ship,
   the Tools chat draws the backend's own sentence with the layers, and two buttons: **Use the
   system's face** and **Ask for it to be added**. The first settles it in the thread; the second
   writes a `design_requests` row (kind `font`, the family as its subject, the design session as its
   session) and says it waits in the Approve tab. Proof: the offer is drawn from the ingest's own
   `fidelity.fontNotice`; the write goes through `POST /api/design/requests`, the queue's one door.

## Recommendation

All five are built. The next work is not this plan's: the approval plan's last two steps — the final
approval that writes the catalogue, and a change to an approved component becoming the same name
marked pending — stand on their own.

## Still open

Nothing. The `arcData` and `styles` judgement is written where the check makes it:
`design_renderer.ACCEPTED_UNRENDERED`, with the reason each is read and not drawn.
