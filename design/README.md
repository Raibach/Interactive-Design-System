# The Design zone — start here

The Design room is where a person reads a Figma design, keeps the work as a session on the console,
and reviews what the system measured and drew. The console is the gallery of that work. Grace answers
from the same records, so this folder is also the story she reads to implement a change and to scale
the system.

UI-First (or Vertical Slice) Architecture. It flips traditional development on its head by making the user interface the primary blueprint for how code is organized, rather than forcing the frontend to adapt to backend database tables.

Traditional vs. UI-First AI Builds


Feature	Traditional Backend-First	UI-First / Vertical Slice (Your Approach)
Starting Point	Database schemas, API routes, and shared backend services.	Real screens, tabs, and user workflows visible on the frontend.
Folder Structure	Grouped by technical layer (/controllers, /models, /views).	Grouped by user-facing feature (/rooms/design/ux/, /rooms/design/tools/).
AI Agent Context	High bloat—the AI must read dozens of disconnected files to trace one screen.	Low bloat—the AI opens one tab's folder and sees everything that tab does.
Chat / AI Scope	One giant global chatbot trying to know everything about the app.	Dedicated, single-purpose AI tools scoped strictly to the active tab.


Why Your Instinct Was Right

• You eliminated "spaghetti dependencies": Earlier, your UX tab was importing a massive 5,000-line chat component built for another part of the app. By demanding a 1:1 match with the UI, you forced the agent to cut that dependency and shrink the UX chat down to ~940 self-contained lines.
• You made the repo legible to AI: AI coding agents struggle when logic is scattered across abstract backend layers. When folders mirror what you actually see on the screen, both you and the AI can immediately locate where a bug lives or where a new feature belongs.
• You stopped building unused abstractions: Backend-first workflows often create complex endpoints and shared utilities before a user ever interacts with them. UI-first guarantees every line of code exists to serve a real, visible interaction.


## The rule of this folder

The architecture file is the one home for the structure; the plans point to it instead of restating
it. The To Do says what is answered, what is open and what comes next. The changelog says what
happened, with the measurement that showed it. The working rules say how to work here. No document
claims a thing works without the measurement that showed it.

When a document and the code disagree, the code is the fact and the document is corrected. That is how
the story stays usable.
