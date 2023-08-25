console.log("Noble Rivers");

const TILE_SIZE = 100;

const createParams = (obj) => ({
    x: obj.pos.x * TILE_SIZE,
    y: obj.pos.y * TILE_SIZE,
});

function cloneTemplate(sel) {
    const el = document.querySelector(sel).cloneNode(true);
    el.id = ''
    return el;
}

class Tile {
    constructor(pos, map) {
        this.terrain = 'grass';
        this.pos = {...pos};
        this.progress = 0;
        this.building = '';
        this._token = '';
        this._items = [];
        this.map = map;
        this.visited = 0;
        this.producingProgress = 0;
        this.construction = '';
    }
    createParams() {
        return {
            ...createParams(this),
            classes: [
                'tile',
                this.terrain,
                `${this.has()? 'has' : 'no'}-item`,
                this.building,
                this.building? 'has-building' : 'no-building',
                this.highlight? 'highlight' : '',
                this.visited >= 30? 'visited-many' : this.visited >= 20? 'visited-twice' : this.visited >= 6? 'visited' : '',
                this.construction? `construction-${this.construction}` : '',
            ],
            progress: this.progress,
            token: this.items()[0],
            producingProgress: this.producingProgress,
            produces: this.produces,
            children: [
                {key: '__token'},
                {key: '__buildingEl', classes: ['building'], template: '#house'},
                {key: '__productProgress', classes: ['product-progress']},
            ],
        };
    }
    createBuilding(buildingType) {
        this.building = buildingType;
        this.progress = 100;
        const buildingMeta = buildings[buildingType];
        this.produces = {...buildingMeta.produces, resources: {}};
        this.construction = '';
    }
    destroyBuilding() {
        this.building = '';
        this.progress = 0;
        this.highlight = false;
    }
    build(amount) {
        this.progress += amount;
        if (this.progress > 100) {
            this.progress = 100;
        }
    }
    produce() {
        if (this.has(this.produces.item.name)) return;
        if (this.produces) {
            const { produces } = this;
            const { item } = produces;
            let ok = true;
            let nearCondition = this.produces.near? false : true;
            this.map.neighbors(this.pos).forEach((n) => {
                nearCondition ||= produces.near == n.terrain;
                Object.keys(item.requires).forEach(token => {
                    if (n.has(token) && item.requires[token] > (produces.resources[token] || 0)) {
                        const gatheredBefore = produces.resources[token] || 0;
                        produces.resources[token] = gatheredBefore + 1;
                        updateObject(n, n => n.take(token));
                    }
                });
            });

            for (const k in item.requires) {
                if ((this.produces.resources[k] || 0) < item.requires[k]) {
                    ok = false;
                    break;
                }
            }
            ok = ok && nearCondition;
            this.highlight = !nearCondition;

            if (ok) {
                if (this.produces.kind == 'item') {
                    this.drop(this.produces.item.name);
                } else if (this.produces.kind == 'unit') {
                    game.createUnit(this.pos, 'cpu', this.produces.item.name);
                }
                this.produces.resources = {};
                this.producingProgress = 100;
            } else {
                let s = this.building + ": conditions are not met. ";
                if (!nearCondition) {
                    s = `${this.building} should be near ` + this.produces.near;
                    gui.message(s);
                } else {
                    const delta = computeObjectsDelta(this.produces.item.requires, this.produces.resources);
                    const totalItemCount = computeObjectsDelta(this.produces.item.requires, {}).length;
                    this.producingProgress = ~~(100 - (delta.length / totalItemCount) * 100);
                    game.tasks.push(...delta.map(item => ({volatile: true, item, type: 'gather', target: {x: this.pos.x - 1, y: this.pos.y}})));
                }
            }
        }
    }
    drop(item) {
        this._items.push(item);
    }
    take(token) {
        if (token) {
            if (!this.has(token)) throw new Error('take: no ' + token);
            const idx = this._items.findIndex(item => item == token);
            this._items.splice(idx, 1);
            return token;
        }
        return this._items.pop();
    }
    has(token) {
        if (!token) return this.items().length;
        return this.items().includes(token);
    }
    items() {
        return this._items;
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
        this.visited = Math.max(0, this.visited - 1);
    }
}

