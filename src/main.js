import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===================== THREE.JS PARTICLE FIELD ===================== */

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

const PARTICLE_COUNT = reduceMotion ? 0 : 3600;
const positions = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const seeds = new Float32Array(PARTICLE_COUNT);

const magenta = new THREE.Color(0xff3d81);
const cyan = new THREE.Color(0x38e1ff);
const mixed = new THREE.Color();

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Flattened disc volume so the field reads as an atmosphere, not a sphere.
  const radius = 5 + Math.random() * 5.5;
  const angle = Math.random() * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const y = (Math.random() - 0.5) * 6;
  const z = Math.sin(angle) * radius - 3;

  basePositions[i * 3] = x;
  basePositions[i * 3 + 1] = y;
  basePositions[i * 3 + 2] = z;
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  seeds[i] = Math.random() * Math.PI * 2;

  mixed.copy(magenta).lerp(cyan, Math.random());
  colors[i * 3] = mixed.r;
  colors[i * 3 + 1] = mixed.g;
  colors[i * 3 + 2] = mixed.b;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 2.4,
  sizeAttenuation: false,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

/* ===================== HERO PRODUCT OBJECT ===================== */
/* A single dramatically-lit "ad card" as the hero's subject, echoing the
   product-render treatment from the reference (one object, studio light,
   dark ground) rather than pure ambient particles. */

const cardGroup = new THREE.Group();
cardGroup.position.set(2.2, 0, -1);
scene.add(cardGroup);

const cardBody = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 3.2, 0.08, 4, 4, 1),
  new THREE.MeshPhysicalMaterial({
    color: 0x0d0d10,
    metalness: 0.6,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  })
);
cardGroup.add(cardBody);

function makeScreenTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 683;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#ff3d81");
  grad.addColorStop(1, "#38e1ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(0, (c.height / 40) * i, c.width, c.height / 80);
  }
  return new THREE.CanvasTexture(c);
}

const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(2.08, 2.88),
  new THREE.MeshBasicMaterial({ map: makeScreenTexture(), toneMapped: false })
);
screen.position.set(0, 0, 0.045);
cardGroup.add(screen);

const keyLight = new THREE.PointLight(0xff3d81, 40, 20, 2);
keyLight.position.set(-4, 3, 4);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x38e1ff, 30, 20, 2);
rimLight.position.set(5, -2, -3);
scene.add(rimLight);

scene.add(new THREE.AmbientLight(0x1a1a1f, 1.2));

/* Pointer tracking, projected onto the particle field's depth plane. */
const pointer = new THREE.Vector2(-10, -10);
const pointerWorld = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 3);

window.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

const clock = new THREE.Clock();
const scrollState = { progress: 0 };

function animate() {
  const t = clock.getElapsedTime();

  if (PARTICLE_COUNT > 0) {
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(dragPlane, pointerWorld);

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const bx = basePositions[ix];
      const by = basePositions[ix + 1];
      const bz = basePositions[ix + 2];

      // Gentle ambient drift, unique per particle via its seed.
      const drift = Math.sin(t * 0.4 + seeds[i]) * 0.18;

      let px = bx;
      let py = by + drift;
      let pz = bz;

      // Repel particles near the pointer's projected world position.
      const dx = px - pointerWorld.x;
      const dy = py - pointerWorld.y;
      const dist = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - dist / 2.6);
      if (influence > 0) {
        const push = influence * influence * 1.4;
        px += (dx / (dist || 1)) * push;
        py += (dy / (dist || 1)) * push;
      }

      posAttr.array[ix] = px;
      posAttr.array[ix + 1] = py;
      posAttr.array[ix + 2] = pz;
    }
    posAttr.needsUpdate = true;

    points.rotation.y = t * 0.02 + scrollState.progress * 0.6;
  }

  if (!reduceMotion) {
    const tiltX = THREE.MathUtils.clamp(pointer.x, -1, 1);
    const tiltY = THREE.MathUtils.clamp(pointer.y, -1, 1);
    cardGroup.rotation.y = Math.sin(t * 0.35) * 0.35 + tiltX * 0.25;
    cardGroup.rotation.x = tiltY * -0.12;
  }
  cardGroup.position.y = -scrollState.progress * 3.5;
  cardGroup.visible = scrollState.progress < 0.35;

  camera.position.z = 9 - scrollState.progress * 2.5;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

/* Tie the field's depth/rotation to overall page scroll for continuity
   between the hero and the sections that scroll over it. */
ScrollTrigger.create({
  trigger: document.body,
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => {
    scrollState.progress = self.progress;
  },
});

/* ===================== GSAP ENTRANCE + SCROLL REVEALS ===================== */

const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
heroTl
  .to(".eyebrow", { opacity: 1, y: 0, duration: 0.7 }, 0.1)
  .to(".title", { opacity: 1, duration: 1.1 }, 0.25)
  .to(".hero-copy", { opacity: 1, duration: 0.9 }, 0.6)
  .to(".hint", { opacity: 1, duration: 0.8 }, 1.1);

gsap.utils.toArray(".panel").forEach((panel, i) => {
  gsap.to(panel, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    delay: i * 0.06,
    ease: "power3.out",
    scrollTrigger: {
      trigger: panel,
      start: "top 88%",
    },
  });
});

/* ===================== SCROLL DATA STORY ===================== */

const storyPath = document.getElementById("storyPathDrawn");
const storyLength = storyPath.getTotalLength();
storyPath.style.strokeDasharray = `${storyLength}`;
storyPath.style.strokeDashoffset = `${storyLength}`;

const storyNumberEl = document.getElementById("storyNumber");
const STORY_TARGET = 42800;
const storyCounter = { value: 0 };

gsap.timeline({
  scrollTrigger: {
    trigger: ".data-story",
    start: "top top",
    end: "+=120%",
    scrub: 0.6,
    pin: true,
  },
})
  .to(storyPath, { strokeDashoffset: 0, ease: "none" }, 0)
  .to(
    "#storyMarker",
    {
      motionPath: {
        path: "#storyPath",
        align: "#storyPath",
        alignOrigin: [0.5, 0.5],
      },
      ease: "none",
    },
    0
  )
  .to(
    storyCounter,
    {
      value: STORY_TARGET,
      ease: "none",
      onUpdate: () => {
        storyNumberEl.textContent = Math.round(storyCounter.value).toLocaleString("en-US");
      },
    },
    0
  );

gsap.to(".manifesto-text", {
  opacity: 1,
  duration: 1.2,
  ease: "power2.out",
  scrollTrigger: {
    trigger: ".manifesto",
    start: "top 70%",
  },
});

gsap.set(".manifesto-text", { opacity: 0 });

gsap.to(".cta-title, .cta-btn", {
  opacity: 1,
  y: 0,
  duration: 1,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".cta",
    start: "top 75%",
  },
});

gsap.set(".cta-title, .cta-btn", { opacity: 0, y: 20 });

/*
 * Higgsfield integration point: once a generated cinematic loop exists for
 * the hero (or per capability row), swap the relevant particle pass for a
 * <video> plane rendered as a Three.js texture here, rather than placing it
 * as a flat rectangular <video> element in the DOM.
 */
