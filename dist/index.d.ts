/// <reference types="node" />
import { Protocol, ProtocolOptions } from "./Protocol";
export type { Protocol, ProtocolOptions } from "./Protocol";
export { decodeClientId, encodeClientId, decodeSessionId, encodeSessionId } from "./transcoder";
interface ErrorObject {
    code?: number;
    reason?: string;
}
/**
 * Create a new server instance. Each instance communicates with 1 client.
 * @param {ProtocolOptions} options Options to use. See ProtocolOptions.
 * @param {Buffer} initialMessage First message that was received (contains authentication information)
 * @param {(Buffer) => true | ErrorObject} authFn Gets the authentication message that was passed to createClient. If it returns true the connection is accepted. Can return an instance of ErrorObject to provide the client a reason for tha failure. If not present, all connections are accepted.
 * @returns {[Protocol, Buffer, ErrorObject]}
 */
export declare function createServer(options: ProtocolOptions, initialMessage: Buffer, authFn?: (authBuf: Buffer) => true | {
    code?: number;
    reason?: string;
}): Promise<[Protocol, Buffer, ErrorObject?]>;
/**
 * Prepare a new client instance
 * @param options {ProtocolOptions} Options to use. See the ProtocolOptions page
 * @param authMessage {Buffer} Buffer containing authentication information. If present, it will be passed to the authentication function on the server.
 * @returns {[Protocol, messageToSend, ErrorObject?]}
 */
export declare function createClient(options: ProtocolOptions, authMessage?: Buffer): [Protocol, Buffer, ErrorObject?];
