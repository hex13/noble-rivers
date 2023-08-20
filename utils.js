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


function *radiate(center, maxRadius) {
    for (let r = 1; r < maxRadius; r++) {
        for (const pt of border(center, r)) {
            yield pt;
        }
    }
}
