export default class IdCreator {
    min: number;
    max: number;
    curId: number;
    constructor(min?: number, max?: number);
    next(): number;
}
