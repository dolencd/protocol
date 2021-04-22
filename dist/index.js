var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { encodeSessionId, encodeSeqAck } from "./transcoder";
import { Protocol } from "./Protocol";
import { encode as pbEncode, decode as pbDecode } from "./PbTranscoder";
export { decodeClientId, encodeClientId, decodeSessionId, encodeSessionId } from "./transcoder";
/**
 * Create server
 * @param {ProtocolOptions} options Options to use. See ProtocolOptions
 * @param {Buffer} initialMessage First message that was received (contains authentication information)
 * @param {(Buffer) => true | ErrorObject} authFn Function to test if client should be allowed to connect
 * @returns {[Protocol, Buffer, ErrorObject]}
 */
export function createServer(options, initialMessage, authFn) {
    return __awaiter(this, void 0, void 0, function* () {
        const errObj = {};
        try {
            const decodedObject = pbDecode(initialMessage);
            const authRes = authFn ? yield authFn(decodedObject.auth) : true;
            if (authRes !== true) {
                if (typeof authRes === "object") {
                    errObj.code = authRes.code || 400;
                    if (authRes.reason)
                        errObj.reason = authRes.reason;
                }
            }
        }
        catch (_) {
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
        yield protocol.tp.receiveMessage(initialMessage); // receiveMessage needs to become async
        const buf = protocol.send();
        return [protocol, buf, null];
    });
}
/**
 * Create a new client
 * @param options {ProtocolOptions} Options to use. See the ProtocolOptions page
 * @param authMessage {Buffer} Buffer containing authentication information
 * @returns {[protocol, messageToSend, error]}
 */
export function createClient(options, authMessage) {
    return [
        new Protocol(options),
        encodeSessionId(0, pbEncode({
            auth: authMessage || undefined,
        })),
        null,
    ];
}
//# sourceMappingURL=index.js.map