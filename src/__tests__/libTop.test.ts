import { PbTranscoder } from "../PbTranscoder";
import LibTop from "../libTop";

const tc = new PbTranscoder({
    protoPath: "./src/__tests__/test.proto",
});

describe("Receive message", () => {
    const obj = {
        reqRpc: {
            1: {
                method: "sum",
                args: Buffer.from("1234"),
            },
            2: {
                method: "add",
            },
        },
        reqRpcOrdered: {
            2: {
                method: "send",
                args: Buffer.from("12345"),
            },
        },
        resRpc: {
            1: {
                returns: Buffer.from("12345"),
            },
            2: {
                returns: Buffer.from("123"),
                isError: true,
            },
        },
        events: [Buffer.from("123"), Buffer.from("456")],
        eventsOrdered: [Buffer.from("1234"), Buffer.from("5678")],
    };
    const messageBuf = tc.encode(obj);

    test("Receive message", () => {
        const eventFn = jest.fn();
        const rpcFn = jest.fn();
        const tp = new LibTop({ transcoder: tc });
        tp.on("call", rpcFn);
        tp.on("event", eventFn);

        expect(tp.callFn("unknown")).resolves.toEqual(Buffer.from("12345"));
        expect(tp.callFnOrdered("unknown")).rejects.toEqual(Buffer.from("123"));

        tp.receiveMessage(messageBuf);

        expect(rpcFn.mock.calls[0][0]).toEqual("sum");
        expect(rpcFn.mock.calls[0][1]).toEqual(Buffer.from("1234"));
        expect(rpcFn.mock.calls[1][0]).toEqual("add");
        expect(rpcFn.mock.calls[1][1]).toEqual(undefined);

        expect(eventFn.mock.calls).toEqual([[Buffer.from("123")], [Buffer.from("456")]]);
    });

    test("Receive message ordered", () => {
        const eventFn = jest.fn();
        const rpcFn = jest.fn();
        const tp = new LibTop({ transcoder: tc });
        tp.on("call", rpcFn);
        tp.on("event", eventFn);

        tp.receiveMessageOrdered(messageBuf);
        expect(rpcFn.mock.calls[0][0]).toEqual("send");
        expect(rpcFn.mock.calls[0][1]).toEqual(Buffer.from("12345"));

        expect(eventFn.mock.calls).toEqual([[Buffer.from("1234")], [Buffer.from("5678")]]);
    });

    test("Receive empty message", () => {
        const tp = new LibTop({ transcoder: tc });
        const eventFn = jest.fn();
        const rpcFn = jest.fn();
        tp.on("call", rpcFn);
        tp.on("event", eventFn);

        tp.receiveMessageOrdered(Buffer.allocUnsafe(0));
        expect(tp.responses.size).toEqual(0);
        expect(tp.requests.size).toEqual(0);
        expect(tp.requestsOrdered.size).toEqual(0);
        expect(tp.idCreator.next()).toEqual(1);
        expect(eventFn).not.toHaveBeenCalled();
        expect(rpcFn).not.toHaveBeenCalled();
    });
});

describe("Sending message", () => {
    test("Send regular RPC call", () => {
        const tp = new LibTop({ transcoder: tc });
        tp.callFn("sum", Buffer.from("1234"));
        tp.callFn("add");
        expect(tc.decode(tp.send())).toEqual({
            reqRpc: {
                1: {
                    method: "sum",
                    args: Buffer.from("1234"),
                },
                2: {
                    method: "add",
                },
            },
        });
    });

    test("Send ordered RPC call", () => {
        const tp = new LibTop({ transcoder: tc });
        tp.callFnOrdered("sum", Buffer.from("1234"));
        tp.callFnOrdered("add");
        expect(tc.decode(tp.send())).toEqual({
            reqRpcOrdered: {
                1: {
                    method: "sum",
                    args: Buffer.from("1234"),
                },
                2: {
                    method: "add",
                },
            },
        });
    });

    test("Send regular event", () => {
        const tp = new LibTop({ transcoder: tc });
        tp.sendEvent(Buffer.from("12"));
        tp.sendEvent(Buffer.from("34"));

        expect(tc.decode(tp.send())).toEqual({
            events: [Buffer.from("12"), Buffer.from("34")],
        });
    });
    test("Send ordered event", () => {
        const tp = new LibTop({ transcoder: tc });
        tp.sendEventOrdered(Buffer.from("12"));
        tp.sendEventOrdered(Buffer.from("34"));

        expect(tc.decode(tp.send())).toEqual({
            eventsOrdered: [Buffer.from("12"), Buffer.from("34")],
        });
    });
});

