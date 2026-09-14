import React from "react";

export const CognoraMark: React.FC<{
  size?: number;
  className?: string;
  color?: string;
}> = ({ size = 32, className, color = "#0f172a" }) => {
  const rawId = React.useId();
  const maskId = rawId.replace(/:/g, "_");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          {/* White retains the circle */}
          <rect width="32" height="32" fill="#ffffff" />
          {/* Black cuts out the right notch */}
          <rect x="25" y="0" width="8" height="32" fill="#000000" />
        </mask>
      </defs>
      {/* Outer ring with right notch opening */}
      <circle
        cx="16"
        cy="16"
        r="14.25"
        stroke={color}
        strokeWidth="2.75"
        mask={`url(#${maskId})`}
      />
      {/* Centered inner dot */}
      <circle cx="16" cy="16" r="6.75" fill={color} />
    </svg>
  );
};

export const CognoraLogo: React.FC<{
  size?: number;
  showTagline?: boolean;
  textColor?: string;
  taglineColor?: string;
  className?: string;
  align?: "left" | "center";
}> = ({
  size = 32,
  showTagline = true,
  textColor = "#0f172a",
  taglineColor = "#94a3b8",
  className,
  align = "left",
}) => {
  const isCentered = align === "center";
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${Math.max(8, Math.round(size * 0.35))}px`,
        flexDirection: isCentered ? "column" : "row",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <CognoraMark size={size} color={textColor} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isCentered ? "center" : "flex-start",
          justifyContent: "center",
          lineHeight: 1.15,
        }}
      >
        <span
          style={{
            fontSize: `${Math.round(size * 0.47)}px`,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: textColor,
          }}
        >
          Cognora
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: `${Math.max(10, Math.round(size * 0.32))}px`,
              fontWeight: 500,
              color: taglineColor,
              marginTop: "1.5px",
              letterSpacing: "-0.01em",
            }}
          >
            Learn by seeing.
          </span>
        )}
      </div>
    </div>
  );
};

