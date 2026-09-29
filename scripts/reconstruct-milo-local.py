"""Local image-to-mesh draft using pinned MIT TripoSR weights, on CPU or CUDA.

This is reconstruction input for Blender, not a production character or rig.
The original concept is read locally; no image is sent to a generation service.
Background segmentation and model caches stay under ignored .tools/.
"""
import argparse
import gc
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import types

ROOT=Path(__file__).resolve().parent.parent
os.environ['HF_HOME']=str(ROOT/'.tools/triposr-cache/huggingface')
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
os.environ['U2NET_HOME']=str(ROOT/'.tools/triposr-cache/rembg')
os.environ['OMP_NUM_THREADS']='2'
os.environ['MKL_NUM_THREADS']='2'

def log(message): print(time.strftime('%H:%M:%S')+' '+message,flush=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resolution',type=int,default=128,choices=[128,192,256])
    parser.add_argument('--reuse-triplane',type=int,choices=[128,192,256])
    parser.add_argument('--device',choices=['cpu','cuda'],default='cpu')
    args=parser.parse_args()
    output=ROOT/('.test-artifacts/milo-reconstruction-'+str(args.resolution))
    output.mkdir(parents=True,exist_ok=True)
    if (output/'milo-draft.glb').exists(): raise RuntimeError('Existing draft preserved; inspect it before generating another.')
    weights=ROOT/'.tools/triposr-models/model.ckpt'
    expected='429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee'
    log('Checking pinned model checksum')
    digest=hashlib.sha256()
    with weights.open('rb') as file:
        for chunk in iter(lambda:file.read(8*1024*1024),b''): digest.update(chunk)
    if digest.hexdigest()!=expected: raise RuntimeError('Incomplete or unexpected model checkpoint.')
    log('Loading the local Python inference runtime')
    import numpy as np
    import torch
    import mcubes
    import rembg
    from PIL import Image
    from omegaconf import OmegaConf
    torch.set_num_threads(2); torch.set_num_interop_threads(1)
    if args.device=='cuda' and not torch.cuda.is_available():
        raise RuntimeError('CUDA requested but unavailable; use a CUDA PyTorch environment and compatible NVIDIA driver.')
    # TripoSR's helper expects torchmcubes in ZYX order. PyMCubes provides a
    # Windows CPU wheel with XYZ output; convert at this API boundary. Model
    # architecture and weights are unchanged, and no CUDA compiler is needed.
    shim=types.ModuleType('torchmcubes')
    def marching_cubes(level,threshold):
        vertices,faces=mcubes.marching_cubes(level.detach().cpu().numpy(),threshold)
        return (torch.from_numpy(vertices[:,[2,1,0]].copy()).float().to(level.device),
                torch.from_numpy(faces.astype(np.int64)).to(level.device))
    shim.marching_cubes=marching_cubes
    sys.modules['torchmcubes']=shim
    sys.path.insert(0,str(ROOT/'.tools/triposr-source'))
    from tsr.system import TSR
    from tsr.utils import remove_background,resize_foreground
    config=OmegaConf.load(ROOT/'.tools/triposr-models/config.yaml')
    OmegaConf.resolve(config)
    for key,value in config.items():
        if key.endswith('_cls') and not str(value).startswith('tsr.models.'):
            raise RuntimeError('Unexpected model implementation in configuration.')
    log('Loading '+args.device+' model')
    model=TSR(config)
    state=torch.load(weights,map_location='cpu',weights_only=True)
    model.load_state_dict(state); del state; gc.collect()
    model.to(args.device).eval(); model.renderer.set_chunk_size(4096)
    source=ROOT/'assets/characters/cat/concepts/milo-rig-pose-v1.png'
    start=time.monotonic()
    with torch.inference_mode():
        if args.reuse_triplane:
            previous=ROOT/('.test-artifacts/milo-reconstruction-'+str(args.reuse_triplane))
            metadata=json.loads((previous/'report.json').read_text())
            if metadata['source']!=str(source.relative_to(ROOT)) or metadata['model_sha256']!=expected:
                raise RuntimeError('Cached triplane is from a different source/model.')
            log('Reusing locally reconstructed triplane '+str(args.reuse_triplane))
            code=torch.from_numpy(np.load(previous/'triplane.npy',allow_pickle=False)).to(args.device)
            if tuple(code.shape)!=(1,3,40,64,64): raise RuntimeError('Unexpected cached triplane shape.')
        else:
            log('Preparing original Milo concept locally')
            session=rembg.new_session('u2net',providers=['CPUExecutionProvider'])
            masked=remove_background(Image.open(source),session)
            prepared=resize_foreground(masked,.85)
            image=np.asarray(prepared).astype(np.float32)/255
            image=image[:,:,:3]*image[:,:,3:4]+(1-image[:,:,3:4])*.5
            image=Image.fromarray((image*255).astype(np.uint8))
            del session,masked,prepared; gc.collect()
            log('Reconstructing triplane from the image')
            code=model([image],device=args.device)
        np.save(output/'triplane.npy',code.cpu().numpy())
        log('Extracting '+str(args.resolution)+' voxel mesh with vertex colors')
        mesh=model.extract_mesh(code,has_vertex_color=True,resolution=args.resolution)[0]
    if not len(mesh.vertices) or not np.isfinite(mesh.vertices).all(): raise RuntimeError('Invalid reconstruction.')
    mesh.export(output/'milo-draft.ply')
    # Inspected Milo reconstruction: +X front, Z up. glTF: Y up, character
    # facing +Z, matching the app's common character convention.
    gltf_mesh=mesh.copy()
    gltf_mesh.apply_transform(np.array([[0,1,0,0],[0,0,1,0],[1,0,0,0],[0,0,0,1]],dtype=np.float64))
    gltf_mesh.export(output/'milo-draft.glb')
    report={'source':str(source.relative_to(ROOT)),'model':'stabilityai/TripoSR',
        'model_revision':'5b521936b01fbe1890f6f9baed0254ab6351c04a','model_sha256':expected,
        'source_commit':'107cefdc244c39106fa830359024f6a2f1c78871','device':args.device,
        'resolution':args.resolution,'vertices':len(mesh.vertices),'triangles':len(mesh.faces),'glb_axes':'Y up / +Z front',
        'elapsed_seconds':round(time.monotonic()-start,1),'status':'raw reconstruction; no art approval, materials, rig or animation'}
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    log(json.dumps(report))

if __name__=='__main__': main()
