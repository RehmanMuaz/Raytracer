import {
  vertexShaderSource,
  fragmentShaderSource,
} from "../shaders/shaders.js";

export default class WebGLRayTracer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2");
    if (!this.gl) {
      console.error("WebGL 2.0 is not supported");
      return;
    }

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.uniformLocations = {};
    this.init();
    this.render(0); // Start rendering
  }

  createShader(type, source) {
    console.log(
      `Creating shader of type ${
        type === this.gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT"
      }`
    );
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Shader compilation error: " + this.gl.getShaderInfoLog(shader)
      );
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      fragmentSource
    );
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(
        "Unable to initialize the shader program: " +
          this.gl.getProgramInfoLog(program)
      );
      return null;
    }
    return program;
  }

  init() {
    const gl = this.gl;
    const program = this.program;
    gl.useProgram(program);

    // Vertex buffer setup (unchanged)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(
      program,
      "a_position"
    );
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    this.uniformLocations.u_resolution = gl.getUniformLocation(
      program,
      "u_resolution"
    );
    this.uniformLocations.u_time = gl.getUniformLocation(program, "u_time");
    this.uniformLocations.u_cameraPos = gl.getUniformLocation(
      program,
      "u_cameraPos"
    );
    this.uniformLocations.u_lightPos = gl.getUniformLocation(
      program,
      "u_lightPos"
    );

    // Set initial values
    gl.uniform3f(this.uniformLocations.u_cameraPos, 0.0, 0.0, 5.0); // Camera position
    gl.uniform3f(this.uniformLocations.u_lightPos, 0.0, 1.5, 0.0); // Light position
  }

  render(time) {
    const gl = this.gl;
    const program = this.program;
    gl.useProgram(program);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(
      this.uniformLocations.u_resolution,
      gl.canvas.width,
      gl.canvas.height
    );
    gl.uniform1f(this.uniformLocations.u_time, time * 0.001);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(this.render.bind(this));
  }
}
