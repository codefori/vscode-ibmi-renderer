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
    `     A                                      COLOR(BLU)                          `
  ];

  it('getRangeForFormat', () => {
    let dds = new DisplayFile();
    dds.parse(dspf1);

    expect(dds.getRangeForFormat(`DONOTEXIST`)).toBeUndefined();
    
    let range: DdsLineRange | undefined;

    range = dds.getRangeForFormat(`FMT1`);
    expect(range?.start).toBe(3);
    expect(range?.end).toBe(9);
    expect(true).toBe(true);

    range = dds.getRangeForFormat(`HEAD`);
    expect(range?.start).toBe(1);
    expect(range?.end).toBe(3);
    expect(true).toBe(true);
  });

});
