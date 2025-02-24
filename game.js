const GAME_VERSION = '1.2.0';
const VERSION_HASH = 'A3K5P8M7Q';

function verifyVersion() {
    return VERSION_HASH === 'A3K5P8M7Q';
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioEnabled = true;

function playSound(type) {
    if (!audioEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'select') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'attack') {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'victory') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'move') {
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'build') {
        osc.frequency.setValueAtTime(330, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    }
}

class Hex {
    constructor(q, r) {
        this.q = q;
        this.r = r;
    }
    distanceTo(target) {
        return Math.max(Math.abs(this.q - target.q), Math.abs(this.r - target.r), Math.abs(-(this.q + this.r) - -(target.q + target.r)));
    }
}

class Unit {
    constructor(name, hp, maxHp, damage, speed, range, hex, faction, ability, superweapon, prestige = 0, fear = 0, faith = 0, favor = 0, will = 0, image = null) {
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
        this.ability = ability;
        this.superweapon = superweapon;
        this.prestige = prestige;
        this.fear = fear;
        this.faith = faith;
        this.favor = favor;
        this.will = will;
        this.cooldown = 0;
        this.superCooldown = 0;
        this.stealth = 0;
        this.image = image;
        this.attackFrame = 0;
        this.selected = false;
    }

    moveTo(grid, targetQ, targetR, isTouch = false) {
        playSound('move');
        if (isTouch && this.faction === 'Spacing Guild' && grid.players.get(this.faction).spice >= 75 && this.cooldown <= 0) {
            grid.players.get(this.faction).spice -= 75;
            this.hex = new Hex(targetQ, targetR);
            this.cooldown = Math.max(20 - Math.floor(this.favor / 200), 5);
        } else {
            this.path = grid.findPath(this.hex.q, this.hex.r, targetQ, targetR);
        }
        this.target = null;
    }

    attack(targetUnit) {
        if (this.hex.distanceTo(targetUnit.hex) <= this.range) {
            this.target = targetUnit;
            this.attackFrame = 10;
            playSound('attack');
        }
    }

    useSuperweapon(grid, targetQ, targetR) {
        const player = grid.players.get(this.faction);
        if (this.superweapon && this.superCooldown <= 0) {
            if (this.faction === 'Atreides' && player.choam >= 500) {
                player.choam -= 500;
                grid.getUnitsInRadius(new Hex(targetQ, targetR), 8).forEach(u => u.speed = 0);
                this.superCooldown = 70;
            } else if (this.faction === 'Harkonnen' && this.fear >= 600) {
                this.fear -= 600;
                grid.getUnitsInRadius(new Hex(targetQ, targetR), 10).forEach(u => u.hp -= 250);
                this.superCooldown = 90;
            } else if (this.faction === 'Fremen' && this.faith >= 700) {
                this.faith -= 700;
                grid.worms.add({ hp: 800, damage: 400, hex: new Hex(targetQ, targetR), isGreatMaker: true, speed: 3 });
                this.superCooldown = 100;
            } else if (this.faction === 'Spacing Guild' && this.favor >= 800) {
                this.favor -= 800;
                for (let i = 0; i < 8; i++) {
                    const spawnHex = grid.getRandomHexNear(new Hex(targetQ, targetR), 10);
                    if (spawnHex) grid.tiles.get(`${spawnHex.q},${spawnHex.r}`).unit = new Unit('Sky Emperor', 260, 260, 140, 2, 2, spawnHex, 'Spacing Guild', null, null, 0, 0, 0, 0, 0, grid.images['Sky Emperor']);
                }
                this.superCooldown = 120;
            } else if (this.faction === 'Bene Gesserit' && player.will >= 800) {
                player.will -= 800;
                const targets = grid.getUnitsInRadius(new Hex(targetQ, targetR), 10).filter(u => u.faction !== 'Bene Gesserit').slice(0, 5);
                targets.forEach(u => { u.faction = 'Bene Gesserit'; player.controlledUnits = (player.controlledUnits || 0) + 1; });
                this.superCooldown = 120;
            }
        }
    }

    update(grid) {
        if (this.hp <= 0) {
            grid.tiles.get(`${this.hex.q},${this.hex.r}`).unit = null;
            const player = grid.players.get(this.faction);
            if (this.faction === 'Atreides') player.prestige += 25;
            if (this.faction === 'Harkonnen') player.fear += 30;
            if (this.faction === 'Fremen') player.faith += 20;
            if (this.faction === 'Spacing Guild') player.favor += 25;
            if (this.faction === 'Bene Gesserit') player.will += 30;
            return;
        }
        if (this.cooldown > 0) this.cooldown--;
        if (this.superCooldown > 0) this.superCooldown--;
        if (this.stealth > 0) this.stealth--;
        if (this.attackFrame > 0) this.attackFrame--;
        if (this.target && this.hex.distanceTo(this.target.hex) <= this.range) {
            const damage = this.faction === 'Fremen' && this.faith >= 850 && Math.random() < 0.5 ? this.damage * 2 : this.damage;
            this.target.hp -= damage;
            if (this.target.hp <= 0) {
                this.target = null;
                if (this.faction === 'Atreides') player.prestige += 25;
                if (this.faction === 'Harkonnen') player.fear += 30;
                if (this.faction === 'Fremen') player.faith += 20;
                if (this.faction === 'Spacing Guild') player.favor += 25;
                if (this.faction === 'Bene Gesserit') player.will += 30;
            }
        } else if (this.path.length > 0 && this.speed > 0) {
            let nextHex = this.path.shift();
            if (grid.tiles.get(`${nextHex.q},${nextHex.r}`).sinkhole) {
                this.hp -= 200;
                this.path = [];
            } else {
                grid.tiles.get(`${this.hex.q},${this.hex.r}`).unit = null;
                this.hex = nextHex;
                grid.tiles.get(`${nextHex.q},${nextHex.r}`).unit = this;
                this.speed--;
            }
        }
        const tile = grid.tiles.get(`${this.hex.q},${this.hex.r}`);
        if (this.faction === 'Fremen' && tile.terrain === 'sand') {
            this.hp = Math.min(this.hp + 15, this.maxHp);
            if (this.stealth === 0 && grid.weather.type === 'sandstorm' && Math.random() < 0.15) this.stealth = 15;
        }
    }
}

