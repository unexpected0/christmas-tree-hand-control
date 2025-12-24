 ==================== 1. 初始化 Three.js 场景 ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
 添加一些环境雾
scene.fog = new THREE.FogExp2(0x050510, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth  window.innerHeight, 0.1, 1000);
camera.position.z = 30;
camera.position.y = 10;

const renderer = new THREE.WebGLRenderer({ antialias true, alpha true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

 灯光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffd700, 1, 100);
pointLight.position.set(0, 20, 10);
scene.add(pointLight);

 ==================== 2. 创建粒子系统 (树与星空) ====================
const PARTICLE_COUNT = 3000;
const geometry = new THREE.BufferGeometry();
const material = new THREE.PointsMaterial({
    size 0.4,
    color 0xffffff,
    vertexColors true,
    blending THREE.AdditiveBlending,
    depthWrite false
});

 存储不同状态的位置数据
const treePositions = [];    树形态
const galaxyPositions = [];  散开形态
const colors = [];

 生成圣诞树形状 (螺旋圆锥)
for (let i = 0; i  PARTICLE_COUNT; i++) {
     --- 树形态计算 ---
    const angle = i  0.1; 
    const height = 40;
    const y = (i  PARTICLE_COUNT)  height - (height  2);  -20 到 20
    const radius = (1 - (y + height2)  height)  10;  底部宽，顶部尖
    
     加入一些随机性让树看起来更自然
    const randomX = (Math.random() - 0.5)  1.5;
    const randomZ = (Math.random() - 0.5)  1.5;
    
    const x = Math.cos(angle)  radius + randomX;
    const z = Math.sin(angle)  radius + randomZ;
    
    treePositions.push(x, y, z);

     --- 星空散开形态计算 (球体分布) ---
    const r = 40  Math.cbrt(Math.random());
    const theta = Math.random()  2  Math.PI;
    const phi = Math.acos(2  Math.random() - 1);
    
    const gx = r  Math.sin(phi)  Math.cos(theta);
    const gy = r  Math.sin(phi)  Math.sin(theta);
    const gz = r  Math.cos(phi);
    
    galaxyPositions.push(gx, gy, gz);

     --- 颜色 ---
     主要是绿色，混入红色(糖果)、金色(灯光)和白色(雪)
    const colorType = Math.random();
    const color = new THREE.Color();
    if (colorType  0.9) color.setHex(0xff0000);  红球糖果
    else if (colorType  0.8) color.setHex(0xffd700);  金光
    else if (colorType  0.7) color.setHex(0xffffff);  雪花
    else color.setHex(0x228b22);  树叶绿
    
    colors.push(color.r, color.g, color.b);
}

 初始化为树的位置
geometry.setAttribute('position', new THREE.Float32BufferAttribute(treePositions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const particles = new THREE.Points(geometry, material);
scene.add(particles);

 ==================== 3. 照片墙逻辑 ====================
const photoGroup = new THREE.Group();
scene.add(photoGroup);
const textureLoader = new THREE.TextureLoader();

 默认占位图 (用 Canvas 生成)
function createPlaceholderTexture(text) {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 256;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,256,256);
    ctx.fillStyle = '#333';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text  Memory, 128, 128);
    return new THREE.CanvasTexture(cvs);
}

 处理照片上传
document.getElementById('photo-upload').addEventListener('change', (e) = {
    const files = e.target.files;
    if (!files.length) return;

     清除旧照片
    while(photoGroup.children.length  0){ 
        photoGroup.remove(photoGroup.children[0]); 
    }

    Array.from(files).forEach((file, index) = {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () = {
                const tex = new THREE.Texture(img);
                tex.needsUpdate = true;
                const mat = new THREE.MeshBasicMaterial({ map tex, side THREE.DoubleSide });
                const geom = new THREE.PlaneGeometry(5, 5);
                const mesh = new THREE.Mesh(geom, mat);
                
                 随机分布在树周围
                mesh.position.set(
                    (Math.random() - 0.5)  30,
                    (Math.random() - 0.5)  30,
                    (Math.random() - 0.5)  10
                );
                mesh.visible = false;  初始隐藏
                photoGroup.add(mesh);
            }
        };
        reader.readAsDataURL(file);
    });
    alert(`已加载 ${files.length} 张照片！使用捏合手势查看。`);
});

 ==================== 4. 状态管理与动画 ====================
const STATE = {
    TREE 'tree',
    GALAXY 'galaxy',
    PHOTO 'photo'
};
let currentState = STATE.TREE;
let targetLookAt = new THREE.Vector3(0, 0, 0);

 GSAP 动画：切换形态
