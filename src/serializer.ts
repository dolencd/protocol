/**
 * Serializes any object using custom Map and Buffer encoding
 * @param object Object to be serialized
 * @returns Serialized object
 */
export function stringify(object: Record<string, any>): string {
    return JSON.stringify(object, (key, value) => {
        if (value instanceof Map) {
            return {
                mapValue: [...value],
            };
        }
        if (value && value.type === "Buffer" && Array.isArray(value.data)) {
            return { bufBase64: Buffer.from(value.data).toString("base64") };
        }
        return value;
    });
}

/**
 * Deserializes a string according to the custom encoding
 * @param str String to deserialize
 * @returns Deserialized object
 */
export function parse(str: string): Record<string, any> {
    return JSON.parse(str, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (Array.isArray(value.mapValue) && Object.keys(value).length === 1) {
                return new Map(value.mapValue);
            }
            if (typeof value.bufBase64 === "string" && Object.keys(value).length === 1) {
                return Buffer.from(value.bufBase64, "base64");
            }
        }
        return value;
    });
}
