import * as EventEmitter from "events";
import { isEmpty } from "lodash";
import { diff, addedDiff } from "deep-object-diff";
import IdCreator from "./idCreator";
import { encode as pbEncode, decode as pbDecode } from "./PbTranscoder";
function removeUndefinedAndEmpty(o) {
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
    constructor() {
        super();
        this.idCreator = new IdCreator(1, 65530);
        this.remoteObj = {};
        this.obj = {};
        this.responses = new Map();
        this.requests = new Map();
        this.requestsOrdered = new Map();
        this.events = [];
        this.eventsOrdered = [];
    }
    receiveFnCalls(requests) {
        Object.keys(requests).map((idStr) => {
            const id = Number.parseInt(idStr, 10);
            const rpcObj = requests[id];
            if (!rpcObj.method) {
                console.error(`top rpc call without method name id:${id}`, rpcObj);
            }
            // console.log(`top got fn call id:${id} method:${util.inspect(rpcObj)}`)
            this.emit("call", rpcObj.method, rpcObj.args, ((reqId, isError, resultBuf) => {
                const respObj = { returns: resultBuf };
                if (isError)
                    respObj.isError = true;
                this.responses.set(reqId, respObj);
                // console.log(`top fn call processed id:${id} method:${rpcObj.method}`)
            }).bind(this, id));
        });
    }
    receiveFnResults(results) {
        Object.keys(results).map((idStr) => {
            const id = Number.parseInt(idStr, 10);
            const callObj = this.requests.get(id) || this.requestsOrdered.get(id);
            const returnsObj = results[id];
            if (!returnsObj) {
                console.error("missing values rrpc", results, id);
                return;
            }
            if (!callObj) {
                console.error("Got response for function that wasn't called", callObj, Array.from(this.requests.entries()), Array.from(this.requestsOrdered.entries()));
                return;
            }
            if (returnsObj.isError === true) {
                callObj.reject(returnsObj.returns || Buffer.allocUnsafe(0));
            }
            else {
                callObj.resolve(returnsObj.returns || Buffer.allocUnsafe(0));
            }
            this.requests.delete(id);
            this.requestsOrdered.delete(id);
        });
    }
    receiveMessageOrdered(buf) {
        // console.log("top accept", binMsg.length)
        const obj = pbDecode(buf);
        // console.log("top decoded", obj)
        if (obj.eventsOrdered)
            obj.eventsOrdered.map((b) => {
                this.emit("event", b);
            });
        // send rpc - what i want the other process to do
        // receive fn to run
        if (obj.reqRpcOrdered) {
            this.receiveFnCalls(obj.reqRpcOrdered);
        }
    }
    receiveMessage(buf) {
        // console.log("top accept", binMsg.length)
        const obj = pbDecode(buf);
        // console.log("top decoded", obj)
        if (obj.events)
            obj.events.map((b) => {
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
    callFn(method, args) {
        const id = this.idCreator.next();
        // console.log(`top fn called id:${id}`)
        return new Promise((resolve, reject) => {
            this.requests.set(id, {
                method,
                args,
                resolve,
                reject,
                id,
                sent: false,
            });
        });
    }
    callFnOrdered(method, args) {
        const id = this.idCreator.next();
        // console.log(`top fn called id:${id}`)
        return new Promise((resolve, reject) => {
            this.requestsOrdered.set(id, {
                method,
                args,
                resolve,
                reject,
                id,
                sent: false,
            });
        });
    }
    /**
     * Send event without ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEvent(event) {
        // console.log(`top send event len:${event.length}`, event)
        this.events.push(event);
    }
    /**
     * Send event with guaranteed ordering
     * @function sendEvent
     * @param {Buffer} event Event to send
     */
    sendEventOrdered(event) {
        // console.log(`top send event len:${event.length}`, event)
        this.eventsOrdered.push(event);
    }
    /**
     * Emit message with all unsent data
     * @function send
     */
    send() {
        const reqRpc = {};
        this.requests.forEach((val, key) => {
            if (val.sent)
                return;
            val.sent = true;
            reqRpc[key] = {
                method: val.method,
                args: val.args,
            };
            if (val.args)
                reqRpc[key].args = val.args;
        });
        const reqRpcOrdered = {};
        this.requestsOrdered.forEach((val, key) => {
            if (val.sent)
                return;
            val.sent = true;
            reqRpcOrdered[key] = {
                method: val.method,
            };
            if (val.args)
                reqRpcOrdered[key].args = val.args;
        });
        const resRpc = Object.fromEntries(this.responses);
        this.responses.clear();
        const objSync = diff(this.obj, this.remoteObj);
        const objDelete = addedDiff(this.remoteObj, this.obj);
        this.remoteObj = JSON.parse(JSON.stringify(this.obj));
        const { events, eventsOrdered } = this;
        this.events = [];
        this.eventsOrdered = [];
        const finishedObject = {
            reqRpcOrdered,
            reqRpc,
            resRpc,
            objSync,
            objDelete,
            events,
            eventsOrdered,
        };
        const cleanedObject = removeUndefinedAndEmpty(finishedObject);
        const buf = pbEncode(cleanedObject);
        this.emit("send", buf);
        return buf;
    }
}
//# sourceMappingURL=libTop.js.map