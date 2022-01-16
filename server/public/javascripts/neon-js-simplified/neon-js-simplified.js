// Simplified NEON-JS module.

// For now, we are grabbing what we need from neon-js as it becomes necessary.

/**
 * @param arr
 * @returns HEX string
 */
function ab2hexstring(arr) {
    if (typeof arr !== "object") {
        throw new Error(`ab2hexstring expects an array. Input was ${arr}`);
    }
    let result = "";
    const intArray = new Uint8Array(arr);
    for (const i of intArray) {
        let str = i.toString(16);
        str = str.length === 0 ? "00" : str.length === 1 ? "0" + str : str;
        result += str;
    }
    return result;
}

