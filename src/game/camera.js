import * as THREE from 'three';
import { damp, clamp } from './anim.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

function noise(t, seed) {
  return Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 7.3 + seed * 1.1) * 0.2;
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 12, -40);
    this.look = new THREE.Vector3(0, 6, 0);
    this.trauma = 0;
    this.time = 0;
    this.baseFov = camera.fov;
    this.fovKick = 0;
    this.mode = 'follow';
    this.modeTime = 0;
    this.orbit = 0;
  }

  shake(amount) {
    this.trauma = Math.min(1.1, this.trauma + amount);
  }

  kick(amount) {
    this.fovKick = Math.max(this.fovKick, amount);
  }

  setMode(mode, data = {}) {
    this.mode = mode;
    this.modeTime = 0;
    this.data = data;
    if (mode === 'victory' && data.player) {
      // parte dall'angolo attuale cosi' la camera gira attorno al Titano senza attraversarlo
      const p = data.player.pos;
      this.orbit = Math.atan2(this.pos.x - p.x, this.pos.z - p.z) - 2.6;
    }
  }

  get yaw() {
    return Math.atan2(this.look.x - this.pos.x, this.look.z - this.pos.z);
  }

  snap() {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  update(dt, player, target) {
    this.time += dt;
    this.modeTime += dt;
    const desired = _a;
    const look = _b;
    let posLambda = 3.2;
    let lookLambda = 6;

    if (this.mode === 'intro' && this.data?.kaiju) {
      const k = this.data.kaiju;
      const ang = this.data.angle + this.modeTime * 0.12;
      const r = 26 + k.def.size * 8;
      desired.set(k.pos.x + Math.sin(ang) * r, 4 + this.modeTime * 1.2, k.pos.z + Math.cos(ang) * r);
      look.set(k.pos.x, Math.max(3, k.model.root.position.y + k.height * 0.55), k.pos.z);
      posLambda = 2;
      lookLambda = 4;
    } else if (this.mode === 'finisher' && this.data?.kaiju) {
      const k = this.data.kaiju;
      _c.set(k.pos.x - player.pos.x, 0, k.pos.z - player.pos.z);
      const len = _c.length() || 1;
      _c.divideScalar(len);
      const mid = _a.set((k.pos.x + player.pos.x) / 2, 0, (k.pos.z + player.pos.z) / 2);
      desired.set(mid.x + _c.z * 24, 5 + this.modeTime * 0.8, mid.z - _c.x * 24);
      look.set(k.pos.x * 0.6 + player.pos.x * 0.4, 6, k.pos.z * 0.6 + player.pos.z * 0.4);
      posLambda = 2.5;
    } else if (this.mode === 'victory') {
      this.orbit += dt * 0.25;
      const r = 17;
      desired.set(player.pos.x + Math.sin(this.orbit + 2.6) * r, 4.5, player.pos.z + Math.cos(this.orbit + 2.6) * r);
      look.set(player.pos.x, 6.5, player.pos.z);
      posLambda = 1.6;
    } else if (this.mode === 'defeat') {
      const f = _c.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      desired.set(player.pos.x + f.x * 14 + f.z * 6, 9, player.pos.z + f.z * 14 - f.x * 6);
      look.set(player.pos.x, 3, player.pos.z);
      posLambda = 1.4;
    } else {
      // segue il Titano mantenendo il Kaiju in vista
      let dir;
      let sep = 10;
      let th = 9;
      if (target) {
        dir = _c.set(player.pos.x - target.pos.x, 0, player.pos.z - target.pos.z);
        sep = dir.length();
        if (sep < 0.01) dir.set(0, 0, -1);
        else dir.divideScalar(sep);
        th = target.height;
      } else {
        dir = _c.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      }
      const back = 15 + clamp(sep * 0.25, 0, 10) + clamp(th - 10, 0, 6) * 0.7;
      const height = 8.6 + clamp(sep * 0.1, 0, 5) + clamp(th - 10, 0, 6) * 0.4;
      // quando i due colossi sono vicini la camera si sposta di lato per inquadrarli entrambi
      const side = 5.2 + clamp(15 - sep, 0, 10) * 0.55;
      desired.set(
        player.pos.x + dir.x * back + dir.z * side,
        height,
        player.pos.z + dir.z * back - dir.x * side,
      );
      if (target) {
        const ty = Math.max(3.5, target.height * 0.4);
        look.set(
          player.pos.x * 0.4 + target.pos.x * 0.6,
          4.5 * 0.4 + ty * 0.6,
          player.pos.z * 0.4 + target.pos.z * 0.6,
        );
      } else {
        look.set(player.pos.x - dir.x * 10, 5.5, player.pos.z - dir.z * 10);
      }
    }

    desired.y = Math.max(1.6, desired.y);
    this.pos.x = damp(this.pos.x, desired.x, posLambda, dt);
    this.pos.y = damp(this.pos.y, desired.y, posLambda, dt);
    this.pos.z = damp(this.pos.z, desired.z, posLambda, dt);
    // non entrare mai dentro il Titano
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    const minD = 9;
    if (d < minD && this.pos.y < player.height + 3) {
      const k = d > 0.01 ? minD / d : 1;
      this.pos.x = player.pos.x + (d > 0.01 ? dx : 1) * k;
      this.pos.z = player.pos.z + (d > 0.01 ? dz : 0) * k;
    }
    this.look.x = damp(this.look.x, look.x, lookLambda, dt);
    this.look.y = damp(this.look.y, look.y, lookLambda, dt);
    this.look.z = damp(this.look.z, look.z, lookLambda, dt);

    // tremolio della camera
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const t = this.time * 22;
    this.camera.position.set(this.pos.x + noise(t, 1) * s * 1.4, this.pos.y + noise(t, 2) * s * 1.1, this.pos.z + noise(t, 3) * s * 1.4);
    this.camera.lookAt(this.look);
    this.camera.rotation.z += noise(t, 4) * s * 0.04;

    this.fovKick = Math.max(0, this.fovKick - dt * 12);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
