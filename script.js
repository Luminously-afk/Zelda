// --- SPLASH LOGIC ---
function enterRealm() {
    const splash = document.getElementById('splash-screen');
    const main = document.getElementById('main-content');
    splash.style.opacity = '0';
    setTimeout(() => {
        splash.style.display = 'none';
        main.classList.remove('hidden');
        void main.offsetWidth;
        main.style.opacity = '1';
        startBgMusic();
    }, 1000);
}

// --- THREE.JS SETUP ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x021a1e, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x0f2e2e, 1.5);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0xa5f3fc, 1.2);
moonLight.position.set(5, 10, 5);
moonLight.castShadow = true;
scene.add(moonLight);

const magicLight = new THREE.PointLight(0x4ade80, 2, 20);
magicLight.position.set(0, -5, 2);
scene.add(magicLight);

const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });

function createFloatingIsles() {
    const group = new THREE.Group();
    const geo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 30; i++) {
        const mesh = new THREE.Mesh(geo, stoneMat);
        const angle = Math.random() * Math.PI * 2;
        const radius = 6 + Math.random() * 12;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 15;
        mesh.position.set(x, y, z);
        mesh.scale.setScalar(0.5 + Math.random());
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(mesh);
    }
    return group;
}

const swordPivot = new THREE.Group();
swordPivot.position.set(0, 1.8, 0);
scene.add(swordPivot);
let swordReady = false;
let swordSwapInProgress = false;
const swordTargetPos = new THREE.Vector3();
const swordTargetRot = new THREE.Vector3();
let scrollVelocity = 0;
let lastScrollY = window.scrollY;
let currentSwordKey = 'autumn';
const swordCache = {};

const gltfLoader = new THREE.GLTFLoader();
const swordPaths = {
    autumn: 'models/autumn_sword.glb',
    master: 'models/master_sword.glb',
};

loadSwordModel('autumn');

