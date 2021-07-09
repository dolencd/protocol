import LibBot from "../libBot";

describe("Full cycle", () => {
    test("Perfect transmission", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        const outArr: Array<Buffer> = [];
        const outArrOrdered: Array<Buffer> = [];
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            const [_, transmissionObj] = bt2.receiveMessage(bt1.send(b));
            outArr.push(transmissionObj.newMessage);
            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }
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

        const outArr: Array<Buffer> = [];
        const outArrOrdered: Array<Buffer> = [];
        const inputArr: Array<Buffer> = [];
        const messagesInTransit: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            messagesInTransit.push(bt1.send(b));
        }

        messagesInTransit.reverse().map((msg) => {
            const [_, transmissionObj] = bt2.receiveMessage(msg);
            outArr.push(transmissionObj.newMessage);
            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }
        });

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
        const bt1 = new LibBot({
            autoRetransmit: false,
        });
        const bt2 = new LibBot({
            autoAckOnFailedMessages: 1,
        });

        const outArrOrdered: Array<Buffer> = [];
        const inputArr: Array<Buffer> = [];
        let count = 0;
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            count++;
            const msg = bt1.send(b);
            if (count % 3 === 0) {
                continue;
            }

            const [_, transmissionObj] = bt2.receiveMessage(msg);

            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }
        }

        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(6);
        expect(bt2.failedSendMessageCount).toEqual(0);
        bt1.receiveMessage(bt2.sendAcks());
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(6);
        const failedMessages = bt1.sendFailedMessages();
        expect(failedMessages.length).toEqual(6);
        failedMessages.map((msg) => {
            const [_, transmissionObj] = bt2.receiveMessage(msg);

            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }
        });

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

    test("SEQ looping lossless", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        const inputArr: Array<Buffer> = [];
        const outArrOrdered: Array<Buffer> = [];

        for (let i = 1; i <= 205; i++) {
            const a = Buffer.allocUnsafe(2);
            a.writeUInt16LE(i);
            inputArr.push(a);
            const msg = bt1.send(a);
            expect(msg[0]).toBeLessThanOrEqual(100);
            const [_, transmissionObj] = bt2.receiveMessage(msg);

            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }
        }

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(205);

        expect(bt2.maxIncSeq).toEqual(205);
        expect(bt2.maxEmittedSeq).toEqual(205);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt2.recSeqOffset).toEqual(2);

        expect(inputArr).toEqual(outArrOrdered);
    });

    test("SEQ looping lossy", () => {
        const bt1 = new LibBot({
            autoRetransmit: true,
        });
        const bt2 = new LibBot({
            autoAckOnFailedMessages: 1,
        });

        const inputArr: Array<Buffer> = [];
        const outArrOrdered: Array<Buffer> = [];

        let count = 0;
        for (let i = 1; i <= 205; i++) {
            const a = Buffer.allocUnsafe(2);
            a.writeUInt16LE(i);
            inputArr.push(a);
            const msg = bt1.send(a);
            expect(msg[0]).toBeLessThanOrEqual(100);

            count++;
            if (count % 3 === 0) return;
            const [messagesToSend, transmissionObj] = bt2.receiveMessage(msg);
            if (transmissionObj.ordered) {
                transmissionObj.ordered.map((buf) => {
                    outArrOrdered.push(buf);
                });
            }

            messagesToSend.map((msg) => {
                count++;
                if (count % 3 === 0) return;
                bt2.receiveMessage(msg);
            })

            if (bt2.failedReceiveMessageCount > 1) {
                count++;
                if (count % 3 === 0) continue;
                bt2.receiveMessage(bt1.sendAcks());
                // eslint-disable-next-line no-loop-func
                bt1.sendFailedMessages().map((m) => {
                    count++;
                    if (count % 3 === 0) return;
                    bt2.receiveMessage(m);
                });
            }
        }

        expect(bt1.maxIncSeq).toEqual(0);
        expect(bt1.maxEmittedSeq).toEqual(0);
        expect(bt1.maxSendAck).toEqual(0);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(0);
        expect(bt1.maxSendSeq).toEqual(206);

        expect(bt2.maxIncSeq).toEqual(206);
        expect(bt2.maxEmittedSeq).toEqual(206);
        expect(bt2.maxSendAck).toEqual(0);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt2.recSeqOffset).toEqual(2);

        expect(inputArr).toEqual(outArrOrdered);
    });
});
