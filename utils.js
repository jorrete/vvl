export function parseHTML(html) {
    const frag = document.createDocumentFragment();
    const div = document.createElement('div');
    div.innerHTML = html;
    while (div.firstChild) {
        frag.appendChild(div.firstChild);
    }
    return frag;
}

export function getRefObject(initial={}) {
    return Object.defineProperty(Object.assign({}, initial), 'reset', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function () {
            Object.assign(this, initial);
        },
    });
}

export class Cache {
    constructor() {
        this.flush();
    }

    flush() {
        this._cache = new Map();
    }

    get(key) {
        return this._cache.get(key);
    }

    has(key) {
        return this._cache.has(key);
    }

    set(key, value) {
        this._cache.set(key, value);
    }

    get size() {
        return this._cache.size;
    }
}

export class Recycler {
    constructor() {
        this._recycled = [];
    }

    flush() {
        this._recycled = [];
    }

    get() {
        return this._recycled.shift();
    }

    has(value) {
        return this._recycled.indexOf(value) > -1;
    }

    set(value) {
        if (this.has(value)) {
            return;
        }

        this._recycled.push(value);
    }

    get size() {
        return this._recycled.length;
    }
}
