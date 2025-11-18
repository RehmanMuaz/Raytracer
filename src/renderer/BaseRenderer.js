import * as THREE from "three";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";

const ThreeScene = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return () => {};
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(4, 2.5, 6);
    camera.lookAt(0, -0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;

    scene.background = new THREE.Color(0x040404);
    scene.environment = environment;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x151515,
        metalness: 0.15,
        roughness: 0.9,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6),
      new THREE.MeshStandardMaterial({
        color: 0x0c131a,
        metalness: 0.1,
        roughness: 0.6,
      })
    );
    backWall.position.set(0, 0, -4);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const makePhysicalMesh = (geometry, materialProps) => {
      const material = new THREE.MeshPhysicalMaterial({
        roughness: 0.4,
        metalness: 0.2,
        envMapIntensity: 1.4,
        clearcoat: 0,
        clearcoatRoughness: 0.15,
        ...materialProps,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const metallicSphere = makePhysicalMesh(
      new THREE.SphereGeometry(0.7, 64, 64),
      {
        color: 0xc6d8ff,
        metalness: 1,
        roughness: 0.08,
        clearcoat: 0.7,
        clearcoatRoughness: 0.05,
      }
    );
    metallicSphere.position.set(-1.8, -0.3, 0.4);

    const glassTorus = makePhysicalMesh(
      new THREE.TorusGeometry(0.55, 0.18, 64, 128),
      {
        color: 0xffffff,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.95,
        thickness: 1.0,
        envMapIntensity: 1.8,
      }
    );
    glassTorus.position.set(0, -0.2, 0);
    glassTorus.receiveShadow = false;

    const ceramicCylinder = makePhysicalMesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.4, 64),
      {
        color: 0x4433aa,
        metalness: 0.15,
        roughness: 0.85,
      }
    );
    ceramicCylinder.position.set(1.8, -0.8, -0.7);

    const brushedCube = makePhysicalMesh(new THREE.BoxGeometry(1, 1, 1), {
      color: 0xffc857,
      metalness: 0.6,
      roughness: 0.35,
    });
    brushedCube.position.set(-0.6, -0.7, -1.5);
    brushedCube.rotation.set(0.4, 0.7, 0.2);

    const emissiveOrb = makePhysicalMesh(
      new THREE.SphereGeometry(0.35, 32, 32),
      {
        color: 0xfff3d1,
        emissive: 0xffa75e,
        emissiveIntensity: 6,
        metalness: 0.1,
        roughness: 0.25,
      }
    );
    emissiveOrb.position.set(0.5, 0.7, 1.1);
    emissiveOrb.castShadow = false;
    emissiveOrb.receiveShadow = false;

    scene.add(
      metallicSphere,
      glassTorus,
      ceramicCylinder,
      brushedCube,
      emissiveOrb
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, -0.5, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    keyLight.position.set(5, 6, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.normalBias = 0.02;

    const fillLight = new THREE.PointLight(0xff9966, 15, 20);
    fillLight.position.set(-3, 2, -2);

    const rimLight = new THREE.SpotLight(0x7ec4ff, 10, 25, Math.PI / 4, 0.4);
    rimLight.position.set(0, 4, 4);
    rimLight.target = glassTorus;
    rimLight.castShadow = true;

    const ambient = new THREE.AmbientLight(0x202235, 0.4);

    scene.add(keyLight, fillLight, rimLight, ambient, rimLight.target);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      pmremGenerator.dispose();
      environment.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default ThreeScene;
