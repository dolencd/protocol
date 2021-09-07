import { PbTranscoder } from "../PbTranscoder";

const tc = new PbTranscoder({
    protoPath: "./src/__tests__/test.proto",
    syncType: "obj",
    delType: "objBool",
    methodEnumName: "methods",
});

describe("Full object", () => {
    const obj = {
        auth: Buffer.from("123456"),
        objAll: {
            int: 123,
            naprej: {
                int: 234,
            },
        },
        objSync: {
            str: "test",
            naprej: {
                str: "test2",
            },
        },
        objDelete: {
            str: true,
            naprej: {
                str: false,
            },
        },
        reqRpc: {
            1: {
                method: "sum",
                args: Buffer.from("1234"),
            },
        },
        reqRpcOrdered: {
            2: {
                method: "send",
            },
        },
        resRpc: {
            3: {
                returns: Buffer.from("12345"),
            },
        },
        events: [Buffer.from("123"), Buffer.from("456")],
        eventsOrdered: [Buffer.from("1234"), Buffer.from("5678")],
        code: 200,
        codes: [1, 2, 3, 4],
        reason: "asdf",
    };

    test("Decoded obj is the same as input obj", () => {
        const encoded = tc.encode(obj);
        const decoded = tc.decode(encoded);
        expect(decoded).toEqual(obj);
    });

    test("Decoded obj is the same as input obj with serialization step", () => {
        const encoded = tc.encode(obj);
        const decoded = tc.decode(encoded);
        expect(decoded).toEqual(obj);

        const tc1 = new PbTranscoder({
            restoreState: tc.getState(),
        });
        const encoded1 = tc1.encode(obj);
        const decoded1 = tc1.decode(encoded1);
        expect(encoded1).toEqual(encoded);
        expect(decoded1).toEqual(decoded);
    });

    test("static methods", () => {
        const objGeneral = {
            auth: Buffer.from("123456"),
            events: [Buffer.from("123"), Buffer.from("456")],
            eventsOrdered: [Buffer.from("1234"), Buffer.from("5678")],
            code: 200,
            codes: [1, 2, 3, 4],
            reason: "asdf",
            reqRpc: {
                1: {
                    args: Buffer.from("1234"),
                },
            },
            reqRpcOrdered: {
                2: {},
            },
            resRpc: {
                3: {
                    returns: Buffer.from("12345"),
                },
            },
        };

        const encodedFullFull = tc.encode(obj);
        const encodedFullGeneral = tc.encode(objGeneral);
        const encodedStaticFull = PbTranscoder.encode(obj);
        const encodedStaticGeneral = PbTranscoder.encode(objGeneral);

        expect(encodedStaticGeneral).toEqual(encodedStaticFull);
        expect(encodedStaticGeneral).toEqual(encodedFullGeneral);
        expect(PbTranscoder.decode(encodedFullFull)).toEqual(objGeneral);
        expect(PbTranscoder.decode(encodedStaticGeneral)).toEqual(objGeneral);
    });
});
