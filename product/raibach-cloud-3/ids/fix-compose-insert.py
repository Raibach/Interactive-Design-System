#!/usr/bin/env python3
"""Place the canvas service under `services:` in the ids compose file.

The first deploy appended the service block after the top-level `networks:`
section — compose rejected it ("networks.canvas additional properties not
allowed"). This moves it into services: and is safe to run any number of
times:
  - block sitting outside services:  → cut, then re-insert under services:
  - block already under services:    → no-op
  - block absent                     → insert under services:

Deploy script (canvas-deploy.sh) calls this unconditionally before `compose
config`, so placement can never silently drift again.
"""
import re

P = "/opt/raibach/ids/docker-compose.yml"
S = "/opt/raibach/ids/canvas-compose.yml"

block = open(S).read().split("services:", 1)[1].strip("\n").splitlines()
lines = open(P).read().splitlines()

svc = next(i for i, l in enumerate(lines) if l.startswith("services:"))
net = next((i for i, l in enumerate(lines) if l.startswith("networks:")), len(lines))

# 1. cut a stray block that sits at/after the networks: section
strays = [i for i, l in enumerate(lines) if l.startswith("  canvas:")]
if strays and strays[0] > net:
    lines = lines[:strays[0]]
    while lines and lines[-1].strip() == "":
        lines.pop()

# 2. is the block already inside services: (before the next top-level key)?
end = len(lines)
for i in range(svc + 1, len(lines)):
    if re.match(r"^[A-Za-z]", lines[i]):
        end = i
        break
inside = any(lines[i].startswith("  canvas:") for i in range(svc, end))

if inside:
    print("compose: canvas already under services: — no change")
else:
    lines = lines[:end] + block + [""] + lines[end:]
    open(P, "w").write("\n".join(lines) + "\n")
    print("compose: canvas inserted under services:")
