"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MuscleId, VolumeLevel } from "@/lib/fitness/muscles";
import { LEVEL_COLORS } from "./body-3d-colors";

const BODY_COLOR = "#ececE8";
const SELECTED_COLOR = "#0e0e0e";

type Part = { muscle?: MuscleId; shape: "ellipsoid" | "capsule"; size: [number, number, number]; at: [number, number, number] };

// Stylised mannequin, metres-ish, y up, facing +z. Paired parts are mirrored on x.
const BODY: Part[] = [
  { shape: "ellipsoid", size: [0.105, 0.125, 0.11], at: [0, 1.67, 0] }, // head
  { shape: "capsule", size: [0.05, 0.08, 0], at: [0, 1.53, 0] }, // neck
  { shape: "ellipsoid", size: [0.205, 0.29, 0.115], at: [0, 1.23, 0] }, // torso
  { shape: "ellipsoid", size: [0.17, 0.12, 0.11], at: [0, 0.92, 0] }, // pelvis
  { shape: "capsule", size: [0.05, 0.22, 0], at: [0.27, 1.3, 0] }, // upper arm
  { shape: "capsule", size: [0.042, 0.2, 0], at: [0.29, 1.0, 0] }, // forearm
  { shape: "ellipsoid", size: [0.04, 0.055, 0.03], at: [0.3, 0.83, 0] }, // hand
  { shape: "capsule", size: [0.085, 0.3, 0], at: [0.1, 0.65, 0] }, // thigh
  { shape: "capsule", size: [0.06, 0.3, 0], at: [0.1, 0.28, 0] }, // shin
  { shape: "ellipsoid", size: [0.05, 0.03, 0.1], at: [0.1, 0.04, 0.04] }, // foot
];

const MUSCLE_PARTS: Part[] = [
  { muscle: "pecho", shape: "ellipsoid", size: [0.1, 0.058, 0.026], at: [0.07, 1.37, 0.09] },
  { muscle: "abdomen", shape: "ellipsoid", size: [0.085, 0.13, 0.03], at: [0, 1.12, 0.093] },
  { muscle: "hombros", shape: "ellipsoid", size: [0.066, 0.06, 0.066], at: [0.235, 1.45, 0] },
  { muscle: "biceps", shape: "ellipsoid", size: [0.04, 0.085, 0.03], at: [0.27, 1.3, 0.026] },
  { muscle: "triceps", shape: "ellipsoid", size: [0.04, 0.09, 0.03], at: [0.27, 1.3, -0.026] },
  { muscle: "antebrazos", shape: "ellipsoid", size: [0.04, 0.09, 0.04], at: [0.29, 1.02, 0] },
  { muscle: "trapecio", shape: "ellipsoid", size: [0.12, 0.06, 0.035], at: [0, 1.46, -0.065] },
  { muscle: "espalda", shape: "ellipsoid", size: [0.075, 0.14, 0.032], at: [0.095, 1.25, -0.085] },
  { muscle: "lumbares", shape: "ellipsoid", size: [0.08, 0.065, 0.03], at: [0, 1.04, -0.092] },
  { muscle: "gluteos", shape: "ellipsoid", size: [0.08, 0.08, 0.055], at: [0.075, 0.9, -0.07] },
  { muscle: "cuadriceps", shape: "ellipsoid", size: [0.068, 0.15, 0.04], at: [0.1, 0.67, 0.05] },
  { muscle: "isquios", shape: "ellipsoid", size: [0.064, 0.14, 0.04], at: [0.1, 0.67, -0.05] },
  { muscle: "gemelos", shape: "ellipsoid", size: [0.05, 0.1, 0.045], at: [0.1, 0.33, -0.03] },
];

function geometry(p: Part): THREE.BufferGeometry {
  if (p.shape === "capsule") return new THREE.CapsuleGeometry(p.size[0], p.size[1], 8, 20);
  const g = new THREE.SphereGeometry(1, 40, 24);
  g.scale(...p.size);
  return g;
}

/** Every part, with its mirror twin when it is off the centre line. */
function expand(parts: Part[]): Part[] {
  return parts.flatMap((p) => (p.at[0] === 0 ? [p] : [p, { ...p, at: [-p.at[0], p.at[1], p.at[2]] as [number, number, number] }]));
}

const CAMERA_DISTANCE = 3.65;
const TARGET = new THREE.Vector3(0, 0.88, 0);

/**
 * Rotatable 3D body, each muscle group coloured by its weekly sets. Drag to
 * turn it; tap a muscle to select it. Decorative for screen readers: the list
 * next to it carries the same data.
 */
export function Body3D({
  levels,
  selected,
  onSelect,
}: {
  levels: Record<MuscleId, VolumeLevel>;
  selected: MuscleId | null;
  onSelect: (id: MuscleId | null) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const meshes = useRef(new Map<MuscleId, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]>());
  const view = useRef<((side: "front" | "back") => void) | null>(null);
  const select = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL (old device, disabled): the list still shows everything. Deferred so it isn't a sync setState.
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.0, CAMERA_DISTANCE);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbdbdb8, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 2.5, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-1.5, 1.5, -2);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.85 });
    for (const p of expand(BODY)) {
      const mesh = new THREE.Mesh(geometry(p), bodyMaterial);
      mesh.position.set(...p.at);
      group.add(mesh);
    }
    const map = new Map<MuscleId, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]>();
    for (const p of expand(MUSCLE_PARTS)) {
      const mesh = new THREE.Mesh(geometry(p), new THREE.MeshStandardMaterial({ color: LEVEL_COLORS[0], roughness: 0.6 }));
      mesh.position.set(...p.at);
      mesh.userData.muscle = p.muscle;
      group.add(mesh);
      map.set(p.muscle!, [...(map.get(p.muscle!) ?? []), mesh]);
    }
    meshes.current = map;
    const pickable = [...map.values()].flat();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.62;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 1.4;
    controls.addEventListener("start", () => (controls.autoRotate = false));
    controls.update();

    view.current = (side) => {
      controls.autoRotate = false;
      const y = camera.position.y;
      camera.position.set(0, y, side === "front" ? CAMERA_DISTANCE : -CAMERA_DISTANCE);
      controls.update();
    };

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    // A tap (not a drag) selects the muscle under the pointer, or clears the selection.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const hit = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return (raycaster.intersectObjects(pickable)[0]?.object.userData.muscle as MuscleId | undefined) ?? null;
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) select.current(hit(e));
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      renderer.domElement.style.cursor = hit(e) ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    let frame = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      meshes.current = new Map();
      view.current = null;
    };
  }, []);

  // Colours follow the data and the selection without rebuilding the scene.
  useEffect(() => {
    for (const [id, list] of meshes.current) {
      const color = id === selected ? SELECTED_COLOR : LEVEL_COLORS[levels[id] ?? 0];
      for (const mesh of list) mesh.material.color.set(color);
    }
  }, [levels, selected]);

  if (failed) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[14px] text-neutral-500">
        Tu navegador no puede mostrar el cuerpo en 3D. Tienes los mismos datos en la lista.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mount} aria-hidden className="absolute inset-0" />
      <div className="absolute right-3 bottom-3 flex gap-1 rounded-full bg-step p-1">
        {(["front", "back"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => view.current?.(side)}
            className="rounded-full px-3 py-[5px] text-[12.5px] font-medium text-neutral-300 transition-colors hover:bg-surface"
          >
            {side === "front" ? "Frente" : "Espalda"}
          </button>
        ))}
      </div>
    </div>
  );
}
