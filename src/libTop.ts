import { isEmpty, cloneDeep } from "lodash";
import { ReceivedMessage, ReceivedMessageType } from "./libBot";
import * as differ from "./differ";
import IdCreator from "./idCreator";
import { stringify as serializerStringify, parse as serializerParse } from "./serializer";

interface RpcReqObj {
    method: string;
    args?: Buffer;
}

interface RpcResObj {
    /**
     * Buffer that was sent as a response to the given RPC call.
     */
    returns?: Buffer;

    /**
     * If set to true, the response is treated as an error, otherwise there is no error.
     */
    isError?: boolean;
}

interface ProtocolObject {
    objAll?: Record<string, any>;
    objSync?: Record<string, any>;
    objDelete?: Record<string, any>;
    reqRpc?: Record<number, RpcReqObj>;
    reqRpcOrdered?: Record<number, RpcReqObj>;
    resRpc?: Record<number, RpcResObj>;
    events?: Array<Buffer>;
    eventsOrdered?: Array<Buffer>;
    code?: number;
    codes?: Array<number>;
    reason?: string;
}

export interface ReceiveMessageObject {
    objAll?: Record<string, any>;
    objSync?: Record<string, any>;
    objDelete?: Record<string, any>;
    rpcCalls?: Array<FnCall>;
    rpcResults?: Array<FnCall>;
    events?: Array<Buffer>;
    eventsOrdered?: Array<Buffer>;
    codes?: Array<number>;
}

interface Transcoder {
    encode: (obj: Record<string, any>) => Buffer;
    decode: (buf: Buffer) => Record<string, any>;
}

export interface LibTopOptions {
    /**
     * An object that fits the Transcoder interface that will be used to encode and decode the main protocol payload
     */
    transcoder?: Transcoder;

    /**
     * The object that is already synced from the remote host (incoming sync). Setting this will avoid unnecessary syncing. Ignored if restoreState is used.
     */
    initialIncObj?: Record<string, any>;

    /**
     * The object that is already synced to the remote host (outgoing sync). Setting this will avoid unnecessary syncing. Ignored if restoreState is used.
     */
    initialOutObj?: Record<string, any>;

    /**
     * Restore state of old LibTop instance
     */
    restoreState?: string;
}

export interface FnCall {
    /**
     * Id number of the request
     */
    id?: number;

    /**
     * Optional arguments encoded as a Buffer.
     */
    args?: Buffer;

    /**
     * The name of the method that was called.
     */
    method: string;

    /**
     * Whether the function call was sent or not. Unused for calls that have been received from the other side.
     */
    sent?: boolean;

    /**
     * Result object. Exists if the response has arrived.
     */
    result?: RpcResObj;
}

/**
 * Handles application-level calls and packages them into efficient opaque messages.
 */
export default class LibTop {
    public incObj: Record<string, any>;

    public outObj: Record<string, any>;

    private outObjSent: Record<string, any>;

    readonly responses: Map<number, FnCall>;

    readonly requests: Map<number, FnCall>;

    readonly requestsOrdered: Map<number, FnCall>;

    private events: Array<Buffer>;

    private eventsOrdered: Array<Buffer>;

    readonly idCreator: IdCreator;

    private transcoder: Transcoder;

    constructor(options: LibTopOptions = {}) {
        this.transcoder = options.transcoder;

        if (options.restoreState) {
            const rs = serializerParse(options.restoreState);
            this.idCreator = new IdCreator(rs.idCur, rs.idMin, rs.idMax);

            this.outObj = rs.outObj;
            this.incObj = rs.incObj;
            this.outObjSent = rs.outObjSent;

            this.responses = rs.responses;
            this.requests = rs.requests;
            this.requestsOrdered = rs.requestsOrdered;
            this.events = rs.events;
            this.eventsOrdered = rs.eventsOrdered;
        } else {
            this.idCreator = new IdCreator(1, 1, 65530);
            this.outObj = options.initialOutObj ? cloneDeep(options.initialOutObj) : {};
            this.incObj = options.initialIncObj ? cloneDeep(options.initialIncObj) : {};
            this.outObjSent = cloneDeep(this.outObj);

            this.responses = new Map();
            this.requests = new Map();
            this.requestsOrdered = new Map();
            this.events = [];
            this.eventsOrdered = [];
        }
    }

    /**
     * Get the serialized version of this object. Used to store the state and to later restore it using LibTopOptions.restoreState.
     */
    getLibState(): string {
        return serializerStringify({
            idMin: this.idCreator.min,
            idMax: this.idCreator.max,
            idCur: this.idCreator.cur,
            outObj: this.outObj,
            incObj: this.incObj,
            outObjSent: this.outObjSent,
            responses: this.responses,
            requests: this.requests,
            requestsOrdered: this.requestsOrdered,
            events: this.events,
            eventsOrdered: this.eventsOrdered,
        });
    }

