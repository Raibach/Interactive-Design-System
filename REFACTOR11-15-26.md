SUMMARY

The ledger says the tabs share far more than the catalog containers' styling. Of 324 source files, 84 are used by two or more tabs, and 29 are used by all six. The assembly is borrowed, exactly as you suspected.

The counts, seat by seat. The Design seat reaches 126 files (101 code, 25 pictures); Composer 104; Product 108; Governance 75; Console 66; Development 63.

Reached by	Files
2 seats	22
3 seats	6
4 seats	14
5 seats	13
6 seats	29
By kind, the 84 shared files are: 28 shared elements, 26 shared modules, 20 pictures, 8 service/utility modules, and 2 shell files. The 29 used by all six are 12 icon pictures and 17 code files, including the tag registry itself.

Where the sharing is structural, not just styling.

The chat. Composer, Development, Governance and Product all use the shared chat-panel.ts and its shared header, messages, input, action bar, navigation bar, plugin tray, product thread and error banner. Console has its own twelve chat parts; Design has fifteen; Product has fourteen. So the chat is simultaneously shared and copied, in three different arrangements. Design also draws the shared chat-panel in its assembled right column, then renames it to design-chat on the client.
The frames. Console and Governance name the shared workspace-layout in their assemblies. Design, Tools, Composer, Product and Development have their own frame files. Product has its own frame but its assembly still names the shared one, so the backend and the frontend disagree about which frame Product uses.
The containers. Design's left panel is the Composer's prompt-container; its middle column header is the shared left-column-header. Those two imports are the panel and the two rail grips you saw.
The catalogue. There is one catalogue file for all six seats. The registry has 51 Composer entries, 66 Design entries, 13 shared entries, and only 2 Console entries. Product, Development and Governance have no catalogue tier of their own at all; they draw from the Composer's and the shared lists.
The assembly. render-design is physically inside the Composer's branch (ai.py:2773) and is prompted with the Composer's contract. The seat helpers, the repair rows and the validation gate are shared. Development has no assembled surface at all; it calls a separate teacher route.
The grounds and pictures. Composer and Product paint the same picture; Design's sheet and the other grounds are warmed by a shared helper in the shell. Eleven icon pictures are used by all six seats.
If you removed Console, Composer, Product, Development and Governance from the whole system, would Design still work? No. It fails in four places:

The page that hosts Design imports all five boxes, so the frontend does not build (WritingAreaIndex.tsx:17-26, App.tsx:25,130).
The boot registration imports Composer elements, and Design's own panel imports the Composer's prompt-container and shared left-column-header (register.ts:78,82,151,160; design-left-panel.ts:58; design-middle-container.ts:44).
The server imports the deleted seats' route modules at startup, so Design's routes never mount (main.py:164-184).
Design's only assembly door is the Composer's branch and contract; removing it leaves Design unable to assemble its Tools tab (ai.py:2773,2809-2960,3507).
What survives is Design's own room (126 files), its own chat copies, its own console endpoint and backend routes, and the 66 Design-tier catalogue names. If the other tabs are merely taken off the header and out of the rendering, Design already works, with three navigation dead ends.

So the answer to your question is: the stations are not finalized and they are not independent. The only way to make the Design-alone test pass is to cut the seven structural edges, not to add styling around them.



THE SIX SEATS AS SOVEREIGN APPLICATIONS — THE PLAN

What the person will see

When this plan is complete, a fresh incognito visit at the pin gate opens onto the Console's own first picture, not a purple fill. Each of the six top tabs paints its own ground from its first frame, and no tab shows another tab's picture or colour while loading. The Design left column draws its own panel, with no six-dot rail grips, because it no longer borrows the Composer's panel. Each tab names its own frame, and the Design room builds its own tree from its own catalogue instead of the Composer's.

Answer to the question: does Design share the Composer's file for the containers, the grippers and the wrappers?

Containers: yes. design-left-panel instantiates the Composer's prompt-container (design-left-panel.ts:58, 90-93). design-middle-container instantiates the Composer's shared left-column-header (design-middle-container.ts:44, 73-77).
Grippers: yes, the left column's two six-dot rail grips live inside that Composer prompt-container; the glyph is prompt-input/prompt-icons.ts. Design's chat spacer grip and pane boundary are its own copies.
Wrappers: the Design frame element is a copy (design-workspace.ts), but the Design tree is the Composer tree retagged in the backend (ai.py:3501-3505) and the model is prompted with the Composer contract. Product also paints the Composer's ground picture (ProductBox.tsx:19), and the shell's boot ground is that picture over the shared purple #2b2635.
Current state: the working files are in their working state. No further reversions. Every stage below adds new files and new imports; nothing that works today is ripped out.

