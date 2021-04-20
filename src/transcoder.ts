const SEQ_LEN = 2;
const SES_LEN = 2;

export function decodeClientId(buf: Buffer): [Buffer, Buffer] {
    if (!Buffer.isBuffer(buf)) {
        throw new TypeError("Input should be Buffer");
    }
    if (buf.length < 2) {
        throw new Error("buffer too short");
    }
    const l = buf.readUInt8(0);
    if (buf.length < l + 1) {
        throw new Error("buffer too short");
    }
    return [buf.slice(1, 1 + l), buf.slice(1 + l)];
}

export function encodeClientId(clientId: Buffer, rest = Buffer.from("")): Buffer {
    if (!Buffer.isBuffer(clientId) || !Buffer.isBuffer(rest)) {
        throw new TypeError("Input should be Buffer");
    }
    if (clientId.length > 255) {
        throw new Error(`clientId too large${clientId}`);
    }
    return Buffer.concat([Buffer.from([clientId.length]), clientId, rest]);
}

export function decodeSeqAck(buf: Buffer): [number, Array<number>, Buffer] {
    if (!Buffer.isBuffer(buf)) {
        throw new TypeError("Input should be Buffer");
    }

    let requiredLengthMin = SEQ_LEN + 1;
    if (buf.length < requiredLengthMin) {
        throw new Error(`Buffer too short. is:${buf.length} min:${requiredLengthMin}`);
    }
    let offset = 0;
    const seq = buf.readUInt16LE(offset);
    offset += SEQ_LEN;
    const ackLen = buf.readUInt8(offset);
    offset += 1;

    requiredLengthMin += ackLen * SEQ_LEN;
    if (buf.length < requiredLengthMin) {
        throw new Error(`Buffer too short. is:${buf.length} min:${requiredLengthMin}`);
    }

    const acks = [];
    for (let i = 0; i < ackLen; i++) {
        const ack = buf.readUInt16LE(offset);
        offset += SEQ_LEN;
        if (ack !== 0) {
            acks.push(ack);
            continue;
        }

        requiredLengthMin += 2 * SEQ_LEN;
        if (buf.length < requiredLengthMin) {
            throw new Error(`Buffer too short. is:${buf.length} min:${requiredLengthMin}`);
        }
        let ack1 = buf.readUInt16LE(offset);
        offset += SEQ_LEN;
        const ack2 = buf.readUInt16LE(offset);
        offset += SEQ_LEN;

        for (; ack1 <= ack2; ack1++) {
            acks.push(ack1);
        }
    }

    return [seq, acks, buf.slice(offset)];
}

export function encodeSeqAck(seq: number, acks: Array<number> = [], rest: Buffer = Buffer.alloc(0)): Buffer {
    if (!Buffer.isBuffer(rest)) {
        throw new TypeError("Input should be Buffer");
    }
    if (acks.length > 255) {
        throw new Error("seq too high");
    }

    acks.map((v) => {
        if (!Number.isInteger(v) || v > 65535 || v < 0) {
            throw new Error(`All acks must be int in [0,65535]. This is:${v} of type:${typeof v}`);
        }
    });

    const output = Buffer.alloc(SEQ_LEN + 1);

    output.writeUInt16LE(seq, 0);
    output.writeUInt8(acks.length, SEQ_LEN);

    const acksBuf = Buffer.from(new Uint16Array(acks).buffer);

    return Buffer.concat([output, acksBuf, rest]);
}

export function decodeSessionId(buf: Buffer): [number, Buffer] {
    if (!Buffer.isBuffer(buf)) {
        throw new TypeError("Input should be Buffer");
    }
    if (buf.length < SES_LEN) {
        throw new Error("Buffer too short");
    }
    return [buf.readUInt16LE(0), buf.slice(SES_LEN)];
}

export function encodeSessionId(sessionId: number, rest = Buffer.from("")): Buffer {
    if (!Buffer.isBuffer(rest)) {
        throw new TypeError("Input should be Buffer");
    }
    if (!Number.isInteger(sessionId) || sessionId > 65535 || sessionId < 0) {
        throw new Error("SessionId must be in [1, 65535]");
    }
    const output = Buffer.alloc(SES_LEN);
    output.writeUInt16LE(sessionId, 0);
    return Buffer.concat([output, rest]);
}
