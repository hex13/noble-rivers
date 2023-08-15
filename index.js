console.log("Noble Rivers");

const sleep = t => new Promise(r => {
    setTimeout(r, t);
});

const TILE_SIZE = 64;
class Tile {
    constructor(pos) {
        this.terrain = 'grass';
        this.pos = {...pos};
        this.item = false;
        this.progress = 0;
        this.building = '';
        this.token = '';
    }
    createParams() {
        const classes = ['tile'];
        classes.push(this.terrain);
        if (this.item) {
            classes.push('has-item');
        }
        if (this.building) {
            classes.push(this.building);
        }
        return {
            classes,
            x: this.pos.x * TILE_SIZE,
            y: this.pos.y * TILE_SIZE,
            text: `${this.pos.x}, ${this.pos.y}`,
            progress: this.progress,
            token: this.token,
        };
    }
    createBuilding(buildingType) {
        this.building = buildingType;
        this.progress = 100;
    }
    destroyBuilding() {
        this.building = '';
        this.progress = 0;
    }
    build(amount) {
        this.progress += amount;
        if (this.progress > 100) {
            this.progress = 100;
        }
    }
    // gameplay doesn't have to be turn based
    // but internally turns are responsible for tile events
    // like producing resources
    turn() {
        if (this.building) {
            this.item = true;
            this.token = Math.random() < 0.5? 'gold' : 'wood';
        }
    }
}

class Unit {
    constructor(props) {
        this.v = {x: 0, y: 0};
        Object.assign(this, props);
    }
    take() {
        const tile = map.get(this.pos);
        if (!tile.item) return false;
        this.item = tile.token;
        updateObject(tile, tile => {
            tile.item = false;
            tile.token = '';
        });
        return true;
    }
    drop() {
        if (!this.item) return;
        updateObject(map.get(this.pos), tile => {
            if (tile.progress) {
                tile.progress += 10;
            } else {
                tile.item = true;
                tile.token = this.item;
            }
        });
        this.item = false;
    }
    approach(target) {
        const npc = this;
        const deltaX = target.x - npc.pos.x;
        const deltaY = target.y - npc.pos.y;
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
        npc.v = {
            x: horizontal? Math.sign(deltaX) : 0,
            y: horizontal? 0 : Math.sign(deltaY),
        };
    }
    createParams() {
        const classes = ['unit'];
        if (this.item) {
            classes.push('has-item');
        }
        return {
            classes,
            x: this.pos.x * TILE_SIZE,
            y: this.pos.y * TILE_SIZE,
        };
    }
}


class TileMap {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.data = [...Array(w * h)].map((_, i) => new Tile({x: i % w, y: ~~(i / w)}));
    }
    getIndex(pos) {
        return pos.y * this.width + pos.x;
    }
    get(pos) {
        return this.data[this.getIndex(pos)];
    }
    locate(center, maxRadius, check) {
        for (const pt of radiate(center, maxRadius)) {
            const tile = this.get(pt);
            if (tile && check(tile)) return tile;
        }
    }
}

function updateEl(el, params) {
    el.className = params.classes.join(' ');
    el.style.transform = `translate(${params.x}px, ${params.y}px)`;
    if (el.__buildingEl) {
        el.__buildingEl.style.height = `${~~((params.progress / 100) * 50)}px`;
    }
    if (el.__token) {
        el.__token.className = params.token? `token ${params.token}` : '';
    }

    // el.innerText = params.text;
}

const $div = () => document.createElement('div');

class Game {
    constructor({ onUpdateNpc }) {
        this.npcs = [];
        this.onUpdateNpc = onUpdateNpc;
    }
    createNpc(pos) {
        const unit = new Unit({pos, classes: ['soldier']});
        updateObject(unit);
        this.npcs.push(unit);
    }
    updateAi() {
        this.npcs.forEach(npc => {
            updateObject(npc, this.onUpdateNpc);
        });
    }
}

const game = new Game({ onUpdateNpc });

function updateObject(obj, f = _ => {}) {
    if (!obj.el) {
        obj.el = $div();
        obj.el.__obj = obj;

        if (Object.hasOwn(obj, 'token')) {
            const token = $div();
            obj.el.append(token);
            obj.el.__token = token;
        }

        if (Object.hasOwn(obj, 'progress')) {
            const el = $div();
            el.className = 'building';
            obj.el.appendChild(el);
            obj.el.__buildingEl = el;
        }        

        domEl.append(obj.el);
    }
    f(obj);
    updateEl(obj.el, obj.createParams());
}



const map = new TileMap(20, 20);

