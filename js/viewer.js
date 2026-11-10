// 单车 3D 展示：换车漆、开关门、内外视角。只在需要时重画（静止时画面不动）。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ease = k => k * k * (3 - 2 * k);

export function createViewer(canvas, car, onReady, onError) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 0.03, 300), ctl = new OrbitControls(cam, canvas);
  ctl.enablePan = false; ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.rotateSpeed = 0.7; ctl.zoomSpeed = 0.6;
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture; pm.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 8, 5); scene.add(key);

  let alive = true, dirty = true, paints = [], doors = [], open = 0, want = 0, fly = null, box = null, L = 4, H = 1.4, center = new THREE.Vector3(), inside = false, camNode = null;
  const mark = () => { dirty = true; };
  ctl.addEventListener('change', mark);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix(); mark();
  }
  function exterior() {
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const v = THREE.MathUtils.degToRad(cam.fov) / 2, hfov = Math.atan(Math.tan(v) * cam.aspect);
    const d = r / Math.sin(Math.min(v, hfov)) * (cam.aspect < 1 ? 0.98 : 0.92);
    const dir = new THREE.Vector3(0.72, 0.3, 0.78).normalize();
    return { p: center.clone().addScaledVector(dir, d), q: center.clone().setY(box.min.y + H * 0.42) };
  }
  function interior() {
    if (camNode) { const p = camNode.getWorldPosition(new THREE.Vector3()), f = new THREE.Vector3(1, 0, 0).applyQuaternion(camNode.getWorldQuaternion(new THREE.Quaternion())); return { p, q: p.clone().addScaledVector(f, 0.4) }; }
    const p = new THREE.Vector3(center.x - L * 0.06, box.min.y + H * 0.7, center.z);
    return { p, q: p.clone().add(new THREE.Vector3(0.4, -0.06, 0)) };
  }
  function go(v, ms = 900) { fly = { p0: cam.position.clone(), q0: ctl.target.clone(), p: v.p, q: v.q, t0: performance.now(), ms }; }
  function limits() { ctl.minDistance = inside ? 0.05 : L * 0.45; ctl.maxDistance = inside ? 0.8 : L * 4; ctl.maxPolarAngle = inside ? Math.PI * 0.8 : Math.PI * 0.495; }

  function poseDoors() {
    const k = ease(open);
    for (const d of doors) {
      if (d.slide) d.node.position.copy(d.pos).addScaledVector(d.slide, k);
      else d.node.quaternion.copy(d.quat).multiply(new THREE.Quaternion().setFromAxisAngle(d.axis, d.angle * k));
    }
  }

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(car.model.file, g => {
    if (!alive) return;
    const root = g.scene; scene.add(root); root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root); box.getCenter(center);
    L = Math.max(box.max.x - box.min.x, box.max.z - box.min.z); H = box.max.y - box.min.y;
    const seen = new Map();
    root.traverse(o => {
      if (o.name === 'cam_interior') camNode = o;
      if (o.isMesh) {
        const fix = m => {
          if (!/^paint/i.test(m.name)) return m;
          if (!seen.has(m)) { const p = new THREE.MeshPhysicalMaterial({ name: m.name, color: m.color, metalness: 0.55, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1, side: m.side }); seen.set(m, p); paints.push(p); }
          return seen.get(m);
        };
        o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
      }
      if (/^door_/.test(o.name)) {
        const u = o.userData || {}, wp = o.getWorldPosition(new THREE.Vector3()), side = wp.z >= center.z ? 1 : -1;
        doors.push({ node: o, quat: o.quaternion.clone(), pos: o.position.clone(), slide: u.slide ? new THREE.Vector3(...u.slide) : null,
          axis: new THREE.Vector3(...(u.axis || [0, 1, 0])).normalize(), angle: u.angle ?? side * 1.12 });
      }
    });
    // 地面柔和阴影
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(sx * 1.5, sz * 2.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(center.x, box.min.y + 0.004, center.z); scene.add(sh);
    resize(); const e = exterior(); cam.position.copy(e.p); ctl.target.copy(e.q); limits(); ctl.update();
    R.render(scene, cam); dirty = false; onReady && onReady();
  }, undefined, err => { onError && onError(err); });

  function loop(now) {
    if (!alive) return; requestAnimationFrame(loop);
    if (open !== want) { open += Math.sign(want - open) * Math.min(Math.abs(want - open), 1 / 60 / 1.1); poseDoors(); mark(); }
    if (fly) {
      const k = Math.min(1, (now - fly.t0) / fly.ms), s = ease(k);
      cam.position.lerpVectors(fly.p0, fly.p, s); ctl.target.lerpVectors(fly.q0, fly.q, s);
      if (k >= 1) { fly = null; limits(); }
      ctl.enableDamping = false; ctl.update(); ctl.enableDamping = true; mark();
    } else ctl.update();
    if (dirty && box) { dirty = false; R.render(scene, cam); }
  }
  requestAnimationFrame(loop);
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  return {
    setColor(hex) { paints.forEach(m => m.color.set(hex)); mark(); },
    setDoors(v) { want = v ? 1 : 0; },
    view(name) { if (!box) return; inside = name === 'interior'; ctl.minDistance = 0; ctl.maxDistance = Infinity; ctl.maxPolarAngle = Math.PI; go(inside ? interior() : exterior()); },
    mark,
    dispose() { alive = false; ro.disconnect(); ctl.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); R.dispose(); },
  };
}
