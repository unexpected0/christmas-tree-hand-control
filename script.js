// ==================== 1. 场景与渲染器初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// 背景色改为极深的午夜蓝，衬托发光效果
scene.background = new THREE.Color(0x020205); 
// 远处迷雾，增加深邃感
scene.fog = new THREE.FogExp2(0x020205, 0.002); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 25; // 稍微拉近一点视角
camera.position.y = 8;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); // 开启后期处理时关闭自带抗锯齿以提升性能
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比，防止手机卡顿
renderer.toneMapping = THREE.ReinhardToneMapping; // 电影级色调映射
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 (Bloom/辉光效果) ====================
// 这是让画面变华丽的核心！
const renderScene = new THREE.RenderPass(scene, camera);

// 参数：分辨率, 强度(Strength), 半径(Radius), 阈值(Threshold)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    1.5,  // 强度：调高这个会让光更亮
    0.4,  // 半径：光晕扩散的范围
    0.05  // 阈值：多亮的像素才会发光
);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 生成粒子纹理 ====================
// 用 Canvas 画一个模糊的圆，作为粒子的“贴图”，告别方块感
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心亮白
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)'); 
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)'); // 边缘透明
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ==================== 4. 粒子系统 (核心) ====================
const PARTICLE_COUNT = 12000; // 粒子数量翻倍，更加细致
const geometry = new THREE.BufferGeometry();
const glowTexture = createGlowTexture();

// 材质设置：关键是 blending (叠加模式) 和 depthWrite (不遮挡)
const material = new THREE.PointsMaterial({
    size: 0.6, // 粒子大小
    map: glowTexture,
    transparent: true,
    opacity: 0.8,
    vertexColors: true, // 启用顶点颜色
    blending: THREE.AdditiveBlending, // 颜色叠加，越叠越亮
    depthWrite: false
});

const treePositions = [];
const galaxyPositions = [];
const colors = [];
const sizes = []; // 存储每个粒子的大小变化偏移量

const colorPalette = [
    new THREE.Color('#00ffcc'), // 青色 (赛博风)
    new THREE.Color('#00ff66'), // 荧光绿
    new THREE.Color('#ff0066'), // 霓虹红
    new THREE.Color('#ffd700'), // 金色
    new THREE.Color('#ffffff')  // 纯白
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    // --- 树形态 (螺旋向上，更紧密) ---
    const angle = i * 0.05; 
    const height = 45;
    const y = (i / PARTICLE_COUNT) * height - (height / 2) - 5; 
    // 螺旋半径函数：让树更有曲线美
    const radius = (1 - (y + height/2) / height) * 12 * (0.8 + 0.2 * Math.sin(angle * 5));
    
    const x = Math.cos(angle * 3) * radius + (Math.random()-0.5); // 增加一点随机抖动
    const z = Math.sin(angle * 3) * radius + (Math.random()-0.5);
    
    treePositions.push(x, y, z);

    // --- 星空形态 (更广阔的球体) ---
    const r = 60 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const gx = r * Math.sin(phi) * Math.cos(theta);
    const gy = r * Math.sin(phi) * Math.sin(theta);
    const gz = r * Math.cos(phi);
    
    galaxyPositions.push(gx, gy, gz);

    // --- 颜色分配 ---
    // 树尖偏白/金，底部偏绿/青
    let color;
    const mixRatio = (y + 20) / 40; // 归一化高度
    
    if (Math.random() > 0.95) {
        color = colorPalette[3]; // 随机金点
    } else if (Math.random() > 0.95) {
        color = colorPalette[2]; // 随机红点
    } else {
        // 渐变色
        const c1 = colorPalette[0];
        const c2 = colorPalette[1];
        color = c1.clone().lerp(c2, Math.random()); // 颜色混合
    }

    colors.push(color.r, color.g, color.b);
    
    // 随机大小参数，用于闪烁动画
    sizes.push(Math.random()); 
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.setAttribute('sizeOffset', new THREE.Float32BufferAttribute(sizes, 1)); // 自定义属性

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ==================== 5. 照片回忆逻辑 ====================
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
                // 照片加个边框发光
                const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
                const geom = new THREE.PlaneGeometry(6, 6);
                const mesh = new THREE.Mesh(geom, mat);
                
                // 给照片后面加个发光背板
                const bgGeom = new THREE.PlaneGeometry(6.2, 6.2);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const bgMesh = new THREE.Mesh(bgGeom, bgMat);
                bgMesh.position.z = -0.01;
                mesh.add(bgMesh);

                mesh.position.set((Math.random()-0.5)*30, (Math.random()-0.5)*30, (Math.random()-0.5)*10);
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

// 补间动画变量
const tweenObj = { t: 0 }; // 0 = tree, 1 = galaxy

function morphTo(shape) {
    if (shape === currentState) return;
    currentState = shape;
    
    const target = shape === STATE.TREE ? 0 : 1;

    gsap.to(tweenObj, {
        t: target,
        duration: 2.5,
        ease: "elastic.out(1, 0.5)", // 更有弹性的动画
    });

    // 切换照片显示
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
    // 飞到屏幕正前方
    photo.position.set(0, 0, 15);
    photo.lookAt(camera.position);
    photo.rotation.z = (Math.random() - 0.5) * 0.5; // 稍微歪一点，更自然

    gsap.fromTo(photo.scale, {x:0, y:0}, {x: 1.2, y: 1.2, duration: 0.8, ease: "back.out(1.7)"});
    
    // 3.5秒后飞回星空
    setTimeout(() => {
        gsap.to(photo.scale, {
            x: 0, y: 0, duration: 0.6, onComplete: () => {
                photo.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*20);
            }
        });
    }, 3500);
}

