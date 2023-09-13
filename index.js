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
        this.player = pos.x < 10 && pos.y < 10? 'player' : pos.x > 15? 'cpu' : 'none';
    }
    setPlayer(player) {
        updateObject(this.map.stats, stats => {
            stats.owners[this.player] -= 1;
            stats.owners[player] += 1;
        });
        this.player = player;
    }
    createParams() {
        return {
            ...createParams(this),
            classes: [
                'tile',
                'owner-' + this.player,
                this.terrain,
                `${this.has()? 'has' : 'no'}-item`,
                this.building,
                this.building? 'has-building' : 'no-building',
                this.highlight? 'highlight' : '',
                this.visited >= 30? 'visited-many' : this.visited >= 20? 'visited-twice' : this.visited >= 6? 'visited' : '',
                this.construction? `construction-${this.construction}` : '',
            ],
            elevation: this.elevation,
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
    createBuilding(buildingType, player) {
        if (player != this.player) {
            gui.message(`${player} can't build on land owned by ${this.player}`);
            return;
        }
        this.building = buildingType;
        this.progress = 100;
        const buildingMeta = buildings[buildingType];
        if (buildingMeta.produces) this.produces = {...buildingMeta.produces, resources: {}};
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
                    if (this.produces.item.name.startsWith('global-')) {
                        const name = this.produces.item.name.split('global-')[1];
                        updateObject(globals[this.player].treasury, treasury => {
                            treasury[name] += 1;
                        });
                    } else {
                        this.drop(this.produces.item.name);
                    }
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
        } else {
            this.highlight = false;
        }
        this.visited = Math.max(0, this.visited - 1);
    }
}
let id = 0;
class Unit {
    constructor(props) {
        this.v = {x: 0, y: 0};
        this.target = null;
        Object.assign(this, props);
        this.pos = props.pos? {...props.pos} : {x: 0, y: 0};
        this.id = ++id;
    }
    take(token) {
        const tile = map.get(this.pos);
        if (!tile || !tile.has(token)) return false;
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
    computeDirection(pos, target) {
        const deltaX = target.x - pos.x;
        const deltaY = target.y - pos.y;
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
        return {
            x: horizontal? Math.sign(deltaX) : 0,
            y: horizontal? 0 : Math.sign(deltaY),
        };
    }
    computeDirection2(pos, target) {
        const currDist = Math.hypot(target.x - pos.x, target.y - pos.y);
        let max = currDist;
        let dir = {x: 0, y: 0};
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if ((dx == 0 && dy == 0) || (dx != 0 && dy != 0)) continue;
                const dist = Math.hypot(target.x - (pos.x + dx), target.y - (pos.y + dy));
                if (dist < max) {
                    max = dist;
                    dir = {x: dx, y: dy};
                }
            }
        }
        return dir;
    }
    findPath(target) {
        const path = [];
        let queue = [{
            pos: {
                x: this.pos.x,
                y: this.pos.y,
            },
        }];
        const visited = Object.create(null);

        let c = 0;
        while (queue.length) {
            c++;
            const node = queue.shift();
            if (node.pos.x == target.x && node.pos.y == target.y) {
                let curr = node;
                const path = [node];
                while (curr.prev) {
                    path.push(curr.prev);
                    curr = curr.prev;
                }
                path.reverse();
                console.log(`found from ${this.pos.x},${this.pos.y} to ${target.x}, ${target.y}`, path);
                return path.slice(1);
            }
            const neighbors = map.neighbors(node.pos, false);
            neighbors.forEach(n => {
                if (n.terrain != 'grass') return;
                const key = n.pos.x + ',' + n.pos.y;
                if (!visited[key]) {
                    visited[key] = true;
                    const v = {x: n.pos.x - node.pos.x, y: n.pos.y - node.pos.y};
                    queue.push({pos: n.pos, v, prev: node});

                }
            });
        }
        console.error("not found", c);
        return;
    }
    reset() {
        this.drop();
        this.state = '';
        this.task = null;
        this.path = null;
    }
    approach(target) {
        const npc = this;
        if (!npc.path || !npc.path.length) {
            npc.path = this.findPath(target);
            if (!npc.path) {
                gui.message(`path not found`);
                const tile = map.get(target);
                if (tile) {
                    updateObject(tile, tile => {
                        tile.highlight = true;
                    });
                }
                npc.reset();
                throw new Error('path not found')
                return;
            }
        }
        if (npc.path && npc.path.length) {
            npc.v = npc.path.shift().v;
        } else {
            npc.path = null;
            if (npc.pos.x != target.x || npc.pos.y != target.y) {
                this.state = '';
                return false;
            }

            // npc.v = this.computeDirection(npc.pos, target);
            // npc.v = this.computeDirection2(npc.pos, target);
        }
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
    randomPoint() {
        return {x: ~~(Math.random() * this.width), y: ~~(Math.random() * this.height)};
    }
    constructor(w, h) {
        this.width = w;
        this.height = h;
        const maxima = [{x: ~~(this.width / 2), y: ~~(this.height / 2), elevation: 50}];
        for (let i = 0; i < 3; i++) {
            maxima.push({...this.randomPoint(), elevation: 50});
        }

        const data = this.data = [...Array(w * h)].map((_, i) => {
            const pos = {x: i % w, y: ~~(i / w)};
            const tile = new Tile(pos, this);
            let z = 0;
            tile.elevation = 0;
            maxima.forEach(({elevation, x, y}) => {
                let distSq = (pos.x - x) ** 2 + (pos.y - y) **2;
                z += Math.max(0, elevation - distSq);
            });
            tile.elevation = z / maxima.length;

            return tile;
        });
        this.stats = {
            owners: {
                player: 0,
                cpu: 0,
                none: 0,
            },
            createParams() {
                const text = 'owners - ' + Object.entries(this.owners)
                    .map(([owner, amount]) => `${owner}: ${~~(amount / data.length * 100)}%`)
                    // .map(([owner, amount]) => `${owner}: ${amount}`)
                    .join(' ');
                return {
                    classes: ['gui-owners'],
                    text,
                }
            }
        }
        this.data.forEach(tile => {
            this.stats.owners[tile.player] += 1;
        });
    }
    getIndex(pos) {
        return pos.y * this.width + pos.x;
    }
    get(pos) {
        if (pos.x < 0 || pos.y < 0 || pos.x >= this.width || pos.y >= this.height) {
            return null;
        }
        return this.data[this.getIndex(pos)];
    }
    locate(center, maxRadius, check) {
        for (const pt of radiate(center, maxRadius)) {
            const tile = this.get(pt);
            if (tile && check(tile)) return tile;
        }
    }
    neighbors(pos, shouldIncludeDiagonal=true, shouldAddSelf) {
        const result = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (!shouldIncludeDiagonal && (x != 0 && y != 0)) continue;
                if (shouldAddSelf || (x != 0 || y != 0)) {
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
    const z = params.elevation;
    // el.style.background = `rgb(255 ${z > 10? (z - 10) * 20 : 0} 0 / ${z * 0.04})`;
    if (typeof params.text == 'string') el.innerText = params.text;
}

class Game {
    constructor({ onUpdateUnit }) {
        this.units = [];
        this.tasks = [];
        this.onUpdateUnit = onUpdateUnit;
    }
    createUnit(pos, player, kind) {
        const unit = new Unit({kind, player, pos});
        unit.loop = cpuLoop(unit);
        updateObject(unit);
        this.units.push(unit);
        return unit;
    }
    nextTask() {
        const idx = ~~(Math.random() * this.tasks.length);
        return this.tasks.splice(idx, 1)[0];
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
map.get({x: 4, y: 3}).terrain = 'forest';
map.get({x: 5, y: 3}).terrain = 'forest';
map.get({x: 6, y: 3}).terrain = 'forest';
map.get({x: 6, y: 4}).terrain = 'forest';
map.get({x: 5, y: 5}).terrain = 'mountain';
map.get({x: 5, y: 6}).terrain = 'mountain';
map.get({x: 1, y: 1}).progress = 10;
map.get({x: 8, y: 3}).createBuilding('farm', 'player');
map.get({x: 6, y: 6}).createBuilding('woodcutter', 'player');
map.get({x: 5, y: 4}).createBuilding('mine', 'player');




console.log(map)

const domEl = document.getElementById('app');

for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        updateObject(map.get({x, y}));
    }
}

const player = new Unit({pos: {x: 6, y: 3}, classes: ['soldier']});
updateObject(player);

updateObject(map.stats);



game.createUnit({x: 9, y: 9}, 'player', 'peasant');
game.createUnit({x: 5, y: 1}, 'player', 'peasant');
// game.createUnit({x: 6, y: 1}, 'cpu', 'peasant');
// game.createUnit({x: 7, y: 1}, 'cpu', 'peasant');



const createGlobals = () => ({
    treasury: {
        gold: 3,
        createParams() {
            return {
                classes: ['gui-treasury'],
                text: `treasury: ${this.gold} gold`,
            }
        }
    },
});

const globals = {
    player: createGlobals(),
    cpu: createGlobals(),
};
updateObject(globals.player.treasury);


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

    if (gui.mode == 'buy land') {
        if (tile.player == 'cpu') {
            alert(`Couldn't buy. This land is owned by ${tile.player}`);
            return;
        }
        if (globals.player.treasury.gold < 1) {
            alert(`Couldn't buy. You have no gold.`);
            return;
        }
        updateObject(globals.player.treasury, treasury => {
            treasury.gold -= 1;
        });
        updateObject(tile, tile => {
            tile.setPlayer('player');
        });
        return;
    }

    if (tile.player == 'player') {
        updateObject(tile, tile => {
            const buildingKind = gui.mode;
            tile.construction = buildingKind;
            game.tasks.push({type: 'build', tile, building: buildingKind})
        });
    } else {
        alert(`You can only build on your land. And this land belongs to ${tile.player}.`);
    }

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
                tile.createBuilding('farm', 'player');
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
}, 2000);


