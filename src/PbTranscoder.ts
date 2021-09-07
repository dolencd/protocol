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
    restoreState?: string;
}

/**
 * Transcodes objects according to the protocol buffers spec.
 */
export class PbTranscoder {
    private root: Root;

    private type: Type;

    readonly JSONRoot: Record<string, any>;

    readonly syncType: string;

    readonly delType: string;

    readonly methodEnumName: string;

    constructor({
        protoPath,
        syncType = "obj",
        delType = "objBool",
        methodEnumName = "methods",
        restoreState,
    }: PbTranscoderOptions) {
        this.root = new Root();
        if (restoreState) {
            const parsedSavedState: {
                JSONRoot: Record<string, any>;
                syncType: string;
                delType: string;
                methodEnumName: string;
            } = JSON.parse(restoreState);

            Root.fromJSON(parsedSavedState.JSONRoot, this.root);
            this.JSONRoot = parsedSavedState.JSONRoot;
            this.syncType = parsedSavedState.syncType;
            this.delType = parsedSavedState.delType;
            this.methodEnumName = parsedSavedState.methodEnumName;
        } else if (protoPath) {
            this.root.loadSync(protoPath);
            this.JSONRoot = this.root.toJSON();
            this.syncType = syncType;
            this.delType = delType;
            this.methodEnumName = methodEnumName;
        } else {
            // error
        }

        Root.fromJSON(mainRootObj, this.root);

        this.root.lookupType("rpcCall").add(new Field("method", 3, this.methodEnumName));
        this.type = this.root.lookupType("main");
        this.type.add(new Field("objAll", 20, this.syncType));
        this.type.add(new Field("objSync", 21, this.syncType));
        this.type.add(new Field("objDelete", 22, this.delType));
    }

    /**
     * Returns the string representation of the transcoder. Used for saving and restoring.
     * @returns The state string.
     */
    getState(): string {
        return JSON.stringify({
            JSONRoot: this.JSONRoot,
            syncType: this.syncType,
            delType: this.delType,
            methodEnumName: this.methodEnumName,
        });
    }

    /**
     * Decodes the buffer according to the provided type. Uses the general protocol main type by default. Does not decode service-specific information.
     * @param buf Buffer to decode
     * @param type Type used to decode. Defaults to main protocol type.
     * @returns The decoded object
     */
    static decode(buf: Buffer, type = mainType) {
        const msg = type.decode(buf);
        const obj = type.toObject(msg, {
            enums: String,
        });

        return obj;
    }

    /**
     * Decodes entire protocol object according to the given service spec.
     * @param buf Buffer to decode
     * @returns The decoded object
     */
    decode(buf: Buffer) {
        return PbTranscoder.decode(buf, this.type);
    }

    /**
     * Encodes the object according to the provided type. Uses the general protocol main type by default. Does not encode service-specific information.
     * @param obj Object to encode
     * @param type Type used to encode. Defaults to main protocol type.
     * @returns The encoded Buffer
     */
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

    /**
     * Encodes entire protocol object according to the given service spec.
     * @param obj Object to encode
     * @returns Encoded Buffer.
     */
    encode(obj: Record<string, any>) {
        return PbTranscoder.encode(obj, this.type);
    }
}
