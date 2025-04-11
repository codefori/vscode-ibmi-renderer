/** 
 * @typedef {import('./dspf.d.ts').DisplayFile} DisplayFile
 * @typedef {import('./dspf.d.ts').RecordInfo} RecordInfo
 * @typedef {import('./dspf.d.ts').FieldInfo} FieldInfo
 */

const colors = {
  RED: `red`,
  BLU: `#4287f5`,
  WHT: `#FFFFFF`,
  GRN: `green`,
  TRQ: `turquoise`,
  YLW: `yellow`,
  PNK: `pink`,
  BLK: `black`,
};

const dateFormats = {
  '*MDY': `mm/dd/yyyy`,
  '*DMY': `dd/mm/yyyy`,
  '*YMD': `yyyy/mm/dd`,
  '*JUL': 'yy/ddd',
  '*ISO': 'yyyy-mm-dd',
  '*USA': 'mm/dd/yyyy',
  '*EUR': 'dd.mm.yyyy',
  '*JIS': 'yyyy-mm-dd',
};

const timeFormats = {
  '*HMS': 'hh:mm:ss',
  '*ISO': 'hh.mm.ss',
  '*USA': 'hh:mm am',
  '*EUR': 'hh.mm.ss',
  '*JIS': 'hh:mm:ss',
};

const vscode = acquireVsCodeApi();

const pxwPerChar = 8.45;
const pxhPerChar = 20;

function widthInP(x) {
  return x * pxwPerChar;
}

function heightInP(x) {
  return x * pxhPerChar;
}

/** @type {DisplayFile|undefined} */
let activeDocument = undefined;

/** @type {"dds.dspf"|undefined} */
let activeDocumentType = undefined;

/**
 * @param {DisplayFile} newDoc 
 * @param {"dds.dspf"} type //TODO: support dds.prtf
 */
function loadDDS(newDoc, type) {
  activeDocument = newDoc;
  activeDocumentType = type;

  const validFormats = activeDocument.formats.filter(format => format.name !== `GLOBAL`);

  setTabs(validFormats.map(format => format.name));

  const firstFormat = validFormats[0];
  if (firstFormat) {
    renderFormatByName(firstFormat.name);
  }
}

/**
 * @param {string} name 
 */
function renderFormatByName(name) {
  let renderWidth = 80;
  let renderHeight = 24;

  const selectedFormat = activeDocument.formats.find(currentFormat => currentFormat.name === name);

  if (!selectedFormat) {
    console.error(`Format ${name} not found`);
    return;
  }

  switch (activeDocumentType) {
    case `dds.dspf`:
      const globalFormat = activeDocument.formats.find(currentFormat => currentFormat.name === `GLOBAL`);

      if (globalFormat) {
        const displaySize = globalFormat.keywords.find(keyword => keyword.name === `DSPSIZ`);

        if (displaySize) {
          const parts = parseParms(displaySize.value);

          if (parts.length >= 2) {
            const [height, width] = parts;

            renderWidth = widthInP(Number(width));
            renderHeight = heightInP(Number(height));
          }
        }
      }
      break;
  }

  var width = renderWidth * pxwPerChar;
  var height = renderHeight * pxhPerChar;

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
    fill: colors.BLK
  });

  var layer = new Konva.Layer();
  layer.add(bg);

  renderSelectedFormat(layer, selectedFormat);
  stage.add(layer);
}

/**
 * 
 * @param {*} layer 
 * @param {RecordInfo} [format] 
 */
function renderSelectedFormat(layer, format) {
  // TODO: handle window
  // TODO: make format optional
  if (format) {
    addElementsToLayer(layer, format);
  }
}

/**
 * 
 * @param {*} layer 
 * @param {RecordInfo} format 
 */
function addElementsToLayer(layer, format) {
  const subfileFormat = format.keywords.find(keyword => keyword.name === `SFLCTL`);
  // TODO: handle when subFileFormat is found

  if (subfileFormat) {

  }

  const fields = format.fields.filter(field => field.displayType !== `hidden`);
  fields.forEach(field => {
    let canDisplay = true;

    field.conditions.forEach(cond => {
      // TODO: indicator support?
      // if (this.indicators[cond.indicator] !== (cond.negate ? false : true)) {
      //   canDisplay = false;
      // }
    });

    if (canDisplay) {
      const content = getElement(field);
      layer.add(content);
    }
  });
}

/**
 * @param {FieldInfo} fieldInfo 
 */
