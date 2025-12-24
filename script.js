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
// 【关键修改】调整 Bloom 参数，让光晕更收敛，核心更亮，边缘不糊
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2, // strength (强度): 稍微调高一点，为了让亮点更亮
    0.3, // radius (半径): 由 0.4 降到 0.2-0.3，让光晕范围变小，不糊成一片
    0.85 // threshold (阈值): 由 0.7 提至 0.85，只让最亮的核心发光
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 灯光系统 ====================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// 【关键修改】主方向光照亮树身，但不照亮树顶
const dirLight = new THREE.DirectionalLight(0xffd700, 1.0);
dirLight.position.set(5, 15, 10); // 位置降低，避免直接从上方照射树顶
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

// ==================== 5. 粒子纹理 (修改版) ====================
// 【关键修改】使用更“硬”的纹理，让粒子像灯珠而不是棉花糖
function createHardGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // 创建更“硬”的径向渐变
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心极亮
    grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)'); // 核心光点
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)'); // 快速衰减
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // 边缘透明

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

const glowTexture = createHardGlowTexture();
const particleMaterial = new THREE.PointsMaterial({
    size: 0.5, // 【关键】由 0.75 减小到 0.5，让粒子变小，缝隙变多
    map: glowTexture,
    transparent: true,
    opacity: 1.0, // 【关键】由 0.9 提至 1.0，让每个点更实
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

// 【关键修改】扩展更高级、鲜艳的颜色定义
const darkGreen = new THREE.Color('#004d25'); // 更深邃的森林绿
const mediumGreen = new THREE.Color('#0f8c3f'); // 标准圣诞绿
const lightGreen = new THREE.Color('#2eb85c'); // 明亮的祖母绿
const richGold = new THREE.Color('#ffd700'); // 富贵的纯金色
const warmOrange = new THREE.Color('#ff8c00'); // 暖橙色
const deepRed = new THREE.Color('#8b0000'); // 深红色宝石
const rubyRed = new THREE.Color('#dc143c'); // 红宝石色
const brightRed = new THREE.Color('#ff0000'); // 鲜红色

// 树的参数
const TREE_HEIGHT = 35;
const TREE_BOTTOM_Y = -(TREE_HEIGHT / 2) - 4; // 树底Y坐标

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const relativeHeight = i / PARTICLE_COUNT;

    // ==================== 【关键修改】新增：顶部粒子剔除逻辑 ====================
    // 越接近顶部，丢弃粒子的概率越高，解决树顶过亮和糊成一团的问题
    if (relativeHeight > 0.9) {
        // 从 0.9 开始剔除，越往上概率越大，到 1.0 时几乎全部剔除
        const discardChance = Math.pow((relativeHeight - 0.9) * 10, 2);
        if (Math.random() < discardChance) {
            continue; // 跳过这次循环，不生成这个粒子
        }
    }
    // ============================================================

    const y = relativeHeight * TREE_HEIGHT + TREE_BOTTOM_Y - 0.5; // 【关键】整体下移一点点，给星星留出空间
    const baseRadius = Math.pow((1 - relativeHeight), 0.8) * 10;
    const randomSpread = Math.random();
    const currentRadius = baseRadius * (0.3 + 0.7 * Math.sqrt(randomSpread));
    const angle = i * 2.4;

    // 树形位置
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

    // ==================== 【关键修改】颜色分配逻辑 ====================
    let color;
    const rand = Math.random();

    // 1. 金色 (增加占比): 0.85 ~ 1.0 (约 15%，更富贵)
    if (rand > 0.85) {
        color = richGold.clone();
        color.multiplyScalar(0.8 + Math.random() * 0.7); // 更大范围的亮度变化，闪烁感更强
    }
    // 2. 红色系列 (增加占比): 0.60 ~ 0.85 (约 25%，更喜庆)
    else if (rand > 0.60) {
        const redType = Math.random();
        if (redType > 0.7) {
            color = brightRed.clone().multiplyScalar(1.3); // 极亮红
        } else if (redType > 0.4) {
            color = rubyRed.clone().multiplyScalar(1.2); // 红宝石
        } else {
            color = deepRed.clone().multiplyScalar(0.9); // 深红
        }
    }
    // 3. 绿色系列 (主体): 0.0 ~ 0.60 (约 60%，依旧是主要颜色)
    else {
        if (rand > 0.4) { // 浅绿层
            color = lightGreen.clone();
            color.multiplyScalar(0.8 + Math.random() * 0.5);
        } else { // 深绿层 (树的内部)
            color = darkGreen.clone().lerp(mediumGreen, Math.random());
            color.multiplyScalar(0.6 + Math.random() * 0.4);
        }
    }
    // ============================================================

    colors.push(color.r, color.g, color.b);
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const particles = new THREE.Points(geometry, particleMaterial);
scene.add(particles);

// ==================== 7. 树顶立体五角星 (修改版) ====================
// 【关键修改】使用新的几何体生成逻辑，创建中心突起、棱角分明的星星
function createReal3DStar() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    // 参数设置
    const outerRadius = 1.4; // 外半径 (星星的角尖)
    const innerRadius = 0.6; // 内半径 (星星的凹处，越小角越尖)
    const thickness = 0.5; // 厚度 (中心点突出的距离，决定胖瘦)

    // 1. 添加中心顶点
    vertices.push(0, 0, thickness); // 索引 0: 正面中心点
    vertices.push(0, 0, -thickness); // 索引 1: 背面中心点

    // 2. 创建一圈顶点 (Z=0)
    const numPoints = 10;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i * Math.PI * 2) / numPoints - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        vertices.push(x, y, 0);
    }

    // 3. 构建三角形面
    for (let i = 0; i < numPoints; i++) {
        const currentRingIndex = i + 2;
        const nextRingIndex = ((i + 1) % numPoints) + 2;
        indices.push(0, currentRingIndex, nextRingIndex);
        indices.push(1, nextRingIndex, currentRingIndex);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

const starGeometry = createReal3DStar();

// 【关键修改】材质设置：高金属感、平面着色、自发光
const starMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xFFD700,
    metalness: 1.0, // 拉满金属感
    roughness: 0.2, // 稍微增加粗糙度，让光泽更有质感
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: 0xffaa00, // 自发光颜色
    emissiveIntensity: 0.5, // 稍微降低自发光，让环境光产生的阴影更明显
    flatShading: true, // 【关键】开启平面着色，产生钻石般的棱角感
    side: THREE.DoubleSide
});

