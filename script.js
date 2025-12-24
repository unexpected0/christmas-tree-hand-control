// ==================== 1. 场景与渲染器初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a); // 深蓝色夜空背景
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 18;
camera.position.y = 5;

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: false, 
    powerPreference: "high-performance" 
}); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 ====================
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    0.35, 0.4, 0.7
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 灯光系统 ====================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffd700, 1.0);
dirLight.position.set(5, 20, 10);
scene.add(dirLight);

// 添加一个点光源照亮雪花
const snowLight = new THREE.PointLight(0x88ccff, 0.3, 50);
snowLight.position.set(0, 20, 0);
scene.add(snowLight);

// ==================== 4. 创建圆形下雪效果 ====================
function createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 创建圆形渐变
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(200, 220, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(150, 180, 220, 0)');
    
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

const snowTexture = createSnowTexture();

function createSnow() {
    const snowCount = 2500; // 雪花数量
    const snowGeometry = new THREE.BufferGeometry();
    const snowPositions = [];
    const snowVelocities = [];
    const snowSizes = [];
    const snowOpacities = [];
    
    // 初始化雪花
    for (let i = 0; i < snowCount; i++) {
        const x = (Math.random() - 0.5) * 120;
        const y = Math.random() * 100 - 20;
        const z = (Math.random() - 0.5) * 120;
        snowPositions.push(x, y, z);
        
        // 随机下落速度
        const velocityY = -0.03 - Math.random() * 0.04;
        const velocityX = (Math.random() - 0.5) * 0.015;
        const velocityZ = (Math.random() - 0.5) * 0.015;
        snowVelocities.push(velocityX, velocityY, velocityZ);
        
        // 随机大小
        snowSizes.push(0.15 + Math.random() * 0.25);
        
        // 随机透明度
        snowOpacities.push(0.5 + Math.random() * 0.4);
    }
    
    snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
    snowGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(snowVelocities, 3));
    snowGeometry.setAttribute('size', new THREE.Float32BufferAttribute(snowSizes, 1));
    snowGeometry.setAttribute('opacity', new THREE.Float32BufferAttribute(snowOpacities, 1));
    
    // 雪花材质 - 使用圆形纹理
    const snowMaterial = new THREE.PointsMaterial({
        size: 0.2,
        map: snowTexture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: false,
        sizeAttenuation: true
    });
    
    const snow = new THREE.Points(snowGeometry, snowMaterial);
    snow.userData.positions = snowPositions;
    snow.userData.velocities = snowVelocities;
    snow.userData.sizes = snowSizes;
    snow.userData.opacities = snowOpacities;
    
    return snow;
}

const snow = createSnow();
scene.add(snow);

// ==================== 5. 粒子纹理 ====================
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

const glowTexture = createGlowTexture();
const particleMaterial = new THREE.PointsMaterial({
    size: 0.75,
    map: glowTexture,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
});

// ==================== 6. 圣诞树粒子系统 ====================
const PARTICLE_COUNT = 13000;
const geometry = new THREE.BufferGeometry();
const treePositions = [];
const galaxyPositions = [];
const colors = [];

// 颜色定义
const darkGreen = new THREE.Color('#0f5e35');
const mediumGreen = new THREE.Color('#1a8c4f');
const lightGreen = new THREE.Color('#2db06d');
const gold = new THREE.Color('#b8860b');
const darkRed = new THREE.Color('#8b0000');
const red = new THREE.Color('#b22222');
const brightRed = new THREE.Color('#ff3333');
const orangeRed = new THREE.Color('#ff4500');

