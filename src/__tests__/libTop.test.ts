import { PbTranscoder } from "../PbTranscoder";
import LibTop from "../libTop";

const tc = new PbTranscoder({
    protoPath: "./src/__tests__/test.proto",
});

describe("Receive message", () => {
    let tp: LibTop;

    beforeEach(() => {
        tp = new LibTop({ transcoder: tc });
    });

    test("Receive message", () => {
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
                3: {
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

        const expectedResult = {
            events: [Buffer.from("123"), Buffer.from("456")],
            eventsOrdered: [Buffer.from("1234"), Buffer.from("5678")],
            rpcCalls: [
                {
                    id: 1,
                    method: "sum",
                    args: Buffer.from("1234"),
                },
                {
                    id: 2,
                    method: "add",
                },
                {
                    id: 3,
                    method: "send",
                    args: Buffer.from("12345"),
                },
            ],
            rpcResults: [
                {
                    id: 1,
                    method: "sum",
                    args: Buffer.from("1234"),
                    result: {
                        returns: Buffer.from("12345"),
                    },
                },
                {
                    id: 2,
                    method: "add",
                    result: {
                        returns: Buffer.from("123"),
                        isError: true,
                    },
                },
            ],
        };
        const messageBuf = tc.encode(obj);

        tp = new LibTop({ transcoder: tc });

        expect(tp.callFn("sum", Buffer.from("1234"))).toEqual(1);
        expect(tp.callFnOrdered("add")).toEqual(2);

        tp.send();

        const ans = tp.receiveMessage({ msg: messageBuf });

        expect(ans).toEqual(expectedResult);
    });

    test("Receive empty message", () => {
        expect(tp.receiveMessage({ msg: Buffer.allocUnsafe(0) })).toEqual({});
        expect(tp.responses.size).toEqual(0);
        expect(tp.requests.size).toEqual(0);
        expect(tp.requestsOrdered.size).toEqual(0);
        expect(tp.idCreator.next()).toEqual(1);
    });
});

describe("Sending message", () => {
    let tp: LibTop;

    beforeEach(() => {
        tp = new LibTop({ transcoder: tc });
    });
    test("Send regular RPC call", () => {
        tp.callFn("sum", Buffer.from("1234"));
        tp.callFn("add");
        expect(tc.decode(tp.send()[0])).toEqual({
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
        tp.callFnOrdered("sum", Buffer.from("1234"));
        tp.callFnOrdered("add");
        expect(tc.decode(tp.send()[0])).toEqual({
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
        tp.sendEvent(Buffer.from("12"));
        tp.sendEvent(Buffer.from("34"));

        expect(tc.decode(tp.send()[0])).toEqual({
            events: [Buffer.from("12"), Buffer.from("34")],
        });
    });
    test("Send ordered event", () => {
        tp.sendEventOrdered(Buffer.from("12"));
        tp.sendEventOrdered(Buffer.from("34"));

        expect(tc.decode(tp.send()[0])).toEqual({
            eventsOrdered: [Buffer.from("12"), Buffer.from("34")],
        });
    });

    test("Without confirming multiple messages must be the same", () => {
        tp.callFn("sum", Buffer.from("1234"));
        tp.callFn("add");
        tp.callFnOrdered("sum", Buffer.from("1234"));
        tp.callFnOrdered("add");
        tp.sendEvent(Buffer.from("12"));
        tp.sendEvent(Buffer.from("34"));
        tp.sendEventOrdered(Buffer.from("12"));
        tp.sendEventOrdered(Buffer.from("34"));
        tp.outObj.int = 1234;
        tp.outObj.naprej = {};
        tp.outObj.naprej.naprej = {};
        tp.outObj.naprej.naprej.float = 3.14;
        tp.outObj.bytes = Buffer.from("12345");
        tp.outObj.naprej.boolean = false;
        tp.outObj.str = "test";

        const [send1] = tp.send(false);
        const [send2] = tp.send(false);
        const [send3, cb] = tp.send(false);

        expect(send1).toEqual(send2);
        expect(send1).toEqual(send3);

        cb();
        const [send4] = tp.send();
        expect(send4).not.toEqual(send1);
        expect(send4).toEqual(Buffer.allocUnsafe(0));
    });
});

describe("LibTop roundtrip", () => {
    let tp1: LibTop;
    let tp2: LibTop;
    beforeEach(() => {
        tp1 = new LibTop({ transcoder: tc });
        tp2 = new LibTop({ transcoder: tc });
    });

    test("Events", () => {
        tp1.sendEvent(Buffer.from("1"));
        tp1.sendEventOrdered(Buffer.from("3"));
        tp1.sendEvent(Buffer.from("2"));

        expect(tp2.receiveMessage({ msg: tp1.send()[0] })).toEqual({
            events: [Buffer.from("1"), Buffer.from("2")],
            eventsOrdered: [Buffer.from("3")],
        });
    });

    test("RPC execution", () => {
        expect(tp1.callFn("add", Buffer.from("12345"))).toEqual(1);
        expect(tp1.callFn("sum")).toEqual(2);
        expect(tp1.callFnOrdered("sum", Buffer.from("12345"))).toEqual(3);
        expect(tp1.callFnOrdered("add")).toEqual(4);

        const incMsg = tp2.receiveMessage({ msg: tp1.send()[0] });
        expect(incMsg).toEqual({
            rpcCalls: [
                {
                    id: 1,
                    method: "add",
                    args: Buffer.from("12345"),
                },
                {
                    id: 2,
                    method: "sum",
                },
                {
                    id: 3,
                    method: "sum",
                    args: Buffer.from("12345"),
                },
                {
                    id: 4,
                    method: "add",
                },
            ],
        });
        incMsg.rpcCalls.map(({ id, method, args }) => {
            if (method === "add") {
                if (args) {
                    tp2.sendFnCallResponse(id, Buffer.concat([Buffer.from([0, 0]), args]), true);
                } else {
                    tp2.sendFnCallResponse(id, null, true);
                }
            }
            if (method === "sum") {
                if (args) {
                    tp2.sendFnCallResponse(id, Buffer.concat([Buffer.from([0, 0]), args]));
                } else {
                    tp2.sendFnCallResponse(id);
                }
            }
        });
        const tmp = tp1.receiveMessage({ msg: tp2.send()[0] });
        expect(tmp).toEqual({
            rpcResults: [
                {
                    method: "add",
                    args: Buffer.from("12345"),
                    id: 1,
                    result: {
                        returns: Buffer.concat([Buffer.alloc(2), Buffer.from("12345")]),
                        isError: true,
                    },
                },
                {
                    method: "sum",
                    id: 2,
                    result: {},
                },
                {
                    method: "sum",
                    args: Buffer.from("12345"),
                    id: 3,
                    result: {
                        returns: Buffer.concat([Buffer.alloc(2), Buffer.from("12345")]),
                    },
                },
                {
                    method: "add",
                    id: 4,
                    result: {
                        isError: true,
                    },
                },
            ],
        });
    });

    test("Object Syncing", () => {
        tp1.outObj.int = 1234;
        tp1.outObj.naprej = {};
        tp1.outObj.naprej.naprej = {};
        tp1.outObj.naprej.naprej.float = 3.14;
        tp1.outObj.bytes = Buffer.from("12345");
        tp1.outObj.naprej.boolean = false;
        tp1.outObj.str = "test";

        tp2.receiveMessage({ msg: tp1.send()[0] });

        expect(tp2.incObj.int).toEqual(1234);
        expect(tp2.incObj.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(tp2.incObj.bytes).toEqual(Buffer.from("12345"));
        expect(tp2.incObj.naprej.boolean).toEqual(false);
        expect(tp2.incObj.str).toEqual("test");
    });

    test("Object Syncing with full object set", () => {
        const testObj = {
            int: 1234,
            str: "test",
            bytes: Buffer.from("12345"),
            naprej: {
                boolean: false,
                naprej: {
                    float: 3.14,
                },
            },
        };

        tp1.outObj = testObj;
        const msg = tp2.receiveMessage({ msg: tp1.send()[0] });

        expect(msg.objAll.int).toEqual(1234);
        expect(msg.objAll.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(msg.objAll.bytes).toEqual(Buffer.from("12345"));
        expect(msg.objAll.naprej.boolean).toEqual(false);
        expect(msg.objAll.str).toEqual("test");

        expect(msg.objSync.int).toEqual(1234);
        expect(msg.objSync.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(msg.objSync.bytes).toEqual(Buffer.from("12345"));
        expect(msg.objSync.naprej.boolean).toEqual(false);
        expect(msg.objSync.str).toEqual("test");

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

        tp1.outObj.int = 1234;
        tp1.outObj.naprej = {};
        tp1.outObj.naprej.naprej = {};
        tp1.outObj.naprej.naprej.float = 3.14;
        tp1.outObj.bytes = Buffer.from("12345");
        delete tp1.outObj.str;

        tp2.receiveMessage({ msg: tp1.send()[0] });

        expect(tp2.incObj.int).toEqual(1234);
        expect(tp2.incObj.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(tp2.incObj.bytes).toEqual(Buffer.from("12345"));
        expect(tp2.incObj.naprej.boolean).toEqual(false);
        expect(tp2.incObj.str).toBeUndefined();
    });

    test("serialization", () => {
        tp1.callFn("sum", Buffer.from("1234"));
        tp1.callFn("add");
        tp1.callFnOrdered("sum", Buffer.from("1234"));
        tp1.callFnOrdered("add");
        tp1.sendEvent(Buffer.from("12"));
        tp1.sendEvent(Buffer.from("34"));
        tp1.sendEventOrdered(Buffer.from("12"));
        tp1.sendEventOrdered(Buffer.from("34"));
        tp1.outObj.int = 1234;
        tp1.outObj.naprej = {};
        tp1.outObj.naprej.naprej = {};
        tp1.outObj.naprej.naprej.float = 3.14;
        tp1.outObj.bytes = Buffer.from("12345");
        tp1.outObj.naprej.boolean = false;
        tp1.outObj.str = "test";

        const serializedState = tp1.getLibState();

        const newtp1 = new LibTop({
            transcoder: tc,
            restoreState: serializedState,
        });

        expect(newtp1).toEqual(tp1);

        expect(newtp1.send()).toEqual(tp1.send());
    });

    test("serialization with function calls", () => {
        expect(tp1.callFn("add", Buffer.from("12345"))).toEqual(1);
        expect(tp1.callFn("sum")).toEqual(2);
        expect(tp1.callFnOrdered("sum", Buffer.from("12345"))).toEqual(3);
        expect(tp1.callFnOrdered("add")).toEqual(4);

        tp1 = new LibTop({
            transcoder: tc,
            restoreState: tp1.getLibState(),
        });

        const incMsg = tp2.receiveMessage({ msg: tp1.send()[0] });
        expect(incMsg).toEqual({
            rpcCalls: [
                {
                    id: 1,
                    method: "add",
                    args: Buffer.from("12345"),
                },
                {
                    id: 2,
                    method: "sum",
                },
                {
                    id: 3,
                    method: "sum",
                    args: Buffer.from("12345"),
                },
                {
                    id: 4,
                    method: "add",
                },
            ],
        });
        incMsg.rpcCalls.map(({ id, method, args }) => {
            if (method === "add") {
                if (args) {
                    tp2.sendFnCallResponse(id, Buffer.concat([Buffer.from([0, 0]), args]), true);
                } else {
                    tp2.sendFnCallResponse(id, null, true);
                }
            }
            if (method === "sum") {
                if (args) {
                    tp2.sendFnCallResponse(id, Buffer.concat([Buffer.from([0, 0]), args]));
                } else {
                    tp2.sendFnCallResponse(id);
                }
            }
        });
        tp1 = new LibTop({
            transcoder: tc,
            restoreState: tp1.getLibState(),
        });
        tp2 = new LibTop({
            transcoder: tc,
            restoreState: tp2.getLibState(),
        });
        const tmp = tp1.receiveMessage({ msg: tp2.send()[0] });
        expect(tmp).toEqual({
            rpcResults: [
                {
                    method: "add",
                    args: Buffer.from("12345"),
                    id: 1,
                    result: {
                        returns: Buffer.concat([Buffer.alloc(2), Buffer.from("12345")]),
                        isError: true,
                    },
                },
                {
                    method: "sum",
                    id: 2,
                    result: {},
                },
                {
                    method: "sum",
                    args: Buffer.from("12345"),
                    id: 3,
                    result: {
                        returns: Buffer.concat([Buffer.alloc(2), Buffer.from("12345")]),
                    },
                },
                {
                    method: "add",
                    id: 4,
                    result: {
                        isError: true,
                    },
                },
            ],
        });
    });
});
