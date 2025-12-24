// ==================== 1. 场景与渲染器初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103); 
scene.fog = new THREE.FogExp2(0x010103, 0.0015); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 摄像机位置
camera.position.z = 16; 
camera.position.y = 5;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// 使用标准色调，还原照片本色
renderer.toneMapping = THREE.NoToneMapping; 
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 (Bloom/辉光效果) - 深度优化 ====================
const renderScene = new THREE.RenderPass(scene, camera);

const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    0.4,  // 强度：适中
    0.1,  // 半径：光晕很小，只在粒子周围
    0.85  // 【关键修改】阈值调高：只有亮度超过 85% 的东西才发光。
          // 这意味着：普通的照片像素不会发光，只有特意设置的高亮粒子会发光！
);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 生成粒子纹理 ====================
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    // 粒子核心颜色调得非常亮，确保能触发发光阈值
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); 
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)'); 
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)'); 
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); 
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ==================== 4. 粒子系统 (核心) ====================
const PARTICLE_COUNT = 10000;
const geometry = new THREE.BufferGeometry();
const glowTexture = createGlowTexture();

const material = new THREE.PointsMaterial({
    size: 0.9, 
    map: glowTexture,
    transparent: true,
    opacity: 1.0, // 粒子不透明度拉满，确保发光
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const treePositions = [];
const galaxyPositions = [];
const colors = [];
const sizes = []; 

const colorPalette = [
    new THREE.Color('#00ffcc'), 
    new THREE.Color('#22ff88'), 
    new THREE.Color('#ff0055'), 
    new THREE.Color('#ffcc00'), 
    new THREE.Color('#ffffff')  
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    // --- 树形态 ---
    const angle = i * 0.08; 
    const height = 40; 
    const y = (i / PARTICLE_COUNT) * height - (height / 2) - 2; 
    const radius = (1 - (y + height/2) / height) * 11 * (0.85 + 0.15 * Math.sin(angle * 6));
    
    const x = Math.cos(angle * 3) * radius + (Math.random()-0.5) * 0.5; 
    const z = Math.sin(angle * 3) * radius + (Math.random()-0.5) * 0.5;
    
    treePositions.push(x, y, z);

    // --- 星空形态 ---
    const r = 50 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const gx = r * Math.sin(phi) * Math.cos(theta);
    const gy = r * Math.sin(phi) * Math.sin(theta);
    const gz = r * Math.cos(phi);
    galaxyPositions.push(gx, gy, gz);

    // --- 颜色 ---
    let color;
    if (Math.random() > 0.92) color = colorPalette[3]; 
    else if (Math.random() > 0.92) color = colorPalette[2]; 
    else {
        const c1 = colorPalette[0];
        const c2 = colorPalette[1];
        color = c1.clone().lerp(c2, Math.random() * 0.7); 
    }
    // 稍微增强颜色亮度，让粒子在照片不发光的情况下依然闪亮
    color.multiplyScalar(1.2); 
    colors.push(color.r, color.g, color.b);
    sizes.push(Math.random()); 
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ==================== 5. 照片回忆逻辑 (巨幕清晰版) ====================
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
                // 使用 MeshBasicMaterial 并不受光照影响，配合高阈值 Bloom，照片将非常清晰
                const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
                
                // 【修改点 1】加大照片基础尺寸 (5 -> 8)
                const geom = new THREE.PlaneGeometry(8, 8); 
                const mesh = new THREE.Mesh(geom, mat);
                
                // 边框
                const bgGeom = new THREE.PlaneGeometry(8.4, 8.4);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const bgMesh = new THREE.Mesh(bgGeom, bgMat);
                bgMesh.position.z = -0.05;
                mesh.add(bgMesh);

                mesh.position.set((Math.random()-0.5)*25, (Math.random()-0.5)*25, (Math.random()-0.5)*8);
                mesh.visible = false;
                photoGroup.add(mesh);
            }
        };
        reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张回忆！(按P键或捏合手势查看)`);
});

// ==================== 6. 状态与动画逻辑 ====================
const STATE = { TREE: 'tree', GALAXY: 'galaxy' };
let currentState = STATE.TREE;
const tweenObj = { t: 0 }; 

function morphTo(shape) {
    if (shape === currentState) return;
    currentState = shape;
    const target = shape === STATE.TREE ? 0 : 1;
    gsap.to(tweenObj, {
        t: target,
        duration: 2.2,
        ease: "power3.inOut", 
    });
    photoGroup.children.forEach(mesh => {
        mesh.visible = (shape === STATE.GALAXY);
        if (mesh.visible) gsap.to(mesh.scale, { x: 0, y: 0, duration: 0.1 });
    });
}

function showRandomPhoto() {
    if (photoGroup.children.length === 0) return;
    const randomIndex = Math.floor(Math.random() * photoGroup.children.length);
    const photo = photoGroup.children[randomIndex];
    
    photo.visible = true;
    
    // 【修改点 2】把照片拉得更近！ (Z轴 12 -> 6)
    // 摄像机在 Z=16，照片在 Z=6，距离只有 10，会显得非常大
    photo.position.set(0, 0, 6); 
    photo.lookAt(camera.position);
    
    // 修正旋转，让照片正面朝向观众
    photo.rotation.z = (Math.random() - 0.5) * 0.1; 
    
    // 动画弹出
    gsap.fromTo(photo.scale, {x:0, y:0}, {x: 1, y: 1, duration: 0.7, ease: "back.out(1.5)"});
    
    // 停留时间延长到 4.5 秒
    setTimeout(() => {
        gsap.to(photo.scale, {
            x: 0, y: 0, duration: 0.5, onComplete: () => {
                photo.position.set((Math.random()-0.5)*30, (Math.random()-0.5)*30, (Math.random()-0.5)*15);
            }
        });
    }, 4500);
}

// ==================== 7. MediaPipe 手势 ====================
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const loader = document.getElementById('loader');

function detectGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    function dist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }
    const tips = [8, 12, 16, 20];
    const closedFingers = tips.filter(idx => dist(landmarks[idx], wrist) < 0.3).length;
    if (closedFingers >= 3) return 'FIST'; 
    if (dist(thumbTip, indexTip) < 0.05) return 'PINCH'; 
    return 'OPEN';
}

function onResults(results) {
    if (loader) loader.style.display = 'none';
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const gesture = detectGesture(landmarks);
        
        if (gesture === 'FIST') morphTo(STATE.TREE);
        if (gesture === 'OPEN') {
            morphTo(STATE.GALAXY);
            const palmX = landmarks[9].x;
            scene.rotation.y += (palmX - 0.5) * 0.08; 
        }
        if (gesture === 'PINCH') {
            if (!window.isPinchingLocked) {
                showRandomPhoto();
                window.isPinchingLocked = true;
                setTimeout(() => window.isPinchingLocked = false, 2000);
            }
        }
    }
}

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0, 
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 320, height: 240
});
cameraUtils.start();

// ==================== 8. 动画循环 ====================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const positions = particles.geometry.attributes.position.array;
    
    for(let i=0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const tx = treePositions[i3]; const ty = treePositions[i3+1]; const tz = treePositions[i3+2];
        const gx = galaxyPositions[i3]; const gy = galaxyPositions[i3+1]; const gz = galaxyPositions[i3+2];
        
        positions[i3]   = tx + (gx - tx) * tweenObj.t;
        positions[i3+1] = ty + (gy - ty) * tweenObj.t;
        positions[i3+2] = tz + (gz - tz) * tweenObj.t;

        if (currentState === STATE.TREE) {
             positions[i3+1] += Math.sin(time * 1.5 + i) * 0.015; 
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    scene.rotation.y += 0.0005;
    camera.position.y += Math.sin(time * 0.4) * 0.005;

    composer.render();
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
    if(e.code === 'Space') morphTo(currentState === STATE.TREE ? STATE.GALAXY : STATE.TREE);
    if(e.key === 'p') showRandomPhoto();
});

// 超时设置延长到30秒
setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "AI 加载较慢，已开启键盘模式 (空格切换)";
        setTimeout(() => loader.style.display = 'none', 3000);
    }
}, 30000);
