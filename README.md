# Path Tracer Lab

[![React](https://img.shields.io/badge/React-18.2-61dafb?style=for-the-badge&logo=react&logoColor=0a0a0a)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.172-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-GPU_Rendering-bd10e0?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![GLSL](https://img.shields.io/badge/GLSL-Ray_Marching-f5a623?style=for-the-badge)](https://www.khronos.org/opengl/wiki/Core_Language_(GLSL))

Path Tracer Lab is a browser playground for experimenting with GPU ray marching, cinematic lighting, and shader-driven materials. A fullscreen fragment shader constructs an SDF scene at runtime, marching rays through analytic primitives to render soft shadows, glossy metals, and a glass shader. A lil-gui overlay exposes live controls for camera, lights, and per-object material settings, making it easy to iterate on look-dev concepts directly on the web.

## Roadmap

- Temporal accumulation & denoising
- Physically-based ray tracing with BVH acceleration
- Triangle intersection & polygon path-tracing integrator
- Texture-mapped materials and HDRI lighting

## Getting Started

```bash
npm install
npm start
```

Navigate to `http://localhost:3000` and use the on-screen controls to customize the scene.
