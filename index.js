console.log("Noble Rivers");

const TILE_SIZE = 64;
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

function updateEl(el, params) {
    el.className = params.classes.join(' ');
    el.style.transform = `translate(${params.x}px, ${params.y}px)`;
    el.innerText = params.text;
}

function createTileParams(tile) {
    return {
        classes: ['tile', tile.terrain],
        x: tile.pos.x * TILE_SIZE, 
        y: tile.pos.y * TILE_SIZE, 
        text: `${tile.pos.x}, ${tile.pos.y}`,
    };
}

function updateTile(pos, f = _ => {}) {
    const tile = map.get(pos);
    if (!tile.el) {
        tile.el = document.createElement('div');
        tile.el.__tile = tile;
        domEl.append(tile.el);
    }
    f(tile);
    updateEl(tile.el, createTileParams(tile));
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
        updateTile({x, y});
    }
}

setTimeout(() => {
    updateTile({x: 4, y: 6}, tile =>{
        tile.terrain = 'water';
    });
}, 1000);

domEl.addEventListener('click', e => {
    alert(e.target.__tile.terrain)
});