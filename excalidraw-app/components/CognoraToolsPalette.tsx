import React, { useRef, useEffect, useState, useMemo } from "react";

import {
  IconSparkles,
  IconInspect,
  IconEye,
  IconCode,
  IconEdit,
  IconAutoAlign,
  IconGraph,
  IconBinaryTree,
  IconSelect,
  IconHand,
  IconRectangle,
  IconDiamond,
  IconEllipse,
  IconArrow,
  IconLine,
  IconDraw,
  IconText,
  IconImage,
  IconEraser,
  IconFrame,
  IconGrid,
  IconTheme,
  IconTrash,
  IconFolder,
  IconSave,
  IconDownload,
  IconSearch,
  IconKeyboard,
  IconClose,
} from "./CognoraIcons";

import type { DrawingToolType } from "./CognoraDrawingToolbar";

export interface CognoraToolsPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCanvasTool: (
    tool: DrawingToolType | "diamond" | "line" | "eraser" | "frame",
  ) => void;
  onSelectCognoraAction: (action: string) => void;
  onToggleGrid?: () => void;
  isGridActive?: boolean;
  onToggleTheme?: () => void;
  theme?: "light" | "dark";
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onClearCanvas?: () => void;
  onShowShortcuts?: () => void;
  onFindReplace?: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: string;
  isDanger?: boolean;
  isActive?: boolean;
  onSelect: () => void;
}

