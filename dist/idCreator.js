"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class IdCreator {
    constructor(min = 1, max = 65535) {
        this.min = min;
        this.max = max;
        this.curId = min;
    }
    next() {
        const id = this.curId;
        if (id >= this.max) {
            this.curId = this.min;
        }
        else {
            this.curId++;
        }
        return id;
    }
}
exports.default = IdCreator;
//# sourceMappingURL=idCreator.js.map