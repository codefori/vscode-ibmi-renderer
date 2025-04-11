const vscode = acquireVsCodeApi();

window.addEventListener("message", (event) => {
  const command = event.data.command;
  switch (command) {
    case `load`:
      console.log(event.data.dds);
      break;
  }
});

window.onload = () => {
  let pxwPerChar = 8.45;
  let pxhPerChar = 11;
  let dspfWidth = 80;
  let dspfHeight = 24;

  var width = dspfWidth * pxwPerChar;
  var height = dspfHeight * pxhPerChar;

  var stage = new Konva.Stage({
    container: 'container',
    width: width,
    height: height
  });

  const bg = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: 'black'
  });

  var layer = new Konva.Layer();
  layer.add(bg);

  var rectX = stage.width() / 2 - 50;
  var rectY = stage.height() / 2 - 25;

  function getNewSnapCords(x, y) {
    const newX = Math.round(x / pxwPerChar) * pxwPerChar;
    const newY = Math.round(y / pxhPerChar) * pxhPerChar;
    return { x: newX, y: newY };
  }

  function getLabelBox(row, col, text) {
    const width = text.length * pxhPerChar;
    const height = 11;

    var rectangle = new Konva.Group({
      x: (col - 1) * pxwPerChar,
      y: (row - 1) * pxhPerChar,
      width: width,
      height: height,
      draggable: true,
    });

    rectangle.on(`dragend`, e => {
      const { x, y } = e.target.attrs;
      console.log(x, y);
      const newCords = getNewSnapCords(x, y);
      e.target.to({
        x: newCords.x,
        y: newCords.y
      });
    })

    // add text to the label
    rectangle.add(new Konva.Text({
      text: text,
      fontSize: 14,
      fontFamily: `Consolas, "Liberation Mono", Menlo, Courier, monospace`,
      fill: 'green'
    }));

    // add cursor styling
    rectangle.on('mouseover', function () {
      document.body.style.cursor = 'pointer';
    });
    rectangle.on('mouseout', function () {
      document.body.style.cursor = 'default';
    });

    return rectangle;
  }

  var rectangleA = getLabelBox(1, 1, `12345678901234567890123456789012345678901234567890123456789012345678901234567890`);
  var rectangleB = getLabelBox(2, 1, `12345678901234567890123456789012345678901234567890123456789012345678901234567890`);

  layer.add(rectangleA);
  layer.add(rectangleB);
  stage.add(layer);
};