class HexGrid {
    constructor(width, height, canvas) {
        this.width = width;
        this.height = height;
        this.tiles = new Map();
        this.worms = new Set();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.players = new Map();
        this.spiceFields = new Map();
        this.weather = { type: 'clear', cyclesLeft: 0 };
        this.sinkholes = new Map();
        this.gameState = 'loading';
        this.selectedUnits = [];
        this.aiOpponents = [];
        this.loadingProgress = 0;
        this.mapSize = 'medium';
        this.biomeMix = { sand: 0.6, rock: 0.2, spice: 0.1, crater: 0.1 };
        this.campaignMode = false;
        this.narrative = false;
        this.mission = null;
        this.hazardDensity = 'medium';
        this.coopPlayers = 1;
        this.images = {};
        this.versionVerified = false;
        this.spiceDominanceCounter = 0;
        this.wormSupremacyCounter = 0;
        this.buildMenuVisible = false;
        this.selectionBox = { startX: 0, startY: 0, endX: 0, endY: 0, active: false };
        this.lastTapTime = 0;
        this.setupLoadingScreen();
    }

    setupLoadingScreen() {
        this.ctx.fillStyle = '#f4a460';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Loading Dune: Hegemony of the Sands', 50, 50);
        this.ctx.fillText(`Version: ${GAME_VERSION} - Hash: ${VERSION_HASH}`, 50, 80);

        this.mode = 'single-player';
        this.playerFaction = 'Bene Gesserit';
        this.aiCount = 1;
        this.difficulty = 'medium';
        this.mapSize = 'medium';
        this.biomeMix = { sand: 0.6, rock: 0.2, spice: 0.1, crater: 0.1 };
        this.campaignMode = 1;
        this.narrative = true;
        this.hazardDensity = 'medium';
        this.coopPlayers = 1;
        this.verifySetup();

        this.buildMenu = document.createElement('div');
        this.buildMenu.className = 'build-menu';
        document.body.appendChild(this.buildMenu);

        this.selectionBoxEl = document.createElement('div');
        this.selectionBoxEl.className = 'selection-box';
        document.body.appendChild(this.selectionBoxEl);
    }

    verifySetup() {
        let checks = [
            () => { this.ctx.fillRect(0, 0, 10, 10); return true; },
            () => { this.canvas.addEventListener('touchstart', () => {}); return true; },
            () => { this.aiOpponents = this.initAI(); return this.aiOpponents.length > 0; },
            () => { this.generateMap(); return this.spiceFields.size > 0; },
            () => { return this.narrative ? this.loadNarrative() : true; },
            () => { this.generateAssets(); return Object.keys(this.images).length > 0; },
            () => { this.versionVerified = verifyVersion(); return this.versionVerified; },
            () => { this.startGame(); return this.players.size > 0; }
        ];
        let completed = 0;
        checks.forEach((check, i) => {
            setTimeout(() => {
                const success = check();
                this.ctx.fillText(`${['Canvas', 'Inputs', 'AI', 'Map', 'Narr', 'Assets', 'Vers', 'Game'][i]}: ${success ? 'OK' : 'FAIL'}`, 50, 100 + i * 30);
                this.loadingProgress += 12.5;
                if (++completed === checks.length && this.versionVerified) this.gameState = this.mode === 'single-player' ? 'single' : 'coop';
                else if (!this.versionVerified) this.ctx.fillText('Version mismatch detected!', 50, 300);
            }, i * 500);
        });
    }

