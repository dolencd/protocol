const { join: pathJoin } = require("path");
const dgramCreateSocket = require("dgram").createSocket;
const fetch = require("node-fetch");
const { createServer, decodeSessionId, encodeSessionId, PbTranscoder } = require("..");
// const { decodeSeqAck } = require("../dist/transcoder");

const clients = new Map();

const tc = new PbTranscoder({
    protoPath: pathJoin(__dirname, "main.proto"),
    syncType: "obj",
    delType: "objBool",
    methodEnumName: "methods",
});

const deviceType = {
    eventUrl: "http://localhost:8080/event",
    fnCallUrl: "http://localhost:8080/call",
    fnResUrl: "http://localhost:8080/res",
    objChangeUrl: "http://localhost:8080/objChange",
    authUrl: "http://localhost:8080/auth",
    sendWhenReceiveMessage: true,
    libBotOptions: {
        autoRetransmit: true,
        autoAckOnFailedMessages: 1,
        autoAckAfterMessages: 10,
    },
    outObj: {
        sendInterval: 500,
        eventAInterval: 500,
    },
};

// Used for optimistic sessionId generation
class IdCreator {
    constructor(min, max) {
        this.min = min || 1;
        this.max = max;
        this.curId = min;
    }

    next() {
        const id = this.curId;
        if (id >= this.max) {
            this.curId = this.min;
        } else {
            this.curId++;
        }
        return id;
    }
}
const idCreator = new IdCreator(1, 65535);

// Parses output of protocol.receiveMessage() and sends it to the backend
async function handleProcessedMessage(deviceId, recObj, protocol) {
    const asyncCalls = [];
    if (recObj.events || recObj.eventsOrdered) {
        const sendEvents = async (event) => {
            const response = await fetch(deviceType.eventUrl, {
                method: "POST",
                body: JSON.stringify({
                    type: "event",
                    deviceId,
                    event: event.toString("base64"),
                }),
            }).catch((err) => {
                console.error("send event error", err);
            });

            if (response.status !== 200) {
                console.error("Failed to send event"); // TODO more info
            }
        };

        asyncCalls.push(...(recObj.events || []).concat(recObj.eventsOrdered || []).map(sendEvents));
    }

    if (recObj.rpcCalls) {
        asyncCalls.push(
            ...recObj.rpcCalls.map(async (fnCall) => {
                const body = JSON.stringify({
                    type: "fnCall",
                    method: fnCall.method,
                    deviceId,
                    args: fnCall.args?.toString("base64"),
                });
                const response = await fetch(deviceType.fnCallUrl, {
                    method: "POST",
                    body,
                }).catch((err) => {
                    console.error("send call error", err);
                });

                const resBody = await response.json();

                fnCall.result = {};
                if (resBody.result) fnCall.result.returns = Buffer.from(resBody.result, "base64");
                if (response.status !== 200) fnCall.result.isError = true;

                protocol.tp.sendFnCallResponse(
                    fnCall.id,
                    resBody.result ? Buffer.from(resBody.result, "base64") : null,
                    response.status !== 200
                );
            })
        );
    }

    if (recObj.rpcResults) {
        asyncCalls.push(
            ...recObj.rpcResults.map(async (fnCall) => {
                const res = await fetch(deviceType.fnResUrl, {
                    method: "POST",
                    body: JSON.stringify({
                        type: "fnCallResponse",
                        deviceId,
                        id: fnCall.id,
                        method: fnCall.method,
                        result: fnCall.result.returns?.toString("base64"),
                        isError: fnCall.result.isError,
                    }),
                }).catch((err) => {
                    console.error("send res error", err);
                });

                if (res.status !== 200) {
                    console.error("Failed to send fnCall response"); // TODO more info
                }
            })
        );
    }

    if (recObj.objAll || recObj.objSync || recObj.objDelete) {
        asyncCalls.push(
            (async () => {
                const res = await fetch(deviceType.objChangeUrl, {
                    method: "POST",
                    body: JSON.stringify({
                        type: "objChange",
                        deviceId,
                        objSync: recObj.objSync,
                        objDelete: recObj.objDelete,
                        objAll: recObj.objSync,
                    }),
                }).catch((err) => {
                    if (err) {
                        console.error("send objChange error", err);
                    }
                });

                if (res.status !== 200) {
                    console.error("Failed to send objChange"); // TODO more info
                }
            })()
        );
    }
    await Promise.allSettled(asyncCalls).catch(console.error);
    return recObj;
}

async function authFn(deviceId, authBuf) {
    const res = await fetch(deviceType.authUrl, {
        method: "POST",
        body: JSON.stringify({
            auth: authBuf ? authBuf.toString("base64") : null,
            deviceId,
        }),
    }).catch(console.error);

    return res.status === 200;
}

const server = dgramCreateSocket("udp4");
server.on("message", async (msg, rinfo) => {
    const decodedMessage = decodeSessionId(msg);
    let sessionId = decodedMessage[0];
    const msgPayload = decodedMessage[1];

    // Establish new connection
    if (sessionId === 0) {
        do {
            sessionId = idCreator.next();
        } while (clients.has(sessionId));

        console.log("new session", sessionId);
        const { deviceId } = PbTranscoder.decode(msgPayload);
        const [protocol, resMessage, receivedMessageObject, error] = await createServer(
            {
                transcoder: tc,
                enableOrdering: true,
                ...deviceType.libBotOptions,
            },
            msgPayload,
            authFn.bind(null, deviceId)
        );

        if (error) {
            console.log("client rejected", sessionId, rinfo.address, rinfo.port, error);
            server.send(encodeSessionId(sessionId, resMessage), rinfo.port, rinfo.address);
            return;
        }

        protocol.outObj = deviceType.outObj;
        await handleProcessedMessage(deviceId, receivedMessageObject, protocol);
        clients.set(sessionId, {
            protocol,
            deviceId,
            rinfo,
        });

        server.send(encodeSessionId(sessionId, protocol.send()), rinfo.port, rinfo.address);
        return;
    }

    // Make sure the client exists
    if (!clients.has(sessionId)) {
        server.send(
            encodeSessionId(
                PbTranscoder.encode({
                    code: 400,
                    reason: "SessionId not found",
                })
            ),
            rinfo.port,
            rinfo.address
        );
        return;
    }

    // Process message
    const client = clients.get(sessionId);
    client.rinfo = rinfo;
    // console.log("received", sessionId, decodeSeqAck(msgPayload));
    client.protocol.outObj = deviceType.outObj;
    const [processedMsg, messages] = client.protocol.receiveMessage(msgPayload)
    messages.map((m) => {
        server.send(encodeSessionId(sessionId, m), client.rinfo.port, client.rinfo.address);
    })
    await handleProcessedMessage(client.deviceId, processedMsg, client.protocol);
    if (deviceType.sendWhenReceiveMessage && client.protocol.tp.send(false)[0].length > 0) {
        server.send(encodeSessionId(sessionId, client.protocol.send()), rinfo.port, rinfo.address);
    }
});

server.bind(parseInt(process.argv[2], 10));
console.log("Server ready");
