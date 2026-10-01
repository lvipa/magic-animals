"""Remove sub-micro-unit normal noise, preserving geometry, maps and motion."""
import json,struct
def compact(data,epsilon=1e-6):
    n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=data[28+n:]
    removed=0
    def view_bytes(index):
        view=doc['bufferViews'][index];offset=view.get('byteOffset',0)
        return binary[offset:offset+view['byteLength']]
    additions={}
    def add(payload):
        index=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteLength':len(payload)});additions[index]=payload;return index
    normals={target['NORMAL'] for mesh in doc['meshes'] for primitive in mesh['primitives'] for target in primitive.get('targets',[]) if 'NORMAL' in target}
    for index in normals:
        accessor=doc['accessors'][index];sparse=accessor.get('sparse')
        if not sparse:continue
        assert accessor['componentType']==5126 and accessor['type']=='VEC3'
        assert 'bufferView' not in accessor
        indices=sparse['indices'];values=sparse['values'];fmt={5121:'B',5123:'H',5125:'I'}[indices['componentType']];size=struct.calcsize(fmt)
        ib=view_bytes(indices['bufferView']);vb=view_bytes(values['bufferView'])
        io=indices.get('byteOffset',0);vo=values.get('byteOffset',0)
        kept=[]
        for i in range(sparse['count']):
            value=struct.unpack_from('<fff',vb,vo+12*i)
            if max(abs(v) for v in value)>epsilon:kept.append((struct.unpack_from('<'+fmt,ib,io+size*i)[0],value))
        removed+=sparse['count']-len(kept)
        if not kept:
            accessor.pop('sparse');accessor['min']=[0,0,0];accessor['max']=[0,0,0];continue
        sparse['count']=len(kept)
        sparse['indices']={'componentType':indices['componentType'],'bufferView':add(b''.join(struct.pack('<'+fmt,i) for i,_ in kept))}
        sparse['values']={'bufferView':add(b''.join(struct.pack('<fff',*v) for _,v in kept))}
    referenced=set()
    def scan(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='bufferView':referenced.add(item)
                else:scan(item)
        elif isinstance(value,list):
            for item in value:scan(item)
    scan(doc)
    mapping={};views=[];packed=bytearray()
    for old in sorted(referenced):
        while len(packed)%4:packed.append(0)
        payload=additions[old] if old in additions else view_bytes(old)
        view=dict(doc['bufferViews'][old]);view.update(byteOffset=len(packed),byteLength=len(payload),buffer=0)
        mapping[old]=len(views);views.append(view);packed.extend(payload)
    def remap(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='bufferView':value[key]=mapping[item]
                else:remap(item)
        elif isinstance(value,list):
            for item in value:remap(item)
    remap(doc);doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(packed)}]
    while len(packed)%4:packed.append(0)
    header=json.dumps(doc,separators=(',',':')).encode()
    while len(header)%4:header+=b' '
    result=struct.pack('<III',0x46546c67,2,28+len(header)+len(packed))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(packed),0x004e4942)+packed
    return result,{'normal_epsilon':epsilon,'removed_noise_vectors':removed,'saved_bytes':len(data)-len(result)}
