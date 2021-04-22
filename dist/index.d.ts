/// <reference types="node" />
import { Protocol, ProtocolOptions } from "./Protocol";
export type { Protocol, ProtocolOptions } from "./Protocol";
export { decodeClientId, encodeClientId, decodeSessionId, encodeSessionId } from "./transcoder";
interface ErrorObject {
    code?: number;
    reason?: string;
}
/**
 * Create server
 * @param {ProtocolOptions} options Options to use. See ProtocolOptions
 * @param {Buffer} initialMessage First message that was received (contains authentication information)
 * @param {(Buffer) => true | ErrorObject} authFn Function to test if client should be allowed to connect
 * @returns {[Protocol, Buffer, ErrorObject]}
 */
export declare function createServer(options: ProtocolOptions, initialMessage: Buffer, authFn?: (authBuf: Buffer) => true | {
    code?: number;
    reason?: string;
}): Promise<[Protocol, Buffer, ErrorObject?]>;
/**
 * Create a new client
 * @param options {ProtocolOptions} Options to use. See the ProtocolOptions page
 * @param authMessage {Buffer} Buffer containing authentication information
 * @returns {[protocol, messageToSend, error]}
 */
export declare function createClient(options: ProtocolOptions, authMessage: Buffer): [Protocol, Buffer, ErrorObject?];