    private receiveFnCalls(requests: Record<string, RpcReqObj>): Array<FnCall> {
        const returnArr: Array<FnCall> = [];

        Object.entries(requests).map(([idStr, rpcObj]) => {
            const id = Number.parseInt(idStr, 10);
            if (!rpcObj.method) {
                console.error(`top rpc call without method name id:${id}`, rpcObj);
            }

            if (this.responses.has(id)) {
                console.error(`Request with this Id already exists. Ignoring it`); // TODO is this OK?
            }

            const obj: FnCall = {
                id,
                method: rpcObj.method,
            };
            if (rpcObj.args) obj.args = rpcObj.args;

            this.responses.set(id, obj);
            returnArr.push(cloneDeep(obj));
        });

        return returnArr;
    }

    /**
     * Sends a response to the function call associated with the given id.
     * @param id Id number of the request
     * @param returns Optional response Buffer
     * @param isError Set to true to signify an error, ignore otherwise.
     */
    sendFnCallResponse(id: number, returns: Buffer | null = null, isError = false): void {
        const callObj = this.responses.get(id);
        if (!callObj) {
            throw new Error("Attempted to send response to a method call that doesn't exist");
        }

        callObj.result = {
            isError,
        };
        if (returns && returns.length > 0) {
            callObj.result.returns = returns;
        }
    }

    receiveFnResults(results: Record<string, RpcResObj>): Array<FnCall> {
        const returnArr: Array<FnCall> = [];

        Object.entries(results).map(([idStr, returnsObj]) => {
            const id = Number.parseInt(idStr, 10);
            const callObj = this.requests.get(id) || this.requestsOrdered.get(id);

            if (!returnsObj) {
                console.error("missing values rrpc", results, id);
                return;
            }

            if (!callObj) {
                console.error(
                    "Got response for function that wasn't called",
                    id,
                    Array.from(this.requests.entries()),
                    Array.from(this.requestsOrdered.entries())
                );
                return;
            }

            callObj.result = returnsObj;
            delete callObj.sent;
            returnArr.push(callObj);
            this.requests.delete(id);
            this.requestsOrdered.delete(id);
        });

        return returnArr;
    }

    private receiveObjSync(obj: Record<string, any>): void {
        this.incObj = differ.applySync(this.incObj, obj);
    }

    private receiveObjDelete(obj: Record<string, any>): void {
        this.incObj = differ.applyDelete(this.incObj, obj);
    }

    /**
     * Accepts and processes a message coming from the other side.
     * @param msgs Array of ReceivedMessage objects or a single ReceivedMessage object or a Buffer that will be treated as a single complete full message.
     * @returns Object containing the processed message
     */
    receiveMessage(msgs: Array<ReceivedMessage> | ReceivedMessage | Buffer): ReceiveMessageObject {
        let input: Array<ReceivedMessage>;

        const events: Array<Buffer> = [];
        const eventsOrdered: Array<Buffer> = [];
        const rpcCalls: Array<FnCall> = [];
        const rpcResults: Array<FnCall> = [];

        if (Buffer.isBuffer(msgs)) {
            input = [{ msg: msgs }];
        } else if (!Array.isArray(msgs)) {
            input = [msgs];
        } else {
            input = msgs;
        }

        const oldIncObj = this.incObj;
        input.map((msg) => {
            const obj: ProtocolObject = this.transcoder.decode(msg.msg);
            if (msg.type !== ReceivedMessageType.ordered) {
                // console.log("top decoded", obj)
                if (obj.events)
                    obj.events.map((b: Buffer) => {
                        events.push(b);
                    });

                if (obj.reqRpc) {
                    this.receiveFnCalls(obj.reqRpc).map((f: FnCall) => {
                        rpcCalls.push(f);
                    });
                }

                // receive rpc - responses that were received
                if (obj.resRpc) {
                    this.receiveFnResults(obj.resRpc).map((res) => {
                        rpcResults.push(res);
                    });
                }
            }

            if (msg.type !== ReceivedMessageType.unordered) {
                // console.log("top decoded", obj)
                if (obj.eventsOrdered) {
                    obj.eventsOrdered.map((b: Buffer) => {
                        eventsOrdered.push(b);
                    });
                }

                // send rpc - what i want the other process to do
                // receive fn to run
                if (obj.reqRpcOrdered) {
                    this.receiveFnCalls(obj.reqRpcOrdered).map((f: FnCall) => {
                        rpcCalls.push(f);
                    });
                }

                if (obj.objAll) {
                    this.incObj = obj.objAll;

                    if (obj.objSync || obj.objDelete) {
                        console.error("Got message with objAll AND objSync or objDelete. Ignoring them");
                    }
                } else {
                    if (obj.objSync) {
                        this.receiveObjSync(obj.objSync);
                    }

                    if (obj.objDelete) {
                        this.receiveObjDelete(obj.objDelete);
                    }
                }
            }
        });

        const objSync = differ.getSync(oldIncObj, this.incObj);
        const objDelete = differ.getDelete(oldIncObj, this.incObj);
        const objAll = this.incObj;

        const outputObj: ReceiveMessageObject = {};

        if (!isEmpty(events)) outputObj.events = events;
        if (!isEmpty(eventsOrdered)) outputObj.eventsOrdered = eventsOrdered;
        if (!isEmpty(rpcCalls)) outputObj.rpcCalls = rpcCalls;
        if (!isEmpty(rpcResults)) outputObj.rpcResults = rpcResults;
        if (!isEmpty(objSync)) outputObj.objSync = objSync;
        if (!isEmpty(objDelete)) outputObj.objDelete = objDelete;
        if (!isEmpty(objAll)) outputObj.objAll = objAll;

        return outputObj;
    }

