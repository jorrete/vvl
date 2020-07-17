function range(n=0, start=0) {
    return [...Array(n).keys()].map(i => i + start);
}

function getColor(i) {
    return ['#e7f9ff', '#d1f4ff', '#c0efff'][i];
}

function getImg(i) {
    return ['fox.jpg', 'cat.jpg', 'bear.jpg'][i];
}

function getSize(i) {
    return [50, 100, 150][i];
}

export function getData(n, start=0) {
    return range(n, start).map(index => {
        const i = Math.floor(Math.random() * 3);
        return {
            index: index,
            even: index % 2 == 0,
            size: getSize(i),
            color: getColor(i),
            img: getImg(i),
        };
    });
}
export function createElement() {
    const li = document.createElement('li');
    li.appendChild(document.createElement('div'));
    li.appendChild(document.createElement('img'));
    return li;
}

export function updateElement(element, item, lazy, dynamic, mode) {
    if (lazy && !element._rendered) {
        element.style.setProperty('background-color', 'lightgreen');
        element.children[0].textContent = '[LAZY]';
        element.children[1].src = '';
        clearTimeout(element._timeout);
        element._timeout = setTimeout(() => {
            // XXX only use this with mode recycle
            // it's being rendered on cache so has been scrolled by
            if (mode === 'recycle') {
                if (!element.parentNode) {
                    return;
                }
            } else {
                element._rendered = true;
            }
            updateElement(element, item, false, dynamic);
        }, 500);
    } else {
        element.style.setProperty('background-color', item.color);
        element.children[0].textContent = `Item ${item.index}`;
        element.children[1].src = item.img;
    }

    element.children[1].loading = 'lazy';
    element.children[1].height = '50';

    if (dynamic) {
        element.setAttribute('vvl-size', item.size);
    }

    return element;
}

export function createDomContent(n, start, dynamic) {
    return getData(n, start).reduce((docFrag, item) => {
        docFrag.appendChild(updateElement(createElement(), item, false, dynamic, null));
        return docFrag;
    }, document.createDocumentFragment());
}
