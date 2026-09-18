import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

// 1. TOPIC ICONS (Clean, intelligent, geometric product assets)

/** Binary Search: Range partition and midpoint focus */
export const IconBinarySearch: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M3 12H21M12 7V17M7 9V15M17 9V15"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="3" fill={color} />
  </svg>
);

/** Arrays: Contiguous memory cells with indices */
export const IconArray: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="3"
      y="7"
      width="18"
      height="10"
      rx="2"
      stroke={color}
      strokeWidth="2"
    />
    <line x1="9" y1="7" x2="9" y2="17" stroke={color} strokeWidth="2" />
    <line x1="15" y1="7" x2="15" y2="17" stroke={color} strokeWidth="2" />
  </svg>
);

/** Linked List: Distinct nodes connected with directional arrows */
export const IconLinkedList: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="2"
      y="8"
      width="6"
      height="8"
      rx="1.5"
      stroke={color}
      strokeWidth="2"
    />
    <path
      d="M8 12H13M13 12L11 10M13 12L11 14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="16"
      y="8"
      width="6"
      height="8"
      rx="1.5"
      stroke={color}
      strokeWidth="2"
    />
  </svg>
);

/** Stack: LIFO layered blocks stacked vertically */
export const IconStack: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="4"
      y="5"
      width="16"
      height="3"
      rx="1"
      stroke={color}
      strokeWidth="1.75"
    />
    <rect
      x="4"
      y="10.5"
      width="16"
      height="3"
      rx="1"
      stroke={color}
      strokeWidth="1.75"
    />
    <rect
      x="4"
      y="16"
      width="16"
      height="3"
      rx="1"
      stroke={color}
      strokeWidth="1.75"
    />
  </svg>
);

/** Binary Tree: Root branching into left and right subtrees */
export const IconBinaryTree: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="5" r="2.5" stroke={color} strokeWidth="2" />
    <circle cx="6" cy="18" r="2.5" stroke={color} strokeWidth="2" />
    <circle cx="18" cy="18" r="2.5" stroke={color} strokeWidth="2" />
    <path
      d="M10.5 7.5L7.5 15.5M13.5 7.5L16.5 15.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

/** Graph: Non-linear interconnected network of vertices and edges */
export const IconGraph: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="6" cy="7" r="2.5" stroke={color} strokeWidth="2" />
    <circle cx="18" cy="7" r="2.5" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="17" r="2.5" stroke={color} strokeWidth="2" />
    <path
      d="M8.5 7H15.5M7.5 9.5L10.5 14.5M16.5 9.5L13.5 14.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

/** Matrix: Structured 2D Cartesian grid */
export const IconMatrix: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="2"
      stroke={color}
      strokeWidth="2"
    />
    <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.5" />
    <line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
  </svg>
);

/** Recursion: Self-referential iterative loop cycle */
export const IconRecursion: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M4 12C4 7.58172 7.58172 4 12 4C15.8 4 19 6.7 19.8 10.3M20 12C20 16.4183 16.4183 20 12 20C8.2 20 5 17.3 4.2 13.7"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M16 11H20.5V6.5M8 13H3.5V17.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 2. PLAYBACK & INTERACTIVE CONTROLS

export const IconPlay: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M7 4V20L19 12L7 4Z" />
  </svg>
);

export const IconPause: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const IconPrev: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M15 18L9 12L15 6"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconNext: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M9 18L15 12L9 6"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconReplay: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C8.28 21 5.09 18.75 3.73 15.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M3 7V12H8"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconCode: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 18L22 12L16 6M8 6L2 12L8 18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconSend: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconEye: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
  </svg>
);

export const IconAlert: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 9V14M12 17.5V18M10.29 3.86L1.82 18A2 2 0 0 0 3.55 21H20.45A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconEdit: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M17 3A2.828 2.828 0 1 1 21 7L7.5 20.5L2 22L3.5 16.5L17 3Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconSpeed: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 4C7.03 4 3 8.03 3 13C3 15.35 3.91 17.49 5.41 19.09C5.79 19.5 6.35 19.68 6.87 19.53C9.09 18.89 10.82 17.5 12 16M12 4C16.97 4 21 8.03 21 13C21 15.35 20.09 17.49 18.59 19.09C18.21 19.5 17.65 19.68 17.13 19.53C14.91 18.89 13.18 17.5 12 16M12 4V8M12 16L15 11"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// 3. UI CONTROLS & UTILITIES

