import * as EventEmitter from "events";
import * as tc from "./transcoder";

export default class LibBot extends EventEmitter {
    /**
     * received but not emitted (waiting for correct order)
     */
    received: Map<number, Buffer>;

    /**
     * Sent and unacknowledged (under maxAck)
     */
    sent: Map<
        number,
        {
            buf: Buffer;
            maxAck?: number;
        }
    >;

    /**
     * Known failed delivery
     */
    sendFail: Map<number, Buffer>;

    /**
     * highest sent seq known to have been received (may be missing some messages)
     */
    maxIncAck: number;

    /**
     * highest seq received so far
     */
    maxIncSeq: number;

    /**
     * highest ack that was sent and is known to have been received
     */
    maxAckKnownReceived: number;

    /**
     * maximum sequence number sent so far
     */
    maxSendSeq: number;

    /**
     * highest received and emitted (received all messages up to this point)
     */
    maxEmittedSeq: number;

    constructor() {
        super();
        this.received = new Map();
        this.sent = new Map();
        this.sendFail = new Map();

        this.maxIncAck = 0;
        this.maxIncSeq = 0;
        this.maxAckKnownReceived = 0;

        this.maxSendSeq = 0;
        this.maxEmittedSeq = 0;
    }

    /**
     * Number of messages that are known to have been lost (from received acks).
     */
    get failedMessageCount() {
        return this.sendFail.size;
    }

    /**
     * Messages that have been sent, but not yet acked.
     */
    get unackedMessageCount() {
        return this.sent.size;
    }

    /**
     * Send a message to the other side
     * @function send
     * @param  {Buffer} message Message to send
     * @returns  {Buffer} Message to forward to the other side
     */
    send(buf: Buffer): Buffer {
        this.maxSendSeq++;
        const acks = this.getAcks();

        const msg = tc.encodeSeqAck(this.maxSendSeq, acks, buf);
        this.sent.set(this.maxSendSeq, {
            buf,
            maxAck: acks[0],
        });
        this.emit("send", msg);
        return msg;
    }

    /**
     * Resend messages that are known to have been lost.
     * @function sendFailedMessages send
     * @returns  {Array<Buffer>} Messages to forward to the other side
     */
    sendFailedMessages(): Array<Buffer> {
        // TODO: add options: force retransmit, add acks (to none, all, some?)
        const toSend: Array<Buffer> = [];
        // console.log(`bot sending seq:${this.maxSendSeq}, len:${buf.length}`, buf);
        this.sendFail.forEach((v, k) => {
            const msg = tc.encodeSeqAck(k, [], v);
            this.emit("send", msg);
            toSend.push(msg);
            this.sent.set(k, {
                buf: v,
            });
        });
        this.sendFail.clear();
        return toSend;
    }

    /**
     * Get the current array of acknowledgements
     * @function getAcks
     * @param  {Array<number>} acks
     * @returns void
     */
    getAcks(): Array<number> {
        const acks: Array<number> = [];
        if (this.maxIncSeq > this.maxAckKnownReceived) {
            // some acks must be sent
            acks.push(this.maxIncSeq);
            for (let i = this.maxEmittedSeq + 1; i <= this.maxIncSeq; i++) {
                // // console.log(`---other acks min:${this.maxEmittedSeq}, max:${this.maxIncSeq}, i:${i}`, this.received.has(i))
                if (this.received.has(i)) {
                    continue;
                }

                // console.log(`---- pushing ${i} into outgoing acks`);
                acks.push(i);
            }
        }
        return acks;
    }

    /**
     * A new message has been received from the other side
     * @function receiveMessage
     * @param  {Buffer} message
     * @returns void
     */
    receiveMessage(buf: Buffer): void {
        const [seq, acks, payload] = tc.decodeSeqAck(buf);
        // console.log(`bot received message seq:${seq} plen:${payload.length} acks:`, acks);
        // incoming acks

        this.emit("message", payload);

        const [maxAck, ...missingAcks] = acks;
        if (maxAck > this.maxIncAck) {
            this.maxIncAck = maxAck;
            // console.log(`bot new max ack ${maxAck}`);
        }

        if (missingAcks.length > 0) {
            this.sent.forEach((v, k) => {
                // // console.log("sent foreach", k, maxAck)

                if (missingAcks.includes(k) || k > maxAck) {
                    // console.log(`bot delivery failed. set up for redelivery seq:${k}, maxAck:${maxAck}`, missingAcks);
                    this.sendFail.set(k, v.buf);
                } else if (v.maxAck && v.maxAck > this.maxAckKnownReceived) {
                    this.maxAckKnownReceived = v.maxAck;
                }
                // // console.log(`bot delete seq:${k} from sent, maxAck:${maxAck}`, missingAcks)
            });
            this.sent.clear();

            // console.log(
            //     `bot acks processed max:${maxAck} sendFail:${Array.from(this.sendFail.keys())} sent:${Array.from(
            //         this.sent.keys()
            //     )}`
            // );
            // done incoming acks

            if (seq < this.maxEmittedSeq && this.received.has(seq)) {
                console.error("already got message with this seq", seq);
            }
        }

        if (seq <= this.maxEmittedSeq) {
            // // console.log(`bot got old message seq:${seq}, maxEmit:${this.maxEmittedSeq}`)
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
            // // console.log(`bot emitting and deleting message ${this.maxEmittedSeq}`)
            this.emit("messageOrdered", msg);
        }

        if (this.maxEmittedSeq < this.maxIncSeq) {
            // console.log(
            //     `bot messages waiting in received emitted:${this.maxEmittedSeq} max: ${this.maxIncSeq}`,
            //     Array.from(this.received.keys())
            // );
        }
    }
}
