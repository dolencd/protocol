"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = exports.decode = void 0;
const protobufjs_1 = require("protobufjs");
const path_1 = require("path");
const type = protobufjs_1.loadSync(path_1.join(__dirname, "../protocol.proto")).lookupType("main");
function decode(buf) {
    const msg = type.decode(buf);
    const obj = type.toObject(msg, {
        enums: String,
    });
    return obj;
}
exports.decode = decode;
function encode(obj) {
    // const err = this.mainType.verify(obj)
    // if(err) {
    //     throw new Error(err)
    // }
    // console.log("testt", obj)
    const msg = type.fromObject(obj);
    const buf = Buffer.from(type.encode(msg).finish());
    return buf;
}
exports.encode = encode;
//# sourceMappingURL=PbTranscoder.js.map