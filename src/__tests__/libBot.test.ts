import LibBot from "../libBot";

describe("Full cycle", () => {
    test("Perfect transmission", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        bt1.on("send", (msgArr) => {
            msgArr.map(bt2.receiveMessage.bind(bt2));
        });
        const outArr: Array<Buffer> = [];
        bt2.on("message", (buf) => {
            outArr.push(buf);
        });
        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.sendMessage(b);
        }

        expect(outArr).toEqual(inputArr);
        expect(outArrOrdered).toEqual(inputArr);
    });

    test("Messages arrive in opposite order", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        const messagesInTransit: Array<Array<Buffer>> = [];
        bt1.on("send", (msgArr) => {
            messagesInTransit.unshift(msgArr);
        });

        const outArr: Array<Buffer> = [];
        bt2.on("message", (buf) => {
            outArr.push(buf);
        });
        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });
        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.sendMessage(b);
        }

        messagesInTransit.map((msgArr) => {
            msgArr.map(bt2.receiveMessage.bind(bt2));
        });

        expect(outArrOrdered).toEqual(inputArr);
        expect(outArr).toEqual(inputArr.reverse());
    });
});
