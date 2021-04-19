import {
    decodeClientId,
    encodeClientId,
    decodeSeqAck,
    encodeSeqAck,
    decodeSessionId,
    encodeSessionId,
} from "../transcoder";

describe("Basic clientId", () => {
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
});

describe("Basic seqAck", () => {
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
