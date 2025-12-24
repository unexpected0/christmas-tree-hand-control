// ==================== 1. 场景与渲染器初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// 背景色：极深邃的午夜蓝黑，衬托金色
scene.background = new THREE.Color(0x010103); 
// 雾气也使用同色，增加深邃感
scene.fog = new THREE.FogExp2(0x010103, 0.002); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 稍微拉远一点点视角，以便完整看到更宏伟的树
camera.position.z = 18; 
camera.position.y = 6;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// 使用电影级色调映射，让高光更柔和，暗部更有层次
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 0.9;
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 (奢华辉光) ====================
const renderScene = new THREE.RenderPass(scene, camera);

// 调整辉光参数，营造“流光溢彩”而非“刺眼”的效果
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    0.6,  // 强度：适中，让金饰闪闪发光
    0.3,  // 半径：光晕稍微扩散开来，增加朦胧感
    0.35  // 阈值：只有较亮的金色和白色粒子会产生辉光，深绿色不会
);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 生成粒子纹理 (更柔和的光点) ====================
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    // 使用暖白/金色核心
    grad.addColorStop(0, 'rgba(255, 250, 220, 1)'); 
    grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.6)'); 
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); 
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ==================== 4. 粒子系统 (核心升级) ====================
const PARTICLE_COUNT = 13000; // 增加粒子数量，让树更茂密
const geometry = new THREE.BufferGeometry();
const glowTexture = createGlowTexture();

const material = new THREE.PointsMaterial({
    size: 0.8, 
    map: glowTexture,
    transparent: true,
    opacity: 1.0,
    vertexColors: true,
    blending: THREE.AdditiveBlending, // 叠加发光模式
    depthWrite: false
});

const treePositions = [];
const galaxyPositions = [];
const colors = [];
const sizes = []; 

