// ==================== 1. 基础场景初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 【修改】因为树变小了，把相机稍微拉近一点，视角更好
camera.position.set(0, 1, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping;
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 (Bloom 辉光) ====================
const renderScene = new THREE.RenderPass(scene, camera);
// 【修改】增强辉光半径，让大光球看起来更朦胧唯美
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,
    0.5,
    0.8
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// 灯光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffd700, 1.5);
dirLight.position.set(5, 15, 10);
scene.add(dirLight);

// ==================== 3. 自定义 Shader 粒子系统 (GPU 加速核心) ====================

const vertexShader = `
    uniform float uTime;
    uniform float uMixFactor;
    uniform float uPixelRatio;
    
    attribute vec3 positionTarget;
    attribute vec3 color;
    attribute float size;
    
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = color;
        
        // 1. 位置混合
        vec3 currentPos = mix(position, positionTarget, uMixFactor);
        
        // 2. 呼吸动画
        if (uMixFactor < 0.5) {
            float wave = sin(uTime * 0.5 + currentPos.y * 0.3) * 0.02;
            currentPos.x += 0.1 * wave;
            currentPos.z += 0.1 * wave;
        } else {
            // 星空旋转
            float angle = 0.05 * uTime * (1.0 - length(currentPos)/50.0);
            float x = currentPos.x * cos(angle) - currentPos.z * sin(angle);
            float z = currentPos.x * sin(angle) + currentPos.z * cos(angle);
            currentPos.x = x;
            currentPos.z = z;
        }

        vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // --- 【核心修改：粒子巨大化】 ---
        float twinkle = 0.8 + 0.1 * sin(uTime * 3.0 + position.x); 
        
        gl_PointSize = size * uPixelRatio * twinkle * (2000.0 / (-mvPosition.z + 20.0));
        
        vAlpha = smoothstep(2.0, 5.0, -mvPosition.z);
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        // 计算距离中心的距离 (0.0 到 0.5)
        float d = distance(gl_PointCoord, vec2(0.5));

        // 软边缘圆形
        if (d > 0.25) discard;
        float strength = pow(1.0 - (d * 2.0), 1.5);

        gl_FragColor = vec4(vColor, strength * vAlpha);
    }
`;

// 构建粒子数据
// 【修改】粒子变大了，稍微减少数量，防止太拥挤变成一团糊
const PARTICLE_COUNT = 500;
const treePosArray = new Float32Array(PARTICLE_COUNT * 3);
const galaxyPosArray = new Float32Array(PARTICLE_COUNT * 3);
const colorsArray = new Float32Array(PARTICLE_COUNT * 3);
const sizesArray = new Float32Array(PARTICLE_COUNT);

// === 🌈 修改颜色：使用高饱和度的霓虹色系 ===
const c_green = new THREE.Color('#0f4d22');     // 荧光绿 (更透亮)
const c_darkGreen = new THREE.Color('#00cc44'); // 稍深一点的绿 (增加层次)
const c_gold = new THREE.Color('#ffaa00');      // 明亮的香槟金
const c_red = new THREE.Color('#c90e28');       // 鲜艳的红
const c_white = new THREE.Color('#ffdea0');     // 纯白

// --- 【核心修改：树身缩小】 ---
const TREE_HEIGHT = 18; // 之前是 32 -> 20 (变矮)
const TREE_BOTTOM_Y = -(TREE_HEIGHT / 2) - 1;

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;

    // 树形态
    const k = i / PARTICLE_COUNT;
    const relativeHeight = 1 - Math.pow(k, 0.45);
    const y = relativeHeight * TREE_HEIGHT + TREE_BOTTOM_Y;

    // 半径缩小：之前是 12 -> 8.5 (变瘦)
    const maxRadius = (1 - relativeHeight) * 8.5;
    const r = maxRadius * Math.sqrt(Math.random());
    const angle = i * 13.5;

    treePosArray[i3] = Math.cos(angle) * r;
    treePosArray[i3 + 1] = y;
    treePosArray[i3 + 2] = Math.sin(angle) * r;

    // 星空形态
    const sr = 35 * Math.cbrt(Math.random()) + 5; // 星空范围也稍微收一点
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    galaxyPosArray[i3] = sr * Math.sin(phi) * Math.cos(theta);
    galaxyPosArray[i3 + 1] = sr * Math.sin(phi) * Math.sin(theta);
    galaxyPosArray[i3 + 2] = sr * Math.cos(phi);

    // --- 【核心修改：基础大小倍增】 ---
    let color;
    const distToSurface = r / maxRadius;

    // 基础大小从 0.5 提升到 1.2
    let baseSize = Math.random() * 1.0 + 1.2

    // 调亮金色：用更亮的香槟金
    // const c_gold = new THREE.Color('#ffcc33');

    if (distToSurface > 0.85) {
        // === 表面 ===
        // 90% 都是这种高亮香槟金，模拟图中的主视觉
        color = Math.random() > 0.01 ? c_gold : c_red;
    } else {
        // === 内部 ===
        // 内部也要有光！参考图中缝隙里透出来的也是黄光
        const rand = Math.random();

        if (rand > 0.8) {
            color = c_red; // 少量红
        } else if (rand > 0.6) {
            color = c_green; // 少量绿
        } else {
            // 剩下的全是暗金色，作为背景光
            color = new THREE.Color(c_gold);
        }
    }

    sizesArray[i] = baseSize;
    colorsArray[i3] = color.r;
    colorsArray[i3 + 1] = color.g;
    colorsArray[i3 + 2] = color.b;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(treePosArray, 3));
