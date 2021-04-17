import LibBot from "../libBot";

describe("Full cycle", () => {
    test("Perfect transmission", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        bt1.on("send", bt2.receiveMessage.bind(bt2));

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
            bt1.send(b);
        }

        expect(outArr).toEqual(inputArr);
        expect(outArrOrdered).toEqual(inputArr);
    });

    test("Messages arrive in opposite order", () => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        const messagesInTransit: Array<Array<Buffer>> = [];
        bt1.on("send", (msg: Buffer) => {
            messagesInTransit.unshift(msg);
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
            bt1.send(b);
        }

        messagesInTransit.map(bt2.receiveMessage.bind(bt2));

        expect(outArrOrdered).toEqual(inputArr);
        expect(outArr).toEqual(inputArr.reverse());
    });

    test("Retransmission", (done) => {
        const bt1 = new LibBot();
        const bt2 = new LibBot();

        let failSomeMessages = true;

        let count = 0;
        bt1.on("send", (msg) => {
            count++;
            if (failSomeMessages && count % 3 === 0) {
                return;
            }
            bt2.receiveMessage.call(bt2, msg);
        });
        bt2.on("send", bt1.receiveMessage.bind(bt1));

        const outArrOrdered: Array<Buffer> = [];
        bt2.on("messageOrdered", (buf) => {
            outArrOrdered.push(buf);
        });

        const inputArr: Array<Buffer> = [];
        for (let i = 1; i < 20; i++) {
            const b = Buffer.from([i]);
            inputArr.push(b);
            bt1.send(b);
        }

        // disable bad network
        failSomeMessages = false;
        // inform
        bt2.send(Buffer.allocUnsafe(0));
        bt1.sendFailedMessages();

        process.nextTick(() => {
            expect(outArrOrdered).toEqual(inputArr);
            done();
        });
    });
});
