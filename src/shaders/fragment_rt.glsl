precision highp float;

varying vec2 vUv;

#define MAX_BOUNCES 4
#define PI 3.14159265359
#define INF 1e20
#define EPS 1e-4

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform vec3 uSkyTopColor;
uniform vec3 uSkyBottomColor;
uniform float uSkyIntensity;
uniform sampler2D uBVHNodes;       // RGBA32F-packed BVH node buffer
uniform sampler2D uTriangles;      // RGBA32F-packed triangle buffer
uniform sampler2D uPrevAccum;      // previous accumulation buffer
uniform sampler2D uPrevMoments;    // temporal variance buffer
uniform int uFrameIndex;
uniform bool uUseTemporalDenoise;
uniform bool uUseSpatialDenoise;

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct Hit {
    float t;
    int triIndex;
    vec3 normal;
    vec3 albedo;
    float metallic;
    float roughness;
};

struct BVHNode {
    vec3 minBounds;
    float leftChild;
    vec3 maxBounds;
    float rightChild;
};

struct Triangle {
    vec3 v0;
    float materialIndex;
    vec3 v1;
    float pad1;
    vec3 v2;
    float pad2;
};

float rand(inout vec2 seed) {
    float r = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453123);
    seed = seed + vec2(1.0, 1.0);
    return r;
}

vec2 rand2(inout vec2 seed) {
    return vec2(rand(seed), rand(seed));
}

BVHNode fetchNode(int index) {
    ivec2 coord = ivec2(index % textureSize(uBVHNodes, 0).x, index / textureSize(uBVHNodes, 0).x);
    vec4 minData = texelFetch(uBVHNodes, coord, 0);
    vec4 maxData = texelFetch(uBVHNodes, coord + ivec2(0, textureSize(uBVHNodes, 0).y / 2), 0);
    BVHNode node;
    node.minBounds = minData.xyz;
    node.leftChild = minData.w;
    node.maxBounds = maxData.xyz;
    node.rightChild = maxData.w;
    return node;
}

Triangle fetchTriangle(int index) {
    ivec2 coord = ivec2(index % textureSize(uTriangles, 0).x, index / textureSize(uTriangles, 0).x);
    vec4 v0 = texelFetch(uTriangles, coord, 0);
    vec4 v1 = texelFetch(uTriangles, coord + ivec2(0, textureSize(uTriangles, 0).y / 3), 0);
    vec4 v2 = texelFetch(uTriangles, coord + ivec2(0, 2 * textureSize(uTriangles, 0).y / 3), 0);
    Triangle tri;
    tri.v0 = v0.xyz;
    tri.materialIndex = v0.w;
    tri.v1 = v1.xyz;
    tri.v2 = v2.xyz;
    return tri;
}

bool intersectAABB(Ray ray, vec3 minB, vec3 maxB, float tMin, float tMax) {
    for (int i = 0; i < 3; ++i) {
        float invD = 1.0 / ray.direction[i];
        float t0 = (minB[i] - ray.origin[i]) * invD;
        float t1 = (maxB[i] - ray.origin[i]) * invD;
        if (invD < 0.0) {
            float tmp = t0;
            t0 = t1;
            t1 = tmp;
        }
        tMin = max(tMin, t0);
        tMax = min(tMax, t1);
        if (tMax <= tMin) {
            return false;
        }
    }
    return true;
}

bool intersectTriangle(Ray ray, Triangle tri, out float t, out vec3 normal) {
    vec3 edge1 = tri.v1 - tri.v0;
    vec3 edge2 = tri.v2 - tri.v0;
    vec3 pvec = cross(ray.direction, edge2);
    float det = dot(edge1, pvec);
    if (abs(det) < EPS) {
        return false;
    }
    float invDet = 1.0 / det;
    vec3 tvec = ray.origin - tri.v0;
    float u = dot(tvec, pvec) * invDet;
    if (u < 0.0 || u > 1.0) {
        return false;
    }
    vec3 qvec = cross(tvec, edge1);
    float v = dot(ray.direction, qvec) * invDet;
    if (v < 0.0 || u + v > 1.0) {
        return false;
    }
    t = dot(edge2, qvec) * invDet;
    if (t < EPS) {
        return false;
    }
    normal = normalize(cross(edge1, edge2));
    return true;
}

