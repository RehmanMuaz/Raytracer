precision highp float;

varying vec2 vUv;

#define MAX_SHAPES 8
#define MAX_AREA_LIGHTS 3
#define FAR_PLANE 80.0
#define EPSILON 0.0008

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform vec3 uSkyTopColor;
uniform vec3 uSkyBottomColor;
uniform float uSkyIntensity;

uniform int uShapeCount;
uniform vec4 uShapePosType[MAX_SHAPES];
uniform vec4 uShapeScale[MAX_SHAPES];
uniform vec4 uShapeColorMetal[MAX_SHAPES];
uniform vec4 uShapeRoughAO[MAX_SHAPES];
uniform mat3 uShapeRotation[MAX_SHAPES];

uniform int uAreaLightCount;
uniform vec4 uAreaLightPosIntensity[MAX_AREA_LIGHTS];
uniform vec4 uAreaLightNormal[MAX_AREA_LIGHTS];
uniform vec4 uAreaLightSize[MAX_AREA_LIGHTS];
uniform vec4 uAreaLightColor[MAX_AREA_LIGHTS];

const float PI = 3.14159265359;

struct Hit {
    float dist;
    int index;
};

struct Material {
    vec3 albedo;
    float metallic;
    float roughness;
    float ao;
    float shaderType;
};

float hash11(float p) {
    return fract(sin(p * 127.1) * 43758.5453123);
}