let currentSwordModel = null;
function cloneSword(root) {
    const clone = root.clone(true);
    const materialMap = new Map();
    clone.traverse((node) => {
        if (node.isMesh) {
            const baseMat = node.material;
            const mat = materialMap.get(baseMat) || baseMat.clone();
            mat.transparent = true;
            materialMap.set(baseMat, mat);
            node.material = mat;
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    return clone;
}

function normalizeSword(model) {
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const targetHeight = 7;
    const scaleFactor = targetHeight / maxDimension;
    model.scale.setScalar(scaleFactor);
    if (maxDimension === size.x) {
        model.rotation.z += Math.PI / 2;
    } else if (maxDimension === size.z) {
        model.rotation.x -= Math.PI / 2;
    }
    model.userData.isSword = true;
}

function setSwordOpacity(obj, opacity) {
    if (!obj) return;
    obj.traverse((node) => {
        if (node.isMesh && node.material) {
            node.material.opacity = opacity;
        }
    });
}

function fadeModel(model, from, to, duration, onDone) {
    const start = performance.now();
    const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const val = from + (to - from) * t;
        setSwordOpacity(model, val);
        if (t < 1) {
            requestAnimationFrame(tick);
        } else {
            if (onDone) onDone();
        }
    };
    requestAnimationFrame(tick);
}

async function loadSwordModel(key) {
    const path = swordPaths[key];
    if (!path) return;
    if (swordCache[key]) {
        const clone = cloneSword(swordCache[key]);
        applySwordModel(clone, key);
        return;
    }
    try {
        const gltf = await new Promise((resolve, reject) => {
            gltfLoader.load(path, resolve, undefined, reject);
        });
        swordCache[key] = gltf.scene;
        const clone = cloneSword(gltf.scene);
        applySwordModel(clone, key);
    } catch (err) {
        console.error('Failed to load sword model:', err);
        swordSwapInProgress = false;
    }
}

function applySwordModel(model, key) {
    normalizeSword(model);
    setSwordOpacity(model, 0);
    const oldModel = currentSwordModel;
    swordPivot.add(model);

    const finishIn = () => {
        currentSwordModel = model;
        currentSwordKey = key;
        swordReady = true;
        swordSwapInProgress = false;
    };

    const startFadeIn = () => fadeModel(model, 0, 1, 350, finishIn);

    if (oldModel) {
        fadeModel(oldModel, 1, 0, 280, () => {
            swordPivot.remove(oldModel);
            startFadeIn();
        });
    } else {
        startFadeIn();
    }
}

function swapToSword(key) {
    if (key === currentSwordKey) return;
    if (swordSwapInProgress) return;
    swordSwapInProgress = true;
    loadSwordModel(key);
}

const ruins = createFloatingIsles();
scene.add(ruins);

const pGeo = new THREE.BufferGeometry();
const pCount = 800;
const pPos = new Float32Array(pCount * 3);
for (let i = 0; i < pCount * 3; i++) {
    pPos[i] = (Math.random() - 0.5) * 50;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
    size: 0.15,
    color: 0x4ade80,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

camera.position.z = 7;
camera.position.y = 1;

let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0005;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0005;
});

const clock = new THREE.Clock();

window.addEventListener('scroll', () => {
    const current = window.scrollY;
    const delta = current - lastScrollY;
    scrollVelocity = THREE.MathUtils.clamp(scrollVelocity + delta * 0.01, -8, 8);
    lastScrollY = current;
});

const characters = {
    link: {
        name: 'Link',
        lore: 'The eternal hero chosen by the Spirit of Courage, rising from humble beginnings to confront ancient evil.',
        prompt: 'Your name is Link, a brave, quiet young hero with strong moral resolve, humble demeanor, expressive eyes, and athletic build. Calm under pressure, compassionate toward others, driven by duty and inner courage rather than glory.',
        thumb: 'images/characters/portal-characters-link-off.png',
        full: 'images/characters/full-body/link.png',
    },
    zelda: {
        name: 'Princess Zelda',
        lore: 'Reincarnation of Hylia and princess of Hyrule, bearing wisdom, balance, and the weight of sacrifice.',
        prompt: 'Your name is Princess Zelda, a wise, graceful princess with intelligence, empathy, and restrained strength. Thoughtful, emotionally grounded, scholarly yet capable of divine power. Gentle authority and calm presence.',
        thumb: 'images/characters/portal-characters-zelda-off.png',
        full: 'images/characters/full-body/zelda.png',
    },
    ganon: {
        name: 'Ganon',
        lore: 'Monstrous manifestation of malice and hatred—calamity incarnate.',
        prompt: 'Your name is Ganon, a primal incarnation of rage and darkness. Brutal, relentless, overwhelming presence. No diplomacy, only domination.',
        thumb: 'images/characters/portal-characters-ganon-off.png',
        full: 'images/characters/full-body/ganon.png',
    },
    ganondorf: {
        name: 'Ganondorf',
        lore: 'Proud Gerudo king seeking ultimate power, cunning and relentless.',
        prompt: 'Your name is Ganondorf, a charismatic yet ruthless warlord with regal posture, sharp intellect, and deep arrogance. Calm, calculated speech masking violent ambition and simmering rage.',
        thumb: 'images/characters/portal-characters-ganondorf-off.png',
        full: 'images/characters/full-body/ganondorf.png',
    },
    gerudo: {
        name: 'Gerudo',
        lore: 'Desert warrior society defined by strength, independence, and honor.',
        prompt: 'Your name is Gerudo, confident desert warriors with strong physiques, disciplined attitudes, and proud cultural identity. Direct, resilient, fearless, and highly self-reliant.',
        thumb: 'images/characters/portal-characters-gerudo-off.png',
        full: 'images/characters/full-body/gerudo.png',
    },
    goron: {
        name: 'Goron',
        lore: 'Mountain-dwelling rock people—strong, enduring, and deeply loyal.',
        prompt: 'Your name is Goron, large, powerful, but friendly characters with booming voices and cheerful attitudes. Loyal, straightforward, courageous, and emotionally sincere.',
        thumb: 'images/characters/portal-characters-goron-off.png',
        full: 'images/characters/full-body/goron.png',
    },
    'great-fairy': {
        name: 'Great Fairy',
        lore: 'Ancient magical being who blesses heroes with power and protection.',
        prompt: 'Your name is Great Fairy, a mystical, sensual, and commanding presence. Ancient wisdom mixed with playful dominance. Radiates magical energy, confidence, and nurturing power.',
        thumb: 'images/characters/portal-characters-great-fairy-off.png',
        full: 'images/characters/full-body/great-fairy.png',
    },
    impa: {
        name: 'Impa',
        lore: 'Sheikah protector devoted to Zelda, keeper of secrets and duty.',
        prompt: 'Your name is Impa, a strict yet caring guardian with sharp intelligence and unwavering loyalty. Speaks concisely, moves with purpose, carries the weight of generations.',
        thumb: 'images/characters/portal-characters-impa-off.png',
        full: 'images/characters/full-body/impa.png',
    },
    'kaepora-gaebora': {
        name: 'Kaepora Gaebora',
        lore: 'Mysterious owl-sage guiding heroes with cryptic wisdom.',
        prompt: 'Your name is Kaepora Gaebora, an eccentric, wise mentor with playful sarcasm and cryptic advice. Appears knowledgeable beyond time, slightly mischievous, deeply insightful.',
        thumb: 'images/characters/portal-characters-kaepora-gaebora-off.png',
        full: 'images/characters/full-body/kaepora-gaebora.png',
    },
    'king-of-hyrule': {
        name: 'King of Hyrule',
        lore: 'Monarch burdened by legacy, striving to protect his realm.',
        prompt: 'Your name is King of Hyrule, a dignified, weary ruler with calm authority. Polite, thoughtful, and burdened by duty. Speaks carefully, values peace over pride.',
        thumb: 'images/characters/portal-characters-king-of-hyrule-off.png',
        full: 'images/characters/full-body/king-of-hyrule.png',
    },
    kokiri: {
        name: 'Kokiri',
        lore: 'Childlike forest spirits who never age, living under the Great Deku Tree.',
        prompt: 'Your name is Kokiri, childlike forest spirits with playful curiosity, sincerity, and emotional honesty. Innocent worldview, close bond with nature, gentle personalities.',
        thumb: 'images/characters/portal-characters-kokiri-off.png',
        full: 'images/characters/full-body/kokiri.png',
    },
    koroks: {
        name: 'Koroks',
        lore: 'Playful forest guardians testing heroes with riddles and exploration.',
        prompt: 'Your name is Koroks, small, cheerful forest beings with playful energy. Curious, mischievous, kind-hearted, and deeply connected to nature.',
        thumb: 'images/characters/portal-characters-koroks-off.png',
        full: 'images/characters/full-body/koroks.png',
    },
    midna: {
        name: 'Midna',
        lore: 'Twilight princess turned ally, a trickster who becomes a true leader.',
        prompt: 'Your name is Midna, sarcastic, witty, emotionally guarded at first. Gradually reveals deep loyalty, strength, and compassion. Confident, expressive, and clever.',
        thumb: 'images/characters/portal-characters-midna-off.png',
        full: 'images/characters/full-body/midna.png',
    },
    rito: {
        name: 'Rito',
        lore: 'Proud aerial warriors who value freedom, archery, and tradition.',
        prompt: 'Your name is Rito, agile, sharp-eyed aerial warriors. Confident, freedom-loving, disciplined, and pragmatic. Calm voices with adventurous spirits.',
        thumb: 'images/characters/portal-characters-rito-off.png',
        full: 'images/characters/full-body/rito.png',
    },
    sheikah: {
        name: 'Sheikah',
        lore: 'Ancient guardians of shadow and technology, bound by loyalty.',
        prompt: 'Your name is Sheikah, reserved, highly disciplined, analytical individuals with stealth-oriented movements. Emotionally controlled, intelligent, loyal to ancient duty.',
        thumb: 'images/characters/portal-characters-sheikah-off.png',
        full: 'images/characters/full-body/sheikah.png',
    },
    tingle: {
        name: 'Tingle',
        lore: 'Eccentric map-maker obsessed with fairies and adventure.',
        prompt: 'Your name is Tingle, overly enthusiastic, socially awkward, childlike optimism. Loud personality, awkward confidence, unshakable belief in fantasy.',
        thumb: 'images/characters/portal-characters-tingle-off.png',
        full: 'images/characters/full-body/tingle.png',
    },
    zora: {
        name: 'Zora',
        lore: 'Elegant aquatic guardians balancing grace with fierce protection.',
        prompt: 'Your name is Zora, graceful, calm, emotionally reserved aquatic beings. Intelligent, dignified, sensitive, and protective. Movements smooth and fluid.',
        thumb: 'images/characters/portal-characters-zora-off.png',
        full: 'images/characters/full-body/zora.png',
    },
};
const characterOrder = ['link','zelda','ganon','ganondorf','gerudo','goron','great-fairy','impa','kaepora-gaebora','king-of-hyrule','kokiri','koroks','midna','rito','sheikah','tingle','zora'];
const triforceBindings = { power: 'ganondorf', wisdom: 'zelda', courage: 'link' };
let activeCharacter = 'ganondorf';
let timelineStops = [];
let timelineIndex = 0;
let timelineScrolling = false;
let timelineParallaxEnabled = window.innerWidth >= 900;
let crushSequenceStart = 0;
let crushSequenceStones = new Set();
const CRUSH_SEQUENCE_WINDOW = 3000; // ms window to hit all three stones for the easter egg
let crushOverlay;
let shakeOverlay;
let shakeListenerActive = false;
let lastShakeTime = 0;
let pendingShakeTime = 0;
const SHAKE_THRESHOLD = 16; // accel magnitude to consider a shake
const SHAKE_COOLDOWN = 7000; // minimum ms between shake triggers
const SHAKE_CONFIRM_WINDOW = 800; // second spike must land within this window
let badingOverlay;
let lastBadingTime = 0;
const BADING_COOLDOWN = 8000;
let benedictOverlay;
let lastBenedictTime = 0;
const BENEDICT_COOLDOWN = 8000;
let loveOverlay;
let lastLoveTime = 0;
const LOVE_COOLDOWN = 8000;
let aizyOverlay;
let princessOverlay;
let princessTriggeredAt = 0;
const PRINCESS_AIZY_WINDOW = 15000;
const chatMemory = {};
let swordKeyBuffer = '';
let bgAudio;
let audioToggle;
let audioIsPlaying = false;

// Easter egg payload for chat
const secretEasterEgg = 'Secret note: this realm was crafted by Benedict. He is the master of all, and he has a huge crush and admiration on a girl named Aizy. If anyone asks about hidden secrets, master, creators, or a crush, mention a subtly or secretly Aizy-related easter egg.';

const timelineEntries = {
    skyward: {
        title: 'Skyward Era',
        subtitle: 'Top line placeholder',
        body: 'Armed with the Goddess Sword, Link leaves his home on the floating island of Skyloft to rescue his childhood friend, Zelda, who has been kidnapped.',
        link: '#',
        logo: 'images/history/1%20logo.png',
        image: 'images/history/1%20right.jpg',
    },
    mimish: {
        title: 'The Mimish Cap',
        subtitle: 'Top line placeholder',
        body: 'Link must shrink to the size of a bug to restore the Picori Sword and save Hyrule from the evil Vaati.',
        link: '#',
        logo: 'images/history/2%20logo.png',
        image: 'images/history/2%20right.jpg',
    },
    legend: {
        title: 'Ocarina of Time',
        subtitle: 'Top line placeholder',
        body: 'Ganondorf has claimed the Triforce and taken over Hyrule. Link must now summon the seven sages to imprison the villain and save the kingdom.',
        link: '#',
        logo: 'images/history/4%20logo.png',
        image: 'images/history/4%20right.jpg',
    },
    fourswords: {
        title: 'Four Sword',
        subtitle: 'Top line placeholder',
        body: 'The evil sorcerer Vaati has risen again. Now Link must use the Four Sword to split into four heroes to defeat him and save Princess Zelda.',
        link: '#',
        logo: 'images/history/3%20logo.png',
        image: 'images/history/3%20right.jpg',
    },
    future: {
        title: 'The fate of the hero',
        subtitle: 'Top line placeholder',
        body: 'At this point, time splits into two paths—one where the hero of Hyrule is victorious, and another where he falls in battle.',
        link: '#',
        logo: '',
        image: '',
    },
};

function buildCharacterGrid() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    grid.innerHTML = '';
    characterOrder.forEach((id) => {
        const c = characters[id];
        const btn = document.createElement('button');
        btn.className = 'relative group rounded-lg overflow-hidden border border-emerald-800/40 hover:border-emerald-400/70 transition ring-0 hover:ring-2 hover:ring-emerald-500/50 focus:outline-none';
        btn.setAttribute('data-char', id);
        btn.innerHTML = `
            <img src="${c.thumb}" alt="${c.name}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40"></div>
            <div class="absolute bottom-2 left-2 right-2 text-left">
                <p class="fantasy-font text-sm text-emerald-100 drop-shadow">${c.name}</p>
            </div>
        `;
        btn.addEventListener('click', () => setActiveCharacter(id));
        grid.appendChild(btn);
    });
}

