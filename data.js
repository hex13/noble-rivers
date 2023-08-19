const products = {
    gold: {
        name: 'gold',
        requires: {
            food: 2,
        }
    },
    wood: {
        name: 'wood',
        requires: {
            food: 3,
        }
    },
    food: {
        name: 'food',
        requires: {
        }
    },
};

const buildings = {
    farm: {
        produces: {kind: 'item', item: products.food},
    },
    woodcutter: {
        produces: {kind: 'item', item: products.wood, near: 'forest'},
    }
}