# Data Flow

> **This repository.** The protocol text below is the upstream A2UI reference. This repo
> implements it as a **Lit catalog** — the layers are real files, and the work happens in them:
>
> | layer | file |
> |---|---|
> | CATALOG — what the server accepts | `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` |
> | REGISTRY — what may be rendered | `frontend/src/shared/tag-registry.ts` |
> | RUNTIME — what draws | `frontend/src/components/lit/<element>.ts` |
> | RESOLVER — name → tag | `frontend/src/components/lit/a2ui-renderer.ts` |
>
> Structure and content travel on two channels: `updateComponents` describes the tree,
> `updateDataModel` carries the values — never both in one. `cd frontend && npm run
> catalog:check` is the gate.

How messages flow from agents to UI.

## Architecture

```
Agent (LLM) → A2UI Generator → Transport (SSE/WS/A2A)
                                      ↓
Client (Stream Reader) → Message Parser → Renderer → Native UI
```

![end-to-end-data-flow](../assets/end-to-end-data-flow.png)

## Message Format

A2UI defines a sequence of JSON messages that describe the UI. When streamed, these messages are often formatted as **JSON Lines (JSONL)**, where each line is a complete JSON object.

=== "v0.8"

    ```jsonl
    {
      "surfaceUpdate": {
        "surfaceId": "main",
        "components": [...]
      }
    }
    {
      "dataModelUpdate": {
        "surfaceId": "main",
        "contents": [
          {
            "key": "user",
            "valueMap": [
              { "key": "name", "valueString": "Alice" }
            ]
          }
        ]
      }
    }
    {
      "beginRendering": {
        "surfaceId": "main",
        "root": "root-component"
      }
    }
    ```

=== "v0.9"

    ```jsonl
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "main",
        "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
      }
    }
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "main",
        "components": [...]
      }
    }
    {
      "version": "v0.9",
      "updateDataModel": {
        "surfaceId": "main",
        "path": "/user",
        "value": { "name": "Alice" }
      }
    }
    ```

**Why this format?**

A sequence of self-contained JSON objects is streaming-friendly, easy for LLMs to generate incrementally, and resilient to errors.

## Lifecycle Example: Restaurant Booking

**User:** "Book a table for 2 tomorrow at 7pm"

=== "v0.8"

    **1. Agent defines UI structure:**

    ```json
    {
      "surfaceUpdate": {
        "surfaceId": "booking",
        "components": [
          {
            "id": "root",
            "component": {
              "Column": {
                "children": {
                  "explicitList": ["header", "guests-field", "submit-btn"]
                }
              }
            }
          },
          {
            "id": "header",
            "component": {
              "Text": {
                "text": { "literalString": "Confirm Reservation" },
                "usageHint": "h1"
              }
            }
          },
          {
            "id": "guests-field",
            "component": {
              "TextField": {
                "label": { "literalString": "Guests" },
                "text": { "path": "/reservation/guests" }
              }
            }
          },
          {
            "id": "submit-btn",
            "component": {
              "Button": {
                "child": "submit-text",
                "action": {
                  "name": "confirm",
                  "context": [
                    { "key": "details", "value": { "path": "/reservation" } }
                  ]
                }
              }
            }
          }
        ]
      }
    }
    ```

    **2. Agent populates data:**

    ```json
    {
      "dataModelUpdate": {
        "surfaceId": "booking",
        "path": "/reservation",
        "contents": [
          { "key": "datetime", "valueString": "2025-12-16T19:00:00Z" },
          { "key": "guests", "valueString": "2" }
        ]
      }
    }
    ```

    **3. Agent signals render:**

    ```json
    {
      "beginRendering": {
        "surfaceId": "booking",
        "root": "root"
      }
    }
    ```

    **4. User edits guests to "3"** → Client updates `/reservation/guests` automatically

    **5. User clicks "Confirm"** → Client sends action:

    ```json
    {
      "userAction": {
        "name": "confirm",
        "surfaceId": "booking",
        "context": {
          "details": {
            "datetime": "2025-12-16T19:00:00Z",
            "guests": "3"
          }
        }
      }
    }
    ```

    **6. Agent responds** → Updates UI or sends:

    ```json
    { "deleteSurface": { "surfaceId": "booking" } }
    ```

