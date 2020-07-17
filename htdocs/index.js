import {vvl} from '../index.js';
import {createElement, updateElement, getData, createDomContent} from './helpers';

function getOptions() {
    Array.from(new URLSearchParams(location.search).entries()).forEach(param => {
        try {
            const [key, value] = param;
            switch (key) {
                case 'debug':
                case 'reverse':
                case 'dynamic':
                    document.querySelector(`[name="${key}"]`).checked = value === 'on';
                    break;
                case 'axis':
                case 'mode':
                    document.querySelector(`[name="${key}"][value="${value}"]`).checked = true;
                    break;
                default:
                    document.querySelector(`[name="${key}"]`).value = value;
                    break;
            }
        } catch (e) {
            void 0;
        }
    });

    const options = Array.from(new FormData(document.getElementById('form')))
        .reduce((options, item) => {
            options[item[0]] = item[1];
            return options;
        }, {});

    return {
        debug: options.debug === 'on',
        dynamic: options.dynamic === 'on',
        reverse: options.reverse === 'on',
        axis: options.axis,
        mode: options.mode,
        length: parseInt(options.length),
        extraChunk: parseInt(options.extraChunk),
        lazy: parseInt(options.lazy),
        imgSize: parseInt(options.imgSize),
        position: options.position === ''? undefined: parseInt(options.position),
        index: options.index === ''? undefined: parseInt(options.index),
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('list');
    const options = getOptions();

    let data = (
        options.mode === 'declarative'?
        createDomContent(options.length, 0, options.dynamic):
        getData(options.length, 0));

    if (options.mode === 'declarative') {
        list.appendChild(data);
    } else {
        options.renderItem = function (index, element, deltaScroll) {
            return updateElement(
                element || createElement(),
                data[index],
                (options.lazy && deltaScroll > options.lazy),
                options.dynamic,
                options.mode);
        };
    }

    vvl(list, options);

    if (options.debug) {
        list.addEventListener('scrollstop', () => {
            console.log('######## METRICS ########');
            console.log(JSON.stringify(list.getMetrics(), undefined, 4));
        });
    }

    document.getElementById('controls').addEventListener('click', event => {
        const action = event.target.id;
        const smooth = document.getElementById('smooth').checked;
        if (['reset', 'update'].includes(action)) {
            if (options.mode === 'declarative') {
                list.updateContent(
                    createDomContent(
                        options.length,
                        options.length,
                        options.dynamic),
                    action === 'reset');
            } else {
                const newData = getData(options.length, action === 'reset'? 0: data.length);
                data = action === 'reset'? newData: data.concat(newData);
                list.updateLength(data.length, action === 'reset');
            }
        }

        if (action === 'init') {
            list.scrollInit(smooth);
        }

        if (action === 'end') {
            list.scrollEnd(smooth);
        }

        if (action === 'forward') {
            list.scrollForward(smooth);
        }

        if (action === 'prev') {
            list.scrollPrev(smooth);
        }
    });

    document.getElementById('index').addEventListener('input', event => {
        const smooth = document.getElementById('smooth').checked;
        list.scrollToIndex(parseInt(event.target.value), smooth);
    });
});
