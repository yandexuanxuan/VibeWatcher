"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitLines = exports.parseLine = void 0;
function parseLine(line) {
    return line.trim();
}
exports.parseLine = parseLine;
function splitLines(text) {
    const lines = text.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines.map(parseLine).filter(line => line !== '');
}
exports.splitLines = splitLines;
