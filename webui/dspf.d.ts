export interface DdsLineRange {
    start: number;
    end: number;
}
export declare class DisplayFile {
    formats: RecordInfo[];
    currentField: FieldInfo | undefined;
    currentFields: FieldInfo[];
    currentRecord: RecordInfo | undefined;
    constructor();
    /**
    * @param {string[]} lines
    */
    parse(lines: string[]): void;
    /**
    * @param {string} keywords
    * @param {string} [conditionals]
    * @returns
    */
    HandleKeywords(keywords: string, conditionals?: string): void;
    static parseConditionals(conditionColumns: string): Conditional[];
    static parseKeywords(keywordStrings: string[], conditionalStrings?: {
        [line: number]: string;
    }): {
        value: string;
        keywords: Keyword[];
        conditional: Conditional;
    };
    updateField(recordFormat: string, originalFieldName: string, fieldInfo: FieldInfo): {
        newLines: string[];
        range?: DdsLineRange;
    } | undefined;
}
export declare class RecordInfo {
    name: string;
    fields: FieldInfo[];
    range: DdsLineRange;
    isWindow: boolean;
    windowReference: string | undefined;
    windowSize: {
        y: number;
        x: number;
        width: number;
        height: number;
    };
    keywordStrings: string[];
    keywords: Keyword[];
    constructor(name: string);
    handleKeywords(): void;
}
export interface Keyword {
    name: string;
    value?: string;
    conditional: Conditional;
}
export type DisplayType = "input" | "output" | "both" | "const" | "hidden";
export declare class FieldInfo {
    startRange: number;
    name?: string | undefined;
    value: string | undefined;
    type: string | undefined;
    primitiveType: "char" | "decimal" | undefined;
    displayType: DisplayType | undefined;
    length: number;
    decimals: number;
    position: {
        x: number;
        y: number;
    };
    keywordStrings: {
        keywordLines: string[];
        conditionalLines: {
            [lineIndex: number]: string;
        };
    };
    conditional: Conditional;
    keywords: Keyword[];
    constructor(startRange: number, name?: string | undefined);
    handleKeywords(): void;
}
export declare class Conditional {
    conditions: Condition[];
    //indicator: number;
    //negate: boolean;
    //constructor(indicator: number, negate?: boolean);
}
export declare class Condition {
    indicators: Indicator[];
}
export declare class Indicator {
    indicator: number;
    negate: boolean;
}

