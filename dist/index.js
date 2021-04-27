"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = exports.createServer = void 0;
const transcoder_1 = require("./transcoder");
const Protocol_1 = require("./Protocol");
const PbTranscoder_1 = require("./PbTranscoder");
var transcoder_2 = require("./transcoder");
Object.defineProperty(exports, "decodeClientId", { enumerable: true, get: function () { return transcoder_2.decodeClientId; } });
Object.defineProperty(exports, "encodeClientId", { enumerable: true, get: function () { return transcoder_2.encodeClientId; } });
Object.defineProperty(exports, "decodeSessionId", { enumerable: true, get: function () { return transcoder_2.decodeSessionId; } });
Object.defineProperty(exports, "encodeSessionId", { enumerable: true, get: function () { return transcoder_2.encodeSessionId; } });
/**
 * Create a new server instance. Each instance communicates with 1 client.
 * @param {ProtocolOptions} options Options to use. See ProtocolOptions.
 * @param {Buffer} initialMessage First message that was received (contains authentication information)
 * @param {(Buffer) => true | ErrorObject} authFn Gets the authentication message that was passed to createClient. If it returns true the connection is accepted. Can return an instance of ErrorObject to provide the client a reason for tha failure. If not present, all connections are accepted.
 * @returns {[Protocol, Buffer, ErrorObject]}
 */
function createServer(options, initialMessage, authFn) {
    return __awaiter(this, void 0, void 0, function* () {
        const errObj = {};
        try {
            const decodedObject = PbTranscoder_1.decode(initialMessage);
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
                return [null, transcoder_1.encodeSeqAck(0, [], PbTranscoder_1.encode(errObj)), errObj];
            }
            return [null, PbTranscoder_1.encode(errObj), errObj];
        }
        // auth is OK
        const protocol = new Protocol_1.Protocol(options);
        yield protocol.tp.receiveMessage(initialMessage); // receiveMessage needs to become async
        const buf = protocol.send();
        return [protocol, buf, null];
    });
}
exports.createServer = createServer;
/**
 * Prepare a new client instance
 * @param options {ProtocolOptions} Options to use. See the ProtocolOptions page
 * @param authMessage {Buffer} Buffer containing authentication information. If present, it will be passed to the authentication function on the server.
 * @returns {[Protocol, messageToSend, ErrorObject?]}
 */
function createClient(options, authMessage) {
    return [
        new Protocol_1.Protocol(options),
        transcoder_1.encodeSessionId(0, PbTranscoder_1.encode({
            auth: authMessage || undefined,
        })),
        null,
    ];
}
exports.createClient = createClient;
//# sourceMappingURL=index.js.map