function onUpdateUnit(unit) {
    try {
        if (unit.kind == 'soldier') {
            onUpdateSoldier(unit);
        } else {
            // return onUpdateShip(unit);
            return unit.loop.next();
            // return onUpdateNpc(unit);
        }
    } catch (e) {
        console.error(e)
        unit.reset();
        setTimeout(() => {
            onUpdateUnit(unit);
        }, 100);
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


function onUpdateShip(unit) {
    const candidates = map.neighbors(unit.pos).filter(n => n.terrain == 'water');
    if (candidates.length) {
        const next = candidates[~~(Math.random() * candidates.length)];
        unit.pos.x = next.pos.x;
        unit.pos.y = next.pos.y;
    }

}

function* moveLoop(unit, target) {
    const path = unit.findPath(target);
    if (path) {
        for (const part of path) {
            unit.v = part.v;
            unit.move();
            unit.v.x = 0;
            unit.v.y = 0;
            yield;
        }
        return true;
    }
    gui.message(`path not found`);
    return false;
}

function* cpuLoop(unit) {
    let c = 0;
    while (true) {
        const task = game.nextTask();
        switch (task?.type) {
            case 'gather': {
                const sourceTile = map.locate(unit.pos, 10, tile => {
                    return tile.has(task.item) /*&& !map.neighbors(tile.pos).find(n => n.building)*/;
                });
                if (sourceTile) {
                    if (yield* moveLoop(unit, sourceTile.pos)) {
                        unit.take(task.item);
                        yield* moveLoop(unit, task.target);
                        unit.drop();
                    }
                }
                break;
            }
            case 'build': {
                if (yield* moveLoop(unit, task.tile.pos)) {
                    updateObject(map.get(unit.pos), tile => {
                        tile.createBuilding(task.building, unit.player);
                    });
                }
                break;
            }
            default:
                unit.v.x = 0;
                unit.v.y = 0;
        }
        unit.pos.x += unit.v.x;
        unit.pos.y += unit.v.y;

        yield;
    }
}
setInterval(() => {
    if (gui.mode != 'pause')
        game.updateAi();
}, 800);

const menuEl = document.querySelector('.gui-menu');

const gui = createGui({ buildings });

function createRiver(source) {
    let curr = map.get(source); 
    const visited = {};
    for (let i = 0; i < 10000 && curr; i++) {
        visited[curr.pos.x + ',' + curr.pos.y] = true;
        curr.terrain = 'water';
        let maxDiff = -1;
        let candidate = null;
        map.neighbors(curr.pos, false).forEach((n, i, arr) => {
            const diff = curr.elevation - n.elevation;
            if (diff > maxDiff && !visited[n.pos.x + ',' + n.pos.y]) {
                maxDiff = diff;
                candidate = n;
            }
        });
        curr = candidate;
    }

}
{
    let max = -Infinity;
    let maxPos;
    const highlands = [];
    map.data.forEach(tile => {
        if (tile.elevation > max) {
            max = tile.elevation;
            maxPos = tile.pos;
        }
    });

    map.data.forEach(tile => {
        if (
            (tile.elevation > 8 && (Math.random() < 0.1))
            || (tile.elevation > (maxPos - 8) && (Math.random() < 0.5))
        ) {
            updateObject(tile, tile => {
                tile.terrain = 'mountain';
            });
        }
        if (tile.elevation > max - 10) {
            highlands.push(tile.pos);
        }

    });

    createRiver(maxPos)
    for (let i = 0; i < 2; i++) {
        const pos = highlands[~~(Math.random() * highlands.length)];
        if (pos) {
            createRiver(pos)
        }

    }
}

