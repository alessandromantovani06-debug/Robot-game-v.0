// Telecamera 2D: segue lo scontro, zooma per inquadrare entrambi i combattenti e trema sui colpi.
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

function noise(t, s) {
  return Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 1.1) * 0.2;
}

export class Camera2D {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.viewH = 24;
    this.groundFrac = 0.8;
    this.trauma = 0;
    this.time = 0;
    this.sx = 0;
    this.sy = 0;
    this.rot = 0;
    this.target = { x: 0, y: 0, viewH: 24 };
    this.lambda = 3;
  }

  ppu(H) {
    return H / this.viewH;
  }

  toScreen(wx, wy, W, H) {
    const k = H / this.viewH;
    return [W / 2 + (wx - this.x) * k + this.sx, H * this.groundFrac - (wy - this.y) * k + this.sy];
  }

  /** Matrice per disegnare un oggetto in (wx, wy), con unita' di gioco e y verso il basso. */
  base(wx, wy, W, H, sx = 1, sy = 1) {
    const k = H / this.viewH;
    const [px, py] = this.toScreen(wx, wy, W, H);
    return [k * sx, 0, 0, k * sy, px, py];
  }

  shake(a) {
    this.trauma = Math.min(1.1, this.trauma + a);
  }

  set(x, y, viewH) {
    this.target.x = this.x = x;
    this.target.y = this.y = y;
    this.target.viewH = this.viewH = viewH;
  }

  update(dt) {
    this.time += dt;
    this.x = damp(this.x, this.target.x, this.lambda, dt);
    this.y = damp(this.y, this.target.y, this.lambda, dt);
    this.viewH = damp(this.viewH, this.target.viewH, this.lambda * 0.8, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const s = this.trauma * this.trauma;
    const t = this.time * 24;
    this.shakeAmt = s;
    this.sx = noise(t, 1) * s * 22;
    this.sy = noise(t, 2) * s * 16;
  }
}
