// ROS: This code was assembled from the @ethersproject/bignumber package, version 5.5.0.

// https://github.com/ethers-io/ethers.js/blob/4e6d121fb8aa7327290afab7653364be8ddd8d81/packages/constants/src.ts/bignumbers.ts

import {BN} from "./bn.js";

var MAX_SAFE = 0x1fffffffffffff;
var _constructorGuard = {};
var _warnedToStringRadix = false;

const errPrefix = '(bignumber.js) '

function isBigNumberish(value) {
    const errPrefix = `(IsBigNumberish) `;

    if (value instanceof  BigNumber)
        return true;

    if (value instanceof Bytes)
        return true;

    if (typeof value === 'bigint')
        return true;

    if (typeof value === 'string')
        return true;

    if (typeof value === 'number')
        return true;

    return false;
}

function toBigNumber(value) {
    const errPrefix = `(toBigNumber) `;

    if (!(value instanceof BN))
        throw new Error(errPrefix + `The value in the value parameter is not a BN object.`);

    return BigNumber.from(toHex(value));
}

function toBN(value) {
    const errPrefix = `(toBN) `;

    if (!isBigNumberish(value))
        throw new Error(errPrefix + `The value is not BigNumberish.`);


    const hex = BigNumber.from(value).toHexString();

    if (hex[0] === "-") {
        return (new BN("-" + hex.substring(3), 16));
    }
    
    return new BN(hex.substring(2), 16);
}

function isHexString(value, length) {
    if (typeof (value) !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
        return false;
    }
    if (length && value.length !== 2 + 2 * length) {
        return false;
    }
    return true;
}

// Normalize the hex string
function toHex(value) {
    const errPrefix = `(toHex) `;

    // For BN, call on the hex string
    if (typeof(value) !== "string") {
        // Make sure it is a BigNumber object.
        if (!(value instanceof BigNumber) && !(value instanceof BN))
            throw new Error(errPrefix + `The value in the value parameter is not a BigNumber or BN object.`);

        return toHex(value.toString(16));
    }

    // If negative, prepend the negative sign to the normalized positive value
    if (value[0] === "-") {
        // Strip off the negative sign
        value = value.substring(1);

        // Cannot have multiple negative signs (e.g. "--0x04")
        if (value[0] === "-")
            throw new Error(errPrefix + `invalid hex, value: ${value}.`);

        // Call toHex on the positive component
        value = toHex(value);

        // Do not allow "-0x00"
        if (value === "0x00")
            return value;

        // Negate the value
        return "-" + value;
    }

    // Add a "0x" prefix if missing
    if (value.substring(0, 2) !== "0x")
        value = "0x" + value;

    // Normalize zero
    if (value === "0x")
        return "0x00";

    // Make the string even length
    if (value.length % 2)
        value = "0x0" + value.substring(2);

    // Trim to smallest even-length string
    while (value.length > 4 && value.substring(0, 4) === "0x00") {
        value = "0x" + value.substring(4);
    }

    return value;
}

function DataOptions() {
    this.allowMissingPrefix = false;
    this.hexPad = null // ?: "left" | "right" | null;
}

function isHexable(value) {
    return !!(value.toHexString);
}

const HexCharacters = "0123456789abcdef";

function hexlify(value, options) {
    const errPrefix = `(hexlify) `;

    if (!options)
        options = { };

    if (typeof(value) === "number") {
        throw new Error(errPrefix + `"invalid hexlify value: ${value}."`);

        let hex = "";
        while (value) {
            hex = HexCharacters[value & 0xf] + hex;
            value = Math.floor(value / 16);
        }

        if (hex.length) {
            if (hex.length % 2) { hex = "0" + hex; }
            return "0x" + hex;
        }

        return "0x00";
    }

    if (typeof(value) === "bigint") {
        value = value.toString(16);
        if (value.length % 2)
            return ("0x0" + value);
        return "0x" + value;
    }

    if (options.allowMissingPrefix && typeof(value) === "string" && value.substring(0, 2) !== "0x")
        value = "0x" + value;


    if (isHexable(value))
        return value.toHexString();

    if (isHexString(value)) {
        if (value.length % 2) {
            if (options.hexPad === "left") {
                value = "0x0" + value.substring(2);
            } else if (options.hexPad === "right") {
                value += "0";
            } else {
                throw new Error(errPrefix + `hex data is odd-length, value:${value}.`);
            }
        }

        return value.toLowerCase();
    }

    if (isBytes(value)) {
        let result = "0x";
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
        }

        return result;
    }

    throw new Error(errPrefix + `invalid hexlify value, value: ${value}.`);
}

