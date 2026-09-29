"""Export the SAVED, artist-editable CAT Blender source without rebuilding geometry.
Run: blender -b assets/characters/cat/milo-master.blend --python scripts/export-cat-master.py
"""
import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
REPORT=ROOT/'.test-artifacts/cat-master'; REPORT.mkdir(parents=True,exist_ok=True)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o.name=='CAT_MasterRig')
bones=rig.pose.bones
objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.find_armature()==rig]
body_ob=next(o for o in objects if o.name=='CAT_BodyConnected')
coat_ob=next(o for o in objects if o.name=='CAT_HoodieSewn')
hood_ob=next(o for o in objects if o.name=='CAT_HoodOpenShell')
cage_stats=[{'name':o.name,'vertices':len(o.data.vertices),'faces':len(o.data.polygons)} for o in objects]
durations={t.name:None for t in rig.animation_data.nla_tracks}
fur=bpy.data.materials['CAT / short directional fur']
knit=bpy.data.materials['CAT / rib knit']
thread=bpy.data.materials['CAT / stitches and zipper']
whisker=bpy.data.materials['CAT / soft whisker fibers']
lip=bpy.data.materials['CAT / warm lips']
pink=bpy.data.materials['CAT / inner ear and pads']
sclera=bpy.data.materials['CAT / wet sclera']
iris=bpy.data.materials['CAT / iris']
pupil=bpy.data.materials['CAT / pupil']
cornea=bpy.data.materials['CAT / corneal film']
nose=bpy.data.materials['CAT / moist rose nose']

# Source topology and normalized weights are inspectable before triangulation.
stats={'cages':cage_stats,'bones':len(bones),'clips':list(durations),'approval':'pending','topology':{}}
for ob in [body_ob,coat_ob,hood_ob]:
    adjacency={i:set() for i in range(len(ob.data.vertices))}
    for e in ob.data.edges: a,b=e.vertices; adjacency[a].add(b); adjacency[b].add(a)
    remaining=set(adjacency); components=0
    while remaining:
        components+=1; stack=[remaining.pop()]
        while stack:
            for other in adjacency[stack.pop()] & remaining: remaining.remove(other); stack.append(other)
    stats['topology'][ob.name]={'components':components,'quad_fraction':sum(len(p.vertices)==4 for p in ob.data.polygons)/len(ob.data.polygons)}
    assert components==1, (ob.name,components)
    for v in ob.data.vertices: assert abs(sum(g.weight for g in v.groups)-1)<.0001
for ob in objects:
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers):
        if mod.type!='ARMATURE': bpy.ops.object.modifier_apply(modifier=mod.name)
    if ob==body_ob:
        mod=ob.modifiers.new('Web mesh optimization','DECIMATE'); mod.ratio=.64
        bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # glTF's four-influence budget is explicit rather than an exporter surprise.
    for v in ob.data.vertices:
        weights=sorted([(g.group,g.weight) for g in v.groups if g.weight>0],key=lambda pair:pair[1],reverse=True)
        keep=weights[:4]; total=sum(w for _,w in keep)
        assert total>0
        for index,w in weights:
            group=ob.vertex_groups[index]
            if (index,w) in keep: group.add([v.index],w/total,'REPLACE')
            else: group.remove([v.index])
stats['triangles']=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in objects)
stats['mesh_triangles']={ob.name:sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in objects}
print('Geometry budget:',json.dumps(stats['mesh_triangles']),flush=True)
assert stats['triangles']<80000,stats['triangles']
(REPORT/'structure.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
# Join compatible detail meshes by material without losing per-vertex weights.
for mat in [fur,knit,thread,whisker,lip,pink,sclera,iris,pupil,cornea,nose]:
    candidates=[o for o in objects if len(o.data.materials)==1 and o.data.materials[0]==mat and not o.name.startswith(('CAT_Body','CAT_Tail','Groom_'))]
    if len(candidates)<2: continue
    objects=[o for o in objects if o not in candidates]+[candidates[0]]
    bpy.ops.object.select_all(action='DESELECT')
    for o in candidates: o.select_set(True)
    bpy.context.view_layer.objects.active=candidates[0]; bpy.ops.object.join()
    candidates[0].name='CAT_Details_'+mat.name.split('/')[-1].strip().replace(' ','_')
for track in rig.animation_data.nla_tracks: track.mute=False
bpy.ops.object.select_all(action='DESELECT')
for ob in objects+[rig]: ob.select_set(True)
args=dict(filepath=str(ROOT/'public/models/cat-studio.glb'),export_format='GLB',export_yup=True,
          use_selection=True,export_animations=True,export_skins=True,export_extras=True,export_texcoords=True,export_normals=True,
          export_materials='EXPORT',export_image_format='AUTO',export_animation_mode='NLA_TRACKS',
          export_force_sampling=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys(); bpy.ops.export_scene.gltf(**{k:v for k,v in args.items() if k in props})
# The existing Download CAT link resolves to the production candidate, too.
(ROOT/'public/models/cat.glb').write_bytes((ROOT/'public/models/cat-studio.glb').read_bytes())
info={'version':7,'approval':'pending','source':'assets/characters/cat/milo-master.blend',
      'bones':len(bones),'clips':list(durations),'triangles':stats['triangles'],
      'topology':stats['topology'],'textureLimit':1024,'pipeline':'Connected control cages / UV / PBR / skin weights / GLB'}
(ROOT/'public/models/cat-master-info.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
print('CAT replacement:',json.dumps(stats),flush=True)
