# Milo hybrid rig study — not an approved CAT

This isolated study combines the closer-to-reference projected Milo head with
the separate body and hoodie meshes from `milo-authoring.blend`. It answers a
technical question: can real arm, leg and tail bones deform the character and
survive GLB export without the tears seen in `milo-auto-rig-rejected.blend`?

## Files

- `milo-hybrid-rig-trial.blend`: editable Blender 5.1.2 source with 16 bones,
  skin weights and both test actions retained after reopening the file. Source concept art remains in the
  project; the rejected old facial meshes were removed from this copy.
- `milo-hybrid-motion-WIP.glb`: exported 5.59 MB GLB with 55,345 triangles,
  one skin, 16 joints, 7 materials, 4 embedded images, and **only**
  `Wave_WIP` and `Run_WIP` animation clips.
- `glb-reimport-*.png`: four real Blender renders **after reimporting the
  exported GLB**, showing rest, raised arm and opposite run phases.

Rebuild from the project's authored assets, then verify the exported file:

```powershell
& './.tools/blender-5.1.2-windows-x64/blender.exe' -b -t 8 --python scripts/build-milo-hybrid-rig-study.py
& './.tools/blender-5.1.2-windows-x64/blender.exe' -b -t 8 --python scripts/verify-milo-hybrid-rig-study.py
& 'C:/Python311/python.exe' scripts/inspect-incoming-cat.py assets/characters/cat/studies/milo-hybrid-rig-WIP/milo-hybrid-motion-WIP.glb
```

The builder refuses to overwrite an existing `.blend`, to preserve later
manual edits. The final inspection is **expected to fail**: it correctly
reports that the seven production clips are missing. The four renders and GLB
are also available on the isolated
[rig review page](https://animals.flowlabli.online/review/milo-rig/).
That page links to an [interactive WebGL review](https://animals.flowlabli.online/review/milo-rig/viewer.html):
rotate Milo, switch the two WIP clips, pause and scrub their timeline, and
inspect front/side/back. It loads the same GLB as the stills and does not enter
the game. Rebuild its bundled viewer after changing
`scripts/milo-review-viewer.js` with `./run.ps1 build:review`.

## What works and what remains

The raised arm no longer opens the severe shoulder/neck tears of the fused
quad reconstruction. The exported GLB retains its rig and two distinct
actions; reimport confirmed that the arm and legs actually rotate. Static
pockets, zipper and hood were attached to torso/neck bones, and leg weight
leakage into the hoodie was removed. Subdivision was limited for export to
stay below the project's mobile polygon and file-size guide.

A separate Chrome WebGL check loaded the same GLB with Three.js GLTFLoader and
AnimationMixer. Both clips played and all 19 mesh parts remained skinned, but
the browser screenshots reveal a visible shoulder/torso seam in `Wave_WIP` and
an abrupt join between the projected head and the simpler body. The WebGL
frames and the interactive side/back review make the thin hood, simple paws
and tail attachment visible too. This is a
remaining visual failure, so successful Blender reimport alone is insufficient
for CAT approval. The Vite development server stalled during this check; the
WebGL test used a minimal isolated Three.js viewer, not the app route.
An isolated weight-paint trial changed 66 shoulder vertices but left the
visible join in the browser. It was rejected and is not the source or live
model. The next garment revision needs a redesigned shoulder/armhole shape and
supporting deformation topology, not another weight-only adjustment.

The first saved `.blend` accidentally lost `Wave_WIP` as an orphan action even
though the GLB contained it. The source was repaired with a backup, and the
builder now marks both actions to survive a Blender save. The verifier checks
the reopened `.blend` before checking the exported GLB.

**This is an animation pipeline proof, not a style benchmark.** The body,
paws, hoodie folds and tail are still too plain; shoulders still need proper
sculpted transitions. The eyes and mouth on the projected head are texture
detail, not facial geometry or blendshapes. The head is a cut-open study mesh
hidden by the collar, and the groom curves in the `.blend` do not export to
GLB. `Run_WIP` is an alternating test pose rather than a finished running
cycle; `Wave_WIP` lacks nuanced paw and facial acting. The other five clips,
voice synchronization and mobile-device QA are still outstanding.

Do not replace `public/models/cat-studio.glb` with this asset, deploy it to
the game, approve CAT, or propagate it to the remaining seven animals.
