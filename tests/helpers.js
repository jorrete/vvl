const PAGE_URL = `file://${process.env.PAGE_URL}`;

function getOptionsPermutations() {
    const options = {
        length: [100],
        mode: ['cache', 'recycle', 'declarative', 'recreate'],
        axis: ['x', 'y'],
        reverse: [true, false],
        dynamic: [true, false],
    };

    return Object.keys(options).reduce((result, key) => {
        const final = [];
        options[key].forEach(o => {
            result.forEach(r => {
                const copy = Object.assign({}, r);
                copy[key] = o;
                final.push(copy);
            });
        });
        return final;
    }, [{}]);
}

function getValue(key, value) {
    switch (key) {
        case 'debug':
        case 'reverse':
        case 'dynamic':
            return value? 'on': null;
        default:
            return value;
    }
}

function getURL(options={}) {
    return `${PAGE_URL}?${Object.keys(options).map(key => {
        const value = getValue(key, options[key]);

        if (value === null) {
            return;
        }

        return `${key}=${value}`;
    }).filter(a => a).join('&')}`;
}

async function getChildrenPos() {
    return await page.evaluate(() => {
        return [].map.call(document.getElementById('list').children, child => {
            const rect = child.getBoundingClientRect();
            return {
                index: child._vvl_index,
                top: rect.top,
                left: rect.left,
                height: rect.height,
                width: rect.width,
                bottom: rect.bottom,
                right: rect.right,
            };
        });
    });
}

async function getElementPos() {
    return await page.evaluate(() => {
        const list = document.getElementById('list');
        const rect = list.getBoundingClientRect();
        return {
            scrollTop: list.scrollTop,
            scrollLeft: list.scrollLeft,
            scrollWidth: list.scrollWidth,
            scrollHeight: list.scrollHeight,
            top: rect.top,
            left: rect.left,
            height: rect.height,
            width: rect.width,
            bottom: rect.bottom,
            right: rect.right,
        };
    });
}

async function fireControl(control, args=[]) {
    return await page.evaluate(options => {
        return new Promise(resolve => {
            const list = document.getElementById('list');
            list.addEventListener('scrollstop', () => {
                // give some time to render nodes
                setTimeout(() => {
                    resolve(list.getMetrics());
                }, 30);
            }, {once: true});
            list[options.control].apply(list, options.args);
        });
    }, {control: control, args: args});
}

async function fireContent(target) {
    return await page.evaluate(target => {
        document.getElementById(target).click();
    }, target);
}

async function wait(time=0) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
}

async function testOrderIntegrity(options) {
    const childrenPos = await getChildrenPos();
    const correctOrder = childrenPos.every((item, index) => {
        if (index === 0) {
            return true;
        }

        const prev = childrenPos[index - 1];

        if (options.reverse) {
            return item.index < prev.index;
        } else {
            return item.index > prev.index;
        }
    });

    await expect(correctOrder).toBe(true);
}

function testSize(options) {
    describe(`size ${options.dynamic? '[dynamic]': ''}`, () => {
        it('last item', async () => {
            await testOrderIntegrity(options);
            await fireControl('scrollEnd');
            await testOrderIntegrity(options);
            const childrenPos = await getChildrenPos();
            const lastChild = childrenPos.slice(-1)[0];
            const elementPos = await getElementPos();
            await expect(Math.round(elementPos.bottom) === Math.round(lastChild.bottom)).toBe(true);
        });
    });
}

function testOrder(options) {
    describe(`order ${options.reverse? '[reverse]': ''}`, () => {
        it('Shows items', async () => {
            // is > 1 and not > 0 because sometimes may be only one item
            // product of calculating child size and happening something that
            // halts execution
            const childrenPos = await getChildrenPos();
            await testOrderIntegrity(options);
            await expect(childrenPos.length > 1).toBe(true);
        });

        it('First item index', async () => {
            const childrenPos = await getChildrenPos();
            const firstIndex = options.reverse? options.length -1 : 0;
            await testOrderIntegrity(options);
            await expect(childrenPos[0].index).toBe(firstIndex);
        });

        it('Last item index', async () => {
            const childrenPos = await getChildrenPos();
            const firstIndex = options.reverse? options.length -1 : 0;
            const lastIndex = options.reverse? firstIndex - childrenPos.length + 1 : firstIndex + childrenPos.length -1;
            await expect(childrenPos.slice(-1)[0].index).toBe(lastIndex);
        });
    });
}

function testAxis(options) {
    describe(`axis ${options.axis}`, () => {
        it('Next item is in right position', async () => {
            const childrenPos = await getChildrenPos();
            const wellPositioned = childrenPos.every((item, index) => {
                if (index === 0) {
                    return true;
                }

                const prev = childrenPos[index - 1];

                if (options.axis === 'y') {
                    return item.top > prev.top;
                } else {
                    return item.left > prev.left;
                }
            });
            await testOrderIntegrity(options);
            await expect(wellPositioned).toBe(true);
        });
    });
}

