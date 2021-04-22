/// <reference types="node" />
import * as EventEmitter from "events";
export interface LibBotOptions {
    /**
     * When a delivery failure is detected, immediately retransmit the message.
     */
    autoRetransmit?: boolean;
    /**
     * Automatically call sendAcks if n or more messages have been received since last sending acks.
     */
    autoAckAfterMessages?: number;
    /**
     * Automatically call sendAcks if n or more incoming messages have been lost before being received.
     */
    autoAckOnFailedMessages?: number;
}
export default class LibBot extends EventEmitter {
    private readonly options;
    /**
     * received but not emitted (waiting for correct order)
     */
    private readonly received;
    /**
     * Sent and unacknowledged (under maxAck)
     */
    private readonly sent;
    /**
     * Known failed delivery
     */
    private readonly sendFail;
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
    constructor(options?: LibBotOptions);
    /**
     * Number of outgoing messages that are known to have been lost after sending (from received acks).
     */
    get failedSendMessageCount(): number;
    /**
     * Number of incomingmessages that are known to have been lost (from received seq).
     */
    get failedReceiveMessageCount(): number;
    /**
     * Messages that have been sent, but not yet acked.
     */
    get unackedMessageCount(): number;
    /**
     * Send a message to the other side
     * @function send
     * @param  {Buffer} message Message to send
     * @returns  {Buffer} Message to forward to the other side
     */
    send(buf: Buffer): Buffer;
    /**
     * Resend messages that are known to have been lost.
     * @function sendFailedMessages send
     * @returns  {Array<Buffer>} Messages to forward to the other side
     */
    sendFailedMessages(): Array<Buffer>;
    /**
     * Send an empty message that contains only acks
     * @function sendAcks send
     * @returns  {Array<Buffer>} Messages to forward to the other side
     */
    sendAcks(): Buffer;
    /**
     * Get the current array of acknowledgements
     * @function getAcks
     * @returns  {Array<number>} acks
     */
    getAcks(): Array<number>;
    /**
     * A new message has been received from the other side
     * @function receiveMessage
     * @param  {Buffer} message
     * @returns void
     */
    receiveMessage(buf: Buffer): void;
}
