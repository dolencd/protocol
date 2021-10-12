import { union, max } from "lodash";
import * as tc from "./transcoder";
import { stringify as serializerStringify, parse as serializerParse } from "./serializer";

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

    /**
     * Restore state of old LibTop instance. If present, other options will be ignored.
     */
    restoreState?: string;
}

// eslint-disable-next-line no-shadow
export enum ReceivedMessageType {
    full = "full",
    ordered = "ordered",
    unordered = "unordered",
}

export interface ReceivedMessage {
    /**
     * The message.
     */
    msg: Buffer;

    /**
     * Type of message. If unspecified it is treated as "full".
     */
    type?: ReceivedMessageType;
}

/**
 * Provides delivery and ordering guarantees for given Buffer messages with minimal overhead and few additional messages (depending on the options).
 */
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
     * True if LibBot is currently looping receiving seq numbers
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
     * maximum acknowledgement sent so far
     */
    maxSendAck: number;

    /**
     * highest received and emitted (received all messages up to this point)
     */
    maxEmittedSeq: number;

    private recSeqOffset: number;

    constructor(options: LibBotOptions = {}) {
        if (options.restoreState) {
            const rs = serializerParse(options.restoreState);
            this.options = rs.options;
            this.received = rs.received;
            this.sent = rs.sent;
            this.sendFail = rs.sendFail;

            this.maxIncSeq = rs.maxIncSeq;
            this.maxSendAckKnownReceived = rs.maxSendAckKnownReceived;

            this.maxSendSeq = rs.maxSendSeq;
            this.maxSendAck = rs.maxSendAck;
            this.maxSendSeqKnownReceived = rs.maxSendAckKnownReceived;
            this.maxEmittedSeq = rs.maxEmittedSeq;

            this.inTransition = rs.inTransition;
            this.recSeqOffset = rs.recSeqOffset;
        } else {
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
    }

    getLibState(): string {
        return serializerStringify(this);
    }

    /**
     * Number of outgoing messages that are known to have been lost after sending (from received acks).
     */
    get failedSendMessageCount(): number {
        return this.sendFail.size;
    }

    /**
     * Highest sent seq that has been emitted on the other side. All messages up to and including this one have been correctly received
     */
    get maxSendSeqKnownEmitted(): number {
        const failKeysArr = Array.from(this.sendFail.keys());
        const sentKeysArr = Array.from(this.sent.keys());
        // const min = Math.min(...failKeysArr, ...sentKeysArr)
        if (failKeysArr.length > 0 || sentKeysArr.length > 0) return Math.min(...failKeysArr, ...sentKeysArr) - 1;
        // if (keysArr && keysArr.length > 0) return Math.min(...keysArr) - 1;
        return this.maxSendSeqKnownReceived;
    }

    /**
     * Number of incomingmessages that are known to have been lost (from received seq).
     */
    get failedReceiveMessageCount(): number {
        return this.maxIncSeq - this.maxEmittedSeq - this.received.size;
    }

    /**
     * Messages that have been sent, but not yet acked.
     */
    get unackedMessageCount(): number {
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

        let maxAck;
        if (acks.length > 0) {
            maxAck = acks[0] + this.recSeqOffset * SEQ_MAX;
            if (this.inTransition && acks[0] < SEQ_LOWER) maxAck += SEQ_MAX;
            this.maxSendAck = maxAck;
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
        const acks = this.getAcks();
        if (acks[0])
            this.maxSendAck =
                acks[0] + SEQ_MAX * (this.recSeqOffset + (this.inTransition && acks[0] < SEQ_LOWER ? 1 : 0));
        const message = tc.encodeSeqAck(0, acks);
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
                if (this.received.has(i)) {
                    continue;
                }

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
    receiveMessages(bufs: Array<Buffer>): [Array<Buffer>, Array<ReceivedMessage>] {
        const output: Array<Buffer> = [];
        const oldReceivedKeys = Array.from(this.received.keys());
        const received = bufs
            .map(tc.decodeSeqAck)
            .filter((v) => {
                return v[0] + this.recSeqOffset * SEQ_MAX < this.maxIncSeq + SEQ_MAX / 4;
            })
            .map(([seq, acks, payload]): [number, Array<number>, Buffer] => {
                // Adapt offset
                if (seq > 0 && seq < SEQ_LOWER && this.maxEmittedSeq - this.recSeqOffset * SEQ_MAX > SEQ_UPPER) {
                    // transition stage
                    if (!this.inTransition) this.inTransition = true;
                    seq += (this.recSeqOffset + 1) * SEQ_MAX;
                } else {
                    seq += this.recSeqOffset * SEQ_MAX;
                }

                if (this.inTransition && this.maxEmittedSeq - this.recSeqOffset * SEQ_MAX > SEQ_MAX) {
                    this.inTransition = false;
                    // transition stage has ended
                    this.recSeqOffset++;
                }
                acks = acks.map((a) => {
                    a += Math.floor(this.maxSendSeqKnownEmitted / SEQ_MAX) * SEQ_MAX;
                    if (a > 0 && a < this.maxSendSeqKnownEmitted) {
                        a += SEQ_MAX;
                    }
                    return a;
                });

                if (!this.received.has(seq)) this.received.set(seq, payload);
                return [seq, acks, payload];
            });

        // Process Acks
        const maxAck = max(received.map((v) => v[1][0] || 0)); // find the highest max ack of all messages
        const missingAcks: Array<number> = union(
            ...received.map((v) => {
                if (!v[1] || v[1].length <= 1) return []; // No missing acks are present
                return v[1].slice(1); // remove first ack
            })
        );

        if (maxAck > this.maxSendSeqKnownReceived) {
            this.maxSendSeqKnownReceived = maxAck;
        }
        if (maxAck) {
            this.sent.forEach((v, k) => {
                if (missingAcks.includes(k) || k > maxAck) {
                    this.sendFail.set(k, v.buf);
                } else if (v.maxAck && v.maxAck > this.maxSendAckKnownReceived) {
                    this.maxSendAckKnownReceived = v.maxAck;
                }
            });
            this.sent.clear();

            if (this.options.autoRetransmit && this.failedSendMessageCount > 0) {
                output.push(...this.sendFailedMessages());
            }
        }

        const maxIncSeq = max(received.map((v) => v[0]));

        if (maxIncSeq > this.maxIncSeq) {
            this.maxIncSeq = maxIncSeq;
        }
        const outputReceivedMessages: Array<ReceivedMessage> = [];
        Array.from(this.received.keys())
            .sort((first, second) => {
                return first - second;
            })
            .forEach((k) => {
                if (k <= this.maxEmittedSeq) {
                    // Message has been fully emitted already
                    this.received.delete(k);
                    return;
                }

                const v = this.received.get(k);
                if (k !== this.maxEmittedSeq + 1) {
                    // message is not the next ordered message
                    if (oldReceivedKeys.includes(k)) {
                        // message is not new. It has already been emitted as unordered
                        return;
                    }
                    // message is new. Emit unordered
                    outputReceivedMessages.push({
                        type: ReceivedMessageType.unordered,
                        msg: v,
                    });
                    return;
                }
                this.maxEmittedSeq++;
                this.received.delete(k);
                if (oldReceivedKeys.includes(k)) {
                    // message is not new. It has already been emitted as unordered and needs to be emitted as ordered
                    outputReceivedMessages.push({
                        type: ReceivedMessageType.ordered,
                        msg: v,
                    });
                } else {
                    // Message is new and is next in line. Emit as full
                    outputReceivedMessages.push({
                        type: ReceivedMessageType.full,
                        msg: v,
                    });
                }
            });

        // Send acks if this.autoAckAfterMessages messages have been received without an acknowledgement being sent
        if (
            (this.options.autoAckAfterMessages &&
                this.maxIncSeq - this.maxSendAck >= this.options.autoAckAfterMessages) ||
            (this.options.autoAckOnFailedMessages &&
                this.failedReceiveMessageCount >= this.options.autoAckOnFailedMessages)
        ) {
            output.push(this.sendAcks());
        }

        return [output, outputReceivedMessages];
    }
}
