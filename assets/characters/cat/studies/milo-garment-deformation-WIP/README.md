# Milo garment deformation study — unapproved

This separate revision of the hybrid rig reshapes four sleeve rings per arm,
adjusts the torso-to-arm weight transition, and removes 480 body faces hidden
under the opaque hoodie. Exposed neck, hands and legs remain. The original
hybrid study and the game's CAT are preserved.

Rebuild once from the original hybrid source:

```powershell
& './.tools/blender-5.1.2-windows-x64/blender.exe' -b -t 8 --python scripts/build-milo-garment-deformation-study.py
```

The builder refuses to overwrite an existing editable `.blend`.
The Blender source retains `Run_WIP` and `Wave_WIP`; its GLB uses the same
16-joint rig and 19 skinned primitives as the previous study.

Chrome/Three.js inspection of both clips at front, side and rear shows that
the broad body/coat intersections are reduced. Thin defects at the armhole,
cuff and neck remain. The clothing silhouette, hood, plain paws/tail,
texture-only eyes/mouth and five missing clips prevent CAT approval.
Subdivision also introduces more than four bone influences on some evaluated
vertices; the GLB exporter truncates/normalizes these. A final authored asset
must control those weights before export and verify the resulting motion.

Use the [interactive comparison](https://animals.flowlabli.online/review/milo-rig/viewer.html?v=4)
to switch between the original and this study with the same camera, clip and
paused timeline position. This revision is a deformation test, not a style
benchmark. Do not propagate it to other animals or replace the game CAT.
