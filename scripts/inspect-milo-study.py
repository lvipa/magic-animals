"""Read-only geometry inventory; numbers do not establish art approval."""
from pathlib import Path
import json
import bpy
import bmesh

ROOT=Path(__file__).resolve().parent.parent
report={'status':bpy.context.scene.get('art_status'),'rigs':[], 'clips':[], 'meshes':[], 'grooms':[]}
for collection_name in ['01 / character anatomy','02 / eyes and facial deformation','03 / separate tailored hoodie','04 / groom and realtime fur','05 / rig and clips']:
    for ob in bpy.data.collections[collection_name].objects:
        if ob.type=='ARMATURE': report['rigs'].append(ob.name)
        if ob.type=='CURVE': report['grooms'].append({'name':ob.name,'splines':len(ob.data.splines)}); continue
        if ob.type!='MESH': continue
        bm=bmesh.new(); bm.from_mesh(ob.data)
        loose=sum(not v.link_faces for v in bm.verts)
        boundary=sum(e.is_boundary for e in bm.edges)
        nonmanifold=sum(not e.is_manifold and not e.is_boundary for e in bm.edges)
        visited=set(); components=0
        for v in bm.verts:
            if v in visited or not v.link_faces: continue
            components+=1; queue=[v]; visited.add(v)
            while queue:
                current=queue.pop()
                for edge in current.link_edges:
                    neighbor=edge.other_vert(current)
                    if neighbor not in visited: visited.add(neighbor); queue.append(neighbor)
        evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
        report['meshes'].append({'name':ob.name,'control_vertices':len(ob.data.vertices),
            'evaluated_triangles':len(mesh.loop_triangles),'connected_components':components,
            'loose_vertices':loose,'boundary_edges':boundary,'nonmanifold_internal_edges':nonmanifold})
        evaluated.to_mesh_clear(); bm.free()
report['clips']=[action.name for action in bpy.data.actions]
report['limitations']=['No artistic acceptance is inferred from counts.','Curves are sculpt groom, not optimized web fur.','No rig or clips have been authored for this study.']
output=ROOT/'.test-artifacts/milo-study-inventory.json'
output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
result=report