export const IconSparkles: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"
      fill={color}
    />
  </svg>
);

export const IconInspect: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <path
      d="M21 21L16 16M11 8V14M8 11H14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const IconAutoAlign: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM4 14H10V20H4V14ZM14 14H20V20H14V14Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <path
      d="M21 21L16 16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const IconKeyboard: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="2"
      y="5"
      width="20"
      height="14"
      rx="3"
      stroke={color}
      strokeWidth="1.8"
    />
    <path
      d="M6 10H6.01M10 10H10.01M14 10H14.01M18 10H18.01M7 15H17"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const IconGrid: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke={color}
      strokeWidth="1.8"
    />
    <line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="1.5" />
    <line x1="3" y1="15" x2="21" y2="15" stroke={color} strokeWidth="1.5" />
    <line x1="9" y1="3" x2="9" y2="21" stroke={color} strokeWidth="1.5" />
    <line x1="15" y1="3" x2="15" y2="21" stroke={color} strokeWidth="1.5" />
  </svg>
);

export const IconTheme: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.8" />
    <path
      d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M3 6H21M19 6V20C19 21.1 18.1 22 17 22H7C5.9 22 5 21.1 5 20V6M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconFolder: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M22 19C22 20.1 21.1 21 20 21H4C2.9 21 2 20.1 2 19V5C2 3.9 2.9 3 4 3H9.17C9.7 3 10.21 3.21 10.59 3.59L12.41 5.41C12.79 5.79 13.3 6 13.83 6H20C21.1 6 22 6.9 22 8V19Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconSave: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16L21 8V19C21 20.1 20.1 21 19 21Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M17 21V13H7V21M7 3V8H15" stroke={color} strokeWidth="1.8" />
  </svg>
);

export const IconDownload: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15M7 10L12 15M12 15L17 10M12 15V3"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M9 18L15 12L9 6"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconChevronDown: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M6 9L12 15L18 9"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconChevronUp: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M18 15L12 9L6 15"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconMinus: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path d="M5 12H19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({
  size = 14,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 5V19M5 12H19"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconSelect: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path d="M4.5 2.5L18.5 13.5L11.5 15.5L8 21.5L5 20L8.5 14L4.5 11.5V2.5Z" />
  </svg>
);

export const IconHand: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M7 11.5V14M7 11.5V5.5A1.5 1.5 0 0 1 10 5.5M7 11.5A1.5 1.5 0 0 0 4 11.5V13.5A7.5 7.5 0 0 0 19 13.5V8.5A1.5 1.5 0 0 0 16 8.5M10 5.5V10M10 5.5A1.5 1.5 0 0 1 13 5.5V10M13 5.5A1.5 1.5 0 0 1 16 5.5V8.5"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconRectangle: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2.5"
      stroke={color}
      strokeWidth="1.8"
    />
  </svg>
);

export const IconDiamond: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M12 2L22 12L12 22L2 12L12 2Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconEllipse: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
  </svg>
);

export const IconArrow: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M5 19L19 5M19 5H9M19 5V15"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconLine: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M4 20L20 4"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const IconDraw: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M17 3A2.828 2.828 0 1 1 21 7L7.5 20.5L2 22L3.5 16.5L17 3Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconText: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M4 7V4H20V7M12 4V20M9 20H15"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconImage: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke={color}
      strokeWidth="1.8"
    />
    <circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <path
      d="M21 15L16 10L5 21"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconEraser: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M20 20H7L2.5 15.5C1.8 14.8 1.8 13.7 2.5 13L12.5 3C13.2 2.3 14.3 2.3 15 3L21.5 9.5C22.2 10.2 22.2 11.3 21.5 12L14.5 19M18 11L11 4"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconFrame: React.FC<IconProps> = ({
  size = 16,
  className,
  color = "currentColor",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <path
      d="M6 3V21M18 3V21M3 6H21M3 18H21"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);