    generateAssets() {
        const assetCanvas = document.createElement('canvas');
        assetCanvas.width = 40;
        assetCanvas.height = 40;
        const assetCtx = assetCanvas.getContext('2d');

        const unitsToGenerate = {
            'Sonic Sovereign': () => {
                assetCtx.fillStyle = 'blue';
                assetCtx.beginPath();
                assetCtx.moveTo(20, 10);
                assetCtx.lineTo(10, 30);
                assetCtx.lineTo(15, 25);
                assetCtx.lineTo(20, 20);
                assetCtx.lineTo(25, 25);
                assetCtx.lineTo(30, 30);
                assetCtx.fill();
                assetCtx.strokeStyle = 'yellow';
                assetCtx.lineWidth = 2;
                for (let i = 0; i < 5; i++) {
                    assetCtx.beginPath();
                    assetCtx.arc(20, 20, 10 + i * 3, 0, Math.PI * 1.5, true);
                    assetCtx.stroke();
                }
                assetCtx.fillStyle = 'white';
                assetCtx.globalAlpha = 0.5;
                assetCtx.fillRect(10, 10, 20, 20);
                assetCtx.globalAlpha = 1;
                assetCtx.fillStyle = 'blue';
                assetCtx.beginPath();
                assetCtx.arc(15, 15, 3, 0, 2 * Math.PI);
                assetCtx.arc(25, 15, 3, 0, 2 * Math.PI);
                assetCtx.fill();
                return assetCanvas.toDataURL();
            },
            'Fear Emperor': () => {
                assetCtx.fillStyle = 'red';
                assetCtx.beginPath();
                assetCtx.moveTo(15, 10);
                assetCtx.lineTo(25, 10);
                assetCtx.lineTo(30, 15);
                assetCtx.lineTo(35, 20);
                assetCtx.lineTo(30, 25);
                assetCtx.lineTo(25, 30);
                assetCtx.lineTo(15, 30);
                assetCtx.lineTo(10, 25);
                assetCtx.lineTo(5, 20);
                assetCtx.lineTo(10, 15);
                assetCtx.fill();
                assetCtx.fillStyle = 'black';
                assetCtx.fillRect(15, 15, 10, 10);
                assetCtx.fillStyle = 'green';
                assetCtx.beginPath();
                assetCtx.moveTo(20, 10);
                assetCtx.lineTo(40, 5);
                assetCtx.lineTo(0, 5);
                assetCtx.fill();
                assetCtx.strokeStyle = 'gray';
                assetCtx.lineWidth = 2;
                assetCtx.beginPath();
                assetCtx.moveTo(10, 30);
                assetCtx.lineTo(30, 30);
                assetCtx.stroke();
                assetCtx.fillStyle = 'red';
                assetCtx.globalAlpha = 0.5;
                assetCtx.fillRect(5, 5, 30, 30);
                assetCtx.globalAlpha = 1;
                return assetCanvas.toDataURL();
            },
            'Sand Emperor': () => {
                assetCtx.fillStyle = 'brown';
                assetCtx.beginPath();
                assetCtx.ellipse(20, 25, 15, 10, 0, 0, 2 * Math.PI);
                assetCtx.fill();
                assetCtx.fillStyle = 'green';
                assetCtx.beginPath();
                assetCtx.ellipse(20, 15, 5, 7, 0, 0, 2 * Math.PI);
                assetCtx.fill();
                assetCtx.fillStyle = 'gold';
                assetCtx.globalAlpha = 0.5;
                assetCtx.fillRect(10, 10, 20, 20);
                assetCtx.globalAlpha = 1;
                assetCtx.strokeStyle = 'brown';
                assetCtx.lineWidth = 1;
                assetCtx.beginPath();
                assetCtx.moveTo(10, 30);
                assetCtx.lineTo(30, 30);
                assetCtx.stroke();
                assetCtx.beginPath();
                assetCtx.moveTo(15, 35);
                assetCtx.lineTo(25, 35);
                assetCtx.stroke();
                assetCtx.beginPath();
                assetCtx.arc(20, 30, 5, 0, Math.PI, true);
                assetCtx.stroke();
                return assetCanvas.toDataURL();
            },
            'Sky Emperor': () => {
                assetCtx.fillStyle = 'purple';
                assetCtx.beginPath();
                assetCtx.moveTo(20, 10);
                assetCtx.lineTo(10, 25);
                assetCtx.lineTo(15, 30);
                assetCtx.lineTo(20, 35);
                assetCtx.lineTo(25, 30);
                assetCtx.lineTo(30, 25);
                assetCtx.fill();
                assetCtx.fillStyle = 'black';
                assetCtx.beginPath();
                assetCtx.arc(20, 20, 5, 0, 2 * Math.PI);
                assetCtx.fill();
                assetCtx.strokeStyle = 'purple';
                assetCtx.lineWidth = 2;
                assetCtx.strokeRect(10, 10, 20, 20);
                assetCtx.fillStyle = 'purple';
                assetCtx.globalAlpha = 0.5;
                assetCtx.fillRect(15, 15, 10, 10);
                assetCtx.globalAlpha = 1;
                assetCtx.fillStyle = 'blue';
                assetCtx.beginPath();
                assetCtx.arc(15, 25, 2, 0, 2 * Math.PI);
                assetCtx.arc(25, 25, 2, 0, 2 * Math.PI);
                assetCtx.arc(20, 30, 2, 0, 2 * Math.PI);
                assetCtx.fill();
                return assetCanvas.toDataURL();
            },
            'Truthsayer Emperor': () => {
                assetCtx.fillStyle = 'black';
                assetCtx.beginPath();
                assetCtx.ellipse(20, 20, 10, 15, 0, 0, 2 * Math.PI);
                assetCtx.fill();
                assetCtx.strokeStyle = 'purple';
                assetCtx.lineWidth = 2;
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i;
                    assetCtx.beginPath();
                    assetCtx.arc(20, 20, 15, angle, angle + Math.PI / 10);
                    assetCtx.stroke();
                }
                assetCtx.fillStyle = 'violet';
                assetCtx.globalAlpha = 0.5;
                assetCtx.fillRect(10, 10, 20, 20);
                assetCtx.globalAlpha = 1;
                assetCtx.fillStyle = 'gray';
                assetCtx.globalAlpha = 0.3;
                assetCtx.beginPath();
                assetCtx.arc(20, 20, 20, 0, 2 * Math.PI);
                assetCtx.fill();
                assetCtx.globalAlpha = 1;
                return assetCanvas.toDataURL();
            }
        };