STAGE 1 — THE GROUNDS, ONE OWNER PER SEAT (this is what stops the fills)

New files, one per seat, each seat's own:

rooms/console/consoleGround.ts — the film, its still, and the console's own #270F31 floor. The still is assets/console-waves-poster.webp (already generated from the film's first frame, 11 KB).
rooms/composer/composerGround.ts — composer-image-bg.webp and its measured #030F24.
rooms/product/productGround.ts — its own copy of the picture, assets/product-image-bg.webp, and #030F24. Product stops importing the Composer's asset.
rooms/development/developmentGround.ts — the lab tile and its mean colour #40364F.
rooms/governance/governanceGround.ts — the wave and its dominant colour #0F163F.
rooms/design/designGround.ts — the design sheet and its dominant colour #EFF1E1. DesignBox and DesignSeatShell import this one Design-owned file.
pages/shellGround.ts — the shell's own boot still, a new asset shell-boot-ground.webp made from the console film's first frame at 75% over #270F31. The shell stops showing the Composer's purple picture. Wiring: each box imports only its own ground file; the console film gains poster={consoleGround.still}; App.tsx paints the shell's own still; index.html preloads the shell still first and the room pictures at low priority. No shared ground module. warmLabGrounds is left untouched for now; each seat's own module-scope decode is the authority, and the helper is retired only after every seat owns its ground. Measured bases: Composer #030F24 (89% of its picture's pixels), Governance #0F163F (82%), Design #EFF1E1 (dominant), Development #40364F (mean, because the tile has no flat area), Console #270F31 (the floor the 75% film is read through).
STAGE 2 — THE DESIGN LEFT PANEL OWNS ITS FRAME

New element rooms/design/design-panel.ts, tag design-panel: Design's own panel frame (background #F7F8F2, top-left radius, the left slot, the format rail, no grips). New catalogue entry and registry entry; import in rooms/design/DesignRoom.tsx. The Design assembly names design-panel; design-left-panel stays in place unused, so nothing is removed. ToolsSeat's panel lookup gains design-panel as a second query. The Composer's prompt-container is not touched. The same stage gives the Design middle column its own header element (rooms/design/design-middle-header.ts) instead of the shared left-column-header, registered the same way.

STAGE 3 — EVERY SEAT NAMES ITS OWN FRAME

New frame copies: rooms/console/console-workspace.ts and rooms/governance/governance-workspace.ts, each retagged from class and tag, each with its own catalogue and registry entry. Existing product-workspace and tools-workspace are used by their own seats. Backend assembly names change: Console ai.py:1931 → console-workspace; Product ai.py:2404 → product-workspace; Governance ai.py:2642 and its generated tree → governance-workspace; Tools tools_surface.py:101 → tools-workspace. Composer and Design already name their own frames. role_caps.py gains the new names. The shared workspace-layout remains for the ingest modal only.

STAGE 4 — THE DESIGN ROOM ASSEMBLES ITS OWN TREE

A new Design builder (replacing the dead _design_surface_components path) emits the Design's own root, columns, seat and panel from the Design catalogue: design-workspace, design-panel, design-middle-container, the ingest form and tree, the preview, and the Design's own chat seat. The Composer contract no longer serves Design, and the composer-workspace → design-workspace and composer-chat-panel → chat-panel retags are no longer used by the Design path.

THE PROCESS THAT STOPS THIS RECURRING

One owner per seat: a seat may name only its own tags; a cross-seat tag is a finding, not a style choice.
A new seat cannot ship without its own ground file, frame, panel, catalogue entry and registry entry.
Every ground's base is measured from that seat's own picture and lives in that seat's file. A check fails if a seat has no base, or if two different pictures wear one colour.
catalog-check.mjs is extended to scan the Design console and Tools surface builders as emission sources, so an assembly that names another seat's tag is caught.
Each stage ends with: npx tsc -b --noEmit, npm run catalog:check with no new blocking findings, npm test, and one build. The build is the last action because it swaps dist under the running preview at 4173; the preview is hard-reloaded afterwards.
WHAT I WILL NOT DO

No deletion of the Composer's panel or the shared frame while the refactor is in flight. No changes to the Composer's own drawing. No further reversions. No shared ground module and no cross-seat asset borrow. Each stage leaves the application working.