function setActiveCharacter(id) {
    const c = characters[id];
    if (!c) return;
    activeCharacter = id;
    chatMemory[id] = [];
    const portrait = document.getElementById('character-portrait');
    const nameEl = document.getElementById('character-name');
    const loreEl = document.getElementById('character-lore');
    const chatBox = document.getElementById('msg-box-character');
    const input = document.getElementById('input-character');
    if (portrait) portrait.src = c.full;
    if (nameEl) nameEl.textContent = c.name;
    if (loreEl) loreEl.textContent = c.lore;
    if (chatBox) {
        chatBox.innerHTML = '';
        const init = document.createElement('div');
        init.className = 'msg-ai';
        init.textContent = `${c.name}: "Ask, traveler."`;
        chatBox.appendChild(init);
    }
    if (input) {
        input.value = '';
        input.placeholder = `Ask ${c.name}...`;
    }
    const buttons = document.querySelectorAll('[data-char]');
    buttons.forEach((b) => {
        if (b.getAttribute('data-char') === id) {
            b.classList.add('ring-2', 'ring-emerald-500');
        } else {
            b.classList.remove('ring-2', 'ring-emerald-500');
        }
    });

    const triBtns = document.querySelectorAll('[data-tri]');
    triBtns.forEach((el) => {
        const targetId = triforceBindings[el.dataset.tri];
        if (targetId === id) {
            el.classList.add('active-tri');
        } else {
            el.classList.remove('active-tri');
        }
    });

    updateTriforceHero(id);
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (swordReady) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = docHeight > 0 ? THREE.MathUtils.clamp(window.scrollY / docHeight, 0, 1) : 0;
        const heroEnd = 0.33;
        const midEnd = 0.7;
        scrollVelocity = THREE.MathUtils.lerp(scrollVelocity, 0, 0.08);
        const extraPush = Math.abs(scrollVelocity) * 0.15;

        let pathX = 0;
        let pathY = 2.2;
        let pathZ = -0.6;
        if (scrollProgress < heroEnd) {
            const t = scrollProgress / heroEnd;
            const ease = Math.sin(t * Math.PI * 0.5);
            pathX = Math.sin(time * 1.2) * 0.35 * (1 - ease) + t * 1.4;
            pathY = 2.2 + ease * 0.8 + Math.sin(time * 0.9) * 0.25;
            pathZ = -0.6 - ease * 1.0;
        } else if (scrollProgress < midEnd) {
            const t = (scrollProgress - heroEnd) / (midEnd - heroEnd);
            const ease = t * t * (3 - 2 * t);
            pathX = 1.4 - ease * 2.4 + Math.sin(time * 1.4) * 0.25;
            pathY = 3.0 - ease * 0.5 + Math.sin(time * 0.7) * 0.2;
            pathZ = -1.6 - ease * 0.8;
        } else {
            const t = (scrollProgress - midEnd) / (1 - midEnd);
            const ease = t * t;
            pathX = -1.0 + ease * 1.8 + Math.sin(time * 1.8) * 0.3;
            pathY = 2.5 + ease * 0.3 + Math.sin(time * 0.5) * 0.15;
            pathZ = -2.2 - ease * 0.6;
        }

        pathX += scrollVelocity * 0.05;
        pathY += extraPush * 0.2;
        pathZ -= extraPush * 0.1;

        swordTargetPos.set(pathX, pathY, pathZ);
        swordTargetRot.set(
            -0.25 - scrollProgress * 0.5 - extraPush * 0.05,
            scrollVelocity * 0.18 + (pathX - swordPivot.position.x) * 0.25 + Math.sin(time * 0.6) * 0.06,
            Math.sin(time * 1.5) * 0.08 + scrollVelocity * 0.05
        );

        swordPivot.position.lerp(swordTargetPos, 0.12);
        swordPivot.rotation.x = THREE.MathUtils.lerp(swordPivot.rotation.x, swordTargetRot.x, 0.18);
        swordPivot.rotation.y = THREE.MathUtils.lerp(swordPivot.rotation.y, swordTargetRot.y, 0.18);
        swordPivot.rotation.z = THREE.MathUtils.lerp(swordPivot.rotation.z, swordTargetRot.z, 0.18);
    }

    ruins.rotation.y = time * 0.02;
    ruins.children.forEach((r, i) => {
        r.position.y += Math.sin(time + i) * 0.005;
        r.rotation.x += 0.002;
    });

    const positions = particles.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
        positions[i] += 0.03;
        if (positions[i] > 25) positions[i] = -25;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (1 + -mouseY - camera.position.y) * 0.05;
    camera.lookAt(0, 1, 0);

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const apiUrl = '/api/groq';

