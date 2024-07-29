import CANNON from "cannon";
import * as lil from "lil-gui";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float iTime;
uniform vec2 iResolution;
varying vec2 vUv;
uniform float uTransparency;
// Original shader code from https://www.shadertoy.com/view/WtG3RD

const float cloudscale = 1.1;
const float speed = 0.03;
const float clouddark = 0.5;
const float cloudlight = 0.3;
const float cloudcover = 0.2;
const float cloudalpha = 8.0;
const float skytint = 0.5;
const vec3 skycolour1 = vec3(0.2, 0.4, 0.6);
const vec3 skycolour2 = vec3(0.4, 0.7, 1.0);

const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
    return dot(n, vec3(70.0));
}

float fbm(vec2 n) {
    float total = 0.0, amplitude = 0.1;
    for (int i = 0; i < 7; i++) {
        total += noise(n) * amplitude;
        n = m * n;
        amplitude *= 0.4;
    }
    return total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = fragCoord.xy / iResolution.xy;
    vec2 uv = p * vec2(iResolution.x / iResolution.y, 1.0);
    float time = iTime * speed;
    float q = fbm(uv * cloudscale * 0.5);

    float r = 0.0;
    uv *= cloudscale;
    uv -= q - time;
    float weight = 0.8;
    for (int i = 0; i < 8; i++) {
        r += abs(weight * noise(uv));
        uv = m * uv + time;
        weight *= 0.7;
    }

    float f = 0.0;
    uv = p * vec2(iResolution.x / iResolution.y, 1.0);
    uv *= cloudscale;
    uv -= q - time;
    weight = 0.7;
    for (int i = 0; i < 8; i++) {
        f += weight * noise(uv);
        uv = m * uv + time;
        weight *= 0.6;
    }

    f *= r + f;

    float c = 0.0;
    time = iTime * speed * 2.0;
    uv = p * vec2(iResolution.x / iResolution.y, 1.0);
    uv *= cloudscale * 2.0;
    uv -= q - time;
    weight = 0.4;
    for (int i = 0; i < 7; i++) {
        c += weight * noise(uv);
        uv = m * uv + time;
        weight *= 0.6;
    }

    float c1 = 0.0;
    time = iTime * speed * 3.0;
    uv = p * vec2(iResolution.x / iResolution.y, 1.0);
    uv *= cloudscale * 3.0;
    uv -= q - time;
    weight = 0.4;
    for (int i = 0; i < 7; i++) {
        c1 += abs(weight * noise(uv));
        uv = m * uv + time;
        weight *= 0.6;
    }

    c += c1;

    vec3 skycolour = mix(skycolour2, skycolour1, p.y);
    vec3 cloudcolour = vec3(1.1, 1.1, 0.9) * clamp((clouddark + cloudlight * c), 0.0, 1.0);

    f = cloudcover + cloudalpha * f * r;

    vec3 result = mix(skycolour, clamp(skytint * skycolour + cloudcolour, 0.0, 1.0), clamp(f + c, 0.0, 1.0));

    fragColor = vec4(result, uTransparency);
}

void main() {
    mainImage(gl_FragColor, vUv * iResolution);
}
`;

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
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
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
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
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
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
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
