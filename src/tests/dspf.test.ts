import { expect, describe, it } from "vitest";
import { DdsLineRange, DisplayFile } from "../ui/dspf";

describe('DisplayFile tests', () => {

  const dspf1: string[] = [
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

  it('getRangeForFormat', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    expect(dds.getRangeForFormat(`DONOTEXIST`)).toBeUndefined();
    
    let range: DdsLineRange | undefined;

    range = dds.getRangeForFormat(`FMT1`);
    expect(range?.start).toBe(3);
    expect(range?.end).toBe(9);

    range = dds.getRangeForFormat(`HEAD`);
    expect(range?.start).toBe(1);
    expect(range?.end).toBe(3);
  });

  it('getRangeForField', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    let range: DdsLineRange | undefined;

    expect(dds.getRangeForField(`FORM1`, `UNKNOWN`)).toBeUndefined();

    range = dds.getRangeForField(`FORM1`, `FLD0101`);
    expect(range?.start).toBe(14);
    expect(range?.end).toBe(16);

    range = dds.getRangeForField(`FORM1`, `FLD0102`);
    expect(range?.start).toBe(17);
    expect(range?.end).toBe(17);

  });

  it('No duplicate RecordInfo', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);
    let names = dds.formats.map(rcd => rcd.name);
    expect(new Set(names).size).toBe(names.length);
  });

});
