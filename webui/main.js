/** 
 * @typedef {import('./dspf.d.ts').DisplayFile} DisplayFile
 * @typedef {import('./dspf.d.ts').RecordInfo} RecordInfo
 * @typedef {import('./dspf.d.ts').FieldInfo} FieldInfo
 * @typedef {import('./dspf.d.ts').Keyword} Keyword
 */

const colours = {
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

let existingStage = undefined;

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
    setWindowForFormat(chosenFormat);
  }
}

/**
 * @param {string} chosenFormat 
 */
function setWindowForFormat(chosenFormat) {
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

  if (existingStage) {
    existingStage.destroy();
  }

  existingStage = new Konva.Stage({
    container: 'container',
    width: width,
    height: height
  });

  const bg = new Konva.Rect({
    x: 0,
    y: 0,
    width: width,
    height: height,
    fill: colours.BLK
  });

  var layer = new Konva.Layer({
    id: selectedFormat.name
  });
  layer.add(bg);

  renderSelectedFormat(layer, selectedFormat);
  existingStage.add(layer);

  updateRecordFormatSidebar(selectedFormat);
  setActiveField();
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
            const content = getElement(subField, true);
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

function renderSpecificField(fieldInfo) {
  const existingField = existingStage.findOne(`#${fieldInfo.name}`);

  if (existingField) {
    existingField.destroy();
  }

  const formatLayer = existingStage.findOne(`#${lastSelectedFormat}`);

  if (formatLayer) {
    const content = getElement(fieldInfo);
    formatLayer.add(content);
  }
}

/**
 * @param {FieldInfo} fieldInfo 
 */
function getElement(fieldInfo, displayOnly = false) {
  const boxInfo = {
    id: fieldInfo.name,
    x: widthInP(fieldInfo.position.x - 1),
    y: heightInP(fieldInfo.position.y - 1),
    width: 0,
    height: heightInP(1),
  };

  const labelInfo = {
    value: fieldInfo.value || ``,
    colour: colours.GRN,
    fontStyle: `normal`,
    textDecoration: ``
  };

  const keywords = fieldInfo.keywords;

  keywords.forEach(keyword => {
    const key = keyword.name;
    switch (key) {
      case `PAGNBR`:
        labelInfo.value = `####`;
        break;
      case `COLOR`:
        labelInfo.colour = colours[keyword.value] || colours.GRN;
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
        labelInfo.textDecoration = `underline`;
        break;
      case `HIGHLIGHT`:
        // css += `font-weight: 900;`;
        labelInfo.fontStyle = `900`;
        break;
      case `DSPATR`:
        keyword.value.split(` `).forEach(value => {
          switch (value) {
            case `UL`:
              // css += `text-decoration: underline;`;
              labelInfo.textDecoration = `underline`;
              break;
            case `HI`:
              // css += `font-weight: 900;`;
              // if (!keywords.find(keyword => keyword.name === `COLOR`)) {
              //   css += `color: ${colors.WHT};`;
              // }
              labelInfo.fontStyle = `900`;
              labelInfo.colour = colours.WHT;
              break;
            case `BL`:
              // Can Konva do a blinking effect?
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
    fill: colours.BLK,
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

  if (!displayOnly) {
    group.on('pointerclick', () => {
      setActiveField(group, fieldInfo);
    });
  }

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
      setWindowForFormat(selectedFormat.name);
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

    if (bg) {
      bg.fill(colours.BLK);
    }

    lastActiveKonvaElement = undefined;
  }

  if (konvaElement && fieldInfo) {
    lastActiveKonvaElement = konvaElement;

    const bg = lastActiveKonvaElement.findOne(`#bg`);
    bg.fill(colours.BLU);

    updateSelectedFieldSidebar(fieldInfo);
  } else {
    clearFieldInfo();
  }
}

/**
 * 
 * @param {RecordInfo} recordInfo
 */
function updateRecordFormatSidebar(recordInfo) {
  const sidebar = document.getElementById(`recordFormatSidebar`);

  /** @type {{title: string, html: string, open?: boolean}[]} */
  let sections = [];

  const keywordRows = recordInfo.keywords.map(keyword => {
    return `<vscode-table-row><vscode-table-cell>${keyword.name}</vscode-table-cell><vscode-table-cell>${keyword.value ? `<code>${keyword.value}</code>` : ``}</vscode-table-cell></vscode-table-row>`;
  }).join(``);

  sections.push({
    title: `Keywords`,
    html: `<vscode-table><vscode-table-body slot="body">${keywordRows}</vscode-table-body></vscode-table>`,
    open: true
  });

  sidebar.innerHTML = sections.map(section => {
    return `<vscode-collapsible title="${section.title}" ${section.open ? `open` : ``}>${section.html}</vscode-collapsible>`;
  }).join(``);
}

function clearFieldInfo() {
  const sidebar = document.getElementById(`fieldInfoSidebar`);
  sidebar.style.display = `none`;
}

/**
 * 
 * @param {FieldInfo} fieldInfo 
 */
function updateSelectedFieldSidebar(fieldInfo) {
  const sidebar = document.getElementById(`fieldInfoSidebar`);

  /** @type {{title: string, html: string, open?: boolean}[]} */
  let sections = [];

  /** @type {{name: string, value: string, editableId?: string}[]} */
  const properties = [];

  if (fieldInfo.name) {
    properties.push({ name: `Name`, value: fieldInfo.name });
  }

  properties.push(
    { name: `Display Type`, value: fieldInfo.displayType },
    { name: `Position`, value: `${fieldInfo.position.x}, ${fieldInfo.position.y}` },
  );

  if (fieldInfo.value !== undefined) {
    properties.push({ name: `Value`, value: fieldInfo.value, editableId: `value` });
  }

  if (fieldInfo.type) {
    properties.push(
      { name: `Type`, value: fieldInfo.type },
      { name: `Length`, value: fieldInfo.length, editableId: `length` },
    );
  }

  const propertyRows = properties.map(property => {
    return `<vscode-table-row><vscode-table-cell>${property.name}</vscode-table-cell><vscode-table-cell ${property.editableId ? `id="field-${property.editableId}" contenteditable="true"` : ``}>${property.value}</vscode-table-cell></vscode-table-row>`;
  }).join(``);

  const keywordRows = fieldInfo.keywords.map(keyword => {
    return `<vscode-table-row><vscode-table-cell>${keyword.name}</vscode-table-cell><vscode-table-cell>${keyword.value ? `<code id="field-keyword-${keyword.name}" contenteditable="true">${keyword.value}</code>` : ``}</vscode-table-cell></vscode-table-row>`;
  }).join(``);

  sections.push(
    {
      title: `Properties`,
      html: `<vscode-table><vscode-table-body slot="body">${propertyRows}</vscode-table-body></vscode-table>`,
      open: true
    },
    {
      title: `Keywords`,
      html: `<vscode-table><vscode-table-body slot="body">${keywordRows}</vscode-table-body></vscode-table>`,
      open: true
    }
  );

  sidebar.innerHTML = sections.map(section => {
    return `<vscode-collapsible title="${section.title}" ${section.open ? `open` : ``}>${section.html}</vscode-collapsible>`;
  }).join(``);

  // create button
  const button = document.createElement(`vscode-button`);
  button.fieldInfo = JSON.parse(JSON.stringify(fieldInfo));
  button.innerText = `Update`;
  
  // Center the button
  button.style.margin = `1em`;
  button.style.display = `block`;

  button.addEventListener(`click`, (e) => {
    /** @type {FieldInfo} */
    const previousField = e.target.fieldInfo;

    const fields = sidebar.querySelectorAll(`[contenteditable]`);

    /** @type {{[key: string]: string, keywords: Keyword[]}}} */
    const newDetail = {mainProps: {}, keywords: []};

    // First let's grab all the fields from the UI

    fields.forEach(field => {
      const id = field.id;
      const value = field.innerText;

      if (id.startsWith(`field-keyword-`)) {
        const prop = id.substring(`field-keyword-`.length);
        
        newDetail.keywords.push({
          name: prop,
          value: value,
          conditions: [] // TODO, pick up old conditions
        });

      } else if (id.startsWith(`field-`)) {
        const keyword = id.substring(`field-`.length);
        newDetail.mainProps[keyword] = value;
      }
    });

    // Then update and send the changes to the backend

    const originalName = previousField.name;

    for (const valueKey in newDetail.mainProps) {
      const value = newDetail.mainProps[valueKey];

      previousField[valueKey] = value;
    }

    for (const propKey in newDetail.keywords) {
      const propValue = newDetail.keywords[propKey];

      const keyword = previousField.keywords.find(keyword => keyword.name === propKey);
      if (keyword) {
        keyword.value = propValue;
      }
    }

    sendFieldUpdate(lastSelectedFormat, originalName, previousField);
  });
  
  sidebar.appendChild(button);

  sidebar.style.display = `block`;
}

/**
 * @param {string} recordFormat 
 * @param {string} originalFieldName 
 * @param {FieldInfo} finewFieldldInfo 
 */
function sendFieldUpdate(recordFormat, originalFieldName, finewFieldldInfo) {
  vscode.postMessage({
    command: `updateField`,
    recordFormat,
    originalFieldName,
    fieldInfo: finewFieldldInfo
  });

  const currentFormat = activeDocument.formats.find(format => format.name === recordFormat);
  if (currentFormat) {
    const field = currentFormat.fields.find(field => field.name === originalFieldName);
    for (const propKey in finewFieldldInfo) {
      const propValue = finewFieldldInfo[propKey];

      field[propKey] = propValue;
    }
  }

  renderSpecificField(finewFieldldInfo);
}