vec2 hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float sdPlane(vec3 p) {
    return p.y;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCylinder(vec3 p, vec2 h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - h;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float mapScene(vec3 p, out int shapeIndex) {
    float minDist = FAR_PLANE;
    shapeIndex = -1;
    for (int i = 0; i < MAX_SHAPES; i++) {
        if (i >= uShapeCount) {
            break;
        }
        vec4 posType = uShapePosType[i];
        vec3 pos = posType.xyz;
        float typeId = posType.w;
        vec3 local = p - pos;
        local = uShapeRotation[i] * local;
        vec3 scale = uShapeScale[i].xyz;

        float d = 0.0;
        if (typeId < 0.5) {
            d = sdSphere(local, scale.x);
        } else if (typeId < 1.5) {
            d = sdBox(local, scale);
        } else if (typeId < 2.5) {
            d = sdPlane(local);
        } else if (typeId < 3.5) {
            d = sdTorus(local, scale.xy);
        } else {
            d = sdCylinder(local, scale.xy);
        }

        if (d < minDist) {
            minDist = d;
            shapeIndex = i;
        }
    }
    return minDist;
}

Hit traceScene(vec3 ro, vec3 rd) {
    float travel = 0.0;
    Hit hit;
    hit.index = -1;
    hit.dist = FAR_PLANE;

    for (int i = 0; i < 160; i++) {
        vec3 pos = ro + rd * travel;
        int idx;
        float d = mapScene(pos, idx);
        if (d < EPSILON) {
            hit.dist = travel;
            hit.index = idx;
            return hit;
        }
        travel += d;
        if (travel > FAR_PLANE) {
            break;
        }
    }
    hit.dist = travel;
    return hit;
}

Hit traceSceneSkip(vec3 ro, vec3 rd, int skipIndex) {
    float travel = 0.0;
    Hit hit;
    hit.index = -1;
    hit.dist = FAR_PLANE;

    for (int i = 0; i < 160; i++) {
        vec3 pos = ro + rd * travel;
        int idx;
        float d = mapScene(pos, idx);

        if (idx == skipIndex && d < EPSILON) {
            d = EPSILON;
        } else if (d < EPSILON) {
            hit.dist = travel;
            hit.index = idx;
            return hit;
        }

        travel += d;
        if (travel > FAR_PLANE) {
            break;
        }
    }

    hit.dist = travel;
    return hit;
}

vec3 estimateNormal(vec3 p) {
    int idx;
    vec2 e = vec2(0.001, 0.0);
    float dx = mapScene(p + vec3(e.x, e.y, e.y), idx) - mapScene(p - vec3(e.x, e.y, e.y), idx);
    float dy = mapScene(p + vec3(e.y, e.x, e.y), idx) - mapScene(p - vec3(e.y, e.x, e.y), idx);
    float dz = mapScene(p + vec3(e.y, e.y, e.x), idx) - mapScene(p - vec3(e.y, e.y, e.x), idx);
    return normalize(vec3(dx, dy, dz));
}

Material getMaterial(int idx) {
    Material m;
    m.albedo = uShapeColorMetal[idx].rgb;
    m.metallic = clamp(uShapeColorMetal[idx].w, 0.0, 1.0);
    m.roughness = clamp(uShapeRoughAO[idx].x, 0.05, 1.0);
    m.ao = clamp(uShapeRoughAO[idx].y, 0.0, 1.0);
    m.shaderType = uShapeRoughAO[idx].z;
    return m;
}

float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = geometrySchlickGGX(NdotV, roughness);
    float ggx2 = geometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float softShadow(vec3 ro, vec3 rd, float maxDistance) {
    float shadow = 1.0;
    float distance = 0.02;
    for (int i = 0; i < 32; i++) {
        if (distance >= maxDistance) {
            break;
        }
        int idx;
        float h = mapScene(ro + rd * distance, idx);
        if (h < EPSILON) {
            return 0.0;
        }
        shadow = min(shadow, 10.0 * h / distance);
        distance += clamp(h, 0.01, 0.5);
    }
    return clamp(shadow, 0.0, 1.0);
}

float calcAO(vec3 pos, vec3 normal) {
    float occ = 0.0;
    float dist = 0.02;
    for (int i = 0; i < 5; i++) {
        int idx;
        float d = mapScene(pos + normal * dist, idx);
        occ += (dist - d) * (1.0 / (1.0 + float(i)));
        dist *= 1.6;
    }
    return clamp(1.0 - occ * 0.4, 0.0, 1.0);
}

vec3 hemisphereSample(vec3 normal, vec2 rnd) {
    float phi = 2.0 * PI * rnd.x;
    float cosTheta = sqrt(1.0 - rnd.y);
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    vec3 tangent = normalize(abs(normal.y) < 0.99 ? cross(normal, vec3(0.0, 1.0, 0.0)) : cross(normal, vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = cross(tangent, normal);
    return normalize(tangent * cos(phi) * sinTheta + bitangent * sin(phi) * sinTheta + normal * cosTheta);
}

vec3 environmentColor(vec3 dir) {
    float t = clamp(0.5 * (dir.y + 1.0), 0.0, 1.0);
    vec3 sky = mix(uSkyBottomColor, uSkyTopColor, t);
    vec3 ground = uSkyBottomColor;
    vec3 blend = mix(ground, sky, smoothstep(-0.05, 0.2, dir.y));
    return blend * uSkyIntensity;
}

vec3 evaluateBRDF(vec3 N, vec3 V, vec3 L, Material mat, vec3 radiance) {
    vec3 H = normalize(V + L);
    float NDF = distributionGGX(N, H, mat.roughness);
    float G = geometrySmith(N, V, L, mat.roughness);
    vec3 F0 = mix(vec3(0.04), mat.albedo, mat.metallic);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.001;
    vec3 specular = numerator / denominator;

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - mat.metallic);
    vec3 diffuse = kD * mat.albedo / PI;

    float NdotL = max(dot(N, L), 0.0);
    return (diffuse + specular) * radiance * NdotL;
}

vec3 computeAreaLights(vec3 pos, vec3 normal, vec3 viewDir, Material mat, vec2 noiseSeed) {
    vec3 lighting = vec3(0.0);
    for (int i = 0; i < MAX_AREA_LIGHTS; i++) {
        if (i >= uAreaLightCount) {
            break;
        }

        vec3 lightPos = uAreaLightPosIntensity[i].xyz;
        float intensity = uAreaLightPosIntensity[i].w;
        vec3 lightNormal = normalize(uAreaLightNormal[i].xyz);
        vec2 halfSize = uAreaLightSize[i].xy;
        vec3 lightColor = uAreaLightColor[i].rgb * intensity;

        vec2 rand = hash21(noiseSeed + float(i) + uTime);
        vec2 offset = (rand - 0.5) * 2.0 * halfSize;

        vec3 tangent = normalize(abs(lightNormal.y) < 0.9 ? cross(lightNormal, vec3(0.0, 1.0, 0.0)) : cross(lightNormal, vec3(1.0, 0.0, 0.0)));
        vec3 bitangent = cross(lightNormal, tangent);

        vec3 samplePos = lightPos + tangent * offset.x + bitangent * offset.y;
        vec3 L = samplePos - pos;
        float dist = length(L);
        vec3 Ldir = normalize(L);

        float NdotL = max(dot(normal, Ldir), 0.0);
        float lambertOnLight = max(dot(-Ldir, lightNormal), 0.0);
        if (NdotL <= 0.0 || lambertOnLight <= 0.0) {
            continue;
        }

        float shadow = softShadow(pos + normal * EPSILON * 4.0, Ldir, dist - EPSILON * 8.0);
        vec3 radiance = lightColor * lambertOnLight / (dist * dist + 1.0);
        lighting += evaluateBRDF(normal, viewDir, Ldir, mat, radiance) * shadow;
    }
    return lighting;
}

vec3 sampleIndirect(vec3 pos, vec3 normal, Material mat, vec2 jitter) {
    vec3 dir = hemisphereSample(normal, jitter);
    Hit bounce = traceScene(pos + normal * EPSILON * 4.0, dir);
    if (bounce.index == -1) {
        return environmentColor(dir) * 0.4;
    }
    vec3 hitPos = pos + normal * EPSILON * 4.0 + dir * bounce.dist;
    vec3 hitNormal = estimateNormal(hitPos);
    Material bounceMat = getMaterial(bounce.index);
    float weight = max(dot(hitNormal, -dir), 0.0);
    return bounceMat.albedo * weight * bounceMat.ao;
}

vec3 sampleReflection(vec3 pos, vec3 normal, vec3 incident, Material mat) {
    vec3 reflDir = normalize(reflect(incident, normal));
    Hit hit = traceScene(pos + normal * EPSILON * 4.0, reflDir);
    vec3 fres = fresnelSchlick(max(dot(normal, -incident), 0.0), mix(vec3(0.04), mat.albedo, mat.metallic));
    if (hit.index == -1) {
        return environmentColor(reflDir) * fres;
    }
    vec3 hitPos = pos + normal * EPSILON * 4.0 + reflDir * hit.dist;
    Material bounceMat = getMaterial(hit.index);
    return bounceMat.albedo * fres * (1.0 - bounceMat.roughness * 0.5);
}

vec3 sampleTransmission(vec3 pos, vec3 normal, vec3 incident, vec3 tint, int currentIndex) {
    float etai = 1.0;
    float etat = 1.45;
    vec3 n = normal;
    float cosi = clamp(dot(-incident, n), -1.0, 1.0);
    if (cosi < 0.0) {
        cosi = -cosi;
        float temp = etai;
        etai = etat;
        etat = temp;
        n = -n;
    }
    float eta = etai / etat;
    float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
    vec3 dir;
    if (k < 0.0) {
        dir = normalize(reflect(incident, n));
    } else {
        dir = normalize(eta * incident + (eta * cosi - sqrt(max(k, 0.0))) * n);
    }
    vec3 origin = pos + dir * EPSILON * 4.0;
    Hit hit = traceSceneSkip(origin, dir, currentIndex);
    if (hit.index == -1) {
        return environmentColor(dir);
    }
    vec3 hitPos = origin + dir * hit.dist;
    Material bounceMat = getMaterial(hit.index);
    vec3 hitNormal = estimateNormal(hitPos);
    float weight = max(dot(hitNormal, -dir), 0.0);
    vec3 glassTint = mix(vec3(1.0), tint, 0.6);
    return bounceMat.albedo * weight * bounceMat.ao * glassTint;
}

vec3 shade(vec3 ro, vec3 rd, vec2 pixel) {
    Hit hit = traceScene(ro, rd);
    if (hit.index == -1) {
        return environmentColor(rd);
    }

    vec3 pos = ro + rd * hit.dist;
    vec3 normal = estimateNormal(pos);
    Material mat = getMaterial(hit.index);
    vec3 viewDir = normalize(-rd);

    float ao = calcAO(pos, normal) * mat.ao;
    vec2 randA = hash21(pixel + uTime);

    int shaderType = int(floor(mat.shaderType + 0.5));
    vec3 direct = computeAreaLights(pos, normal, viewDir, mat, pixel);
    vec3 indirect = sampleIndirect(pos, normal, mat, randA);
    vec3 reflection = sampleReflection(pos, normal, rd, mat);

    if (shaderType == 1) {
        vec3 transmission = sampleTransmission(pos, normal, rd, mat.albedo, hit.index);
        vec3 fresnel = fresnelSchlick(max(dot(normal, viewDir), 0.0), vec3(0.04));
        return reflection * fresnel + transmission * (vec3(1.0) - fresnel);
    }

    vec3 surfaceDiffuse = direct * ao + indirect * 0.35;
    vec3 surfaceSpec = reflection * (mat.metallic + (1.0 - mat.roughness) * 0.25);
    return surfaceDiffuse + surfaceSpec;
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    vec3 forward = normalize(uCameraTarget - uCameraPos);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, forward));
    float focal = 1.4;
    vec3 rd = normalize(forward * focal + right * uv.x + up * uv.y);

    vec3 color = shade(uCameraPos, rd, gl_FragCoord.xy);
    color = pow(color, vec3(0.4545));
    gl_FragColor = vec4(color, 1.0);
}
