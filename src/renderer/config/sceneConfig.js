import * as THREE from "three";

export const MAX_SHAPES = 8;
export const MAX_AREA_LIGHTS = 3;

export const shapeTypeToId = {
  sphere: 0,
  box: 1,
  plane: 2,
  torus: 3,
  cylinder: 4,
};

export const shapeShaderToId = {
  pbr: 0,
  glass: 1,
};

export const defaultPerformanceSettings = () => ({
  resolutionScale: 1,
  maxMarchSteps: 120,
  enableAO: true,
  denoiseStrength: 0,
});

export const rotationFromNormal = (normal) => {
  const normalized = normal.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normalized
  );
  return new THREE.Euler().setFromQuaternion(quaternion);
};

export const createDefaultShapes = () => [
  {
    name: "Metal Sphere",
    type: "sphere",
    position: new THREE.Vector3(-1.93, -0.59, -3.2),
    scale: new THREE.Vector3(0.65, 0.65, 0.65),
    rotation: new THREE.Euler(0, 0, 0),
    color: new THREE.Color("#ff714a"),
    roughness: 0.25,
    metallic: 0.9,
    ao: 1.0,
    shader: "pbr",
  },
  {
    name: "Ceramic Box",
    type: "box",
    position: new THREE.Vector3(1.2, -0.8, -2.4),
    scale: new THREE.Vector3(0.7, 0.4, 0.7),
    rotation: new THREE.Euler(0.0, 0.7, 0.0),
    color: new THREE.Color("#ff00a2"),
    roughness: 0.65,
    metallic: 0.05,
    ao: 0.9,
    shader: "pbr",
  },
  {
    name: "Copper Torus",
    type: "torus",
    position: new THREE.Vector3(0.2, 0.1, -3.6),
    scale: new THREE.Vector3(1.0, 0.25, 0.0),
    rotation: new THREE.Euler(0.3, 0.4, 0.0),
    color: new THREE.Color("#ffb347"),
    roughness: 0.34,
    metallic: 0.61,
    ao: 1.0,
    shader: "pbr",
  },
  {
    name: "Cylinder",
    type: "cylinder",
    position: new THREE.Vector3(-0.3, -0.9, -1.7),
    scale: new THREE.Vector3(0.8, 0.3, 0.0),
    rotation: new THREE.Euler(0, 0, 0),
    color: new THREE.Color("#f0f7ff"),
    roughness: 0.15,
    metallic: 0.05,
    ao: 0.85,
    shader: "pbr",
  },
  {
    name: "Matte Plane",
    type: "plane",
    position: new THREE.Vector3(0, -1.2, 0),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: rotationFromNormal(new THREE.Vector3(0, 1, 0)),
    color: new THREE.Color("#d6d2c9"),
    roughness: 0.9,
    metallic: 0.0,
    ao: 1.0,
    shader: "pbr",
  },
  {
    name: "Left Wall",
    type: "plane",
    position: new THREE.Vector3(-3.5, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: rotationFromNormal(new THREE.Vector3(1, 0, 0)),
    color: new THREE.Color("#ff0000"),
    roughness: 0.8,
    metallic: 0.0,
    ao: 1.0,
    shader: "pbr",
  },
  {
    name: "Right Wall",
    type: "plane",
    position: new THREE.Vector3(3.5, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: rotationFromNormal(new THREE.Vector3(-1, 0, 0)),
    color: new THREE.Color("#002aff"),
    roughness: 0.85,
    metallic: 0.0,
    ao: 1.0,
    shader: "pbr",
  },
  {
    name: "Back Wall",
    type: "plane",
    position: new THREE.Vector3(0, 0, -5.5),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: rotationFromNormal(new THREE.Vector3(0, 0, 1)),
    color: new THREE.Color("#00ff11"),
    roughness: 0.9,
    metallic: 0.0,
    ao: 1.0,
    shader: "pbr",
  },
];

export const createDefaultAreaLights = () => [
  {
    name: "Key Panel",
    position: new THREE.Vector3(-2.4, 2.22, 0.74),
    normal: new THREE.Vector3(0.3942, -0.9757, -0.168).normalize(),
    size: new THREE.Vector2(3, 3),
    color: new THREE.Color("#fff2d8"),
    intensity: 74.5,
  },
  {
    name: "Fill Panel",
    position: new THREE.Vector3(2.91, 0.39, -2.14),
    normal: new THREE.Vector3(-0.9966, -0.47076, -0.37432).normalize(),
    size: new THREE.Vector2(0.1, 1.36),
    color: new THREE.Color("#ffc8a3"),
    intensity: 64.1,
  },
];

export const createEnvironmentSettings = () => ({
  skyTop: new THREE.Color("#6d8cff"),
  skyBottom: new THREE.Color("#05060a"),
  intensity: 1.3,
});
