export default class IdCreator {
    readonly min: number;

    readonly max: number;

    cur: number;

    constructor(cur = 1, min = 1, max = 65535) {
        this.min = min;
        this.max = max;
        this.cur = cur;
    }

    next(): number {
        const id = this.cur;
        if (id >= this.max) {
            this.cur = this.min;
        } else {
            this.cur++;
        }
        return id;
    }
}