geometry.setAttribute('positionTarget', new THREE.BufferAttribute(galaxyPosArray, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMixFactor: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    // blending: THREE.AdditiveBlending
    blending: THREE.NormalBlending
});

const particles = new THREE.Points(geometry, shaderMaterial);
scene.add(particles);

// ==================== 4. 辅助元素 (雪花 & 星星) ====================

function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.Texture(canvas); texture.needsUpdate = true;
    return texture;
}

const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(1000 * 3);
for (let i = 0; i < 1000; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 100;
    snowPos[i * 3 + 1] = Math.random() * 60 - 30;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8, // 雪花稍微调小一点，对比衬托树的大粒子
    map: createCircleTexture(),
    transparent: true, opacity: 0.6,
    // blending: THREE.AdditiveBlending, 
    blending: THREE.NormalBlending,
    depthWrite: false
});
const snow = new THREE.Points(snowGeo, snowMat);
scene.add(snow);

// 星星
function createReal3DStar() {
    const geometry = new THREE.BufferGeometry();
    const vertices = []; const indices = [];
    const outerRadius = 1.2; const innerRadius = 0.5; const thickness = 0.3;
    vertices.push(0, 0, thickness); vertices.push(0, 0, -thickness);
    const numPoints = 10;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i * Math.PI * 2) / numPoints - Math.PI / 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        vertices.push(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    }
    for (let i = 0; i < numPoints; i++) {
        const curr = i + 2; const next = ((i + 1) % numPoints) + 2;
        indices.push(0, curr, next); indices.push(1, next, curr);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

// 1. 创建一个纯粹的基础颜色材质 (不受光照影响，自带亮度)
const starMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700 // 基础金色
});

// 2. 暴力增强颜色亮度！
// 普通颜色最大值是 1，我们把它乘 10，强制让辉光特效(Bloom)把它识别为"超级亮"的光源
starMaterial.color.multiplyScalar(1000.0);

const star = new THREE.Mesh(createReal3DStar(), starMaterial);

// 更新星星高度适配新的树高
star.position.set(0, TREE_HEIGHT + TREE_BOTTOM_Y + 0.5, 0);
scene.add(star);

// ==================== 5. 照片墙逻辑 ====================
const photoGroup = new THREE.Group();
scene.add(photoGroup);
let currentPhoto = null;

