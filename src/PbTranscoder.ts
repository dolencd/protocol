import { Field, loadSync as pbLoadSync, Root, Type } from "protobufjs";
import { join } from "path";

export interface PbTranscoderOptions {
    /**
     * Path to the .proto file. Default: "./main.proto"
     */
    protoPath?: string;

    /**
     * Name of the type to use for syncing. Must be present in the .proto file. Default: "obj"
     */
    syncType?: string;

    /**
     * Name of the type to use for deleting. Must be present in the .proto file. Should be the same as the type used for syncing, but with all values being booleans. Default: "objDelete"
     */
    delType?: string;

    /**
     * Name of the enum to be used for the method name. Must be present in the .proto file. Default: "methods"
     */
    methodEnumName?: string;
}

export class PbTranscoder {
    root: Root;

    type: Type;

    constructor({
        protoPath = "./main.proto",
        syncType = "obj",
        delType = "objBool",
        methodEnumName = "methods",
    }: PbTranscoderOptions) {
        this.root = pbLoadSync(join(__dirname, "../protocol.proto"));
        this.root.loadSync(protoPath);
        this.type = this.root.lookupType("main");

        this.root.lookupType("rpcCall").add(new Field("method", 3, methodEnumName));
        this.type.add(new Field("objAll", 20, syncType));
        this.type.add(new Field("objSync", 21, syncType));
        this.type.add(new Field("objDelete", 22, delType));
    }

    decode(buf: Buffer) {
        const msg = this.type.decode(buf);
        const obj = this.type.toObject(msg, {
            enums: String,
        });

        return obj;
    }

    encode(obj: Record<string, any>) {
        // const err = this.mainType.verify(obj)
        // if(err) {
        //     throw new Error(err)
        // }
        // console.log("testt", obj)
        const msg = this.type.fromObject(obj);
        const buf = Buffer.from(this.type.encode(msg).finish());

        return buf;
    }
}
