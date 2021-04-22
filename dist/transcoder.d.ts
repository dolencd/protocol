/// <reference types="node" />
export declare function decodeClientId(buf: Buffer): [Buffer, Buffer];
export declare function encodeClientId(clientId: Buffer, rest?: Buffer): Buffer;
export declare function decodeSeqAck(buf: Buffer): [number, Array<number>, Buffer];
export declare function encodeSeqAck(seq: number, acks?: Array<number>, rest?: Buffer): Buffer;
export declare function decodeSessionId(buf: Buffer): [number, Buffer];
export declare function encodeSessionId(sessionId: number, rest?: Buffer): Buffer;
