import { transform, isEqual, isPlainObject } from "lodash";

export function applySync(base: Record<string, any> = {}, sync: Record<string, any>) {
    const out: Record<string, any> = {
        ...base,
    };
    Object.keys(sync).map((k: string) => {
        if (isPlainObject(sync[k])) {
            out[k] = applySync(base[k], sync[k]);
        } else {
            out[k] = sync[k];
        }
    });
    return out;
}

export function applyDelete(base: Record<string, any>, del: Record<string, any>) {
    const out: Record<string, any> = {
        ...base,
    };
    Object.keys(out).map((k: string) => {
        if (isPlainObject(del[k])) {
            out[k] = applyDelete(base[k], del[k]);
        } else if (del[k]) {
            delete out[k];
        }
    });
    return out;
}

export function getSync(oldObj: Record<string, any> = {}, newObj: Record<string, any>): Record<string, any> {
    return transform(newObj, (acc, value, key) => {
        if (!isEqual(value, oldObj[key])) {
            acc[key] = isPlainObject(value) ? getSync(oldObj[key], value) : value;
        }
    });
}

export function getDelete(oldObj: Record<string, any>, newObj: Record<string, any>): Record<string, any> {
    return transform(oldObj, (acc, value, key) => {
        if (!newObj[key]) {
            acc[key] = true;
        } else if (isPlainObject(value)) {
            acc[key] = getDelete(value, newObj[key]);
        }
    });
}
