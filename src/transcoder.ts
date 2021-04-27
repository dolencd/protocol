const SEQ_LEN = 2;
const SES_LEN = 2;

/**
 * Decodes ClientId.
 * Expects message in format: `<1B length><Id of given length><Other data>`
 * @param buf {Buffer} Input message
 * @returns {[Buffer, Buffer]} First is the Id, then the other data.
 */
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

/**
 * Encodes ClientId.
 * Creates the following format: `<1B length><Id of given length><Other data>`
 * @param clientId {Buffer} Client Id in the form of a Buffer. Cannot be longer than 255B.
 * @param rest {Buffer} Remaining data to encode
 * @returns {Buffer} The encoded Buffer
 */
export function encodeClientId(clientId: Buffer, rest = Buffer.from("")): Buffer {
    if (!Buffer.isBuffer(clientId) || !Buffer.isBuffer(rest)) {
        throw new TypeError("Input should be Buffer");
    }
    if (clientId.length > 255) {
        throw new Error(`clientId too large${clientId}`);
    }
    return Buffer.concat([Buffer.from([clientId.length]), clientId, rest]);
}

/**
 * Decode sequence number and acknowledgement numbers from the provided Buffer. Expects numbers to be encoded in Little Endian.
 * @param buf {Buffer} Buffer to decode.
 * @returns {[number, Array<number>, Buffer]} The sequence number, acknowledgement numbers and remaining message.
 */
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

/**
 * Encode sequence number and acknowledgement numbers together with the remaining Buffer. Numbers are encoded with Little Endian.
 * @param seq {number} Sequence number. Must be in [0, 65535].
 * @param acks {Array<number>} Array of acknowledgements. Each acknowledgement must be in [0, 65535].
 * @param rest {Buffer} Remaining message
 * @returns {Buffer} The encoded message
 */
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

/**
 * Decode SessionId from Buffer. Reads the first 2B as UInt16 using Little Endian.
 * @param buf {Buffer} Input Buffer
 * @returns {[number, Buffer]} The decoded SessionId and the remaining message.
 */
export function decodeSessionId(buf: Buffer): [number, Buffer] {
    if (!Buffer.isBuffer(buf)) {
        throw new TypeError("Input should be Buffer");
    }
    if (buf.length < SES_LEN) {
        throw new Error("Buffer too short");
    }
    return [buf.readUInt16LE(0), buf.slice(SES_LEN)];
}

/**
 * Encodes SessionId together with the remaining Buffer. Writes UInt16 using Little Endian.
 * @param sessionId {number} The SessionId to write. Must be in [0, 65535].
 * @param rest {Buffer} Remaining message to encode
 * @returns {Buffer} Encoded message.
 */
export function encodeSessionId(sessionId: number, rest = Buffer.allocUnsafe(0)): Buffer {
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