document.getElementById('photo-upload').addEventListener('change', (e) => {
    const files = e.target.files; if (!files.length) return;
    while (photoGroup.children.length > 0) photoGroup.remove(photoGroup.children[0]);
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image(); img.src = ev.target.result;
            img.onload = () => {
                const tex = new THREE.Texture(img); tex.needsUpdate = true;
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
                const frame = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 7.15), new THREE.MeshBasicMaterial({ color: 0xd4af37 }));
                frame.position.z = -0.02; mesh.add(frame);
                mesh.position.set((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30);
                mesh.visible = false; photoGroup.add(mesh);
            }
        }; reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张回忆！`);
});

function showRandomPhoto() {
    if (photoGroup.children.length === 0 || currentPhoto) return;
    const idx = Math.floor(Math.random() * photoGroup.children.length);
    currentPhoto = photoGroup.children[idx];
    currentPhoto.visible = true; currentPhoto.scale.set(0, 0, 0);
    currentPhoto.position.copy(camera.position).add(new THREE.Vector3(0, 0, -10));
    currentPhoto.lookAt(camera.position);
    gsap.to(currentPhoto.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "elastic.out(1, 0.6)" });
    setTimeout(hideCurrentPhoto, 5000);
}

function hideCurrentPhoto() {
    if (!currentPhoto) return;
    gsap.to(currentPhoto.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => { currentPhoto.visible = false; currentPhoto = null; } });
}

// ==================== 6. 手势识别 ====================
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const debugContainer = document.getElementById('debug-container');

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

let isDebugOpen = false;
document.addEventListener('dblclick', (e) => {
    if (e.clientX < 150 && e.clientY < 150) { isDebugOpen = !isDebugOpen; debugContainer.style.display = isDebugOpen ? 'block' : 'none'; }
});

const STATE = { TREE: 0, GALAXY: 1 };
let currentState = STATE.TREE;
let isPinchLocked = false;

hands.onResults(results => {
    document.getElementById('loader').style.display = 'none';
    if (isDebugOpen) {
        canvasCtx.save(); canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
            }
        }
        canvasCtx.restore();
    }
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        const wrist = lm[0]; const thumbTip = lm[4]; const indexTip = lm[8];
        const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        const isClosed = (tipIdx) => dist(lm[tipIdx], wrist) < 0.28;
        const fingersClosedCount = [8, 12, 16, 20].filter(idx => isClosed(idx)).length;

        if (fingersClosedCount >= 3) changeState(STATE.TREE);
        else if (fingersClosedCount <= 1 && dist(thumbTip, indexTip) > 0.1) {
            changeState(STATE.GALAXY);
            scene.rotation.y += (lm[9].x - 0.5) * 0.08;
        }
        if (dist(thumbTip, indexTip) < 0.06 && !isPinchLocked) {
            showRandomPhoto(); isPinchLocked = true; setTimeout(() => isPinchLocked = false, 1500);
        }
    }
});

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 320, height: 240
});
cameraUtils.start();

function changeState(newState) {
    if (currentState === newState) return;
    currentState = newState;
    gsap.to(shaderMaterial.uniforms.uMixFactor, { value: newState === STATE.TREE ? 0 : 1, duration: 2.5, ease: "power3.inOut" });
    const targetScale = newState === STATE.TREE ? 1 : 0;
    gsap.to(star.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 1.5, ease: "back.out(1.5)" });
}

// ==================== 7. 循环 ====================
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    shaderMaterial.uniforms.uTime.value = elapsedTime;

    const positions = snowGeo.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
        const i3 = i * 3;
        positions[i3 + 1] -= 0.15;
        if (positions[i3 + 1] < -40) positions[i3 + 1] = 40;
        positions[i3] += Math.sin(elapsedTime * 0.5 + i) * 0.03;
    }
    snowGeo.attributes.position.needsUpdate = true;

    if (currentState === STATE.TREE) {
        star.rotation.y += 0.015; star.rotation.z = Math.sin(elapsedTime * 1.2) * 0.08;
    }
    composer.render();
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
    shaderMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});
