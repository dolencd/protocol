/* eslint-disable @typescript-eslint/ban-ts-comment */
import { take, flatten } from "lodash";
import { ReceivedMessage } from "..";
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
            const [, transmissionObj] = bt2.receiveMessages([bt1.send(b)]);

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
            const [, transmissionObj] = bt2.receiveMessages([msg]);
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

            const [, transmissionObj] = bt2.receiveMessages([msg]);

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
        bt1.receiveMessages([bt2.sendAcks()]);
        expect(bt1.failedReceiveMessageCount).toEqual(0);
        expect(bt1.failedSendMessageCount).toEqual(6);
        const failedMessages = bt1.sendFailedMessages();
        expect(failedMessages.length).toEqual(6);
        failedMessages.map((msg) => {
            const [, transmissionObj] = bt2.receiveMessages([msg]);

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
            const [, transmissionObj] = bt2.receiveMessages([msg]);

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
            const [messagesToSend, transmissionObj] = bt2.receiveMessages([msg]);
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
                bt2.receiveMessages([m]);
            });

            if (bt2.failedReceiveMessageCount > 1) {
                count++;
                if (count % 3 === 0) continue;
                bt2.receiveMessages([bt1.sendAcks()]);
                // eslint-disable-next-line no-loop-func
                bt1.sendFailedMessages().map((m) => {
                    count++;
                    if (count % 3 === 0) return;
                    bt2.receiveMessages([m]);
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
            const [, transmissionObj] = bt2.receiveMessages([bt1.send(b)]);
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
            const [messagesToSend, transmissionObj] = bt2.receiveMessages([msg]);
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
                bt2.receiveMessages([m]);
            });

            if (bt2.failedReceiveMessageCount > 1) {
                count++;
                if (count % 3 === 0) continue;
                bt2.receiveMessages([bt1.sendAcks()]);
                // eslint-disable-next-line no-loop-func
                bt1.sendFailedMessages().map((m) => {
                    bt1 = new LibBot({ restoreState: bt1.getLibState() });
                    bt2 = new LibBot({ restoreState: bt2.getLibState() });
                    count++;
                    if (count % 3 === 0) return;
                    bt2.receiveMessages([m]);
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

    test("auto ack after message count", () => {
        const btA = new LibBot();
        const btB = new LibBot({
            autoAckAfterMessages: 10,
        });

        const AtoB: Array<Buffer> = [];
        const BtoA: Array<Buffer> = [];

        for (let i = 1; i <= 205; i++) {
            const msgA = btA.send(Buffer.from([i]));
            AtoB.push(msgA);
            const msgB = btB.receiveMessages([msgA]);
            expect(msgB[0].length).toBeLessThanOrEqual(1);
            expect(msgB[1]).toEqual([
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([i]),
                },
            ]);
            if (msgB[0].length > 0) {
                BtoA.push(msgB[0][0]);
                const rec = btA.receiveMessages([msgB[0][0]]);
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

    test("Multiple messages together - ack message count", () => {
        const bt = new LibBot({
            autoAckAfterMessages: 10,
        });

        const inputArr = Array.from(Array(10)).map((v, i) => Buffer.from([(i % 100) + 1, 0, 0, i + 1]));

        const processed = bt.receiveMessages(inputArr);

        expect(bt.maxIncSeq).toEqual(10);
        expect(bt.maxEmittedSeq).toEqual(10);
        expect(bt.maxSendAck).toEqual(10);
        expect(bt.failedReceiveMessageCount).toEqual(0);
        expect(bt.failedSendMessageCount).toEqual(0);
        expect(bt.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt.recSeqOffset).toEqual(0);

        expect(processed[0]).toEqual([Buffer.from("0000010a00", "hex")]);
        expect(processed[1]).toEqual(
            Array.from(Array(10)).map((v, i) => {
                return {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([i + 1]),
                } as ReceivedMessage;
            })
        );
    });

    test("Multiple messages together - seq looping", () => {
        const bt = new LibBot({});

        let inputArr = Array.from(Array(205)).map((v, i) => Buffer.from([(i % 100) + 1, 0, 0, i + 1]));

        const outputs = [];

        while (inputArr.length > 0) {
            // in this test MAX_SEQ is set to 100, so the number of messages must be limited
            const [outBufArr, recMsg] = bt.receiveMessages(take(inputArr, 6));
            expect(outBufArr).toEqual([]);
            outputs.push(recMsg);
            inputArr = inputArr.slice(6);
        }

        expect(bt.maxIncSeq).toEqual(205);
        expect(bt.maxEmittedSeq).toEqual(205);
        expect(bt.maxSendAck).toEqual(0);
        expect(bt.failedReceiveMessageCount).toEqual(0);
        expect(bt.failedSendMessageCount).toEqual(0);
        expect(bt.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt.recSeqOffset).toEqual(2);

        expect(flatten(outputs)).toEqual(
            Array.from(Array(205)).map((v, i) => {
                return {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([i + 1]),
                } as ReceivedMessage;
            })
        );
    });

    test("Multiple messages together - lossy", () => {
        function nToBuf(n: number) {
            return Buffer.from([n, 0, 0, n]);
        }

        const bt = new LibBot({
            autoAckOnFailedMessages: 1,
        });

        expect(bt.receiveMessages([1, 3].map(nToBuf))).toEqual([
            [Buffer.from("00000203000200", "hex")],
            [
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([1]),
                },
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([3]),
                },
            ],
        ]);
        expect(bt.maxIncSeq).toEqual(3);
        expect(bt.maxEmittedSeq).toEqual(1);
        expect(bt.maxSendAck).toEqual(3);
        expect(bt.failedReceiveMessageCount).toEqual(1);

        expect(bt.receiveMessages([2, 4, 7].map(nToBuf))).toEqual([
            [Buffer.from("000003070005000600", "hex")],
            [
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([2]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([3]),
                },
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([4]),
                },
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([7]),
                },
            ],
        ]);
        expect(bt.maxIncSeq).toEqual(7);
        expect(bt.maxEmittedSeq).toEqual(4);
        expect(bt.maxSendAck).toEqual(7);
        expect(bt.failedReceiveMessageCount).toEqual(2);

        expect(bt.receiveMessages([7, 9, 10].map(nToBuf))).toEqual([
            [Buffer.from("0000040a00050006000800", "hex")],
            [
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([9]),
                },
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([10]),
                },
            ],
        ]);
        expect(bt.maxIncSeq).toEqual(10);
        expect(bt.maxEmittedSeq).toEqual(4);
        expect(bt.maxSendAck).toEqual(10);
        expect(bt.failedReceiveMessageCount).toEqual(3);

        expect(bt.receiveMessages([6, 8, 10].map(nToBuf))).toEqual([
            [Buffer.from("0000020a000500", "hex")],
            [
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([6]),
                },
                {
                    type: ReceivedMessageType.unordered,
                    msg: Buffer.from([8]),
                },
            ],
        ]);
        expect(bt.maxIncSeq).toEqual(10);
        expect(bt.maxEmittedSeq).toEqual(4);
        expect(bt.maxSendAck).toEqual(10);
        expect(bt.failedReceiveMessageCount).toEqual(1);

        expect(bt.receiveMessages([5].map(nToBuf))).toEqual([
            [],
            [
                {
                    type: ReceivedMessageType.full,
                    msg: Buffer.from([5]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([6]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([7]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([8]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([9]),
                },
                {
                    type: ReceivedMessageType.ordered,
                    msg: Buffer.from([10]),
                },
            ],
        ]);
        expect(bt.maxIncSeq).toEqual(10);
        expect(bt.maxEmittedSeq).toEqual(10);
        expect(bt.maxSendAck).toEqual(10);
        expect(bt.failedReceiveMessageCount).toEqual(0);
        expect(bt.failedSendMessageCount).toEqual(0);
        expect(bt.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt.recSeqOffset).toEqual(0);
    });

    test("Multiple message - SEQ looping lossy", () => {
        const bt1 = new LibBot({
            autoRetransmit: true,
        });
        const bt2 = new LibBot({
            autoAckOnFailedMessages: 1,
        });

        const outArrOrdered: Array<Buffer> = [];

        let count = 0;
        for (let i = 1; i <= 205; i += 5) {
            const input = Array.from(Array(5))
                .map((v, o: number): Buffer => {
                    return Buffer.from([o + i]);
                })
                .map(bt1.send.bind(bt1))
                // eslint-disable-next-line no-loop-func
                .map((v: Buffer) => {
                    expect(v[0]).toBeLessThanOrEqual(100);
                    return v;
                })
                // eslint-disable-next-line no-loop-func
                .filter(() => {
                    count++;
                    return count % 3 !== 0;
                });

            const [messagesToSend, transmissionObj] = bt2.receiveMessages(input);
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
            const [messagesToSend2, transmissionObj2] = bt2.receiveMessages(
                bt1.receiveMessages(
                    // eslint-disable-next-line no-loop-func
                    messagesToSend.filter(() => {
                        count++;
                        return count % 3 !== 0;
                    })
                )[0]
            );
            transmissionObj2.map((msgObj) => {
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

            const [messagesToSend3, transmissionObj3] = bt2.receiveMessages(bt1.receiveMessages(messagesToSend2)[0]);
            expect(messagesToSend3).toEqual([]);
            transmissionObj3.map((msgObj) => {
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
        expect(bt2.maxSendAck).toEqual(205);
        expect(bt2.failedReceiveMessageCount).toEqual(0);
        expect(bt2.failedSendMessageCount).toEqual(0);
        expect(bt2.maxSendSeq).toEqual(0);
        // @ts-expect-error
        expect(bt2.recSeqOffset).toEqual(2);

        expect(outArrOrdered).toEqual(Array.from(Array(205)).map((v, i) => Buffer.from([i + 1])));
    });
});