// TODO reverse
function testControls(options) {
    describe('controls', () => {
        it('end', async () => {
            await fireControl('scrollEnd');
            const childrenPos = await getChildrenPos();
            const lastChild = childrenPos.slice(-1)[0];
            await testOrderIntegrity(options);
            await expect(lastChild.index).toBe(options.reverse? 0: options.length - 1);
        });

        it('init', async () => {
            await fireControl('scrollEnd');
            await fireControl('scrollInit');
            const childrenPos = await getChildrenPos();
            const firstChild = childrenPos[0];
            await testOrderIntegrity(options);
            await expect(firstChild.index).toBe(options.reverse? options.length - 1: 0);
        });

        it('forward', async () => {
            const initialElementPos = await getElementPos();
            const initialPos = initialElementPos[options.axis === 'y'? 'scrollTop': 'scrollLeft'];
            const initialSize = initialElementPos[options.axis === 'y'? 'height': 'width'];
            await fireControl('scrollForward');
            const endElementPos = await getElementPos();
            const endPos = endElementPos[options.axis === 'y'? 'scrollTop': 'scrollLeft'];
            await testOrderIntegrity(options);
            await expect(Math.round(initialPos + initialSize)).toBe(Math.round(endPos));
        });

        it('prev', async () => {
            await fireControl('scrollForward');
            const initialElementPos = await getElementPos();
            const initialPos = initialElementPos[options.axis === 'y'? 'scrollTop': 'scrollLeft'];
            const initialSize = initialElementPos[options.axis === 'y'? 'height': 'width'];
            await fireControl('scrollPrev');
            const endElementPos = await getElementPos();
            const endPos = endElementPos[options.axis === 'y'? 'scrollTop': 'scrollLeft'];
            await testOrderIntegrity(options);
            await expect(Math.abs(Math.round(initialPos - initialSize))).toBe(Math.round(endPos));
        });

        // it('index', async () => {
        // });
    });
}

function testInitialPos(options) {
    describe('initial options', () => {
        if (options.position) {
            it('position', async () => {
                await page.goto(getURL(options));
                await wait(30);
                const element = await getElementPos();
                await expect(element[options.axis === 'y'? 'scrollTop': 'scrollLeft']).toBe(options.position);
            });
        } else if (options.index) {
            it('index', async () => {
                await page.goto(getURL(options));
                await wait(30);
                const childrenPos = await getChildrenPos();
                const firstChild = childrenPos[0];
                const lastChild = childrenPos.slice(-1)[0];
                if (options.index <= firstChild.index || options.index >= lastChild.index) {
                    await expect(firstChild.index).toBe(options.index);
                } else {
                    await expect(firstChild.index).toBe(0);
                }
            });
        }
    });
}

function testMode(options) {
    describe('mode', () => {
        it(options.mode, async () => {
            const metricsEnd = await fireControl('scrollEnd');
            const metricsInit = await fireControl('scrollInit');
            switch (options.mode) {
                case 'cache':
                    await expect(metricsInit.items_rendered === metricsInit.items_cached).toBe(true);
                    await expect(metricsInit.items_recycled === 0).toBe(true);
                    break;
                case 'declarative':
                    await expect(metricsInit.items_cached === options.length).toBe(true);
                    await expect(metricsInit.items_rendered === 0).toBe(true);
                    await expect(metricsInit.items_recycled === 0).toBe(true);
                    break;
                case 'recycle':
                    await expect(metricsEnd.items_created === metricsInit.items_created).toBe(true);
                    await expect(metricsInit.items_cached === 0).toBe(true);
                    break;
                default: // recreate
                    await expect(metricsInit.items_cached === 0).toBe(true);
                    await expect(metricsInit.items_recycled === 0).toBe(true);
                    break;
            }
        });
    });
}

function testUpdate(options) {
    describe('update', () => {
        it('last item', async () => {
            await testOrderIntegrity(options);
            await fireControl('scrollEnd');
            await testOrderIntegrity(options);
            const initialLastChild = (await getChildrenPos()).slice(-1)[0];
            await expect(initialLastChild.index === (options.reverse? 0: options.length - 1)).toBe(true);

            await fireContent('update');
            await testOrderIntegrity(options);
            await fireControl('scrollEnd');
            await testOrderIntegrity(options);
            const finalLastChild = (await getChildrenPos()).slice(-1)[0];
            await expect(finalLastChild.index === (options.reverse? 0: (options.length * 2) - 1)).toBe(true);
        });
    });
}

function testReset(options) {
    describe('reset', () => {
        it('last item', async () => {
            await testOrderIntegrity(options);
            await fireControl('scrollEnd');
            await testOrderIntegrity(options);
            const initialLastChild = (await getChildrenPos()).slice(-1)[0];
            await expect(initialLastChild.index === (options.reverse? 0: options.length - 1)).toBe(true);
            await wait(100);
            await fireContent('reset');
            await testOrderIntegrity(options);
            await fireControl('scrollEnd');
            await testOrderIntegrity(options);
            const finalLastChild = (await getChildrenPos()).slice(-1)[0];
            await expect(finalLastChild.index === (options.reverse? 0: options.length - 1)).toBe(true);
        });
    });
}

function test(options) {
    beforeEach(async () => {
        await page.goto(getURL(options));
        await wait(30);
    });

    testSize(options);
    testAxis(options);
    testOrder(options);
    testControls(options);
    testInitialPos(options);
    testMode(options);
    testReset(options);
    testUpdate(options);
}

module.exports = {
    test,
    getOptionsPermutations
};
