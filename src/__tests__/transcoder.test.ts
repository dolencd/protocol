/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
    decodeClientId,
    encodeClientId,
    decodeSeqAck,
    encodeSeqAck,
    decodeSessionId,
    encodeSessionId,
} from "../transcoder";

describe("clientId", () => {
    const input = Buffer.from("02f9010203", "hex");
    const eClientId = Buffer.from("f901", "hex");
    const erest = Buffer.from("0203", "hex");

    test("decode", () => {
        const [clientId, rest] = decodeClientId(input);
        expect(clientId).toEqual(eClientId);
        expect(rest).toEqual(erest);
    });

    test("encode", () => {
        const output = encodeClientId(eClientId, erest);
        expect(output).toEqual(input);
    });

    test("decode - error", () => {
        expect(() => {
            // @ts-expect-error
            decodeClientId(12);
        }).toThrow(TypeError);

        expect(() => {
            decodeClientId(Buffer.allocUnsafe(1));
        }).toThrow(Error);

        expect(() => {
            decodeClientId(Buffer.from([3, 0, 0]));
        }).toThrow(Error);
    });

    test("encode - error", () => {
        expect(() => {
            // @ts-expect-error
            encodeClientId(12, Buffer.allocUnsafe(3));
        }).toThrow(TypeError);

        expect(() => {
            // @ts-expect-error
            encodeClientId(Buffer.allocUnsafe(3), 12);
        }).toThrow(TypeError);

        expect(() => {
            encodeClientId(Buffer.allocUnsafe(260));
        }).toThrow(Error);
    });
});

describe("seqAck", () => {
    const input = Buffer.from("f902020302000005020902010203", "hex");

    const eseq = 761;
    const eacks = [515, 517, 518, 519, 520, 521];
    const erest = Buffer.from("010203", "hex");

    test("decode", () => {
        const [seq, acks, rest] = decodeSeqAck(input);
        expect(seq).toEqual(eseq);
        expect(acks).toEqual(eacks);
        expect(rest).toEqual(erest);
    });

    test("encode", () => {
        const eoutput = Buffer.from("f90206030205020602070208020902010203".replace(" ", ""), "hex");
        const output = encodeSeqAck(eseq, eacks, erest);

        expect(output).toEqual(eoutput);
    });

    test("decode - error", () => {
        expect(() => {
            // @ts-expect-error
            decodeSeqAck(12);
        }).toThrow(TypeError);

        expect(() => {
            // too short for seq and ackLen
            decodeSeqAck(Buffer.allocUnsafe(2));
        }).toThrow(Error);

        expect(() => {
            // too short for guben number of acks
            decodeSeqAck(Buffer.from("0101020123".replace(" ", ""), "hex"));
        }).toThrow(Error);

        expect(() => {
            // too short for ack range
            decodeSeqAck(Buffer.from("01010201230000010202", "hex"));
        }).toThrow(Error);
    });

    test("encode - error", () => {
        expect(() => {
            // @ts-ignore
            encodeSeqAck(12, [], 12);
        }).toThrow(TypeError);

        expect(() => {
            encodeSeqAck(10);
        }).not.toThrow();

        expect(() => {
            encodeSeqAck(12, Array(260));
        }).toThrow(Error);

        expect(() => {
            encodeSeqAck(12, [2, 3, 4, 5, -1], Buffer.allocUnsafe(12));
        }).toThrow(Error);

        expect(() => {
            encodeSeqAck(12, [2, 3, 4, 5, 70000]);
        }).toThrow(Error);

        expect(() => {
            // @ts-ignore
            encodeSeqAck(12, [2, 3, 4, 5, "6"]);
        }).toThrow(Error);
    });
});

describe("sessionId", () => {
    const input = Buffer.from("f9010203", "hex");

    const eSessionId = 505;
    const erest = Buffer.from("0203", "hex");
    test("decode", () => {
        const [sessionId, rest] = decodeSessionId(input);
        expect(sessionId).toEqual(eSessionId);
        expect(rest).toEqual(erest);
    });

    test("encode", () => {
        const output = encodeSessionId(eSessionId, erest);
        expect(output).toEqual(input);
    });

    test("decode - error", () => {
        expect(() => {
            // @ts-ignore
            decodeSessionId(12);
        }).toThrow(TypeError);

        expect(() => {
            decodeSessionId(Buffer.allocUnsafe(1));
        }).toThrow(Error);
    });

    test("encode - error", () => {
        expect(() => {
            // @ts-ignore
            encodeSessionId(12, 12);
        }).toThrow(TypeError);

        expect(() => {
            // @ts-ignore
            encodeSessionId("234");
        }).toThrow(Error);

        expect(() => {
            encodeSessionId(-1);
        }).toThrow(Error);

        expect(() => {
            encodeSessionId(70000);
        }).toThrow(Error);
    });
});

describe("Minimal message - seqAck", () => {
    const input = Buffer.from("f90200", "hex");

    const eseq = 761;
    const eacks: Array<number> = [];
    const erest = Buffer.allocUnsafe(0);

    test("decode", () => {
        const [seq, acks, rest] = decodeSeqAck(input);
        expect(seq).toEqual(eseq);
        expect(acks).toEqual(eacks);
        expect(rest).toEqual(erest);
    });

    test("encode", () => {
        const eoutput = Buffer.from("f90200", "hex");
        const output = encodeSeqAck(eseq, eacks, erest);

        expect(output).toEqual(eoutput);
    });
});
