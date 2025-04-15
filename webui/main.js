/** 
 * @typedef {import('./dspf.d.ts').DisplayFile} DisplayFile
 * @typedef {import('./dspf.d.ts').RecordInfo} RecordInfo
 * @typedef {import('./dspf.d.ts').FieldInfo} FieldInfo
 * @typedef {import('./dspf.d.ts').Keyword} Keyword
 * @typedef {import("konva").default.Rect} Rect
 * @typedef {import("konva").default.Stage} Stage
 * @typedef {import("konva").default.Group} Group
 * @typedef {import("konva").default.Layer} Layer
 * @typedef {{label: string, id?: string, value: string}} Property 
 * @typedef {{[key: string]: string}} NewProperties
 * @typedef {{title: string, html: string|Element, open?: boolean}} Section
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

const SELECTED_COLOUR = `#383838`;

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

function snapToFixedGrid(x, y) {
  const newX = Math.round(x / pxwPerChar) * pxwPerChar;
  const newY = Math.round(y / pxhPerLine) * pxhPerLine;
  return {x: newX, y: newY};
}

function gridCordsToFieldCords(x, y) {
  return {
    x: Math.round(x / pxwPerChar) + 1,
    y: Math.round(y / pxhPerLine) + 1
  };
}

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

/** @type {Stage|undefined} */
let existingStage = undefined;

/**
 * @param {DisplayFile} newDoc 
 * @param {"dds.dspf"} type //TODO: support dds.prtf
 */
function loadDDS(newDoc, type, withRerender = true) {
  activeDocument = newDoc;
  activeDocumentType = type;

  if (withRerender) {
    const validFormats = activeDocument.formats.filter(format => format.name !== `GLOBAL`);

    setTabs(validFormats.map(format => format.name), lastSelectedFormat);

    const chosenFormat = lastSelectedFormat || (validFormats[0] ? validFormats[0].name : undefined);
    if (chosenFormat) {
      setWindowForFormat(chosenFormat);
    }
  }
}

/**
 * @param {string} chosenFormat 
 */
function setWindowForFormat(chosenFormat) {
  let renderWidth = 80;
  let renderHeight = 24;

  const globalFormat = activeDocument.formats.find(currentFormat => currentFormat.name === `GLOBAL`);
  const selectedFormat = activeDocument.formats.find(currentFormat => currentFormat.name === chosenFormat);

  if (!selectedFormat) {
    console.error(`Format ${chosenFormat} not found`);
    return;
  }

  switch (activeDocumentType) {
    case `dds.dspf`:
      if (globalFormat) {
        const displaySize = globalFormat.keywords.find(keyword => keyword.name === `DSPSIZ`);

        if (displaySize) {
          const parts = parseParms(displaySize.value);

          if (parts.length >= 2) {
            const [height, width] = parts;

            renderWidth = widthInP(Number(width));
            renderHeight = heightInP(Number(height));
          } else if (parts.length === 1) {
            switch (parts[0].toUpperCase()) {
              case '*DS4':
                renderWidth = 132;
                renderHeight = 27;
                break;
            }
          }
        }
      }
      break;
  }

  let width = renderWidth * pxwPerChar;
  let height = renderHeight * pxhPerLine;

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

  bg.on('pointerclick', () => {
    setActiveField();
  });

  let layer = new Konva.Layer({
    id: selectedFormat.name
  });

  layer.add(bg);

  renderSelectedFormat(layer, selectedFormat);
  existingStage.add(layer);

  updateRecordFormatSidebar(selectedFormat, globalFormat);
  setActiveField();
}

/**
 * 
 * @param {Layer} layer 
 * @param {RecordInfo} [format] 
 */
