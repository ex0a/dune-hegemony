const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

class Logger {
    constructor(level = LOG_LEVELS.INFO) { this.level = level; }
    debug(message) { if (this.level <= LOG_LEVELS.DEBUG) console.log(`[DEBUG] ${message}`); }
    info(message) { if (this.level <= LOG_LEVELS.INFO) console.log(`[INFO] ${message}`); }
    warn(message) { if (this.level <= LOG_LEVELS.WARN) console.warn(`[WARN] ${message}`); }
    error(message) { if (this.level <= LOG_LEVELS.ERROR) console.error(`[ERROR] ${message}`); }
}

const logger = new Logger(LOG_LEVELS.DEBUG);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioEnabled = true;

function playSound(type) {
    if (!audioEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'select') { osc.frequency.value = 440; gain.gain.value = 0.5; osc.start(); osc.stop(audioCtx.currentTime + 0.1); }
    else if (type === 'attack') { osc.frequency.value = 220; gain.gain.value = 0.3; osc.start(); osc.stop(audioCtx.currentTime + 0.2); }
    else if (type === 'move') { osc.frequency.value = 660; gain.gain.value = 0.4; osc.start(); osc.stop(audioCtx.currentTime + 0.15); }
    else if (type === 'build') { osc.frequency.value = 330; gain.gain.value = 0.6; osc.start(); osc.stop(audioCtx.currentTime + 0.25); }
    else if (type === 'victory') { osc.frequency.value = 880; gain.gain.value = 0.7; osc.start(); osc.stop(audioCtx.currentTime + 0.5); }
}

class Hex {
    constructor(q, r) { this.q = q; this.r = r; }
    distanceTo(target) {
        return Math.max(Math.abs(this.q - target.q), Math.abs(this.r - target.r), Math.abs(-(this.q + this.r) - -(target.q + target.r)));
    }
}

class Unit {
    constructor(name, hp, maxHp, damage, speed, range, hex, faction, scene, textureLoader) {
        this.name = name;
        this.hp = hp;
        this.maxHp = maxHp;
        this.damage = damage;
        this.speed = speed;
        this.range = range;
        this.hex = hex;
        this.faction = faction;
        this.path = [];
        this.target = null;

        // Three.js Sprite for unit
        const texture = textureLoader.load(this.getTextureUrl());
        this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
        this.sprite.scale.set(1, 1, 1);
        this.updatePosition();
        scene.add(this.sprite);

        this.selected = false;
        this.animation = null;
    }

    getTextureUrl() {
        const urls = {
            'Sonic Sovereign': 'https://example.com/sonic_sovereign.png', // Replace with actual URLs or local assets
            'Fear Emperor': 'https://example.com/fear_emperor.png',
            'Sand Emperor': 'https://example.com/sand_emperor.png',
            'Sky Emperor': 'https://example.com/sky_emperor.png',
            'Truthsayer Emperor': 'https://example.com/truthsayer_emperor.png'
        };
        return urls[this.name] || 'https://example.com/default_unit.png';
    }

    updatePosition() {
        const x = this.hex.q * 1.5;
        const y = (this.hex.r + this.hex.q / 2) * Math.sqrt(3);
        this.sprite.position.set(x, y, 0.1);
    }

    moveTo(grid, targetQ, targetR) {
        playSound('move');
        logger.info(`Unit ${this.name} moving to ${targetQ},${targetR}`);
        this.path = grid.findPath(this.hex.q, this.hex.r, targetQ, targetR);
        if (this.path.length > 0) {
            this.animateMove(grid);
        }
    }

    animateMove(grid) {
        if (!this.path.length) return;
        const nextHex = this.path.shift();
        const startX = this.sprite.position.x;
        const startY = this.sprite.position.y;
        const endX = nextHex.q * 1.5;
        const endY = (nextHex.r + nextHex.q / 2) * Math.sqrt(3);
        let t = 0;
        this.animation = () => {
            t += 0.05 / this.speed;
            if (t >= 1) {
                this.hex = nextHex;
                this.updatePosition();
                grid.updateUnitPosition(this);
                this.animation = null;
                if (this.path.length > 0) this.animateMove(grid);
            } else {
                this.sprite.position.x = startX + (endX - startX) * t;
                this.sprite.position.y = startY + (endY - startY) * t;
            }
        };
    }

    attack(targetUnit, scene) {
        playSound('attack');
        logger.info(`${this.name} attacking ${targetUnit.name}`);
        if (this.hex.distanceTo(targetUnit.hex) <= this.range) {
            this.animateAttack(targetUnit, scene);
        }
    }

