/**
 * MindMapScreen
 * 3D visual representation of thought categories using Three.js
 * Camera always focuses on center; supports rotation and zoom only.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal,
  FlatList, Pressable, TouchableWithoutFeedback, SafeAreaView
} from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

import { ScreenContainer, AppHeader } from '../../components/layout';
import { LoadingSpinner } from '../../components/common';
import { getActiveCategories } from '../../repos/categoriesRepo';
import { getThoughtsByActiveCategory } from '../../repos/thoughtItemsRepo';
import type { ThoughtCategory } from '../../types/models';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_SIZE = SCREEN_WIDTH - 40;

// Performance tuning
const TARGET_FPS = 30;
const MIN_FRAME_INTERVAL = 1000 / TARGET_FPS;
const LABEL_UPDATE_INTERVAL = 60; // ms, ~16fps label updates for smoothness
const NODE_OUTLINE_SCALE = 1.08;
const MAX_VISIBLE_LABELS = 7;
const LABEL_MIN_GAP = 42;
const STAR_COUNT = 900;
const NEBULA_LAYER_COUNT = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MindMapNode3D {
  id: string;
  label: string;
  color: string;
  position: THREE.Vector3;
  size: number;
  connections: string[];
  orbitRadius?: number;
  orbitAngle?: number;
  orbitInclination?: number;
}

interface LabelData {
  id: string;
  label: string;
  screen: { x: number; y: number };
  fontSize: number;
  opacity: number;
  isCenter: boolean;
  width: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexToThreeColor = (hex: string) => new THREE.Color(hex);

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / n);
    const phi = (2 * Math.PI * i) / goldenRatio;
    points.push(new THREE.Vector3(
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(phi),
    ));
  }
  return points;
}

function generateNodes3D(categories: ThoughtCategory[]): MindMapNode3D[] {
  if (categories.length === 0) return [];
  const counts = categories.map(c => c.thoughtCount);
  const maxThoughts = Math.max(...counts, 1);
  // find top and second-top counts
  const sortedCounts = [...counts].sort((a, b) => b - a);
  const topCount = sortedCounts[0] ?? 0;
  // find the highest count strictly less than topCount (handles ties)
  const secondCount = sortedCounts.find(c => c < topCount) ?? topCount;

  // Desired size rule: top size = 2x second-top size
  // We'll compute a base size from the 2nd place and make top = 2*base.
  const MIN_SIZE = 0.12;
  const MAX_SIZE = 0.6;

  // Choose a sensible base for the second place relative to overall distribution
  // Map counts -> preliminary weights then derive sizes
  const baseForSecond = Math.max(1, secondCount);

  // precompute unit sizes for each category based on count, but enforce ratio
  const unitSizes = categories.map(cat => ({ id: cat.id, count: cat.thoughtCount, unit: Math.max(1, cat.thoughtCount) }));

  // compute size for second place (as reference)
  const secondSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, 0.18 + (baseForSecond / maxThoughts) * 0.28));
  const topSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, secondSize * 2));

  // positions on a unit sphere; we'll scale per-node radius later
  const positions = fibonacciSphere(categories.length, 1.0);

  const centerNode: MindMapNode3D = {
    id: 'center',
    label: '',
    color: '#FDB813',
    position: new THREE.Vector3(0, 0, 0),
    size: 0.62,
    connections: categories.map(c => c.id),
  };

  // Determine per-category size and radius scaling
  // We'll assign the top category explicitly to topSize, second to secondSize,
  // and interpolate others between MIN_SIZE and MAX_SIZE proportional to count.
  // Group categories by identical thoughtCount so they share orbit radii
  const groupsByCount = new Map<number, ThoughtCategory[]>();
  for (const cat of categories) {
    const arr = groupsByCount.get(cat.thoughtCount) || [];
    arr.push(cat);
    groupsByCount.set(cat.thoughtCount, arr);
  }

  const uniqueCounts = Array.from(groupsByCount.keys()).sort((a, b) => b - a); // descending
  const groupCount = uniqueCounts.length;

  // orbit range
  const innerOrbit = 1.8; // closest orbit radius (for highest counts)
  const outerOrbit = 4.2; // farthest orbit radius (for lowest counts)

  // precompute per-category orbitAngle and orbitRadius
  const orbitRadiusByCount = new Map<number, number>();
  const orbitAnglesById = new Map<string, number>();
  const inclinationById = new Map<string, number>();

  uniqueCounts.forEach((count, gi) => {
    const group = groupsByCount.get(count) || [];
    const radius = groupCount > 1 ? innerOrbit + (gi / (groupCount - 1)) * (outerOrbit - innerOrbit) : (innerOrbit + outerOrbit) / 2;
    orbitRadiusByCount.set(count, radius);
    const offset = hashStringToUnit(String(count) + ':offset') * Math.PI * 2;
    for (let j = 0; j < group.length; j++) {
      const cat = group[j];
      const angle = offset + (j / group.length) * Math.PI * 2;
      orbitAnglesById.set(cat.id, angle);
      inclinationById.set(cat.id, (hashStringToUnit(cat.id + ':inc') - 0.5) * 0.18);
    }
  });

  const categoryNodes: MindMapNode3D[] = categories.map((cat, i) => {
    // base size scaled from count
    let size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, 0.18 + (cat.thoughtCount / maxThoughts) * 0.28));

    // if this category has the max count (ties allowed), use topSize
    if (cat.thoughtCount === topCount) size = topSize;
    else if (cat.thoughtCount === secondCount) size = secondSize;

    const nodeRadius = orbitRadiusByCount.get(cat.thoughtCount) ?? ((innerOrbit + outerOrbit) / 2);
    const angle = orbitAnglesById.get(cat.id) ?? (hashStringToUnit(cat.id + ':angle') * Math.PI * 2);
    const inclination = inclinationById.get(cat.id) ?? ((hashStringToUnit(cat.id + ':inc') - 0.5) * 0.18);

    const pos = new THREE.Vector3(Math.cos(angle) * nodeRadius, Math.sin(inclination) * 0.12, Math.sin(angle) * nodeRadius);

    return {
      id: cat.id,
      label: cat.name,
      color: cat.color,
      position: pos,
      orbitRadius: nodeRadius,
      orbitAngle: angle,
      orbitInclination: inclination,
      size,
      connections: ['center'],
    } as MindMapNode3D;
  });

  return [centerNode, ...categoryNodes];
}

function project(
  pos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): { x: number; y: number } {
  const v = pos.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (1 - (v.y * 0.5 + 0.5)) * height,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#5B8A72', '#89A4C7', '#B8A9C9', '#D4B896',
  '#C4A484', '#A8D5BA', '#F4A261', '#E76F51',
  '#2A9D8F', '#264653',
];
const CATEGORY_ICONS = ['💼', '❤️', '🏥', '🌱', '😰', '🎯', '🌟', '💡', '🎨', '🔮'];

// ─── 3D Visualization ─────────────────────────────────────────────────────────

function MindMapVisualization3D({
  nodes,
  onCategoryTap,
  resetSignal,
}: {
  nodes: MindMapNode3D[];
  onCategoryTap: (id: string) => void;
  resetSignal?: number;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [labels, setLabels] = useState<LabelData[]>([]);

  const currentWidth  = isFullscreen ? SCREEN_WIDTH  : CHART_SIZE;
  const currentHeight = isFullscreen ? SCREEN_HEIGHT : CHART_SIZE;

  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const frameId     = useRef<number | null>(null);
  const glRef       = useRef<any>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastLabelUpdateRef = useRef<number>(0);

  const spherical    = useRef({ theta: 0.4, phi: 1.1, radius: 12.0 });
  const lastTouch    = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const buildScene = useCallback(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x030712);

    scene.children
      .filter(c => c.userData.removable)
      .forEach(c => {
        // @ts-ignore
        if (c.geometry) c.geometry.dispose();
        // @ts-ignore
        if (c.material) {
          // @ts-ignore
          if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose && m.dispose());
          // @ts-ignore
          else if (c.material.dispose) c.material.dispose();
        }
        scene.remove(c);
      });

    // We'll create orbiting node pivots below; per-node lines (orbit connectors)
    // will be attached to each pivot so they rotate with the node.

    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 34 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    stars.userData.removable = true;
    scene.add(stars);

    for (let i = 0; i < NEBULA_LAYER_COUNT; i++) {
      const nebulaGeo = new THREE.SphereGeometry(30 + i * 4, 28, 28);
      const nebulaMat = new THREE.ShaderMaterial({
        uniforms: {
          uSeed: { value: 1.7 + i * 1.9 },
          uTintA: { value: new THREE.Color(i === 0 ? '#5D6BD6' : '#9D4EDD') },
          uTintB: { value: new THREE.Color(i === 0 ? '#2EC4B6' : '#FF6B6B') },
          uAlpha: { value: i === 0 ? 0.09 : 0.06 },
        },
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorldPos = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vWorldPos;
          uniform float uSeed;
          uniform vec3 uTintA;
          uniform vec3 uTintB;
          uniform float uAlpha;

          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(17.17, 41.31, 83.97))) * 43758.5453);
          }

          float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n000 = hash(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash(i + vec3(1.0, 1.0, 1.0));
            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            float nxy0 = mix(nx00, nx10, f.y);
            float nxy1 = mix(nx01, nx11, f.y);
            return mix(nxy0, nxy1, f.z);
          }

          void main() {
            vec3 p = normalize(vWorldPos) * (2.8 + uSeed);
            float n1 = noise(p * 1.2 + vec3(uSeed));
            float n2 = noise(p * 2.7 - vec3(uSeed * 0.7));
            float cloud = smoothstep(0.45, 0.86, n1 * 0.75 + n2 * 0.45);
            vec3 col = mix(uTintA, uTintB, n2);
            gl_FragColor = vec4(col, cloud * uAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
      nebula.userData.removable = true;
      scene.add(nebula);
    }

    // Prepare a node map for runtime access (pivot/mesh lookup)
    scene.userData.nodeMap = {};

    // Create dashed orbit rings for each distinct orbit radius (visual guides)
    const orbitGroups = new Map<number, number[]>();
    for (const n of nodes) {
      if (n.id === 'center') continue;
      const r = n.orbitRadius ?? n.position.length();
      const inc = n.orbitInclination ?? 0;
      const arr = orbitGroups.get(r) || [];
      arr.push(inc);
      orbitGroups.set(r, arr);
    }

    orbitGroups.forEach((incs, radius) => {
      const avgInc = incs.reduce((a, b) => a + b, 0) / Math.max(1, incs.length);
      const segments = 160;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= segments; s++) {
        const t = (s / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const ringMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.12, gapSize: 0.08, opacity: 0.22, transparent: true });
      const ring = new THREE.Line(ringGeo, ringMat);
      ring.computeLineDistances();
      ring.rotation.x = avgInc;
      ring.userData.removable = true;
      scene.add(ring);
    });

    nodes.forEach(node => {
      if (node.id === 'center') {
        const sunGeo = new THREE.SphereGeometry(node.size, 28, 28);
        const sunMat = new THREE.MeshPhongMaterial({
          color: 0xffc857,
          emissive: 0xff7b1f,
          emissiveIntensity: 0.9,
          shininess: 8,
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.position.copy(node.position);
        sunMesh.userData.removable = true;
        sunMesh.userData.nodeId = node.id;
        scene.add(sunMesh);

        const hotCoreMat = new THREE.MeshBasicMaterial({
          color: 0xfff1a8,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
        });
        const hotCore = new THREE.Mesh(sunGeo, hotCoreMat);
        hotCore.position.copy(node.position);
        hotCore.scale.setScalar(1.04);
        hotCore.userData.removable = true;
        scene.add(hotCore);

        const coronaMat = new THREE.MeshBasicMaterial({
          color: 0xff9e2f,
          transparent: true,
          opacity: 0.2,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
        });
        const corona = new THREE.Mesh(sunGeo, coronaMat);
        corona.position.copy(node.position);
        corona.scale.setScalar(1.34);
        corona.userData.removable = true;
        scene.add(corona);

        const sunLight = new THREE.PointLight(0xffc36b, 0.85, 24);
        sunLight.position.copy(node.position);
        sunLight.userData.removable = true;
        scene.add(sunLight);
        return;
      }

      // Create a pivot so the node can orbit around the center
      const pivot = new THREE.Object3D();
      pivot.userData.removable = true;
      pivot.userData.nodeId = node.id;

      // Use precomputed orbit angle/radius/inclination when available
      const inclination = node.orbitInclination ?? (hashStringToUnit(node.id + ':orbit') - 0.5) * 0.18;
      const startAngle = node.orbitAngle ?? hashStringToUnit(node.id + ':orbit') * Math.PI * 2;
      const orbitRadius = node.orbitRadius ?? node.position.length();

      pivot.rotation.x = inclination;
      pivot.rotation.y = startAngle;

      const planetType = Math.floor(hashStringToUnit(node.id) * 4);
      const geo = new THREE.SphereGeometry(node.size, 16, 16);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: hexToThreeColor(node.color) },
          uSeed: { value: hashStringToUnit(node.id + ':seed') * 10 },
          uType: { value: planetType },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalW;
          void main() {
            vUv = uv;
            vNormalW = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vUv;
          varying vec3 vNormalW;
          uniform vec3 uColor;
          uniform float uSeed;
          uniform float uType;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }

          void main() {
            vec3 base = uColor;
            float n = noise(vUv * 10.0 + vec2(uSeed, uSeed * 0.37));
            float craterMask = smoothstep(0.75, 0.95, n);
            float bandSoft = sin((vUv.y + uSeed * 0.07) * 18.0) * 0.5 + 0.5;
            float bandStrong = sin((vUv.y + uSeed * 0.05) * 42.0) * 0.5 + 0.5;

            vec3 shadeA = base * 0.58;
            vec3 shadeB = base * 1.2;
            vec3 planet = mix(shadeA, shadeB, bandSoft * 0.65 + craterMask * 0.35);

            // 0 = rocky, 1 = gas giant, 2 = ice, 3 = lava
            if (uType < 0.5) {
              vec3 rockTint = mix(vec3(0.44, 0.40, 0.36), base, 0.45);
              planet = mix(rockTint * 0.7, rockTint * 1.2, n);
              planet += vec3(0.09, 0.07, 0.05) * craterMask;
            } else if (uType < 1.5) {
              vec3 gasA = mix(base, vec3(0.97, 0.78, 0.52), 0.28);
              vec3 gasB = mix(base, vec3(0.63, 0.48, 0.34), 0.52);
              float storms = noise(vUv * 22.0 + vec2(uSeed * 0.5, uSeed * 1.1));
              float gasMix = bandStrong * 0.82 + storms * 0.18;
              planet = mix(gasB, gasA, gasMix);
            } else if (uType < 2.5) {
              vec3 iceA = mix(vec3(0.72, 0.9, 1.0), base, 0.35);
              vec3 iceB = mix(vec3(0.54, 0.75, 0.95), base, 0.55);
              float cracks = noise(vUv * 28.0 + vec2(uSeed * 1.7, uSeed * 0.9));
              planet = mix(iceA, iceB, cracks);
              planet += vec3(0.12, 0.2, 0.28) * smoothstep(0.74, 0.94, cracks);
            } else {
              vec3 lavaRock = mix(base * 0.22, vec3(0.11, 0.09, 0.08), 0.6);
              float lava = smoothstep(0.78, 0.95, noise(vUv * 24.0 + vec2(uSeed * 2.1, uSeed)));
              vec3 lavaGlow = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.7, 0.1), bandSoft);
              planet = lavaRock + lavaGlow * lava * 0.95;
            }

            vec3 lightDir = normalize(vec3(0.35, 0.5, 1.0));
            float lightTerm = max(dot(normalize(vNormalW), lightDir), 0.0);
            float rim = pow(1.0 - max(dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

            vec3 color = planet * (0.35 + lightTerm * 0.9);
            color += base * rim * 0.22;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(orbitRadius, 0, 0);
      mesh.userData.removable = true;
      mesh.userData.nodeId    = node.id;
      pivot.add(mesh);

      // connector lines removed per request — orbit rings provide visual guides

      // atmosphere and other visuals should follow the mesh; place atmosphere at same local position

      const atmosphereMat = new THREE.MeshBasicMaterial({
        color: hexToThreeColor(node.color),
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const atmosphereMesh = new THREE.Mesh(geo, atmosphereMat);
      atmosphereMesh.position.set(orbitRadius, 0, 0);
      atmosphereMesh.scale.multiplyScalar(NODE_OUTLINE_SCALE);
      atmosphereMesh.userData.removable = true;
      pivot.add(atmosphereMesh);

      // add pivot to scene and register in nodeMap
      scene.add(pivot);
      scene.userData.nodeMap[node.id] = { pivot, mesh };
    });
  }, [nodes]);

  const onContextCreate = useCallback((gl: any) => {
    if (frameId.current) cancelAnimationFrame(frameId.current);
    glRef.current = gl;

    const renderer = new Renderer({ gl });
    // IMPORTANT: Set size to physical pixels (drawing buffer) to fill the screen correctly
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x030712, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.add(new THREE.AmbientLight(0x7a89a8, 0.48));
    const dir = new THREE.DirectionalLight(0xdde6ff, 0.9);
    dir.position.set(6, 5, 7);
    scene.add(dir);
    const fill = new THREE.PointLight(0x6ab7ff, 0.35, 30);
    fill.position.set(-5, -2, -6);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(55, currentWidth / currentHeight, 0.1, 100);
    cameraRef.current = camera;

    buildScene();

    const render = () => {
      frameId.current = requestAnimationFrame(render);
      if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;

      const now = Date.now();
      if (now - lastFrameTimeRef.current < MIN_FRAME_INTERVAL) return;
      lastFrameTimeRef.current = now;

      const { theta, phi, radius } = spherical.current;
      cameraRef.current.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
      cameraRef.current.lookAt(0, 0, 0);

      // rotate pivots to animate orbits
      try {
        const map = sceneRef.current.userData.nodeMap || {};
        const keys = Object.keys(map);
        for (let k = 0; k < keys.length; k++) {
          const item = map[keys[k]];
          if (!item || !item.pivot) continue;
          // orbit speed inversely proportional to radius for variety
          const radius = item.mesh.position.length() || 1;
          item.pivot.rotation.y += 0.0018 * (1.6 / Math.max(0.6, radius));
        }
      } catch (err) {
        // ignore
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();

      if (now - lastLabelUpdateRef.current > LABEL_UPDATE_INTERVAL) {
        lastLabelUpdateRef.current = now;
        const cam = cameraRef.current;
        // Update node positions from their mesh world positions so labels follow orbits
        try {
          const map = sceneRef.current.userData.nodeMap || {};
          for (const n of nodes) {
            if (n.id === 'center') continue;
            const entry = map[n.id];
            if (entry && entry.mesh) {
              entry.mesh.getWorldPosition(n.position);
            }
          }
        } catch (err) {
          // ignore
        }
        const candidates = nodes
          .map(node => {
            const projected = node.position.clone().project(cam);
            const screen = project(node.position, cam, currentWidth, currentHeight);
            const distance = cam.position.distanceTo(node.position);
            const depthT = Math.max(0, Math.min(1, (distance - 3.5) / 6.5));
            return {
              node,
              projected,
              screen,
              distance,
              fontSize: node.id === 'center' ? 13 : 12 - depthT * 1.5,
              opacity: node.id === 'center' ? 1 : 0.82 + (1 - depthT) * 0.18,
            };
          })
          .filter(item => (
            item.node.id !== 'center'
            && item.node.label.length > 0
            && item.projected.z >= -1
            && item.projected.z <= 1
            && item.projected.x >= -0.95
            && item.projected.x <= 0.95
            && item.projected.y >= -0.95
            && item.projected.y <= 0.95
          ));

        const sorted = candidates.sort((a, b) => a.distance - b.distance);

        const selected: typeof candidates = [];

        for (const candidate of sorted) {
          if (selected.length >= MAX_VISIBLE_LABELS) break;
          const overlaps = selected.some(existing => {
            const dx = existing.screen.x - candidate.screen.x;
            const dy = existing.screen.y - candidate.screen.y;
            return Math.hypot(dx, dy) < LABEL_MIN_GAP;
          });
          if (!overlaps) selected.push(candidate);
        }

        const newLabels: LabelData[] = selected.map(({ node, screen, fontSize, opacity }) => ({
          id: node.id,
          label: node.label,
          screen,
          fontSize,
          opacity,
          isCenter: node.id === 'center',
          width: Math.max(44, Math.min(320, node.label.length * fontSize * 0.74 + 18)),
        }));
        setLabels(newLabels);
      }
    };

    render();
  }, [nodes, currentWidth, currentHeight, buildScene]);

  useEffect(() => {
    if (rendererRef.current && glRef.current) {
      const gl = glRef.current;
      rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    if (cameraRef.current) {
      cameraRef.current.aspect = currentWidth / currentHeight;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [currentWidth, currentHeight]);

  useEffect(() => {
    if (sceneRef.current) buildScene();
  }, [nodes, buildScene]);

  // Reset camera to default on mount and when `resetSignal` changes
  useEffect(() => {
    const DEFAULT = { theta: 0.4, phi: 1.1, radius: 12.0 };
    spherical.current.theta = DEFAULT.theta;
    spherical.current.phi = DEFAULT.phi;
    spherical.current.radius = DEFAULT.radius;
    if (cameraRef.current) {
      const { theta, phi, radius } = spherical.current;
      cameraRef.current.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
      cameraRef.current.lookAt(0, 0, 0);
    }
  }, [resetSignal]);

  useEffect(() => {
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, []);

  // ── Touch handling ──────────────────────────────────────────────────────────

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches.length === 1) {
      lastTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
      lastPinchDist.current = null;
    } else if (touches.length === 2) {
      lastPinchDist.current = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY,
      );
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches.length === 1 && lastTouch.current) {
      const dx = touches[0].pageX - lastTouch.current.x;
      const dy = touches[0].pageY - lastTouch.current.y;
      spherical.current.theta -= dx * 0.008;
      spherical.current.phi    = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.current.phi + dy * 0.008));
      lastTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
    } else if (touches.length === 2 && lastPinchDist.current !== null) {
      const dist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY,
      );
      const delta = lastPinchDist.current - dist;
      // allow farther zoom-out by increasing max radius
      spherical.current.radius = Math.max(3, Math.min(28, spherical.current.radius + delta * 0.04));
      lastPinchDist.current = dist;
    }
  };

  // ── Tap detection ───────────────────────────────────────────────────────────

  const handleTap = (e: any) => {
    if (!cameraRef.current || !sceneRef.current) return;
    const { locationX, locationY } = e.nativeEvent;

    const ndcX =  (locationX / currentWidth)  * 2 - 1;
    const ndcY = -(locationY / currentHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, cameraRef.current);

    const meshes = sceneRef.current.children.filter(c => c instanceof THREE.Mesh && c.userData.nodeId);
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const nodeId = hits[0].object.userData.nodeId;
      if (nodeId !== 'center') onCategoryTap(nodeId);
    }
  };

  const MapContent = (
    <View
      style={{ width: currentWidth, height: currentHeight, borderRadius: isFullscreen ? 0 : 24, overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { lastTouch.current = null; lastPinchDist.current = null; }}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      {/* Overlay Labels */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {labels.map(l => (
          <Pressable
            key={l.id}
            onPress={() => onCategoryTap(l.id)}
            style={[
              styles.nodeLabel,
              {
                left: l.screen.x,
                top: l.screen.y,
                width: l.width,
                marginLeft: -(l.width / 2),
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: l.fontSize,
                opacity: l.opacity,
                fontWeight: l.isCenter ? '700' : '600',
                backgroundColor: 'rgba(26, 30, 34, 0.9)',
                color: '#F8FAFC',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
              },
            ]}
          >
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: '#F8FAFC', textAlign: 'center', width: '100%' }}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.fullscreenButton, isFullscreen && styles.fullscreenButtonExit]}
        onPress={() => setIsFullscreen(!isFullscreen)}
      >
        <Text style={styles.fullscreenButtonText}>{isFullscreen ? '↙️' : '↗️'}</Text>
      </TouchableOpacity>

      <View style={styles.hintBadge} pointerEvents="none">
        <Text style={styles.hintText}>Rotate & Zoom · Tap Nodes</Text>
      </View>
    </View>
  );

  if (isFullscreen) {
    return (
      <Modal visible transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
          <SafeAreaView style={{ flex: 1 }}>{MapContent}</SafeAreaView>
        </View>
      </Modal>
    );
  }

  return <View style={styles.chartContainer}>{MapContent}</View>;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🧠</Text>
      <Text style={styles.emptyTitle}>Your Mind Map Awaits</Text>
      <Text style={styles.emptyText}>
        Start journaling to see your thoughts organized into meaningful categories.
      </Text>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function MindMapScreen() {
  const [categories, setCategories]   = useState<ThoughtCategory[]>([]);
  const [nodes, setNodes]             = useState<MindMapNode3D[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Signal toggled when screen is focused so the embedded visualization can reset camera
  const [resetSignal, setResetSignal] = useState(0);
  useFocusEffect(useCallback(() => {
    setResetSignal(s => s + 1);
  }, [nodes]));

  const [isThoughtsModalVisible,     setIsThoughtsModalVisible]     = useState(false);
  const [selectedCategory,           setSelectedCategory]           = useState<{id:string;name:string}|null>(null);
  const [selectedCategoryThoughts,   setSelectedCategoryThoughts]   = useState<Array<{id:string;text:string;created_at:string}>>([]);
  const [isThoughtsLoading,          setIsThoughtsLoading]          = useState(false);
  const [isAllCategoriesModalVisible,setIsAllCategoriesModalVisible]= useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        setIsLoading(true);
        const activeCategories = await getActiveCategories();
        const thoughtCategories: ThoughtCategory[] = activeCategories.map((cat, i) => ({
          id: cat.id,
          name: cat.name,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          thoughtCount: cat.thought_count,
        }));
        setCategories(thoughtCategories);
        setNodes(generateNodes3D(thoughtCategories.slice(0, 12)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        setIsLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleCategoryTap = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    setSelectedCategory({ id: categoryId, name: category.name });
    setIsThoughtsLoading(true);
    setIsThoughtsModalVisible(true);
    try {
      const fetched = await getThoughtsByActiveCategory(categoryId);
      setSelectedCategoryThoughts(fetched);
    } catch {
      setSelectedCategoryThoughts([]);
    } finally {
      setIsThoughtsLoading(false);
    }
  };

  if (isLoading) return <ScreenContainer><LoadingSpinner message="Loading mind map..." /></ScreenContainer>;

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Mind Map" subtitle="Visualize your thoughts" />

      {nodes.length > 0 ? (
        <>
          <MindMapVisualization3D nodes={nodes} onCategoryTap={handleCategoryTap} resetSignal={resetSignal} />

          <View style={styles.legend}>
            <View style={styles.legendHeader}>
              <Text style={styles.legendTitle}>Categories</Text>
              {categories.length > 5 && (
                <Pressable onPress={() => setIsAllCategoriesModalVisible(true)}>
                  <Text style={styles.seeAllButton}>See all</Text>
                </Pressable>
              )}
            </View>
            {categories.slice(0, 5).map(cat => (
              <TouchableOpacity key={cat.id} style={styles.legendItem} onPress={() => handleCategoryTap(cat.id)}>
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendLabel}>{cat.name}</Text>
                <Text style={styles.legendCount}>{cat.thoughtCount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : <EmptyState />}

      {/* Modals for thoughts and category listing */}
      <Modal visible={isThoughtsModalVisible} transparent animationType="fade" onRequestClose={() => setIsThoughtsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCategory?.name ?? 'Thoughts'}</Text>
              <Pressable onPress={() => setIsThoughtsModalVisible(false)} style={styles.modalCloseIcon}>
                <Text style={styles.modalCloseIconText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              {isThoughtsLoading
                ? <View style={{ flex:1, justifyContent:'center', alignItems: 'center', minHeight: 120 }}><Text>Loading…</Text></View>
                : <FlatList
                    data={selectedCategoryThoughts}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                      <View style={styles.thoughtRow}><Text style={styles.thoughtText}>{item.text}</Text></View>
                    )}
                    ListEmptyComponent={<Text style={styles.modalEmptyText}>No thoughts found.</Text>}
                  />
              }
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsThoughtsModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAllCategoriesModalVisible} transparent animationType="fade" onRequestClose={() => setIsAllCategoriesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Categories</Text>
              <Pressable onPress={() => setIsAllCategoriesModalVisible(false)} style={styles.modalCloseIcon}>
                <Text style={styles.modalCloseIconText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <FlatList
                data={categories}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.categoryModalItem} onPress={() => { setIsAllCategoriesModalVisible(false); handleCategoryTap(item.id); }}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryModalName}>{item.name}</Text>
                    <Text style={styles.categoryModalCount}>{item.thoughtCount}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
            <View style={styles.modalFooter}>
              <Pressable style={styles.modalCloseButton} onPress={() => setIsAllCategoriesModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chartContainer:        { position:'relative', alignItems:'center', marginVertical:20 },
  nodeLabel:             { position:'absolute', textAlign:'center', width:120, marginLeft:-60, marginTop:-10, shadowColor:'#000', shadowOpacity:0.24, shadowRadius:3, shadowOffset:{ width:0, height:1 }, elevation:2 },
  hintBadge:             { position:'absolute', bottom:12, left:12, backgroundColor:'rgba(0,0,0,0.3)', borderRadius:12, paddingHorizontal:10, paddingVertical:4 },
  hintText:              { color:'#fff', fontSize:10, fontWeight:'600' },
  legend:                { backgroundColor:'#FFFFFF', borderRadius:16, padding:16, marginTop:8, borderWidth:1, borderColor:'#E8ECEB', marginHorizontal:20 },
  legendHeader:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  legendTitle:           { fontSize:16, fontWeight:'600', color:'#2D3436' },
  seeAllButton:          { fontSize:14, color:'#5B8A72', fontWeight:'600' },
  legendItem:            { flexDirection:'row', alignItems:'center', paddingVertical:8 },
  legendDot:             { width:12, height:12, borderRadius:6, marginRight:12 },
  legendLabel:           { flex:1, fontSize:14, color:'#2D3436' },
  legendCount:           { fontSize:14, color:'#636E72', fontWeight:'500' },
  emptyState:            { flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal:40, paddingTop:80 },
  emptyEmoji:            { fontSize:64, marginBottom:16 },
  emptyTitle:            { fontSize:22, fontWeight:'bold', color:'#2D3436', marginBottom:8 },
  emptyText:             { fontSize:15, color:'#636E72', textAlign:'center', lineHeight:22 },
  modalOverlay:          { flex:1, backgroundColor:'rgba(0, 0, 0, 0.4)', justifyContent:'center', alignItems:'center' },
  modalCard:             { width:'92%', maxHeight:'80%', backgroundColor:'#fff', borderRadius:18, overflow:'hidden' },
  modalHeader:           { paddingHorizontal:16, paddingTop:16, paddingBottom:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  modalTitle:            { fontSize:18, fontWeight:'700' },
  modalCloseIcon:        { padding:4 },
  modalCloseIconText:    { fontSize:24, color:'#636E72' },
  modalDivider:          { height:1, backgroundColor:'#eee' },
  modalBody:             { maxHeight:400, flexShrink:1 },
  modalFooter:           { padding:16, borderTopWidth:1, borderTopColor:'#eee' },
  thoughtRow:            { paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#f1f1f1', marginHorizontal:16 },
  thoughtText:           { fontSize:15, color:'#2d3436', lineHeight:20 },
  modalEmptyText:        { paddingVertical:20, color:'#666', textAlign:'center' },
  modalCloseButton:      { paddingVertical:14, borderRadius:12, alignItems:'center', backgroundColor:'#5B8A72' },
  modalCloseButtonText:  { fontWeight:'700', color:'#FFFFFF', fontSize:16 },
  categoryModalItem:     { flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16, borderBottomWidth:1, borderBottomColor:'#f1f1f1' },
  categoryModalName:     { flex:1, fontSize:15, color:'#2D3436', marginLeft:12 },
  categoryModalCount:    { fontSize:14, color:'#636E72', fontWeight:'500' },
  fullscreenButton:      { position:'absolute', bottom:12, right:12, backgroundColor:'rgba(0,0,0,0.3)', width:40, height:44, borderRadius:20, justifyContent:'center', alignItems:'center', zIndex:100 },
  fullscreenButtonExit:  { bottom:24 },
  fullscreenButtonText:  { fontSize:18 },
});
