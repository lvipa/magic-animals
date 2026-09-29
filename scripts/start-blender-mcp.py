"""Start the official Blender Lab bridge in a dedicated Milo scene.

Run with the workspace Blender 5.1.2, --factory-startup --online-mode.
This does not install an addon into the user's normal Blender profile.
"""
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parent.parent
ADDON = ROOT / '.tools/blender-mcp-official/addon'
SCENE = ROOT / 'assets/characters/cat/milo-authoring.blend'
if not (ADDON / 'blender_mcp_addon/__init__.py').is_file():
    raise RuntimeError('Official Blender Lab MCP source is missing from .tools.')
if bpy.app.version < (5, 1, 0):
    raise RuntimeError('Official bridge requires Blender 5.1 or newer.')
if SCENE.is_file():
    bpy.ops.wm.open_mainfile(filepath=str(SCENE))
sys.path.insert(0, str(ADDON))
import blender_mcp_addon
from blender_mcp_addon.cli import cli_execute
blender_mcp_addon.register()
if bpy.app.background:
    cli_execute(['--host', '127.0.0.1', '--port', '9877'])
else:
    from blender_mcp_addon import mcp_to_blender_server
    mcp_to_blender_server.start('127.0.0.1', 9877)
    print('Milo bridge ready at 127.0.0.1:9877')
