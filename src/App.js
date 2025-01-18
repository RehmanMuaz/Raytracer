// src/App.js
import React, { useEffect, useRef } from "react";
import WebGLRayTracer from "./renderer/WebGLRayTracer";
import "./styles.css";

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rayTracer = new WebGLRayTracer(canvas);
    rayTracer.render(0);
  }, []);

  return (
    <div className="App">
      <h1>WebGL 2.0 Raytracing</h1>
      <canvas ref={canvasRef} width="800" height="600"></canvas>
    </div>
  );
}

export default App;
