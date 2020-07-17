export const SCROLLSTART_EVENT_NAME = 'scrollstart';
export const SCROLLSTOP_EVENT_NAME = 'scrollstop';
export const SCROLLINIT_EVENT_NAME = 'scrollinit';
export const SCROLLEND_EVENT_NAME = 'scrollend';

const SCROLL_TIMEOUT = 100;
const scrolls = new WeakSet();

export function scroll(element, options={}) {
    options = Object.assign({
        skipRepeatedPosition: true,
        debug: false,
        axis: 'y',
    }, options, {
        endTimeout: options.endTimeout || SCROLL_TIMEOUT,
        eventOptions: options.eventOptions || {capture: true},
    });

    if (!element || !element.localName) {
        throw Error('Element needs to be a html tag');
    }

    if (scrolls.has(element)) {
        console.warn('[scroll][already initialized]', element);
        return;
    }

    scrolls.add(element);

    const prev = {
        position: null,
        delta: null,
        deltaValue: null,
        direction: null,
    };

    const state = {
        position: 0,
        delta: 0,
        deltaValue: 0,
        direction: null,

        scollTimeout: null,
        scrolling: false,
    };

    function updateState(callback) {
        if (callback) {
            callback(state);
        }

        // update values
        Object.assign(prev, {
            position: state.position,
            direction: state.direction,
            delta: state.delta,
            deltaValue: state.deltaValue,
        });
    }

    function start() {
        state.scrolling = true;

        element.dispatchEvent(new CustomEvent(SCROLLSTART_EVENT_NAME));

        window.requestAnimationFrame(() => {
            element.setAttribute('scrolling', '');
        });

        updateState(options.onScrollStart);

        if (options.debug) {
            console.log('[scroll][start]', element);
        }
    }

    function stop() {
        state.scollTimeout = null;
        state.scrolling = false;

        window.requestAnimationFrame(() => {
            element.removeAttribute('scrolling');
        });

        state.position = options.axis === 'y'? element.scrollTop: element.scrollLeft;
        state.delta = 0;
        state.deltaValue = 0;
        state.direction = null;

        updateState(options.onScrollStop);

        element.dispatchEvent(new CustomEvent(SCROLLSTOP_EVENT_NAME));

        if (options.axis === 'x') {
            if (element.scrollLeft === 0) {
                element.dispatchEvent(new CustomEvent(SCROLLINIT_EVENT_NAME));
            }

            if (element.scrollLeft === (element.scrollWidth - element.offsetWidth)) {
                element.dispatchEvent(new CustomEvent(SCROLLEND_EVENT_NAME));
            }
        } else { // y
            if (element.scrollTop === 0) {
                element.dispatchEvent(new CustomEvent(SCROLLINIT_EVENT_NAME));
            }

            if (element.scrollTop === (element.scrollHeight - element.offsetHeight)) {
                element.dispatchEvent(new CustomEvent(SCROLLEND_EVENT_NAME));
            }
        }

        if (options.debug) {
            console.log('[scroll][stop]', element);
        }
    }

    function scroll() {
        // register position of scroll
        state.position = options.axis === 'y'? element.scrollTop: element.scrollLeft;

        // init last position for first time
        prev.position = (
            prev.position === null?
            state.position:
            prev.position);

        state.delta = prev.position - state.position;
        state.deltaValue = Math.abs(state.delta);

        state.direction = (
            state.delta === 0?
            prev.direction? prev.direction: null:
            state.delta < 0? 'forward': 'back');

        updateState(options.onScroll);
    }

    // event callback
    function onScroll() {
        if (state.scollTimeout === null) {
            start();
        } else {
            scroll();
        }

        clearTimeout(state.scollTimeout);

        state.scollTimeout = window.setTimeout(stop, options.endTimeout);
    }

    // init event listening
    element.addEventListener('scroll', onScroll, options.eventOptions);

    return {
        destroy: function destroy () {
            element.removeEventListener('scroll', onScroll);
        },
    };
}
