"""Restore source 2K surface detail while retaining the game's atlas corrections.

This edits embedded glTF texture buffers only. Rig, geometry, morphs, animations,
UVs and material assignments retain their data bytes; buffer offsets are repacked.
Requires Pillow and numpy; provide the original user GLBs in --sources.
"""
from pathlib import Path
import argparse,struct,json,io,hashlib
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def read(path):
 data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
 return json.loads(data[20:20+length]),bytearray(data[28+length:])
def image(document,binary,index):
 view=document['bufferViews'][document['images'][index]['bufferView']]
 start=view.get('byteOffset',0)
 return Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
def upgrade(kind,source):
 info_path=ROOT/'public/models'/f'{kind}-master-info.json'
 info=json.loads(info_path.read_text(encoding='utf-8'))
 previous=info.get('hd_previous_asset',info['asset'])
 document,binary=read(ROOT/'public/models'/previous)
 original,source_binary=read(source)
 material=next(m for m in document['materials'] if m.get('normalTexture'))
 source_material=next(m for m in original['materials'] if m.get('normalTexture'))
 replacements=[];obsolete=set()
 for field in ['baseColorTexture','normalTexture']:
  current_tex=material['pbrMetallicRoughness'][field] if field=='baseColorTexture' else material[field]
  source_tex=source_material['pbrMetallicRoughness'][field] if field=='baseColorTexture' else source_material[field]
  current_index=document['textures'][current_tex['index']]['source']
  source_index=original['textures'][source_tex['index']]['source']
  current=image(document,binary,current_index);high=image(original,source_binary,source_index)
  if current.width>=high.width:continue
  low=high.resize(current.size,Image.Resampling.LANCZOS)
  difference=np.asarray(current,dtype=np.float32)-np.asarray(low,dtype=np.float32)
  # Reject unrelated atlases; never reinterpret UVs from another mesh.
  assert np.mean(np.abs(difference))<40,(kind,field,'atlas mismatch')
  if field=='normalTexture':
   corrected=high
  else:
   correction=np.stack([np.asarray(Image.fromarray(difference[:,:,c],mode='F').resize(high.size,Image.Resampling.BILINEAR)) for c in range(3)],axis=2)
   corrected=Image.fromarray(np.clip(np.asarray(high,dtype=np.float32)+correction,0,255).astype(np.uint8))
  encoded=io.BytesIO()
  if field=='baseColorTexture':corrected.save(encoded,format='JPEG',quality=95,subsampling=0)
  else:corrected.save(encoded,format='PNG',optimize=True)
  while len(binary)%4:binary.append(0)
  data=encoded.getvalue();offset=len(binary);binary.extend(data)
  document['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
  obsolete.add(document['images'][current_index]['bufferView'])
  document['images'][current_index]['bufferView']=len(document['bufferViews'])-1
  document['images'][current_index]['mimeType']='image/jpeg' if field=='baseColorTexture' else 'image/png'
  document['images'][current_index]['name']=kind+' / source 2K '+field
  replacements.append({'map':field,'from':current.width,'to':high.width})
 # Remove obsolete embedded maps without touching bytes belonging to rig/mesh.
 packed=bytearray();views=[];mapping={}
 for index,view in enumerate(document['bufferViews']):
  if index in obsolete:continue
  mapping[index]=len(views)
  while len(packed)%4:packed.append(0)
  start=view.get('byteOffset',0);offset=len(packed)
  packed.extend(binary[start:start+view['byteLength']])
  views.append({**view,'byteOffset':offset})
 def remap(node):
  if isinstance(node,dict):
   for key,value in node.items():
    if key=='bufferView':node[key]=mapping[value]
    else:remap(value)
  elif isinstance(node,list):
   for value in node:remap(value)
 remap(document);document['bufferViews']=views;binary=packed
 document['buffers'][0]['byteLength']=len(binary)
 while len(binary)%4:binary.append(0)
 header=json.dumps(document,separators=(',',':')).encode()
 header+=b' '*((-len(header))%4)
 exported=struct.pack('<4sII',b'glTF',2,28+len(header)+len(binary))+struct.pack('<I4s',len(header),b'JSON')+header+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 sha=hashlib.sha256(exported).hexdigest();name=f'{kind}-milo-hd-{sha[:12]}.glb'
 (ROOT/'public/models'/name).write_bytes(exported)
 info.update(asset=name,sha256=sha,bytes=len(exported),texture_upgrade=replacements,hd_previous_asset=previous)
 info_path.write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
 print(kind,name,len(exported),replacements,flush=True)
 return '/models/'+name
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--sources',type=Path,required=True);args=parser.parse_args()
 files={'cat':'Meshy_AI_Hoodie_Whiskers_0930203234_texture.glb','bunny':'Meshy_AI_Bunny_in_a_Pink_Hoodi_0930215127_texture.glb'}
 urls={kind:upgrade(kind,args.sources/name) for kind,name in files.items()}
 (ROOT/'src/characters/catAsset.ts').write_text("// Source 2K detail; original rig and atlas corrections retained.\nexport const CAT_MODEL_URL = '"+urls['cat']+"';\n",encoding='utf-8')
 path=ROOT/'src/characters/castAssets.ts';text=path.read_text(encoding='utf-8')
 import re
 text=re.sub(r'("bunny":\s*")[^"]+',lambda m:m.group(1)+urls['bunny'],text)
 path.write_text(text,encoding='utf-8')