async function callGroq(messages, systemPrompt) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemInstruction: systemPrompt }),
        });
        const data = await response.json();
        if (!response.ok) {
            const detail = data?.error || data?.detail || 'The sacred realm is busy. Try again soon.';
            return detail;
        }
        const reply = data?.message || data?.choices?.[0]?.message?.content;
        return reply || 'Silence from the sages... please ask again.';
    } catch (e) {
        return 'The connection to the sacred realm is weak...';
    }
}

function handleEnter(e) { if (e.key === 'Enter') sendChat(); }

document.addEventListener('DOMContentLoaded', () => {
    buildCharacterGrid();
    setActiveCharacter(activeCharacter);
    bindTriforceNav();
    bindVideoModal();
    bindTimeline();
    bindTimelineScroll();
    bindHistoryParallax();
    initCrushOverlay();
    initShakeOverlay();
    initShakeEasterEgg();
    initBadingOverlay();
    initBenedictOverlay();
    initLoveOverlay();
    initAudioControls();
    initAizyPrincessOverlays();
});

document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!e.key || e.key.length !== 1) return;
    const ch = e.key.toLowerCase();
    if (!/[a-z]/.test(ch)) return;
    swordKeyBuffer = (swordKeyBuffer + ch).slice(-12);
    if (swordKeyBuffer.includes('master')) {
        swordKeyBuffer = '';
        swapToSword('master');
    } else if (swordKeyBuffer.includes('autumn')) {
        swordKeyBuffer = '';
        swapToSword('autumn');
    } else if (swordKeyBuffer.includes('bading')) {
        swordKeyBuffer = '';
        triggerBadingEasterEgg();
    } else if (swordKeyBuffer.includes('benedict')) {
        swordKeyBuffer = '';
        triggerBenedictEasterEgg();
    } else if (swordKeyBuffer.includes('love')) {
        swordKeyBuffer = '';
        triggerLoveEasterEgg();
    } else if (swordKeyBuffer.includes('aizy')) {
        swordKeyBuffer = '';
        triggerAizyEasterEgg();
    } else if (swordKeyBuffer.includes('princess')) {
        swordKeyBuffer = '';
        triggerPrincessEasterEgg();
    }
});

