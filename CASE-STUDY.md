# Case Study — Design Intent as the Source

*Structured with STARR: Situation · Task · Action · Result · Reflection.*

## Situation

Over the last several months I have built an enterprise AI prompt platform in which every interface begins as a drawing in Figma, becomes a registered component, and is audited before it can ship. The platform lets people assemble prompt packages, run them against different AI models behind one interface, review what comes back, and export the interfaces themselves as components others can lift out and own.

My working method is unusual: I direct an AI agent in plain language. I do not read the code it writes. What I supply instead is the picture — Figma files, node by node, with annotations — and a set of standing rules about what may and may not happen. The system I asked it to build carries those rules inside it: an audit that refuses components that cannot be traced to a drawing, and documentation that must match what the catalog actually holds.

When version 4b of the wireframes arrived, they replaced the product's conversation panel — new palette, new navigation rail, new input stack — on a platform that was already live in production. The change had to land on a running system, not a prototype.

## Task

My responsibility was larger than the artwork. I had to implement the new panel so it matched the drawing's values exactly; keep every existing capability, because a redesign is not permission for functions to disappear; register each element in the platform's three layers so the compliance audit would pass; repair whatever the redesign surfaced beneath the surface; and ship it to a live site, where the first load is the only load a client ever judges.

## Action

I read the new panel out of the design file region by region, matched each region to an existing component, and built the one element the drawing had no home for. Eight existing elements were updated in place, and one — the user's own message bubble — is new, drawn to the file's measurements.

Redesigns tempt you to delete. I refused. Controls the new drawing no longer showed — the model selector, the add button, several readouts — were unhooked and left in place, so nothing the product could do before was lost; each is marked as a decision waiting, not an accidental casualty.

Every element was then registered in all three of the platform's layers: the allowlist, the design map, and the catalog schema, including the reference that makes it reachable. The audit that gates delivery checks exactly this, and it does not accept intent as evidence — only records.

The redesign also surfaced two real defects: a rename that returned "not found" because the database reported the wrong count of touched rows, and a conversation list that ignored its package and returned every conversation in the system instead of the one package's. Both were fixed at the source rather than papered over.

Then the conversation lifecycle, end to end: create a new conversation from the footer mark, name the one you leave from its own first words, archive it, list archived and active threads with a per-row delete that refuses the open one, and start the successor already selected.

Finally, production. I traced the failures that followed every deploy to the deploy window itself — the minutes when the old version is gone and the new one is not yet answering. I put memory guards in front of the platform's heaviest AI library after the host killed the container for exceeding its limit, and I took the repository's local weight from roughly a quarter of a terabyte down to under two gigabytes by removing model experiments and years of accumulated file history. Verification now stands at 372 automated tests, with the catalog audit run on every change.

## Result

The new panel is live in production. Both pipelines' catalogs pass their audit with zero blocking findings; 372 tests pass; the conversation lifecycle works as described, counts included, with archived threads recoverable rather than lost. The container now runs at about half its memory ceiling, with no out-of-memory kills since the guards went in, and the repository is small enough that a deploy is minutes, not hours. Every element on the screen traces back to a drawn node and an annotation that states what it is for.

## Reflection

The work changed what I think design is. My job is no longer to draw screens for someone else to build, and it is no longer to write instructions and hope they are followed. It is to make intent so precise that a machine cannot wander — and to build the machinery that catches it when it does. I stopped trusting output and started building verification: the audit gates, the annotation rules, the registers that record what remains unfinished. That machinery is now the spine of the product, not a safety net around it.

Two lessons I would carry into the next project. First, annotate before building — a drawing without an annotation gets flagged empty by the audit, and rightly so; the missing specification is the work, not an obstacle to it. Second, keep the laboratory out of the shipping lane: a multi-gigabyte model experiment I ran alongside the product very nearly took the delivery pipeline down with it. The fix was not to stop experimenting, but to build a wall between the experiment and the line.

What I would do differently: I would design the deploy window as deliberately as I design the screens. A live product is judged on the first load after every change, and I had been treating that moment as an implementation detail. It is a design surface like any other.
