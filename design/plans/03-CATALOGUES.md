# The catalogues — its own plan

*2026-11-02. For review.*

## What the person sees

Two cards on the Design console. One says Carbon and one says Raibach Prompt Composer. Pressing each
opens the tool in that system: its own components, its own list, and its own chat. A third card would
only exist if there were a third catalogue to draw.

## What is measured today

Two catalogues exist on disk: `prompt-composer` with 73 components and `carbon` with 58. The console
draws exactly two design-system cards, `system:prompt-composer` and `system:carbon`, and each opens
the tool in its own catalogue — measured earlier: Carbon opens at 58 with its own catalogue address,
the default at 73.

The database holds **five** `design_catalogue` rows. Three of them name nothing on disk:

| row | title | catalogue on disk |
|---|---|---|
| `prompt-composer` | Raibach Prompt Composer | yes, 73 |
| `carbon` | Carbon | yes, 58 |
| `raibach-ids` | Raibach IDS | **no** |
| `room-embed` | Agent Canvas | **no** |
| `f-40001207-3497` | F 40001207 3497 | **no** |

So your first point is answered: the two cards are different, and they are the two real systems. The
three other rows are stubs written by earlier runs of the room, and nothing draws them.

## The steps

1. **Retire the three stubs.** **Built 2026-11-02.** `raibach-ids`, `room-embed` and the Figma-node
   row were removed from `prompt_sessions`; the table now lists Carbon and Raibach Prompt Composer,
   and the console draws the same two cards.
2. **A registry per catalogue.** `carbon/registry.json` and `prompt-composer/registry.json`, each
   resolving its own names. Proof: a Carbon name resolves from Carbon's file, a replaced Carbon file
   changes Carbon alone.
3. **A third system, only if it is real.** If Raibach IDS is to be its own system rather than the
   Prompt Composer's, it needs a real `catalogs/raibach-ids/` with its components moved in. This is
   the membership decision, and it can wait: the two cards already separate the work that exists.
4. **Carbon in the repository.** Its catalogue lives only on this machine today. Proof: a fresh clone
   draws Carbon.

## The note on data

A catalogue file is a theme: empty components with binding, drawn by the surface from the session's
data. So the catalogue's job is small and the database's job is large. That is why this plan is mostly
about removing rows and naming files, not about building a system.

## Recommendation

Do step 1 now — it is three deletes and it removes a false claim from the table. Steps 2 and 4 are
repository hygiene. Step 3 waits for you, and nothing else waits on it.

## Still open

- Which components belong to Raibach IDS, if it becomes a system of its own.
- The name of the one catalogue, if the two ever become one.
- The 2026-10-26 pin: the room's rule that the official catalogue is the only default and the rail
  offers no choice. It is explained in the report beside this plan, and it is still the rule today.