        for (let [name, generator] of Object.entries(unitsToGenerate)) {
            const cachedImage = localStorage.getItem(`dune_asset_${name}`);
            if (cachedImage) {
                this.images[name] = cachedImage;
            } else {
                assetCtx.clearRect(0, 0, assetCanvas.width, assetCanvas.height);
                this.images[name] = generator();
                localStorage.setItem(`dune_asset_${name}`, this.images[name]);
            }
        }
    }

    initAI() {
        const factions = ['Atreides', 'Harkonnen', 'Fremen', 'Spacing Guild', 'Bene Gesserit'].filter(f => f !== this.playerFaction);
        const personalities = ['defensive', 'swarm', 'strategic', 'opportunist'];
        return Array.from({ length: this.aiCount }, (_, i) => ({
            faction: factions[i % factions.length],
            id: `AI-${i}`,
            personality: personalities[i % personalities.length],
            difficulty: this.difficulty,
            aggression: this.difficulty === 'easy' ? 0.5 : this.difficulty === 'medium' ? 1 : this.difficulty === 'hard' ? 1.5 : this.difficulty === 'expert' ? 2 : 3,
            foresight: this.difficulty === 'legend' ? 8 : this.difficulty === 'expert' ? 5 : this.difficulty === 'hard' ? 3 : 1
        }));
    }

    generateMap() {
        this.width = this.height = this.mapSize === 'small' ? 25 : this.mapSize === 'medium' ? 50 : this.mapSize === 'large' ? 75 : 100;
        const spiceCount = this.mapSize === 'small' ? 10 : this.mapSize === 'medium' ? 20 : this.mapSize === 'large' ? 30 : 40;
        const playerPositions = [[5, 5], [this.width - 5, 5], [5, this.height - 5], [this.width - 5, this.height - 5], [Math.floor(this.width / 2), Math.floor(this.height / 2)]];
        for (let i = 0; i < spiceCount; i++) {
            const q = Math.floor(Math.random() * this.width), r = Math.floor(Math.random() * this.height);
            if (!this.tiles.has(`${q},${r}`)) this.addTile(q, r, 'spice');
        }
        for (let q = 0; q < this.width; q++) {
            for (let r = 0; r < this.height; r++) {
                if (!this.tiles.has(`${q},${r}`)) {
                    const rand = Math.random();
                    const terrain = rand < this.biomeMix.sand ? 'sand' : rand < this.biomeMix.sand + this.biomeMix.rock ? 'rock' : rand < this.biomeMix.sand + this.biomeMix.rock + this.biomeMix.crater ? 'crater' : 'sand';
                    this.addTile(q, r, terrain);
                }
            }
        }
        this.playerPositions = playerPositions;
    }

    addTile(q, r, terrain, building = null) {
        const hex = new Hex(q, r);
        this.tiles.set(`${q},${r}`, { hex, terrain, unit: null, building, owner: null, sinkhole: false, vortex: 0, visible: false });
        if (terrain === 'spice') this.spiceFields.set(`${q},${r}`, { yield: 30, remaining: 3000 });
        if (building) building.hp = 300;
        if (terrain === 'sand' && Math.random() < (this.hazardDensity === 'low' ? 0.05 : this.hazardDensity === 'medium' ? 0.1 : 0.15)) this.sinkholes.set(`${q},${r}`, { risk: 10 });
    }

    loadNarrative() {
        const narratives = {
            1: "Paul, seize the Spice!",
            2: "Shai-Hulud rises!",
            3: "Break the chains!",
            4: "Shaddam falls!",
            5: "The Messiah is born!",
            6: "Alia, twist their fates!",
            7: "End the old regime!",
            8: "The prophecy fulfills!",
            9: "Leto II’s eternal rule!",
            10: "Secure the future!"
        };
        this.narrativeText = narratives[this.campaignMode] || "The desert awaits…";
        return true;
    }

    startGame() {
        this.players.set('player', { spice: 1500, solaris: 750, choam: 0, prestige: 0, faith: 0, favor: 0, fear: 0, will: 0, controlledUnits: 0 });
        this.addTile(5, 5, 'sand', { name: `${this.playerFaction} Base`, hp: 300 });
        this.tiles.get('5,5').owner = 'player';
        this.tiles.get('5,5').visible = true;

        if (this.mode === 'coop') {
            for (let i = 1; i < this.coopPlayers; i++) {
                const [q, r] = this.playerPositions[i];
                this.players.set(`coop-${i}`, { spice: 1500, solaris: 750, choam: 0, prestige: 0, faith: 0, favor: 0, fear: 0, will: 0, controlledUnits: 0 });
                this.addTile(q, r, 'sand', { name: `${this.playerFaction} Base`, hp: 300 });
                this.tiles.get(`${q},${r}`).owner = `coop-${i}`;
                this.tiles.get(`${q},${r}`).visible = true;
            }
        }

        this.aiOpponents.forEach((ai, i) => {
            const [q, r] = this.playerPositions[i + (this.mode === 'coop' ? this.coopPlayers : 1)];
            this.players.set(ai.id, { spice: 1500, solaris: 750, choam: 0, prestige: 0, faith: 0, favor: 0, fear: 0, will: 0, controlledUnits: 0 });
            this.addTile(q, r, 'sand', { name: `${ai.faction} Base`, hp: 300 });
            this.tiles.get(`${q},${r}`).owner = ai.id;
        });

        if (this.campaignMode) {
            const missions = {
                1: { type: 'The Desert Reclaims', goal: this.spiceFields.size * 0.5, cyclesLeft: 300 },
                2: { type: 'Worms of Destiny', goal: 5, cyclesLeft: 400, wormsKilled: 0 },
                3: { type: 'Fremen Uprising', goal: this.aiCount, cyclesLeft: 600, basesDestroyed: 0 },
                4: { type: 'Fall of the Imperium', spiceGoal: this.spiceFields.size * 0.75, baseGoal: 2, cyclesLeft: 800, basesDestroyed: 0 },
                5: { type: 'Ascension of Muad’Dib', spiceGoal: this.spiceFields.size * 0.8, wormGoal: 3, baseGoal: 1, cyclesLeft: 1000, wormsKilled: 0, basesDestroyed: 0 },
                6: { type: 'Voice of the Sisterhood', controlGoal: 3, spiceGoal: this.spiceFields.size * 0.8, cyclesLeft: 1200, controlledUnits: 0 },
                7: { type: 'Shaddam’s Last Stand', spiceGoal: this.spiceFields.size * 0.9, baseGoal: 4, cyclesLeft: 1500, basesDestroyed: 0 },
                8: { type: 'Kwisatz Haderach', spiceGoal: this.spiceFields.size, wormGoal: 5, baseGoal: 4, cyclesLeft: 2000, wormsKilled: 0, basesDestroyed: 0 },
                9: { type: 'God Emperor’s Reign', spiceGoal: this.spiceFields.size, wormGoal: 6, baseGoal: 5, cyclesLeft: 2500, wormsKilled: 0, basesDestroyed: 0 },
                10: { type: 'The Golden Path', spiceGoal: this.spiceFields.size, wormGoal: 7, baseGoal: 6, cyclesLeft: 3000, wormsKilled: 0, basesDestroyed: 0 }
            };
            this.mission = missions[this.campaignMode];
        }
    }

    tickAI() {
        if (this.gameState !== 'single' && this.gameState !== 'coop') return;
        this.aiOpponents.forEach(ai => {
            const player = this.players.get(ai.id);
            const threatScore = this.calculateThreat(ai);
            const spiceFieldsControlled = Array.from(this.spiceFields.values()).filter(f => this.tiles.get(`${f.hex.q},${f.hex.r}`).owner === ai.id).length;

            if (player.spice > 4000 * ai.aggression) {
                if (ai.personality === 'swarm') this.buildSwarmUnits(ai);
                else if (ai.personality === 'defensive') this.buildDefensiveStructure(ai);
                else if (ai.personality === 'opportunist' && Math.random() < 0.3) this.triggerRandomEvent(ai);
                else if (ai.personality === 'strategic') this.buildStrategicUnit(ai);
                else this.buildUnit(ai);
            }
            if (player.solaris > 2000 * ai.aggression) this.buildStructure(ai);

            const target = this.findWeakestPlayerUnit(ai);
            if (target) {
                const nearestUnit = this.findNearestUnit(ai, target.hex);
                if (nearestUnit) {
                    nearestUnit.attack(target);
                    if (nearestUnit.superweapon && this.canUseSuperweapon(ai, nearestUnit)) nearestUnit.useSuperweapon(this, target.hex.q, target.hex.r);
                    if (ai.faction === 'Bene Gesserit' && player.will >= 200 && Math.random() < 0.15) this.controlPlayerUnit(ai, target);
                }
            }

            if (spiceFieldsControlled < 15 * ai.aggression || ai.personality === 'strategic') this.expandToSpice(ai);

            if (this.campaignMode) {
                if (this.mission.type === 'Worms of Destiny') this.summonWorm(ai);
                if (this.mission.type === 'Voice of the Sisterhood' && player.will >= 800) nearestUnit?.useSuperweapon(this, target.hex.q, target.hex.r);
                if (this.mission.type === 'The Golden Path' && spiceFieldsControlled > this.mission.spiceGoal * 0.9) this.buildDefensiveStructure(ai);
            }

            if (ai.faction === 'Fremen') this.worms.forEach(w => w.hp += 20 * ai.aggression);
            if (ai.faction === 'Spacing Guild' && Math.random() < 0.2) this.lockSpiceField(ai);
            if (ai.faction === 'Bene Gesserit' && Math.random() < 0.1) this.manipulateHazard(ai);
        });
        
        if (this.mode === 'coop') {
            for (let i = 1; i < this.coopPlayers; i++) {
                const coopPlayer = this.players.get(`coop-${i}`);
                if (coopPlayer.spice > 4000) {
                    const base = Array.from(this.tiles.values()).find(t => t.building && t.owner === `coop-${i}`);
                    if (base) {
                        this.tiles.get(`${base.hex.q},${base.hex.r}`).unit = new Unit('Truthsayer Emperor', 300, 300, 160, 2, 2, base.hex, 'Bene Gesserit', null, null, 0, 0, 0, 0, 0, this.images['Truthsayer Emperor']);
                        coopPlayer.spice -= 680;
                        coopPlayer.solaris -= 340;
                    }
                }
            }
        }
    }

    calculateThreat(ai) {
        let score = 0;
        for (let tile of this.tiles.values()) {
            if (tile.unit && (tile.unit.faction === 'player' || tile.unit.faction.startsWith('coop'))) {
                const dist = tile.hex.distanceTo(this.tiles.get(`${5,5}`).hex);
                score += tile.unit.hp * 0.5 - dist * 0.3 + this.spiceFields.size * 10;
            }
        }
        return score * ai.aggression;
    }

    buildUnit(ai) {
        const base = Array.from(this.tiles.values()).find(t => t.building && t.owner === ai.id);
        if (base) {
            const unit = new Unit('Basic Unit', 100, 100, 50, 1, 1, base.hex, ai.faction, null, null, 0, 0, 0, 0, 0, this.images['Sonic Sovereign']);
            this.tiles.get(`${base.hex.q},${base.hex.r}`).unit = unit;
            this.players.get(ai.id).spice -= 200;
            this.players.get(ai.id).solaris -= 100;
            playSound('build');
        }
    }

    buildSwarmUnits(ai) {
        const base = Array.from(this.tiles.values()).find(t => t.building && t.owner === ai.id);
        if (base) {
            for (let i = 0; i < 10; i++) {
                const unit = new Unit('Slave Soldier', 25, 25, 15, 1, 1, base.hex, ai.faction, null, null, 0, 0, 0, 0, 0, this.images['Fear Emperor']);
                this.tiles.get(`${base.hex.q},${base.hex.r}`).unit = unit;
                this.players.get(ai.id).spice -= 40;
                this.players.get(ai.id).solaris -= 5;
            }
            playSound('build');
        }
    }

    buildDefensiveStructure(ai) {
        const base = Array.from(this.tiles.values()).find(t => t.building && t.owner === ai.id);
        if (base) {
            const q = base.hex.q + Math.floor(Math.random() * 3) - 1, r = base.hex.r + Math.floor(Math.random() * 3) - 1;
            if (!this.tiles.has(`${q},${r}`)) {
                this.addTile(q, r, 'sand', { name: `${ai.faction} Shield`, hp: 400 });
                this.tiles.get(`${q},${r}`).owner = ai.id;
                this.players.get(ai.id).spice -= 250;
                this.players.get(ai.id).solaris -= 120;
                playSound('build');
            }
        }
    }

    buildStrategicUnit(ai) {
        const base = Array.from(this.tiles.values()).find(t => t.building && t.owner === ai.id);
        if (base) {
            const unitName = ai.faction === 'Atreides' ? 'Sonic Sovereign' : ai.faction === 'Harkonnen' ? 'Fear Emperor' : ai.faction === 'Fremen' ? 'Sand Emperor' : ai.faction === 'Spacing Guild' ? 'Sky Emperor' : 'Truthsayer Emperor';
            this.tiles.get(`${base.hex.q},${base.hex.r}`).unit = new Unit(unitName, 300, 300, 160, 2, 2, base.hex, ai.faction, null, null, 0, 0, 0, 0, 0, this.images[unitName]);
            this.players.get(ai.id).spice -= 680;
            this.players.get(ai.id).solaris -= 340;
            playSound('build');
        }
    }

    triggerRandomEvent(ai) {
        const events = [
            () => this.worms.add({ hp: 200, damage: 100, hex: this.getRandomDeepSand(), speed: 1 }),
            () => this.sinkholes.set(`${Math.floor(Math.random() * this.width)},${Math.floor(Math.random() * this.height)}`, { risk: 75 }),
            () => this.buildUnit(ai)
        ];
        events[Math.floor(Math.random() * events.length)]();
    }

    findWeakestPlayerUnit(ai) {
        return Array.from(this.tiles.values())
            .filter(t => t.unit && (t.unit.faction === 'player' || t.unit.faction.startsWith('coop')))
            .sort((a, b) => a.unit.hp - b.unit.hp)[0]?.unit;
    }

    findNearestUnit(ai, targetHex) {
        return Array.from(this.tiles.values())
            .filter(t => t.unit && t.unit.faction === ai.faction)
            .sort((a, b) => a.hex.distanceTo(targetHex) - b.hex.distanceTo(targetHex))[0]?.unit;
    }

    canUseSuperweapon(ai, unit) {
        const player = this.players.get(ai.id);
        return (ai.faction === 'Atreides' && player.choam >= 500) ||
               (ai.faction === 'Harkonnen' && unit.fear >= 600) ||
               (ai.faction === 'Fremen' && unit.faith >= 700) ||
               (ai.faction === 'Spacing Guild' && unit.favor >= 800) ||
               (ai.faction === 'Bene Gesserit' && player.will >= 800);
    }

    expandToSpice(ai) {
        const nearestSpice = Array.from(this.spiceFields.values())
            .sort((a, b) => a.hex.distanceTo(this.tiles.get(`${5,5}`).hex) - b.hex.distanceTo(this.tiles.get(`${5,5}`).hex))[0];
        if (nearestSpice) {
            const unit = Array.from(this.tiles.values()).find(t => t.unit && t.unit.faction === ai.faction)?.unit;
            if (unit) unit.moveTo(this, nearestSpice.hex.q, nearestSpice.hex.r);
        }
    }

    summonWorm(ai) {
        if (Math.random() < 0.25 * ai.aggression) {
            const spawnHex = this.getRandomDeepSand();
            if (spawnHex) this.worms.add({ hp: 200, damage: 100, hex: spawnHex, speed: 1 });
        }
    }

    lockSpiceField(ai) {
        const field = Array.from(this.spiceFields.values()).find(f => !this.tiles.get(`${f.hex.q},${f.hex.r}`).owner);
        if (field) {
            this.tiles.get(`${field.hex.q},${field.hex.r}`).owner = ai.faction;
            this.players.get(ai.id).favor += 100;
        }
    }

    controlPlayerUnit(ai, target) {
        if (target.faction === 'player' || target.faction.startsWith('coop')) {
            target.faction = ai.faction;
            this.players.get(ai.id).will += 60;
            if (this.mission?.type === 'Voice of the Sisterhood') this.mission.controlledUnits++;
        }
    }

    manipulateHazard(ai) {
        const hazard = Math.random() < 0.5 ? 'sinkhole' : 'vortex';
        const q = Math.floor(Math.random() * this.width), r = Math.floor(Math.random() * this.height);
        if (hazard === 'sinkhole') this.sinkholes.set(`${q},${r}`, { risk: 75 });
        else this.tiles.get(`${q},${r}`).vortex = 25;
        this.players.get(ai.id).will += 25;
    }

    getUnitsInRadius(center, radius) {
        return Array.from(this.tiles.values()).filter(t => center.distanceTo(t.hex) <= radius && t.unit).map(t => t.unit);
    }

    getRandomHexNear(center, radius) {
        const candidates = Array.from(this.tiles.values()).filter(t => center.distanceTo(t.hex) <= radius && !t.unit && !t.building);
        return candidates[Math.floor(Math.random() * candidates.length)]?.hex;
    }

    getRandomDeepSand() {
        const deepSand = Array.from(this.tiles.values()).filter(t => t.terrain === 'sand' && !t.unit && !t.building && !t.sinkhole);
        return deepSand[Math.floor(Math.random() * deepSand.length)]?.hex;
    }

    findPath(startQ, startR, goalQ, goalR) {
        let start = new Hex(startQ, startR);
        let goal = new Hex(goalQ, goalR);
        let openSet = [start];
        let cameFrom = new Map();
        let gScore = new Map([[`${start.q},${start.r}`, 0]]);
        let fScore = new Map([[`${start.q},${start.r}`, start.distanceTo(goal)]]);

        while (openSet.length > 0) {
            let current = openSet.sort((a, b) => fScore.get(`${a.q},${a.r}`) - fScore.get(`${b.q},${b.r}`))[0];
            if (current.q === goal.q && current.r === goal.r) {
                let path = [current];
                while (cameFrom.has(`${current.q},${current.r}`)) {
                    current = cameFrom.get(`${current.q},${current.r}`);
                    path.unshift(current);
                }
                return path;
            }

            openSet = openSet.filter(h => h !== current);
            const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
            for (let [dq, dr] of directions) {
                const q = current.q + dq;
                const r = current.r + dr;
                if (this.tiles.has(`${q},${r}`)) {
                    let tentativeG = gScore.get(`${current.q},${current.r}`) + 1;
                    if (tentativeG < (gScore.get(`${q},${r}`) || Infinity)) {
                        cameFrom.set(`${q},${r}`, current);
                        gScore.set(`${q},${r}`, tentativeG);
                        fScore.set(`${q},${r}`, tentativeG + new Hex(q, r).distanceTo(goal));
                        if (!openSet.some(h => h.q === q && h.r === r)) openSet.push(new Hex(q, r));
                    }
                }
            }
        }
        return [];
    }

    showBuildMenu() {
        if (!this.selectedUnits.length || !this.selectedUnits[0].faction.startsWith('player') || this.buildMenuVisible) return;
        this.buildMenuVisible = true;
        this.buildMenu.style.display = 'block';
        this.buildMenu.innerHTML = `
            <button onclick="grid.buildStructure('Sanctum')">Sanctum (300s, 100s)</button>
            <button onclick="grid.buildStructure('Cathedral')">Psi Cathedral (400s, 200s)</button>
            <button onclick="grid.buildUnit('Sovereign')">Psi Sovereign (340s, 150s)</button>
            <button onclick="grid.buildStructure('Node')">Truthsayer Node (250s, 120s)</button>
            <button onclick="grid.hideBuildMenu()">Close</button>
        `;
    }

    hideBuildMenu() {
        this.buildMenuVisible = false;
        this.buildMenu.style.display = 'none';
    }

    buildStructure(type) {
        if (!this.selectedUnits.length) return;
        const player = this.players.get(this.selectedUnits[0].faction);
        const costs = {
            'Sanctum': { spice: 300, solaris: 100 },
            'Cathedral': { spice: 400, solaris: 200 },
            'Node': { spice: 250, solaris: 120 }
        };
        const cost = costs[type];
        if (player.spice >= cost.spice && player.solaris >= cost.solaris) {
            player.spice -= cost.spice;
            player.solaris -= cost.solaris;
            const hex = this.selectedUnits[0].hex;
            this.tiles.get(`${hex.q},${hex.r}`).building = { name: type === 'Sanctum' ? 'Sisterhood Sanctum' : type === 'Cathedral' ? 'Psi Cathedral' : 'Truthsayer Node', hp: 300 };
            this.tiles.get(`${hex.q},${hex.r}`).owner = this.selectedUnits[0].faction;
            this.hideBuildMenu();
            playSound('build');
        }
    }

    buildUnit(type) {
        if (!this.selectedUnits.length) return;
        const player = this.players.get(this.selectedUnits[0].faction);
        const costs = {
            'Sovereign': { spice: 340, solaris: 150 }
        };
        const cost = costs[type];
        if (player.spice >= cost.spice && player.solaris >= cost.solaris) {
            player.spice -= cost.spice;
            player.solaris -= cost.solaris;
            const hex = this.selectedUnits[0].hex;
            this.tiles.get(`${hex.q},${hex.r}`).unit = new Unit('Psi Sovereign', 160, 160, 0, 1, 1, hex, this.selectedUnits[0].faction, null, null, 0, 0, 0, 0, 0, this.images['Truthsayer Emperor']);
            this.hideBuildMenu();
            playSound('build');
        }
    }

    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        this.selectionBox.startX = x;
        this.selectionBox.startY = y;
        this.selectionBox.endX = x;
        this.selectionBox.endY = y;
        this.selectionBox.active = true;
    }

    handleMouseMove(event) {
        if (!this.selectionBox.active) return;
        const rect = this.canvas.getBoundingClientRect();
        this.selectionBox.endX = event.clientX - rect.left;
        this.selectionBox.endY = event.clientY - rect.top;

        this.selectionBoxEl.style.left = `${Math.min(this.selectionBox.startX, this.selectionBox.endX) + rect.left}px`;
        this.selectionBoxEl.style.top = `${Math.min(this.selectionBox.startY, this.selectionBox.endY) + rect.top}px`;
        this.selectionBoxEl.style.width = `${Math.abs(this.selectionBox.endX - this.selectionBox.startX)}px`;
        this.selectionBoxEl.style.height = `${Math.abs(this.selectionBox.endY - this.selectionBox.startY)}px`;
        this.selectionBoxEl.style.display = 'block';
    }

    handleMouseUp(event) {
        if (this.selectionBox.active) {
            const rect = this.canvas.getBoundingClientRect();
            const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
            const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
            const minY = Math.min(this.selectionBox.startY, this.selectionBox.endY);
            const maxY = Math.max(this.selectionBox.startY, this.selectionBox.endY);
            this.selectedUnits = [];
            for (let tile of this.tiles.values()) {
                if (tile.unit && (tile.unit.faction === 'player' || tile.unit.faction.startsWith('coop'))) {
                    const size = 20;
                    const x = size * 3/2 * tile.hex.q + this.canvas.width / 2 - this.width * size * 0.75;
                    const y = size * Math.sqrt(3) * (tile.hex.r + tile.hex.q/2) + this.canvas.height / 2 - this.height * size * Math.sqrt(3) / 2;
                    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                        tile.unit.selected = true;
                        this.selectedUnits.push(tile.unit);
                    } else {
                        tile.unit.selected = false;
                    }
                }
            }
            if (this.selectedUnits.length === 1) this.showBuildMenu();
            else this.hideBuildMenu();
            this.selectionBox.active = false;
            this.selectionBoxEl.style.display = 'none';
            playSound('select');
        }
    }

    handleTouchStart(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.touches[0].clientX - rect.left;
        const y = event.touches[0].clientY - rect.top;
        const currentTime = Date.now();
        const hex = this.pixelToHex(x, y);
        
        if (currentTime - this.lastTapTime < 300 && this.selectedUnits.length > 0) {
            if (hex) {
                this.selectedUnits.forEach(unit => unit.moveTo(this, hex.q, hex.r));
            }
            this.lastTapTime = 0;
        } else {
            if (hex) {
                const tile = this.tiles.get(`${hex.q},${hex.r}`);
                if (tile.unit && (tile.unit.faction === 'player' || tile.unit.faction.startsWith('coop'))) {
                    if (event.touches.length === 1) {
                        this.selectedUnits = [tile.unit];
                        tile.unit.selected = true;
                        this.showBuildMenu();
                    }
                } else {
                    this.selectionBox.startX = x;
                    this.selectionBox.startY = y;
                    this.selectionBox.endX = x;
                    this.selectionBox.endY = y;
                    this.selectionBox.active = true;
                }
            }
            this.lastTapTime = currentTime;
        }
        playSound('select');
    }

    handleTouchMove(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.touches[0].clientX - rect.left;
        const y = event.touches[0].clientY - rect.top;
        if (this.selectionBox.active) {
            this.selectionBox.endX = x;
            this.selectionBox.endY = y;

            this.selectionBoxEl.style.left = `${Math.min(this.selectionBox.startX, this.selectionBox.endX) + rect.left}px`;
            this.selectionBoxEl.style.top = `${Math.min(this.selectionBox.startY, this.selectionBox.endY) + rect.top}px`;
            this.selectionBoxEl.style.width = `${Math.abs(this.selectionBox.endX - this.selectionBox.startX)}px`;
            this.selectionBoxEl.style.height = `${Math.abs(this.selectionBox.endY - this.selectionBox.startY)}px`;
            this.selectionBoxEl.style.display = 'block';
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        if (this.selectionBox.active) {
            const rect = this.canvas.getBoundingClientRect();
            const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
            const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
            const minY = Math.min(this.selectionBox.startY, this.selectionBox.endY);
            const maxY = Math.max(this.selectionBox.startY, this.selectionBox.endY);
            this.selectedUnits = [];
            for (let tile of this.tiles.values()) {
                if (tile.unit && (tile.unit.faction === 'player' || tile.unit.faction.startsWith('coop'))) {
                    const size = 20;
                    const x = size * 3/2 * tile.hex.q + this.canvas.width / 2 - this.width * size * 0.75;
                    const y = size * Math.sqrt(3) * (tile.hex.r + tile.hex.q/2) + this.canvas.height / 2 - this.height * size * Math.sqrt(3) / 2;
                    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                        tile.unit.selected = true;
                        this.selectedUnits.push(tile.unit);
                    } else {
                        tile.unit.selected = false;
                    }
                }
            }
            if (this.selectedUnits.length === 1) this.showBuildMenu();
            else this.hideBuildMenu();
            this.selectionBox.active = false;
            this.selectionBoxEl.style.display = 'none';
            playSound('select');
        }
    }

    handleRightClick(event) {
        event.preventDefault();
        if (this.selectedUnits.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const hex = this.pixelToHex(x, y);
            if (hex) {
                this.selectedUnits.forEach(unit => unit.moveTo(this, hex.q, hex.r));
            }
        }
    }

    pixelToHex(x, y) {
        const size = 20;
        const q = (2/3 * (x - this.canvas.width / 2 + this.width * size * 0.75)) / size;
        const r = (-1/3 * (x - this.canvas.width / 2 + this.width * size * 0.75) + Math.sqrt(3)/3 * (y - this.canvas.height / 2 + this.height * size * Math.sqrt(3) / 2)) / size;
        return this.roundHex(q, r);
    }

    roundHex(q, r) {
        const s = -q - r;
        let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
        const qDiff = Math.abs(rq - q), rDiff = Math.abs(rr - r), sDiff = Math.abs(rs - s);
        if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
        else if (rDiff > sDiff) rr = -rq - rs;
        return new Hex(rq, rr);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const size = 20;
        for (let [key, tile] of this.tiles) {
            const [q, r] = key.split(',').map(Number);
            const x = size * 3/2 * q + this.canvas.width / 2 - this.width * size * 0.75;
            const y = size * Math.sqrt(3) * (r + q/2) + this.canvas.height / 2 - this.height * size * Math.sqrt(3) / 2;

            if (!tile.visible) {
                this.ctx.fillStyle = '#333333';
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    this.ctx[i === 0 ? 'moveTo' : 'lineTo'](x + size * Math.cos(angle), y + size * Math.sin(angle));
                }
                this.ctx.closePath();
                this.ctx.fill();
                continue;
            }

            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                this.ctx[i === 0 ? 'moveTo' : 'lineTo'](x + size * Math.cos(angle), y + size * Math.sin(angle));
            }
            this.ctx.closePath();
            this.ctx.fillStyle = tile.terrain === 'spice' ? '#ff8000' : tile.terrain === 'sand' ? '#f4a460' : tile.terrain === 'rock' ? '#808080' : '#8b4513';
            if (tile.sinkhole) this.ctx.fillStyle = '#ff0000';
            if (this.weather.type === 'sandstorm') this.ctx.globalAlpha = 0.4;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;

            if (tile.unit && tile.unit.stealth <= 0 && tile.unit.image) {
                const img = new Image();
                img.src = tile.unit.image;
                this.ctx.save();
                if (tile.unit.attackFrame > 0) {
                    this.ctx.translate(x, y);
                    this.ctx.rotate((Math.PI / 20) * Math.sin(tile.unit.attackFrame * 0.5));
                    this.ctx.translate(-x, -y);
                }
                this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
                if (tile.unit.selected) {
                    this.ctx.strokeStyle = '#00ff00';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
                }
                this.ctx.restore();
                this.ctx.fillStyle = 'white';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(`${tile.unit.hp}`, x - 5, y + 5);
            }
            if (tile.building) {
                this.ctx.fillStyle = tile.owner === 'Atreides' ? '#0000ff80' : tile.owner === 'Harkonnen' ? '#ff000080' : tile.owner === 'Fremen' ? '#00ff0080' : tile.owner === 'Spacing Guild' ? '#80008080' : tile.owner === 'player' || tile.owner.startsWith('coop') ? '#00000080' : '#55555580';
                this.ctx.fillRect(x - 10, y - 10, 20, 20);
                this.ctx.fillText(`${tile.building.hp}`, x - 5, y);
            }
            if (this.spiceFields.has(key)) {
                const { remaining } = this.spiceFields.get(key);
                this.ctx.fillStyle = 'black';
                this.ctx.fillText(`${Math.round(remaining / 30)}%`, x - 5, y - 5);
            }
        }

        if (this.gameState === 'single' || this.gameState === 'coop') {
            this.ctx.fillStyle = 'white';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`Spice: ${this.players.get('player').spice} | Solaris: ${this.players.get('player').solaris} | Will: ${this.players.get('player').will}`, 10, 20);
            this.ctx.fillText(`Version: ${GAME_VERSION} - Hash: ${VERSION_HASH}`, 10, 40);
            this.ctx.fillText(`Players: ${this.coopPlayers} | AI: ${this.aiCount}`, 10, 60);
            if (this.campaignMode) this.ctx.fillText(`Mission: ${this.mission.type} - ${this.mission.cyclesLeft} cycles`, 10, 80);
            if (this.narrative) this.ctx.fillText(this.narrativeText, 10, this.canvas.height - 20);
            if (this.selectedUnits.length > 0) {
                this.ctx.fillText(`Selected: ${this.selectedUnits.length} Units (${this.selectedUnits.map(u => u.name).join(', ')})`, 10, this.canvas.height - 40);
            }
            if (this.gameState === 'win') {
                this.ctx.fillText('Victory!', this.canvas.width / 2 - 50, this.canvas.height / 2);
                playSound('victory');
            }
        }
    }

    findNearestHarvester(fromHex) {
        return Array.from(this.tiles.values()).find(t => t.unit?.name.includes('Sovereign'))?.hex || null;
    }
}

const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth > 800 ? 800 : window.innerWidth;
canvas.height = window.innerHeight > 600 ? 600 : window.innerHeight;
let grid = new HexGrid(50, 50, canvas);

canvas.addEventListener('mousedown', (e) => grid.handleMouseDown(e));
canvas.addEventListener('mousemove', (e) => grid.handleMouseMove(e));
canvas.addEventListener('mouseup', (e) => grid.handleMouseUp(e));
canvas.addEventListener('contextmenu', (e) => grid.handleRightClick(e));
canvas.addEventListener('touchstart', (e) => grid.handleTouchStart(e));
canvas.addEventListener('touchmove', (e) => grid.handleTouchMove(e));
canvas.addEventListener('touchend', (e) => grid.handleTouchEnd(e));
setInterval(() => grid.update(), 1000);