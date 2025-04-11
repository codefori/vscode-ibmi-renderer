export declare class DisplayFile {
    formats: RecordInfo[];
    private currentField;
    private currentFields;
    private currentRecord;
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
        conditions: Conditional[];
    };
}
export declare class RecordInfo {
    name: string;
    fields: FieldInfo[];
    range: {
        start: number;
        end: number;
    };
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
interface Keyword {
    name: string;
    value?: string;
    conditions: Conditional[];
}
export declare class FieldInfo {
    startRange: number;
    name?: string | undefined;
    value: string | undefined;
    type: "char" | "decimal" | undefined;
    displayType: "input" | "output" | "both" | "const" | "hidden" | undefined;
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
    conditions: Conditional[];
    keywords: Keyword[];
    constructor(startRange: number, name?: string | undefined);
    handleKeywords(): void;
}
export declare class Conditional {
    indicator: number;
    negate: boolean;
    constructor(indicator: number, negate?: boolean);
}
export {};