function morphTo(shape) {
    if ((shape === STATE.TREE && currentState === STATE.TREE) 
        (shape === STATE.GALAXY && currentState === STATE.GALAXY)) return;

    currentState = shape;
    const targetArray = shape === STATE.TREE  treePositions  galaxyPositions;
    const currentAttr = particles.geometry.attributes.position;

     我们需要一个临时对象来让 GSAP 进行补间
    const tweenObj = { t 0 };
    
     记录起始位置用于插值
    const startPositions = Float32Array.from(currentAttr.array);

    gsap.to(tweenObj, {
        t 1,
        duration 2,
        ease power2.inOut,
        onUpdate () = {
            for (let i = 0; i  PARTICLE_COUNT  3; i++) {
                 线性插值 (Lerp)
                const currentVal = startPositions[i] + (targetArray[i] - startPositions[i])  tweenObj.t;
                currentAttr.array[i] = currentVal;
            }
            currentAttr.needsUpdate = true;
        }
    });

     状态切换时处理照片显示
    photoGroup.children.forEach(mesh = {
        mesh.visible = (shape === STATE.GALAXY);  只有散开时才可能看到照片
        if(mesh.visible) {
             gsap.to(mesh.scale, {x 0, y 0, duration 0.5});  先缩小
        }
    });
}

 照片展示逻辑 (捏合触发)
function showRandomPhoto() {
    if (photoGroup.children.length === 0) return;
    const randomIndex = Math.floor(Math.random()  photoGroup.children.length);
    const photo = photoGroup.children[randomIndex];
    
    photo.visible = true;
    photo.position.set(0, 0, 20);  移到面前
    photo.lookAt(camera.position);
    
    gsap.to(photo.scale, {x 1.5, y 1.5, duration 0.5, ease back.out(1.7)});
    
     3秒后放回去
    setTimeout(() = {
        gsap.to(photo.scale, {x 0, y 0, duration 0.5, onComplete () = {
             photo.position.set((Math.random()-0.5)30, (Math.random()-0.5)30, (Math.random()-0.5)10);
        }});
    }, 3000);
}

 ==================== 5. MediaPipe 手势识别 ====================
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const loader = document.getElementById('loader');

 手势检测辅助函数
function detectGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

     1. 计算指尖到手腕的距离，判断手指是否弯曲
    function dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    const fingerTips = [indexTip, middleTip, ringTip, pinkyTip];
    const isFingersClosed = fingerTips.every(tip = dist(tip, wrist)  0.35);  阈值需根据实际调试
    
     2. 捏合检测 (拇指与食指距离)
    const pinchDist = dist(thumbTip, indexTip);
    const isPinching = pinchDist  0.05;

     3. 逻辑判断
    if (isFingersClosed) return 'FIST';  握拳
    if (isPinching) return 'PINCH';      捏合
    return 'OPEN';                       默认张开
}

function onResults(results) {
     隐藏加载动画
    loader.style.display = 'none';

     绘制调试视图
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length  0) {
         只取第一只手
        const landmarks = results.multiHandLandmarks[0];
        
         绘制骨架
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color '#00FF00', lineWidth 2});
        drawLandmarks(canvasCtx, landmarks, {color '#FF0000', lineWidth 1, radius 2});

         识别手势
        const gesture = detectGesture(landmarks);
        
         --- 交互逻辑 ---
        
         1. 握拳 - 树形态
        if (gesture === 'FIST') {
            morphTo(STATE.TREE);
        }
        
         2. 张开 - 星空形态
        if (gesture === 'OPEN') {
            morphTo(STATE.GALAXY);
            
             3. 在张开模式下，利用手掌中心位置旋转视角
             landmarks[9] 是中指根部，接近手掌中心
            const palmX = landmarks[9].x; 
             映射 0~1 到 -1~1
            const rotSpeed = (palmX - 0.5)  4; 
            scene.rotation.y += rotSpeed  0.05;
        }

         4. 捏合 - 选中照片 (加一个简单的防抖动锁)
        if (gesture === 'PINCH') {
            if (!window.isPinchingLocked) {
                showRandomPhoto();
                window.isPinchingLocked = true;
                setTimeout(() = window.isPinchingLocked = false, 2000);  2秒冷却
            }
        }
    }
    canvasCtx.restore();
}

 初始化 MediaPipe
const hands = new Hands({locateFile (file) = {
    return `httpscdn.jsdelivr.netnpm@mediapipehands${file}`;
}});
hands.setOptions({
    maxNumHands 1,
    modelComplexity 1,
    minDetectionConfidence 0.7,
    minTrackingConfidence 0.7
});
hands.onResults(onResults);

 启动摄像头
const cameraUtils = new Camera(videoElement, {
    onFrame async () = {
        await hands.send({image videoElement});
    },
    width 320,
    height 240
});
cameraUtils.start();


 ==================== 6. 渲染循环与响应式 ====================
function animate() {
    requestAnimationFrame(animate);
    
     树形态下的自转
    if (currentState === STATE.TREE) {
        particles.rotation.y += 0.002;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () = {
    camera.aspect = window.innerWidth  window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});