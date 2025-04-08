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
exports.getAllComments = getAllComments;
exports.calculateCommentLines = calculateCommentLines;
const ts = __importStar(require("typescript"));
/**
 * Gets all comments from a source file
 */
function getAllComments(sourceFile, fileContent) {
    const comments = [];
    // Get leading and trailing comments throughout the file
    let pos = 0;
    while (pos < fileContent.length) {
        const leadingComments = ts.getLeadingCommentRanges(fileContent, pos);
        if (leadingComments) {
            comments.push(...leadingComments);
        }
        const trailingComments = ts.getTrailingCommentRanges(fileContent, pos);
        if (trailingComments) {
            comments.push(...trailingComments);
        }
        pos++;
    }
    return comments;
}
/**
 * Calculates the number of lines occupied by comments
 */
function calculateCommentLines(comments, fileContent) {
    let commentLines = 0;
    // Create a set to track which lines are comments to avoid counting twice
    const commentedLines = new Set();
    for (const comment of comments) {
        const commentText = fileContent.substring(comment.pos, comment.end);
        // Find line number for start position
        let startLine = 0;
        let pos = 0;
        while (pos < comment.pos && pos < fileContent.length) {
            if (fileContent[pos] === '\n') {
                startLine++;
            }
            pos++;
        }
        if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
            // For single-line comments, add the line if not already counted
            if (!commentedLines.has(startLine)) {
                commentedLines.add(startLine);
                commentLines++;
            }
        }
        else if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
            // For multi-line comments, count each line if not already counted
            const lineBreaks = commentText.match(/\n/g) || [];
            for (let i = 0; i <= lineBreaks.length; i++) {
                if (!commentedLines.has(startLine + i)) {
                    commentedLines.add(startLine + i);
                    commentLines++;
                }
            }
        }
    }
    return commentLines;
}
//# sourceMappingURL=commentMetrics.js.map