# Design A2UI — a sovereign seat for the Design room

This folder is the Design room's own seat: the interface the person uses when they press Design
or Design A2UI. It is not a copy that runs beside the application; it is the application's Design
room, moved here, drawn under this folder's own names and driven by this folder's own catalogue.

## What the person sees

The person presses Design and the room opens inside the application: the three columns, the rail,
and the five boxes of the right column — the status line, the conversations card, the thread, the
typing area with Send, and the row of tools. The rail's items — Home, Tools, Approve, UX — change
what the room serves without rebuilding it. Tools opens the Figma ingest: the form, the measured
catalogue tree and its preview. Approve opens the records waiting for a decision. UX opens the
analytics application with its own conversation. The Design A2UI tab shows the same room, and the
two tabs are the same surface reached two ways.

## What was achieved today

The seat became sovereign. Every element it draws carries this folder's own name, every name the
model may emit is declared in this folder's registry and schema, and the room it draws is assembled
from this folder's own files. The application's Design room was moved out of the application's
source and into an archive; nothing in the running application imports it any more. The shell keeps
only what is universal: the page, the sign-in, the transport, the error reporting, the assets, the
A2UI renderer, the catalogue loader and the registry mechanism. The tab supplies the place; this
folder supplies the room.

The two Design tabs now mount the same seat. The old room remains on disk as the fallback, and
deleting it is now a decision rather than a risk.

## How it was made

The work followed one rule: copy the application's files into this folder with the seat's own
names, and change nothing in the application until the copy is proven. Element names were changed
throughout — `design-workspace` became `design2-workspace`, the room's seat renderer was removed
entirely, and the chat, tools and UX parts took the `design2-*` names. The seat's catalogue and
registry were written from the seat's own components and exported as the two files the shell's
loader reads; a pointer in the application's catalogue folder lets that loader find them without a
line of application code changing. The shell's renderer draws the surface through the seat's table,
and the tab's load was moved into `surface/load.ts`, which reads the console's answer, resolves the
seat's table, and mounts once.

The two chat seats — the standing seat and the Chat tab's page — were merged into one class with
one property saying which conversation file it reads, and the UX seat's parts were reduced to the
chat seat's own elements wherever the two were the same code. What could not be shared was left
alone rather than forced.

## Why it matters

The Design room can now be changed, tested and eventually deleted without editing the application
to do it. A failure in the seat is a failure of one seat, not of the shell. The same pattern — a
folder with its own names, catalogue, registry and renderer table — is the one the Tools, Approve
and UX seats follow, so the remaining work is repetition rather than invention.

## The proof

Measured on the running application at 5001: the Design tab and the Design A2UI tab draw the
surface; the rail's press keeps the frame and its columns as the same elements and changes only the
data and the right column; the Tools tab draws its own form and catalogue tree; the Approve page
draws its review list; the UX tab draws its application and its greeting; and the type check
reports zero errors. Two page loads in a row open the same conversation and create no new one.

## What is not finished

The seat still imports the shell's shared helpers — the sign-in identity, the transport, the
envelope reader, the registry loader, the renderer and the image assets. That is the boundary the
plan draws: those are the shell's. Inside the folder, the chat seat's conversation presses and the
UX seat's remaining readers are not yet split into their place files, the UX message round trip
has not been proven end to end, and the Tools tab's server-side routes are still the application's.
