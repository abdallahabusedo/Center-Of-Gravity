import CANNON from "cannon";
import * as lil from "lil-gui";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import image1 from "./../public/Group 20266.png";
import image2 from "./../public/Group 20272.png";
import image3 from "./../public/Group 20273.png";
import image4 from "./../public/Group 20277.png";
import image5 from "./../public/Group 20279.png";
import image6 from "./../public/Group 20280.png";
import image7 from "./../public/Group 20281.png";
import image8 from "./../public/Group 20284.png";
import image9 from "./../public/Group 20286.png";
import image10 from "./../public/Group 20289.png";
import image11 from "./../public/Group 20293.png";
import image12 from "./../public/Path 12683.png";
import image13 from "./../public/Path 12684.png";

let scene,
  camera,
  renderer,
  ambientLight,
  directionalLight1,
  directionalLight2,
  spotLight;
let world;
// Parameters
const params = {
  gravityStrength: 100,
  dampingFactor: 0.98,
  gravityRadius: 10,
  repelStrength: 30,
  numberOfBaubles: 500,
  sphereColor: "#c0a0a0",
};
const baubles = [];
const baubleBodies = [];

const baubleMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
});
const planeGeometry = new THREE.PlaneGeometry(2, 2);
const cubeGeometry = new THREE.BoxGeometry(2, 2, 0.1); // Define cube geometry
const centerPosition = new THREE.Vector3(0, 0, 0);
const pointerPosition = new THREE.Vector3(0, 0, 0);

const textures = [
  new THREE.TextureLoader().load(image1),
  new THREE.TextureLoader().load(image2),
  new THREE.TextureLoader().load(image3),
  new THREE.TextureLoader().load(image4),
  new THREE.TextureLoader().load(image5),
  new THREE.TextureLoader().load(image6),
  new THREE.TextureLoader().load(image7),
  new THREE.TextureLoader().load(image8),
  new THREE.TextureLoader().load(image9),
  new THREE.TextureLoader().load(image10),
  new THREE.TextureLoader().load(image11),
  new THREE.TextureLoader().load(image12),
  new THREE.TextureLoader().load(image13),
];

const boundarySize = 10; // Define the size of the boundary
const velocityFactor = 0.5; // Factor to slow down the movement

// Initialize scene and start animation
init();
animate();

function init() {
  // Basic setup for Three.js
  scene = new THREE.Scene();
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

  // Load font and create text geometry
  const loader = new FontLoader();
  loader.load("/fonts/Soria_Soria.json", function (font) {
    const textGeometry = new TextGeometry("Abdallah  \n Abu Sedo", {
      font: font,
      size: 2,
      depth: 0.1,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 5,
    });
    const textMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(-5, 0); // Adjust position as needed
    scene.add(textMesh);
  });

  // Add controls
  // const controls = new OrbitControls(camera, renderer.domElement);
}

function createBauble(scale) {
  const texture = textures[Math.floor(Math.random() * textures.length)];
  const baubleMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const bauble = new THREE.Mesh(cubeGeometry, baubleMaterial); // Use cube geometry
  bauble.scale.set(scale, scale, scale);
  bauble.position.set(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10,
    Math.random() * 20 - 10
  );
  scene.add(bauble);
  baubles.push(bauble);

  const baubleShape = new CANNON.Box(new CANNON.Vec3(scale, scale, scale)); // Adjust shape to cube
  const baubleBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(
      bauble.position.x,
      bauble.position.y,
      bauble.position.z
    ),
  });
  baubleBody.addShape(baubleShape);
  baubleBody.addEventListener("collide", handleCollision);
  world.addBody(baubleBody);
  baubleBodies.push(baubleBody);
}

function handleCollision(event) {
  const body = event.target;
  const { x, y, z } = body.position;

  if (Math.abs(x) > boundarySize) body.velocity.x *= -1;
  if (Math.abs(y) > boundarySize) body.velocity.y *= -1;
  if (Math.abs(z) > boundarySize) body.velocity.z *= -1;
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

  world.step(1 / 60);

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
      body.velocity.x += attractionForce.x * velocityFactor;
      body.velocity.y += attractionForce.y * velocityFactor;
      body.velocity.z += attractionForce.z * velocityFactor;
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
      body.velocity.x += repelForce.x * velocityFactor;
      body.velocity.y += repelForce.y * velocityFactor;
      body.velocity.z += repelForce.z * velocityFactor;
    }

    // Apply damping to reduce velocity over time
    body.velocity.x *= params.dampingFactor;
    body.velocity.y *= params.dampingFactor;
    body.velocity.z *= params.dampingFactor;

    // Ensure baubles stay within the boundary
    if (Math.abs(body.position.x) > boundarySize) {
      body.position.x = Math.sign(body.position.x) * boundarySize;
      body.velocity.x *= -1;
    }
    if (Math.abs(body.position.y) > boundarySize) {
      body.position.y = Math.sign(body.position.y) * boundarySize;
      body.velocity.y *= -1;
    }
    if (Math.abs(body.position.z) > boundarySize) {
      body.position.z = Math.sign(body.position.z) * boundarySize;
      body.velocity.z *= -1;
    }

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