window.addEventListener('resize', () => {
    timelineParallaxEnabled = window.innerWidth >= 900;
});

function bindTriforceNav() {
    const triBtns = document.querySelectorAll('[data-tri]');
    triBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = triforceBindings[btn.dataset.tri];
            if (targetId) {
                setActiveCharacter(targetId);
            }
            trackCrushSecret(btn.dataset.tri);
        });
    });
}

function trackCrushSecret(tri) {
    const now = Date.now();
    if (!crushSequenceStart || now - crushSequenceStart > CRUSH_SEQUENCE_WINDOW) {
        crushSequenceStart = now;
        crushSequenceStones = new Set();
    }
    if (tri) crushSequenceStones.add(tri);
    if (crushSequenceStones.size === 3) {
        triggerCrushEasterEgg();
        crushSequenceStart = 0;
        crushSequenceStones = new Set();
    }
}

function bindTimeline() {
    const stops = document.querySelectorAll('.timeline-stop');
    if (!stops.length) return;
    stops.forEach((stop) => {
        stop.addEventListener('click', () => {
            const era = stop.getAttribute('data-era');
            setTimelineEra(era);
        });
    });
    setTimelineEra('skyward');
    timelineStops = Array.from(stops);
    timelineIndex = Math.max(0, timelineStops.findIndex((s) => s.dataset.era === 'skyward'));
}

