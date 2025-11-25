import React, { useRef, useEffect } from "react";
import * as THREE from "three";

import vertexShaderImport from "../shaders/vertex.glsl";
import fragmentShaderImport from "../shaders/fragment.glsl";
import {
  MAX_SHAPES,
  MAX_AREA_LIGHTS,
  createDefaultShapes,
  createDefaultAreaLights,
  createEnvironmentSettings,
  defaultPerformanceSettings,
} from "./config/sceneConfig";
import {
  initializeVector4Array,
  initializeMatrix3Array,
  updateShapeUniforms,
  updateAreaLightUniforms,
} from "./utils/uniforms";
import { buildGui } from "./gui/guiControls";

const TARGET_FPS = 60;
const FPS_LOWER = 54;
const FPS_UPPER = 66;
const PERF_ADJUST_COOLDOWN = 1500;

const ThreeRayTracer = () => {
  const mountRef = useRef(null);
  const fpsRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return () => {};
    }

    const fpsPanel = fpsRef.current;
    if (fpsPanel) {
      fpsPanel.textContent = "FPS: --";
    }

    const shapes = createDefaultShapes();
    const lights = createDefaultAreaLights();
    const environment = createEnvironmentSettings();
    const performanceSettings = defaultPerformanceSettings();

    let renderer = null;
    let animationId = null;
    let handleResize = null;
    let disposed = false;
    let guiInstance = null;
    let framesSinceFpsUpdate = 0;
    let lastFpsSampleTime = performance.now();
    let smoothedFps = TARGET_FPS;
    let lastPerformanceAdjustTime = performance.now();

    Promise.all([
      Promise.resolve(vertexShaderImport),
      Promise.resolve(fragmentShaderImport),
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
          uMaxMarchSteps: { value: performanceSettings.maxMarchSteps },
          uAOIntensity: { value: performanceSettings.enableAO ? 1 : 0 },
          uDenoiseStrength: { value: performanceSettings.denoiseStrength },
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

        const applyPerformanceSettings = () => {
          const width = window.innerWidth * performanceSettings.resolutionScale;
          const height =
            window.innerHeight * performanceSettings.resolutionScale;
          renderer.setSize(width, height, false);
          renderer.domElement.style.width = "100%";
          renderer.domElement.style.height = "100%";
          uniforms.uResolution.value.set(width, height);
          uniforms.uMaxMarchSteps.value = Math.floor(
            performanceSettings.maxMarchSteps
          );
          uniforms.uAOIntensity.value = performanceSettings.enableAO ? 1 : 0;
          uniforms.uDenoiseStrength.value = performanceSettings.denoiseStrength;
        };
        applyPerformanceSettings();

        const degradePerformance = () => {
          if (performanceSettings.resolutionScale > 0.55) {
            performanceSettings.resolutionScale = Math.max(
              0.55,
              performanceSettings.resolutionScale - 0.1
            );
            return true;
          }
          if (performanceSettings.maxMarchSteps > 80) {
            performanceSettings.maxMarchSteps = Math.max(
              80,
              performanceSettings.maxMarchSteps - 10
            );
            return true;
          }
          if (performanceSettings.denoiseStrength > 0) {
            performanceSettings.denoiseStrength = Math.max(
              0,
              performanceSettings.denoiseStrength - 0.1
            );
            return true;
          }
          if (performanceSettings.enableAO) {
            performanceSettings.enableAO = false;
            return true;
          }
          return false;
        };

        const improvePerformance = () => {
          if (!performanceSettings.enableAO) {
            performanceSettings.enableAO = true;
            return true;
          }
          if (performanceSettings.denoiseStrength < 1) {
            performanceSettings.denoiseStrength = Math.min(
              1,
              performanceSettings.denoiseStrength + 0.1
            );
            return true;
          }
          if (performanceSettings.maxMarchSteps < 180) {
            performanceSettings.maxMarchSteps = Math.min(
              200,
              performanceSettings.maxMarchSteps + 10
            );
            return true;
          }
          if (performanceSettings.resolutionScale < 1) {
            performanceSettings.resolutionScale = Math.min(
              1,
              performanceSettings.resolutionScale + 0.05
            );
            return true;
          }
          return false;
        };

        const autoAdjustPerformance = (fpsValue, now) => {
          if (now - lastPerformanceAdjustTime < PERF_ADJUST_COOLDOWN) {
            return;
          }
          let adjusted = false;
          if (fpsValue < FPS_LOWER) {
            adjusted = degradePerformance();
          } else if (fpsValue > FPS_UPPER) {
            adjusted = improvePerformance();
          }
          if (adjusted) {
            applyPerformanceSettings();
            lastPerformanceAdjustTime = now;
          }
        };

        const clock = new THREE.Clock();
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          uniforms.uTime.value = clock.getElapsedTime();
          renderer.render(scene, camera);

          const now = performance.now();
          framesSinceFpsUpdate += 1;
          const elapsed = now - lastFpsSampleTime;
          if (elapsed >= 500) {
            const measured = (framesSinceFpsUpdate / elapsed) * 1000;
            smoothedFps = smoothedFps * 0.6 + measured * 0.4;
            framesSinceFpsUpdate = 0;
            lastFpsSampleTime = now;
            if (fpsPanel) {
              fpsPanel.textContent = `FPS: ${smoothedFps.toFixed(1)}`;
            }
            autoAdjustPerformance(smoothedFps, now);
          }
        };
        animate();

        handleResize = () => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          renderer.setSize(
            width * performanceSettings.resolutionScale,
            height * performanceSettings.resolutionScale
          );
          renderer.domElement.style.width = "100%";
          renderer.domElement.style.height = "100%";
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          uniforms.uResolution.value.set(
            width * performanceSettings.resolutionScale,
            height * performanceSettings.resolutionScale
          );
        };
        window.addEventListener("resize", handleResize);

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
        const triggerPerformanceUpdate = () => {
          applyPerformanceSettings();
          lastPerformanceAdjustTime = performance.now();
        };

        guiInstance = buildGui({
          shapes,
          areaLights: lights,
          camera: cameraControls,
          environment,
          performance: performanceSettings,
          onShapesChange: triggerShapeUpdate,
          onLightsChange: triggerLightUpdate,
          onCameraChange: triggerCameraUpdate,
          onEnvironmentChange: triggerEnvironmentUpdate,
          onPerformanceChange: triggerPerformanceUpdate,
        });
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
      if (guiInstance) {
        guiInstance.destroy();
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={fpsRef}
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "1rem",
          padding: "0.4rem 0.75rem",
          background: "rgba(0, 0, 0, 0.65)",
          color: "#fefefe",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          fontSize: "0.85rem",
          borderRadius: "6px",
          letterSpacing: "0.05em",
          pointerEvents: "none",
        }}
      >
        FPS: --
      </div>
    </div>
  );
};

export default ThreeRayTracer;
