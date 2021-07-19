import { EventEmitter } from "events";
import { isEmpty, cloneDeep } from "lodash";
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

interface FnCall {
    id: number;
    args?: Buffer;
    method: string;
    sent: boolean;
    result?: RpcResObj;
}

function removeUndefinedAndEmpty(o: Record<string, any>) {
    Object.keys(o).map((k) => {
        if (o[k] === undefined || o[k] === null) {
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

export default class LibTop extends EventEmitter {
    incObj: Record<string, any>;

    outObj: Record<string, any>;

    outObjSent: Record<string, any>;

    responses: Map<number, RpcResObj>;

    requests: Map<number, FnCall>;

    requestsOrdered: Map<number, FnCall>;

    events: Array<Buffer>;

    eventsOrdered: Array<Buffer>;

    idCreator: IdCreator;

    transcoder: Transcoder;

    constructor(options: LibTopOptions) {
        super();
        this.idCreator = new IdCreator(1, 65530);

        this.transcoder = options.transcoder;

        this.outObj = options.initialOutObj ? cloneDeep(options.initialOutObj) : {};
        this.incObj = options.initialIncObj ? cloneDeep(options.initialIncObj) : {};
        this.outObjSent = options.initialOutObj ? cloneDeep(options.initialOutObj) : {};

        this.responses = new Map();
        this.requests = new Map();
        this.requestsOrdered = new Map();
        this.events = [];
        this.eventsOrdered = [];
    }

    private receiveFnCalls(requests: Record<string, RpcReqObj>) {
        Object.keys(requests).map((idStr: string) => {
            const id = Number.parseInt(idStr, 10);

            const rpcObj: RpcReqObj = requests[id];
            if (!rpcObj.method) {
                console.error(`top rpc call without method name id:${id}`, rpcObj);
            }
            // console.log(`top got fn call id:${id} method:${util.inspect(rpcObj)}`)
            this.emit(
                "call",
                rpcObj.method,
                rpcObj.args,
                ((reqId: number, isError: boolean | null, resultBuf: Buffer) => {
                    const respObj: RpcResObj = { returns: resultBuf };
                    if (isError) respObj.isError = true;
                    this.responses.set(reqId, respObj);
                    // console.log(`top fn call processed id:${id} method:${rpcObj.method}`)
                }).bind(this, id)
            );
        });
    }

    private receiveFnResults(results: Record<string, RpcResObj>) {
        Object.keys(results).map((idStr: string) => {
            const id = Number.parseInt(idStr, 10);
            const callObj = this.requests.get(id) || this.requestsOrdered.get(id);
            const returnsObj = results[id];

            if (!returnsObj) {
                console.error("missing values rrpc", results, id);
                return;
            }

            if (!callObj) {
                console.error(
                    "Got response for function that wasn't called",
                    callObj,
                    Array.from(this.requests.entries()),
                    Array.from(this.requestsOrdered.entries())
                );
                return;
            }

            callObj.result = returnsObj;

            this.requests.delete(id);
            this.requestsOrdered.delete(id);
        });
    }

    private receiveObjSync(obj: Record<string, any>): void {
        this.incObj = differ.applySync(this.incObj, obj);
        this.emit("objSync", obj, this.incObj);
    }

    private receiveObjDelete(obj: Record<string, any>): void {
        this.incObj = differ.applyDelete(this.incObj, obj);
        this.emit("objDelete", obj, this.incObj);
    }

    receiveMessageOrdered(buf: Buffer): void {
        // console.log("top accept", binMsg.length)
        const obj: ProtocolObject = this.transcoder.decode(buf);

        // console.log("top decoded", obj)
        if (obj.eventsOrdered)
            obj.eventsOrdered.map((b: Buffer) => {
                this.emit("event", b);
            });

        // send rpc - what i want the other process to do
        // receive fn to run
        if (obj.reqRpcOrdered) {
            this.receiveFnCalls(obj.reqRpcOrdered);
        }

        if (obj.objAll) {
            this.incObj = obj.objAll;

            if (obj.objSync || obj.objDelete) {
                console.error("Got message with objAll AND objSync or objDelete. Ignoringthem");
            }
        } else {
            if (obj.objSync) {
                this.receiveObjSync(obj.objSync);
            }

            if (obj.objDelete) {
                this.receiveObjDelete(obj.objDelete);
            }
        }

        if (obj.objAll || obj.objSync || obj.objDelete) {
            this.emit("objChange", this.incObj);
        }
    }

    receiveMessage(buf: Buffer): void {
        // console.log("top accept", binMsg.length)
        const obj: ProtocolObject = this.transcoder.decode(buf);

        // console.log("top decoded", obj)
        if (obj.events)
            obj.events.map((b: Buffer) => {
                this.emit("event", b);
            });

        // send rpc - what i want the other process to do
        // receive fn to run
        if (obj.reqRpc) {
            this.receiveFnCalls(obj.reqRpc);
        }

        // receive rpc - responses that were received
        if (obj.resRpc) {
            this.receiveFnResults(obj.resRpc);
        }
    }

    callFn(method: string, args?: Buffer): number {
        const id = this.idCreator.next();

        this.requests.set(id, {
            method,
            args,
            id,
            sent: false,
        });

        return id;
    }

    callFnOrdered(method: string, args?: Buffer): number {
        const id = this.idCreator.next();

            this.requestsOrdered.set(id, {
                method,
                args,
                id,
                sent: false,
            });
        
        return id;
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
    send(): Buffer {
        const reqRpc: Record<number, RpcReqObj> = {};
        this.requests.forEach((val: FnCall, key: number) => {
            if (val.sent) return;
            val.sent = true;
            reqRpc[key] = {
                method: val.method,
                args: val.args,
            };
            if (val.args) reqRpc[key].args = val.args;
        });

        const reqRpcOrdered: any = {};
        this.requestsOrdered.forEach((val: FnCall, key: number) => {
            if (val.sent) return;
            val.sent = true;
            reqRpcOrdered[key] = {
                method: val.method,
            };
            if (val.args) reqRpcOrdered[key].args = val.args;
        });

        const resRpc = Object.fromEntries(this.responses);
        this.responses.clear();

        const { events, eventsOrdered } = this;
        this.events = [];
        this.eventsOrdered = [];

        const finishedObject = {
            reqRpcOrdered,
            reqRpc,
            resRpc,
            objSync: differ.getSync(this.outObjSent, this.outObj),
            objDelete: differ.getDelete(this.outObjSent, this.outObj),
            events,
            eventsOrdered,
        };
        this.outObjSent = cloneDeep(this.outObj);
        const cleanedObject = removeUndefinedAndEmpty(finishedObject);
        const buf = this.transcoder.encode(cleanedObject);
        this.emit("send", buf);
        return buf;
    }
}
