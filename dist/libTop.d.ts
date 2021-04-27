/// <reference types="node" />
import { EventEmitter } from "events";
import IdCreator from "./idCreator";
interface RpcResObj {
    returns?: Buffer;
    isError?: boolean;
}
interface FnCall {
    id: number;
    args: Buffer;
    method: string;
    resolve: Function;
    reject: Function;
    sent: boolean;
}
export default class LibTop extends EventEmitter {
    remoteObj: any;
    obj: any;
    responses: Map<number, RpcResObj>;
    requests: Map<number, FnCall>;
    requestsOrdered: Map<number, FnCall>;
    events: Array<Buffer>;
    eventsOrdered: Array<Buffer>;
    idCreator: IdCreator;
    constructor();
    private receiveFnCalls;
    private receiveFnResults;
    receiveMessageOrdered(buf: Buffer): void;
    receiveMessage(buf: Buffer): void;
    callFn(method: string, args?: Buffer): Promise<Buffer>;
    callFnOrdered(method: string, args?: Buffer): Promise<Buffer>;
    /**
     * Send event without ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEvent(event: Buffer): void;
    /**
     * Send event with guaranteed ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEventOrdered(event: Buffer): void;
    /**
     * Emit message with all unsent data
     * @function send
     */
    send(): Buffer;
}
export {};