    animateAttack(targetUnit, scene) {
        const projectile = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff0000 }));
        projectile.scale.set(0.2, 0.2, 1);
        projectile.position.copy(this.sprite.position);
        scene.add(projectile);

        const startPos = this.sprite.position.clone();
        const endPos = targetUnit.sprite.position.clone();
        let t = 0;
        this.animation = () => {
            t += 0.05;
            if (t >= 1) {
                targetUnit.hp -= this.damage;
                scene.remove(projectile);
                this.animation = null;
                if (targetUnit.hp <= 0) grid.removeUnit(targetUnit);
            } else {
                projectile.position.lerpVectors(startPos, endPos, t);
            }
        };
    }
}

class HexGrid {
    constructor(width, height, container) {
        logger.info(`Initializing HexGrid ${width}x${height}`);
        this.width = width;
        this.height = height;
        this.tiles = new Map();
        this.units = [];
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-width, width, height, -height, 0.1, 1000);
        this.camera.position.set(0, 0, 10);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.textureLoader = new THREE.TextureLoader();
        this.initGrid();
        this.initUnits();
        this.animate();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedUnits = [];
        this.setupEventListeners(container);
    }

    initGrid() {
        logger.debug('Initializing grid');
        const tileTexture = this.textureLoader.load('https://example.com/hex_tile.png'); // Replace with actual texture URL
        for (let q = 0; q < this.width; q++) {
            for (let r = 0; r < this.height; r++) {
                const hex = new Hex(q, r);
                const geometry = new THREE.CircleGeometry(1, 6);
                const material = new THREE.MeshBasicMaterial({ map: tileTexture });
                const tile = new THREE.Mesh(geometry, material);
                tile.position.set(q * 1.5, (r + q / 2) * Math.sqrt(3), 0);
                this.scene.add(tile);
                this.tiles.set(`${q},${r}`, { hex, mesh: tile, unit: null });
            }
        }
    }

    initUnits() {
        logger.debug('Initializing units');
        const unit = new Unit('Sonic Sovereign', 100, 100, 50, 1, 1, new Hex(5, 5), 'Atreides', this.scene, this.textureLoader);
        this.units.push(unit);
        this.tiles.get('5,5').unit = unit;
    }

    findPath(startQ, startR, goalQ, goalR) {
        // Simplified A* pathfinding (replace with full implementation if needed)
        const path = [];
        let q = startQ, r = startR;
        while (q !== goalQ || r !== goalR) {
            if (q < goalQ) q++;
            else if (q > goalQ) q--;
            if (r < goalR) r++;
            else if (r > goalR) r--;
            path.push(new Hex(q, r));
        }
        return path;
    }

    updateUnitPosition(unit) {
        const key = `${unit.hex.q},${unit.hex.r}`;
        this.tiles.forEach(tile => tile.unit = tile.unit === unit ? null : tile.unit);
        this.tiles.get(key).unit = unit;
    }

    removeUnit(unit) {
        logger.info(`Removing unit ${unit.name}`);
        this.scene.remove(unit.sprite);
        this.units = this.units.filter(u => u !== unit);
        this.tiles.get(`${unit.hex.q},${unit.hex.r}`).unit = null;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.units.forEach(unit => {
            if (unit.animation) unit.animation();
        });
        this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners(container) {
        container.addEventListener('mousedown', e => this.handleMouseDown(e));
        container.addEventListener('mousemove', e => this.handleMouseMove(e));
        container.addEventListener('mouseup', e => this.handleMouseUp(e));
        container.addEventListener('contextmenu', e => this.handleRightClick(e));
        container.addEventListener('touchstart', e => this.handleTouchStart(e));
        container.addEventListener('touchmove', e => this.handleTouchMove(e));
        container.addEventListener('touchend', e => this.handleTouchEnd(e));
    }

    handleMouseDown(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        if (intersects.length) {
            const unit = this.units.find(u => u.sprite === intersects[0].object);
            if (unit) {
                this.selectedUnits = [unit];
                unit.selected = true;
                this.showBuildMenu();
            }
        }
    }

    handleMouseMove(event) {
        // Implement drag selection if needed
    }

    handleMouseUp(event) {
        // Finalize selection or move logic here
    }

    handleRightClick(event) {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        if (intersects.length && this.selectedUnits.length) {
            const hex = this.getHexFromPosition(intersects[0].point);
            this.selectedUnits.forEach(unit => unit.moveTo(this, hex.q, hex.r));
        }
    }

    handleTouchStart(event) {
        // Similar logic to mouse down for touch
    }

    handleTouchMove(event) {
        // Drag selection for touch
    }

    handleTouchEnd(event) {
        // Finalize touch selection/movement
    }

    getHexFromPosition(pos) {
        const q = Math.round(pos.x / 1.5);
        const r = Math.round((pos.y - q / 2 * Math.sqrt(3)) / Math.sqrt(3));
        return new Hex(q, r);
    }

    showBuildMenu() {
        const buildMenu = document.querySelector('.build-menu');
        buildMenu.style.display = 'block';
    }
}

const container = document.getElementById('game-container');
const grid = new HexGrid(20, 20, container);