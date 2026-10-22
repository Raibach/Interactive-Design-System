Transports (Message Passing)¶

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
> The agent's messages arrive as an envelope the backend validates against the catalog before
> anything reaches the screen — the transport is not the gate, the catalog is. Server on 8000
> (proxied under `/api`), site on 5001 served live from source: `RESTART-LOCAL.sh` is the
> launcher. `cd frontend && npm run catalog:check` is the gate.

Transports deliver A2UI messages from agents to clients. A2UI is transport-agnostic: use any method that can send JSON.

The actual component rendering is done by the renderer, and the agents are responsible for generating the A2UI messages. Getting the messages from the agent to the client is the job of the transport.

How It Works¶

Agent → Transport → Client Renderer
A2UI defines a sequence of JSON messages. The transport layer is responsible for delivering this sequence from the agent to the client. A common transport mechanism is a stream using a format like JSON Lines (JSONL), where each line is a single A2UI message.

Available Transports¶
Transport	Status	Use Case
A2A Protocol	✅ Stable	Multi-agent systems, enterprise meshes
AG-UI	✅ Stable	Full stack React, Vue, Angular applications (CopilotKit)
REST API	📋 Planned	Simple HTTP endpoints
WebSockets	💡 Proposed	Real-time bidirectional
SSE (Server-Sent Events)	💡 Proposed	Web streaming
A2A Protocol¶
The Agent2Agent (A2A) protocol provides secure, standardized agent communication. An A2A extension provides easy integration with A2UI.

Benefits:

Security and authentication built-in.
Bindings for many message formats, auth, and transport protocols.
Clean separation of concerns.
If you are using A2A, this should be nearly automatic.

TODO: Add a detailed guide.

See: A2A Extension Specification

AG-UI¶
AG-UI translates A2UI messages to AG-UI events and handles transport and state sync automatically. It is commonly used for full stack React, Vue, and Angular applications. CopilotKit is AG-UI's creator and primary consumer.

See: Use A2UI with Any Agent Framework (Using AG-UI): Set up CopilotKit with your agent framework of choice and enable A2UI rendering.

Custom Transports¶
You can use any transport that sends JSON:

HTTP/REST:


// TODO: Add an example
WebSockets:


// TODO: Add an example
Server-Sent Events:


// TODO: Add an example
Next Steps¶
A2A Protocol Docs: Learn about A2A
A2A Extension Spec: A2UI + A2A details

https://a2a-protocol.org/

https://a2ui.org/guides/a2ui-with-any-agent-framework/

A2UI Extension for A2A Protocol v0.8 — Legacy¶
NOTE: Living Document

This specification is automatically included from specification/v0_8/docs/a2ui_extension_specification.md. Any updates to the specification will automatically appear here.

NOTE: Version Compatibility

This extension specification applies to A2UI v0.8 and the A2A Protocol. For the base A2UI protocol, see v0.8 Protocol Specification (Legacy).

For more information, see the following related documentation:

A2UI Protocol v0.8 (Legacy).
A2A Protocol Documentation.
A2UI (Agent-to-Agent UI) Extension spec¶
Overview¶
This extension implements the A2UI (Agent-to-Agent UI) spec, a format for agents to send streaming, interactive user interfaces to clients.

Extension URI¶
The URI of this extension is https://a2ui.org/a2a-extension/a2ui/v0.8

This is the only URI accepted for this extension.

Core concepts¶
The A2UI extension is built on the following main concepts:

Surfaces: A "Surface" is a distinct, controllable region of the client's UI. The spec uses a surfaceId to direct updates to specific surfaces (e.g., a main content area, a side panel, or a new chat bubble). This allows a single agent stream to manage multiple UI areas independently.

Catalog Definition Document: The a2ui extension is component-agnostic. All UI components (e.g., Text, Row, Button) and their stylings are defined in a separate Catalog Definition Schema. This allows clients and servers to negotiate which catalog to use.

Schemas: The a2ui extension is defined by three primary JSON schemas:

Catalog Definition Schema: A standard format for defining a library of components and styles.

Server-to-Client Message Schema: The core wire format for messages sent from the agent to the client (e.g., surfaceUpdate, dataModelUpdate).

Client-to-Server Event Schema: The core wire format for messages sent from the client to the agent (e.g., userAction).

Client Capabilities: The client sends its capabilities to the server in an a2uiClientCapabilities object. This object is included in the metadata field of every A2A Message sent from the client to the server. This object allows the client to declare which catalogs it supports.

Agent Card details¶
Agents advertise their A2UI capabilities in their AgentCard within the AgentCapabilities.extensions list. The params object defines the agent's specific UI support.

Example AgentExtension block:


{
  "uri": "https://a2ui.org/a2a-extension/a2ui/v0.8",
  "description": "Ability to render A2UI",
  "required": false,
  "params": {
    "supportedCatalogIds": [
      "https://a2ui.org/specification/v0_8/standard_catalog_definition.json",
      "https://my-company.com/a2ui/v0.8/my_custom_catalog.json"
    ],
    "acceptsInlineCatalogs": true
  }
}
Parameter definitions¶
params.supportedCatalogIds: (OPTIONAL) An array of strings, where each string is a URI pointing to a component Catalog Definition Schema that the agent can generate.
params.acceptsInlineCatalogs: (OPTIONAL) A boolean indicating if the agent can accept an inlineCatalogs array in the client's a2uiClientCapabilities. If omitted, this defaults to false.
Extension activation¶
Clients indicate their desire to use the A2UI extension by specifying it via the transport-defined A2A extension activation mechanism.

For JSON-RPC and HTTP transports, this is indicated via the X-A2A-Extensions HTTP header.

For gRPC, this is indicated via the X-A2A-Extensions metadata value.

Activating this extension implies that the server can send A2UI-specific messages (like surfaceUpdate) and the client is expected to send A2UI-specific events (like userAction).

Data encoding¶
A2UI messages are encoded as an A2A DataPart.

To identify a DataPart as containing A2UI data, it must have the following metadata:

mimeType: application/json+a2ui
The data field of the DataPart contains the A2UI JSON message (e.g., surfaceUpdate, userAction).

Example A2UI DataPart:


{
  "data": {
    "beginRendering": {
      "surfaceId": "outlier_stores_map_surface"
    }
  },
  "kind": "data",
  "metadata": {
    "mimeType": "application/json+a2ui"
  }
}