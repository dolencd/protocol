import { loadSync as pbLoadSync, Type as pbType } from "protobufjs";

export default class ProtoTranscoder {
    private type: pbType;

    constructor(protoPath: string, typeName = "main") {
        this.type = pbLoadSync(protoPath).lookupType(typeName);
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
