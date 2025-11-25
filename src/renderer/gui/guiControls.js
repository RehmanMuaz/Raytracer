import { GUI } from "lil-gui";
import { shapeTypeToId, shapeShaderToId } from "../config/sceneConfig";

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

export const buildGui = ({
  shapes,
  areaLights,
  camera,
  environment,
  performance,
  onShapesChange,
  onLightsChange,
  onCameraChange,
  onEnvironmentChange,
  onPerformanceChange,
}) => {
  const gui = new GUI({ title: "Raytracer Controls", width: 320 });

  const perfFolder = gui.addFolder("Performance");
  perfFolder
    .add(performance, "resolutionScale", 0.3, 1, 0.05)
    .name("Resolution Scale")
    .onChange(onPerformanceChange);
  perfFolder
    .add(performance, "maxMarchSteps", 32, 200, 1)
    .name("Max March Steps")
    .onChange(onPerformanceChange);
  perfFolder
    .add(performance, "enableAO")
    .name("Ambient Occlusion")
    .onChange(onPerformanceChange);
  perfFolder
    .add(performance, "denoiseStrength", 0, 1, 0.01)
    .name("Denoise Strength")
    .onChange(onPerformanceChange);

  const cameraFolder = gui.addFolder("Camera");
  addVec3Controllers(
    cameraFolder,
    camera.position,
    "Position",
    [-8, 8],
    0.01,
    onCameraChange
  );
  addVec3Controllers(
    cameraFolder,
    camera.target,
    "Target",
    [-8, 8],
    0.01,
    onCameraChange
  );

  shapes.forEach((shape, idx) => {
    const folder = gui.addFolder(`Shape ${idx + 1}: ${shape.name}`);
    folder
      .add(shape, "shader", Object.keys(shapeShaderToId))
      .name("Shader")
      .onChange(onShapesChange);
    folder
      .add(shape, "type", Object.keys(shapeTypeToId))
      .name("Primitive")
      .onChange(onShapesChange);
    addVec3Controllers(
      folder,
      shape.position,
      "Position",
      [-4, 4],
      0.01,
      onShapesChange
    );
    addVec3Controllers(
      folder,
      shape.scale,
      "Scale",
      [0.1, 2.5],
      0.01,
      onShapesChange
    );
    addVec3Controllers(
      folder,
      shape.rotation,
      "Rotation",
      [-Math.PI, Math.PI],
      0.01,
      onShapesChange
    );
    folder
      .add(shape, "roughness", 0.05, 1, 0.01)
      .name("Roughness")
      .onChange(onShapesChange);
    folder
      .add(shape, "metallic", 0, 1, 0.01)
      .name("Metallic")
      .onChange(onShapesChange);
    folder
      .add(shape, "ao", 0, 1, 0.01)
      .name("Ambient Occlusion")
      .onChange(onShapesChange);

    const colorProxy = { color: `#${shape.color.getHexString()}` };
    folder
      .addColor(colorProxy, "color")
      .name("Albedo")
      .onChange((value) => {
        shape.color.set(value);
        onShapesChange();
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
      onLightsChange
    );
    addVec3Controllers(folder, light.normal, "Normal", [-1, 1], 0.01, () => {
      light.normal.normalize();
      onLightsChange();
    });
    folder
      .add(light.size, "x", 0.1, 3, 0.01)
      .name("Width")
      .onChange(onLightsChange);
    folder
      .add(light.size, "y", 0.1, 3, 0.01)
      .name("Height")
      .onChange(onLightsChange);
    folder
      .add(light, "intensity", 0.5, 150, 0.1)
      .name("Intensity")
      .onChange(onLightsChange);

    const colorProxy = { color: `#${light.color.getHexString()}` };
    folder
      .addColor(colorProxy, "color")
      .name("Color")
      .onChange((value) => {
        light.color.set(value);
        onLightsChange();
      });
  });

  const environmentColors = {
    top: `#${environment.skyTop.getHexString()}`,
    bottom: `#${environment.skyBottom.getHexString()}`,
  };

  const environmentFolder = gui.addFolder("Environment");
  environmentFolder
    .addColor(environmentColors, "top")
    .name("Sky Top")
    .onChange((value) => {
      environment.skyTop.set(value);
      onEnvironmentChange();
    });
  environmentFolder
    .addColor(environmentColors, "bottom")
    .name("Sky Bottom")
    .onChange((value) => {
      environment.skyBottom.set(value);
      onEnvironmentChange();
    });
  environmentFolder
    .add(environment, "intensity", 0.2, 2, 0.05)
    .name("Sky Intensity")
    .onChange(onEnvironmentChange);

  return gui;
};
