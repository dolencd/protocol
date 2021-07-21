/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { stringify, parse } from "../serializer";

const test1 = {
    a: 1,
    b: "asd",
    c: {
        a: 2,
        b: "asd",
        c: {
            test: 123,
        },
        d: {
            a: 2,
            b: "uhg",
            c: {
                a: true,
            },
        },
        e: false,
    },
    d: {
        a: 2,
        b: "dfg",
        c: {
            test: 123,
        },
    },
    e: "asdfg",
};

const test2 = {
    buf: Buffer.from("1234"),
    a: 123,
    b: "str",
    c: {
        c: {
            bool: true,
            buf: Buffer.from("1234")
        }
    },
    m: new Map([
        [1, {a: "123"}],
        [2, {b: Buffer.from("12")}],
        [3, {a: "neki", b: Buffer.from("1234")}],
    ]),
    mm: new Map([
        [1, Buffer.from("1")],
        [2, Buffer.allocUnsafe(0)],
        [3, Buffer.from("123141413453453452345345")]
    ])
}

const test3 = {
    a: test1,
    b: test2,
    m1: new Map([
        [1, test1],
        [2, test1],
        [3, test1]
    ]),
    m2: new Map([
        [1, test2],
        [2, test2],
        [3, test2]
    ])
}

describe("Test serializer", () => {
    test("Simple object", () => {
        expect(parse(stringify(test1))).toEqual(test1)
    })

    test("Maps and Buffers", () => {
        expect(parse(stringify(test2))).toEqual(test2)
    })
    test("Complex combined object", () => {
        expect(parse(stringify(test3))).toEqual(test3)
    })
});