const star = new THREE.Mesh(starGeometry, starMaterial);

// 调整星星位置到树尖尖上
const treeTopY = (1.0 * TREE_HEIGHT) + TREE_BOTTOM_Y + 1.5;
star.position.set(0, treeTopY, 0);
star.scale.setScalar(0.8);
star.rotation.x = 0; // 【关键】初始化为垂直

// ==================== 增强星星的光照效果 (修改版) ====================
// 【关键修改】严格限制灯光范围，只照亮星星，绝对不照亮树身
const starLights = [];

const topStarLight = new THREE.SpotLight(0xFFD700, 1.5);
topStarLight.distance = 4; // 【关键】极短的距离
topStarLight.angle = Math.PI / 8; // 【关键】非常聚拢的角度
topStarLight.penumbra = 0.2;
topStarLight.position.set(0, treeTopY + 3, 0);
topStarLight.target.position.set(0, treeTopY, 0);
scene.add(topStarLight);
scene.add(topStarLight.target);
starLights.push(topStarLight);

const frontStarLight = new THREE.SpotLight(0xFFFFFF, 1.2);
frontStarLight.distance = 5; // 【关键】限制距离
frontStarLight.angle = Math.PI / 10; // 【关键】极窄光束
frontStarLight.position.set(0, treeTopY, 4);
frontStarLight.target.position.set(0, treeTopY, 0);
scene.add(frontStarLight);
scene.add(frontStarLight.target);
starLights.push(frontStarLight);

// 侧面灯光也限制距离
const sideLight1 = new THREE.PointLight(0xFFAA00, 0.8, 3);
sideLight1.position.set(3, treeTopY, 0);
scene.add(sideLight1);
starLights.push(sideLight1);

