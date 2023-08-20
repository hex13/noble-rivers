function createGui({ buildings }) {
    const gui = {mode: 'inspect'};
    Object.entries(buildings).concat([['inspect']]).forEach(([key, building]) => {
        const el = $('button');
        el.innerText = key;
        el.className = gui.mode == key? 'active' : '';
        el.addEventListener('click', () => {
            gui.mode = key;
            menuEl.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            el.classList.add('active');
        });
        menuEl.append(el);
    });
    return gui;
}
