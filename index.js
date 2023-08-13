console.log("Noble Rivers");

const TILE_SIZE = 32;
class Tile {
    constructor() {
        this.terrain = 'grass';
    }
}


class TileMap {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.data = [...Array(w * h)].map(() => new Tile());
    }
    getIndex(pos) {
        return pos.y * this.width + pos.x;
    }
    get(pos) {
        return this.data[this.getIndex(pos)];
    }
}
