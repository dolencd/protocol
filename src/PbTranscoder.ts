import { Field, loadSync as pbLoadSync, Root, Type } from "protobufjs";
import { join } from "path";

const mainRoot = pbLoadSync(join(__dirname, "../protocol.proto"));
const mainRootObj = mainRoot.toJSON();
const mainType = mainRoot.lookupType("main");

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
     * Name of the type to use for deleting. Must be present in the .proto file. Should be the same as the type used for syncing, but with all values being booleans. Default: "objBool"
     */
    delType?: string;

    /**
     * Name of the enum to be used for the method name. Must be present in the .proto file. Default: "methods"
     */
    methodEnumName?: string;

    /**
     * JSON Representation of ProtocolBuffers Types. When passed, this will be exclusively used to initialize PbTranscoder
     */
    JSONRoot?: string;
}

export class PbTranscoder {
    private root: Root;

    private type: Type;

    readonly JSONRoot: string;

    constructor({
        protoPath,
        syncType = "obj",
        delType = "objBool",
        methodEnumName = "methods",
        JSONRoot,
    }: PbTranscoderOptions) {
        this.root = new Root();
        if (JSONRoot) {
            Root.fromJSON(JSON.parse(JSONRoot), this.root);
            this.JSONRoot = JSONRoot;
        } else if (protoPath) {
            this.root.loadSync(protoPath);
            this.JSONRoot = JSON.stringify(this.root.toJSON());
        } else {
            // error
        }

        Root.fromJSON(mainRootObj, this.root);

        this.root.lookupType("rpcCall").add(new Field("method", 3, methodEnumName));
        this.type = this.root.lookupType("main");
        this.type.add(new Field("objAll", 20, syncType));
        this.type.add(new Field("objSync", 21, syncType));
        this.type.add(new Field("objDelete", 22, delType));
    }

    getJSONRoot() {
        return this.JSONRoot;
    }

    static decode(buf: Buffer, type = mainType) {
        const msg = type.decode(buf);
        const obj = type.toObject(msg, {
            enums: String,
        });

        return obj;
    }

    decode(buf: Buffer) {
        return PbTranscoder.decode(buf, this.type);
    }

    static encode(obj: Record<string, any>, type = mainType) {
        // const err = this.mainType.verify(obj)
        // if(err) {
        //     throw new Error(err)
        // }
        // console.log("testt", obj)
        const msg = type.fromObject(obj);
        const buf = Buffer.from(type.encode(msg).finish());

        return buf;
    }

    encode(obj: Record<string, any>) {
        return PbTranscoder.encode(obj, this.type);
    }
}