class Unit {
    constructor(props) {
        this.v = {x: 0, y: 0};
        this.target = null;
        Object.assign(this, props);
        this.pos = props.pos? {...props.pos} : {x: 0, y: 0};
    }
    take(token) {
        const tile = map.get(this.pos);
        if (!tile || !tile.has()) return false;
        updateObject(tile, tile => {
            this.item = tile.take(token);
        });
        return true;
    }
    drop() {
        if (!this.item) return;
        updateObject(map.get(this.pos), tile => {
            tile.drop(this.item);
        });
        this.item = false;
    }
    approach(target) {
        const npc = this;
        if (!npc.path) {
            console.log("new path to", target);
            npc.path = [];
        }
        const deltaX = target.x - npc.pos.x;
        const deltaY = target.y - npc.pos.y;
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
        npc.v = {
            x: horizontal? Math.sign(deltaX) : 0,
            y: horizontal? 0 : Math.sign(deltaY),
        };
        npc.move();
        const done = npc.pos.x == target.x && npc.pos.y == target.y;
        if (done) {
            npc.path = null;
        }
        return done;
    }
    move(newPos) {
        if (newPos) {
            this.pos.x = newPos.x;
            this.pos.y = newPos.y;
        } else {
            this.pos.x += this.v.x;
            this.pos.y += this.v.y;
        }
        updateObject(map.get(this.pos), tile => {
            tile.visited += 10;
        });

    }
    createParams() {
        return {
            ...createParams(this),
            classes: ['unit', this.player, `${this.item? 'has' : 'no'}-item`, this.kind, 'has-' + this.item],
            template: '#unit',
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
        el.__token.className = params.token? `token ${params.token}` : 'token';
    }
    if (el.__productProgress) {
        const producingProgress = params.producingProgress;
        const color = 'rgb(255 255 255 / 0.4)';
        el.__productProgress.style.background = `linear-gradient(to right, ${color} 0%, ${color}  ${producingProgress}%, black ${producingProgress}%, black 100%)`;
        el.__productProgress.style.display = producingProgress == 100 || producingProgress == 0? 'none': 'block';
        if (params.produces) {
            el.__productProgress.innerText = params.produces.item.name;
        }
    }

    // el.innerText = params.text;
}

class Game {
    constructor({ onUpdateUnit }) {
        this.units = [];
        this.tasks = [];
        this.onUpdateUnit = onUpdateUnit;
    }
    createUnit(pos, player, kind) {
        const unit = new Unit({kind, player, pos});
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
        obj.el = params.template? cloneTemplate(params.template) : $('div');
        obj.el.__obj = obj;

        if (params.children) {
            params.children.forEach(child => {
                const childEl = child.template? cloneTemplate(child.template) : $('div');
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
map.get({x: 5, y: 5}).terrain = 'mountain';
map.get({x: 5, y: 6}).terrain = 'mountain';
map.get({x: 1, y: 1}).progress = 10;
map.get({x: 8, y: 3}).createBuilding('farm');
map.get({x: 6, y: 6}).createBuilding('woodcutter');




console.log(map)

const domEl = document.getElementById('app');

for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        updateObject(map.get({x, y}));
    }
}

const player = new Unit({pos: {x: 6, y: 3}, classes: ['soldier']});
updateObject(player);


game.createUnit({x: 9, y: 9}, 'cpu', 'peasant');
game.createUnit({x: 5, y: 1}, 'cpu', 'peasant');
game.createUnit({x: 6, y: 1}, 'cpu', 'peasant');
game.createUnit({x: 7, y: 1}, 'cpu', 'peasant');



setTimeout(() => {
    updateObject(map.get({x: 4, y: 6}), tile =>{
        tile.terrain = 'water';
    });
}, 1000);



const detailEl = document.querySelector('.gui-detail');
const detailTypeEl = detailEl.querySelector('.type');

function inspect(tile) {
    const units = game.units
        .filter(unit => unit.pos.x == tile.pos.x && unit.pos.y == tile.pos.y);
    const unitsHtml = units.map(unit => `<div>${unit.kind} - ${unit.state}</div>`);
    const html = `${tile.building} - ${JSON.stringify(tile.produces)} items: ${tile.items()} <br> ${unitsHtml}`;
    detailTypeEl.innerHTML = html;
    console.log('units: ', units);

}

domEl.addEventListener('click', async e => {
    const el = e.target.closest('.tile');
    
    if (!el) {
        const unitEl = e.target.closest('.unit');
        if (unitEl) {
            const unit = unitEl.__obj;
            console.log("unit", unit);
        }
        return;
    }
    const pos = el.__obj.pos;
    const tile = map.get(pos);
    if (!tile) return;

    if (gui.mode == 'inspect') {
        inspect(tile);
        return;
    }

    if (gui.mode == 'destroy') {
        updateObject(tile, tile => {
            tile.destroyBuilding();
        });
        return;
    }


    updateObject(tile, tile => {
        const buildingKind = gui.mode;
        tile.construction = buildingKind;
        game.tasks.push({type: 'build', tile, building: buildingKind})
    });

    // map.neighbors(pos).forEach(tile => {
    //     updateObject(tile, tile => tile.terrain = 'forest');
    // })

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
    game.tasks = game.tasks.filter(task => !task.volatile);
    gui.clearMessages();
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            updateObject(map.get({x, y}), tile => {
                tile.turn();
            });
        }
    }
}, 6000);


function onUpdateUnit(unit) {
    if (unit.kind == 'soldier') {
        onUpdateSoldier(unit);
    } else if (unit.player == 'cpu') {
        // return onUpdateShip(unit);
        return onUpdateNpc(unit);
    }
}

function moveWithBouncing(unit) {
    const newX = unit.pos.x + unit.v.x;
    const newY = unit.pos.y + unit.v.y;
    let ok = true;
    if (newX >= map.width || newX < 0) {
        ok = false;
        unit.v.x *= -1;
    }
    if (ok) {
        unit.move({x: newX, y: newY});
    }
}

function onUpdateSoldier(npc) {
    console.log("update soldier", npc.state);
    switch (npc.state) {
        case 'move':
            moveWithBouncing(npc);
            break;
        default:
            npc.state = 'move';
            npc.v.x = 1;
            npc.v.y = 0;
    }
}

function onUpdateNpc(npc) {
    switch (npc.state) {
        case 'bearing': {
            if (npc.approach(npc.task.target)) {
                npc.drop();
                npc.state = '';
            }
            break;
        }
        case 'building': {
            if (npc.approach(npc.target)) {
                updateObject(map.get(npc.pos), tile => {
                    tile.createBuilding(npc.task.building);
                });
                npc.state = '';
                npc.task = null;
            }
            break;
        }
        case 'gather': {
            let target = map.locate(npc.pos, 10, tile => {
                return tile.has(npc.task.item) /*&& !map.neighbors(tile.pos).find(n => n.building)*/;
            });
            if (target) {
                if(npc.approach(target.pos)) {
                    if (npc.take(npc.task.item)) {
                        npc.state = 'bearing'
                    }
                }
            } else {
                npc.state = '';
                // target =  map.locate(npc.pos, 10, tile => tile.terrain == 'forest');
                // if (target) {
                //     npc.target = {x: target.pos.x, y: target.pos.y + 1};
                //     npc.buildTarget = target;
                //     npc.state = 'building';
                // } 
                
            }
            break;
        }
        default: {
            const task = game.tasks.shift();
            switch (task?.type) {
                case 'gather': {
                    npc.task = task;
                    npc.state = 'gather';
                    break;
                }
                case 'build':
                    npc.task = task;
                    npc.state = 'building';
                    npc.target = task.tile.pos;
                    break;
                default:
                    npc.v.x = 0;
                    npc.v.y = 0;
            }
        }

    }
    // const newX = npc.pos.x + npc.v.x;
    // const newY = npc.pos.y + npc.v.y;
    // let ok = true;
    // if (newX >= map.width || newX < 0) {
    //     ok = false;
    //     npc.v.x *= -1;
    // }
    // if (ok) {
    //     npc.pos.x = newX;
    //     npc.pos.y = newY;
    // }
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
    if (gui.mode != 'pause')
        game.updateAi();
}, 800);

const menuEl = document.querySelector('.gui-menu');

const gui = createGui({ buildings });
