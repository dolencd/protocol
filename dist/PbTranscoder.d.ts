/// <reference types="node" />
export declare function decode(buf: Buffer): {
    [k: string]: any;
};
export declare function encode(obj: Record<string, any>): Buffer;