bool traverseBVH(Ray ray, out Hit hit) {
    hit.t = INF;
    hit.triIndex = -1;
    int stack[64];
    int stackPtr = 0;
    stack[stackPtr++] = 0;
    while (stackPtr > 0) {
        int nodeIndex = stack[--stackPtr];
        BVHNode node = fetchNode(nodeIndex);
        if (!intersectAABB(ray, node.minBounds, node.maxBounds, EPS, hit.t)) {
            continue;
        }
        bool isLeaf = (node.leftChild < 0.0);
        if (isLeaf) {
            int start = int(node.rightChild);
            int count = int(-node.leftChild);
            for (int i = 0; i < count; ++i) {
                Triangle tri = fetchTriangle(start + i);
                float t;
                vec3 normal;
                if (intersectTriangle(ray, tri, t, normal) && t < hit.t) {
                    hit.t = t;
                    hit.triIndex = start + i;
                    hit.normal = normal;
                    hit.albedo = vec3(0.8); // placeholder
                    hit.metallic = 0.1;
                    hit.roughness = 0.3;
                }
            }
        } else {
            stack[stackPtr++] = int(node.leftChild);
            stack[stackPtr++] = int(node.rightChild);
        }
    }
    return hit.triIndex != -1;
}

vec3 environmentColor(vec3 dir) {
    float t = clamp(0.5 * (dir.y + 1.0), 0.0, 1.0);
    vec3 sky = mix(uSkyBottomColor, uSkyTopColor, t);
    vec3 ground = uSkyBottomColor;
    return mix(ground, sky, smoothstep(-0.05, 0.2, dir.y)) * uSkyIntensity;
}

vec3 importanceSampleGGX(vec2 xi, vec3 normal, float roughness) {
    float a = roughness * roughness;
    float phi = 2.0 * PI * xi.x;
    float cosTheta = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    vec3 H = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
    vec3 up = abs(normal.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    return normalize(TBN * H);
}

vec3 shadePath(Ray ray, inout vec2 seed) {
    vec3 throughput = vec3(1.0);
    vec3 radiance = vec3(0.0);
    for (int bounce = 0; bounce < MAX_BOUNCES; ++bounce) {
        Hit hit;
        if (!traverseBVH(ray, hit)) {
            radiance += throughput * environmentColor(ray.direction);
            break;
        }

        vec3 hitPos = ray.origin + ray.direction * hit.t;
        vec3 normal = normalize(hit.normal);
        vec3 viewDir = normalize(-ray.direction);

        vec3 F0 = mix(vec3(0.04), hit.albedo, hit.metallic);
        vec2 xi = rand2(seed);
        vec3 H = importanceSampleGGX(xi, normal, hit.roughness);
        vec3 nextDir = normalize(reflect(-viewDir, H));
        float NdotL = max(dot(normal, nextDir), 0.0);

        if (hit.metallic < 0.01) {
            throughput *= hit.albedo * NdotL;
        } else {
            throughput *= mix(hit.albedo, F0, 0.5) * NdotL;
        }

        if (bounce > 1) {
            float p = max(throughput.r, max(throughput.g, throughput.b));
            if (rand(seed) > p) {
                break;
            }
            throughput /= p;
        }

        ray.origin = hitPos + normal * EPS;
        ray.direction = nextDir;
    }
    return radiance;
}

vec3 denoiseSpatial(vec2 uv, vec3 color) {
    vec2 texel = 1.0 / uResolution;
    vec3 sum = vec3(0.0);
    float weightSum = 0.0;
    for (int x = -1; x <= 1; ++x) {
        for (int y = -1; y <= 1; ++y) {
            vec2 offset = uv + vec2(float(x), float(y)) * texel;
            vec3 sampleColor = texture(uPrevAccum, offset).rgb;
            float w = exp(-float(x * x + y * y));
            sum += sampleColor * w;
            weightSum += w;
        }
    }
    return mix(color, sum / weightSum, 0.25);
}

void main() {
    vec2 seed = vUv * vec2(23.17, 91.7) + float(uFrameIndex);
    vec2 jitter = (rand2(seed) - 0.5) / uResolution;
    vec2 uv = vUv * 2.0 - 1.0 + jitter;
    uv.x *= uResolution.x / uResolution.y;

    vec3 forward = normalize(uCameraTarget - uCameraPos);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, forward));
    float focalLength = 1.4;
    vec3 dir = normalize(forward * focalLength + right * uv.x + up * uv.y);
    Ray ray = Ray(uCameraPos, dir);

    vec3 color = shadePath(ray, seed);
    vec3 accumulated = color;
    if (uUseTemporalDenoise) {
        vec3 prev = texture(uPrevAccum, vUv).rgb;
        float blend = uFrameIndex > 0 ? 1.0 / (float(uFrameIndex) + 1.0) : 1.0;
        accumulated = mix(prev, color, blend);
    }

    if (uUseSpatialDenoise) {
        accumulated = denoiseSpatial(vUv, accumulated);
    }

    gl_FragColor = vec4(accumulated, 1.0);
}
