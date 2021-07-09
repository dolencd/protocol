import { EventEmitter } from "events";
import LibBot, { LibBotOptions, ReceivedMessages } from "./libBot";
import LibTop, { LibTopOptions } from "./libTop";
import { PbTranscoderOptions } from "./PbTranscoder";

export interface ProtocolOptions extends LibBotOptions, LibTopOptions, PbTranscoderOptions {
    /**
     * Adds support for unreliable connections. Guarantees message delivery and order.
     * Enable if the underlying communications protocol does not provide these guarantees.
     */
    enableOrdering?: boolean;
}

export interface Transcoder {
    /**
     * Takes a plain JS Object and encodes it into a Buffer. Must be the inverse of `decode`.
     * @param obj Input Object
     */
    encode(obj: Record<string, any>): Buffer;

    /**
     * Decodes a given Buffer into a JS Object. Must be the inverse of `encode`.
     * @param buf Input Buffer
     */
    decode(buf: Buffer): Record<string, any>;
}

/**
 * Main Protocol class
 */
export class Protocol extends EventEmitter {
    tp: LibTop;

    private bt?: LibBot;

    private options: ProtocolOptions;

    /**
     * Initialise the Protocol class. It is not recommended to use this directly.
     * @param options {ProtocolOptions}
     */
    constructor(options: ProtocolOptions) {
        super();

        this.options = options;
        this.tp = new LibTop(options);

        // tp event bindings
        ["call", "event", "objSync", "objDelete", "objChange"].map((eventName) => {
            this.tp.on(eventName, this.emit.bind(this, eventName));
        });

        if (options.enableOrdering) {
            this.bt = new LibBot();
        } else {
            this.tp.on("send", this.emit.bind(this, "send"));
        }
    }

    /**
     * Maximum sequence number that has been sent by this client
     * Cycles when maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxSendSeq() {
        if (this.bt) return this.bt.maxSendSeq;
        return null;
    }

    /**
     * Maximum sequence number that has been received by the client (may not have received all messages up to this point)
     * Cycles when the maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxIncSeq(): number | null {
        if (this.bt) return this.bt.maxIncSeq;
        return null;
    }

    /**
     * Maximum sequence number emitted by the client. All messages up to this have been received.
     * Cycles when the maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxEmittedSeq(): number | null {
        if (this.bt) return this.bt.maxEmittedSeq;
        return null;
    }

    /**
     * The received object sent from the remote host.
     */
    get incObj(): Record<string, any> {
        return this.tp.incObj;
    }

    /**
     * Outgoing object to send to the remote host.
     */
    get outObj(): Record<string, any> {
        return this.tp.outObj;
    }

    /**
     * Package all data and get a Buffer to send to the other side.
     * @function send
     * @returns {Array<Buffer>} Array of Buffers to send to other side
     */
    send(): Buffer {
        if (!this.options.enableOrdering) {
            return this.tp.send();
        }
        const msg = this.bt.send(this.tp.send());
        this.emit("send", msg);
        return msg;
    }

    /**
     * Receive message from the other side. Routes correctly if LibBot is enabled or not.
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    receiveMessage(event: Buffer): Array<Buffer> {
        if (!this.options.enableOrdering) {
            // LibBot is disabled. There are no acks or retransmitted messages.
            if (event.length === 0) return [];
            this.tp.receiveMessage.call(this.tp, event);
            this.tp.receiveMessageOrdered.call(this.tp, event);
            return [];
        }

        const [messages, processedMessage]: [Array<Buffer>, ReceivedMessages] = this.bt.receiveMessage.call(
            this.bt,
            event
        );

        if (processedMessage.newMessage) {
            this.tp.receiveMessage.call(this.tp, processedMessage.newMessage);
        }

        if (processedMessage.ordered) {
            processedMessage.ordered.map((msg) => {
                this.tp.receiveMessageOrdered(msg);
            });
        }

        if (messages)
            messages.map((msg) => {
                this.emit("send", msg);
            });

        return messages;
    }

    /**
     * Send an event to be processed as soon as possible
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    sendEvent(event: Buffer): void {
        return this.tp.sendEvent.call(this.tp, event);
    }

    /**
     * Send an event with guaranteed ordering
     * @function sendEventOrdered
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    sendEventOrdered(event: Buffer): void {
        return this.tp.sendEventOrdered.call(this.tp, event);
    }

    /**
     * Call a function on the other side
     * @async
     * @function callFn
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    callFn(method: string, args?: Buffer): Promise<Buffer> {
        return this.tp.callFn.call(this.tp, method, args);
    }

    /**
     * Call a function on the other side while maintaining order of messages
     * @async
     * @function callFnOrdered
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    callFnOrdered(method: string, args?: Buffer): Promise<Buffer> {
        return this.tp.callFnOrdered.call(this.tp, method, args);
    }
}
