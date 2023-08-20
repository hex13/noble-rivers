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
    metal: {
        name: 'metal',
        requires: {
            food: 2,
        }
    },
};

const buildings = {
    farm: {
        produces: {kind: 'item', item: products.food},
    },
    woodcutter: {
        produces: {kind: 'item', item: products.wood, near: 'forest'},
    },
    mine: {
        produces: {kind: 'item', item: products.metal, near: 'mountain'},
    },
}