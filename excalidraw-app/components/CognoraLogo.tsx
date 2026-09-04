import React from "react";

export const CognoraMark: React.FC<{ size?: number; className?: string }> = ({
  size = 28,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect width="32" height="32" rx="8" fill="#4F46E5" />
    <ellipse cx="16" cy="16" rx="9" ry="5.5" stroke="#FFFFFF" strokeWidth="2" />
    <circle cx="16" cy="16" r="3" fill="#FFFFFF" />
    <path
      d="M16 7.5L16.8 9.8C17 10.4 17.5 10.9 18.1 11.1L20.4 11.9L18.1 12.7C17.5 12.9 17 13.4 16.8 14L16 16.3L15.2 14C15 13.4 14.5 12.9 13.9 12.7L11.6 11.9L13.9 11.1C14.5 10.9 15 10.4 15.2 9.8L16 7.5Z"
      fill="#A5B4FC"
    />
  </svg>
);

export const CognoraLogo: React.FC<{
  size?: number;
  showTagline?: boolean;
  textColor?: string;
}> = ({ size = 32, showTagline = false, textColor = "currentColor" }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
    <CognoraMark size={size} />
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
      <span
        style={{
          fontSize: `${Math.round(size * 0.65)}px`,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: textColor,
          fontFamily: "var(--ui-font, sans-serif)",
        }}
      >
        Cognora
      </span>
      {showTagline && (
        <span
          style={{
            fontSize: `${Math.round(size * 0.32)}px`,
            fontWeight: 500,
            color: "var(--color-primary, #4f46e5)",
            letterSpacing: "-0.01em",
          }}
        >
          Learn by seeing
        </span>
      )}
    </div>
  </div>
);
