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
const pxhPerLine = 20;
const pxhPerChar = 12.5;

function widthInP(x) {
  return x * pxwPerChar;
}

function heightInP(x) {
  return x * pxhPerLine;
}

/** @type {DisplayFile|undefined} */
let activeDocument = undefined;

/** @type {"dds.dspf"|undefined} */
let activeDocumentType = undefined;

/** @type {string|undefined} */
let lastSelectedFormat = undefined;

/**
 * @param {DisplayFile} newDoc 
 * @param {"dds.dspf"} type //TODO: support dds.prtf
 */
function loadDDS(newDoc, type) {
  activeDocument = newDoc;
  activeDocumentType = type;

  const validFormats = activeDocument.formats.filter(format => format.name !== `GLOBAL`);

  setTabs(validFormats.map(format => format.name), lastSelectedFormat);

  const chosenFormat = lastSelectedFormat || (validFormats[0] ? validFormats[0].name : undefined);
  if (chosenFormat) {
    renderWindow(chosenFormat);
  }
}

/**
 * @param {string} chosenFormat 
 */
function renderWindow(chosenFormat) {
  let renderWidth = 80;
  let renderHeight = 24;

  const selectedFormat = activeDocument.formats.find(currentFormat => currentFormat.name === chosenFormat);

  if (!selectedFormat) {
    console.error(`Format ${chosenFormat} not found`);
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
  var height = renderHeight * pxhPerLine;

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
  lastSelectedFormat = format.name;
  // TODO: handle window
  // TODO: make format optional
  if (format) {
    addFieldsToLayer(layer, format);
  }
}

/**
 * 
 * @param {*} layer 
 * @param {RecordInfo} format 
 */
function addFieldsToLayer(layer, format) {
  const subfileFormat = format.keywords.find(keyword => keyword.name === `SFLCTL`);
  // TODO: handle when subFileFormat is found

  if (subfileFormat) {
    const subfilePage = format.keywords.find(keyword => keyword.name === `SFLPAG`)
    const rows = Number(subfilePage ? subfilePage.value : 1);

    const subfileRecord = activeDocument.formats.find(format => format.name === subfileFormat.value);

    if (subfileRecord) {
      const subfileFields = subfileRecord.fields.filter(field => field.displayType !== `hidden`);
      
      const low = Math.min(...subfileFields.map(field => field.position.y));
      const high = Math.max(...subfileFields.map(field => field.position.y));
      const linesPerItem = (high - low) + 1;
      
      for (let row = 0; row < rows; row++) {
        subfileFields.forEach(field => {
          // TODO: these fields cant be edited in this format
          let subField = JSON.parse(JSON.stringify(field));
          subField.position.y += (row * linesPerItem);
          let canDisplay = true;

          // field.conditions.forEach(cond => {
          //   if (this.indicators[cond.indicator] !== (cond.negate ? false : true)) {
          //     canDisplay = false;
          //   }
          // });
          
          if (canDisplay) {
            subField.name = `${field.name}_${row}`;
            const content = getElement(subField);
            layer.add(content);
          }
        });
      }


    } else {
      throw new Error(`Unable to find SFLCTL format ${subfileFormat} from ${recordFormat}`);
    }
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
  const boxInfo = {
    x: widthInP(fieldInfo.position.x - 1),
    y: heightInP(fieldInfo.position.y - 1),
    width: 0,
    height: heightInP(1),
  };
  const labelInfo = {
    value: fieldInfo.value || ``,
    colour: colors.GRN
  };

  const keywords = fieldInfo.keywords;

  keywords.forEach(keyword => {
    const key = keyword.name;
    switch (key) {
      case `PAGNBR`:
        labelInfo.value = `####`;
        break;
      case `COLOR`:
        labelInfo.color = colors[keyword.value] || colors.GRN;
        break;
      case `SYSNAME`:
        labelInfo.value = `SYSNAME_`;
        break;
      case `USER`:
        labelInfo.value = `USERNAME__`;
        break;
      case `DATE`:
        const dateSep = keywords.find(keyword => keyword.name === `DATSEP`);

        const dateFormat = keywords.find(keyword => keyword.name === `DATFMT`);
        if (dateFormat) {
          labelInfo.value = dateFormats[dateFormat.value] || `?FORMAT?`;

          if (dateSep && dateSep.value.toUpperCase() !== `*JOB`) {
            labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), dateSep.value);
          }
        }
        break;
      case `TIME`:
        const sep = keywords.find(keyword => keyword.name === `TIMSEP`);

        const format = keywords.find(keyword => keyword.name === `TIMFMT`);
        if (format) {
          labelInfo.value = timeFormats[format.value] || `?FORMAT?`;

          if (sep && sep.value.toUpperCase() !== `*JOB`) {
            labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), sep.value);
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

  switch (fieldInfo.type) {
    case `char`:
      switch (fieldInfo.displayType) {
        case `input`: padString = `I`; break;
        case `output`: padString = `O`; break;
        case `both`: padString = `B`; break;
      }
      break;
    case `decimal`:
      switch (fieldInfo.displayType) {
        case `input`: padString = `3`; break;
        case `output`: padString = `6`; break;
        case `both`: padString = `9`; break;
      }
      break;
  }

  const displayLength = fieldInfo.length > 0 && labelInfo.value.length < fieldInfo.length ? fieldInfo.length : labelInfo.value.length;
  const displayValue = labelInfo.value
    .replace(new RegExp(`''`, `g`), `'`)
    .padEnd(displayLength, padString);

  boxInfo.width = widthInP(displayLength);
  labelInfo.width = widthInP(displayLength);

  var group = new Konva.Group(boxInfo);

  group.add(new Konva.Rect({
    id: `bg`,
    fill: colors.BLK,
    x: 0,
    y: 0,
    width: boxInfo.width,
    height: pxhPerChar,
  }));

  // add text to the label
  group.add(new Konva.Text({
    text: displayValue,
    fontSize: 14,
    fontFamily: `Consolas, "Liberation Mono", Menlo, Courier, monospace`,
    fill: labelInfo.colour
  }));

  group.on('pointerclick', () => {
    setActiveField(group, fieldInfo);
  });

  return group;
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
function setTabs(recordFormats, setActiveTab) {
  // Defined like: <vscode-tabs id="recordFormatTabs" selected-index="0" fixed-pane="start">
  const tabs = document.getElementById(`recordFormatTabs`);
  tabs.innerHTML = recordFormats.map(f => 
    `<vscode-tab-header name="${f}" slot="header">${f}</vscode-tab-header>`
  ).join(``);

  if (setActiveTab) {
    tabs.setAttribute(`selected-index`, recordFormats.indexOf(setActiveTab));
  }
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
      renderWindow(selectedFormat.name);
    }
  });
};

let lastActiveKonvaElement;

/**
 * 
 * @param {*} [konvaElement] 
 * @param {FieldInfo} [fieldInfo] 
 */
function setActiveField(konvaElement, fieldInfo) {
  if (lastActiveKonvaElement) {
    const bg = lastActiveKonvaElement.findOne(`#bg`);
    // Remove background from last active element
    bg.fill(colors.BLK);
  }

  if (konvaElement) {
    lastActiveKonvaElement = konvaElement;

    const bg = lastActiveKonvaElement.findOne(`#bg`);
    bg.fill(colors.BLU);
  }
}