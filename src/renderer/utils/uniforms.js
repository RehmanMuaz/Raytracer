import * as THREE from "three";
import {
  MAX_SHAPES,
  MAX_AREA_LIGHTS,
  shapeTypeToId,
  shapeShaderToId,
} from "../config/sceneConfig";

export const initializeVector4Array = (count = MAX_SHAPES) =>
  Array.from({ length: count }, () => new THREE.Vector4());

export const initializeMatrix3Array = (count = MAX_SHAPES) =>
  Array.from({ length: count }, () => new THREE.Matrix3());

export const updateShapeUniforms = (uniforms, shapes) => {
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

export const updateAreaLightUniforms = (uniforms, lights) => {
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
