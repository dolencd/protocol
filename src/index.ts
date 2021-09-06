import { encodeSessionId, encodeSeqAck } from "./transcoder";
import { Protocol, ProtocolOptions } from "./Protocol";

import { PbTranscoder } from "./PbTranscoder";

export * from "./serializer";
export { PbTranscoder } from "./PbTranscoder";
export { default as LibTop } from "./libTop";
export { default as LibBot, ReceivedMessage, ReceivedMessageType } from "./libBot";
export type { Protocol, ProtocolOptions } from "./Protocol";
export { decodeClientId, encodeClientId, decodeSessionId, encodeSessionId } from "./transcoder";

export interface ErrorObject {
    code?: number;
    reason?: string;
}

/**
 * Create a new server instance. Each instance communicates with 1 client.
 * @param {ProtocolOptions} options Options to use. See ProtocolOptions.
 * @param {Buffer} initialMessage First message that was received (contains authentication information)
 * @param {(Buffer) => true | ErrorObject} authFn Gets the authentication message that was passed to createClient. If it returns true the connection is accepted. Can return an instance of ErrorObject to provide the client a reason for tha failure. If not present, all connections are accepted.
 * @returns
 */
export async function createServer(
    options: ProtocolOptions,
    initialMessage: Buffer,
    authFn?: (authBuf: Buffer) => true | ErrorObject
): Promise<[Protocol, Buffer, ErrorObject?]> {
    const errObj: ErrorObject = {};
    const transcoder = new PbTranscoder(options);
    options.transcoder = transcoder;

    try {
        const decodedObject = transcoder.decode(initialMessage);

        const authRes = authFn ? await authFn(decodedObject.auth) : true;

        if (authRes !== true) {
            if (typeof authRes === "object") {
                errObj.code = authRes.code || 400;
                if (authRes.reason) errObj.reason = authRes.reason;
            }
        }
    } catch (_) {
        errObj.code = 500;
    }

    if (errObj.code) {
        console.log("connection rejected");
        if (options.enableOrdering) {
            return [null, encodeSeqAck(0, [], transcoder.encode(errObj)), errObj];
        }
        return [null, transcoder.encode(errObj), errObj];
    }

    // auth is OK
    const protocol = new Protocol(options);
    await protocol.tp.receiveMessage(initialMessage); // receiveMessage needs to become async
    const buf = protocol.send();
    return [protocol, buf, null];
}

/**
 * Prepare a new client instance
 * @param options {ProtocolOptions} Options to use. See the ProtocolOptions page
 * @param authMessage {Buffer} Buffer containing authentication information. If present, it will be passed to the authentication function on the server.
 * @returns
 */
export function createClient(options: ProtocolOptions, authMessage?: Buffer): [Protocol, Buffer, ErrorObject?] {
    const transcoder = new PbTranscoder(options);
    options.transcoder = transcoder;
    return [
        new Protocol(options),
        encodeSessionId(
            0,
            transcoder.encode({
                auth: authMessage || undefined,
            })
        ),
        null,
    ];
}
