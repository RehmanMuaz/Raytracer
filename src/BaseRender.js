import React from "react";
import ShaderScene from "./renderer/BaseRenderer";

const BaseRender = () => {
  return (
    <div>
      <h1>BaseRender Raytracer</h1>
      <div
        style={{ margin: 0, padding: 0, overflow: "hidden", height: "100vh" }}
      >
        <ShaderScene />
      </div>
    </div>
  );
};

export default BaseRender;
