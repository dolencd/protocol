import { EventEmitter } from "events";
import LibBot from "./libBot";
import LibTop from "./libTop";

export interface ProtocolOptions {
    enableOrdering?: boolean;
    protoPath?: string;
    transcoder?: Transcoder;
}

export interface Transcoder {
    encode(obj: Record<string, any>): Buffer;
    decode(bud: Buffer): Record<string, any>;
}

export class Protocol extends EventEmitter {
    tp: LibTop;

    bt?: LibBot;

    constructor(options: ProtocolOptions) {
        super();

        this.tp = new LibTop(options.transcoder);

        // tp event bindings
        ["call", "event", "objSync", "objDelete", "objChange"].map((eventName) => {
            this.tp.on(eventName, this.emit.bind(this, eventName));
        });

        if (options.enableOrdering) {
            this.bt = new LibBot();
            this.bt.on("send", this.emit.bind(this, "send"));
            this.bt.on("message", this.tp.receiveMessage.bind(this.tp));
            this.bt.on("messageOrdered", this.tp.receiveMessageOrdered.bind(this.tp));
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
     * Package all data and get a Buffer to send to the other side.
     * @function send
     * @returns {Buffer} Buffer to send to other side
     */
    send(): Buffer {
        if (!this.bt) {
            return this.tp.send();
        }

        return this.bt.send(this.tp.send());
    }

    /**
     * Receive message from the other side. Routes correctly if LibBot is enabled or not.
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    receiveMessage(event: Buffer): void {
        if (this.bt) {
            this.bt.receiveMessage.call(this.bt, event);
            return;
        }
        this.tp.receiveMessage.call(this.tp, event);
        this.tp.receiveMessageOrdered.call(this.tp, event);
    }

    /**
     * Send an event to be processed as soon as possible
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    get sendEvent(): (event: Buffer) => void {
        return this.tp.sendEvent.bind(this.tp);
    }

    /**
     * Send an event with guaranteed ordering
     * @function sendEventOrdered
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    get sendEventOrdered(): (event: Buffer) => void {
        return this.tp.sendEventOrdered.bind(this.tp);
    }

    /**
     * Call a function on the other side
     * @async
     * @function callFn
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    get callFn(): (method: string, args?: Buffer) => Promise<Buffer> {
        return this.tp.callFn.bind(this.tp);
    }

    /**
     * Call a function on the other side while maintaining order of messages
     * @async
     * @function callFnOrdered
     * @param  {string} method Name of method to call
     * @param  {Buffer} args Optional arguments encoded as a Buffer
     * @returns  {Promise<Buffer>} Return values of the function call
     */
    get callFnOrdered(): (method: string, args?: Buffer) => Promise<Buffer> {
        return this.tp.callFnOrdered.bind(this.tp);
    }
}