// ==================== 7. MediaPipe 手势 ====================
// (保持原有逻辑，增加容错)
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loader = document.getElementById('loader');

function detectGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    function dist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }
    
    const tips = [8, 12, 16, 20];
    const closedFingers = tips.filter(idx => dist(landmarks[idx], wrist) < 0.3).length;
    
    if (closedFingers >= 3) return 'FIST'; // 握拳
    if (dist(thumbTip, indexTip) < 0.05) return 'PINCH'; // 捏合
    return 'OPEN';
}

function onResults(results) {
    if (loader) loader.style.display = 'none';
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if(results.image) canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00ffff', lineWidth: 2 });
        drawLandmarks(canvasCtx, landmarks, { color: '#ff00ff', lineWidth: 1, radius: 2 });
        
        const gesture = detectGesture(landmarks);
        
        if (gesture === 'FIST') morphTo(STATE.TREE);
        if (gesture === 'OPEN') {
            morphTo(STATE.GALAXY);
            // 手掌控制旋转
            const palmX = landmarks[9].x;
            scene.rotation.y += (palmX - 0.5) * 0.1; 
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
    locateFile: (file) => `https://unpkg.com/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 320, height: 240
});
cameraUtils.start();


// ==================== 8. 动画循环 (渲染 Bloom) ====================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // --- 粒子闪烁与更新逻辑 ---
    const positions = particles.geometry.attributes.position.array;
    
    // 如果还没变形完毕，我们需要插值计算位置
    // 这里为了性能，我们直接在 shader 或者 update loop 里做简化插值
    // 但为了兼容 morphTo 的 GSAP，我们在这里手动更新 buffer
    for(let i=0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // 计算当前应该在哪：树的位置 vs 星空的位置
        const tx = treePositions[i3];
        const ty = treePositions[i3+1];
        const tz = treePositions[i3+2];
        
        const gx = galaxyPositions[i3];
        const gy = galaxyPositions[i3+1];
        const gz = galaxyPositions[i3+2];
        
        // 线性插值混合
        positions[i3]   = tx + (gx - tx) * tweenObj.t;
        positions[i3+1] = ty + (gy - ty) * tweenObj.t;
        positions[i3+2] = tz + (gz - tz) * tweenObj.t;

        // 添加微小的悬浮动画 (让树看起来是活的)
        if (currentState === STATE.TREE) {
             positions[i3+1] += Math.sin(time * 2 + i) * 0.02; // 上下浮动
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // 整体缓慢自转
    scene.rotation.y += 0.001;
    
    // 摄像机微动 (增加电影感)
    camera.position.y += Math.sin(time * 0.5) * 0.01;

    // 重要：使用 composer 渲染，而不是 renderer
    composer.render();
}

animate();

// 窗口调整
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // 别忘了更新 Bloom
});

// 键盘后备
window.addEventListener('keydown', (e) => {
    if(e.code === 'Space') morphTo(currentState === STATE.TREE ? STATE.GALAXY : STATE.TREE);
    if(e.key === 'p') showRandomPhoto();
});

// 超时处理
setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "AI 加载较慢，已开启键盘模式 (空格切换)";
        setTimeout(() => loader.style.display = 'none', 3000);
    }
}, 8000);
