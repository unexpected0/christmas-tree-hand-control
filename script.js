// ==================== 1. 场景与渲染器初始化 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// 背景色：极深的午夜蓝
scene.background = new THREE.Color(0x010103); 
// 雾气稍微淡一点，提高清晰度
scene.fog = new THREE.FogExp2(0x010103, 0.0015); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// 【修改点 1：拉近摄像机，让树变大】
camera.position.z = 16; 
camera.position.y = 5;

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// 使用 ACESFilmic 色调映射，对比度更好，看起来更清晰
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// ==================== 2. 后期处理 (Bloom/辉光效果) - 已优化 ====================
const renderScene = new THREE.RenderPass(scene, camera);

// 【修改点 2：调整辉光参数，拒绝光污染】
// 参数：分辨率, 强度(Strength), 半径(Radius), 阈值(Threshold)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 
    0.5,  // 强度：大幅降低，光感柔和
    0.2,  // 半径：光晕更收敛，不糊成一片
    0.2   // 阈值：提高发光门槛，保留暗部细节
);

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// ==================== 3. 生成粒子纹理 ====================
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64; // 纹理分辨率提高一点
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心极亮
    grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)'); 
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)'); 
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // 边缘透明
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ==================== 4. 粒子系统 (核心) ====================
const PARTICLE_COUNT = 10000; // 稍微减少一点点数量，让单个粒子更突出
const geometry = new THREE.BufferGeometry();
const glowTexture = createGlowTexture();

const material = new THREE.PointsMaterial({
    size: 0.9, // 【修改点 3：基础粒子稍微调大一点，配合近景】
    map: glowTexture,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const treePositions = [];
const galaxyPositions = [];
const colors = [];
const sizes = []; 

const colorPalette = [
    new THREE.Color('#00ffcc'), // 青
    new THREE.Color('#22ff88'), // 绿
    new THREE.Color('#ff0055'), // 红
    new THREE.Color('#ffcc00'), // 金
    new THREE.Color('#ffffff')  // 白
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    // --- 树形态 ---
    const angle = i * 0.08; 
    const height = 40; // 树稍微改矮胖一点，适应近景
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
    // 增加金色和红色的比例，更有节日气氛
    if (Math.random() > 0.92) color = colorPalette[3]; 
    else if (Math.random() > 0.92) color = colorPalette[2]; 
    else {
        const c1 = colorPalette[0];
        const c2 = colorPalette[1];
        color = c1.clone().lerp(c2, Math.random() * 0.7); 
    }
    colors.push(color.r, color.g, color.b);
    sizes.push(Math.random()); 
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
geometry.setAttribute('sizeOffset', new THREE.Float32BufferAttribute(sizes, 1));

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ==================== 5. 照片回忆逻辑 (不变) ====================
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
            const img = new
