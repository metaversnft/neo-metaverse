// ROS: Modified this code to support ES6 import format.

var toString = {}.toString;

// module.exports = Array.isArray || function (arr) {
const isArrayCheck = Array.isArray || function (arr) {
    return toString.call(arr) === '[object Array]';
};

export { isArrayCheck }