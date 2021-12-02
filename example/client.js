const { createSocket } = require("dgram");
const { join: pathJoin } = require("path");
const { once } = require("events");
const { createClient, encodeSessionId, decodeSessionId, PbTranscoder } = require("..");
const { decodeSeqAck } = require("../dist/transcoder");

// node client.js <origin port> <host address> <host port> <deviceId> <deviceTypeName>
// node client.js 3000 localhost 5000 someid sometype
const opts = {
    origin_port: parseInt(process.argv[2], 10),
    host_addr: process.argv[3],
    host_port: parseInt(process.argv[4], 10),
    deviceId: process.argv[5],
    deviceTypeName: process.argv[6],
};

// eslint-disable-next-line camelcase
async function main({ origin_port, host_addr, host_port, deviceId, deviceTypeName }) {
    console.log(opts);
    const server = createSocket("udp4");
    server.bind(origin_port);

    const [protocol, firstMsg] = createClient(
        {
            autoRetransmit: true,
            autoAckOnFailedMessages: 1,
            enableOrdering: true,
            protoPath: pathJoin(__dirname, "main.proto"),
        },
        {
            deviceId: Buffer.from(deviceId, "ascii"),
            deviceTypeName: Buffer.from(deviceTypeName, "ascii"),
        }
    );

    const retransmitFirstMessageInterval = setInterval(() => {
        console.log(deviceId, "retransmitting first message");
        server.send(firstMsg, host_port, host_addr);
    }, 5000);
    server.send(firstMsg, host_port, host_addr);
    const firstRes = await once(server, "message");
    clearInterval(retransmitFirstMessageInterval);

    const [sessionId, firstResMsg] = decodeSessionId(firstRes[0]);

    if (sessionId === 0) {
        // fail connection
        console.error(deviceId, "Connection failed", PbTranscoder.decode(firstResMsg));
        return;
    }
    console.log(deviceId, "Connected", sessionId);

    protocol.on("send", (buf) => {
        // if (Math.random() > 0.6) {
        //     console.log('lost', decodeSeqAck(buf)[0], decodeSeqAck(buf)[1]);
        //     return;
        // } else {
        // console.log(
        //     'send',
        //     decodeSeqAck(buf)[0],
        //     decodeSeqAck(buf)[1],
        //     decodeSeqAck(buf)[2].toString('hex')
        // );
        // }

        server.send(encodeSessionId(sessionId, buf), host_port, host_addr);
    });

    server.on("message", (msg) => {
        const [, msgPayload] = decodeSessionId(msg);
        // if (Math.random() > 0.6) {
        //     console.log(
        //         'lost on receive',
        //         decodeSeqAck(msgPayload)[0],
        //         decodeSeqAck(msgPayload)[1]
        //     );
        //     return;
        // }

        // console.log(
        //     deviceId,
        //     'got message',
        //     sessionId,
        //     msgPayload.toString('hex')
        // );
        // console.log(
        //     deviceId,
        //     decodeSeqAck(msgPayload)[0],
        //     decodeSeqAck(msgPayload)[1],
        //     Array.from(protocol.bt.sent.keys()),
        //     Array.from(protocol.bt.sendFail.keys())
        // );
        // if (Math.random() < 0.05) console.log(
        //     deviceId,
        //     'to send from receive',
        // protocol.receiveMessage(msgPayload)[1].map((m) => {
        //     return decodeSeqAck(m)[0];
        // })
        // );
        protocol.receiveMessage(msgPayload);
    });

    let sendInterval;
    let eventAInterval;
    let eventBInterval;
    let eventACount = 0;
    let eventBCount = 0;
    let callMethodAInterval;
    let callMethodBInterval;
    let valUpdateInterval;
    protocol.on("objSync", (obj) => {
        console.log(deviceId, "got new config", obj);
        if (Object.prototype.hasOwnProperty.call(obj, "sendInterval")) {
            if (sendInterval) clearInterval(sendInterval);
            if (obj.sendInterval !== 0)
                sendInterval = setInterval(() => {
                    // if (Math.random() < 0.05) console.log(deviceId, 'sending', protocol.maxSendSeq + 1);
                    protocol.send();
                }, obj.sendInterval);
        }

        if (Object.prototype.hasOwnProperty.call(obj, "eventAInterval")) {
            if (eventAInterval) clearInterval(eventAInterval);
            if (obj.eventAInterval !== 0)
                eventAInterval = setInterval(() => {
                    eventACount++;
                    const buf = Buffer.allocUnsafe(4);
                    buf.writeUInt32LE(eventACount);
                    protocol.sendEvent(buf);
                }, obj.eventAInterval);
        }

        if (Object.prototype.hasOwnProperty.call(obj, "eventBInterval")) {
            if (eventBInterval) clearInterval(eventBInterval);
            if (obj.eventBInterval !== 0)
                eventBInterval = setInterval(() => {
                    eventBCount++;
                    const buf = Buffer.allocUnsafe(4);
                    buf.writeUInt32LE(eventBCount);
                    protocol.sendEventOrdered(buf);
                }, obj.eventBInterval);
        }

        if (Object.prototype.hasOwnProperty.call(obj, "callMethodAInterval")) {
            if (callMethodAInterval) clearInterval(callMethodAInterval);
            if (obj.callMethodAInterval !== 0)
                callMethodAInterval = setInterval(() => {
                    protocol
                        .callFn("methodA", Buffer.from([1, 2, 3, 4]))
                        .catch((res) => {
                            console.log(deviceId, "MethodA returned error", res?.toString("hex"));
                        })
                        .then((res) => {
                            console.log(deviceId, "MethodA got response", res?.toString("hex"));
                        });
                }, obj.callMethodAInterval);
        }

        if (Object.prototype.hasOwnProperty.call(obj, "callMethodBInterval")) {
            if (callMethodBInterval) clearInterval(callMethodBInterval);
            if (obj.callMethodBInterval !== 0)
                callMethodBInterval = setInterval(() => {
                    protocol
                        .callFnOrdered("methodB", Buffer.from([1, 2, 3, 4]))
                        .catch((res) => {
                            console.log(deviceId, "MethodB returned error", res?.toString("hex"));
                        })
                        .then((res) => {
                            console.log(deviceId, "MethodB got response", res?.toString("hex"));
                        });
                }, obj.callMethodBInterval);
        }

        if (Object.prototype.hasOwnProperty.call(obj, "valUpdateInterval")) {
            if (valUpdateInterval) clearInterval(valUpdateInterval);
            if (obj.valUpdateInterval !== 0)
                valUpdateInterval = setInterval(() => {
                    if (protocol.outObj.num && Math.random() > 0.5) delete protocol.outObj.num;
                    if (protocol.outObj.num && Math.random() > 0.5) delete protocol.outObj.str;
                    if (Math.random() > 0.5) protocol.outObj.num = Math.round(Math.random() * 60000);
                    if (Math.random() > 0.5) protocol.outObj.str = Math.round(Math.random() * 60000).toString();
                }, obj.valUpdateInterval);
        }
    });

    protocol.receiveMessage(firstResMsg);
}
module.exports = main;
// main(opts).catch((e) => {
//     console.error('Error', e);
//     process.exit(1);
// });
