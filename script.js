const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050510, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;
camera.position.y = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffd700, 1, 100);
pointLight.position.set(0, 20, 10);
scene.add(pointLight);

const PARTICLE_COUNT = 3000;
const geometry = new THREE.BufferGeometry();
const material = new THREE.PointsMaterial({
    size: 0.4,
    color: 0xffffff,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const treePositions = [];
const galaxyPositions = [];
const colors = [];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = i * 0.1;
    const height = 40;
    const y = (i / PARTICLE_COUNT) * height - (height / 2);
    const radius = (1 - (y + height / 2) / height) * 10;
    const randomX = (Math.random() - 0.5) * 1.5;
    const randomZ = (Math.random() - 0.5) * 1.5;
    const x = Math.cos(angle) * radius + randomX;
    const z = Math.sin(angle) * radius + randomZ;
    treePositions.push(x, y, z);

    const r = 40 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const gx = r * Math.sin(phi) * Math.cos(theta);
    const gy = r * Math.sin(phi) * Math.sin(theta);
    const gz = r * Math.cos(phi);
    galaxyPositions.push(gx, gy, gz);

    const colorType = Math.random();
    const color = new THREE.Color();
    if (colorType > 0.9) color.setHex(0xff0000);
    else if (colorType > 0.8) color.setHex(0xffd700);
    else if (colorType > 0.7) color.setHex(0xffffff);
    else color.setHex(0x228b22);
    colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const particles = new THREE.Points(geometry, material);
scene.add(particles);

const photoGroup = new THREE.Group();
scene.add(photoGroup);

document.getElementById('photo-upload').addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    while (photoGroup.children.length > 0) {
        photoGroup.remove(photoGroup.children[0]);
    }
    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const tex = new THREE.Texture(img);
                tex.needsUpdate = true;
                const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
                const geom = new THREE.PlaneGeometry(5, 5);
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(
                    (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 10
                );
                mesh.visible = false;
                photoGroup.add(mesh);
            }
        };
        reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张照片！`);
});

const STATE = {
    TREE: 'tree',
    GALAXY: 'galaxy'
};
let currentState = STATE.TREE;

function morphTo(shape) {
    if (shape === currentState) return;
    currentState = shape;
    const targetArray = shape === STATE.TREE ? treePositions : galaxyPositions;
    const currentAttr = particles.geometry.attributes.position;
    const tweenObj = { t: 0 };
    const startPositions = Float32Array.from(currentAttr.array);

    gsap.to(tweenObj, {
        t: 1,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
            for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
                currentAttr.array[i] = startPositions[i] + (targetArray[i] - startPositions[i]) * tweenObj.t;
            }
            currentAttr.needsUpdate = true;
        }
    });

    photoGroup.children.forEach(mesh => {
        mesh.visible = (shape === STATE.GALAXY);
        if (mesh.visible) {
            gsap.to(mesh.scale, { x: 0, y: 0, duration: 0.5 });
        }
    });
}

function showRandomPhoto() {
    if (photoGroup.children.length === 0) return;
    const randomIndex = Math.floor(Math.random() * photoGroup.children.length);
    const photo = photoGroup.children[randomIndex];
    photo.visible = true;
    photo.position.set(0, 0, 20);
    photo.lookAt(camera.position);
    gsap.to(photo.scale, { x: 1.5, y: 1.5, duration: 0.5, ease: "back.out(1.7)" });
    setTimeout(() => {
        gsap.to(photo.scale, {
            x: 0, y: 0, duration: 0.5, onComplete: () => {
                photo.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 10);
            }
        });
    }, 3000);
}

const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loader = document.getElementById('loader');

function detectGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    function dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    const fingerTips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const isFingersClosed = fingerTips.every(tip => dist(tip, wrist) < 0.35);
    const pinchDist = dist(thumbTip, indexTip);
    if (isFingersClosed) return 'FIST';
    if (pinchDist < 0.05) return 'PINCH';
    return 'OPEN';
}

function onResults(results) {
    if (loader) loader.style.display = 'none';
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
        const gesture = detectGesture(landmarks);
        if (gesture === 'FIST') morphTo(STATE.TREE);
        if (gesture === 'OPEN') {
            morphTo(STATE.GALAXY);
            const palmX = landmarks[9].x;
            const rotSpeed = (palmX - 0.5) * 4;
            scene.rotation.y += rotSpeed * 0.05;
        }
        if (gesture === 'PINCH') {
            if (!window.isPinchingLocked) {
                showRandomPhoto();
                window.isPinchingLocked = true;
                setTimeout(() => window.isPinchingLocked = false, 2000);
            }
        }
    }
    canvasCtx.restore();
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://unpkg.com/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 320,
    height: 240
});
cameraUtils.start();

function animate() {
    requestAnimationFrame(animate);
    if (currentState === STATE.TREE) {
        particles.rotation.y += 0.002;
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
    if (loader) loader.style.display = 'none';
    const key = event.key.toLowerCase();
    if (event.code === 'Space') {
        if (currentState === STATE.TREE) morphTo(STATE.GALAXY);
        else morphTo(STATE.TREE);
    }
    if (key === 'p') {
        showRandomPhoto();
    }
});

window.addEventListener('mousemove', (event) => {
    if (currentState === STATE.GALAXY) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        scene.rotation.y = mouseX * 1.5;
    }
});

setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "加载超时，已启用键盘模式";
        setTimeout(() => loader.style.display = 'none', 2000);
    }
}, 8000);
