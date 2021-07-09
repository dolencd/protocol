import * as tc from "./transcoder";

const SEQ_MAX = process.env.NODE_ENV === "test" ? 100 : 2 ** 16 - 1;
const SEQ_LOWER = Math.floor(SEQ_MAX * 0.1);
const SEQ_UPPER = Math.floor(SEQ_MAX * 0.9);

function adaptOffset(n: number) {
    return ((n - 1) % SEQ_MAX) + 1;
}

export interface LibBotOptions {
    /**
     * When a delivery failure is detected (when calling receiveMessage), immediately return all messages that have not been successfully delivered.
     * Default: false
     */
    autoRetransmit?: boolean;

    /**
     * Automatically return acks (by internally calling sendAcks) when calling receiveMessage if n or more messages have been received since last sending acks.
     * Default: off
     */
    autoAckAfterMessages?: number;

    /**
     * Automatically return acks (by internally calling sendAcks) when calling receiveMessage if n or more incoming messages have been lost before being received.
     * Default: off
     */
    autoAckOnFailedMessages?: number;
}

export interface ReceivedMessages {
    /**
     * New message that was just received (unordered)
     */
    newMessage?: Buffer;

    /**
     * Represents messages that have been received in order.
     */
    ordered?: Array<Buffer>;
}

export default class LibBot {
    private readonly options: LibBotOptions;

    /**
     * received but not emitted (waiting for correct order)
     */
    private readonly received: Map<number, Buffer>;

    /**
     * Sent and unacknowledged (under maxAck)
     */
    private readonly sent: Map<
        number,
        {
            buf: Buffer;
            maxAck?: number;
        }
    >;

    /**
     * True if LibBot is currently looping seq numbers
     */
    private inTransition: boolean;

    /**
     * Known failed delivery
     */
    private readonly sendFail: Map<number, Buffer>;

    /**
     * highest sent seq known to have been received (may be missing some messages)
     */
    maxSendSeqKnownReceived: number;

    /**
     * highest seq received so far
     */
    maxIncSeq: number;

    /**
     * highest ack that was sent and is known to have been received
     */
    maxSendAckKnownReceived: number;

    /**
     * maximum sequence number sent so far
     */
    maxSendSeq: number;

    /**
     * maximum sequence number sent so far
     */
    maxSendAck: number;

    /**
     * highest received and emitted (received all messages up to this point)
     */
    maxEmittedSeq: number;

    private recSeqOffset: number;

    constructor(options: LibBotOptions = {}) {
        this.options = options;
        this.received = new Map();
        this.sent = new Map();
        this.sendFail = new Map();

        this.maxIncSeq = 0;
        this.maxSendAckKnownReceived = 0;

        this.maxSendSeq = 0;
        this.maxSendAck = 0;
        this.maxSendSeqKnownReceived = 0;
        this.maxEmittedSeq = 0;

        this.inTransition = false;
        this.recSeqOffset = 0;
    }

    /**
     * Number of outgoing messages that are known to have been lost after sending (from received acks).
     */
    get failedSendMessageCount() {
        return this.sendFail.size;
    }

