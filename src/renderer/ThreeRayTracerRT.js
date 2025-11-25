import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GUI } from "lil-gui";

import vertexShaderImport from "../shaders/vertex.glsl";
import fragmentShaderImport from "../shaders/fragment_rt.glsl";

const createEnvironmentSettings = () => ({
  skyTop: new THREE.Color("#6d8cff"),
  skyBottom: new THREE.Color("#05060a"),
  intensity: 1.0,
});

const createFloatTexture = (data, width, height) => {
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

const createPlaceholderBVHData = () => {
  const bounds = 10.0;
  const bvhData = new Float32Array([
    -bounds,
    -bounds,
    -bounds,
    -1.0,
    bounds,
    bounds,
    bounds,
    0.0,
  ]);
  const triangleData = new Float32Array([
    -1.0,
    -1.0,
    -4.0,
    0.0,
    1.0,
    -1.0,
    -4.0,
    0.0,
    0.0,
    1.0,
    -4.0,
    0.0,
  ]);
  return {
    bvhTexture: createFloatTexture(bvhData, 1, 2),
    triangleTexture: createFloatTexture(triangleData, 1, 3),
  };
};

const createBlankTexture = () =>
  createFloatTexture(new Float32Array([0, 0, 0, 0]), 1, 1);

const ThreeRayTracerRT = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return () => {};
    }

    const environment = createEnvironmentSettings();
    const denoiseControls = {
      temporal: false,
      spatial: false,
    };
    const { bvhTexture, triangleTexture } = createPlaceholderBVHData();
    const blankAccum = createBlankTexture();
    const blankMoments = createBlankTexture();

    let renderer = null;
    let animationId = null;
    let handleResize = null;
    let gui;

    Promise.all([
      Promise.resolve(vertexShaderImport),
      Promise.resolve(fragmentShaderImport),
    ])
      .then(([vertexShader, fragmentShader]) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          45,
          window.innerWidth / window.innerHeight,
          0.1,
          10
        );
        camera.position.z = 1;

        renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
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
          uSkyTopColor: { value: environment.skyTop.clone() },
          uSkyBottomColor: { value: environment.skyBottom.clone() },
          uSkyIntensity: { value: environment.intensity },
          uBVHNodes: { value: bvhTexture },
          uTriangles: { value: triangleTexture },
          uPrevAccum: { value: blankAccum },
          uPrevMoments: { value: blankMoments },
          uFrameIndex: { value: 0 },
          uUseTemporalDenoise: { value: denoiseControls.temporal },
          uUseSpatialDenoise: { value: denoiseControls.spatial },
        };

        const material = new THREE.ShaderMaterial({
          uniforms,
          vertexShader,
          fragmentShader,
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        quad.frustumCulled = false;
        scene.add(quad);

        const clock = new THREE.Clock();
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          uniforms.uTime.value = clock.getElapsedTime();
          renderer.render(scene, camera);
        };
        animate();

        handleResize = () => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          uniforms.uResolution.value.set(width, height);
        };
        window.addEventListener("resize", handleResize);

        gui = new GUI({ title: "RT Controls", width: 300 });
        const envColors = {
          top: `#${environment.skyTop.getHexString()}`,
          bottom: `#${environment.skyBottom.getHexString()}`,
        };
        const envFolder = gui.addFolder("Environment");
        envFolder
          .addColor(envColors, "top")
          .name("Sky Top")
          .onChange((value) => {
            environment.skyTop.set(value);
            uniforms.uSkyTopColor.value.copy(environment.skyTop);
          });
        envFolder
          .addColor(envColors, "bottom")
          .name("Sky Bottom")
          .onChange((value) => {
            environment.skyBottom.set(value);
            uniforms.uSkyBottomColor.value.copy(environment.skyBottom);
          });
        envFolder
          .add(environment, "intensity", 0.2, 2, 0.05)
          .name("Sky Intensity")
          .onChange((value) => {
            uniforms.uSkyIntensity.value = value;
          });

        const denoiseFolder = gui.addFolder("Denoising");
        denoiseFolder
          .add(denoiseControls, "temporal")
          .name("Temporal Accum")
          .onChange((value) => {
            uniforms.uUseTemporalDenoise.value = value;
          });
        denoiseFolder
          .add(denoiseControls, "spatial")
          .name("Spatial Filter")
          .onChange((value) => {
            uniforms.uUseSpatialDenoise.value = value;
          });
      })
      .catch((error) => {
        console.error("Failed to initialize RT shader:", error);
      });

    return () => {
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (gui) {
        gui.destroy();
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      }
      bvhTexture.dispose();
      triangleTexture.dispose();
      blankAccum.dispose();
      blankMoments.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
};

export default ThreeRayTracerRT;