=== "v0.9"

    **1. Agent creates surface:**

    ```json
    {
      "version": "v0.9",
      "createSurface": {
        "surfaceId": "booking",
        "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
      }
    }
    ```

    **2. Agent defines UI structure:**

    ```json
    {
      "version": "v0.9",
      "updateComponents": {
        "surfaceId": "booking",
        "components": [
          {
            "id": "root",
            "component": "Column",
            "children": ["header", "guests-field", "submit-btn"]
          },
          {
            "id": "header",
            "component": "Text",
            "text": "Confirm Reservation",
            "variant": "h1"
          },
          {
            "id": "guests-field",
            "component": "TextField",
            "label": "Guests",
            "value": { "path": "/reservation/guests" }
          },
          {
            "id": "submit-btn",
            "component": "Button",
            "child": "submit-text",
            "variant": "primary",
            "action": {
              "event": {
                "name": "confirm",
                "context": {
                  "details": { "path": "/reservation" }
                }
              }
            }
          }
        ]
      }
    }
    ```

    **3. Agent populates data:**

    ```json
    {
      "version": "v0.9",
      "updateDataModel": {
        "surfaceId": "booking",
        "path": "/reservation",
        "value": {
          "datetime": "2025-12-16T19:00:00Z",
          "guests": "2"
        }
      }
    }
    ```

    **4. User edits guests to "3"** → Client updates `/reservation/guests` automatically

    **5. User clicks "Confirm"** → Client sends action:

    ```json
    {
      "version": "v0.9",
      "action": {
        "name": "confirm",
        "surfaceId": "booking",
        "context": {
          "details": {
            "datetime": "2025-12-16T19:00:00Z",
            "guests": "3"
          }
        }
      }
    }
    ```

    **6. Agent responds** → Updates UI or sends:

    ```json
    {
      "version": "v0.9",
      "deleteSurface": { "surfaceId": "booking" }
    }
    ```

## Transport Options

A2UI is transport-agnostic — any mechanism that can deliver JSON messages works:

- **[A2A Protocol](https://a2a-protocol.org/)**: Standardized agent-to-agent communication, also used for agent-to-UI delivery
- **[AG-UI](https://ag-ui.com/)**: Bidirectional, real-time agent-UI protocol
- **REST / HTTP**: Simple request-response or Server-Sent Events (SSE) for one-way streaming
- **WebSocket**: Persistent bidirectional connection, ideal for real-time updates and user actions
- **Any other transport**: gRPC, message queues, custom protocols — if it can carry JSON, it works

See [transports](transports.md) for implementation details.

## Progressive Rendering

Instead of waiting for the entire response to be generated before showing anything to the user, chunks of the response can be streamed to the client as they are generated and progressively rendered.

Users see UI building in real-time instead of staring at a spinner.

## Error Handling

The system handles errors as follows:

- **Malformed messages:** Skip and continue, or send error back to agent for correction.
- **Network interruptions:** Display error state, reconnect, agent resends or resumes.

## Performance

To optimize performance:

- **Batching:** Buffer updates for 16ms, batch render together.
- **Diffing:** Compare old/new components, update only changed properties.

## This folder

This folder draws one surface, and the reference above applies with three local facts.

- **One door, one surface.** `surface-design/surface/load.ts` sends `POST /api/design/console`
  once per load and reads the answer's `surfaceId`, component tree and data model. There is no
  second `createSurface` for the left column; the left, middle and right are children of the same
  root.
- **One renderer.** `surface-design/DesignSeatShell.tsx` creates one `<a2ui-renderer>`, sets
  `system="surface-design"` and the door's `surfaceId`, and hands it the tree. The rail press
  writes `/surface/tab`, `/surface/session_id` and `/surface/conversation_id`; the renderer
  re-applies the props. The frame, the left body and the right column keep their identity.
- **One binding path.** The renderer resolves every `{path}`; the room does not resolve values by
  hand. A path the model does not hold emits `a2ui:validation-failed` with
  `code: "VALIDATION_FAILED"`, the component id and the path, and the room shows it.

The four layers are the folder's: `surface-design/catalog.json` (the catalogue the server
accepts), `surface-design/registry.ts`/`registry.json` (the registry source and the served
name→tag table), the elements under `chat/`, `tools/`, `ux/` and `approve/`, and the shell's
`a2ui-renderer.ts` (the universal resolver). `node design_A2UI/tests/four-layers.mjs` is the
folder's check; it reads the two exports and the elements' imports and reports every missing
name, tag or import.
- **Granular updates:** Update `/user/name` not entire `/` model.