/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { getDelete, getSync, applyDelete, applySync } from "../differ";

const start = {
    a: 1,
    b: "asd",
    c: {
        a: 2,
        b: "dfg",
        c: {
            test: 123,
        },
    },
    d: {
        a: 2,
        b: "dfg",
        c: {
            test: 123,
        },
    },
};

const end = {
    a: 1,
    c: {
        b: "asd",
        e: false,
        d: {
            a: 2,
            b: "uhg",
            c: {
                a: true,
            },
        },
    },
    e: "asdfg",
};

const del = {
    b: true,
    c: {
        a: true,
        c: true,
    },
    d: true,
};

const afterDel = {
    a: 1,
    c: {
        b: "dfg",
    },
};

const sync = {
    e: "asdfg",
    c: {
        e: false,
        b: "asd",
        d: {
            a: 2,
            b: "uhg",
            c: {
                a: true,
            },
        },
    },
};

const afterSync = {
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

describe("Test differ", () => {
    test("getDelete", () => {
        expect(getDelete(start, end)).toEqual(del);
    });
    test("getSync", () => {
        expect(getSync(start, end)).toEqual(sync);
    });
    test("applyDelete", () => {
        expect(applyDelete(start, del)).toEqual(afterDel);
    });
    test("applySync", () => {
        expect(applySync(start, sync)).toEqual(afterSync);
    });

    test("Start sync with empty object", () => {
        expect(getSync({}, end)).toEqual(end);
        expect(applySync({}, end)).toEqual(end);
    });

    test("Delete everything", () => {
        expect(getDelete(start, {})).toEqual({
            a: true,
            b: true,
            c: true,
            d: true,
        });
    });

    test("apply both", () => {
        const a = applyDelete(start, del);
        const b = applySync(a, sync);
        expect(b).toEqual(end);
    });
});