    /**
     * Number of incomingmessages that are known to have been lost (from received seq).
     */
    get failedReceiveMessageCount() {
        return this.maxIncSeq - this.maxEmittedSeq - this.received.size;
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
    send(buf = Buffer.allocUnsafe(0)): Buffer {
        this.maxSendSeq++;

        const acks = this.getAcks();

        const msg = tc.encodeSeqAck(adaptOffset(this.maxSendSeq), acks, buf);
        // if (acks[0] > this.maxSendAck) {
        //     [this.maxSendAck] = acks;
        // }

        let maxAck;
        if (acks.length > 0) {
            maxAck = acks[0] + this.recSeqOffset * SEQ_MAX;
            if (this.inTransition && acks[0] < SEQ_LOWER) maxAck += SEQ_MAX;
        }

        this.sent.set(this.maxSendSeq, {
            buf,
            maxAck,
        });
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
            const msg = tc.encodeSeqAck(adaptOffset(k), [], v);
            toSend.push(msg);
            this.sent.set(k, {
                buf: v,
            });
        });
        this.sendFail.clear();
        return toSend;
    }

    /**
     * Send an empty message that contains only acks
     * @function sendAcks send
     * @returns  {Array<Buffer>} Messages to forward to the other side
     */
    sendAcks(): Buffer {
        const message = tc.encodeSeqAck(0, this.getAcks());
        return message;
    }

    /**
     * Get the current array of acknowledgements
     * @function getAcks
     * @returns  {Array<number>} acks
     */
    getAcks(): Array<number> {
        const acks: Array<number> = [];
        if (this.maxIncSeq > this.maxSendAckKnownReceived) {
            // some acks must be sent
            acks.push(adaptOffset(this.maxIncSeq));
            for (let i = this.maxEmittedSeq + 1; i <= this.maxIncSeq; i++) {
                // // console.log(`---other acks min:${this.maxEmittedSeq}, max:${this.maxIncSeq}, i:${i}`, this.received.has(i))
                if (this.received.has(i)) {
                    continue;
                }

                // console.log(`- --- pushing ${i} into outgoing acks`);
                acks.push(adaptOffset(i));
            }
        }
        return acks;
    }

    /**
     * A new message has been received from the other side
     * @function receiveMessage
     * @param  {Buffer} message
     * @returns An array of messages to send and the processed received messages
     */
    receiveMessage(buf: Buffer): [Array<Buffer>, ReceivedMessages | null] {

        const output: Array<Buffer> = [];

        // eslint-disable-next-line prefer-const
        let [seq, acks, payload] = tc.decodeSeqAck(buf);
        // console.log(`bot received message seq:${seq} plen:${payload.length} acks:`, acks);

        // Adapt offset
        if (this.inTransition && seq > adaptOffset(this.maxEmittedSeq)) {
            this.inTransition = false;
            // transition stage has ended
            this.recSeqOffset++;
        }
        if (seq < SEQ_LOWER && adaptOffset(this.maxEmittedSeq) > SEQ_UPPER) {
            // transition stage
            if (!this.inTransition) this.inTransition = true;
            seq += (this.recSeqOffset + 1) * SEQ_MAX;
        } else {
            seq += this.recSeqOffset * SEQ_MAX;
        }
        acks = acks.map((a) => {
            a += Math.floor(this.maxSendSeqKnownReceived / SEQ_MAX) * SEQ_MAX;
            if (a < this.maxSendSeqKnownReceived) {
                a += SEQ_MAX;
            }
            return a;
        });

        // Process Acks
        const [maxAck, ...missingAcks] = acks;
        if (maxAck > this.maxSendSeqKnownReceived) {
            this.maxSendSeqKnownReceived = maxAck;
            // console.log(`bot new max ack ${maxAck}`);
        }
        if (maxAck) {
            this.sent.forEach((v, k) => {
                if (missingAcks.includes(k) || k > maxAck) {
                    // console.log(`bot delivery failed. set up for redelivery seq:${k}, maxAck:${maxAck}`, missingAcks);
                    this.sendFail.set(k, v.buf);
                } else if (v.maxAck && v.maxAck > this.maxSendAckKnownReceived) {
                    this.maxSendAckKnownReceived = v.maxAck;
                }
                // console.log(`bot delete seq:${k} from sent, maxAck:${maxAck}`, missingAcks)
            });
            this.sent.clear();

            // console.log(
            //     `bot acks processed max:${maxAck} sendFail:${Array.from(this.sendFail.keys())} sent:${Array.from(
            //         this.sent.keys()
            //     )}`
            // );
            // done incoming acks

            if (this.options.autoRetransmit && this.failedSendMessageCount > 0) {
                this.sendFailedMessages().map((b) => output.push(b))
            }
        }

        if (seq <= this.maxEmittedSeq) {
            // // console.log(`bot got old message seq:${seq}, maxEmit:${this.maxEmittedSeq}`)
            return [[], null];
        }

        if (seq > this.maxIncSeq) {
            this.maxIncSeq = seq;
        }

        if (seq !== 0) this.received.set(seq, payload);
        // emit messages that are in sequence
        const orderedMessages: Array<Buffer> = [];
        while (this.received.has(this.maxEmittedSeq + 1)) {
            this.maxEmittedSeq++;
            orderedMessages.push(this.received.get(this.maxEmittedSeq));
            this.received.delete(this.maxEmittedSeq);
        }

        // Send acks if this.autoAckAfterMessages messages have been received without an acknowledgement being sent
        if (
            (this.options.autoAckAfterMessages &&
            this.maxIncSeq - this.maxSendAck >= this.options.autoAckAfterMessages) ||
            (this.options.autoAckOnFailedMessages &&
                this.failedReceiveMessageCount >= this.options.autoAckOnFailedMessages)
        ) {
            output.push(this.sendAcks());
        } 

        const outputReceivedMessages: ReceivedMessages = {}
        if (payload.length > 0) outputReceivedMessages.newMessage = payload
        if (orderedMessages.length > 0) outputReceivedMessages.ordered = orderedMessages

        return [output, outputReceivedMessages];
    }
}
