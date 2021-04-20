import { encodeSessionId, encodeSeqAck } from "./transcoder";
import { Protocol, ProtocolOptions } from "./Protocol";
import { encode as pbEncode, decode as pbDecode } from "./PbTranscoder";

export { Protocol, ProtocolOptions } from "./Protocol";
export { decodeClientId, encodeClientId, decodeSessionId, encodeSessionId } from "./transcoder";

interface ErrorObject {
    code?: number;
    reason?: string;
}

/**
 * Create server
 * @param {Buffer} initialMessage Message that was
 * @param {boolean} enableOrdering Enable LibBot
 * @param {(Buffer) => true | ErrorObject} authFn Function to test if client should be allowed to connect
 * @returns {[Protocol, Buffer, ErrorObject]}
 */
export async function createServer(
    options: ProtocolOptions,
    initialMessage: Buffer,
    authFn?: (authBuf: Buffer) => true | { code?: number; reason?: string }
): Promise<[Protocol, Buffer, ErrorObject?]> {
    const errObj: ErrorObject = {};
    try {
        const decodedObject = pbDecode(initialMessage);

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
            return [null, encodeSeqAck(0, [], pbEncode(errObj)), errObj];
        }
        return [null, pbEncode(errObj), errObj];
    }

    // auth is OK
    const protocol = new Protocol(options);
    await protocol.tp.receiveMessage(initialMessage); // receiveMessage needs to become async
    const buf = protocol.send();
    return [protocol, buf, null];
}

/**
 * Create a new client
 * @param authMessage {Buffer} Buffer to use for authentication
 * @param enableOrdering {boolean} Enable LibBot or not
 * @returns [protocol, messageToSend, error]
 */
export function createClient(options: ProtocolOptions, authMessage: Buffer): [Protocol, Buffer, ErrorObject?] {
    return [
        new Protocol(options),
        encodeSessionId(
            0,
            pbEncode({
                auth: authMessage || undefined,
            })
        ),
        null,
    ];
}
