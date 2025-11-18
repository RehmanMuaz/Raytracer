export const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

export const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_cameraPos;

// Constants
const float PI = 3.141592653589793;
const float EPSILON = 0.0001;
const int MAX_DEPTH = 5; // Maximum recursion depth
#define NUM_SAMPLES 16 // Number of samples for the area light
#define NUM_GI_SAMPLES 16 // Number of samples for global illumination

// Material properties
struct Material {
    vec3 albedo;
    float metallic;
    float roughness;
};

// Object properties
struct Object {
    int type; // 0 = sphere, 1 = box, 2 = plane
    vec3 position; // Center for sphere/box, point on plane for plane
    vec3 dimensions; // Radius for sphere, half-extents for box, normal for plane
    Material material;
};

// Scene assets
#define NUM_OBJECTS 7 // Define the number of objects
#define OBJECT_TYPE_SPHERE 0
#define OBJECT_TYPE_BOX 1
#define OBJECT_TYPE_PLANE 2
Object objects[NUM_OBJECTS];


// Area light properties
struct AreaLight {
    vec3 position; // Center of the light
    vec3 normal;   // Orientation of the light
    vec3 right;    // Right vector (defines the width of the light)
    vec3 up;       // Up vector (defines the height of the light)
    vec3 color;
    float width;   // Half-width of the light
    float height;  // Half-height of the light
};

AreaLight areaLight;

// Random number generator (simple hash function)
float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}

// Sample a point on the area light
vec3 sampleAreaLight(vec2 uv) {
    return areaLight.position +
           areaLight.right * (uv.x * areaLight.width) +
           areaLight.up * (uv.y * areaLight.height);
}

// Compute reflection direction
vec3 reflectRay(vec3 V, vec3 N) {
    return reflect(-V, N);
}

// Ray-sphere intersection
float raySphereIntersect(vec3 rayOrigin, vec3 rayDir, vec3 sphereCenter, float sphereRadius) {
    vec3 oc = rayOrigin - sphereCenter;
    float a = dot(rayDir, rayDir);
    float b = 2.0 * dot(oc, rayDir);
    float c = dot(oc, oc) - sphereRadius * sphereRadius;
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return -1.0; // No intersection
    }

    float t = (-b - sqrt(discriminant)) / (2.0 * a);
    return t; // Return the closest intersection
}

// Ray-box intersection
float rayBoxIntersect(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    float tNear = max(max(tmin.x, tmin.y), tmin.z);
    float tFar = min(min(tmax.x, tmax.y), tmax.z);

    if (tNear > tFar || tFar < 0.0) {
        return -1.0; // No intersection
    }

    return tNear; // Return the closest intersection
}

// Ray-plane intersection
float rayPlaneIntersect(vec3 rayOrigin, vec3 rayDir, vec3 planeNormal, float planeDist) {
    float denom = dot(planeNormal, rayDir);
    if (abs(denom) > EPSILON) {
        float t = -(dot(rayOrigin, planeNormal) + planeDist) / denom;
        if (t >= 0.0) {
            return t; // Return the intersection
        }
    }
    return -1.0; // No intersection
}

// Fresnel Schlick approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// Normal Distribution Function (Trowbridge-Reitz GGX)
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return a2 / denom;
}

// Geometry Function (Schlick-GGX)
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's method for geometry attenuation
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = geometrySchlickGGX(NdotV, roughness);
    float ggx2 = geometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

bool isInShadow(vec3 hitPoint, vec3 lightSample, vec3 normal) {
    vec3 shadowRayDir = normalize(lightSample - hitPoint);
    vec3 shadowRayOrigin = hitPoint + normal * EPSILON; // Offset to avoid self-intersection

    // Check for intersections with objects
    for (int i = 0; i < NUM_OBJECTS; i++) {
        float t = -1.0;
        if (objects[i].type == OBJECT_TYPE_SPHERE) {
            t = raySphereIntersect(shadowRayOrigin, shadowRayDir, objects[i].position, objects[i].dimensions.x);
        } else if (objects[i].type == OBJECT_TYPE_BOX) {
            vec3 boxMin = objects[i].position - objects[i].dimensions;
            vec3 boxMax = objects[i].position + objects[i].dimensions;
            t = rayBoxIntersect(shadowRayOrigin, shadowRayDir, boxMin, boxMax);
        } else if (objects[i].type == OBJECT_TYPE_PLANE) {
            t = rayPlaneIntersect(shadowRayOrigin, shadowRayDir, objects[i].dimensions, dot(objects[i].dimensions, objects[i].position));
        }

        // If there's an intersection, the point is in shadow
        if (t > 0.0 && t < length(lightSample - hitPoint)) {
            return true;
        }
    }

    return false;
}