const sideLight2 = new THREE.PointLight(0xFFAA00, 0.8, 3);
sideLight2.position.set(-3, treeTopY, 0);
scene.add(sideLight2);
starLights.push(sideLight2);

// 装饰性小灯光也限制范围
const orbitLights = new THREE.Group();
for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const light = new THREE.PointLight(0xFFFFAA, 0.5, 2); // 距离很短
    light.position.set(Math.cos(angle) * 2, treeTopY, Math.sin(angle) * 2);
    orbitLights.add(light);
    light.userData = {
        baseAngle: angle,
        speed: 0.2 + Math.random() * 0.1,
        radius: 2 + Math.random() * 0.5,
        heightOffset: Math.random() * 0.5
    };
}
scene.add(orbitLights);

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

// ==================== 8. 照片系统 (保持不变) ====================
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

// ==================== 9. 状态与动画控制 (保持不变) ====================
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

// ==================== 10. 手势控制 (保持不变) ====================
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
        star.rotation.y += star.userData.rotSpeed;
        star.position.y = star.userData.baseY + Math.sin(time * star.userData.floatSpeed) * star.userData.floatAmount;
        
        // 【关键修改】让星星保持垂直，只做微小的俯仰呼吸
        star.rotation.x = Math.sin(time * 0.5) * 0.03;
        star.rotation.z = Math.sin(time * 0.08) * 0.008;

        star.userData.lights.forEach((light, index) => {
            if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
                const baseIntensity = index === 0 ? 1.2 : index === 1 ? 0.9 : 0.6;
                light.intensity = baseIntensity + Math.sin(time * (1.2 + index * 0.2)) * 0.15;
            }
        });

        if (star.userData.orbitLights) {
            star.userData.orbitLights.children.forEach((light, i) => {
                const angle = time * light.userData.speed + light.userData.baseAngle;
                light.position.x = Math.cos(angle) * light.userData.radius;
                light.position.z = Math.sin(angle) * light.userData.radius;
                light.position.y = star.userData.baseY + Math.sin(time * 0.5 + i) * 0.3;
                light.intensity = 0.4 + Math.sin(time * 2 + i) * 0.1;
            });
        }
    }

    // 下雪动画
    const snowPositions = snow.geometry.attributes.position.array;
    const snowVelocities = snow.geometry.attributes.velocity.array;
    const snowSizes = snow.geometry.attributes.size.array;
    const snowOpacities = snow.geometry.attributes.opacity.array;

    for (let i = 0; i < snowPositions.length / 3; i++) {
        const i3 = i * 3;
        snowPositions[i3] += snowVelocities[i3];
        snowPositions[i3 + 1] += snowVelocities[i3 + 1];
        snowPositions[i3 + 2] += snowVelocities[i3 + 2];
        snowPositions[i3] += Math.sin(time * 0.3 + i * 0.1) * 0.003;
        snowPositions[i3 + 2] += Math.cos(time * 0.35 + i * 0.1) * 0.003;
        snowSizes[i] = 0.15 + Math.random() * 0.05 + Math.sin(time + i) * 0.02;

        if (snowPositions[i3 + 1] < -30) {
            snowPositions[i3] = (Math.random() - 0.5) * 120;
            snowPositions[i3 + 1] = 60 + Math.random() * 30;
            snowPositions[i3 + 2] = (Math.random() - 0.5) * 120;
            snowVelocities[i3] = (Math.random() - 0.5) * 0.015;
            snowVelocities[i3 + 1] = -0.03 - Math.random() * 0.04;
            snowVelocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
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

    scene.rotation.y += currentState === STATE.GALAXY ? 0.0004 : 0.0002;

    composer.render();
}

animate();

// ==================== 12. 事件监听 (保持不变) ====================
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

setTimeout(() => {
    if (loader && loader.style.display !== 'none') {
        loader.innerText = "网络稍慢，已开启键盘模式";
        setTimeout(() => loader.style.display = 'none', 4000);
    }
}, 3000);
