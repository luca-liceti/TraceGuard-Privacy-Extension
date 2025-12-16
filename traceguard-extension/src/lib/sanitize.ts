import DOMPurify from 'dompurify';

export function sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span', 'ul', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'class']
    });
}