// PBR Shading
vec3 pbrShading(Material material, vec3 N, vec3 V, vec3 L) {
    vec3 H = normalize(V + L);
    vec3 F0 = mix(vec3(0.04), material.albedo, material.metallic); // Base reflectivity
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, material.roughness);
    float G = geometrySmith(N, V, L, material.roughness);
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + EPSILON;
    vec3 specular = numerator / denominator;

    // Energy conservation
    vec3 kS = F; // Specular reflection
    vec3 kD = (vec3(1.0) - kS) * (1.0 - material.metallic); // Diffuse reflection

    // Lambertian diffuse
    vec3 diffuse = kD * material.albedo / PI;

    return (diffuse + specular) * max(dot(N, L), 0.0);
}

// PBR Shading with area light
vec3 pbrShadingAreaLight(Material material, vec3 N, vec3 V, vec3 hitPoint) {
    vec3 lightColor = vec3(0.0);

    for (int i = 0; i < NUM_SAMPLES; i++) {
        // Generate random UV coordinates for sampling the light
        vec2 uv = vec2(random(vec2(float(i), 0.0)), random(vec2(0.0, float(i))));
        uv = uv * 2.0 - 1.0; // Map from [0, 1] to [-1, 1]

        // Sample a point on the area light
        vec3 lightSample = sampleAreaLight(uv);

        // Check if the point is in shadow
        if (!isInShadow(hitPoint, lightSample, N)) {
            // Compute the light direction and distance
            vec3 L = normalize(lightSample - hitPoint);
            float distance = length(lightSample - hitPoint);
            float attenuation = 1.0 / (distance * distance); // Inverse square falloff

            // Compute the light contribution
            lightColor += pbrShading(material, N, V, L) * areaLight.color * attenuation;
        }
    }

    // Average the light contributions
    return lightColor / float(NUM_SAMPLES);
}

// Generate a random direction using cosine-weighted sampling
vec3 randomDirection(vec2 randUV) {
    float theta = 2.0 * PI * randUV.x;
    float phi = acos(sqrt(randUV.y));
    return vec3(sin(phi) * cos(theta), sin(phi) * sin(theta), cos(phi));
}

vec3 getSceneColor(vec3 rayOrigin, vec3 rayDir) {
    vec3 color = vec3(0.0);
    vec3 throughput = vec3(1.0); // Accumulates the contribution of each bounce

    for (int depth = 0; depth < MAX_DEPTH; depth++) {
        float tMin = 1000.0;
        vec3 normal = vec3(0.0);
        Material material = Material(vec3(0.0), 0.0, 0.0);
        vec3 hitPoint = vec3(0.0);
        int closestObjectType = -1; // Store the type of the closest object

        // Intersect with all objects
        for (int i = 0; i < NUM_OBJECTS; i++) {
            float t = -1.0;
            if (objects[i].type == OBJECT_TYPE_SPHERE) {
                t = raySphereIntersect(rayOrigin, rayDir, objects[i].position, objects[i].dimensions.x);
            } else if (objects[i].type == OBJECT_TYPE_BOX) {
                vec3 boxMin = objects[i].position - objects[i].dimensions;
                vec3 boxMax = objects[i].position + objects[i].dimensions;
                t = rayBoxIntersect(rayOrigin, rayDir, boxMin, boxMax);
            } else if (objects[i].type == OBJECT_TYPE_PLANE) {
                t = rayPlaneIntersect(rayOrigin, rayDir, objects[i].dimensions, dot(objects[i].dimensions, objects[i].position));
            }

            // Check if this intersection is closer than the previous closest
            if (t > 0.0 && t < tMin) {
                tMin = t;
                hitPoint = rayOrigin + t * rayDir;
                closestObjectType = objects[i].type; // Store the type of the closest object

                // Calculate the normal and material for the closest object
                if (objects[i].type == OBJECT_TYPE_SPHERE) {
                    normal = normalize(hitPoint - objects[i].position);
                } else if (objects[i].type == OBJECT_TYPE_BOX) {
                    vec3 localHit = hitPoint - objects[i].position;
                    vec3 absLocalHit = abs(localHit);
                    if (absLocalHit.x > absLocalHit.y && absLocalHit.x > absLocalHit.z) {
                        normal = vec3(sign(localHit.x), 0.0, 0.0);
                    } else if (absLocalHit.y > absLocalHit.z) {
                        normal = vec3(0.0, sign(localHit.y), 0.0);
                    } else {
                        normal = vec3(0.0, 0.0, sign(localHit.z));
                    }
                } else if (objects[i].type == OBJECT_TYPE_PLANE) {
                    normal = objects[i].dimensions;
                }
                material = objects[i].material;
            }
        }

        // If no intersection, break the loop
        if (tMin >= 1000.0) {
            break;
        }

        // Lighting with area light
        vec3 V = normalize(u_cameraPos - hitPoint);
        vec3 directColor = pbrShadingAreaLight(material, normal, V, hitPoint);
        color += throughput * directColor;

        // Add reflections (if material is metallic)
        if (material.metallic > 0.0) {
            vec3 reflectionDir = reflectRay(V, normal);
            rayOrigin = hitPoint + normal * EPSILON; // Offset to avoid self-intersection
            rayDir = reflectionDir;
            throughput *= material.metallic; // Scale by material reflectivity
        } else {
            break; // No further bounces for non-metallic surfaces
        }
    }

    return color;
}
    
