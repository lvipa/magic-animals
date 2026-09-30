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
