import CANNON from "cannon";
import * as lil from "lil-gui";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import skyVertexShader from "./shaders/skyVertexShader.glsl";
import skyFragmentShader from "./shaders/skyFragmentShader.glsl";

let time = 0;
let material;
let cloud;
// initialize global variables
let scene,
  camera,
  renderer,
  ambientLight,
  directionalLight1,
  directionalLight2,
  spotLight;
let world;

// Parameters for the simulation
const params = {
  gravityStrength: 100,
  dampingFactor: 0.8,
  gravityRadius: 8,
  repelStrength: 55,
  numberOfBaubles: 300,
  sphereColor: "#c0a0a0",
};

// Arrays to store baubles and their corresponding Cannon.js bodies
const baubles = [];
const baubleBodies = [];

// Create bauble geometry and material
const baubleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    iTime: { value: 0 },
    iResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    uTransparency: { value: 0.9 },
  },
  transparent: true,
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
});
const sphereGeometry = new THREE.SphereGeometry(1, 28, 28);

// Create vectors to store positions
const centerPosition = new THREE.Vector3(0, 0, 0);
const pointerPosition = new THREE.Vector3(0, 0, 0);

// Initialize scene and start animation
init();
animate();

function init() {
  // Basic setup for Three.js
  scene = new THREE.Scene();
  const cubeTextureLoader = new THREE.CubeTextureLoader();
  const environmentMap = cubeTextureLoader.load([
    "/Standard-Cube-Map/px.png",
    "/Standard-Cube-Map/nx.png",
    "/Standard-Cube-Map/py.png",
    "/Standard-Cube-Map/ny.png",
    "/Standard-Cube-Map/pz.png",
    "/Standard-Cube-Map/nz.png",
  ]);

  scene.background = environmentMap;
  scene.backgroundRotation.y = 0.5;

  cloud = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uTransparency: { value: 0.8 },
      },
      transparent: true,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
    })
  );
  scene.add(cloud);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Set up Cannon.js world
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  spotLight = new THREE.SpotLight(0xffffff, 1);
  spotLight.position.set(20, 20, 25);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 512;
  spotLight.shadow.mapSize.height = 512;
  scene.add(spotLight);

  directionalLight1 = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight1.position.set(0, 5, -4);
  scene.add(directionalLight1);

  directionalLight2 = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight2.position.set(0, -15, 0);
  scene.add(directionalLight2);

  // Create initial baubles
  updateBaubles();

  // Add pointer
  document.addEventListener("mousemove", onMouseMove, false);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    uTransparency: { value: 1 },
  };

  material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
  });

  const geometry = new THREE.PlaneGeometry(200, 100);
  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, -40);
  scene.add(mesh);

  // Setup lil-gui
  const gui = new lil.GUI();
  gui.add(params, "gravityStrength", 1, 100, 1).name("Gravity Strength");
  gui.add(params, "dampingFactor", 0.9, 1, 0.01).name("Damping Factor");
  gui.add(params, "gravityRadius", 1, 20, 1).name("Gravity Radius");
  gui.add(params, "repelStrength", 1, 100, 1).name("Repel Strength");
  gui
    .add(params, "numberOfBaubles", 1, 1000, 1)
    .name("Number of Baubles")
    .onChange(updateBaubles);
  gui
    .addColor(params, "sphereColor")
    .name("Sphere Color")
    .onChange((value) => {
      baubleMaterial.color.set(value);
    });
  gui
    .add(material.uniforms.uTransparency, "value", 0, 1, 0.01)
    .name("Transparency");
  gui
    .add(cloud.material.uniforms.uTransparency, "value", 0, 1, 0.01)
    .name("Cloud Transparency");

  const consols = new OrbitControls(camera, renderer.domElement);

  // Load font and create text geometry
  const loader = new FontLoader();
  loader.load("/fonts/helvetiker_regular.typeface.json", function (font) {
    const textGeometry = new TextGeometry("Abdallah Abu Sedo", {
      font: font,
      size: 1,
      height: 0.2,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 5,
    });
    const textMaterial = new THREE.MeshLambertMaterial({ color: 0xffffa3 });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(-5, 0, 0); // Adjust position as needed
    scene.add(textMesh);
  });

  // Add controls
  // const controls = new OrbitControls(camera, renderer.domElement);
}

function createBauble(scale) {
  const bauble = new THREE.Mesh(sphereGeometry, baubleMaterial);
  bauble.scale.set(scale, scale, scale);
  bauble.position.set(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10,
    Math.random() * 20 - 10
  );
  scene.add(bauble);
  baubles.push(bauble);

  const baubleShape = new CANNON.Sphere(scale);
  const baubleBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(
      bauble.position.x,
      bauble.position.y,
      bauble.position.z
    ),
  });
  baubleBody.addShape(baubleShape);
  world.addBody(baubleBody);
  baubleBodies.push(baubleBody);
}

function updateBaubles() {
  // Remove existing baubles
  while (baubles.length > 0) {
    const bauble = baubles.pop();
    const baubleBody = baubleBodies.pop();
    scene.remove(bauble);
    world.removeBody(baubleBody);
  }

  // Create new baubles based on the updated parameter
  for (let i = 0; i < params.numberOfBaubles; i++) {
    const scale = [0.75, 0.75, 1, 1, 1.25][Math.floor(Math.random() * 5)];
    createBauble(scale);
  }
}

function onMouseMove(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(baubles);
  if (intersects.length > 0) {
    pointerPosition.copy(intersects[0].point);
  }
}

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;
  material.uniforms.iTime.value = time;
  world.step(1 / 60);

  // Update cloud shader uniforms
  cloud.material.uniforms.iTime.value = time;

  // Apply attractive force towards the center with damping
  baubleBodies.forEach((body, index) => {
    const bauble = baubles[index];
    const directionToCenter = new THREE.Vector3().subVectors(
      centerPosition,
      bauble.position
    );
    const distanceToCenter = directionToCenter.length();
    directionToCenter.normalize();

    // Apply attraction force only if the distance is greater than the gravity radius
    if (distanceToCenter > params.gravityRadius) {
      const attractionForce = directionToCenter.multiplyScalar(
        params.gravityStrength / (distanceToCenter * distanceToCenter)
      );
      body.velocity.x += attractionForce.x;
      body.velocity.y += attractionForce.y;
      body.velocity.z += attractionForce.z;
    }

    // Apply repelling force from the pointer
    const directionFromPointer = new THREE.Vector3().subVectors(
      bauble.position,
      pointerPosition
    );
    const distanceFromPointer = directionFromPointer.length();
    directionFromPointer.normalize();

    if (distanceFromPointer < params.gravityRadius) {
      const repelForce = directionFromPointer.multiplyScalar(
        params.repelStrength / (distanceFromPointer * distanceFromPointer)
      );
      body.velocity.x += repelForce.x;
      body.velocity.y += repelForce.y;
      body.velocity.z += repelForce.z;
    }

    // Apply damping to reduce velocity over time
    body.velocity.x *= params.dampingFactor;
    body.velocity.y *= params.dampingFactor;
    body.velocity.z *= params.dampingFactor;

    bauble.position.set(body.position.x, body.position.y, body.position.z);
    bauble.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w
    );
  });

  renderer.render(scene, camera);
}
