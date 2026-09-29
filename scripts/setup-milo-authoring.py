"""Make a clean local art scene. Execute through Blender MCP, not on production.

The reference boards are not geometry or finished characters.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'assets/characters/cat/milo-authoring.blend'
if OUTPUT.exists():
    raise RuntimeError('Authoring scene already exists; refusing to overwrite it.')
bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
scene = bpy.context.scene
scene.name = 'Milo / authoring and art review'

def collection(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col

references = collection('00 / approved Milo references')
sculpt = collection('01 / character anatomy')
eyes = collection('02 / eyes and facial deformation')
clothes = collection('03 / separate tailored hoodie')
groom = collection('04 / groom and realtime fur')
rig = collection('05 / rig and clips')
studio = collection('90 / cameras and studio')

def board(name, file, location, rotation, size):
    image = bpy.data.images.load(str(file), check_existing=True)
    image.pack()
    ob = bpy.data.objects.new(name, None)
    references.objects.link(ob)
    ob.empty_display_type = 'IMAGE'
    ob.data = image
    ob.empty_display_size = size
    ob.empty_image_depth = 'BACK'
    ob.color[3] = .65
    ob.location = location
    ob.rotation_euler = rotation
    ob.hide_render = True
    ob['approved_art_reference'] = True
    return ob

board('Milo / front A pose', ROOT / 'assets/characters/cat/concepts/milo-rig-pose-v1.png',
      (0,.50,1.08), (math.pi/2,0,0), 2.28)
board('Milo / front-side-back turnaround', ROOT / 'assets/characters/cat/concepts/milo-turnaround-v1.png',
      (2.6,.50,1.08), (math.pi/2,0,0), 3.0)
board('Milo / facial expressions', ROOT / 'assets/characters/cat/concepts/milo-expressions-v1.png',
      (-2.6,.50,1.08), (math.pi/2,0,0), 3.0)

def aim(ob, target):
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()

for name, position in [('front',(0,-5,1.15)), ('three-quarter',(3,-4,1.35)),
                       ('side',(5,0,1.15)), ('back',(0,5,1.15))]:
    data = bpy.data.cameras.new('Milo camera / '+name)
    ob = bpy.data.objects.new('Milo camera / '+name,data)
    studio.objects.link(ob)
    ob.location = position
    aim(ob,(0,0,1.08))
    data.type = 'ORTHO'
    data.ortho_scale = 2.65
    if name == 'front': scene.camera = ob
for name, pos, power, size in [('key',(-3,-4,5),650,4),('fill',(3,-2,3),350,3),('rim',(2,3,4),550,3)]:
    data = bpy.data.lights.new('Milo studio / '+name,'AREA')
    data.energy, data.shape, data.size = power,'DISK',size
    ob = bpy.data.objects.new(data.name,data)
    studio.objects.link(ob)
    ob.location = pos
    aim(ob,(0,0,1))
scene.world = bpy.data.worlds.new('Milo neutral studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.14,.12,.11,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 900
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene['art_status'] = 'References approved. New authored mesh pending. Not a production replacement.'
scene['pipeline'] = 'Blender Lab MCP 1.0.3; local scene; GLB export after art and deformation review'
notes = bpy.data.texts.new('MILO_README')
notes.write('Original approved Milo references are packed.\n'
            'Current production CAT has not been imported into this scene.\n'
            'Sculpt anatomy; place eyes in sockets with eyelids; make clothing separately.\n'
            'Review front/side/back before skinning. Do not accept a rendered bitmap as a 3D model.\n'
            'Production budget: ~80k triangles, 8 MiB GLB, texture maps up to 1024 px.\n'
            'Seven required clips: idle, happy, wave, jump, run, sleep, roar.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT))
result = {'scene':str(OUTPUT), 'reference_images':len(bpy.data.images), 'collections':len(bpy.data.collections),
          'status':'reference setup; character not modeled yet'}