function renderSelectedFormat(layer, format) {
  lastSelectedFormat = format.name;

  /** @type {RecordInfo|undefined} */
  let windowFormat;

  /** @type {{baseX: number, baseY: number, baseWidth: number, baseHeight: number, x: number, y: number, width: number, height: number, color?: string}|undefined} */
  let windowConfig;

  /** @type {FieldInfo|undefined} */
  let windowTitle;

  /** @type {RecordInfo} */
  let recordFormat;
  if (format) {
    recordFormat = activeDocument.formats.find(currentFormat => currentFormat.name === lastSelectedFormat);
  }

  if (recordFormat) {
    if (recordFormat.isWindow) {
      if (recordFormat.windowReference) {
        windowFormat = activeDocument.formats.find(currentFormat => currentFormat.name === recordFormat.windowReference);
      } else {
        windowFormat = recordFormat;
      }

      const { x, y, width, height } = windowFormat.windowSize;
      windowConfig = {
        baseX: x,
        baseY: y,
        baseWidth: width,
        baseHeight: height, 
        x: widthInP(x),
        y: heightInP(y),
        width: widthInP(width),
        height: heightInP(height-1)
      };

      const borderInfo = windowFormat.keywords.find(keyword => keyword.name === `WDWBORDER`);
      if (borderInfo) {
        parts = parseParms(borderInfo.value);

        parts.forEach((part, index) => {
          switch (part.toUpperCase()) {
          case `*COLOR`:
            windowConfig.color = parts[index + 1];
            break;
          }
        });
      }

      const windowInfo = windowFormat.keywords.find(keyword => keyword.name === `WDWTITLE`);
      if (windowInfo) {
        windowTitle = {
          name: `WINDOWTITLE`,
          displayType: `const`,
          type: `A`,
          primitiveType: `char`
        };

        let xPositionValue = `center`;
        let yPositionValue = `top`;

        parts = Render.parseParms(windowInfo.value);

        parts.forEach((part, index) => {
          switch (part.toUpperCase()) {
          case `*TEXT`:
            windowTitle.value = parts[index + 1];
            break;
          case `*COLOR`:
            windowTitle.keywords.push({
              name: `COLOR`,
              value: parts[index + 1],
              conditions: []
            });
          case `*DSPATR`:
            windowTitle.keywords.push({
              name: `DSPATR`,
              value: parts[index + 1],
              conditions: []
            });
            break;

          case `*CENTER`:
          case `*LEFT`:
          case `*RIGHT`:
            xPositionValue = part.substring(1).toLowerCase();
            break;

          case `*TOP`:
          case `*BOTTOM`:
            yPositionValue = part.substring(1).toLowerCase();
            break;
          }
        });

        // If no color is found, the default is blue.
        if (!windowTitle.keywords.find(keyword => keyword.name === `COLOR`)) {
          windowTitle.keywords.push({
            name: `COLOR`,
            value: `BLU`,
            conditions: []
          });
        }

        const txtLength = windowTitle.value.length;

        const yPosition = (windowConfig.baseY) + (yPositionValue === `top` ? 0 : windowConfig.baseHeight);
        let xPosition = (windowConfig.baseX + 1);

        switch (xPositionValue) {
        case `center`:
          xPosition = (windowConfig.baseX + 1) + Math.floor((windowConfig.baseWidth / 2) - (txtLength / 2));
          break;
        case `right`:
          xPosition = (windowConfig.baseX + 1) + windowConfig.baseWidth - txtLength;
          break;
        case `left`:
          xPosition = (windowConfig.baseX + 1);
          break;
        }

        windowTitle.position = {
          x: xPosition,
          y: yPosition
        };
      }
    }
  }

  if (windowFormat) {
    // If this is a window, add the window CSS
      if (windowConfig) {
        const windowColor = colors[windowConfig.color] || colors.BLU;

        /** @type {Rect} */
        const windowRect = new Konva.Rect({
          id: windowFormat.name,
          x: windowConfig.x,
          y: windowConfig.y,
          width: windowConfig.width,
          height: windowConfig.height,
          stroke: windowColor,
        });

        layer.add(windowRect);
      }

      if (windowTitle) {
        console.log(`TODO: add window title: ${windowFormat}`);
        // const windowContent = this.getContent(windowTitle);

        // css += windowContent.css;
        // body += windowContent.body;
      }

      if (windowFormat.name !== format.name) {
        renderSelectedFormat(layer, windowFormat);
      }
    }

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
      const subfileFields = subfileRecord.fields.filter(field => field.displayType !== `hidden` && field.position.x > 0 && field.position.y > 0);
      
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

/**
 * 
 * @param {FieldInfo} fieldInfo 
 * @returns {Konva.Group|undefined}
 */
function renderSpecificField(fieldInfo) {
  const existingField = existingStage.findOne(`#${fieldInfo.name}`);

  if (existingField) {
    existingField.destroy();
  }

  const formatLayer = existingStage.findOne(`#${lastSelectedFormat}`);

  if (formatLayer) {
    const content = getElement(fieldInfo);
    formatLayer.add(content);

    return content;
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
    draggable: !displayOnly,
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

  let padString = `_`;

  switch (fieldInfo.primitiveType) {
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

  let group = new Konva.Group(boxInfo);

  group.on('dragmove', (e) => {
    /** @type {Group} */
    const cGroup = e.target;

    /** @type {Stage} */
    const stage = e.target.getStage();
    const mousePos = stage.getPointerPosition();
    
    let {x, y} = mousePos;

    const boxPos = cGroup.absolutePosition();
    
    // Mouse pos inside the group
    x -= (x - boxPos.x);
    y -= (y - boxPos.y);

    const newCords = snapToFixedGrid(x, y);

    cGroup.absolutePosition({
      x: newCords.x,
      y: newCords.y
    });
  });

  group.on(`dragend`, e => {
    // const {x, y} = e.target.attrs;
    // get mouse x,y
    /** @type {Group} */
    const cGroup = e.target;
    const stage = cGroup.getStage();
    const mousePos = stage.getPointerPosition();
    
    let {x, y} = mousePos;
    const boxPos = cGroup.absolutePosition();
    
    // Mouse pos inside the group
    x -= (x - boxPos.x);
    y -= (y - boxPos.y);

    const newCords = snapToFixedGrid(x, y);
    
    cGroup.absolutePosition({
      x: newCords.x,
      y: newCords.y
    });

    const fieldCords = gridCordsToFieldCords(newCords.x, newCords.y);
    fieldInfo.position.x = fieldCords.x;
    fieldInfo.position.y = fieldCords.y;

    sendFieldUpdate(lastSelectedFormat, fieldInfo.name, fieldInfo);
  });

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
    fill: labelInfo.colour,
    fontStyle: labelInfo.fontStyle,
    textDecoration: labelInfo.textDecoration,
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
    case 'update':
      loadDDS(event.data.dds, `dds.dspf`, false);
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

/** @type {Rect|undefined} */
let lastActiveKonvaElement;

/**
 * 
 * @param {*} [konvaElement] 
 * @param {FieldInfo} [fieldInfo] 
 */
function setActiveField(konvaElement, fieldInfo) {
  clearKeywordEditor();

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
    bg.fill(SELECTED_COLOUR);

    updateSelectedFieldSidebar(fieldInfo);
  } else {
    clearFieldInfo();
  }
}

/**
 * @param {RecordInfo} recordInfo
 * @param {RecordInfo} [globalInfo]
 */
function updateRecordFormatSidebar(recordInfo, globalInfo) {
  const sidebar = document.getElementById(`recordFormatSidebar`);

  /** @type {Section[]} */
  let sections = [];

  // TODO: support updating record formats

  if (globalInfo) {
    sections.push({
      title: `File Keywords`,
      html: createKeywordPanel(`keywords-${globalInfo.name}`, globalInfo.keywords),
      open: true
    });
  }

  sections.push({
    title: `Format Keywords`,
    html: createKeywordPanel(`keywords-${recordInfo.name}`, recordInfo.keywords),
    open: true
  });

  renderSections(sidebar, sections);
}

function clearFieldInfo() {
  const sidebar = document.getElementById(`fieldInfoSidebar`);
  sidebar.innerHTML = ``;

  /**
   * @param {string} label 
   * @param {string} icon 
   * @param {FieldInfo} field 
   */
  const createButton = (label, icon, field) => {
    const button = document.createElement(`vscode-button`);
    button.setAttribute(`secondary`, `true`);
    button.setAttribute(`icon`, icon);
    button.style.margin = `1em`;
    button.style.display = `block`;
    button.style.textAlign = `right`;
    button.innerText = label;
    sidebar.appendChild(button);

    button.onclick = () => {
      if (lastSelectedFormat) {
        sendNewField(lastSelectedFormat, field);
      }
    };

    return button;
  }

  // Creates: <vscode-button secondary>Secondary button</vscode-button>
  
  sidebar.appendChild(createButton(`Named field`, `add`));
  sidebar.appendChild(createButton(`Date field`, `calendar`));
  sidebar.appendChild(createButton(`Time field`, `calendar`));
  sidebar.appendChild(createButton(`Timestamp field`, `calendar`));

  sidebar.appendChild(createButton(`Constant text`, `symbol-constant`, {
    value: `Constant`,
    position: {x: 1, y: 1},
    displayType: `const`,
    keywords: [],
  }));
  sidebar.appendChild(createButton(`System name constant`, `account`));
  sidebar.appendChild(createButton(`Date constant`, `calendar`));
  sidebar.appendChild(createButton(`Time constant`, `calendar`));
}

/**
 * 
 * @param {FieldInfo} fieldInfo 
 */
function updateSelectedFieldSidebar(fieldInfo) {
  const sidebar = document.getElementById(`fieldInfoSidebar`);

  /** @type {Section[]} */
  let sections = [];

  /** @type {Property[]} */
  const properties = [];

  if (fieldInfo.name) {
    properties.push({ label: `Name`, value: fieldInfo.name });
  }

  properties.push(
    { label: `Display Type`, value: fieldInfo.displayType },
    { label: `Position`, value: `${fieldInfo.position.x}, ${fieldInfo.position.y}` },
  );

  if (fieldInfo.displayType === `const`) {
    properties.push({ label: `Value`, value: fieldInfo.value, id: `value` });
  }

  if (fieldInfo.type) {
    properties.push(
      { label: `Type`, value: fieldInfo.type },
      { label: `Length`, value: fieldInfo.length, id: `length` },
    );

    if (fieldInfo.type !== `A`) {
      properties.push({ label: `Decimals`, value: fieldInfo.decimals, id: `decimals` });
    }
  }

  sections.push(
    {
      title: `Properties`,
      open: true,
      // TODO: swap this to createKeywordPanel
      html: createValuesPanel(`properties-${fieldInfo.name}`, properties, (newProps) => {
        fieldInfo = {
          ...fieldInfo,
          ...newProps
        };

        sendFieldUpdate(lastSelectedFormat, fieldInfo.name, fieldInfo);
      })
    },
    {
      title: `Keywords`,
      open: Object.keys(fieldInfo.keywords).length > 0,
      html: createKeywordPanel(`keywords-${fieldInfo.name}`, fieldInfo.keywords, (keywords) => {
        fieldInfo.keywords = keywords;
        sendFieldUpdate(lastSelectedFormat, fieldInfo.name, fieldInfo);
      }),
    }
  );

  renderSections(sidebar, sections);

  const deleteButton = document.createElement(`vscode-button`);
  deleteButton.setAttribute(`secondary`, `true`);
  deleteButton.innerText = `Delete`;
  
  // Center the button
  deleteButton.style.margin = `1em`;
  deleteButton.style.display = `block`;

  deleteButton.addEventListener(`click`, (e) => {
    if (fieldInfo.name) {
      sendDelete(lastSelectedFormat, fieldInfo.name);
    }
  });

  sidebar.appendChild(deleteButton);
}

/**
 * 
 * @param {HTMLElement} sidebar 
 * @param {Section[]} sections 
 */
function renderSections(sidebar, sections) {
  sidebar.innerHTML = ``;

  for (let section of sections) {
    let newSection = document.createElement(`vscode-collapsible`);
    newSection.setAttribute(`title`, section.title);
    if (section.open) {
      newSection.setAttribute(`open`, ``);
    }

    if (typeof section.html === `string`) {
      newSection.innerHTML = section.html;
    } else {
      newSection.appendChild(section.html);
    }

    sidebar.appendChild(newSection);
  }
}

/**
 * @param {string} recordFormat 
 * @param {FieldInfo} fieldInfo 
 */
function sendNewField(recordFormat, fieldInfo) {
  vscode.postMessage({
    command: `newField`,
    recordFormat,
    fieldInfo
  });
}

function sendDelete(recordFormat, fieldName) {
  vscode.postMessage({
    command: `deleteField`,
    recordFormat,
    fieldName
  });
}

/**
 * @param {string} recordFormat 
 * @param {string} originalFieldName 
 * @param {FieldInfo} newFieldInfo 
 */
function sendFieldUpdate(recordFormat, originalFieldName, newFieldInfo) {
  vscode.postMessage({
    command: `updateField`,
    recordFormat,
    originalFieldName,
    fieldInfo: newFieldInfo
  });

  // const currentFormat = activeDocument.formats.find(format => format.name === recordFormat);
  // if (currentFormat) {
  //   const field = currentFormat.fields.find(field => field.name === originalFieldName);
  //   for (const propKey in newFieldInfo) {
  //     const propValue = newFieldInfo[propKey];

  //     field[propKey] = propValue;
  //   }
  // }

  const newGroup = renderSpecificField(newFieldInfo);

  if (newGroup) {
    setActiveField(newGroup, newFieldInfo);
  }
}

/**
 * Used to create panels for editable key/value lists.
 * @param {string} id
 * @param {Keyword[]} inputKeywords 
 * @param {(keywords: Keyword[]) => void} [onUpdate]
 */
function createKeywordPanel(id, inputKeywords, onUpdate) {
  /** @type {Keyword[]} */
  const keywords = JSON.parse(JSON.stringify(inputKeywords));

  const section = document.createElement(`div`);
  section.id = id;

  const tree = document.createElement(`vscode-tree`);
  tree.id = id;

  const actions = onUpdate ? [
    {
      icon: "edit",
      actionId: "edit",
      tooltip: "Edit",
    },
    {
      icon: "trash",
      actionId: "delete",
      tooltip: "Delete",
    },
  ] : [];

  const icons = {
    branch: 'folder',
    leaf: 'circle-filled',
    open: 'folder-opened',
  };

  const rerenderTree = () => {
    tree.data = keywords.map((keyword, index) => {
      return {
        icons,
        label: keyword.name,
        value: keyword,
        description: keyword.value,
        actions,
        subItems: keyword.conditions.map(c => ({
          label: String(c.indicator),
          description: c.negate ? `Negated` : undefined,
          icons
        })),
      };
    });
  };

  rerenderTree();

  tree.addEventListener('vsc-run-action', (event) => {
    console.log(event.detail);
    /** @type {Keyword} */
    const currentKeyword = event.detail.value;
    const oldKeywordIndex = keywords.findIndex(k => k.name === currentKeyword.name && k.value === currentKeyword.value);

    switch (event.detail.actionId) {
      case `delete`:
        if (oldKeywordIndex >= 0) {
          keywords.splice(oldKeywordIndex, 1);
        }
        rerenderTree();
        break;

      case `edit`:
        editKeyword((newKeyword) => {
          if (oldKeywordIndex >= 0) {
            keywords[oldKeywordIndex] = newKeyword;
          } else {
            keywords.push(newKeyword);
          }

          clearKeywordEditor();
          rerenderTree();
        }, event.detail.value);
        break;
    }
  });

  section.appendChild(tree);

  if (onUpdate) {
    const newKeyword = document.createElement(`vscode-button`);
    newKeyword.setAttribute(`icon`, `add`);
  
    newKeyword.innerText = `New Keyword`;
    newKeyword.style.margin = `1em`;
    newKeyword.style.display = `block`;
    
    newKeyword.addEventListener(`click`, (e) => {
      editKeyword((newKeyword) => {
        keywords.push(newKeyword);
        clearKeywordEditor();
        rerenderTree();
      });
    });

    const updateButton = document.createElement(`vscode-button`);
    updateButton.innerText = `Update`;
    
    // Center the button
    updateButton.style.margin = `1em`;
    updateButton.style.display = `block`;

    updateButton.addEventListener(`click`, (e) => {
      // As we update keywords, the `keywords` variable is updated
      onUpdate(keywords);
    });

    section.appendChild(newKeyword);
    section.appendChild(updateButton);
  }

  return section;
}

/**
 * Used to create a panel for editable properties.
 * Properties with the `id` property are editable.
 * @param {string} id 
 * @param {Property[]} properties 
 * @param {(newProps: NewProperties) => {}} onUpdate 
 */
function createValuesPanel(id, properties, onUpdate) {
  const section = document.createElement(`div`);
  section.id = id;

  const createLabelCell = (label) => {
    const cell = document.createElement(`vscode-table-cell`);
    cell.innerText = label;
    return cell;
  };

  const createInputCell = (id, value, placeHolder) => {
    const cell = document.createElement(`vscode-table-cell`);

    const input = document.createElement(`code`);
    input.id = id;
    input.innerText = value;
    input.setAttribute(`contenteditable`, `true`);

    cell.appendChild(input);

    return cell;
  };

  const table = document.createElement(`vscode-table`);
  table.id = id;

  const tableBody = document.createElement(`vscode-table-body`);

  const hasEditableData = properties.some(prop => prop.id !== undefined);

  for (let prop of properties) {
    const row = document.createElement(`vscode-table-row`);

    row.appendChild(createLabelCell(prop.label));

    if (prop.id) {
      row.append(createInputCell(prop.id, prop.value, `no value`));
    } else {
      row.append(createLabelCell(prop.value));
    }

    tableBody.appendChild(row);
  }

  table.appendChild(tableBody);
  section.appendChild(table);

  if (hasEditableData) {
    const updateButton = document.createElement(`vscode-button`);
    updateButton.innerText = `Update`;

    // Center the button
    updateButton.style.margin = `1em`;
    updateButton.style.display = `block`;

    updateButton.addEventListener(`click`, (e) => {
      const values = section.querySelectorAll(`[contenteditable]`);

      /** @type {{[key: string]: string}} */
      let newProperties = {};

      values.forEach(field => {
        newProperties[field.id] = field.innerText;
      });

      onUpdate(newProperties);
    });

    section.appendChild(updateButton);
  }

  return section;
}

function clearKeywordEditor() {
  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  keywordEditorArea.innerHTML = ``;
}

/**
 * @param {(keyword: Keyword) => void} onUpdate
 * @param {Keyword} [keyword] 
 */
function editKeyword(onUpdate, keyword) {
  const group = document.createElement(`vscode-form-group`);
  group.id = `currentKeywordEditor`;
  group.setAttribute(`variant`, `vertical`);
  group.style.paddingLeft = `1em`;
  group.style.paddingRight = `1em`;

  const createLabel = (label, forId) => {
    const labelElement = document.createElement(`vscode-label`);
    labelElement.setAttribute(`for`, forId);
    labelElement.innerText = label;
    labelElement.style.marginTop = `0.5em`;
    return labelElement;
  };

  const createInputField = (id, value) => {
    const input = document.createElement(`vscode-textfield`);
    input.setAttribute(`id`, id);
    input.setAttribute(`value`, value);
    return input;
  };

  const createIndicatorSelect = (id, defaultValue) => {
    const select = document.createElement(`vscode-single-select`);
    select.setAttribute(`id`, id);

    const options = [`None`];

    for (let i = 1; i <= 99; i++) {
      options.push(String(i));
    }

    options.forEach(option => {
      const optionElement = document.createElement(`vscode-option`);
      optionElement.setAttribute(`value`, option);
      optionElement.innerText = option;

      if (option === defaultValue) {
        optionElement.setAttribute(`selected`, `true`);
      }

      select.appendChild(optionElement);
    });

    return select;
  };

  const createCheckbox = (id, label, checked) => {
    const checkbox = document.createElement(`vscode-checkbox`);
    checkbox.setAttribute(`id`, id);
    checkbox.setAttribute(`label`, label);
    if (checked) {
      checkbox.setAttribute(`checked`, checked);
    }
    return checkbox;
  };

  group.appendChild(createLabel(`Keyword`, `keyword`));
  group.appendChild(createInputField(`keyword`, keyword ? keyword.name : ``));

  group.appendChild(createLabel(`Value`, `value`));
  group.appendChild(createInputField(`value`, keyword ? (keyword.value || ``) : ``));

  group.appendChild(createLabel(`Indicator 1`, `ind1`));
  group.appendChild(createIndicatorSelect(`ind1`, keyword ? keyword.conditions[0]?.indicator : undefined));

  group.appendChild(createCheckbox(`neg1`, `Negate`, keyword ? keyword.conditions[0]?.negate : undefined));

  group.appendChild(createLabel(`Indicator 2`, `ind2`));
  group.appendChild(createIndicatorSelect(`ind2`, keyword ? keyword.conditions[1]?.indicator : undefined));

  group.appendChild(createCheckbox(`neg2`, `Negate`, keyword ? keyword.conditions[1]?.negate : undefined));

  group.appendChild(createLabel(`Indicator 3`, `ind3`));
  group.appendChild(createIndicatorSelect(`ind3`, keyword ? keyword.conditions[2]?.indicator : undefined));

  group.appendChild(createCheckbox(`neg3`, `Negate`, keyword ? keyword.conditions[2]?.negate : undefined));

  const button = document.createElement(`vscode-button`);
  button.setAttribute(`icon`, `check`);
  button.style.marginTop = `1em`;
  button.style.display = `block`;
  button.innerText = `Confirm`;
  button.onclick = () => {
    const keywordName = group.querySelector(`#keyword`).value;
    const keywordValue = group.querySelector(`#value`).value;

    const ind1 = group.querySelector(`#ind1`).value;
    const neg1 = group.querySelector(`#neg1`).checked;

    const ind2 = group.querySelector(`#ind2`).value;
    const neg2 = group.querySelector(`#neg2`).checked;

    const ind3 = group.querySelector(`#ind3`).value;
    const neg3 = group.querySelector(`#neg3`).checked;

    const newKeyword = {
      name: keywordName,
      value: keywordValue ? keywordValue : undefined,
      conditions: []
    };

    if (ind1 !== `None`) {
      newKeyword.conditions.push({
        indicator: ind1,
        negate: neg1
      });
    }

    if (ind2 !== `None`) {
      newKeyword.conditions.push({
        indicator: ind2,
        negate: neg2
      });
    }

    if (ind3 !== `None`) {
      newKeyword.conditions.push({
        indicator: ind3,
        negate: neg3
      });
    }

    onUpdate(newKeyword);
  };

  group.appendChild(button);

  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  keywordEditorArea.innerHTML = ``;

  keywordEditorArea.appendChild(document.createElement(`vscode-divider`));
  keywordEditorArea.appendChild(group);
}