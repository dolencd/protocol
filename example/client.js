const { createSocket } = require("dgram");
const { join: pathJoin } = require("path");
const { createClient, encodeSessionId, decodeSessionId } = require("../dist");

// node client.js <origin port> <host address> <host port>
// node client.js 3000 localhost 5000
const opts = {
    origin_port: parseInt(process.argv[2], 10),
    host_addr: process.argv[3],
    host_port: parseInt(process.argv[4], 10),
};
console.log(opts);

let retransmitFirstMessageInterval;
let mySessionId;

const [protocol, firstMsg] = createClient(
    {
        autoRetransmit: true,
        autoAckOnFailedMessages: 1,
        enableOrdering: true,
        protoPath: pathJoin(__dirname, "main.proto"),
    },
    Buffer.from([])
);

const server = createSocket("udp4");
server.bind(opts.origin_port);
server.on("message", (msg) => {
    const [sessionId, msgPayload] = decodeSessionId(msg);

    if (!mySessionId) {
        mySessionId = sessionId;
    }

    if (sessionId !== mySessionId) {
        console.error(`got different session id!? have:${mySessionId}, got:${sessionId}`);
        return;
    }

    if (retransmitFirstMessageInterval?._destroyed === false) {
        console.log("got response to first message. cancling retries");
        clearInterval(retransmitFirstMessageInterval);
    }

    protocol.receiveMessage(msgPayload);
});

protocol.on("send", (buf) => {
    server.send(encodeSessionId(mySessionId, buf), opts.host_port, opts.host_addr);
});

retransmitFirstMessageInterval = setInterval(() => {
    console.log("retransmitting first message");
    server.send(firstMsg, opts.host_port, opts.host_addr);
}, 5000);
server.send(firstMsg, opts.host_port, opts.host_addr);

let sendInterval;
let eventAInterval;
let eventBInterval;
let callMethodAInterval;
let callMethodBInterval;
let valUpdateInterval;
protocol.on("objSync", (obj) => {
    console.log("got new config", obj);
    if (obj.sendInterval) {
        if (sendInterval) clearInterval(sendInterval);
        sendInterval = setInterval(() => {
            protocol.send();
        }, obj.sendInterval);
    }

    if (obj.eventAInterval) {
        if (eventAInterval) clearInterval(eventAInterval);
        eventAInterval = setInterval(() => {
            protocol.sendEvent(Buffer.allocUnsafe(8));
        }, obj.eventAInterval);
    }

    if (obj.eventBInterval) {
        if (eventBInterval) clearInterval(eventBInterval);
        eventBInterval = setInterval(() => {
            protocol.sendEventOrdered(Buffer.allocUnsafe(8));
        }, obj.eventBInterval);
    }

    if (obj.callMethodAInterval) {
        if (callMethodAInterval) clearInterval(callMethodAInterval);
        callMethodAInterval = setInterval(() => {
            protocol.callFn("methodA", Buffer.from([1, 2, 3, 4]));
        }, obj.callMethodAInterval);
    }

    if (obj.callMethodBInterval) {
        if (callMethodBInterval) clearInterval(callMethodBInterval);
        callMethodBInterval = setInterval(() => {
            protocol.callFnOrdered("methodB", Buffer.from([1, 2, 3, 4]));
        }, obj.callMethodBInterval);
    }

    if (obj.valUpdateInterval) {
        if (obj.valUpdateInterval) clearInterval(valUpdateInterval);
        valUpdateInterval = setInterval(() => {
            protocol.outObj.num = Math.round(Math.random() * 60000);
            protocol.outObj.str = protocol.outObj.num.toString();
        }, obj.valUpdateInterval);
    }
});
