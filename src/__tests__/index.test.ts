import { Protocol, createServer, createClient } from "../index";

interface ErrorObject {
    code?: number;
    reason?: string;
}

describe("Establishing and communication - LibBot + perfect communication", () => {
    let cp: Protocol;
    let sp: Protocol;
    let authMsg: Buffer;
    let resMsg: Buffer;
    let err1: ErrorObject;
    let err2: ErrorObject;
    let eventFn: jest.Mock;
    let rpcFn: jest.Mock;

    beforeEach(async () => {
        [cp, authMsg, err1] = createClient(
            {
                enableOrdering: true,
                protoPath: "./src/__tests__/test.proto",
                syncType: "obj",
                delType: "objBool",
                methodEnumName: "methods",
            },
            Buffer.from([1])
        );
        [sp, resMsg, err2] = await createServer(
            {
                enableOrdering: true,
                protoPath: "./src/__tests__/test.proto",
                syncType: "obj",
                delType: "objBool",
                methodEnumName: "methods",
            },
            authMsg,
            (authBuf: Buffer) => {
                if (authBuf[0] % 2 === 1) {
                    return true;
                }
                return {
                    code: 400,
                    reason: "Auth buffer should be odd",
                };
            }
        );
        cp.receiveMessage(resMsg);

        cp.on("send", (buf) => {
            sp.receiveMessage(buf);
        });

        sp.on("send", (buf) => {
            cp.receiveMessage(buf);
        });

        rpcFn = jest.fn((method, args, cb) => {
            if (method === "add") cb(false, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
            if (method === "sum") cb(true, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
        });
        eventFn = jest.fn();

        sp.on("call", rpcFn);
        sp.on("event", eventFn);
    });

    test("No errors emitted during creation", () => {
        expect(err1).toBeNull();
        expect(err2).toBeNull();

        expect(cp.maxEmittedSeq).toEqual(1);
        expect(cp.maxIncSeq).toEqual(1);
        expect(cp.maxSendSeq).toEqual(0);

        expect(sp.maxEmittedSeq).toEqual(0);
        expect(sp.maxIncSeq).toEqual(0);
        expect(sp.maxSendSeq).toEqual(1);
    });
    test("Events", () => {
        cp.sendEvent(Buffer.from("1"));
        cp.sendEventOrdered(Buffer.from("3"));
        cp.sendEvent(Buffer.from("2"));

        cp.send();

        expect(eventFn.mock.calls).toEqual([[Buffer.from("1")], [Buffer.from("2")], [Buffer.from("3")]]);
        expect(cp.maxEmittedSeq).toEqual(1);
        expect(cp.maxIncSeq).toEqual(1);
        expect(cp.maxSendSeq).toEqual(1);

        expect(sp.maxEmittedSeq).toEqual(1);
        expect(sp.maxIncSeq).toEqual(1);
        expect(sp.maxSendSeq).toEqual(1);
    });

    test("RPC execution", (done) => {
        Promise.allSettled([
            cp.callFn("add", Buffer.from("12345")),
            cp.callFn("sum"),
            cp.callFnOrdered("sum", Buffer.from("12345")),
            cp.callFnOrdered("add"),
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
            expect(cp.maxEmittedSeq).toEqual(2);
            expect(cp.maxIncSeq).toEqual(2);
            expect(cp.maxSendSeq).toEqual(1);

            expect(sp.maxEmittedSeq).toEqual(1);
            expect(sp.maxIncSeq).toEqual(1);
            expect(sp.maxSendSeq).toEqual(2);
            done();
        });
        cp.send();
        sp.send();
    });
});

describe("Establishing and communication - NO LibBot + perfect communication", () => {
    let cp: Protocol;
    let sp: Protocol;
    let authMsg: Buffer;
    let resMsg: Buffer;
    let err1: ErrorObject;
    let err2: ErrorObject;
    let eventFn: jest.Mock;
    let rpcFn: jest.Mock;

    beforeEach(async () => {
        [cp, authMsg, err1] = createClient(
            {
                enableOrdering: false,
                protoPath: "./src/__tests__/test.proto",
                syncType: "obj",
                delType: "objBool",
                methodEnumName: "methods",
            },
            Buffer.from([1])
        );
        [sp, resMsg, err2] = await createServer(
            {
                enableOrdering: false,
                protoPath: "./src/__tests__/test.proto",
                syncType: "obj",
                delType: "objBool",
                methodEnumName: "methods",
            },
            authMsg,
            (authBuf: Buffer) => {
                if (authBuf[0] % 2 === 1) {
                    return true;
                }
                return {
                    code: 400,
                    reason: "Auth buffer should be odd",
                };
            }
        );
        cp.receiveMessage(resMsg);

        cp.on("send", (buf) => {
            sp.receiveMessage(buf);
        });

        sp.on("send", (buf) => {
            cp.receiveMessage(buf);
        });

        rpcFn = jest.fn((method, args, cb) => {
            if (method === "add") cb(false, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
            if (method === "sum") cb(true, Buffer.concat([Buffer.from([0, 0]), args || Buffer.allocUnsafe(0)]));
        });
        eventFn = jest.fn();

        sp.on("call", rpcFn);
        sp.on("event", eventFn);
    });

    test("No errors emitted during creation", () => {
        expect(err1).toBeNull();
        expect(err2).toBeNull();

        expect(cp.maxEmittedSeq).toBeNull();
        expect(cp.maxIncSeq).toBeNull();
        expect(cp.maxSendSeq).toBeNull();

        expect(sp.maxEmittedSeq).toBeNull();
        expect(sp.maxIncSeq).toBeNull();
        expect(sp.maxSendSeq).toBeNull();
    });
    test("Events", () => {
        cp.sendEvent(Buffer.from("1"));
        cp.sendEventOrdered(Buffer.from("3"));
        cp.sendEvent(Buffer.from("2"));

        cp.send();

        expect(eventFn.mock.calls).toEqual([[Buffer.from("1")], [Buffer.from("2")], [Buffer.from("3")]]);
        expect(cp.maxEmittedSeq).toBeNull();
        expect(cp.maxIncSeq).toBeNull();
        expect(cp.maxSendSeq).toBeNull();

        expect(sp.maxEmittedSeq).toBeNull();
        expect(sp.maxIncSeq).toBeNull();
        expect(sp.maxSendSeq).toBeNull();
    });

    test("RPC execution", (done) => {
        Promise.allSettled([
            cp.callFn("add", Buffer.from("12345")),
            cp.callFn("sum"),
            cp.callFnOrdered("sum", Buffer.from("12345")),
            cp.callFnOrdered("add"),
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
            expect(cp.maxEmittedSeq).toBeNull();
            expect(cp.maxIncSeq).toBeNull();
            expect(cp.maxSendSeq).toBeNull();

            expect(sp.maxEmittedSeq).toBeNull();
            expect(sp.maxIncSeq).toBeNull();
            expect(sp.maxSendSeq).toBeNull();
            done();
        });
        cp.send();
        sp.send();
    });

    test("Object Syncing", () => {
        sp.outObj.int = 1234;
        sp.outObj.naprej = {};
        sp.outObj.naprej.naprej = {};
        sp.outObj.naprej.naprej.float = 3.14;
        sp.outObj.bytes = Buffer.from("12345");
        sp.outObj.naprej.boolean = false;
        sp.outObj.str = "test";

        sp.send();

        expect(cp.incObj.int).toEqual(1234);
        expect(cp.incObj.naprej.naprej.float).toBeCloseTo(3.14, 3);
        expect(cp.incObj.bytes).toEqual(Buffer.from("12345"));
        expect(cp.incObj.naprej.boolean).toEqual(false);
        expect(cp.incObj.str).toEqual("test");
    });
});
