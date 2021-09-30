import LibBot, { ReceivedMessageType } from "../libBot";

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
            const [, transmissionObj] = bt2.receiveMessage(bt1.send(b));

            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        outArr.push(msgObj.msg);
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArr.push(msgObj.msg);
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });

            // outArr.push(transmissionObj.newMessage);
            // if (transmissionObj.ordered) {
            //     transmissionObj.ordered.map((buf) => {
            //         outArrOrdered.push(buf);
            //     });
            // }
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
            const [, transmissionObj] = bt2.receiveMessage(msg);
            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        outArr.push(msgObj.msg);
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArr.push(msgObj.msg);
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
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

            const [, transmissionObj] = bt2.receiveMessage(msg);

            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
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
            const [, transmissionObj] = bt2.receiveMessage(msg);

            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
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
        expect(bt2.maxSendAck).toEqual(19);
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
            const [, transmissionObj] = bt2.receiveMessage(msg);

            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
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
            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
            // eslint-disable-next-line no-loop-func
            messagesToSend.map((m) => {
                count++;
                if (count % 3 === 0) return;
                bt2.receiveMessage(m);
            });

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

    test("Perfect transmission with serialization", () => {
        let bt1 = new LibBot();
        let bt2 = new LibBot();

        const outArr: Array<Buffer> = [];
        const outArrOrdered: Array<Buffer> = [];
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1 = new LibBot({ restoreState: bt1.getLibState() });
            bt2 = new LibBot({ restoreState: bt2.getLibState() });
            const [, transmissionObj] = bt2.receiveMessage(bt1.send(b));
            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        outArr.push(msgObj.msg);
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArr.push(msgObj.msg);
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
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

        const bt1a = new LibBot({ restoreState: bt1.getLibState() });
        const bt2a = new LibBot({ restoreState: bt2.getLibState() });

        expect(bt1a).toEqual(bt1);
        expect(bt2a).toEqual(bt2);
    });
    test("SEQ looping lossy with serialization", () => {
        let bt1 = new LibBot({
            autoRetransmit: true,
        });
        let bt2 = new LibBot({
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
            transmissionObj.map((msgObj) => {
                switch (msgObj.type) {
                    case ReceivedMessageType.unordered:
                        break;
                    case ReceivedMessageType.ordered:
                        outArrOrdered.push(msgObj.msg);
                        break;
                    default:
                        outArrOrdered.push(msgObj.msg);
                        break;
                }
            });
            bt1 = new LibBot({ restoreState: bt1.getLibState() });
            bt2 = new LibBot({ restoreState: bt2.getLibState() });
            // eslint-disable-next-line no-loop-func
            messagesToSend.map((m) => {
                count++;
                if (count % 3 === 0) return;
                bt2.receiveMessage(m);
            });

            if (bt2.failedReceiveMessageCount > 1) {
                count++;
                if (count % 3 === 0) continue;
                bt2.receiveMessage(bt1.sendAcks());
                // eslint-disable-next-line no-loop-func
                bt1.sendFailedMessages().map((m) => {
                    bt1 = new LibBot({ restoreState: bt1.getLibState() });
                    bt2 = new LibBot({ restoreState: bt2.getLibState() });
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

        const bt1a = new LibBot({ restoreState: bt1.getLibState() });
        const bt2a = new LibBot({ restoreState: bt2.getLibState() });

        expect(bt1a).toEqual(bt1);
        expect(bt2a).toEqual(bt1);
    });

    test("auto ack message count", () => {
        const btA = new LibBot();
        const btB = new LibBot({
            autoAckAfterMessages: 10,
        });

        const AtoB: Array<Buffer> = [];
        const BtoA: Array<Buffer> = [];

        for (let i = 1; i <= 205; i++) {
            const msgA = btA.send(Buffer.from([i]));
            AtoB.push(msgA);
            const msgB = btB.receiveMessage(msgA);
            expect(msgB[0].length).toBeLessThanOrEqual(1);
            expect(msgB[1]).toEqual([
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([i]),
                },
            ]);
            if (msgB[0].length > 0) {
                BtoA.push(msgB[0][0]);
                const rec = btA.receiveMessage(msgB[0][0]);
                expect(rec).toEqual([[], []]);
            }
        }
        expect(btA.maxIncSeq).toEqual(0);
        expect(btA.maxEmittedSeq).toEqual(0);
        expect(btA.maxSendAck).toEqual(0);
        expect(btA.failedReceiveMessageCount).toEqual(0);
        expect(btA.failedSendMessageCount).toEqual(0);
        expect(btA.maxSendSeq).toEqual(205);

        expect(btB.maxIncSeq).toEqual(205);
        expect(btB.maxEmittedSeq).toEqual(205);
        expect(btB.maxSendAck).toEqual(200);
        expect(btB.failedReceiveMessageCount).toEqual(0);
        expect(btB.failedSendMessageCount).toEqual(0);
        expect(btB.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(btB.recSeqOffset).toEqual(2);

        const t1 = Array.from(Array(205)).map((v, i) => Buffer.from([(i % 100) + 1, 0, 0, i + 1]));
        const t2 = Array.from(Array(20)).map((v, i) => Buffer.from([0, 0, 1, (i % 10) * 10 + 10, 0]));
        expect(AtoB).toEqual(t1);
        expect(BtoA).toEqual(t2);
    });
});