describe("LibTop roundtrip", () => {
    let tp1: LibTop;
    let tp2: LibTop;
    let eventFn: jest.Mock;
    let rpcFn: jest.Mock;

    beforeEach(() => {
        tp1 = new LibTop({ transcoder: tc });
        tp2 = new LibTop({ transcoder: tc });

        tp1.on("send", (buf) => {
            tp2.receiveMessage(buf);
            tp2.receiveMessageOrdered(buf);
        });

        tp2.on("send", (buf) => {
            tp1.receiveMessage(buf);
            tp1.receiveMessageOrdered(buf);
        });

        rpcFn = jest.fn((method, args, cb) => {
            if (method === "add") cb(false, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
            if (method === "sum") cb(true, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
        });
        eventFn = jest.fn();

        tp2.on("call", rpcFn);
        tp2.on("event", eventFn);
    });

    test("Events", () => {
        tp1.sendEvent(Buffer.from("1"));
        tp1.sendEventOrdered(Buffer.from("3"));
        tp1.sendEvent(Buffer.from("2"));

        tp1.send();

        expect(eventFn.mock.calls).toEqual([[Buffer.from("1")], [Buffer.from("2")], [Buffer.from("3")]]);
    });

    test("RPC execution", (done) => {
        Promise.allSettled([
            tp1.callFn("add", Buffer.from("12345")),
            tp1.callFn("sum"),
            tp1.callFnOrdered("sum", Buffer.from("12345")),
            tp1.callFnOrdered("add"),
        ]).then((res) => {
            expect(res).toEqual([
                {
                    status: "fulfilled",
                    value: Buffer.concat([Buffer.from([0, 0]), Buffer.from("12345")]),
                },
                {
                    status: "rejected",
                    reason: Buffer.from([0, 0]),
                },
                {
                    status: "rejected",
                    reason: Buffer.concat([Buffer.from([0, 0]), Buffer.from("12345")]),
                },
                {
                    status: "fulfilled",
                    value: Buffer.from([0, 0]),
                },
            ]);
            done();
        });
        tp1.send();
        tp2.send();
    });

    test("Object Syncing", () => {
        tp1.outObj.int = 1234;
        tp1.outObj.naprej = {};
        tp1.outObj.naprej.naprej = {};
        tp1.outObj.naprej.naprej.float = 3.14;
        tp1.outObj.bytes = Buffer.from("12345");
        tp1.outObj.naprej.boolean = false;
        tp1.outObj.str = "test";

        tp1.send();

        expect(tp2.incObj.int).toEqual(1234);
        expect(tp2.incObj.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(tp2.incObj.bytes).toEqual(Buffer.from("12345"));
        expect(tp2.incObj.naprej.boolean).toEqual(false);
        expect(tp2.incObj.str).toEqual("test");
    });

    test("Object Syncing with preset", () => {
        tp1 = new LibTop({
            transcoder: tc,
            initialOutObj: {
                str: "abc",
                naprej: {
                    boolean: false,
                },
            },
        });
        tp2 = new LibTop({
            transcoder: tc,
            initialIncObj: {
                str: "abc",
                naprej: {
                    boolean: false,
                },
            },
        });

        tp1.on("send", (buf) => {
            tp2.receiveMessage(buf);
            tp2.receiveMessageOrdered(buf);
        });

        tp2.on("send", (buf) => {
            tp1.receiveMessage(buf);
            tp1.receiveMessageOrdered(buf);
        });

        tp1.outObj.int = 1234;
        tp1.outObj.naprej = {};
        tp1.outObj.naprej.naprej = {};
        tp1.outObj.naprej.naprej.float = 3.14;
        tp1.outObj.bytes = Buffer.from("12345");
        delete tp1.outObj.str;

        tp1.send();

        expect(tp2.incObj.int).toEqual(1234);
        expect(tp2.incObj.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(tp2.incObj.bytes).toEqual(Buffer.from("12345"));
        expect(tp2.incObj.naprej.boolean).toEqual(false);
        expect(tp2.incObj.str).toBeUndefined();
    });
});
