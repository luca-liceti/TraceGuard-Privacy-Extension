/**
 * =============================================================================
 * HTML SANITIZER - Cleaning Up Dangerous HTML
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file helps protect against "XSS attacks" (Cross-Site Scripting).
 * Sometimes websites or user input contains malicious HTML/JavaScript code.
 * This sanitizer removes the dangerous parts while keeping safe formatting.
 * 
 * WHY XSS IS DANGEROUS:
 * Imagine someone types this in a comment: <script>stealPasswords()</script>
 * Without sanitization, that code would run in your browser! Bad!
 * 
 * HOW IT WORKS:
 * We use DOMPurify, a trusted library that:
 * - Allows safe tags: <b>, <i>, <a>, <br>, <p>, etc.
 * - Allows safe attributes: href, target, class
 * - Removes everything else (like <script> tags)
 * 
 * EXAMPLE:
 * Input:  "<script>evil()</script><b>Hello</b>"
 * Output: "<b>Hello</b>"
 * 
 * The script tag is removed, but bold text is kept!
 * =============================================================================
 */

import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * 
 * @param html - The potentially dangerous HTML string
 * @returns Safe HTML with only allowed tags and attributes
 * 
 * ALLOWED TAGS: b, i, em, strong, a, br, p, span, ul, li
 * ALLOWED ATTRIBUTES: href, target, class
 */
export function sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },  // Use HTML profile (not SVG, MathML)
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span', 'ul', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'class']  // Only these attributes are safe
    });
}