    private callFnInternal(requestsMap: Map<number, FnCall>, method: string, args?: Buffer) {
        const id = this.idCreator.next();

        const fnCall: FnCall = {
            method,
            id,
            sent: false,
        };

        if (args) fnCall.args = args;
        requestsMap.set(id, fnCall);

        return id;
    }

    /**
     * Calls a function that will be processed as soon as it is received.
     * @param method Name of method to call
     * @param args Optional arguments
     * @returns Id number of this request
     */
    callFn(method: string, args?: Buffer): number {
        return this.callFnInternal(this.requests, method, args);
    }

    /**
     * Calls a function that will be processed in order with other messages.
     * @param method Name of method to call
     * @param args Optional arguments
     * @returns Id number of this request
     */
    callFnOrdered(method: string, args?: Buffer): number {
        return this.callFnInternal(this.requestsOrdered, method, args);
    }

    /**
     * Send event without ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEvent(event: Buffer) {
        // console.log(`top send event len:${event.length}`, event)
        this.events.push(event);
    }

    /**
     * Send event with guaranteed ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEventOrdered(event: Buffer) {
        // console.log(`top send event len:${event.length}`, event)
        this.eventsOrdered.push(event);
    }

    /**
     * Emit message with all unsent data
     * @function send
     */
    send(autoConfirmChanges = true): [Buffer, Function | null] {
        const reqRpc: Record<number, RpcReqObj> = {};
        this.requests.forEach((val: FnCall, key: number) => {
            if (val.sent) return;
            reqRpc[key] = {
                method: val.method,
            };
            if (val.args) reqRpc[key].args = val.args;
        });

        const reqRpcOrdered: Record<number, RpcReqObj> = {};
        this.requestsOrdered.forEach((val: FnCall, key: number) => {
            if (val.sent) return;
            reqRpcOrdered[key] = {
                method: val.method,
            };
            if (val.args) reqRpcOrdered[key].args = val.args;
        });

        const resRpc: Record<number, RpcResObj> = {};
        this.responses.forEach((val: FnCall, key: number) => {
            if (!val.result) return;
            resRpc[key] = {};

            if (val.result.returns) resRpc[key].returns = val.result.returns;
            if (val.result.isError === true) resRpc[key].isError = true;
        });

        // TODO: add logic to figure out if it's better to use objAll instead
        const objDelete = differ.getDelete(this.outObjSent, this.outObj);
        const objSync = differ.getSync(this.outObjSent, this.outObj);

        const finishedObject: ProtocolObject = {};

        if (!isEmpty(reqRpcOrdered)) finishedObject.reqRpcOrdered = reqRpcOrdered;
        if (!isEmpty(reqRpc)) finishedObject.reqRpc = reqRpc;
        if (!isEmpty(resRpc)) finishedObject.resRpc = resRpc;
        if (!isEmpty(objSync)) finishedObject.objSync = objSync;
        if (!isEmpty(objDelete)) finishedObject.objDelete = objDelete;
        if (!isEmpty(this.events)) finishedObject.events = this.events;
        if (!isEmpty(this.eventsOrdered)) finishedObject.eventsOrdered = this.eventsOrdered;

        const buf = this.transcoder.encode(finishedObject);

        const confirmChanges = () => {
            Object.keys(reqRpc).map((key: string) => {
                this.requests.get(parseInt(key, 10)).sent = true;
            });

            Object.keys(reqRpcOrdered).map((key: string) => {
                this.requestsOrdered.get(parseInt(key, 10)).sent = true;
            });

            Object.keys(resRpc).map((key: string) => {
                this.responses.delete(parseInt(key, 10));
            });

            this.events = [];
            this.eventsOrdered = [];
            this.outObjSent = cloneDeep(this.outObj);
        };

        if (autoConfirmChanges) {
            confirmChanges();
            return [buf, null];
        }

        return [buf, confirmChanges.bind(this)];
    }
}
