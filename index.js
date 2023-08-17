console.log("Noble Rivers");

const sleep = t => new Promise(r => {
    setTimeout(r, t);
});

const products = {
    gold: {
        name: 'gold',
        requires: {
            food: 2,
        }
    },
    wood: {
        name: 'wood',
        requires: {
            food: 3,
        }
    }
};

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
        this.produces = {kind: 'item', item: products.gold};
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
    produce() {
        if (this.produces.kind == 'item') {
            this.item = true;
            this.token = this.produces.item.name;
        } else if (this.produces.kind == 'unit') {
            game.createUnit(this.pos, 'cpu');
        }
    }
    // gameplay doesn't have to be turn based
    // but internally turns are responsible for tile events
    // like producing resources
    turn() {
        if (this.building) {
            if (this.produces) {
                this.produce();
            }
        }
    }
}

class Unit {
    constructor(props) {
        this.v = {x: 0, y: 0};
        this.target = null;
        Object.assign(this, props);
        this.pos = props.pos? {...props.pos} : {x: 0, y: 0};
    }
    take() {
        const tile = map.get(this.pos);
        if (!tile || !tile.item) return false;
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
    move() {
        this.pos.x += this.v.x;
        this.pos.y += this.v.y;
    }
    createParams() {
        const classes = ['unit'];
        if (this.item) {
            classes.push('has-item');
        }
        if (this.player) {
            classes.push(this.player);
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
    neighbors(pos) {
        const result = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x != 0 || y != 0) {
                    const tile = this.get({x: pos.x + x, y: pos.y + y});
                    result.push(tile);
                }
            }
        }
        return result;
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
    constructor({ onUpdateUnit }) {
        this.units = [];
        this.onUpdateUnit = onUpdateUnit;
    }
    createUnit(pos, player) {
        const unit = new Unit({player, pos, classes: ['soldier']});
        updateObject(unit);
        this.units.push(unit);
        return unit;
    }
    updateAi() {
        this.units.forEach(unit => {
            updateObject(unit, this.onUpdateUnit);
        });
    }
}

const game = new Game({ onUpdateUnit });

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

const player = new Unit({pos: {x: 6, y: 3}, classes: ['soldier']});
updateObject(player);


game.createUnit({x: 9, y: 9}, 'cpu');
game.createUnit({x: 5, y: 1}, 'cpu');

const playerUnit = game.createUnit({x: 10, y: 10}, 'player');

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
    detailTypeEl.innerText = `${tile.building} - ${JSON.stringify(tile.produces)}`;
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

    playerUnit.target = pos;

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
    KeyU(obj) {
        const tile = map.get(obj.pos);
        tile.produces = {kind: 'unit'};
    },
    KeyI(obj) {
        const tile = map.get(obj.pos);
        tile.produces = {kind: 'item', item: products.wood};
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
        updateObject(player, updater);
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


function onUpdateUnit(unit) {
    if (unit.player == 'cpu') {
        return onUpdateNpc(unit);
    } else {
        if (unit.target) unit.approach(unit.target);
        unit.move();
    }
}

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