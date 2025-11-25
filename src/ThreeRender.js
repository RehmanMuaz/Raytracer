import React, { useState } from "react";
import ShaderScene from "./renderer/ThreeRayTracer";

const infoPanelStyle = {
  position: "fixed",
  top: "1.5rem",
  left: "1.5rem",
  width: "320px",
  maxHeight: "calc(100vh - 3rem)",
  padding: "1.25rem 1.5rem",
  background: "rgba(12, 14, 20, 0.9)",
  backdropFilter: "blur(8px)",
  color: "white",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  boxShadow: "0 12px 35px rgba(0,0,0,0.45)",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  overflowY: "auto",
  scrollbarWidth: "thin",
  zIndex: 100,
};

const headingStyle = {
  margin: 0,
  fontSize: "1.5rem",
  letterSpacing: "0.05em",
};

const listStyle = {
  margin: 0,
  paddingLeft: "1.2rem",
  lineHeight: 1.4,
};

const ThreeRender = () => {
  const [collapsed, setCollapsed] = useState(false);

  const currentFeatures = [
    "Realtime ray-marched primitives",
    "Area lights with soft shadows",
    "Physically-based shading & glass shader",
    "Orbitable camera with GUI controls",
  ];

  const upcomingFeatures = [
    "Temporal accumulation & denoising",
    "Physically-based ray tracing with BVH acceleration",
    "Triangle intersection & polygon path-tracing integrator",
    "Texture-mapped materials",
    "HDRI environment lighting",
  ];

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#030304",
        color: "white",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <aside style={{ ...infoPanelStyle }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={headingStyle}>Path Tracer Lab</h1>
            <p
              style={{
                margin: "0.5rem 0 0",
                color: "rgba(255,255,255,0.75)",
                display: collapsed ? "none" : "block",
              }}
            >
              Experiment with GPU ray marching, custom materials, and cinematic
              lighting directly in the browser.
            </p>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "6px",
              fontSize: "0.85rem",
              padding: "0.2rem 0.5rem",
              cursor: "pointer",
            }}
          >
            {collapsed ? "Expand" : "Hide"}
          </button>
        </header>
        {!collapsed && (
          <>
            <section>
              <h2 style={{ fontSize: "1rem", marginBottom: "0.4rem" }}>
                Current Features
              </h2>
              <ul style={listStyle}>
                {currentFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 style={{ fontSize: "1rem", marginBottom: "0.4rem" }}>
                Roadmap
              </h2>
              <ul style={listStyle}>
                {upcomingFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </section>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
              Use the GUI on the right to sculpt scenes, tweak shading models,
              and capture cinematic frames.
            </div>
          </>
        )}
      </aside>
      <ShaderScene />
    </div>
  );
};

export default ThreeRender;
