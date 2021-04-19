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
        [cp, authMsg, err1] = createClient({ enableOrdering: true }, Buffer.from([1]));
        [sp, resMsg, err2] = await createServer(
            {
                enableOrdering: true,
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
        [cp, authMsg, err1] = createClient({ enableOrdering: false }, Buffer.from([1]));
        [sp, resMsg, err2] = await createServer(
            {
                enableOrdering: false,
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
    });
    test("Events", () => {
        cp.sendEvent(Buffer.from("1"));
        cp.sendEventOrdered(Buffer.from("3"));
        cp.sendEvent(Buffer.from("2"));

        cp.send();

        expect(eventFn.mock.calls).toEqual([[Buffer.from("1")], [Buffer.from("2")], [Buffer.from("3")]]);
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
            done();
        });
        cp.send();
        sp.send();
    });
});
