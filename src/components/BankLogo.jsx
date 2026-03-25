import { useState } from 'react';

/**
 * Bank mark: local SVG (logoSrc), CDN Simple Icons (simpleIconSlug), then initials/emoji.
 * Local SVGs under /bank-logos are from simple-icons (CC0); add your own files to override.
 * Parent should pass `key={bank.id}` (or account icon id) so image error state resets when the bank changes.
 */
export function BankLogo({ bank, size = 44, className = '' }) {
    const [imgFailed, setImgFailed] = useState(false);

    if (!bank) return null;

    const hex = (bank.color || '#6366f1').replace(/^#/, '');
    const cdnSrc = bank.simpleIconSlug
        ? `https://cdn.simpleicons.org/${bank.simpleIconSlug}/${hex}`
        : null;
    const imgSrc = bank.logoSrc || cdnSrc;

    if (imgSrc && !imgFailed) {
        return (
            <div
                className={`bank-logo-tile ${className}`}
                style={{ width: size, height: size }}
            >
                <img
                    src={imgSrc}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                />
            </div>
        );
    }

    if (bank.isEmoji) {
        return (
            <div
                className={`bank-logo bank-logo-fallback ${className}`}
                style={{
                    width: size,
                    height: size,
                    background: `${bank.color}22`,
                    fontSize: size * 0.45,
                }}
            >
                {bank.abbr}
            </div>
        );
    }

    return (
        <div
            className={`bank-logo bank-logo-fallback ${className}`}
            style={{
                width: size,
                height: size,
                background: bank.color,
                color: bank.textColor,
                fontSize: size * 0.26,
            }}
        >
            {bank.abbr}
        </div>
    );
}
