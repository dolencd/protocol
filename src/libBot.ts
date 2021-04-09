import * as EventEmitter from "events";
import * as tc from "./transcoder";

export default class LibBot extends EventEmitter {
    received: Map<number, Buffer>;

    sent: Map<
        number,
        {
            buf: Buffer;
            maxAck: number;
        }
    >;

    sendFail: Map<number, Buffer>;

    maxIncAck: number;

    maxIncSeq: number;

    maxAckKnownReceived: number;

    maxSendSeq: number;

    maxEmittedSeq: number;

    constructor() {
        super();
        this.received = new Map(); // received but not emitted (waiting for correct order)
        this.sent = new Map(); // sent and unacknowledged (under maxAck)
        this.sendFail = new Map(); // known failed delivery

        this.maxIncAck = 0; // highest sent seq known to have been received (may be missing some messages)
        this.maxIncSeq = 0; // highest seq received so far
        this.maxAckKnownReceived = 0; // highest ack that was sent and is known to have been received

        this.maxSendSeq = 0; // maximum sequence number sent so far
        this.maxEmittedSeq = 0; // highest received and emitted (received all messages up to this point)
    }

    sendMessage(buf: Buffer) {
        this.maxSendSeq++;
        const acks: Array<number> = [];
        if (this.maxIncSeq > this.maxAckKnownReceived) {
            // some acks must be sent
            acks.push(this.maxIncSeq);

            for (let i = this.maxEmittedSeq + 1; i <= this.maxIncSeq; i++) {
                // console.log(`---other acks min:${this.maxEmittedSeq}, max:${this.maxIncSeq}, i:${i}`, this.received.has(i))
                if (this.received.has(i)) {
                    continue;
                }

                console.log(`---- pushing ${i} into outgoing acks`);
                acks.push(i);
            }
        }

        console.log(
            `bot send acks maxIncSeq:${this.maxIncSeq}, maxEmitted:${this.maxEmittedSeq}, received:${Array.from(
                this.received.keys()
            )}||`,
            acks
        );
        const toSend = [];
        console.log(`bot sending seq:${this.maxSendSeq}, len:${buf.length}`);
        this.sendFail.forEach((v, k) => {
            console.log(`bot sending failed message ${k}`, v);
            toSend.push(tc.encodeSeqAck(k, acks, v));
            this.sent.set(k, {
                buf: v,
                maxAck: acks[0],
            });
        });
        this.sendFail.clear();

        toSend.push(tc.encodeSeqAck(this.maxSendSeq, acks, buf));
        this.sent.set(this.maxSendSeq, {
            buf,
            maxAck: acks[0],
        });
        if (toSend.length > 1) console.log(`bot send count:${toSend.length}`);
        this.emit("send", toSend);
        return toSend;
    }

    receiveMessage(buf: Buffer) {
        const [seq, acks, payload] = tc.decodeSeqAck(buf);
        console.log(`bot received message seq:${seq} plen:${payload.length} acks:`, acks);
        // incoming acks

        const [maxAck, ...missingAcks] = acks;
        if (maxAck > this.maxIncAck) {
            this.maxIncAck = maxAck;
            console.log(`bot new max ack ${maxAck}`);
        }

        if (missingAcks.length > 0) {
            this.sent.forEach((v, k) => {
                // console.log("sent foreach", k, maxAck)

                if (missingAcks.includes(k) || k > maxAck) {
                    console.log(`bot delivery failed. set up for redelivery seq:${k}, maxAck:${maxAck}`, missingAcks);
                    this.sendFail.set(k, v.buf);
                } else if (v.maxAck > this.maxAckKnownReceived) {
                    this.maxAckKnownReceived = v.maxAck;
                }
                // console.log(`bot delete seq:${k} from sent, maxAck:${maxAck}`, missingAcks)
            });
            this.sent.clear();

            console.log(
                `bot acks processed max:${maxAck} sendFail:${Array.from(this.sendFail.keys())} sent:${Array.from(
                    this.sent.keys()
                )}`
            );
            // done incoming acks

            if (seq < this.maxEmittedSeq && this.received.has(seq)) {
                console.error("already got message with this seq", seq);
            }
        }

        if (seq <= this.maxEmittedSeq) {
            // console.log(`bot got old message seq:${seq}, maxEmit:${this.maxEmittedSeq}`)
            return;
        }
        this.received.set(seq, payload);

        if (seq > this.maxIncSeq) {
            this.maxIncSeq = seq;
            this.emit("newMaxIncSeq", seq);
        }

        // emit messages that are in sequence
        while (this.received.has(this.maxEmittedSeq + 1)) {
            this.maxEmittedSeq++;
            const msg = this.received.get(this.maxEmittedSeq);
            this.received.delete(this.maxEmittedSeq);
            // console.log(`bot emitting and deleting message ${this.maxEmittedSeq}`)
            this.emit("message", msg);
        }

        if (this.maxEmittedSeq < this.maxIncSeq) {
            console.log(
                `bot messages waiting in received emitted:${this.maxEmittedSeq} max: ${this.maxIncSeq}`,
                Array.from(this.received.keys())
            );
        }
    }
}
