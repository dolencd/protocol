/// <reference types="node" />
import { EventEmitter } from "events";
import { LibBotOptions } from "./libBot";
import LibTop from "./libTop";
export interface ProtocolOptions extends LibBotOptions {
    /**
     * Adds support for unreliable connections. Guarantees message delivery and order.
     * Enable if the underlying communications protocol does not provide these guarantees.
     */
    enableOrdering?: boolean;
}
export interface Transcoder {
    /**
     * Takes a plain JS Object and encodes it into a Buffer. Must be the inverse of `decode`.
     * @param obj Input Object
     */
    encode(obj: Record<string, any>): Buffer;
    /**
     * Decodes a given Buffer into a JS Object. Must be the inverse of `encode`.
     * @param buf Input Buffer
     */
    decode(buf: Buffer): Record<string, any>;
}
export declare class Protocol extends EventEmitter {
    tp: LibTop;
    private bt?;
    /**
     * Initialise the Protocol class. It is not recommended to use this directly.
     * @param options {ProtocolOptions}
     */
    constructor(options: ProtocolOptions);
    /**
     * Maximum sequence number that has been sent by this client
     * Cycles when maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxSendSeq(): number;
    /**
     * Maximum sequence number that has been received by the client (may not have received all messages up to this point)
     * Cycles when the maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxIncSeq(): number | null;
    /**
     * Maximum sequence number emitted by the client. All messages up to this have been received.
     * Cycles when the maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxEmittedSeq(): number | null;
    /**
     * Package all data and get a Buffer to send to the other side.
     * @function send
     * @returns {Buffer} Buffer to send to other side
     */
    send(): Buffer;
    /**
     * Receive message from the other side. Routes correctly if LibBot is enabled or not.
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    receiveMessage(event: Buffer): void;
    /**
     * Send an event to be processed as soon as possible
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    sendEvent(event: Buffer): void;
    /**
     * Send an event with guaranteed ordering
     * @function sendEventOrdered
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    sendEventOrdered(event: Buffer): void;
    /**
     * Call a function on the other side
     * @async
     * @function callFn
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    callFn(method: string, args?: Buffer): Promise<Buffer>;
    /**
     * Call a function on the other side while maintaining order of messages
     * @async
     * @function callFnOrdered
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    callFnOrdered(method: string, args?: Buffer): Promise<Buffer>;
}
