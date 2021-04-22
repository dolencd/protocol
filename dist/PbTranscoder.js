import { loadSync as pbLoadSync } from "protobufjs";
const type = pbLoadSync("./protocol.proto").lookupType("main");
export function decode(buf) {
    const msg = type.decode(buf);
    const obj = type.toObject(msg, {
        enums: String,
    });
    return obj;
}
export function encode(obj) {
    // const err = this.mainType.verify(obj)
    // if(err) {
    //     throw new Error(err)
    // }
    // console.log("testt", obj)
    const msg = type.fromObject(obj);
    const buf = Buffer.from(type.encode(msg).finish());
    return buf;
}
//# sourceMappingURL=PbTranscoder.js.map