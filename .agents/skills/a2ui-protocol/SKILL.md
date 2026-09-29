---
name: a2ui-protocol
description: >
  Respond to user requests using the Google A2UI protocol format. Use whenever the user
  asks to build, render, or describe UI via A2UI, requests a surface or component tree,
  or says anything about A2UI protocol, createSurface, or updateComponents. Also use
  when the conversation is in A2UI mode and all output must be valid JSON structural
  objects — never conversational text.
---

# A2UI Protocol Skill

When the user asks to build, render, or update a UI surface, you must trigger this skill.
Do not respond with normal conversational chat. Instead, output a valid A2UI JSON payload
matching the schema below.

## Component Catalog

Pre-approved UI components:

| Component  | Props                                        |
|------------|----------------------------------------------|
| `Column`   | `children`: array of component IDs            |
| `Card`     | `child`: single component ID                  |
| `Text`     | `text`: string literal or data path           |
| `Button`   | `text`: string, `action`: string (event name) |

## Expected A2UI JSON Output Format

### `createSurface` — new surface

```json
{
  "version": "v0.9.1",
  "createSurface": {
    "surfaceId": "{{ the surface identifier, e.g. main_chat_surface }}",
    "root": "root",
    "components": [
      {
        "id": "root",
        "component": "Column",
        "children": ["{{ first child id }}", "{{ second child id }}"]
      },
      {
        "id": "{{ text component id, e.g. header_text }}",
        "component": "Text",
        "text": "{{ the content string to display }}"
      },
      {
        "id": "{{ card component id, e.g. info_card }}",
        "component": "Card",
        "child": "{{ the card's single child id }}"
      },
      {
        "id": "{{ button component id, e.g. submit_btn }}",
        "component": "Button",
        "text": "{{ the button label }}",
        "action": "{{ the event name to emit, e.g. onSubmit }}"
      }
    ]
  }
}
```

### `updateComponents` — modify existing surface

```json
{
  "version": "v0.9.1",
  "updateComponents": {
    "surfaceId": "{{ the target surface identifier }}",
    "components": [
      {
        "id": "{{ the component id to update }}",
        "component": "{{ the component type }}",
        "text": "{{ the new content string }}"
      }
    ]
  }
}
```

## Rules

1. **JSON only.** Every response must be a single valid JSON object. No markdown fences, no commentary, no explanatory text before or after.
2. **Version.** Always include `"version": "v0.9.1"` at the top level.
3. **Surface ID.** Every operation requires a `surfaceId`. Use `"main_chat_surface"` unless the user specifies otherwise.
4. **Unique IDs.** Every component needs a stable `id`. Use descriptive names like `header_col`, `title_text`, `submit_btn`.
5. **Valid tree.** Every `children` or `child` reference must point to an existing component `id` in the same structure.
6. **Data paths.** `Text.text` accepts a mustache data path like `{{order.total}}` for dynamic data. Use string literals for static content.
7. **Actions.** `Button.action` names the event the button emits. Choose semantic names: `onSubmit`, `onCancel`, `onNavigate`.

## Infrastructure Notes

Prompt-level formatting guarantees the model knows the shape to output, but does **not** enforce it at the inference layer. For production use:

- **Structured Outputs** — Constrain decoding with `outlines` or `vLLM` using the A2UI JSON schema to prevent conversational filler from Gemma-class models.
- **Client Renderer** — Feed the JSON stream to your frontend via WebSockets or an A2A pipe. The A2UI Client Framework (Angular, Flutter, React, or Lit) renders components natively from the stream.
