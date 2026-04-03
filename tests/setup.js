import { createCanvas } from 'canvas';

const originalCreateElement = document.createElement.bind(document);

document.createElement = function(tagName, options) {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = createCanvas(300, 150);
    canvas.width = 300;
    canvas.height = 150;
    return canvas;
  }
  return originalCreateElement(tagName, options);
};
