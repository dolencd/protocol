import { encode, decode } from "../PbTranscoder";

describe("Full object", () => {
    const obj = {
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
        const encoded = encode(obj);
        const decoded = decode(encoded);
        expect(decoded).toEqual(obj);
    });
});