export const CognoraToolsPalette: React.FC<CognoraToolsPaletteProps> = ({
  isOpen,
  onClose,
  onSelectCanvasTool,
  onSelectCognoraAction,
  onToggleGrid,
  isGridActive,
  onToggleTheme,
  theme = "light",
  onSave,
  onExport,
  onImport,
  onClearCanvas,
  onShowShortcuts,
  onFindReplace,
}) => {
  const paletteRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside and Escape handling
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const doc = paletteRef.current?.ownerDocument || document;
    doc.addEventListener("mousedown", handleClickOutside);
    doc.addEventListener("keydown", handleKeyDown);
    return () => {
      doc.removeEventListener("mousedown", handleClickOutside);
      doc.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Build items catalogue
  const allItems: PaletteItem[] = useMemo(() => {
    return [
      // 1. Cognora Intelligence
      {
        id: "visualize",
        label: "Visualize",
        desc: "Construct diagram from concept",
        icon: <IconSparkles size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("visualize"),
      },
      {
        id: "analyze",
        label: "Analyze",
        desc: "Inspect parameters & steps",
        icon: <IconInspect size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("analyze"),
      },
      {
        id: "explain",
        label: "Explain",
        desc: "Step-by-step logic breakdown",
        icon: <IconEye size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("explain"),
      },
      {
        id: "code",
        label: "Code",
        desc: "Interactive algorithm code",
        icon: <IconCode size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("code"),
      },
      {
        id: "practice",
        label: "Practice",
        desc: "Concept comprehension quiz",
        icon: <IconEdit size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("practice"),
      },
      {
        id: "auto_align",
        label: "Auto Align",
        desc: "Rebalance spacing & clean overlaps",
        icon: <IconAutoAlign size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("auto_align"),
      },
      {
        id: "what_changed",
        label: "What Changed",
        desc: "Diff visual states between steps",
        icon: <IconEye size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("what_changed"),
      },
      {
        id: "what_if",
        label: "What If",
        desc: "Modify parameters to observe changes",
        icon: <IconInspect size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("what_if"),
      },
      {
        id: "compare",
        label: "Compare",
        desc: "Contrast algorithms & paradigms",
        icon: <IconGraph size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("compare"),
      },
      {
        id: "summarize",
        label: "Summarize",
        desc: "Key takeaways & complexities",
        icon: <IconBinaryTree size={16} color="#3b82f6" />,
        category: "Cognora Intelligence",
        onSelect: () => onSelectCognoraAction("summarize"),
      },

      // 2. Canvas Tools
      {
        id: "selection",
        label: "Select",
        desc: "Move, select, and resize",
        icon: <IconSelect size={16} color="#475569" />,
        shortcut: "V",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("selection"),
      },
      {
        id: "hand",
        label: "Hand / Pan",
        desc: "Pan canvas view",
        icon: <IconHand size={16} color="#475569" />,
        shortcut: "H",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("hand"),
      },
      {
        id: "rectangle",
        label: "Rectangle",
        desc: "Draw box or container",
        icon: <IconRectangle size={16} color="#475569" />,
        shortcut: "R",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("rectangle"),
      },
      {
        id: "diamond",
        label: "Diamond",
        desc: "Draw decision node",
        icon: <IconDiamond size={16} color="#475569" />,
        shortcut: "D",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("diamond"),
      },
      {
        id: "ellipse",
        label: "Ellipse",
        desc: "Draw circle or graph vertex",
        icon: <IconEllipse size={16} color="#475569" />,
        shortcut: "O",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("ellipse"),
      },
      {
        id: "arrow",
        label: "Arrow",
        desc: "Directional connector",
        icon: <IconArrow size={16} color="#475569" />,
        shortcut: "A",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("arrow"),
      },
      {
        id: "line",
        label: "Line",
        desc: "Straight line connection",
        icon: <IconLine size={16} color="#475569" />,
        shortcut: "L",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("line"),
      },
      {
        id: "freedraw",
        label: "Draw / Pen",
        desc: "Freehand sketch",
        icon: <IconDraw size={16} color="#475569" />,
        shortcut: "P",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("freedraw"),
      },
      {
        id: "text",
        label: "Text",
        desc: "Add typography & notes",
        icon: <IconText size={16} color="#475569" />,
        shortcut: "T",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("text"),
      },
      {
        id: "image",
        label: "Insert Image",
        desc: "Upload reference graphic",
        icon: <IconImage size={16} color="#475569" />,
        shortcut: "9",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("image"),
      },
      {
        id: "eraser",
        label: "Eraser",
        desc: "Delete canvas elements",
        icon: <IconEraser size={16} color="#475569" />,
        shortcut: "E",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("eraser"),
      },
      {
        id: "frame",
        label: "Frame",
        desc: "Group elements into viewport",
        icon: <IconFrame size={16} color="#475569" />,
        shortcut: "F",
        category: "Canvas Tools",
        onSelect: () => onSelectCanvasTool("frame"),
      },

      // 3. Canvas Settings
      {
        id: "toggle_grid",
        label: "Toggle Grid",
        desc: isGridActive ? "Turn off dot grid" : "Turn on dot grid",
        icon: <IconGrid size={16} color="#475569" />,
        shortcut: "Ctrl+'",
        isActive: isGridActive,
        category: "Canvas Settings",
        onSelect: () => onToggleGrid?.(),
      },
      {
        id: "toggle_theme",
        label: `Theme: ${theme === "dark" ? "Dark" : "Light"}`,
        desc: "Switch workspace theme",
        icon: <IconTheme size={16} color="#475569" />,
        category: "Canvas Settings",
        onSelect: () => onToggleTheme?.(),
      },
      {
        id: "clear_canvas",
        label: "Clear Canvas",
        desc: "Reset all elements and visual lesson",
        icon: <IconTrash size={16} color="#ef4444" />,
        shortcut: "Reset",
        isDanger: true,
        category: "Canvas Settings",
        onSelect: () => onClearCanvas?.(),
      },

      // 4. Files & Export
      {
        id: "import",
        label: "Open / Import",
        desc: "Load drawing from disk",
        icon: <IconFolder size={16} color="#475569" />,
        shortcut: "Ctrl+O",
        category: "Files & Export",
        onSelect: () => onImport?.(),
      },
      {
        id: "save",
        label: "Save to Disk",
        desc: "Save drawing to local file",
        icon: <IconSave size={16} color="#475569" />,
        shortcut: "Ctrl+S",
        category: "Files & Export",
        onSelect: () => onSave?.(),
      },
      {
        id: "export",
        label: "Export Image",
        desc: "Export canvas as PNG / SVG",
        icon: <IconDownload size={16} color="#475569" />,
        shortcut: "Ctrl+Shift+E",
        category: "Files & Export",
        onSelect: () => onExport?.(),
      },

      // 5. Utilities
      {
        id: "find_replace",
        label: "Find & Replace",
        desc: "Search text within canvas elements",
        icon: <IconSearch size={16} color="#475569" />,
        shortcut: "Ctrl+F",
        category: "Utilities",
        onSelect: () => onFindReplace?.(),
      },
      {
        id: "shortcuts",
        label: "Keyboard Shortcuts",
        desc: "View complete shortcut cheatcheat",
        icon: <IconKeyboard size={16} color="#475569" />,
        shortcut: "?",
        category: "Utilities",
        onSelect: () => onShowShortcuts?.(),
      },
    ];
  }, [
    isGridActive,
    theme,
    onSelectCognoraAction,
    onSelectCanvasTool,
    onToggleGrid,
    onToggleTheme,
    onClearCanvas,
    onImport,
    onSave,
    onExport,
    onFindReplace,
    onShowShortcuts,
  ]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return allItems;
    }
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q)),
    );
  }, [allItems, searchQuery]);

  // Group filtered items by category
  const groupedCategories = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  const handleSelect = (item: PaletteItem) => {
    item.onSelect();
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0
          ? (prev - 1 + filteredItems.length) % filteredItems.length
          : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="cognora-tools-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Cognora Tools & Capabilities Palette"
    >
      <div ref={paletteRef} className="cognora-tools-palette">
        {/* Search Header */}
        <div className="cognora-tools-palette__search">
          <div className="cognora-tools-palette__search-icon">
            <IconSearch size={18} color="#64748b" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="cognora-tools-palette__input"
            placeholder="Type a tool or command..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            aria-label="Search tools"
          />
          {searchQuery ? (
            <button
              type="button"
              className="cognora-tools-palette__clear-btn"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              <IconClose size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="cognora-tools-palette__kbd-esc-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              title="Close Tools (Esc)"
              aria-label="Close Tools"
            >
              <kbd className="cognora-tools-palette__kbd-esc">Esc</kbd>
            </button>
          )}
        </div>

        {/* Palette Scrollable Body */}
        <div className="cognora-tools-palette__body custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="cognora-tools-palette__no-results">
              <IconSearch size={24} color="#94a3b8" />
              <span>
                No tools or commands found for &ldquo;{searchQuery}&rdquo;
              </span>
            </div>
          ) : (
            groupedCategories.map(([category, items]) => (
              <div key={category} className="cognora-tools-palette__section">
                <div className="cognora-tools-palette__category-title">
                  {category}
                </div>
                <div className="cognora-tools-palette__grid">
                  {items.map((item) => {
                    const globalIdx = filteredItems.indexOf(item);
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`cognora-tools-palette__card ${
                          isSelected ? "selected" : ""
                        } ${item.isDanger ? "danger" : ""} ${
                          item.isActive ? "active" : ""
                        }`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className="cognora-tools-palette__card-icon">
                          {item.icon}
                        </div>
                        <div className="cognora-tools-palette__card-content">
                          <div className="cognora-tools-palette__card-name">
                            <span>{item.label}</span>
                            {item.shortcut && (
                              <span className="cognora-tools-palette__card-key">
                                {item.shortcut}
                              </span>
                            )}
                          </div>
                          <span className="cognora-tools-palette__card-desc">
                            {item.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="cognora-tools-palette__footer">
          <div className="cognora-tools-palette__footer-hints">
            <span>
              <kbd className="cognora-tools-palette__kbd">↑</kbd>
              <kbd className="cognora-tools-palette__kbd">↓</kbd> navigate
            </span>
            <span>
              <kbd className="cognora-tools-palette__kbd">↵</kbd> select
            </span>
            <span>
              <kbd className="cognora-tools-palette__kbd">esc</kbd> close
            </span>
          </div>
          <span className="cognora-tools-palette__footer-count">
            {filteredItems.length} commands
          </span>
        </div>
      </div>
    </div>
  );
};
