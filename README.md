# Vanilla Virtual List (alpha)

## Description

VVL is a virtual list library without any framework dependecy.

## Why Virtual Lists?

I'ts a good practice to keep you DOM as lean as possible. I you try to animate an element that has 2000 childrens growing out of the viewport the browser will struggle to have a smooth animation.

Also if you try to put all childrens at once it will spend some time doing the first render. With 50 items it's not noticeable but with 5000 items it does.

So virtual list try to address this problems rendering only the visible part of the list and orchestrating the DOM update as you scroll the list, giving the impression that it is a regular list.

## VVL Philosophy

There are virtual lists that calculate the size of the list, then use an element with that size to create the "scroll space" and then use the "position: absolute" to draw the childrens where were supposed to be.

VVL tries to keep the DOM as normal as possible. It will simply put the childrens with their default "position: static" and will user the pseudo elements ":before" and ":after" to fill the missing space and create the "scroll space". This allows:

- No absolute position means that you don't have to force the width to match the parent and no height calculation.
- No absolute position means that you don't have care about stacking context.
- You can use "ul > li", "ol > li" or "div > div" and the list will keep being semantic. No extra div flowing around.

It would be possible to encapsulate VVL in a **Custom element** freeing us of having to load a small chunk of css and making it really compact but that would make to loose the html it's semantics.

## Capabilities

- Virtual list on y and x axis.
- Same height items or totally dynamic.
- It handles the height automatically (also for dynamic height items).
- It can make a regular html content to virtualized content.
- Show content in reverse order without having to reverse the dataset.
- Recreate content each time, cache rendered items or recycle items so you will use only a few elements no matter how big is the dataset.
- Extended element interface: scrollEnd, scrollInit, scrollForward, scrollPrev, scrollToIndex.

## Install

```bash
npm install vvl
```

## Use
VVL it's meant to be used in a build enviroment that allows es6 imports, and css imports.

First you have to load in your page **vvl/index.css**. You can copy it manually or import it.

```javascript
import {vvl} from 'vvl';

vvl(document.getElementById('mylist'), {
    axis: 'y',
    length: 100,
    mode: 'cache',
    renderItem: (index, element, deltaScroll) => {
        element = element || document.createElement('li');
        element.innerHTML = `Item ${index}`;
        return element;
    }
    reverse: false,
    dynamic: false,
    extraChunk: 10,
});
```
As you can see VVL doesn't want to know anything about the source data. It needs the length of the list and a function to render each item. It's up to you to retrieve the item's data with the supplied index.

## Options

### axis: 'x' | 'y'

Self explaining. 'y' for a vertical list and 'x' for horizontal.

Axis 'y' it will set height of the list at 100%.

Axis 'x' it will set width of the list at 100%. In order to axis 'x' to work the browser must support "display: flex".

### length: integer

The size of the dataset.

Not used when mode is **declarative**.

### mode: 'recreate' | 'cache' | 'recycle' | 'declarative'

**recreate** renders elements each time are displayed.

**cache** renders elements one time and then uses the cached element.

**recycle** renders a few elements and the reuse them.

**declarative** doesn't render anything, takes the html content a use it as cached content.

### renderItem: function

The function receives 3 arguments.

The first one is the index of children to be rendered.

The second one is a recycled element. Only used when mode is **recycled**. You can see in the example above how to have a function that creates an element when needed or reuse it when possible.

The third one is "scroll speed" so you can use it to do a lazy render. If deltaScroll is high it means that the list is scrolling very fast so maybe doesn't make sense to do a proper item render because it will not be seen by the user.

### reverse: boolean

Whether to render the list in normal order or reversed.

### dynamic: boolean

Whether items have same height or not.

**ALERT!!** when **dynamic** is set to **true** it will pre-render the whole dataset to get the size and positions.

If you try to render a 3000 items dataset with dynamic set to true it will freeze for a few seconds until pre-renders everything.

So use it when the dataset and updates are small. For example an infinity list where you are adding small chunks of data.

### extraChunk: integer

**extraChunk** AKA **smart render** it's the number of extra items that will attach when scrolling.

Normally VVL only renders the minimum number of items to fill the visible part of the list. With extra chunk, when vvl it is scrolling will add extra items in the direction of scroll and only will render when the las item it's close to be visible.

The result it is **much** less renders and more natural scroll. You have to find a balance between the time to render items and the number of times that have to render the items.

For example it you list have only 10 visible items you can set extraChunk to 15 and that will save a lot of renders. But if it is a low end phone and you set extraChunk to 100 the time spent rendering all the items will negate the performance saving of not to render more times.


## Interface

All extra scroll interfaces accept a "smooth" boolean argument. If the browser have scroll-behavior smooth implemented it will be used.

### scrollEnd

Scroll to the end of the list.

### scrollInit

Scroll to the init of the list.

### scrollForward

Scroll one visible "page" forward.

### scrollPrev

Scroll one visible "page" backwards.

### scrollEnd

Scroll to the end of the list.

### scrollToIndex

Scroll to the item with the passed index argument. If the element it's already visible it will do nothing.

## Development

### serve

```bash
npm run dev
```

Open **localhost:5000** and play with the interface.

### test

```bash
npm run test
```
It will take a few minutes.
