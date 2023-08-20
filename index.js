console.log("Noble Rivers");

const sleep = t => new Promise(r => {
    setTimeout(r, t);
});

const TILE_SIZE = 100;
class Tile {
    constructor(pos, map) {
        this.terrain = 'grass';
        this.pos = {...pos};
        this.item = false;
        this.progress = 0;
        this.building = '';
        this.token = '';
        this.map = map;
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
            children: [
                {key: '__token'},
                {key: '__buildingEl', classes: ['building'], create: () => {
                    const el = document.getElementById('house').cloneNode(true)
                    el.id = ''
                    return el;
                }},
            ],
        };
    }
    createBuilding(buildingType) {
        this.building = buildingType;
        this.progress = 100;
        const buildingMeta = buildings[buildingType];
        this.produces = {...buildingMeta.produces, resources: {}};
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
            const item = this.produces.item;
            let ok = true;
            let nearCondition = this.produces.near? false : true;
            this.map.neighbors(this.pos).forEach((n, i) => {
                nearCondition ||= this.produces.near == n.terrain;
                if (n.item && Object.hasOwn(item.requires, n.token) && item.requires[n.token] > (this.produces.resources[n.token] || 0)) {
                    updateObject(n, n => {
                        n.item = false;
                        const gatheredBefore = this.produces.resources[n.token] || 0;
                        this.produces.resources[n.token] = gatheredBefore + 1;
                        n.token = '';
                    });
                }
            });
            for (const k in item.requires) {
                if ((this.produces.resources[k] || 0) < item.requires[k]) {
                    ok = false;
                    break;
                }
            }
            ok = ok && nearCondition;
            console.log(this.building, ok, nearCondition)
            if (ok) {
                this.item = true;
                this.token = this.produces.item.name;
                this.produces.resources = {};
            }
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
            create: () => {
                const el = document.getElementById('unit').cloneNode(true)
                el.id = ''
                return el;
            },
            x: this.pos.x * TILE_SIZE,
            y: this.pos.y * TILE_SIZE,
        };
    }
}


class TileMap {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.data = [...Array(w * h)].map((_, i) => new Tile({x: i % w, y: ~~(i / w)}, this));
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
                    if (tile) result.push(tile);
                }
            }
        }
        return result;
    }
}

function updateEl(el, params) {
    el.className = params.classes.join(' ');
    el.style.transform = `translate(${params.x}px, ${params.y}px)`;
    el.style.transformOrigin = `${params.x}px ${params.y}px`;
    if (el.__buildingEl) {
        el.__buildingEl.style.display = params.progress? 'block' : 'none';
        // el.__buildingEl.style.height = `${~~((params.progress? 1 : 0) * 100)}%`;
    }
    if (el.__token) {
        el.__token.className = params.token? `token ${params.token}` : '';
    }

    // el.innerText = params.text;
}

const $ = (tag) => document.createElement(tag);

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
        const params = obj.createParams();
        obj.el = params.create? params.create() : $('div');
        obj.el.__obj = obj;

        if (params.children) {
            params.children.forEach(child => {
                const childEl = child.create? child.create() : $('div');
                childEl.position = 'absolute';
                if (child.classes) childEl.className = child.classes.join(' ');
                obj.el.append(childEl);
                obj.el[child.key] = childEl;
            })
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
map.get({x: 8, y: 3}).createBuilding('farm');
map.get({x: 6, y: 6}).createBuilding('woodcutter');





map.get({x: 4, y: 5}).item = true;

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

    if (mode == 'inspect') {
        inspect(tile);
        return;
    }

    updateObject(tile, tile => {
        tile.createBuilding(mode);
    });
    playerUnit.target = pos;

    // map.neighbors(pos).forEach(tile => {
    //     updateObject(tile, tile => tile.terrain = 'forest');
    // })

    // const targetTile = map.locate(pos, 4, tile => tile.item);
    // if (targetTile) {
    //     updateObject(targetTile, tile => {
    //         tile.terrain = 'forest';
    //     })
    // }
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
    KeyW(obj) {
        const tile = map.get(obj.pos);
        tile.produces = {kind: 'item', item: products.wood, resources: {}};
    },
    KeyF(obj) {
        const tile = map.get(obj.pos);
        updateObject(tile, tile => tile.terrain = 'forest');
        // tile.produces = {kind: 'item', item: products.food, resources: {}};
    },
    KeyW(obj) {
        const tile = map.get(obj.pos);
        updateObject(tile, tile => tile.terrain = 'water');
        // tile.produces = {kind: 'item', item: products.food, resources: {}};
    },
};

document.addEventListener('keydown', e => {
    if (Object.hasOwn(keyMap, e.code)) {
        e.preventDefault();
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
        return onUpdateShip(unit);
        // return onUpdateNpc(unit);
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

function onUpdateShip(unit) {
    const candidates = map.neighbors(unit.pos).filter(n => n.terrain == 'water');
    if (candidates.length) {
        const next = candidates[~~(Math.random() * candidates.length)];
        unit.pos.x = next.pos.x;
        unit.pos.y = next.pos.y;
    }

}

setInterval(() => {
    game.updateAi();
}, 800);

const menuEl = document.querySelector('.gui-menu');
let mode = 'inspect';

Object.entries(buildings).concat([['inspect']]).forEach(([key, building]) => {
    const el = $('button');
    el.innerText = key;
    el.className = mode == key? 'active' : '';
    el.addEventListener('click', () => {
        mode = key;
        menuEl.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        el.classList.add('active');
    });
    menuEl.append(el);
});