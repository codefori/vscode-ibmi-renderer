import { describe, it, expect } from "vitest";
import { DisplayFile } from "../ui/dspf";

describe('DisplayFile.parse', () => {
  const dspf: string[] = [
    `     A                                      DSPSIZ(24 80 *DS3)                  `,
    `     A          R HEAD                                                          `,
    `     A                                  1 32'vscode-displayfile'                `,
    `     A          R FMT1                                                          `,
    `     A                                      SLNO(03)                            `,
    `     A                                  1  3'Opt'                               `,
    `     A                                      COLOR(BLU)                          `,
    `     A                                  1  8'Name'                              `,
    `     A                                      COLOR(BLU)                          `,
    `     A          R GLOBAL                                                        `,
    `     A                                      SLNO(04)                            `,
    `     A                                  1  3'---'                               `,
    `     A          R FORM1                                                         `,
    `     A                                      SLNO(06)                            `,
    `     A            FLD0101       10A  B  3  5                                    `,
    `     A  20                                  DSPATR(PR)                          `,
    `     A                                      COLOR(YLW)                          `,
    `     A            FLD0102       10   B  3  5                                    `,
  ];

  it('parses record and field information', () => {
    const dds = new DisplayFile();
    dds.parse(dspf);

    expect(dds.formats[0].name).toBe('_GLOBAL');
    expect(dds.formats[0].keywords).toContainEqual({name: 'DSPSIZ', value: '24 80 *DS3', conditions: []});

    const head = dds.formats.find(f => f.name === 'HEAD');
    expect(head).toBeDefined();
    expect(head!.fields).toHaveLength(1);
    const headField = head!.fields[0];
    expect(headField.name).toBe('TEXT1');
    expect(headField.value).toBe('vscode-displayfile');
    expect(headField.displayType).toBe('const');
    expect(headField.position).toEqual({x: 32, y: 1});

    const fmt1 = dds.formats.find(f => f.name === 'FMT1');
    expect(fmt1).toBeDefined();
    const optField = fmt1!.fields[0];
    expect(optField.value).toBe('Opt');
    expect(optField.keywords).toContainEqual({name: 'COLOR', value: 'BLU', conditions: []});

    const form1 = dds.formats.find(f => f.name === 'FORM1');
    expect(form1).toBeDefined();
    const fld0101 = form1!.fields.find(f => f.name === 'FLD0101');
    expect(fld0101).toBeDefined();
    expect(fld0101!.displayType).toBe('both');
    expect(fld0101!.type).toBe('A');
    expect(fld0101!.length).toBe(10);
    expect(fld0101!.position).toEqual({x: 5, y: 3});
    expect(fld0101!.keywords).toContainEqual({name: 'COLOR', value: 'YLW', conditions: []});
    expect(fld0101!.keywords).toContainEqual({name: 'DSPATR', value: 'PR', conditions: [{indicator: 20, negate: false}]});
  });
});
