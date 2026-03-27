import { useMemo, useRef, useState } from "react";
import { getBankLogoSources } from "../data/bankLogos";

/**
 * Full-colour first: Clearbit → /bank-logos/color/{id}.png → SVG → Simple Icons → initials/emoji.
 * Parent should pass key={bank.id} (or account icon id) so failIndex resets when the bank changes.
 */
export function BankLogo({ bank, size = 44, className = "" }) {
    const [failIndex, setFailIndex] = useState(0);
    const prevBankId = useRef(bank?.id);
    const sources = useMemo(() => (bank ? getBankLogoSources(bank) : []), [bank]);

    /* Reset fail index when the bank changes (avoids useEffect + setState lint error) */
    if (bank?.id !== prevBankId.current) {
        prevBankId.current = bank?.id;
        if (failIndex !== 0) setFailIndex(0);
    }

    if (!bank) return null;

    const imgSrc = sources[failIndex] || null;

    if (imgSrc) {
        return (
            <div
                className={`bank-logo-tile bank-logo-tile--enter ${className}`}
                style={{ width: size, height: size }}
                title={bank.name}
            >
                <img
                    src={imgSrc}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setFailIndex((i) => i + 1)}
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