// 【新配色方案：奢华圣诞】
const colorPalette = [
    new THREE.Color('#0f5e35'), // 深祖母绿 (Deep Emerald) - 树的主体
    new THREE.Color('#1a8c4f'), // 森林绿 (Forest Green) - 增加层次
    new THREE.Color('#d4af37'), // 醇厚金 (Rich Gold) - 装饰品/灯光
    new THREE.Color('#9b111e'), // 红宝石色 (Ruby Red) - 装饰品
    new THREE.Color('#fffff0')  // 暖象牙白 (Warm Ivory) - 顶部星光/雪花
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    // --- 全新圣诞树形态算法 ---
    const height = 45; 
    // 计算相对高度 (0在底部, 1在顶部)
    const relativeHeight = i / PARTICLE_COUNT;
    const y = relativeHeight * height - (height / 2) - 3; 

    // 基础圆锥形状 (底部宽顶部尖)
    const baseCone = 1.0 - relativeHeight;

    // 【关键升级】添加分层效果，模拟真实的松树枝丫
    // 使用正弦波在高度上制造 7 个“凸起”的层级
    const layers = 7;
    const layerBulge = Math.pow(Math.sin(relativeHeight * Math.PI * layers), 2) * 0.25;
    
    // 组合基础圆锥和层级凸起，并添加随机松针效果
    const radius = (baseCone + layerBulge) * 13 * (0.9 + 0.2 * Math.random());
    
    // 螺旋角度，越往上旋转越快
    const angle = i * 0.05 + relativeHeight * 10; 
    
    const x = Math.cos(angle) * radius; 
    const z = Math.sin(angle) * radius;
    
    treePositions.push(x, y, z);

    // --- 星空形态 (保持不变，形成对比) ---
    const r = 60 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const gx = r * Math.sin(phi) * Math.cos(theta);
    const gy = r * Math.sin(phi) * Math.sin(theta);
    const gz = r * Math.cos(phi);
    galaxyPositions.push(gx, gy, gz);

    // --- 奢华颜色分配逻辑 ---
    let color;
    const rand = Math.random();
    
    if (relativeHeight > 0.98) {
        // 树顶全部是金色和白色，像一颗大星星
        color = Math.random() > 0.5 ? colorPalette[2] : colorPalette[4];
        sizes.push(Math.random() * 0.5 + 1.5); // 顶部粒子更大
    } else if (rand > 0.85) {
        // 15% 的概率是金色装饰球，亮度调高
        color = colorPalette[2].clone().multiplyScalar(1.5); 
        sizes.push(Math.random() * 0.5 + 1.2);
    } else if (rand > 0.75) {
        // 10% 的概率是红宝石装饰球
        color = colorPalette[3].clone().multiplyScalar(1.3);
        sizes.push(Math.random() * 0.5 + 1.0);
    } else {
        // 剩下 75% 是深浅不一的祖母绿树叶
        color = colorPalette[0].clone().lerp(colorPalette[1], Math.random());
        // 稍微降低绿色粒子的亮度，让金色更突出
        color.multiplyScalar(0.8); 
        sizes.push(Math.random() * 0.8 + 0.2);
    }
    
    colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
// 将大小差异应用到自定义属性，以便在动画中使用 (虽然这里暂时没写 shader，但保留结构)
geometry.setAttribute('sizeOffset', new THREE.Float32BufferAttribute(sizes, 1));

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ==================== 5. 照片回忆逻辑 (保持不变) ====================
const photoGroup = new THREE.Group();
scene.add(photoGroup);

document.getElementById('photo-upload').addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    while (photoGroup.children.length > 0) { photoGroup.remove(photoGroup.children[0]); }
    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const tex = new THREE.Texture(img); tex.needsUpdate = true;
                const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
                const geom = new THREE.PlaneGeometry(8, 8); 
                const mesh = new THREE.Mesh(geom, mat);
                const bgGeom = new THREE.PlaneGeometry(8.4, 8.4);
                // 照片边框也改为金色
                const bgMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
                const bgMesh = new THREE.Mesh(bgGeom, bgMat);
                bgMesh.position.z = -0.05; mesh.add(bgMesh);
                mesh.position.set((Math.random()-0.5)*25, (Math.random()-0.5)*25, (Math.random()-0.5)*8);
                mesh.visible = false; photoGroup.add(mesh);
            }
        };
        reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张回忆！(按P键或捏合手势查看)`);
});

// ==================== 6. 状态与动画逻辑 (优化动画曲线) ====================
const STATE = { TREE: 'tree', GALAXY: 'galaxy' };
let currentState = STATE.TREE;
const tweenObj = { t: 0 }; 

function morphTo(shape) {
    if (shape === currentState) return;
    currentState = shape;
    const target = shape === STATE.TREE ? 0 : 1;
    gsap.to(tweenObj, {
        t: target,
        duration: 2.5,
        // 使用更优雅的弹性缓动，让变形更有质感
        ease: shape === STATE.TREE ? "elastic.out(1, 0.75)" : "power4.inOut", 
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
    photo.position.set(0, 0, 7); 
    photo.lookAt(camera.position);
    photo.rotation.z = (Math.random() - 0.5) * 0.1; 
    gsap.fromTo(photo.scale, {x:0, y:0}, {x: 1, y: 1, duration: 0.8, ease: "back.out(1.5)"});
    setTimeout(() => {
        gsap.to(photo.scale, {
            x: 0, y: 0, duration: 0.6, onComplete: () => {
                photo.position.set((Math.random()-0.5)*30, (Math.random()-0.5)*30, (Math.random()-0.5)*15);
            }
        });
    }, 4000);
}

// ==================== 7. MediaPipe 手势 (保持不变) ====================
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const loader = document.getElementById('loader');

function detectGesture(landmarks) {
    const thumbTip = landmarks[4]; const indexTip = landmarks[8]; const wrist = landmarks[0];
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
            const palmX = landmarks[9].x; scene.rotation.y += (palmX - 0.5) * 0.08; 
        }
        if (gesture === 'PINCH') {
            if (!window.isPinchingLocked) {
                showRandomPhoto(); window.isPinchingLocked = true;
                setTimeout(() => window.isPinchingLocked = false, 2000);
            }
        }
    }
}

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);
const cameraUtils = new Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); }, width: 320, height: 240 });
cameraUtils.start();

// ==================== 8. 动画循环 ====================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const positions = particles.geometry.attributes.position.array;
    const sizesAttr = particles.geometry.attributes.sizeOffset.array;
    
    for(let i=0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const tx = treePositions[i3]; const ty = treePositions[i3+1]; const tz = treePositions[i3+2];
        const gx = galaxyPositions[i3]; const gy = galaxyPositions[i3+1]; const gz = galaxyPositions[i3+2];
        
        positions[i3]   = tx + (gx - tx) * tweenObj.t;
        positions[i3+1] = ty + (gy - ty) * tweenObj.t;
        positions[i3+2] = tz + (gz - tz) * tweenObj.t;

        if (currentState === STATE.TREE) {
             // 让树的“呼吸”更缓慢、庄重
             positions[i3+1] += Math.sin(time * 1.2 + i * 0.5) * 0.01; 
             // 可选：如果你想让金色粒子闪烁，可以取消下面这行的注释
             // if(sizesAttr[i] > 1.1) positions[i3] += (Math.random()-0.5)*0.02;
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // 缓慢优雅地自转
    scene.rotation.y += 0.0003;
    camera.position.y += Math.sin(time * 0.3) * 0.003;

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

setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "AI 加载较慢，已开启键盘模式 (空格切换)";
        setTimeout(() => loader.style.display = 'none', 3000);
    }
}, 30000);

