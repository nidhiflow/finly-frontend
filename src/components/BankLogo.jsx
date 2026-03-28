/**
 * Premium branded bank logo tile.
 * Renders an inline SVG with the bank's abbreviation, brand color,
 * subtle gradient and shadow — crisp at any size, zero external deps.
 *
 * For emoji/generic entries it renders the emoji directly.
 */
export function BankLogo({ bank, size = 44, className = "" }) {
    if (!bank) return null;

    /* Deterministic gradient ID to avoid SVG collisions */
    const gradientId = `bg-${bank.id}-${size}`;

    /* ── Emoji / generic ── */
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
                title={bank.name}
            >
                {bank.abbr}
            </div>
        );
    }

    /* ── SVG branded tile ── */
    const bg = bank.color || "#6366f1";
    const fg = bank.textColor || "#fff";
    const abbr = bank.abbr || bank.name?.charAt(0) || "?";
    const fontSize = abbr.length <= 2 ? size * 0.38 : abbr.length <= 3 ? size * 0.3 : size * 0.24;
    const r = size * 0.28; /* border-radius ratio */

    return (
        <div
            className={`bank-logo-tile bank-logo-tile--enter ${className}`}
            style={{ width: size, height: size }}
            title={bank.name}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={bg} />
                        <stop offset="100%" stopColor={lightenColor(bg, -18)} />
                    </linearGradient>
                </defs>
                {/* Background rounded rect */}
                <rect
                    width={size}
                    height={size}
                    rx={r}
                    ry={r}
                    fill={`url(#${gradientId})`}
                />
                {/* Subtle shine overlay */}
                <rect
                    width={size}
                    height={size * 0.5}
                    rx={r}
                    ry={r}
                    fill="rgba(255,255,255,0.12)"
                />
                {/* Abbreviation text */}
                <text
                    x="50%"
                    y="54%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fill={fg}
                    fontSize={fontSize}
                    fontWeight="800"
                    fontFamily="'Inter', 'SF Pro Display', -apple-system, sans-serif"
                    letterSpacing={abbr.length > 3 ? "-0.5" : "0.5"}
                >
                    {abbr}
                </text>
            </svg>
        </div>
    );
}

/**
 * Darken / lighten a hex color by `amount` (negative = darker).
 * Used for the gradient bottom stop.
 */
function lightenColor(hex, amount) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const num = parseInt(c, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
