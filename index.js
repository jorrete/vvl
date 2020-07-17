// TODO usar un object state que comparamos con scrollState
import {mode, mean, median} from './stats';
import {parseHTML, getRefObject, Cache, Recycler} from './utils';
import {scroll} from './scroll';

const virtualLists = new WeakSet();

export function vvl(element, options={}) {
    options = Object.assign({
        axis: 'y',
        debug: false,
        dynamic: false,
        extraChunk: 0,
        length: 0,
        mode: 'recreate', // [recreate, cache, recycle, declarative]
        performanceAlertLimit: 16, //ms, 60 fps
        reverse: false,
    }, options);

    if (!element || !element.localName || !element.id) {
        throw Error('Element needs to be a html tag with an ID');
    }

    if (options.mode !== 'declarative' && !options.renderItem) {
        throw Error('Element needs a renderItem function');
    }

    if (options.dynamic && !isCached()) {
        throw Error('dynamic option only works on "cache" and "declarative" mode');
    }


    if (virtualLists.has(element)) {
        if (options.debug) {
            console.warn('[vvl][already initialized]', element);
        }
        return;
    }

    virtualLists.add(element);

    element.setAttribute('vvl', options.axis);

    // reset restored positions and trust only position passed by arguments
    element.scrollTo({left: 0, top: 0});

    if (options.debug) {
        console.log('[vvl]', options, element);
    }

    const size = getRefObject({
        child: 0,
        childMin: null,
        chunk: 0,
        element: 0,
        scroll: 0,
    });

    const items = {
        created: 0,
        recycled: 0,
        rendered: 0,
    };

    const metrics = getRefObject({
        chunks: [],
        events: 0,
        skips: 0,
    });

    const bin = {
        cache: new Cache(),
        recycler: new Recycler(),
    };

    const beforeDoc = document.createDocumentFragment();
    const afterDoc = document.createDocumentFragment();

    const prev = getRefObject({
        firstVisibleIndex: null,
        initIndex: null,
        endIndex: null,
    });

    const state = getRefObject({
        firstVisibleIndex: null,
        initIndex: null,
        endIndex: null,
    });

    const scrollState = {
        position: 0,
        deltaValue: 0,
        direction: null,
    };

    // helpers options
    function isCached() {
        return ['cache', 'declarative'].includes(options.mode);
    }

    // helpers index
    function getLength() {
        if (options.mode === 'declarative') {
            return bin.cache.size;
        }

        return options.length;
    }

    function getIndex(index) {
        return index <= 0? 0: index >= getLength()? getLength() - 1: index;
    }

    function getSafeIndex(i) {
        if (!options.reverse) {
            return i;
        }
        return getLength() - 1 - i;
    }

    function getLastIndex() {
        return getLength() - 1;
    }

    function getFirstVisibleIndex() {
        if (!options.dynamic) {
            return scrollState.position === 0? 0: Math.floor((scrollState.position) / size.child);
        }

        // XXX revisar si cubre todos los casos
        if (!size.childMin) {
            return 0;
        }

        let guessIndex = Math.floor((scrollState.position) / size.childMin);

        // because it's guessing suppossing the minimun height for sure will build
        // a bigger size than real
        guessIndex = guessIndex > getLength() - 1? getLength() - 1: guessIndex;

        if (options.reverse) {
            for (var i = getLength() - guessIndex - 1; i < getLength(); i++) {
                if (getSafeTop(i) < scrollState.position) {
                    return getLength() - i - 1;
                }
            }
        } else {
            for (var j = guessIndex - 1; j >= 0; j--) {
                if (getSafeTop(j) < scrollState.position) {
                    return j;
                }
            }
        }

        return 0;
    }

    function getInitIndex(firstVisibleIndex) {
        const extraTop = (scrollState.direction === 'back'? options.extraChunk: 0);

        return getIndex(firstVisibleIndex - extraTop);
    }

    function getEndIndex(firstVisibleIndex) {
        const extraBottom = (scrollState.direction === 'forward'? options.extraChunk: 0);

        if (!options.dynamic) {
            return getIndex(firstVisibleIndex + size.chunk + extraBottom);
        }

        return getIndex(firstVisibleIndex + getDynamicChunkSize(firstVisibleIndex, scrollState.position) + extraBottom);
    }

    function getSafeTop(i) {
        if (!options.dynamic) {
            return prev.initIndex * size.child;
        }

        if (!options.reverse) {
            return bin.cache.get(i)._vvl_top;
        }
        return bin.cache.get(getLastIndex())._vvl_bottom - bin.cache.get(i)._vvl_bottom;
    }

    function getSafeBottom(i) {
        if (!options.dynamic) {
            return (prev.endIndex * size.child) + size.child;
        }

        if (!options.reverse) {
            return bin.cache.get(i)._vvl_bottom;
        }
        return bin.cache.get(getLastIndex())._vvl_bottom - bin.cache.get(i)._vvl_top;
    }

    // helpers size
    function searchSizeInTag(tag) {
        if (tag._vvl_size !== undefined) {
            return;
        }

        if (tag.hasAttribute('vvl-size')) {
            tag._vvl_size = parseInt(tag.getAttribute('vvl-size'));
        }
    }

    function getDynamicChunkSize(firstVisibleIndex) {
        for (var j = firstVisibleIndex; j < bin.cache.size; j++) {
            const i = getSafeIndex(j);
            if (getSafeBottom(i) > scrollState.position + size.element) {
                return j - firstVisibleIndex;
            }
        }

        return bin.cache.size - firstVisibleIndex - 1;
    }

    function setElementSize() {
        const elementCS = getComputedStyle(element);
        size.element = parseInt(options.axis === 'y'? elementCS.height: elementCS.width);
    }

    function setChildSize() {
        if (!getLength()) {
            size.child = 0;
        } else {
            // render first element so we can know his size
            const child = renderItem(0);
            element.appendChild(child);
            const childCS = getComputedStyle(child);
            size.child = parseInt(options.axis === 'y'? childCS.height: childCS.width);
            element.removeChild(child);
        }
    }

    function setViewportSizeFixed() {
        // calculate scroll size 
        size.scroll = size.child * getLength();
        size.chunk = Math.ceil(size.element / size.child);
    }

    function calculatePositions(initIndex=0) {
        for (var i = initIndex, len = bin.cache.size; i < len; i++) {
            const e = bin.cache.get(i);

            e._vvl_size = (
                e._vvl_size !== undefined?
                e._vvl_size:
                e[(options.axis === 'y'? 'offsetHeight': 'offsetWidth')]);

            if (i === 0) {
                e._vvl_top = 0;
                size.childMin = e._vvl_size;
            } else {
                const prev = bin.cache.get(i - 1);
                e._vvl_top = prev._vvl_top + prev._vvl_size;
                size.childMin = e._vvl_size < size.childMin? e._vvl_size: size.childMin;
            }

            e._vvl_bottom = e._vvl_top + e._vvl_size;
        }
    }

    function prerenderItems(initIndex=0) {
        const docFrag = document.createDocumentFragment();
        const childs = [];
        for (let i = initIndex; i <= getLength() - 1; i++) { 
            const child = renderItem(i);
            child.setAttribute('vvl-prerender', '');
            docFrag.appendChild(child);
            childs.push(child);
        }
        element.appendChild(docFrag);
        calculatePositions(initIndex);
        childs.forEach(child => {
            child.removeAttribute('vvl-prerender');
            element.removeChild(child);
        });
    }

    function setViewportSizeDynamic(initIndex=0) {
        // must be before we add or read anything
        prev.initIndex = null;
        prev.endIndex = null;

        if (!bin.cache.size || !bin.cache.get(0)._vvl_height) {
            prerenderItems(initIndex);
        } else {
            calculatePositions(initIndex);
        }

        // don't need special case to reverse because both modes has same scrollsize
        size.scroll = bin.cache.get(getLength() - 1)._vvl_bottom;
        size.chunk = Math.ceil(size.element / size.childMin);
    }

    // helpers render
    function renderItem(index) {
        if (isCached() && bin.cache.has(index)) {
            return bin.cache.get(index);
        }
         
        const element = options.mode === 'recycle'?  bin.recycler.get(): undefined;

        if (element !== undefined) {
            items.recycled++;
        } else {
            items.created++;
        }

        items.rendered++;

        const tag = options.renderItem(index, element, scrollState.deltaValue);
        tag._vvl_index = index;

        if (isCached()) {
            bin.cache.set(index, tag);
        }

        return tag;

    }

    function cleanElement(index=0) {
        element.style.removeProperty('--vvl-init');
        element.style.removeProperty('--vvl-end');

        const result = [];
        while (element.children[index]) {
            const child = element.removeChild(element.children[index]);
            result.push(child);
        }
        return result;
    }

    function removeUnusedNodes() {
        [].slice.call(element.children).map(child => {
            const index = getSafeIndex(child._vvl_index);

            if (index >= state.initIndex && index <= state.endIndex) {
                return;
            }

            element.removeChild(child);

            if (options.mode === 'recycle') {
                bin.recycler.set(child);
            }
        });
    }

    function addNewChilds() {
        for (let i = state.initIndex; i <= state.endIndex; i++) { 

            if (prev.initIndex === null || i < prev.initIndex) {
                beforeDoc.appendChild(renderItem(getSafeIndex(i)));
            } else if (prev.endIndex === null || i > prev.endIndex) {
                afterDoc.appendChild(renderItem(getSafeIndex(i)));
            }
        }

        element.prepend(beforeDoc);
        element.append(afterDoc);
    }

    function fillEmptySpace() {
        if (options.dynamic) {
            element.style.setProperty('--vvl-init', `${getSafeTop(getSafeIndex(state.initIndex))}px`);
            element.style.setProperty('--vvl-end', `${size.scroll - getSafeBottom(getSafeIndex(state.endIndex))}px`);
        } else {
            element.style.setProperty('--vvl-init', `${state.initIndex * size.child}px`);
            element.style.setProperty('--vvl-end', `${size.scroll - (state.endIndex * size.child + size.child)}px`);
        }

    }

    function isLastRenderedDataStillInTheVisualLimit() {
        const upCommingPos = (
            scrollState.direction === 'back'?
            getSafeTop(getSafeIndex(prev.initIndex)):
            getSafeBottom(getSafeIndex(prev.endIndex)));

        return (
            scrollState.direction === 'back'?
            scrollState.position >= upCommingPos:
            (scrollState.position + size.element) <= upCommingPos);
    }

    function shoulSkipRender() {
        return (
            options.extraChunk > 0 // without extraChunk render always
            && prev.initIndex !== null // must be have at least one previous render
            && scrollState.direction !== null // ignore as static render
            && isLastRenderedDataStillInTheVisualLimit() // the last rendered item still out of vieport
        );
    }

    function setState() {
        const firstVisibleIndex = getFirstVisibleIndex();

        Object.assign(state, {
            firstVisibleIndex: firstVisibleIndex,
            initIndex: getInitIndex(firstVisibleIndex),
            endIndex: getEndIndex(firstVisibleIndex),
        });
    }

    function renderChunk() {
        const init = new Date();

        setState();

        const skip = shoulSkipRender();

        if (options.debug) {
            console.warn(`[vvl][${skip? 'skip': 'do'} render]`, state);
        }

        if (skip) {
            metrics.skips++;
        } else {
            removeUnusedNodes();
            addNewChilds();
            fillEmptySpace();

            Object.assign(prev, state); 

            const deltaTime = new Date() - init;
            metrics.chunks.push(deltaTime);

            if (options.debug) {
                if (deltaTime > options.performanceAlertLimit) {
                    console.warn('[vvl][rendering performace]', deltaTime);
                }
            }
        }
    }

    // scroll callbacks
    function onScrollStart() {
        metrics.reset();
    }

    function onScroll(state) {
        metrics.events++;

        Object.assign(scrollState, state);

        window.requestAnimationFrame(() => {
            if (onScroll._running) {
                return;
            }

            onScroll._running = true;

            renderChunk();

            onScroll._running = false;
        });
    }

    function onScrollStop(state) {
        Object.assign(scrollState, state);
        window.requestAnimationFrame(() => {
            renderChunk();
        });
    }

    // init
    const scrollRef = scroll(element, Object.assign({
        debug: options.debug,
        endTimeout: options.endTimeout,
        eventOptions: options.eventOptions,
        axis: options.axis,
        onScrollStart: onScrollStart,
        onScroll: onScroll,
        onScrollStop: onScrollStop,
    }));

    if (options.mode !== 'declarative') {
        Object.assign(element, {
            updateLength: function (length=0, flush=true) {
                if (flush) {
                    bin.cache.flush();
                    bin.recycler.flush();
                }

                // cache content to allow calculations of dynamic sizes
                if (options.dynamic) {
                    for (var i = (flush? 0: options.length); i < length; i++) {
                        const tag = renderItem(i);
                        searchSizeInTag(tag);
                        bin.cache.set(i, tag);
                    }
                }

                options.length = length;

                element.update(flush);
            },
            repaint: function (flush=true) {
                if (flush) {
                    bin.cache.flush();
                    bin.recycler.flush();
                }
                renderChunk();
            },
        });
    } else {
        Object.assign(element, {
            updateContent(content, flush=true) {
                if (flush) {
                    size.childMin = null;
                    bin.cache.flush();
                    bin.recycler.flush();
                }

                const docFrag = document.createDocumentFragment();
                if (Array.isArray(content)) {
                    content = content.reduce((docFrag, tag) => {
                        docFrag.appendChild(tag);
                        return docFrag;
                    }, docFrag);
                } if (typeof content === 'string') {
                    content = parseHTML(content);
                }
                const length = getLength();
                [].forEach.call(content.children, (tag, index) => {
                    searchSizeInTag(tag);
                    // TODO centralize saving on cache and setting _vvl_index at same time
                    tag._vvl_index = (flush? 0: length) + index;
                    bin.cache.set((flush? 0: length) + index, tag);
                });

                element.update(flush, (flush? 0: length));
            },
            repaint: function () {
                renderChunk();
            },
        });
    }

    Object.assign(element, {
        update: function (flush=true, from=0) {
            if (getLength()) {
                element.removeAttribute('empty');
            } else {
                element.setAttribute('empty', '');
            }

            if (flush) {
                prev.reset();
                cleanElement();
            }

            size.reset();

            setElementSize();

            if (options.dynamic) {
                setViewportSizeDynamic(from);
            } else {
                if (!size.child) {
                    setChildSize();
                }
                setViewportSizeFixed();
            }
            cleanElement();
            prev.reset(); 
            renderChunk();
        },
        scrollToPosition: function (position, smooth=false) {
            const scrollOptions = {behavior: smooth? 'smooth': 'auto'};
            scrollOptions[options.axis === 'y'? 'top': 'left'] = position;
            element.scrollTo(scrollOptions);
        },
        scrollInit: function (smooth=false) {
            element.scrollToPosition(0, smooth);
        },
        scrollEnd: function (smooth=false) {
            element.scrollToPosition(size.scroll, smooth);
        },
        scrollForward: function (smooth=false) {
            element.scrollToPosition(scrollState.position + size.element, smooth);
        },
        scrollPrev: function (smooth=false) {
            element.scrollToPosition(scrollState.position - size.element, smooth);
        },
        scrollToIndex: function (index=0, smooth=false) {
            index = getSafeIndex(getIndex(index));
            const firstIndex = element.firstElementChild._vvl_index;
            const endIndex = element.lastElementChild._vvl_index;

            if (index > firstIndex && index < endIndex) {
                return;
            }

            const position = (
                options.dynamic?
                bin.cache.get(index)._vvl_top:
                index * size.child);
            element.scrollToPosition(position, smooth);
        },
        getMetrics: function () {
            return {
                'chunk_size': size.chunk,
                'events': metrics.events,
                'skips': metrics.skips,
                'extra_chunk': options.extraChunk,
                'mode': options.mode,
                'chunks_mean_time': mean(metrics.chunks),
                'chunks_median_time': median(metrics.chunks),
                'chunks_mode_time': mode(metrics.chunks),
                'chunks': metrics.chunks.length,
                'reverse': options.reverse,
                'items_rendered': items.rendered,
                'items_created': items.created,
                'items_recycled': items.recycled,
                'items_cached': bin.cache.size,
            };
        },
        destroy: function () {
            scrollRef.destroy();
            cleanElement();
            bin.cache.flush();
            bin.recycler.flush();
            virtualLists.delete(element);
        },
    });

    // we need to put this on next frame to allow give time attribute vvl to style the list
    // if not size.element is 0 and doesn't render properly
    window.requestAnimationFrame(() => {
        if (options.mode === 'declarative') {
            element.updateContent(cleanElement());
        } else {
            element.updateLength(options.length);
        }

        if (options.index !== undefined) {
            element.scrollToIndex(options.index);
        }
        else if (options.position !== undefined) {
            element.scrollTo(
                options.axis === 'y'?
                {top: options.position}:
                {left: options.position});
        }
    });
}
