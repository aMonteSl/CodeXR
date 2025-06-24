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
exports.parseHTMLFile = parseHTMLFile;
exports.prepareHTMLForTemplate = prepareHTMLForTemplate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parses HTML file and extracts DOM structure
 * @param filePath Path to the HTML file
 * @returns DOM analysis result
 */
async function parseHTMLFile(filePath) {
    try {
        // Read the HTML file
        const htmlContent = await fs.promises.readFile(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        // Parse the HTML content
        const domTree = parseHTMLContent(htmlContent);
        const analysis = analyzeDOM(domTree);
        const result = {
            fileName,
            filePath,
            totalElements: analysis.totalElements,
            maxDepth: analysis.maxDepth,
            htmlContent: htmlContent,
            domTree: domTree,
            elementCounts: analysis.elementCounts,
            timestamp: new Date().toISOString()
        };
        return result;
    }
    catch (error) {
        throw new Error(`Failed to parse HTML file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Parses HTML content into DOM tree structure
 * @param htmlContent Raw HTML content
 * @returns Root DOM element
 */
function parseHTMLContent(htmlContent, depth = 0) {
    // Simple HTML parser - this is a basic implementation
    // For production, you might want to use a proper HTML parser library
    // Remove comments and clean up
    const cleanedHTML = htmlContent
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    // Find the root element (usually <html> or first tag)
    const rootMatch = cleanedHTML.match(/<(\w+)([^>]*)>/);
    if (!rootMatch) {
        // If no tags found, create a text node
        return {
            tagName: 'TEXT_NODE',
            attributes: {},
            children: [],
            textContent: cleanedHTML,
            depth: depth,
            classes: []
        };
    }
    const tagName = rootMatch[1].toLowerCase();
    const attributesString = rootMatch[2];
    // Parse attributes
    const attributes = parseAttributes(attributesString);
    const classes = attributes.class ? attributes.class.split(/\s+/).filter(c => c) : [];
    const id = attributes.id;
    // Create root element
    const rootElement = {
        tagName,
        attributes,
        children: [],
        depth,
        id,
        classes
    };
    // For now, we'll create a simplified structure
    // In a full implementation, you'd recursively parse child elements
    return rootElement;
}
/**
 * Parses HTML attributes from attribute string
 * @param attributesString String containing HTML attributes
 * @returns Object with parsed attributes
 */
function parseAttributes(attributesString) {
    const attributes = {};
    if (!attributesString.trim()) {
        return attributes;
    }
    // Simple attribute parsing
    const attrMatches = attributesString.matchAll(/(\w+)(?:\s*=\s*["']([^"']*)["'])?/g);
    for (const match of attrMatches) {
        const [, name, value] = match;
        attributes[name.toLowerCase()] = value || name;
    }
    return attributes;
}
/**
 * Analyzes DOM tree to extract statistics
 * @param domTree Root DOM element
 * @returns Analysis statistics
 */
function analyzeDOM(domTree) {
    const elementCounts = {};
    let totalElements = 0;
    let maxDepth = 0;
    function traverse(element) {
        totalElements++;
        maxDepth = Math.max(maxDepth, element.depth);
        // Count element types
        elementCounts[element.tagName] = (elementCounts[element.tagName] || 0) + 1;
        // Traverse children
        element.children.forEach(child => traverse(child));
    }
    traverse(domTree);
    return { totalElements, maxDepth, elementCounts };
}
/**
 * Prepares HTML content for template injection
 * @param domAnalysis DOM analysis result
 * @returns Clean HTML ready for babia-html attribute (single line, no escaping)
 */
function prepareHTMLForTemplate(domAnalysis) {
    let htmlContent = domAnalysis.htmlContent;
    // Extract only the body content, not the full HTML document
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        htmlContent = bodyMatch[1].trim();
    }
    else {
        // If no body tag, try to extract content between <html> tags
        const htmlMatch = htmlContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        if (htmlMatch) {
            // Remove head section and keep only what would be in body
            let content = htmlMatch[1];
            const headMatch = content.match(/<head[^>]*>[\s\S]*?<\/head>/i);
            if (headMatch) {
                content = content.replace(headMatch[0], '').trim();
            }
            htmlContent = content;
        }
    }
    // Clean up the HTML content - CRITICAL: Convert to single line and remove problematic content
    let cleanHTML = htmlContent
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove script tags
        .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove style tags
        .replace(/\r\n/g, ' ') // Replace Windows line endings with spaces
        .replace(/\n/g, ' ') // Replace Unix line endings with spaces  
        .replace(/\r/g, ' ') // Replace Mac line endings with spaces
        .replace(/\t/g, ' ') // Replace tabs with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim(); // Remove leading/trailing whitespace
    // If the HTML is too long, truncate it but keep it valid
    if (cleanHTML.length > 3000) {
        // Find a good place to cut (try to end at a closing tag)
        const cutPoint = cleanHTML.lastIndexOf('>', 3000);
        if (cutPoint > 2500) {
            cleanHTML = cleanHTML.substring(0, cutPoint + 1);
        }
        else {
            cleanHTML = cleanHTML.substring(0, 3000);
        }
    }
    // Ensure we have some basic content if extraction failed
    if (!cleanHTML || cleanHTML.length < 10) {
        cleanHTML = `<div><h1>Sample Content</h1><p>HTML content extracted from ${domAnalysis.fileName}</p></div>`;
    }
    // CRITICAL: Return as single line without any escaping
    // The babia-html component expects raw HTML, not escaped HTML
    return cleanHTML;
}
//# sourceMappingURL=htmlDomParser.js.map