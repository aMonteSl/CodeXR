"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFileHash = calculateFileHash;
exports.calculateStringHash = calculateStringHash;
exports.compareFilesByHash = compareFilesByHash;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
/**
 * Calculates SHA-256 hash of file contents
 * @param filePath Path to the file
 * @returns SHA-256 hash as hexadecimal string
 */
function calculateFileHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }
    catch (error) {
        throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
    }
}
/**
 * Calculates SHA-256 hash of string content
 * @param content String content to hash
 * @returns SHA-256 hash as hexadecimal string
 */
function calculateStringHash(content) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(content, 'utf8');
    return hashSum.digest('hex');
}
/**
 * Compares two files by their hash
 * @param filePath1 Path to first file
 * @param filePath2 Path to second file
 * @returns True if files have the same content
 */
function compareFilesByHash(filePath1, filePath2) {
    try {
        const hash1 = calculateFileHash(filePath1);
        const hash2 = calculateFileHash(filePath2);
        return hash1 === hash2;
    }
    catch (error) {
        return false;
    }
}
//# sourceMappingURL=hash.js.map