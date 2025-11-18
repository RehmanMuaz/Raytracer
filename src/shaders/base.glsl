#version 300 es
precision highp float;

// ===============================
// Inputs from Vertex Shader
// ===============================
in vec3 vPosition;                // Fragment position in world space
in vec3 vNormal;                  // Normal vector in world space
in vec2 vUV;                      // Texture coordinates

// ===============================
// Outputs to the Framebuffer
// ===============================
out vec4 fragColor;

// ===============================
// Uniforms for Material Properties
// ===============================
uniform vec3 uAlbedo;             // Base color
uniform float uMetallic;          // Metallic property
uniform float uRoughness;         // Roughness property
uniform float uAO;                // Ambient occlusion

// ===============================
// Uniforms for Lighting
// ===============================
uniform vec3 uCameraPos;          // Camera position
uniform vec3 uLightPos;           // Point light position
uniform vec3 uLightColor;         // Point light color
uniform vec3 uAreaLightPos;       // Area light center
uniform vec3 uAreaLightSize;      // Area light dimensions (half-extent)
uniform vec3 uAreaLightColor;     // Area light color

// ===============================
// Constants
// ===============================
const float PI = 3.14159265359;

// ===============================
// Helper Functions
// ===============================

// Fresnel Schlick approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// Normal Distribution Function (GGX/Trowbridge-Reitz)
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

// Geometry Schlick GGX approximation
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

// Geometry Smith function
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = geometrySchlickGGX(NdotV, roughness);
    float ggx2 = geometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// ===============================
// Lighting Calculations
// ===============================

// Point Light Calculation
vec3 calculatePointLight(vec3 N, vec3 V, vec3 L, vec3 lightColor, vec3 F0) {
    vec3 H = normalize(V + L);

    // Compute PBR terms
    float D = distributionGGX(N, H, uRoughness);
    float G = geometrySmith(N, V, L, uRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    // Specular term
    vec3 numerator = D * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.001;
    vec3 specular = numerator / denominator;

    // Diffuse term
    vec3 kD = (1.0 - F) * (1.0 - uMetallic);
    vec3 diffuse = kD * uAlbedo / PI;

    // Final light contribution
    float NdotL = max(dot(N, L), 0.0);
    return (diffuse + specular) * lightColor * NdotL;
}

// Area Light Calculation (Simplified)
vec3 calculateAreaLight(vec3 N, vec3 V, vec3 L, vec3 lightColor, vec3 F0) {
    vec3 H = normalize(V + L);

    // Compute PBR terms
    float D = distributionGGX(N, H, uRoughness);
    float G = geometrySmith(N, V, L, uRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    // Specular term
    vec3 numerator = D * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.001;
    vec3 specular = numerator / denominator;

    // Diffuse term
    vec3 kD = (1.0 - F) * (1.0 - uMetallic);
    vec3 diffuse = kD * uAlbedo / PI;

    // Final light contribution
    float NdotL = max(dot(N, L), 0.0);
    return (diffuse + specular) * lightColor * NdotL;
}

// ===============================
// Main Shader Logic
// ===============================
void main() {
    // Normalize inputs
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vPosition);

    // Base reflectance for Fresnel
    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);

    // ===============================
    // Point Light Contribution
    // ===============================
    vec3 LPoint = normalize(uLightPos - vPosition);
    vec3 pointLight = calculatePointLight(N, V, LPoint, uLightColor, F0);

    // ===============================
    // Area Light Contribution
    // ===============================
    vec3 LArea = normalize(uAreaLightPos - vPosition);
    vec3 areaLight = calculateAreaLight(N, V, LArea, uAreaLightColor, F0);

    // ===============================
    // Ambient Light Contribution
    // ===============================
    vec3 ambient = uAO * uAlbedo;

    // ===============================
    // Combine All Lighting
    // ===============================
    vec3 color = ambient + pointLight + areaLight;

    // Output final color
    fragColor = vec4(color, 1.0);
}