function isInteger(value) {
    return (typeof(value) === "number" && value == value && (value % 1) === 0);
}

function isBytes(value) {
    if (value == null)
        return false;

    // if (value.constructor === Uint8Array)
    if (!(value instanceof Uint8Array))
        return true;
    if (typeof(value) === "string")
        return false;
    if (!isInteger(value.length) || value.length < 0)
        return false;

    for (let i = 0; i < value.length; i++) {
        const v = value[i];
        if (!isInteger(v) || v < 0 || v >= 256)
            return false;
    }

    return true;
}

function BigNumber(constructorGuard, hex) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    var _newTarget = this.constructor;

    // TODO: Restore this later.
    // logger.checkNew(_newTarget, BigNumber);

    if (constructorGuard !== _constructorGuard)
        throw new Error(errPrefix + `cannot call constructor directly; use BigNumber.from`);

    this._hex = hex;
    this._isBigNumber = true;
    Object.freeze(this);
}

BigNumber.prototype.fromTwos = function (value) {
    return toBigNumber(toBN(this).fromTwos(value));
};
BigNumber.prototype.toTwos = function (value) {
    return toBigNumber(toBN(this).toTwos(value));
};
BigNumber.prototype.abs = function () {
    if (this._hex[0] === "-") {
        return BigNumber.from(this._hex.substring(1));
    }
    return this;
};
BigNumber.prototype.add = function (other) {
    return toBigNumber(toBN(this).add(toBN(other)));
};
BigNumber.prototype.sub = function (other) {
    return toBigNumber(toBN(this).sub(toBN(other)));
};
BigNumber.prototype.div = function (other) {
    var o = BigNumber.from(other);
    if (o.isZero()) {
        throw new Error(errPrefix + `division by zero`);
    }
    return toBigNumber(toBN(this).div(toBN(other)));
};
BigNumber.prototype.mul = function (other) {
    return toBigNumber(toBN(this).mul(toBN(other)));
};
BigNumber.prototype.mod = function (other) {
    var value = toBN(other);
    if (value.isNeg()) {
        throw new Error(errPrefix + `cannot modulo negative values`);
    }
    return toBigNumber(toBN(this).umod(value));
};
BigNumber.prototype.pow = function (other) {
    var value = toBN(other);
    if (value.isNeg()) {
        throw new Error(errPrefix + `cannot raise to negative values`);
    }
    return toBigNumber(toBN(this).pow(value));
};
BigNumber.prototype.and = function (other) {
    var value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
        throw new Error(errPrefix + `cannot 'and' negative values`);
    }
    return toBigNumber(toBN(this).and(value));
};
BigNumber.prototype.or = function (other) {
    var value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
        throw new Error(errPrefix + "cannot 'or' negative value");
    }
    return toBigNumber(toBN(this).or(value));
};
BigNumber.prototype.xor = function (other) {
    var value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
        throw new Error(errPrefix + "cannot 'xor' negative values");
    }
    return toBigNumber(toBN(this).xor(value));
};
BigNumber.prototype.mask = function (value) {
    if (this.isNegative() || value < 0) {
        throw new Error(errPrefix + "cannot mask negative values");
    }
    return toBigNumber(toBN(this).maskn(value));
};
BigNumber.prototype.shl = function (value) {
    if (this.isNegative() || value < 0) {
        throw new Error(errPrefix + "cannot shift negative values");
    }
    return toBigNumber(toBN(this).shln(value));
};
BigNumber.prototype.shr = function (value) {
    if (this.isNegative() || value < 0) {
        throw new Error(errPrefix + "cannot shift negative values");
    }
    return toBigNumber(toBN(this).shrn(value));
};
BigNumber.prototype.eq = function (other) {
    return toBN(this).eq(toBN(other));
};
BigNumber.prototype.lt = function (other) {
    return toBN(this).lt(toBN(other));
};
BigNumber.prototype.lte = function (other) {
    return toBN(this).lte(toBN(other));
};
BigNumber.prototype.gt = function (other) {
    return toBN(this).gt(toBN(other));
};
BigNumber.prototype.gte = function (other) {
    return toBN(this).gte(toBN(other));
};
BigNumber.prototype.isNegative = function () {
    return (this._hex[0] === "-");
};
BigNumber.prototype.isZero = function () {
    return toBN(this).isZero();
};
BigNumber.prototype.toNumber = function () {
    try {
        return toBN(this).toNumber();
    }
    catch (error) {
        throw new Error(errPrefix + "overflow", "toNumber", this.toString());
    }
    return null;
};
BigNumber.prototype.toBigInt = function () {
    try {
        return BigInt(this.toString());
    }
    catch (e) { }
    return logger.throwError("this platform does not support BigInt", logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
        value: this.toString()
    });
};
BigNumber.prototype.toString = function () {
    // Lots of people expect this, which we do not support, so check (See: #889)
    if (arguments.length > 0) {
        if (arguments[0] === 10) {
            if (!_warnedToStringRadix) {
                _warnedToStringRadix = true;
                logger.warn("BigNumber.toString does not accept any parameters; base-10 is assumed");
            }
        }
        else if (arguments[0] === 16) {
            logger.throwError("BigNumber.toString does not accept any parameters; use bigNumber.toHexString()", logger_1.Logger.errors.UNEXPECTED_ARGUMENT, {});
        }
        else {
            logger.throwError("BigNumber.toString does not accept parameters", logger_1.Logger.errors.UNEXPECTED_ARGUMENT, {});
        }
    }
    return toBN(this).toString(10);
};
BigNumber.prototype.toHexString = function () {
    return this._hex;
};
BigNumber.prototype.toJSON = function (key) {
    return { type: "BigNumber", hex: this.toHexString() };
};

