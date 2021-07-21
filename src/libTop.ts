import { isEmpty, cloneDeep } from "lodash";
import { ReceivedMessages } from "./libBot";
import * as differ from "./differ";
import IdCreator from "./idCreator";

interface RpcReqObj {
    method: string;
    args?: Buffer;
}

interface RpcResObj {
    returns?: Buffer;
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
     * The object that is already synced from the remote host (incoming sync). Setting this will avoid unnecessary syncing.
     */
    initialIncObj?: Record<string, any>;

    /**
     * The object that is already synced to the remote host (outgoing sync). Setting this will avoid unnecessary syncing.
     */
    initialOutObj?: Record<string, any>;
}

export interface FnCall {
    id: number;
    args?: Buffer;
    method: string;
    sent?: boolean;
    result?: RpcResObj;
}

function removeUndefinedAndEmpty(o: Record<string, any>) {
    Object.keys(o).map((k) => {
        if (o[k] === undefined || o[k] === null || (Array.isArray(o[k]) && o[k].length === 0)) {
            delete o[k];
        }

        if (typeof o[k] === "object") {
            removeUndefinedAndEmpty(o[k]);
            if (isEmpty(o[k])) {
                delete o[k];
            }
        }
    });

    return o;
}

export default class LibTop {
    incObj: Record<string, any>;

    outObj: Record<string, any>;

    outObjSent: Record<string, any>;

    responses: Map<number, FnCall>;

    requests: Map<number, FnCall>;

    requestsOrdered: Map<number, FnCall>;

    events: Array<Buffer>;

    eventsOrdered: Array<Buffer>;

    idCreator: IdCreator;

    transcoder: Transcoder;

    constructor(options: LibTopOptions) {
        this.idCreator = new IdCreator(1, 65530);

        this.transcoder = options.transcoder;

        this.outObj = options.initialOutObj ? cloneDeep(options.initialOutObj) : {};
        this.incObj = options.initialIncObj ? cloneDeep(options.initialIncObj) : {};
        this.outObjSent = cloneDeep(this.outObj);

        this.responses = new Map();
        this.requests = new Map();
        this.requestsOrdered = new Map();
        this.events = [];
        this.eventsOrdered = [];
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

    sendFnCallResponse(id: number, returns: Buffer | null, isError = false): void {
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

    private receiveFnResults(results: Record<string, RpcResObj>): Array<FnCall> {
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

    receiveMessage(msg: ReceivedMessages | Buffer): ReceiveMessageObject {
        if (Buffer.isBuffer(msg)) {
            msg = {
                newMessage: msg,
            };
        }

        if (!msg.ordered) {
            msg.ordered = [msg.newMessage];
        }

        const outputObj: ReceiveMessageObject = {
            events: [],
            eventsOrdered: [],
            rpcCalls: [],
        };

        if (msg.newMessage) {
            const obj: ProtocolObject = this.transcoder.decode(msg.newMessage);

            // console.log("top decoded", obj)
            if (obj.events)
                obj.events.map((b: Buffer) => {
                    outputObj.events.push(b);
                });

            if (obj.reqRpc) {
                this.receiveFnCalls(obj.reqRpc).map((f: FnCall) => {
                    outputObj.rpcCalls.push(f);
                });
            }

            // receive rpc - responses that were received
            if (obj.resRpc) {
                outputObj.rpcResults = this.receiveFnResults(obj.resRpc);
            }
        }

        msg.ordered.map((buf) => {
            // console.log("top accept", binMsg.length)
            const obj: ProtocolObject = this.transcoder.decode(buf);

            // console.log("top decoded", obj)
            if (obj.eventsOrdered) {
                obj.eventsOrdered.map((b: Buffer) => {
                    outputObj.eventsOrdered.push(b);
                });
            }

            // send rpc - what i want the other process to do
            // receive fn to run
            if (obj.reqRpcOrdered) {
                this.receiveFnCalls(obj.reqRpcOrdered).map((f: FnCall) => {
                    outputObj.rpcCalls.push(f);
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
                    outputObj.objSync = obj.objSync;
                }

                if (obj.objDelete) {
                    this.receiveObjDelete(obj.objDelete);
                    outputObj.objDelete = obj.objDelete;
                }
            }

            if (obj.objAll || obj.objSync || obj.objDelete) {
                outputObj.objAll = cloneDeep(this.incObj);
            }
        });

        return removeUndefinedAndEmpty(outputObj);
    }

    private callFnInternal(requestsMap: Map<number, FnCall>, method: string, args?: Buffer) {
        const id = this.idCreator.next();

        requestsMap.set(id, {
            method,
            args,
            id,
            sent: false,
        });

        return id;
    }

    callFn(method: string, args?: Buffer): number {
        return this.callFnInternal(this.requests, method, args);
    }

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
                args: val.args,
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
            resRpc[key] = {
                returns: val.result.returns,
                isError: val.result.isError ? val.result.isError : undefined,
            };
        });

        const { events, eventsOrdered } = this;

        const finishedObject = {
            reqRpcOrdered,
            reqRpc,
            resRpc,
            objSync: differ.getSync(this.outObjSent, this.outObj),
            objDelete: differ.getDelete(this.outObjSent, this.outObj),
            events,
            eventsOrdered,
        };

        const cleanedObject = removeUndefinedAndEmpty(finishedObject);
        const buf = this.transcoder.encode(cleanedObject);

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
