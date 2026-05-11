"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchPrompt = exports.PROMPT_PATTERNS = void 0;
exports.PROMPT_PATTERNS = [
    /proceed\?/i,
    /y\/n/i,
    /continue\?/i,
    /press enter/i,
    /confirm/i,
    /yes\/no/i,
];
function matchPrompt(text) {
    return exports.PROMPT_PATTERNS.some(pattern => pattern.test(text));
}
exports.matchPrompt = matchPrompt;
