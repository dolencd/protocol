import { EventEmitter } from "events";
import LibBot, { LibBotOptions, ReceivedMessage } from "./libBot";
import LibTop, { FnCall, LibTopOptions, ReceiveMessageObject } from "./libTop";
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

    private fnCalls: Map<number, { resolve: (response: Buffer) => void; reject: (response: Buffer) => void }>;

    /**
     * Initialise the Protocol class. It is not recommended to use this directly.
     * @param options {ProtocolOptions}
     */
    constructor(options: ProtocolOptions) {
        super();

        this.options = options;
        this.tp = new LibTop(options);

        if (options.enableOrdering) {
            this.bt = new LibBot(options);
        }

        this.fnCalls = new Map();
    }

    /**
     * Maximum sequence number that has been sent by this client
     * Cycles when maximum is reached
     * Returns null if LibBot is disabled
     */
    get maxSendSeq(): number {
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
            const msg = this.tp.send()[0];
            this.emit("send", msg);
            return msg;
        }
        const msg = this.bt.send(this.tp.send()[0]);
        this.emit("send", msg);
        return msg;
    }

    /**
     * Receive message from the other side. Routes correctly if LibBot is enabled or not.
     * @function sendEvent
     * @param  {Buffer} event Event to send in the shape of a Buffer
     * @returns  {void}
     */
    receiveMessage(event: Buffer): [ReceiveMessageObject, Array<Buffer>] {
        if (!this.options.enableOrdering) {
            // LibBot is disabled. There are no acks or retransmitted messages.
            if (event.length === 0) return [{}, []];
            const processedMsg = this.tp.receiveMessage.call(this.tp, event);
            this.processLibTopReceiveMessage(processedMsg);
            return [processedMsg, []];
        }

        const [messages, processedMessage]: [Array<Buffer>, Array<ReceivedMessage>] = this.bt.receiveMessages.call(
            this.bt,
            [event]
        );

        const processedMsg = this.tp.receiveMessage.call(this.tp, processedMessage);
        this.processLibTopReceiveMessage(processedMsg);

        if (messages) {
            messages.map((msg) => {
                this.emit("send", msg);
            });
        }

        return [processedMsg, messages];
    }

    private processLibTopReceiveMessage({
        objAll,
        objSync,
        objDelete,
        rpcCalls,
        rpcResults,
        events,
        eventsOrdered,
    }: ReceiveMessageObject) {
        if (objAll) this.emit("objChange", objAll);
        if (objSync) this.emit("objSync", objSync, objAll);
        if (objDelete) this.emit("objDelete", objDelete, objAll);

        if (events)
            events.map((event: Buffer) => {
                this.emit("event", event);
            });

        if (eventsOrdered)
            eventsOrdered.map((event: Buffer) => {
                this.emit("event", event);
            });

        if (rpcCalls)
            rpcCalls.map((val: FnCall) => {
                this.emit(
                    "call",
                    val.method,
                    val.args,
                    ((reqId: number, isError: boolean | null, resultBuf = Buffer.allocUnsafe(0)) => {
                        this.tp.sendFnCallResponse(reqId, resultBuf, !!isError);
                    }).bind(this, val.id)
                );
            });

        if (rpcResults)
            rpcResults.map(({ id, result }: FnCall) => {
                const resultPromise = this.fnCalls.get(id);
                if (!resultPromise) {
                    console.error("Received response for function that wasn't called. Ignoring it");
                    return;
                }

                if (result.isError) {
                    resultPromise.reject(result.returns);
                } else {
                    resultPromise.resolve(result.returns);
                }

                this.fnCalls.delete(id);
            });
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
        return this.callFnInternal(this.tp.callFn, method, args);
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
        return this.callFnInternal(this.tp.callFnOrdered, method, args);
    }

    private callFnInternal(
        fn: (method: string, args?: Buffer) => number,
        method: string,
        args?: Buffer
    ): Promise<Buffer> {
        const id = fn.call(this.tp, method, args);

        if (this.fnCalls.has(id)) {
            throw new Error("Function call with this id already exists");
        }

        return new Promise((resolve, reject) => {
            this.fnCalls.set(id, { resolve, reject });
        });
    }
}
