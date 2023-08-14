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
        };
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
        this.item = true;
        updateObject(tile, tile => {
            tile.item = false;
        });
        return true;
    }
    drop() {
        if (!this.item) return;
        this.item = false;
        updateObject(map.get(this.pos), tile => {
            if (tile.progress) {
                tile.progress += 10;
            } else {
                tile.item = true;
            }
        });
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
    // el.innerText = params.text;
}


const $div = () => document.createElement('div');

function updateObject(obj, f = _ => {}) {
    if (!obj.el) {
        obj.el = $div();
        obj.el.__obj = obj;

        if (obj.token) {
            const token = $div();
            token.className = 'token';
            obj.el.append(token);
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
map.get({x: 2, y: 1}).progress = 50;
map.get({x: 2, y: 1}).building = 'farm';
map.get({x: 8, y: 3}).building = 'farm';
map.get({x: 8, y: 3}).progress = 100;

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


setInterval(() => {
    updateObject(map.get({x: 2, y: 1}), tile => {
        tile.build(6);
    });
}, 300);
map.get({x: 3, y: 1}).progress = 100;
map.get({x: 3, y: 1}).building = 'woodcutter';
map.get({x: 4, y: 5}).item = true;

map.get({x: 6, y: 6}).token = true;
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

const npcs = [
    units[1]
];

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

domEl.addEventListener('click', async e => {
    const el = e.target.closest('.tile');
    const pos = el.__obj.pos;

    updateObject(map.get(pos), tile => {
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
    }
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

npcs.forEach(npc => {
    npc.v.x = 1;
});
setInterval(() => {
    npcs.forEach(npc => {
        updateObject(npc, npc => {
            switch (npc.state) {
                case 'bearing': {
                    npc.approach({x: 1, y: 1});
                    if (npc.v.x == 0 && npc.v.y == 0) {
                        npc.drop();
                        npc.state = '';
                    }

                    break;
                }
                case 'returning': {
                    npc.approach({x: 0, y: 3});
                    if (npc.v.x == 0 && npc.v.y == 0) {
                        npc.state = undefined;
                        npc.v.x = 1;
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
        });
    });
}, 800);