// 树的参数
const TREE_HEIGHT = 35;
const TREE_BOTTOM_Y = -(TREE_HEIGHT / 2) - 4; // 树底Y坐标

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const relativeHeight = i / PARTICLE_COUNT;
    const y = relativeHeight * TREE_HEIGHT + TREE_BOTTOM_Y;
    const baseRadius = Math.pow((1 - relativeHeight), 0.8) * 10;
    const randomSpread = Math.random();
    const currentRadius = baseRadius * (0.3 + 0.7 * Math.sqrt(randomSpread));
    const angle = i * 2.4;
    
    // 树形位置 - 确保顶部有空间放星星
    treePositions.push(
        Math.cos(angle) * currentRadius + (Math.random() - 0.5) * 0.5,
        y,
        Math.sin(angle) * currentRadius + (Math.random() - 0.5) * 0.5
    );

    // 星系位置
    const r = 60 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    galaxyPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
    );

    // 颜色分配 - 顶部为星星留出空间
    let color;
    const rand = Math.random();
    
    // 顶部区域（星星位置）粒子减少
    if (relativeHeight > 0.995) {
        // 树顶尖端粒子很少，为星星留出空间
        if (rand > 0.95) {
            color = brightRed.clone();
            color.multiplyScalar(1.3);
        } else {
            color = lightGreen.clone();
            color.multiplyScalar(0.8);
        }
    } else if (relativeHeight > 0.99) {
        // 紧挨星星的区域：减少粒子密度
        if (rand > 0.9) {
            color = gold.clone();
            color.multiplyScalar(1.2);
        } else if (rand > 0.4) {
            color = orangeRed.clone();
            color.multiplyScalar(1.2);
        } else {
            color = lightGreen.clone();
            color.multiplyScalar(0.9);
        }
    } else if (rand > 0.97) {
        color = gold.clone();
        color.multiplyScalar(1.1 + randomSpread * 0.1);
    } else if (rand > 0.82) {
        const redRand = Math.random();
        if (redRand > 0.7) {
            color = brightRed.clone();
            color.multiplyScalar(1.1 + randomSpread * 0.15);
        } else if (redRand > 0.4) {
            color = red.clone();
            color.multiplyScalar(1.0 + randomSpread * 0.15);
        } else if (redRand > 0.2) {
            color = orangeRed.clone();
            color.multiplyScalar(1.05 + randomSpread * 0.15);
        } else {
            color = darkRed.clone();
            color.multiplyScalar(0.9 + randomSpread * 0.15);
        }
    } else if (rand > 0.75) {
        color = lightGreen.clone();
        color.multiplyScalar(0.9 + randomSpread * 0.2);
    } else {
        color = darkGreen.clone().lerp(mediumGreen, Math.random());
        color.multiplyScalar(0.5 + 0.4 * randomSpread);
    }
    
    colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const particles = new THREE.Points(geometry, particleMaterial);
scene.add(particles);

// ==================== 7. 树顶立体五角星 ====================
function createReal3DStar() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    
    // 参数设置
    const outerRadius = 1.4;  // 外半径 (星星的角尖)
    const innerRadius = 0.6;  // 内半径 (星星的凹处，越小角越尖)
    const thickness = 0.5;    // 厚度 (中心点突出的距离，决定胖瘦)
    
    // 1. 添加中心顶点
    // 索引 0: 正面中心点
    vertices.push(0, 0, thickness); 
    // 索引 1: 背面中心点
    vertices.push(0, 0, -thickness);

    // 2. 创建一圈顶点 (Z=0)
    // 5个角，一共10个点（5个外点，5个内点）
    const numPoints = 10; 
    for (let i = 0; i < numPoints; i++) {
        // 计算角度：从 -PI/2 开始，让一个角垂直向上
        const angle = (i * Math.PI * 2) / numPoints - Math.PI / 2;
        
        // 偶数是外角(尖)，奇数是内角(凹)
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        vertices.push(x, y, 0);
    }

    // 3. 构建三角形面
    // 顶点索引从2开始是那一圈点
    for (let i = 0; i < numPoints; i++) {
        const currentRingIndex = i + 2;
        const nextRingIndex = ((i + 1) % numPoints) + 2;

        // 连接正面中心点 (索引0)
        indices.push(0, currentRingIndex, nextRingIndex);

        // 连接背面中心点 (索引1) - 注意绕序相反以保证法线朝外
        indices.push(1, nextRingIndex, currentRingIndex);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
}

