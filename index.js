console.log("Noble Rivers");

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
        if (!tile.item) return;
        this.item = true;
        updateObject(tile, tile => {
            tile.item = false;
        });
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
            console.log("o", obj)
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



const map = new TileMap(10, 10);

map.get({x: 3, y: 3}).terrain = 'forest';
map.get({x: 4, y: 3}).terrain = 'water';
map.get({x: 4, y: 4}).terrain = 'water';
map.get({x: 4, y: 5}).terrain = 'water';
map.get({x: 1, y: 1}).progress = 10;
map.get({x: 2, y: 1}).progress = 50;
map.get({x: 2, y: 1}).building = 'farm';


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

domEl.addEventListener('click', e => {
    const el = e.target.closest('.tile');
    updateObject(map.get(el.__obj.pos), tile => {
        tile.terrain = 'water';
    });
    // alert(e.target.__tile.terrain)
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
    console.log("--", e.code)
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
}, 3000);

npcs.forEach(npc => {
    npc.v.x = 1;
});
setInterval(() => {
    npcs.forEach(npc => {
        updateObject(npc, npc => {
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
            npc.take();
        });
    });
}, 1000);