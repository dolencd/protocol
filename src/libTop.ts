import * as protobuf from "protobufjs";
import * as EventEmitter from "events";
import { isEmpty } from "lodash";
import { diff, addedDiff } from "deep-object-diff";
import IdCreator from "./idCreator";

/**
 * Deep diff between two object, using lodash
 * @param  {Object} object Object compared
 * @param  {Object} base   Object to compare with
 * @return {Object}        Return a new object who represent the diff
 */
// function difference(object: Object, base: any) {
// 	return transform(object, (result: any, value:any, key: string) => {
// 		if (!isEqual(value, base[key])) {
// 			result[key] = isObject(value) && isObject(base[key]) ? difference(value, base[key]) : value;
// 		}
// 	});
// }

function removeUndefinedAndEmpty(o: any) {
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
    remoteObj: any;

    obj: any;

    responses: Map<number, { returns: Buffer }>;

    requests: Map<
        number,
        {
            id: number;
            args: Buffer;
            method: string;
            cb: Function;
            sent: boolean;
        }
    >;

    events: Array<Buffer>;

    mainType: protobuf.Type;

    idCreator: IdCreator;

    constructor() {
        super();
        const protoRoot = protobuf.loadSync("protocol.proto");
        this.mainType = protoRoot.lookupType("main");

        this.idCreator = new IdCreator(1, 65530);

        this.remoteObj = {};
        this.obj = {};

        this.responses = new Map();
        this.requests = new Map();
        this.events = [];
    }

    decodeMessage(buf: Buffer) {
        const msg = this.mainType.decode(buf);
        const obj = this.mainType.toObject(msg, {
            enums: String,
        });

        return obj;
    }

    encodeMessage(obj: Record<string, any>) {
        // const err = this.mainType.verify(obj)
        // if(err) {
        //     throw new Error(err)
        // }
        // console.log("testt", obj)
        const msg = this.mainType.fromObject(obj);
        const buf = this.mainType.encode(msg).finish();

        return buf;
    }

    acceptMessage(binMsg: Buffer) {
        // console.log("top accept", binMsg.length)
        const obj = this.decodeMessage(binMsg);

        // console.log("top decoded", obj)
        if (obj.events)
            obj.events.map((buf: Buffer) => {
                this.emit("event", buf);
            });

        // send rpc - what i want the other process to do
        // receive fn to run
        if (obj.reqRpc) {
            Object.keys(obj.reqRpc).map((id) => {
                const rpcObj = obj.reqRpc[id];
                if (!rpcObj.method) {
                    console.error(`top rpc call without method name id:${id}`, obj);
                }
                // console.log(`top got fn call id:${id} method:${util.inspect(rpcObj)}`)
                this.emit(
                    `m:${rpcObj.method}`,
                    rpcObj.args,
                    ((reqId: number, resultBuf: Buffer) => {
                        this.responses.set(reqId, { returns: resultBuf });
                        // console.log(`top fn call processed id:${id} method:${rpcObj.method}`)
                    }).bind(this, id)
                );
            });
        }

        // receive rpc - responses that were received
        if (obj.resRpc) {
            Object.keys(obj.resRpc).map((id) => {
                const idn = Number.parseInt(id, 10);
                const callObj = this.requests.get(idn);

                if (!obj.resRpc[id] || !obj.resRpc[id].returns) {
                    console.error("missing values rrpc", obj.resRpc, id);
                    return;
                }
                callObj.cb(obj.resRpc[id].returns);
                this.requests.delete(idn);
            });
        }
        // call RPC

        // if (obj.objSync) {
        //     this.lastSync = obj.objSync
        //     // console.log("got sync", obj.objSync)
        // }

        // if (obj.objDelete) {
        //     this.lastDelete = obj.objDelete
        //     // console.log("got delete", obj.objDelete)
        // }
    }

    callFn(method: string, args: Buffer, cb: Function) {
        const id = this.idCreator.next();
        // console.log(`top fn called id:${id}`)
        this.requests.set(id, {
            method,
            args,
            cb,
            id,
            sent: false,
        });
    }

    sendEvent(event: Buffer) {
        // console.log(`top send event len:${event.length}`, event)
        this.events.push(event);
        // console.log("prepared event for sending")
    }

    send() {
        const reqRpc: any = {};
        Object.values(this.requests).map((val) => {
            if (val.sent) return;
            val.sent = true;
            reqRpc[val.id] = {
                method: val.method,
                args: val.args,
            };
        });

        const resRpc = Object.fromEntries(this.responses);
        this.responses.clear();

        const objSync = diff(this.obj, this.remoteObj);
        const objDelete = addedDiff(this.remoteObj, this.obj);
        this.remoteObj = JSON.parse(JSON.stringify(this.obj));

        const { events } = this;
        this.events = [];

        const finishedObject = {
            reqRpc,
            resRpc,
            objSync,
            objDelete,
            events,
        };
        const cleanedObject = removeUndefinedAndEmpty(finishedObject);
        const buf = this.encodeMessage(cleanedObject);
        // console.log(`top sending len:${buf.length}`)
        this.emit("send", buf);
        // console.log("send", buf.length)
        // console.log(finishedObject)
        // console.log(cleanedObject)
        // console.log(buf.toString("hex"))

        return buf;
    }
}