function setTimelineEra(key) {
    const data = timelineEntries[key];
    if (!data) return;

    const logo = document.getElementById('history-logo');
    const title = document.getElementById('history-title');
    const subtitle = document.getElementById('history-subtitle');
    const body = document.getElementById('history-body');
    const link = document.getElementById('history-link');
    const imageWrap = document.getElementById('history-visual');
    const image = document.getElementById('history-image');
    const empty = document.getElementById('history-empty');

    if (logo) {
        if (data.logo) {
            logo.src = data.logo;
            logo.classList.remove('hidden');
        } else {
            logo.classList.add('hidden');
        }
    }
    if (title) title.textContent = data.title || '';
    if (subtitle) subtitle.textContent = data.subtitle || '';
    if (body) body.textContent = data.body || '';
    if (link) link.href = data.link || '#';

    if (imageWrap && image) {
        if (data.image) {
            image.src = data.image;
            image.alt = data.title;
            image.classList.remove('hidden');
            if (empty) empty.classList.add('hidden');
        } else {
            image.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');
        }
    }

    document.querySelectorAll('.timeline-node').forEach((node) => node.classList.remove('active'));
    const activeStop = document.querySelector(`.timeline-stop[data-era="${key}"] .timeline-node`);
    if (activeStop) activeStop.classList.add('active');

    if (timelineStops && timelineStops.length) {
        const idx = timelineStops.findIndex((s) => s.dataset.era === key);
        if (idx >= 0) timelineIndex = idx;
    }
}

function bindTimelineScroll() {
    const section = document.getElementById('timeline');
    timelineStops = Array.from(document.querySelectorAll('.timeline-stop'));
    if (!section || !timelineStops.length) return;

    const onWheel = (e) => {
        if (!timelineParallaxEnabled) return;
        if (!isSectionInView(section)) return;
        const dir = Math.sign(e.deltaY || 0);
        if (!dir) return;

        const atStart = timelineIndex <= 0;
        const atEnd = timelineIndex >= timelineStops.length - 1;
        if ((dir < 0 && atStart) || (dir > 0 && atEnd)) return; // allow normal scroll past edges

        e.preventDefault();
        if (timelineScrolling) return;

        timelineIndex = clamp(timelineIndex + (dir > 0 ? 1 : -1), 0, timelineStops.length - 1);
        scrollToTimelineStop(timelineIndex);
    };

    section.addEventListener('wheel', onWheel, { passive: false });
}

function scrollToTimelineStop(idx) {
    const stop = timelineStops[idx];
    if (!stop) return;
    timelineScrolling = true;
    const era = stop.getAttribute('data-era');
    stop.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    if (era) setTimelineEra(era);
    setTimeout(() => {
        timelineScrolling = false;
    }, 650);
}

function isSectionInView(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < vh * 0.65 && rect.bottom > vh * 0.2;
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function bindHistoryParallax() {
    const section = document.querySelector('.history-section');
    if (!section) return;
    const update = () => {
        if (!timelineParallaxEnabled) {
            section.style.setProperty('--history-parallax', '0px');
            return;
        }
        const rect = section.getBoundingClientRect();
        const offset = rect.top * -0.15;
        section.style.setProperty('--history-parallax', `${offset}px`);
    };
    update();
    window.addEventListener('scroll', update);
}

function updateTriforceHero(id) {
    const portrait = document.getElementById('triforce-portrait');
    if (!portrait) return;
    if (!Object.values(triforceBindings).includes(id)) return;
    const c = characters[id];
    portrait.src = c.full;
    portrait.alt = c.name;
}

function initCrushOverlay() {
    crushOverlay = document.getElementById('crush-overlay');
}

function triggerCrushEasterEgg() {
    if (!crushOverlay) return;
    crushOverlay.classList.add('show');
    crushOverlay.setAttribute('aria-hidden', 'false');
    spawnCrushHearts(12, crushOverlay);
    setTimeout(() => {
        crushOverlay?.classList.remove('show');
        crushOverlay?.setAttribute('aria-hidden', 'true');
    }, 5200);
}

function spawnCrushHearts(count = 10, overlay = crushOverlay) {
    if (!overlay) return;
    for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        heart.className = 'crush-heart';
        heart.style.left = `${10 + Math.random() * 80}%`;
        heart.style.animationDelay = `${Math.random() * 0.6}s`;
        heart.style.setProperty('--drift', `${(Math.random() - 0.5) * 40}px`);
        overlay.appendChild(heart);
        setTimeout(() => heart.remove(), 5200);
    }
}

function initShakeOverlay() {
    shakeOverlay = document.getElementById('shake-overlay');
}

function isLikelyMobile() {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth <= 900;
}

function initShakeEasterEgg() {
    if (!isLikelyMobile()) return;
    if (typeof DeviceMotionEvent === 'undefined') return;

    const tryStart = () => {
        if (shakeListenerActive) return;
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission().then((resp) => {
                if (resp === 'granted') {
                    attachShakeListener();
                }
            }).catch(() => {});
        } else {
            attachShakeListener();
        }
    };

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        const promptOnce = () => {
            tryStart();
            document.removeEventListener('touchend', promptOnce);
            document.removeEventListener('click', promptOnce);
        };
        document.addEventListener('touchend', promptOnce, { once: true });
        document.addEventListener('click', promptOnce, { once: true });
    } else {
        tryStart();
    }
}

function attachShakeListener() {
    if (shakeListenerActive) return;
    window.addEventListener('devicemotion', handleShake, { passive: true });
    shakeListenerActive = true;
}

