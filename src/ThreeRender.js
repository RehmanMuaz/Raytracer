import React from "react";
import ShaderScene from "./renderer/ThreeRayTracer";

const ThreeRender = () => {
  return (
    <div>
      <h1>ThreeJS Raytracer</h1>
      <div
        style={{ margin: 0, padding: 0, overflow: "hidden", height: "100vh" }}
      >
        <ShaderScene />
      </div>
    </div>
  );
};

export default ThreeRender;
