import LibBot from "../libBot";

describe("Full cycle", () => {
    test("Perfect transmission", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        bt1.on("send", bt2.receiveMessage.bind(bt2));

        const outArr: Array<Buffer> = [];
        bt2.on("message", (buf) => {
            outArr.push(buf);
        });
        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.send(b);
        }

        expect(outArr).toEqual(inputArr);
        expect(outArrOrdered).toEqual(inputArr);

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(19);

        expect(bt2.maxIncSeq).toEqual(19);
        expect(bt2.maxEmittedSeq).toEqual(19);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
    });

    test("Messages arrive in opposite order", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        const messagesInTransit: Array<Buffer> = [];
        bt1.on("send", (msg: Buffer) => {
            messagesInTransit.unshift(msg);
        });

        const outArr: Array<Buffer> = [];
        bt2.on("message", (buf) => {
            outArr.push(buf);
        });
        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.send(b);
        }

        messagesInTransit.map(bt2.receiveMessage.bind(bt2));

        expect(outArrOrdered).toEqual(inputArr);
        expect(outArr).toEqual(inputArr.reverse());

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(19);

        expect(bt2.maxIncSeq).toEqual(19);
        expect(bt2.maxEmittedSeq).toEqual(19);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
    });

    test("Retransmission", (done) => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        let failSomeMessages = true;

        let count = 0;
        bt1.on("send", (msg) => {
            count++;
            if (failSomeMessages && count % 3 === 0) {
                return;
            }
            bt2.receiveMessage.call(bt2, msg);
        });
        bt2.on("send", bt1.receiveMessage.bind(bt1));

        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });

        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.send(b);
        }

        // disable bad network
        failSomeMessages = false;
        // inform
        bt2.sendAcks();
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(6);
        bt1.sendFailedMessages();

        expect(outArrOrdered).toEqual(inputArr);

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(19);

        expect(bt2.maxIncSeq).toEqual(19);
        expect(bt2.maxEmittedSeq).toEqual(19);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
        done();
    });

    test("Retransmission", () => {
        const bt1 = new LibBot({
            autoRetransmit: true,
        });
        const bt2 = new LibBot({
            autoAckOnFailedMessages: 1,
        });
        let count = 0;
        bt1.on("send", (msg) => {
            count++;
            if (count % 5 === 0) {
                return;
            }
            bt2.receiveMessage.call(bt2, msg);
        });
        bt2.on("send", bt1.receiveMessage.bind(bt1));

        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });

        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.send(b);
        }

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(19);

        expect(bt2.maxIncSeq).toEqual(19);
        expect(bt2.maxEmittedSeq).toEqual(19);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
        expect(outArrOrdered).toEqual(inputArr);
    });
});