map.get({x: 3, y: 3}).terrain = 'forest';
map.get({x: 4, y: 3}).terrain = 'water';
map.get({x: 4, y: 4}).terrain = 'water';
map.get({x: 4, y: 5}).terrain = 'water';
map.get({x: 1, y: 1}).progress = 10;
map.get({x: 8, y: 3}).building = 'farm';
map.get({x: 8, y: 3}).progress = 100;


map.get({x: 6, y: 6}).building = 'woodcutter';
map.get({x: 6, y: 6}).progress = 100;

function* border(center, radius) {
    let x = center.x - radius;
    let y = center.y - radius;
    let dx = 1;
    let dy = 0;
    const max = (radius * 2 + 1) * 4 - 4;
    for (let i = 0; i < max; i++) {
        yield {x, y};
        if (i > 0 && i % (max / 4) == 0) {
            const tmp = dx;
            dx = -dy;
            dy = tmp;
        }
        x += dx;
        y += dy;
    }
}


map.get({x: 4, y: 5}).item = true;

map.get({x: 6, y: 6}).token = 'wood';
map.get({x: 6, y: 7}).token = 'gold';
console.log(map)

const domEl = document.getElementById('app');

for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        updateObject(map.get({x, y}));
    }
}

const units = [];
for (let i = 0; i < 2; i++) {
    const unit = new Unit({pos: {x: i + 2, y: 3}, classes: ['soldier']});
    updateObject(unit);
    units.push(unit);
}


game.createNpc({x: 9, y: 9});
game.createNpc({x: 5, y: 1});

setTimeout(() => {
    updateObject(map.get({x: 4, y: 6}), tile =>{
        tile.terrain = 'water';
    });
}, 1000);

function *radiate(center, maxRadius) {
    for (let r = 1; r < maxRadius; r++) {
        for (const pt of border(center, r)) {
            yield pt;
        }
    }
}

const detailEl = document.querySelector('.gui-detail');
const detailTypeEl = detailEl.querySelector('.type');

function inspect(tile) {
    detailTypeEl.innerText = tile.building;
}

domEl.addEventListener('click', async e => {
    const el = e.target.closest('.tile');
    if (!el) return;
    const pos = el.__obj.pos;
    const tile = map.get(pos);
    if (!tile) return;
    inspect(tile);
    updateObject(tile, tile => {
        tile.terrain = 'water';
    });

    const targetTile = map.locate(pos, 4, tile => tile.item);
    if (targetTile) {
        updateObject(targetTile, tile => {
            tile.terrain = 'forest';
        })
    }
});

const keyMap = {
    ArrowLeft: {x: -1, y: 0},
    ArrowRight: {x: 1, y: 0},
    ArrowUp: {x: 0, y: -1},
    ArrowDown: {x: 0, y: 1},
    KeyT(obj) {
        obj.take();
    },
    KeyD(obj) {
        obj.drop();
    },
    KeyB(obj) {
        const tile = map.get(obj.pos);
        if (tile) {
            updateObject(tile, tile => {
                tile.createBuilding('farm');
            });
        }
    },
    KeyA(obj) {
        const tile = map.get(obj.pos);
        if (tile) {
            updateObject(tile, tile => {
                tile.destroyBuilding();
            });
        }
    },
};

document.addEventListener('keydown', e => {
    if (Object.hasOwn(keyMap, e.code)) {
        let updater = keyMap[e.code];
        if (typeof updater != 'function') {
            const d = updater;
            updater = obj => {
                obj.pos.x += d.x;
                obj.pos.y += d.y;
            };
        }
        updateObject(units[0], updater);
    }
});

setInterval(() => {
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            updateObject(map.get({x, y}), tile => {
                tile.turn();
            });
        }
    }
}, 6000);


function onUpdateNpc(npc) {
    switch (npc.state) {
        case 'bearing': {
            npc.approach({x: 1, y: 1});
            if (npc.v.x == 0 && npc.v.y == 0) {
                npc.drop();
                npc.state = '';
            }

            break;
        }
        default: {
            const target = map.locate(npc.pos, 10, tile => tile.item);
            if (target) {
                npc.approach(target.pos);
            }
            if (npc.take()) {
                npc.state = 'bearing'
            }

        }
    }
    const newX = npc.pos.x + npc.v.x;
    const newY = npc.pos.y + npc.v.y;
    let ok = true;
    if (newX >= map.width || newX < 0) {
        ok = false;
        npc.v.x *= -1;
    }
    if (ok) {
        npc.pos.x = newX;
        npc.pos.y = newY;
    }
}

setInterval(() => {
    game.updateAi();
}, 800);