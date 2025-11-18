precision highp float;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    float r = uv.x;
    float g = uv.y;
    float b = 1.0 - uv.x;

    gl_FragColor = vec4(r, g, b, 1.0);
}
