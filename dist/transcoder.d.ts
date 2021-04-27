/// <reference types="node" />
/**
 * Decodes ClientId.
 * Expects message in format: `<1B length><Id of given length><Other data>`
 * @param buf {Buffer} Input message
 * @returns {[Buffer, Buffer]} First is the Id, then the other data.
 */
export declare function decodeClientId(buf: Buffer): [Buffer, Buffer];
/**
 * Encodes ClientId.
 * Creates the following format: `<1B length><Id of given length><Other data>`
 * @param clientId {Buffer} Client Id in the form of a Buffer. Cannot be longer than 255B.
 * @param rest {Buffer} Remaining data to encode
 * @returns {Buffer} The encoded Buffer
 */
export declare function encodeClientId(clientId: Buffer, rest?: Buffer): Buffer;
/**
 * Decode sequence number and acknowledgement numbers from the provided Buffer. Expects numbers to be encoded in Little Endian.
 * @param buf {Buffer} Buffer to decode.
 * @returns {[number, Array<number>, Buffer]} The sequence number, acknowledgement numbers and remaining message.
 */
export declare function decodeSeqAck(buf: Buffer): [number, Array<number>, Buffer];
/**
 * Encode sequence number and acknowledgement numbers together with the remaining Buffer. Numbers are encoded with Little Endian.
 * @param seq {number} Sequence number. Must be in [0, 65535].
 * @param acks {Array<number>} Array of acknowledgements. Each acknowledgement must be in [0, 65535].
 * @param rest {Buffer} Remaining message
 * @returns {Buffer} The encoded message
 */
export declare function encodeSeqAck(seq: number, acks?: Array<number>, rest?: Buffer): Buffer;
/**
 * Decode SessionId from Buffer. Reads the first 2B as UInt16 using Little Endian.
 * @param buf {Buffer} Input Buffer
 * @returns {[number, Buffer]} The decoded SessionId and the remaining message.
 */
export declare function decodeSessionId(buf: Buffer): [number, Buffer];
/**
 * Encodes SessionId together with the remaining Buffer. Writes UInt16 using Little Endian.
 * @param sessionId {number} The SessionId to write. Must be in [0, 65535].
 * @param rest {Buffer} Remaining message to encode
 * @returns {Buffer} Encoded message.
 */
export declare function encodeSessionId(sessionId: number, rest?: Buffer): Buffer;