// 创建星星几何体
const starGeometry = createReal3DStar();

// 星星材质
const starMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xFFD700,
    metalness: 1.0,         // 拉满金属感
    roughness: 0.2,         // 稍微增加粗糙度，让光泽更有质感
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: 0xffaa00,     // 自发光颜色
    emissiveIntensity: 0.5, // 稍微降低自发光，让环境光产生的阴影更明显，从而体现立体感
    flatShading: true,      // 【关键】开启平面着色，产生钻石般的棱角感
    side: THREE.DoubleSide
});

const star = new THREE.Mesh(starGeometry, starMaterial);

// 调整星星位置到树尖尖上 - 根据树的形状
// 树的高度是35，相对高度1.0的位置是树顶
const treeTopY = (1.0 * 35) - (35 / 2) - 4 + 1.5; // 计算树顶位置 + 额外偏移
star.position.set(0, treeTopY, 0);

// 增大星星尺寸
star.scale.setScalar(0.8); // 增大到0.8

// 稍微倾斜，让一个角朝前
star.rotation.x = 0;
star.rotation.y = Math.PI / 6;

// ==================== 增强星星的光照效果 ====================
const starLights = [];

// 主灯光 - 从上方向下照射
const topStarLight = new THREE.SpotLight(0xFFD700, 1.5, 50, Math.PI/5, 0.3, 1);
topStarLight.position.set(0, treeTopY + 8, 2);
topStarLight.target.position.set(0, treeTopY, 0);
scene.add(topStarLight);
scene.add(topStarLight.target);
starLights.push(topStarLight);

// 正面强光 - 照亮星星正面
const frontStarLight = new THREE.SpotLight(0xFFFFFF, 1.2, 40, Math.PI/4, 0.4, 1);
frontStarLight.position.set(0, treeTopY + 3, 10);
frontStarLight.target.position.set(0, treeTopY, 0);
scene.add(frontStarLight);
scene.add(frontStarLight.target);
starLights.push(frontStarLight);

// 侧面辅助灯光
const sideLight1 = new THREE.PointLight(0xFFAA00, 0.8, 30);
sideLight1.position.set(6, treeTopY + 2, 0);
scene.add(sideLight1);
starLights.push(sideLight1);

const sideLight2 = new THREE.PointLight(0xFFAA00, 0.8, 30);
sideLight2.position.set(-6, treeTopY + 2, 0);
scene.add(sideLight2);
starLights.push(sideLight2);

// 装饰性小灯光 - 围绕星星旋转
const orbitLights = new THREE.Group();
for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const light = new THREE.PointLight(0xFFFFAA, 0.5, 15);
    light.position.set(
        Math.cos(angle) * 3,
        treeTopY,
        Math.sin(angle) * 3
    );
    orbitLights.add(light);
    light.userData = {
        baseAngle: angle,
        speed: 0.2 + Math.random() * 0.1,
        radius: 3 + Math.random() * 0.5,
        heightOffset: Math.random() * 0.5
    };
}
scene.add(orbitLights);

// 星星数据
star.userData = {
    rotSpeed: 0.012,
    baseY: treeTopY,
    floatAmount: 0.02,
    floatSpeed: 0.15,
    lights: starLights,
    orbitLights: orbitLights,
    lightIntensity: 1.0
};

scene.add(star);

// ==================== 8. 照片系统 ====================
const photoGroup = new THREE.Group();
scene.add(photoGroup);

let currentPhoto = null;
const PHOTO_CONFIG = {
    width: 10,
    height: 7,
    showDuration: 5,
    positionZ: 6
};

