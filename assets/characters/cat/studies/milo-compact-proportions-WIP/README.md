# Milo compact proportions study — not an approved CAT

Separate revision following the user's feedback about the frightening neck,
arms and head. It retains the original 2D Milo concept as the reference.

Changes:

- Removed the projected duplicate collar below the head at source Z=1.275.
- Lowered the head by 0.16, widened it by 4%, softened the ear tip height.
- Shortened arm length to 78% and widened the torso to 116%; updated rest bones.
- Replaced stretched hands with continuous rounded mitten cages, skinned to
  the paw joints; added wrist movement to `Wave_WIP`.
- Rebuilt the dropped hood as a rounded bag with a supported opening.
- Desaturated the cloth map, reduced micro-normal strength, removed secondary
  head vertex tint. The head material has a small albedo-colored emission
  factor (0.18) as shadow fill. This is an explicit WIP shading choice, not
  proof of finished face geometry or a final unified material system.

The GLB has 21 skinned primitives and the same 16-bone hierarchy. Only
`Wave_WIP` and `Run_WIP` are present. Chrome/Three.js front, side and rear
inspection confirms the shorter neck, fuller hands and hood; the interactive
viewer compares all three studies at one camera and paused timeline position.

Rebuild from the previous garment source:

```powershell
& './.tools/blender-5.1.2-windows-x64/blender.exe' -b -t 8 --python scripts/build-milo-compact-proportions-study.py
```

The script preserves existing manual edits by refusing to overwrite the
saved `.blend`. Both WIP actions are kept in the editable source.

**Remaining:** face detail is still a projected texture; true eyes, eyelids,
mouth and facial acting need authoring. Ear profile, shoulder/cuff joins,
fur, fabric folds, feet and tail still need art work. Five clips are missing.
Subdivision can still create more than four influences, which the exporter
truncates; control and verify final weights before any game replacement.

[Interactive review](https://animals.flowlabli.online/review/milo-rig/viewer.html?v=5).
This is not a CAT benchmark. Do not propagate it to the other animals yet.
