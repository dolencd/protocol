export default class Transcoder {
    sesLen: number;

    seqLen: number;

    constructor({ sesLen, seqLen }: { sesLen?: number; seqLen?: number } = {}) {
        this.sesLen = sesLen || 2;
        this.seqLen = seqLen || 2;
    }

    static decodeClientId(buf: Buffer): [Buffer, Buffer] {
        if (buf.length < 2) {
            throw new Error("buffer too short");
        }
        const l = buf.readUInt8(0);
        if (buf.length < l + 1) {
            throw new Error("buffer too short");
        }
        return [buf.slice(1, 1 + l), buf.slice(1 + l)];
    }

    static encodeClientId(clientId: Buffer, rest = Buffer.from("")): Buffer {
        if (clientId.length > 255) {
            throw new Error(`clientId too large${clientId}`);
        }
        return Buffer.concat([Buffer.from([clientId.length]), clientId, rest]);
    }

    decodeSeqAck(buf: Buffer): [number, Array<number>, Buffer] {
        let offset = 0;
        const seq = buf.readUInt16LE(offset);
        offset += this.seqLen;
        const ackLen = buf.readUInt8(offset);
        offset += 1;
        // todo: guard length
        const acks = [];
        for (let i = 0; i < ackLen; i++) {
            const ack = buf.readUInt16LE(offset);
            offset += this.seqLen;
            if (ack !== 0) {
                acks.push(ack);
                continue;
            }

            let ack1 = buf.readUInt16LE(offset);
            offset += this.seqLen;
            const ack2 = buf.readUInt16LE(offset);
            offset += this.seqLen;

            for (; ack1 <= ack2; ack1++) {
                acks.push(ack1);
            }
        }

        return [seq, acks, buf.slice(offset)];
    }

    encodeSeqAck(seq: number, acks: Array<number> = [], rest: Buffer = Buffer.alloc(0)): Buffer {
        if (acks.length > 255) {
            throw new Error("seq too high");
        }

        acks.map((v) => {
            if (!Number.isInteger(v) || v > 65535 || v < 1) {
                throw new Error(`All acks must be int in [1,65535]. This is:${v} of type:${typeof v}`);
            }
        });

        const output = Buffer.alloc(this.seqLen + 1);

        output.writeUInt16LE(seq, 0);
        output.writeUInt8(acks.length, this.seqLen);

        const acksBuf = Buffer.from(new Uint16Array(acks).buffer);

        return Buffer.concat([output, acksBuf, rest]);
    }

    decodeSessionId(buf: Buffer): [number, Buffer] {
        if (buf.length < this.sesLen) {
            throw new Error("Buffer too short");
        }
        return [buf.readUInt16LE(0), buf.slice(this.sesLen)];
    }

    encodeSessionId(sessionId: number, rest = Buffer.from("")): Buffer {
        if (!Number.isInteger(sessionId) || sessionId > 65535 || sessionId < 1) {
            throw new Error("SessionId must be in [1, 65535]");
        }
        const output = Buffer.alloc(this.sesLen);
        output.writeUInt16LE(sessionId, 0);
        return Buffer.concat([output, rest]);
    }
}