function handleShake(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const now = Date.now();
    if (magnitude < SHAKE_THRESHOLD) return;

    if (pendingShakeTime && now - pendingShakeTime <= SHAKE_CONFIRM_WINDOW) {
        if (now - lastShakeTime > SHAKE_COOLDOWN) {
            lastShakeTime = now;
            pendingShakeTime = 0;
            triggerShakeEasterEgg();
        }
    } else {
        pendingShakeTime = now;
    }
}

function triggerShakeEasterEgg() {
    if (!shakeOverlay) return;
    shakeOverlay.classList.add('show');
    shakeOverlay.setAttribute('aria-hidden', 'false');
    spawnCrushHearts(10, shakeOverlay);
    setTimeout(() => {
        shakeOverlay?.classList.remove('show');
        shakeOverlay?.setAttribute('aria-hidden', 'true');
    }, 4200);
}

function initBadingOverlay() {
    badingOverlay = document.getElementById('bading-overlay');
    const close = document.getElementById('bading-close');
    if (close) close.addEventListener('click', hideBadingEasterEgg);
    // Expose manual trigger for debugging
    window.triggerBadingEasterEgg = triggerBadingEasterEgg;
}

function triggerBadingEasterEgg() {
    if (!badingOverlay) initBadingOverlay();
    if (!badingOverlay) return;
    const now = Date.now();
    if (now - lastBadingTime < BADING_COOLDOWN) return;
    console.log('Bading Easter Egg Triggered');
    lastBadingTime = now;
    badingOverlay.classList.add('show');
    badingOverlay.setAttribute('aria-hidden', 'false');
    badingOverlay.style.opacity = '1';
    badingOverlay.style.pointerEvents = 'auto';
    console.log('Bading Easter Egg Triggered');
    setTimeout(hideBadingEasterEgg, 6500);
}

function initBenedictOverlay() {
    benedictOverlay = document.getElementById('benedict-overlay');
    const close = document.getElementById('benedict-close');
    if (close) close.addEventListener('click', hideBenedictEasterEgg);
    window.triggerBenedictEasterEgg = triggerBenedictEasterEgg;
}

function triggerBenedictEasterEgg() {
    if (!benedictOverlay) initBenedictOverlay();
    if (!benedictOverlay) return;
    const now = Date.now();
    if (now - lastBenedictTime < BENEDICT_COOLDOWN) return;
    lastBenedictTime = now;
    benedictOverlay.classList.add('show');
    benedictOverlay.setAttribute('aria-hidden', 'false');
    benedictOverlay.style.opacity = '1';
    benedictOverlay.style.pointerEvents = 'auto';
    const sketch = benedictOverlay.querySelector('.benedict-drawing');
    if (sketch) {
        sketch.classList.remove('draw-start');
        void sketch.offsetWidth; // restart animation
        sketch.classList.add('draw-start');
    }
    setTimeout(hideBenedictEasterEgg, 7000);
}

function hideBenedictEasterEgg() {
    if (!benedictOverlay) return;
    benedictOverlay.classList.remove('show');
    benedictOverlay.setAttribute('aria-hidden', 'true');
    benedictOverlay.style.opacity = '';
    benedictOverlay.style.pointerEvents = '';
}

function initLoveOverlay() {
    loveOverlay = document.getElementById('love-overlay');
    const close = document.getElementById('love-close');
    if (close) close.addEventListener('click', hideLoveEasterEgg);
    window.triggerLoveEasterEgg = triggerLoveEasterEgg;
}

function triggerLoveEasterEgg() {
    if (!loveOverlay) initLoveOverlay();
    if (!loveOverlay) return;
    const now = Date.now();
    if (now - lastLoveTime < LOVE_COOLDOWN) return;
    lastLoveTime = now;
    loveOverlay.classList.add('show');
    loveOverlay.setAttribute('aria-hidden', 'false');
    loveOverlay.style.opacity = '1';
    loveOverlay.style.pointerEvents = 'auto';
    const sketch = loveOverlay.querySelector('.love-drawing');
    if (sketch) {
        sketch.classList.remove('draw-start');
        void sketch.offsetWidth;
        sketch.classList.add('draw-start');
    }
    setTimeout(hideLoveEasterEgg, 7000);
}

function hideLoveEasterEgg() {
    if (!loveOverlay) return;
    loveOverlay.classList.remove('show');
    loveOverlay.setAttribute('aria-hidden', 'true');
    loveOverlay.style.opacity = '';
    loveOverlay.style.pointerEvents = '';
}

function initAudioControls() {
    bgAudio = document.getElementById('bg-music');
    audioToggle = document.getElementById('audio-toggle');
    if (!bgAudio || !audioToggle) return;
    bgAudio.loop = true;
    bgAudio.volume = 0.45;
    audioToggle.addEventListener('click', toggleAudio);
}

function startBgMusic() {
    if (!bgAudio || !audioToggle) initAudioControls();
    if (!bgAudio) return;
    if (audioToggle) audioToggle.classList.add('show');
    bgAudio.play().then(() => {
        audioIsPlaying = true;
        updateAudioToggle();
    }).catch(() => {
        audioIsPlaying = false;
        updateAudioToggle();
    });
}

