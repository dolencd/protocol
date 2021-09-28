const { join: pathJoin } = require("path");
const dgramCreateSocket = require("dgram").createSocket;
const { createServer, decodeSessionId, encodeSessionId } = require("../dist");

const clients = new Map();

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

// The example does not use any kind of authentication
function authFn() {
    return true;
}

async function handleNewClient(sessionId, protocol) {
    protocol.on("event", (event) => {
        console.log(sessionId, "got event", event);
    });

    protocol.on("call", (method, args, cb) => {
        console.log(sessionId, "got method call", method, args);
        switch (method) {
            case "methodA":
                cb(null, Buffer.allocUnsafe(8));
                break;
            case "methodB":
                cb();
                break;
            default:
                console.error("unknown method"); // if this is in line with the .proto, this should not be possible
        }
    });

    protocol.on("objSync", (obj) => {
        console.log(sessionId, "got object update", obj);
    });
}

const server = dgramCreateSocket("udp4");

server.on("message", async (msg, rinfo) => {
    const decodedMessage = decodeSessionId(msg);
    let sessionId = decodedMessage[0];
    const msgPayload = decodedMessage[2];

    if (sessionId !== 0 && clients.has(sessionId)) {
        const client = clients.get(sessionId);
        client.rinfo = rinfo;
        client.protocol.receiveMessage(msgPayload);
    } else {
        // this is too permissive. an unknown sessionId is treated the same as 0 when it should reject
        do {
            sessionId = idCreator.next();
        } while (clients.has(sessionId));

        console.log("new session", sessionId);

        const [protocol, resMessage, error] = await createServer(
            {
                autoRetransmit: true,
                autoAckAfterMessages: 10,
                enableOrdering: true,
                protoPath: pathJoin(__dirname, "main.proto"),
            },
            msgPayload,
            authFn
        );

        if (error) {
            console.log("client rejected", sessionId, rinfo.address, rinfo.port, error);
            server.send(encodeSessionId(sessionId, resMessage), rinfo.port, rinfo.address);
            return;
        }

        await handleNewClient(sessionId, protocol);
        protocol.on("send", (sendMsg) => {
            server.send(encodeSessionId(sessionId, sendMsg), rinfo.port, rinfo.address);
        });

        server.send(encodeSessionId(sessionId, resMessage), rinfo.port, rinfo.address);

        protocol.outObj.sendInterval = 800;
        protocol.outObj.eventAInterval = 900;
        protocol.outObj.eventBInterval = 1100;
        protocol.outObj.callMethodAInterval = 1100;
        protocol.outObj.callMethodBInterval = 500;
        protocol.outObj.valUpdateInterval = 700;
        protocol.send();

        clients.set(sessionId, {
            protocol,
            rinfo,
        });
    }
});

server.bind(parseInt(process.argv[2], 10));
console.log("Server ready");