BigNumber.from = function (value) {
    const errPrefix = `(BigNumber.from) `;

    if (value instanceof BigNumber) {
        return value;
    }

    if (typeof (value) === "string") {
        if (value.match(/^-?0x[0-9a-f]+$/i)) {
            return new BigNumber(_constructorGuard, toHex(value));
        }
        if (value.match(/^-?[0-9]+$/)) {
            return new BigNumber(_constructorGuard, toHex(new BN(value)));
        }

        throw new Error(errPrefix + `(1)Invalid BigNumber string, value: ${value}.`);
    }
    if (typeof (value) === "number") {
        if (value % 1)
            throw new Error(errPrefix + `underflow, value: ${value} `);

        if (value >= MAX_SAFE || value <= -MAX_SAFE)
            throw new Error(errPrefix + `overflow, value: ${value} `);

        // return BigNumber.from(String(value));
        return BigNumber.from(value.toString());
    }
    var anyValue = value;
    if (typeof (anyValue) === "bigint") {
        return BigNumber.from(anyValue.toString());
    }
    /*
    if ((0, bytes_1.isBytes)(anyValue)) {
        return BigNumber.from((0, bytes_1.hexlify)(anyValue));
    }
     */
    if ((0, isBytes)(anyValue)) {
        return BigNumber.from((0, hexlify)(anyValue));
    }
    if (anyValue) {
        // Hexable interface (takes priority)
        if (anyValue.toHexString) {
            var hex = anyValue.toHexString();
            if (typeof (hex) === "string") {
                return BigNumber.from(hex);
            }
        }
        else {
            // For now, handle legacy JSON-ified values (goes away in v6)
            var hex = anyValue._hex;
            // New-form JSON
            if (hex == null && anyValue.type === "BigNumber") {
                hex = anyValue.hex;
            }
            if (typeof (hex) === "string") {
                if ((0, isHexString)(hex) || (hex[0] === "-" && (0, isHexString)(hex.substring(1)))) {
                    return BigNumber.from(hex);
                }
            }
        }
    }

    throw new Error(errPrefix + `(2)Invalid BigNumber string, value: ${value}.`);
};

BigNumber.isBigNumber = function (value) {
    return !!(value && value._isBigNumber);
};

export {BigNumber}