import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Unisce le mesh "foglia" figlie dello stesso nodo che condividono il materiale.
 * Riduce molto le chiamate di disegno (importante sui telefoni) senza cambiare l'aspetto:
 * ogni giunto continua a muoversi in modo indipendente.
 */
export function mergeStaticMeshes(root) {
  const nodes = [];
  root.traverse((o) => nodes.push(o));
  let merged = 0;
  for (const node of nodes) {
    const groups = new Map();
    for (const child of node.children) {
      if (!child.isMesh || child.children.length || child.userData.keep) continue;
      if (!groups.has(child.material)) groups.set(child.material, []);
      groups.get(child.material).push(child);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        // formato uniforme (non indicizzato) per poter unire geometrie diverse
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = meshes.some((m) => m.castShadow);
      mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
      mesh.userData.merged = true;
      for (const m of meshes) node.remove(m);
      node.add(mesh);
      merged += meshes.length - 1;
    }
  }
  return merged;
}

export function disposeMerged(root) {
  root.traverse((o) => {
    if (o.isMesh && o.userData.merged) o.geometry.dispose();
  });
}
