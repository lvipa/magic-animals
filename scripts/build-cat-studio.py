"""Compatibility entry point. The primitive studio generator has been retired.

Production source and implementation now live in build-cat-master.py and
assets/characters/cat/milo-master.blend. Never re-export the old 79-part model.
"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build-cat-master.py')),run_name='__main__')
