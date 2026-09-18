# Annotations to paste — the eight open `annotation-missing` nodes

Written 2026-09-18 from the code's own contract (`shared/tag-registry.ts`: each tag's props and
events), not from prose about it. Paste each block into the **master component** of that name in
Figma — the component itself, not an instance placed in a frame. Never add sizes or colours; the
drawing already carries those.

Format reference: `catalog-audit/FIGMA/ANNOTATION_FIGMA_GUIDE.md`.

---

## 1. `prompt-container` — master node 40000746:6

```
State: expanded — the container is always drawn; the rail is its right edge
Data: formatLabel — the vertical rail's format line; tokensLabel — the vertical tokens/cost readout line
Connects: holds the stacked prompt-input-section rows in its default slot; the rail's gripper is the drag handle for the input area
A11y: no role of its own — a container
```

## 2. `prompt-input-section` — masters 40000746:94 and 40000909:4005

```
Data: name, type, content, sticky, minHeight
On click: section-menu-select { role } when a role is chosen from the tile's menu;
          section-collapse-toggle { collapsed } on the tile's chevron
On change: section-content-input { value } as the textarea is typed in
State: collapsed | expanded
A11y: group, labelled by the role tile's text
Connects: contains role-tile, prompt-textarea and status-bar-prompt-input
```

## 3. `prompt-textarea` — master 40000746:95

```
Data: value, placeholder, minHeight
On change: value-input { value } on every keystroke
State: idle | focused
A11y: textbox, multiline; labelled by the section's name
```

## 4. `role-tile` — master 40000909:4316

```
Data: label, showMenu
On click: role-menu-toggle { open } from the caret;
          role-tile-collapse-toggle { collapsed } from the chevron
State: collapsed | expanded; menu closed | open
Disabled: no menu when showMenu is false
A11y: button, labelled by the tile's own text
```

## 5. `model-selector-button` — master 40000909:4322

```
Data: label — the current model's name, or "Models" when none is chosen
On click: model-selector-toggle { open }
State: idle | open
A11y: button, labelled by its own text
```

## 6. `status-bar-prompt-input` — master 40000878:239

```
Data: icons — the activity icons drawn in the rail
State: idle | active — the icons grow with prompt activity
A11y: decorative; no label
```

## 7. `chat-navigation-bar` — the mapping points at node 40001010:25768

That node is the **chat-button** master. If the rail has its own master, the catalog mapping
should point there instead — and that is my side to fix, not yours. Until then, this is the spec
the audit is asking for on the node it resolves:

```
Data: allowedTabs — the comma-separated tab ids this seat may show
On click: tab-change { tab } when a rail button is chosen;
          collapse-toggle { collapsed } when a click opens or closes the column;
          right-column-drag-start / -move / -end while the edge is dragged
State: collapsed | expanded; the chosen button carries state=Selected
Disabled: a tab that allowedTabs does not name is not drawn at all
A11y: tablist; each button labelled by its own text
```

## 8. `role-dropdown` — master 40000934:22851 (currently PROSE, so this replaces it)

```
On click: role-select { role } on a row; role-remove { role } on the remove action
State: open | closed
A11y: menu; each row is a menuitem
Connects: fills the role of a prompt-input-section
```

---

**After pasting:** run `cd frontend && node scripts/catalog-check.mjs --catalog prompt-composer`
and tell me the number — if it drops, the register in `OPEN-ITEMS.md` needs the same number, or
the gate stays red on a drift that is not a defect.