function getElement(fieldInfo) {
  const field = {
    x: widthInP((fieldInfo.position.x - 1)),
    y: heightInP((fieldInfo.position.y - 1)),
    width: -1,
    height: heightInP(1),
    value: ``,
    colour: colors.GRN,
  };

  const keywords = fieldInfo.keywords;

  keywords.forEach(keyword => {
    let canDisplay = true;

    // keyword.conditions.forEach(cond => {
    //   if (this.indicators[cond.indicator] !== (cond.negate ? false : true)) {
    //     canDisplay = false;
    //   }
    // })

    if (!canDisplay) { return; }

    const key = keyword.name;
    switch (key) {
      case `PAGNBR`:
        field.value = `####`;
        break;
      case `COLOR`:
        field.color = colors[keyword.value] || colors.GRN;
        break;
      case `SYSNAME`:
        field.value = `SYSNAME_`;
        break;
      case `USER`:
        field.value = `USERNAME__`;
        break;
      case `DATE`:
        const dateSep = keywords.find(keyword => keyword.name === `DATSEP`);

        const dateFormat = keywords.find(keyword => keyword.name === `DATFMT`);
        if (dateFormat) {
          field.value = dateFormats[dateFormat.value] || `?FORMAT?`;

          if (dateSep && dateSep.value.toUpperCase() !== `*JOB`) {
            field.value = field.value.replace(new RegExp(`[./-:]`, `g`), dateSep.value);
          }
        }
        break;
      case `TIME`:
        const sep = keywords.find(keyword => keyword.name === `TIMSEP`);

        const format = keywords.find(keyword => keyword.name === `TIMFMT`);
        if (format) {
          field.value = timeFormats[format.value] || `?FORMAT?`;

          if (sep && sep.value.toUpperCase() !== `*JOB`) {
            field.value = field.value.replace(new RegExp(`[./-:]`, `g`), sep.value);
          }
        }
        break;
      case `UNDERLINE`:
        // css += `text-decoration: underline;`;
        break;
      case `HIGHLIGHT`:
        // css += `font-weight: 900;`;
        break;
      case `DSPATR`:
        keyword.value.split(` `).forEach(value => {
          switch (value) {
            case `UL`:
              // css += `text-decoration: underline;`;
              break;
            case `HI`:
              // css += `font-weight: 900;`;
              // if (!keywords.find(keyword => keyword.name === `COLOR`)) {
              //   css += `color: ${colors.WHT};`;
              // }
              break;
            case `BL`:
              // css += `animation: blinker 1s step-start infinite;`;
              break;
          }
        });
        break;
    }
  });

  let padString = `-`;

  switch (field.type) {
    case `char`:
      switch (field.displayType) {
        case `input`: padString = `I`; break;
        case `output`: padString = `O`; break;
        case `both`: padString = `B`; break;
      }
      break;
    case `decimal`:
      switch (field.displayType) {
        case `input`: padString = `3`; break;
        case `output`: padString = `6`; break;
        case `both`: padString = `9`; break;
      }
      break;
  }

  const displayLength = fieldInfo.length > 0 && field.value.length < fieldInfo.length ? fieldInfo.length : field.value.length;
  const displayValue = field.value
    .replace(new RegExp(`''`, `g`), `'`)
    .padEnd(displayLength, padString);

  field.width = widthInP(displayLength);

  var rectangle = new Konva.Group(field);

  // add text to the label
  rectangle.add(new Konva.Text({
    text: displayValue,
    fontSize: 14,
    fontFamily: `Consolas, "Liberation Mono", Menlo, Courier, monospace`,
    fill: field.colour
  }));

  return rectangle;
}

function parseParms(string) {
  let items = [];
  let inString = false;
  let current = ``;

  for (let i = 0; i < string.length; i++) {
    switch (string[i]) {
      case `'`:
        inString = !inString;
        break;
      case ` `:
        if (inString) { current += string[i]; }
        else {
          items.push(current);
          current = ``;
        }
        break;
      default:
        current += string[i];
        break;
    }
  }

  if (current.trim().length > 0) {
    items.push(current.trim());
  }

  return items;
}

/**
 * @param {string[]} recordFormats 
 */
function setTabs(recordFormats) {
  const tabs = document.getElementById(`recordFormatTabs`);
  tabs.innerHTML = recordFormats.map(f => 
    `<vscode-tab-header name="${f}" slot="header">${f}</vscode-tab-header>`
  );
}


window.addEventListener("message", (event) => {
  const command = event.data.command;
  switch (command) {
    case `load`:
      loadDDS(event.data.dds, `dds.dspf`);
      break;
  }
});


window.onload = () => {
  const tabs = document.getElementById(`recordFormatTabs`);

  tabs.addEventListener(`vsc-tabs-select`, (event) => {
    console.log(event.detail.selectedIndex);

    const selectedFormat = activeDocument && activeDocument.formats[event.detail.selectedIndex+1];

    if (selectedFormat) {
      renderFormatByName(selectedFormat.name);
    }
  });
};