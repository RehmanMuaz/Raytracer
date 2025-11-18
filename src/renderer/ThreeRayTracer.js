import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GUI } from "lil-gui";

import vertexShaderImport from "../shaders/vertex.glsl";
import fragmentShaderImport from "../shaders/fragment.glsl";

const MAX_SHAPES = 8;
const MAX_AREA_LIGHTS = 3;

const shapeTypeToId = {
  sphere: 0,
  box: 1,
  plane: 2,
  torus: 3,
  cylinder: 4,
};

const shapeShaderToId = {
  pbr: 0,
  glass: 1,
};

const rotationFromNormal = (normal) => {
  const normalized = normal.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normalized
  );
  return new THREE.Euler().setFromQuaternion(quaternion);
};

const createDefaultShapes = () => [
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
    name: "Glass Cylinder",
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

const createDefaultAreaLights = () => [
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

const createEnvironmentSettings = () => ({
  skyTop: new THREE.Color("#6d8cff"),
  skyBottom: new THREE.Color("#05060a"),
  intensity: 1.3,
});

const resolveShaderSource = async (shader) => {
  if (!shader) {
    throw new Error("Shader asset is undefined");
  }

  const trimmed = shader.trim();
  if (trimmed.startsWith("#version") || trimmed.startsWith("precision")) {
    return shader;
  }

  const response = await fetch(shader);
  if (!response.ok) {
    throw new Error(`Failed to fetch shader: ${response.statusText}`);
  }
  const text = await response.text();
  const modulePrefix = "module.exports =";
  if (text.startsWith(modulePrefix)) {
    let body = text.slice(modulePrefix.length).trim();
    if (body.endsWith(";")) {
      body = body.slice(0, -1);
    }

    try {
      const decoded = Function(`"use strict"; return ${body};`)();
      if (typeof decoded === "string") {
        return decoded;
      }
    } catch (err) {
      console.warn("Failed to decode shader module wrapper:", err);
    }
  }

  return text;
};

const initializeVector4Array = (count) =>
  Array.from({ length: count }, () => new THREE.Vector4());

const initializeMatrix3Array = (count) =>
  Array.from({ length: count }, () => new THREE.Matrix3());

const updateShapeUniforms = (uniforms, shapes) => {
  const posType = uniforms.uShapePosType.value;
  const scale = uniforms.uShapeScale.value;
  const colorMetal = uniforms.uShapeColorMetal.value;
  const roughAO = uniforms.uShapeRoughAO.value;
  const rotations = uniforms.uShapeRotation.value;
  const tempMatrix = new THREE.Matrix4();

  shapes.slice(0, MAX_SHAPES).forEach((shape, idx) => {
    const typeId = shapeTypeToId[shape.type] ?? 0;
    const shaderId = shapeShaderToId[shape.shader] ?? 0;
    posType[idx].set(
      shape.position.x,
      shape.position.y,
      shape.position.z,
      typeId
    );
    scale[idx].set(shape.scale.x, shape.scale.y, shape.scale.z, 0);
    colorMetal[idx].set(
      shape.color.r,
      shape.color.g,
      shape.color.b,
      shape.metallic
    );
    roughAO[idx].set(shape.roughness, shape.ao, shaderId, 0);
    tempMatrix.makeRotationFromEuler(shape.rotation);
    rotations[idx].setFromMatrix4(tempMatrix).transpose();
  });

  for (let i = shapes.length; i < MAX_SHAPES; i += 1) {
    posType[i].set(0, -50 - i * 5, 0, 0);
    scale[i].set(1, 1, 1, 0);
    colorMetal[i].set(0, 0, 0, 0);
    roughAO[i].set(1, 1, 0, 0);
    rotations[i].identity();
  }

  uniforms.uShapeCount.value = Math.min(shapes.length, MAX_SHAPES);
};

const updateAreaLightUniforms = (uniforms, lights) => {
  const posIntensity = uniforms.uAreaLightPosIntensity.value;
  const normals = uniforms.uAreaLightNormal.value;
  const sizes = uniforms.uAreaLightSize.value;
  const colors = uniforms.uAreaLightColor.value;

  lights.slice(0, MAX_AREA_LIGHTS).forEach((light, idx) => {
    const normal = light.normal.clone().normalize();
    posIntensity[idx].set(
      light.position.x,
      light.position.y,
      light.position.z,
      light.intensity
    );
    normals[idx].set(normal.x, normal.y, normal.z, 0);
    sizes[idx].set(light.size.x, light.size.y, 0, 0);
    colors[idx].set(light.color.r, light.color.g, light.color.b, 0);
  });

  for (let i = lights.length; i < MAX_AREA_LIGHTS; i += 1) {
    posIntensity[i].set(0, 5 + i * 2, 0, 0);
    normals[i].set(0, -1, 0, 0);
    sizes[i].set(0, 0, 0, 0);
    colors[i].set(0, 0, 0, 0);
  }

  uniforms.uAreaLightCount.value = Math.min(lights.length, MAX_AREA_LIGHTS);
};

const addVec3Controllers = (folder, vector, label, range, step, callback) => {
  folder
    .add(vector, "x", range[0], range[1], step)
    .name(`${label} X`)
    .onChange(callback);
  folder
    .add(vector, "y", range[0], range[1], step)
    .name(`${label} Y`)
    .onChange(callback);
  folder
    .add(vector, "z", range[0], range[1], step)
    .name(`${label} Z`)
    .onChange(callback);
};

const buildGui = (
  shapes,
  areaLights,
  camera,
  environment,
  updateShapes,
  updateLights,
  updateCamera,
  updateEnvironment
) => {
  const gui = new GUI({ title: "Raytracer Controls", width: 320 });
  shapes.forEach((shape, idx) => {
    const folder = gui.addFolder(`Shape ${idx + 1}: ${shape.name}`);
    folder
      .add(shape, "shader", Object.keys(shapeShaderToId))
      .name("Shader")
      .onChange(updateShapes);
    folder
      .add(shape, "type", Object.keys(shapeTypeToId))
      .name("Primitive")
      .onChange(updateShapes);
    addVec3Controllers(
      folder,
      shape.position,
      "Position",
      [-4, 4],
      0.01,
      updateShapes
    );
    addVec3Controllers(
      folder,
      shape.scale,
      "Scale",
      [0.1, 2.5],
      0.01,
      updateShapes
    );
    addVec3Controllers(
      folder,
      shape.rotation,
      "Rotation",
      [-Math.PI, Math.PI],
      0.01,
      updateShapes
    );
    folder
      .add(shape, "roughness", 0.05, 1, 0.01)
      .name("Roughness")
      .onChange(updateShapes);
    folder
      .add(shape, "metallic", 0, 1, 0.01)
      .name("Metallic")
      .onChange(updateShapes);
    folder
      .add(shape, "ao", 0, 1, 0.01)
      .name("Ambient Occlusion")
      .onChange(updateShapes);

    const colorProxy = { color: `#${shape.color.getHexString()}` };
    folder
      .addColor(colorProxy, "color")
      .name("Albedo")
      .onChange((value) => {
        shape.color.set(value);
        updateShapes();
      });
  });

  const lightsFolder = gui.addFolder("Area Lights");
  areaLights.forEach((light, idx) => {
    const folder = lightsFolder.addFolder(`${idx + 1}: ${light.name}`);
    addVec3Controllers(
      folder,
      light.position,
      "Position",
      [-5, 5],
      0.01,
      updateLights
    );
    addVec3Controllers(folder, light.normal, "Normal", [-1, 1], 0.01, () => {
      light.normal.normalize();
      updateLights();
    });
    folder
      .add(light.size, "x", 0.1, 3, 0.01)
      .name("Width")
      .onChange(updateLights);
    folder
      .add(light.size, "y", 0.1, 3, 0.01)
      .name("Height")
      .onChange(updateLights);
    folder
      .add(light, "intensity", 0.5, 150, 0.1)
      .name("Intensity")
      .onChange(updateLights);

    const colorProxy = { color: `#${light.color.getHexString()}` };
    folder
      .addColor(colorProxy, "color")
      .name("Color")
      .onChange((value) => {
        light.color.set(value);
        updateLights();
      });
  });

  const cameraFolder = gui.addFolder("Camera");
  addVec3Controllers(
    cameraFolder,
    camera.position,
    "Position",
    [-8, 8],
    0.01,
    updateCamera
  );
  addVec3Controllers(
    cameraFolder,
    camera.target,
    "Target",
    [-8, 8],
    0.01,
    updateCamera
  );

  const environmentFolder = gui.addFolder("Environment");
  const envColors = {
    skyTop: `#${environment.skyTop.getHexString()}`,
    skyBottom: `#${environment.skyBottom.getHexString()}`,
  };
  environmentFolder
    .addColor(envColors, "skyTop")
    .name("Sky Top")
    .onChange((value) => {
      environment.skyTop.set(value);
      updateEnvironment();
    });
  environmentFolder
    .addColor(envColors, "skyBottom")
    .name("Sky Bottom")
    .onChange((value) => {
      environment.skyBottom.set(value);
      updateEnvironment();
    });
  environmentFolder
    .add(environment, "intensity", 0.1, 3, 0.01)
    .name("Sky Intensity")
    .onChange(updateEnvironment);

  return gui;
};

const ShaderScene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return () => {};
    }

    const shapes = createDefaultShapes();
    const lights = createDefaultAreaLights();
    const environment = createEnvironmentSettings();
    let renderer = null;
    let animationId = null;
    let handleResize = null;
    let disposed = false;
    let gui;

    Promise.all([
      resolveShaderSource(vertexShaderImport),
      resolveShaderSource(fragmentShaderImport),
    ])
      .then(([vertexShader, fragmentShader]) => {
        if (disposed) {
          return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          45,
          window.innerWidth / window.innerHeight,
          0.1,
          10
        );
        camera.position.z = 1;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        renderer.physicallyCorrectLights = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 1);
        mount.appendChild(renderer.domElement);

        const uniforms = {
          uResolution: {
            value: new THREE.Vector2(window.innerWidth, window.innerHeight),
          },
          uTime: { value: 0 },
          uCameraPos: { value: new THREE.Vector3(0, 0.6, 3.8) },
          uCameraTarget: { value: new THREE.Vector3(0, -0.2, -3.0) },
          uShapeCount: { value: shapes.length },
          uShapePosType: { value: initializeVector4Array(MAX_SHAPES) },
          uShapeScale: { value: initializeVector4Array(MAX_SHAPES) },
          uShapeColorMetal: { value: initializeVector4Array(MAX_SHAPES) },
          uShapeRoughAO: { value: initializeVector4Array(MAX_SHAPES) },
          uShapeRotation: { value: initializeMatrix3Array(MAX_SHAPES) },
          uAreaLightCount: { value: lights.length },
          uAreaLightPosIntensity: {
            value: initializeVector4Array(MAX_AREA_LIGHTS),
          },
          uAreaLightNormal: { value: initializeVector4Array(MAX_AREA_LIGHTS) },
          uAreaLightSize: { value: initializeVector4Array(MAX_AREA_LIGHTS) },
          uAreaLightColor: { value: initializeVector4Array(MAX_AREA_LIGHTS) },
          uSkyTopColor: { value: environment.skyTop.clone() },
          uSkyBottomColor: { value: environment.skyBottom.clone() },
          uSkyIntensity: { value: environment.intensity },
        };

        const cameraControls = {
          position: uniforms.uCameraPos.value,
          target: uniforms.uCameraTarget.value,
        };

        updateShapeUniforms(uniforms, shapes);
        updateAreaLightUniforms(uniforms, lights);

        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        plane.frustumCulled = false;
        scene.add(plane);

        const clock = new THREE.Clock();
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          uniforms.uTime.value = clock.getElapsedTime();
          renderer.render(scene, camera);
        };
        animate();

        const resize = () => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          uniforms.uResolution.value.set(width, height);
        };
        handleResize = resize;
        window.addEventListener("resize", resize);

        const triggerShapeUpdate = () => updateShapeUniforms(uniforms, shapes);
        const triggerLightUpdate = () =>
          updateAreaLightUniforms(uniforms, lights);
        const triggerCameraUpdate = () => {
          uniforms.uCameraPos.value = cameraControls.position;
          uniforms.uCameraTarget.value = cameraControls.target;
        };
        const triggerEnvironmentUpdate = () => {
          uniforms.uSkyTopColor.value.copy(environment.skyTop);
          uniforms.uSkyBottomColor.value.copy(environment.skyBottom);
          uniforms.uSkyIntensity.value = environment.intensity;
        };
        triggerEnvironmentUpdate();
        gui = buildGui(
          shapes,
          lights,
          cameraControls,
          environment,
          triggerShapeUpdate,
          triggerLightUpdate,
          triggerCameraUpdate,
          triggerEnvironmentUpdate
        );
      })
      .catch((error) => {
        console.error("Failed to initialize shaders:", error);
      });

    return () => {
      disposed = true;
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (gui) {
        gui.destroy();
      }
      if (
        renderer &&
        renderer.domElement &&
        mount.contains(renderer.domElement)
      ) {
        mount.removeChild(renderer.domElement);
      }
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
};

export default ShaderScene;