// Initialize scene
void initScene() {
    // Area light
    areaLight.position = vec3(0.0, 1.5, 0.0); // Position the light above the scene
    areaLight.normal = vec3(0.0, -1.0, 0.0);  // Light points downward
    areaLight.right = vec3(1.0, 0.0, 0.0);    // Light extends along the X-axis
    areaLight.up = vec3(0.0, 0.0, 1.0);       // Light extends along the Z-axis
    areaLight.width = 1.0;                    // Half-width of the light
    areaLight.height = 1.0;                   // Half-height of the light
    areaLight.color = vec3(1.0, 1.0, 1.0) * 10.0; // Bright light

    // Room walls (planes)
    objects[0] = Object(OBJECT_TYPE_PLANE, vec3(0.0, -1.0, 0.0), vec3(0.0, 1.0, 0.0), Material(vec3(0.8, 0.8, 0.8), 0.0, 0.8)); // Floor
    objects[1] = Object(OBJECT_TYPE_PLANE, vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0), Material(vec3(0.8, 0.8, 0.8), 0.0, 0.8));  // Ceiling
    objects[2] = Object(OBJECT_TYPE_PLANE, vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), Material(vec3(0.8, 0.8, 0.8), 0.0, 0.8));  // Right wall
    objects[3] = Object(OBJECT_TYPE_PLANE, vec3(-1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0), Material(vec3(0.8, 0.8, 0.8), 0.0, 0.8)); // Left wall
    objects[4] = Object(OBJECT_TYPE_PLANE, vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, -1.0), Material(vec3(0.8, 0.8, 0.8), 0.0, 0.8)); // Back wall

    // Sphere
    objects[5] = Object(OBJECT_TYPE_SPHERE, vec3(-0.5, -0.5, 1.5), vec3(0.5, 0.0, 0.0), Material(vec3(0.2, 0.2, 0.2), 1.0, 0.1));
    objects[6] = Object(OBJECT_TYPE_SPHERE, vec3(0.5, -0.5, 1.2), vec3(0.5, 0.0, 0.0), Material(vec3(0.2, 0.8, 0.2), 0.0, 0.2));
    // metallic / roughness
}

void main() {
    // Initialize scene
    initScene();

    // Ray setup
    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    // Position the camera outside the room
    vec3 rayOrigin = vec3(0.0, 0.0, 3.5); // Camera position
    vec3 rayDir = normalize(vec3(uv, -1.0));

    // Render scene with reflections and global illumination
    vec3 color = getSceneColor(rayOrigin, rayDir);

    // Apply exposure control
    float exposure = 1.0; // Adjust as needed
    color = vec3(1.0) - exp(-color * exposure);

    gl_FragColor = vec4(color, 1.0);
}
`;

//
// Render normals
//    if (tMin < 1000.0) {
//       return normal * 0.5 + 0.5; // Map normals from [-1, 1] to [0, 1]
//   }
