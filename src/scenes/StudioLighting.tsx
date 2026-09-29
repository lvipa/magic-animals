import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Local studio reflections; no HDR download or external image service. */
export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, .04);
    const previous = scene.environment;
    scene.environment = target.texture;
    room.dispose(); pmrem.dispose();
    return () => { scene.environment = previous; target.dispose(); };
  }, [gl, scene]);
  return null;
}
