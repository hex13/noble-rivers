console.log("Noble Rivers");

const TILE_SIZE = 64;
class Tile {
    constructor(pos) {
        this.terrain = 'grass';
        this.pos = {...pos};
    }
    createParams() {
        return {
            classes: ['tile', this.terrain],
            x: this.pos.x * TILE_SIZE,
            y: this.pos.y * TILE_SIZE,
            text: `${this.pos.x}, ${this.pos.y}`,
        };
    }
}

class Unit {
    constructor(props) {
        Object.assign(this, props);
    }
    createParams() {
        return {
            classes: ['unit'],
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
};

document.addEventListener('keydown', e => {
    if (Object.hasOwn(keyMap, e.code)) {
        const d = keyMap[e.code];
        console.log("====", e.code, d)
        updateObject(units[0], obj => {
            obj.pos.x += d.x;
            obj.pos.y += d.y;
        });
    }
});

