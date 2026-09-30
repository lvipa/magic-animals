# Milo InstantMesh blockout — not an approved character

This directory keeps an editable starting point for continued CAT sculpting:

- `milo-instantmesh-blockout.blend`: one raw mesh plus packed, original Milo
  turnaround, A-pose and expression references. Open the `READ_ME_FIRST` text
  block in Blender.
- `milo-instantmesh-blockout.glb`: the same unrigged raw mesh.
- `milo-instantmesh-blockout-front.png`, `-side.png`, `-back.png`: actual
  Blender renders of that GLB, rather than generated concept views.
- `milo-instantmesh-blockout.provenance.json`: source and checkpoint hashes.

The input was the project's approved original Milo A-pose. The six intermediate
views came from the official [InstantMesh](https://github.com/TencentARC/InstantMesh)
Space. Reconstruction used the official `instant_mesh_base.ckpt` weights and
mesh code at commit `08822c52fdc399b93ea00e4fa9e596344ed52ccc` in an
isolated local WSL environment. The [code license](https://github.com/TencentARC/InstantMesh/blob/main/LICENSE)
and [weight card](https://huggingface.co/TencentARC/InstantMesh) are Apache 2.0.
No model weights, third-party source, server access data, or private files are
included here. Original Milo concept art is included in the Blender scene.

**Status:** 15,780 vertices, 31,536 triangles, one vertex-color mesh, no UV,
PBR textures, separate eyes or clothing, rig, blendshapes or animation. The
head/body/hoodie/tail silhouette is recognizable, but the face, eyes, fur,
fabric and paw shapes are far below the approved art direction. This model
must not replace `public/models/cat-studio.glb`, be deployed to the game, or
be used as the benchmark for the other animals.

The next art pass must sculpt the face and body, make separate believable eyes
and real clothing, retopologize and UV unwrap, build the skeleton and seven
clips, then review the exported GLB from eight angles in the existing renderer.

## Three-view color study (30 September 2026)

`scripts/create-milo-threeview-study.py` projects the project's original Milo
front and turnaround art onto **this same unapproved mesh**, then bakes the
result into one 2048 px color atlas. The committed
`milo-threeview-projection-study.blend` retains the editable source projection
nodes and packed images. `milo-threeview-projection-study.glb` is a portable
textured GLB solely for inspection. `milo-threeview-study-{front,side,back}.png`
are actual Blender renders **after reimporting that exported GLB**.

This fixes the washed-out face and hoodie color on the front review. The
geometry has not improved: the tail and outer arms still lack convincing fur
and anatomy, and the back of the ears/head remains rough. The eyes and mouth
are painted detail, not separate animated geometry. An automated Blender
QuadriFlow attempt failed on this reconstruction even after voxel cleanup;
manual sculpt/retopology remains necessary. This file has no skin, facial
shapes, or animation clips, and must not replace the live CAT or establish the
visual benchmark for the remaining animals.

## Grid128 quad sculpt base (30 September 2026)

The official InstantMesh checkpoint was also run at its configured 128 grid
resolution. `milo-instantmesh-grid128.glb` is that raw, still unapproved mesh
(28,228 vertices / 56,400 triangles). Source and checkpoint hashes are in
`milo-grid128-quad.provenance.json`.

`scripts/build-milo-quad-study.py` turns this reconstruction into a cleaner
editable base: voxel size 0.03, QuadriFlow around 8,000 quad faces, then
shrinkwrap to the original surface. `milo-grid128-quad-study.blend` retains the
reference and quad mesh; its GLB is a geometry check. The chosen voxel size
was the smallest successful local trial; 0.025 and smaller caused QuadriFlow
to fail even on a closed manifold mesh.

`scripts/create-milo-quad-texture-study.py` projects the original concept art,
fills unpainted ear/sleeve/paw/tail regions with deliberately simple review
colors, bakes a UV atlas, and exports a portable
`milo-quad-threeview-projection-study.glb`. Its `.blend` keeps the editable
projection setup. Eight `milo-quad-threeview-study-*.png` files are actual
Blender renders **after importing that GLB**. The quad mesh smooths the
silhouette, with a single atlas/material for mobile review.

The eight frames and GLB are also available on the isolated
[Milo quad review page](https://animals.flowlabli.online/review/milo-quad/).
Its frame-based rotation is a review aid, not a demonstration of live rigging.
The game still loads the previously deployed CAT.

These are authoring studies, not the final CAT. The solid-color tail and back
ear patches show missing art detail; the hoodie remains part of the unified
surface, the eyes/mouth are texture-only, and the mesh has no rig or clips.
Manual face, clothing, fur and tail sculpting, dedicated materials, skinning,
facial shapes and motion review still gate production use.

## Automatic rigging stress test: rejected

`scripts/test-milo-quad-rig.py` imports the textured quad GLB, creates a
16-bone test armature, assigns automatic skin weights, smooths and normalizes
those weights, and renders a rest pose plus a modest Wave pose (65° upper-arm
lift) from three angles. Reproduce with Blender 5.1.2:

```powershell
& './.tools/blender-5.1.2-windows-x64/blender.exe' -b -t 8 --python scripts/test-milo-quad-rig.py
```

All 10,725 mesh vertices received weights, but
`milo-auto-rig-rejected-wave-front.png` and the side/quarter frames show torn
shoulder and neckline geometry. The rest image hides these flaws. The saved
`milo-auto-rig-rejected.blend` retains the rig, weights, texture and pose as
reproducible failure evidence. It is **not** a usable animated character and
must not be exported into the app. The four images are shown on the isolated
[review page](https://animals.flowlabli.online/review/milo-quad/) so the
failure is visible alongside the attractive static front view.

The fused body-and-hoodie surface is the blocking issue. The next authoring
pass must create clean shoulder and neck deformation loops, separated but
coordinated clothing and body shells, and controllable elbow/paw geometry.
Retopology only for a static render is insufficient; inspect a raised arm and
bent elbow before detailing the face or painting final textures. Keep the
approved front/side/back references in the Blender scene, and validate the
actual exported GLB from all angles before any CAT replacement.