document.getElementById('photo-upload').addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    
    while (photoGroup.children.length > 0) {
        photoGroup.remove(photoGroup.children[0]);
    }
    
    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const texture = new THREE.Texture(img);
                texture.needsUpdate = true;
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                });
                const geometry = new THREE.PlaneGeometry(PHOTO_CONFIG.width, PHOTO_CONFIG.height);
                const mesh = new THREE.Mesh(geometry, material);
                
                const frameGeometry = new THREE.PlaneGeometry(PHOTO_CONFIG.width + 0.4, PHOTO_CONFIG.height + 0.4);
                const frameMaterial = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
                const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
                frameMesh.position.z = -0.05;
                mesh.add(frameMesh);
                
                mesh.position.set(
                    (Math.random() - 0.5) * 50,
                    (Math.random() - 0.5) * 50,
                    (Math.random() - 0.5) * 30
                );
                mesh.visible = false;
                photoGroup.add(mesh);
            };
        };
        reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张照片！`);
});

function showRandomPhoto() {
    if (photoGroup.children.length === 0 || currentPhoto) return;
    
    const randomIndex = Math.floor(Math.random() * photoGroup.children.length);
    currentPhoto = photoGroup.children[randomIndex];
    
    currentPhoto.position.set(0, 0, PHOTO_CONFIG.positionZ);
    currentPhoto.lookAt(camera.position);
    currentPhoto.rotation.x += (Math.random() - 0.5) * 0.1;
    currentPhoto.rotation.z = (Math.random() - 0.5) * 0.15;
    currentPhoto.scale.set(0, 0, 1);
    currentPhoto.visible = true;
    
    gsap.to(currentPhoto.scale, {
        x: 1,
        y: 1,
        duration: 0.8,
        ease: "back.out(1.5)",
        onComplete: () => {
            setTimeout(() => {
                hideCurrentPhoto();
            }, PHOTO_CONFIG.showDuration * 1000);
        }
    });
}

function hideCurrentPhoto() {
    if (!currentPhoto) return;
    
    gsap.to(currentPhoto.scale, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: "power2.in",
        onComplete: () => {
            currentPhoto.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 30
            );
            currentPhoto.visible = false;
            currentPhoto = null;
        }
    });
}

// ==================== 9. 状态与动画控制 ====================
const STATE = { TREE: 'tree', GALAXY: 'galaxy' };
let currentState = STATE.TREE;
const tweenObj = { t: 0 };

function morphTo(shape) {
    if (shape === currentState) return;
    currentState = shape;
    
    gsap.to(tweenObj, {
        t: shape === STATE.TREE ? 0 : 1,
        duration: 2.5,
        ease: shape === STATE.TREE ? "elastic.out(1, 0.75)" : "power4.inOut"
    });
    
    const targetScale = shape === STATE.TREE ? 0.6 : 0;
    gsap.to(star.scale, {
        x: targetScale,
        y: targetScale,
        z: targetScale,
        duration: 1.5,
        ease: shape === STATE.TREE ? "back.out(2)" : "power2.in"
    });
    
    if (shape === STATE.GALAXY && photoGroup.children.length > 0) {
        setTimeout(() => {
            if (currentState === STATE.GALAXY) {
                showRandomPhoto();
            }
        }, 1500);
    } else if (currentPhoto) {
        hideCurrentPhoto();
    }
}

// ==================== 10. 手势控制 ====================
const videoElement = document.getElementById('input-video');
const loader = document.getElementById('loader');

const hands = new Hands({ locateFile: (file) => `.assets/${file}` });
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

function detectGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    
    function dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    
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
}

hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 320,
    height: 240
});
cameraUtils.start();

// ==================== 11. 动画循环 ====================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    // 星星动画
    if (currentState === STATE.TREE) {
        // 星星缓慢旋转
        star.rotation.y += star.userData.rotSpeed;
        
        // 非常轻微的浮动
        star.position.y = star.userData.baseY + Math.sin(time * star.userData.floatSpeed) * star.userData.floatAmount;
        
        // 轻微的三轴旋转，展示立体感
        star.rotation.x = Math.sin(time * 0.5) * 0.03;
        star.rotation.z = Math.sin(time * 0.08) * 0.008;
        
        // 主灯光闪烁
        star.userData.lights.forEach((light, index) => {
            if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
                const baseIntensity = index === 0 ? 1.2 : index === 1 ? 0.9 : 0.6;
                light.intensity = baseIntensity + Math.sin(time * (1.2 + index * 0.2)) * 0.15;
            }
        });
        
        // 环绕灯光动画
        if (star.userData.orbitLights) {
            star.userData.orbitLights.children.forEach((light, i) => {
                const angle = time * light.userData.speed + light.userData.baseAngle;
                light.position.x = Math.cos(angle) * light.userData.radius;
                light.position.z = Math.sin(angle) * light.userData.radius;
                light.position.y = star.userData.baseY + Math.sin(time * 0.5 + i) * 0.3;
                
                // 灯光轻微闪烁
                light.intensity = 0.4 + Math.sin(time * 2 + i) * 0.1;
            });
        }
    }
    
    // 下雪动画 - 圆形雪花
    const snowPositions = snow.geometry.attributes.position.array;
    const snowVelocities = snow.geometry.attributes.velocity.array;
    const snowSizes = snow.geometry.attributes.size.array;
    const snowOpacities = snow.geometry.attributes.opacity.array;
    
    for (let i = 0; i < snowPositions.length / 3; i++) {
        const i3 = i * 3;
        
        // 更新位置
        snowPositions[i3] += snowVelocities[i3];
        snowPositions[i3 + 1] += snowVelocities[i3 + 1];
        snowPositions[i3 + 2] += snowVelocities[i3 + 2];
        
        // 轻微摆动
        snowPositions[i3] += Math.sin(time * 0.3 + i * 0.1) * 0.003;
        snowPositions[i3 + 2] += Math.cos(time * 0.35 + i * 0.1) * 0.003;
        
        // 轻微大小变化
        snowSizes[i] = 0.15 + Math.random() * 0.05 + Math.sin(time + i) * 0.02;
        
        // 如果雪花落到地面，重置到顶部
        if (snowPositions[i3 + 1] < -30) {
            snowPositions[i3] = (Math.random() - 0.5) * 120;
            snowPositions[i3 + 1] = 60 + Math.random() * 30;
            snowPositions[i3 + 2] = (Math.random() - 0.5) * 120;
            
            // 重置速度
            snowVelocities[i3] = (Math.random() - 0.5) * 0.015;
            snowVelocities[i3 + 1] = -0.03 - Math.random() * 0.04;
            snowVelocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
            
            // 重置大小和透明度
            snowSizes[i] = 0.15 + Math.random() * 0.25;
            snowOpacities[i] = 0.5 + Math.random() * 0.4;
        }
    }
    
    snow.geometry.attributes.position.needsUpdate = true;
    snow.geometry.attributes.size.needsUpdate = true;
    
    // 粒子变形
    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = treePositions[i3] + (galaxyPositions[i3] - treePositions[i3]) * tweenObj.t;
        positions[i3 + 1] = treePositions[i3 + 1] + (galaxyPositions[i3 + 1] - treePositions[i3 + 1]) * tweenObj.t;
        positions[i3 + 2] = treePositions[i3 + 2] + (galaxyPositions[i3 + 2] - treePositions[i3 + 2]) * tweenObj.t;
        
        if (currentState === STATE.TREE) {
            positions[i3 + 1] += Math.sin(time * 1.2 + i * 0.5) * 0.01;
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
    
    // 场景缓慢旋转
    scene.rotation.y += currentState === STATE.GALAXY ? 0.0004 : 0.0002;
    
    composer.render();
}

animate();

// ==================== 12. 事件监听 ====================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        morphTo(currentState === STATE.TREE ? STATE.GALAXY : STATE.TREE);
    }
    if (e.key === 'p' || e.key === 'P') {
        showRandomPhoto();
    }
    if (e.key === 'Escape' && currentPhoto) {
        hideCurrentPhoto();
    }
});

// 网络超时提示
setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "网络稍慢，已开启键盘模式";
        setTimeout(() => loader.style.display = 'none', 4000);
    }
}, 3000);
