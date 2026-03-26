import { useEffect, useMemo, useState } from "react";
import { getBankLogoSources } from "../data/bankLogos";

export function BankLogo({ bank, size = 44, className = "" }) {
    const [failIndex, setFailIndex] = useState(0);
    const sources = useMemo(() => (bank ? getBankLogoSources(bank) : []), [bank]);
    useEffect(() => {
        setFailIndex(0);
    }, [bank]);
    if (!bank) return null;
    const imgSrc = sources[failIndex] || null;
    if (imgSrc) {
        return (
            <div
                className={`bank-logo-tile bank-logo-tile--enter ${className}`}
                style={{ width: size, height: size }}
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
