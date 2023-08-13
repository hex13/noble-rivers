console.log("Noble Rivers");

const TILE_SIZE = 32;
class Tile {
    constructor(pos) {
        this.terrain = 'grass';
        this.pos = {...pos};
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

function El(params) {
    const el = document.createElement('div');
    updateEl(el, params);
    return el;
}

function updateEl(el, params) {
    el.className = params.classes.join(' ');
    el.style.transform = `translate(${params.x}px, ${params.y}px)`;
    el.innerText = params.text;
}

const map = new TileMap(10, 10);

map.get({x: 3, y: 3}).terrain = 'forest';
map.get({x: 4, y: 3}).terrain = 'water';
map.get({x: 4, y: 4}).terrain = 'water';
map.get({x: 4, y: 5}).terrain = 'water';
console.log(map)

const domEl = document.getElementById('app');

for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        const { terrain } = map.get({x, y});
        const params = {
            classes: ['tile', terrain], 
            x: x * TILE_SIZE, 
            y: y * TILE_SIZE, 
            text: `${x}, ${y}`,
        }
        domEl.append(El(params));
    }
}