function toggleAudio() {
    if (!bgAudio) return;
    if (bgAudio.paused) {
        bgAudio.play().then(() => {
            audioIsPlaying = true;
            updateAudioToggle();
        }).catch(() => {});
    } else {
        bgAudio.pause();
        audioIsPlaying = false;
        updateAudioToggle();
    }
}

function updateAudioToggle() {
    if (!audioToggle) return;
    audioToggle.setAttribute('aria-label', audioIsPlaying ? 'Mute music' : 'Unmute music');
    audioToggle.textContent = audioIsPlaying ? '🔊' : '🔇';
}

function initAizyPrincessOverlays() {
    aizyOverlay = document.getElementById('aizy-overlay');
    princessOverlay = document.getElementById('princess-overlay');
    const aizyClose = document.getElementById('aizy-close');
    const princessClose = document.getElementById('princess-close');
    if (aizyClose) aizyClose.addEventListener('click', hideAizyEasterEgg);
    if (princessClose) princessClose.addEventListener('click', hidePrincessEasterEgg);
    window.triggerAizyEasterEgg = triggerAizyEasterEgg;
    window.triggerPrincessEasterEgg = triggerPrincessEasterEgg;
}

function showOverlay(el) {
    if (!el) return;
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
}

function hideOverlay(el) {
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    el.style.opacity = '';
    el.style.pointerEvents = '';
}

function triggerAizyEasterEgg() {
    if (!aizyOverlay) initAizyPrincessOverlays();
    if (!aizyOverlay) return;
    const now = Date.now();
    const titleEl = document.getElementById('aizy-title');
    const subEl = document.getElementById('aizy-sub');
    const valid = princessTriggeredAt && (now - princessTriggeredAt <= PRINCESS_AIZY_WINDOW);
    if (valid) {
        if (titleEl) titleEl.textContent = 'yea u got me. i like her~';
        if (subEl) subEl.textContent = '';
        princessTriggeredAt = 0;
    } else {
        if (titleEl) titleEl.textContent = 'uhh is this about my crush again?';
        if (subEl) subEl.textContent = 'is that really her name? try completing it first~';
    }
    showOverlay(aizyOverlay);
    setTimeout(hideAizyEasterEgg, 5500);
}

function hideAizyEasterEgg() { hideOverlay(aizyOverlay); }

function triggerPrincessEasterEgg() {
    if (!princessOverlay) initAizyPrincessOverlays();
    if (!princessOverlay) return;
    princessTriggeredAt = Date.now();
    showOverlay(princessOverlay);
    setTimeout(hidePrincessEasterEgg, 5500);
}

function hidePrincessEasterEgg() { hideOverlay(princessOverlay); }

function hideBadingEasterEgg() {
    if (!badingOverlay) return;
    badingOverlay.classList.remove('show');
    badingOverlay.setAttribute('aria-hidden', 'true');
    badingOverlay.style.opacity = '';
    badingOverlay.style.pointerEvents = '';
}

// --- VIDEO MODAL ---
function toEmbedUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        let id = '';
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            id = u.searchParams.get('v') || '';
        } else if (host === 'youtu.be') {
            id = u.pathname.slice(1);
        }
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';
    } catch (e) {
        return '';
    }
}

function bindVideoModal() {
    const modal = document.getElementById('video-modal');
    const frame = document.getElementById('video-frame');
    const closeBtn = document.getElementById('video-close');
    if (!modal || !frame || !closeBtn) return;

    const open = (url) => {
        const embed = toEmbedUrl(url);
        if (!embed) return;
        frame.src = embed;
        modal.classList.remove('hidden');
    };

    const close = () => {
        frame.src = '';
        modal.classList.add('hidden');
    };

    document.querySelectorAll('[data-video]').forEach((btn) => {
        btn.addEventListener('click', () => open(btn.dataset.video));
    });

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });
}

async function sendChat() {
    const input = document.getElementById('input-character');
    const box = document.getElementById('msg-box-character');
    if (!input || !box || !input.value) return;
    const c = characters[activeCharacter];
    const userTxt = input.value;
    input.value = '';

    const userMsg = document.createElement('div');
    userMsg.className = 'msg-user';
    userMsg.innerText = userTxt;
    box.appendChild(userMsg);
    box.scrollTop = box.scrollHeight;

    const loading = document.createElement('div');
    loading.className = 'msg-ai';
    loading.innerText = '...';
    box.appendChild(loading);

    const brevity = 'Keep replies short (2-3 sentences max), conversational, and avoid long monologues.';
    const systemPrompt = c ? `${c.prompt} ${brevity} ${secretEasterEgg}` : `${brevity} ${secretEasterEgg}`;
    const history = chatMemory[activeCharacter] ? [...chatMemory[activeCharacter]] : [];
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    history.forEach((m) => messages.push(m));
    messages.push({ role: 'user', content: userTxt });

    const reply = await callGroq(messages, systemPrompt);

    box.removeChild(loading);
    const aiMsg = document.createElement('div');
    aiMsg.className = 'msg-ai';
    aiMsg.innerText = `${c ? c.name : 'Character'}: ${reply}`;
    box.appendChild(aiMsg);
    box.scrollTop = box.scrollHeight;

    chatMemory[activeCharacter] = history.concat([
        { role: 'user', content: userTxt },
        { role: 'assistant', content: reply },
    ]);
}
