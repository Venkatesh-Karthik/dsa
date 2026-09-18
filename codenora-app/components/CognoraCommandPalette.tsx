/**
 * Cognora Universal Command Palette
 *
 * Liquid Glass visual command interface with category filtering,
 * active canvas contextual suggestions, detail preview, and keyboard control.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";

import {
  BUILTIN_COMMANDS,
  getContextualSuggestions,
  getAutocompleteSuggestions,
} from "../ai/commands/command-registry";

import "./CognoraCommandPalette.scss";

import type {
  AutocompleteSuggestion,
  CommandCategory,
  CommandContext,
} from "../ai/commands/command-types";

export interface CognoraCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  inputValue?: string;
  onSelectCommand: (
    cmdName: string,
    syntaxOrExample?: string,
    executeImmediately?: boolean,
  ) => void;
  context?: CommandContext;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
}

const CATEGORY_TABS: { label: string; value: CommandCategory | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Create", value: "CREATE" },
  { label: "Transform", value: "TRANSFORM" },
  { label: "Run", value: "RUN" },
  { label: "Learn", value: "LEARN" },
  { label: "View", value: "VIEW" },
  { label: "Playback", value: "PLAYBACK" },
  { label: "Session", value: "SESSION" },
];

export const CognoraCommandPalette: React.FC<CognoraCommandPaletteProps> = ({
  isOpen,
  onClose,
  inputValue = "",
  onSelectCommand,
  context,
  selectedIndex = 0,
  onSelectedIndexChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    CommandCategory | "ALL"
  >("ALL");
  const [localSelectedIndex, setLocalSelectedIndex] = useState(selectedIndex);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external selectedIndex
  useEffect(() => {
    setLocalSelectedIndex(selectedIndex);
  }, [selectedIndex]);

  // Contextual suggestions based on active canvas structure
  const contextualSuggestions = useMemo(() => {
    if (!context) {
      return [];
    }
    return getContextualSuggestions(context);
  }, [context]);

  // Autocomplete suggestions based on partial input and category filter
  const filteredSuggestions = useMemo(() => {
    let list: AutocompleteSuggestion[] = [];

    if (inputValue.startsWith("/")) {
      list = getAutocompleteSuggestions(inputValue, context);
    } else {
      // Show full registry
      list = BUILTIN_COMMANDS.filter((cmd) => {
        if (cmd.isDeveloperOnly && !context?.isDeveloperMode) {
          return false;
        }
        return true;
      }).map((cmd) => ({
        name: cmd.name,
        aliases: cmd.aliases,
        syntax: cmd.syntax,
        description: cmd.description,
        example: cmd.example || cmd.examples[0],
        category: cmd.category,
        executionClass: cmd.executionClass,
      }));
    }

    if (selectedCategory !== "ALL") {
      list = list.filter((s) => s.category === selectedCategory);
    }

    return list;
  }, [inputValue, context, selectedCategory]);

  const activeIndex = Math.min(
    Math.max(0, localSelectedIndex),
    Math.max(0, filteredSuggestions.length - 1),
  );

  const activeSuggestion = filteredSuggestions[activeIndex] || null;

  const handleSelect = (
    sug: AutocompleteSuggestion,
    executeImmediately = false,
  ) => {
    onSelectCommand(sug.name, sug.example || sug.syntax, executeImmediately);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (activeIndex + 1) % filteredSuggestions.length;
      setLocalSelectedIndex(next);
      onSelectedIndexChange?.(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        (activeIndex - 1 + filteredSuggestions.length) %
        filteredSuggestions.length;
      setLocalSelectedIndex(prev);
      onSelectedIndexChange?.(prev);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion) {
        handleSelect(activeSuggestion, true);
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (activeSuggestion) {
        handleSelect(activeSuggestion, false);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="cognora-command-palette"
      role="dialog"
      aria-label="Cognora Universal Command Palette"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Palette Header */}
      <div className="cognora-command-palette__header">
        <div className="cognora-command-palette__title-row">
          <span className="cognora-command-palette__title">
            Universal Commands
          </span>
          <span className="cognora-command-palette__count">
            {filteredSuggestions.length}
          </span>
        </div>
        <div className="cognora-command-palette__shortcut-hint">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Tab</kbd> insert
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="cognora-command-palette__tabs">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`cognora-command-palette__tab ${
              selectedCategory === tab.value ? "is-active" : ""
            }`}
            onClick={() => {
              setSelectedCategory(tab.value);
              setLocalSelectedIndex(0);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Split Body: Suggestions List + Active Detail Preview */}
      <div className="cognora-command-palette__body">
        <div
          className="cognora-command-palette__list"
          ref={listRef}
          role="listbox"
        >
          {filteredSuggestions.length === 0 ? (
            <div className="cognora-command-palette__empty">
              No commands matching &quot;{inputValue}&quot; in{" "}
              {selectedCategory}
            </div>
          ) : (
            filteredSuggestions.map((sug, idx) => {
              const isSelected = idx === activeIndex;
              const isContextual = contextualSuggestions.some(
                (c) => c.name === sug.name,
              );
              const catClass = sug.category.toLowerCase();
              const execClass = (sug.executionClass || "local").toLowerCase();

              return (
                <button
                  key={sug.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`cognora-command-palette__item ${
                    isSelected ? "is-selected" : ""
                  } ${isContextual ? "is-contextual" : ""}`}
                  onClick={() => handleSelect(sug, false)}
                  onMouseEnter={() => {
                    setLocalSelectedIndex(idx);
                    onSelectedIndexChange?.(idx);
                  }}
                >
                  <div className="cognora-command-palette__item-left">
                    <div className="cognora-command-palette__item-name-row">
                      <span className="cognora-command-palette__item-name">
                        /{sug.name}
                      </span>
                      {sug.aliases && sug.aliases.length > 0 && (
                        <span className="cognora-command-palette__item-alias">
                          ({sug.aliases.map((a) => `/${a}`).join(", ")})
                        </span>
                      )}
                    </div>
                    <div className="cognora-command-palette__item-desc">
                      {sug.description}
                    </div>
                  </div>

                  <div className="cognora-command-palette__item-badges">
                    <span
                      className={`cognora-command-palette__category-badge cognora-command-palette__category-badge--${catClass}`}
                    >
                      {sug.category}
                    </span>
                    <span
                      className={`cognora-command-palette__class-badge cognora-command-palette__class-badge--${execClass}`}
                    >
                      {sug.executionClass || "LOCAL"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Live Detail Preview */}
        {activeSuggestion && (
          <div className="cognora-command-palette__detail">
            <div className="cognora-command-palette__detail-title">
              <span>/{activeSuggestion.name}</span>
              <span
                className={`cognora-command-palette__class-badge cognora-command-palette__class-badge--${(
                  activeSuggestion.executionClass || "local"
                ).toLowerCase()}`}
              >
                {activeSuggestion.executionClass || "LOCAL"}
              </span>
            </div>

            <div className="cognora-command-palette__detail-desc">
              {activeSuggestion.description}
            </div>

            <div className="cognora-command-palette__detail-block">
              <span className="cognora-command-palette__detail-label">
                Syntax
              </span>
              <div className="cognora-command-palette__detail-syntax">
                {activeSuggestion.syntax}
              </div>
            </div>

            {activeSuggestion.example && (
              <div className="cognora-command-palette__detail-block">
                <span className="cognora-command-palette__detail-label">
                  Click to run example
                </span>
                <button
                  type="button"
                  className="cognora-command-palette__detail-example-btn"
                  onClick={() => handleSelect(activeSuggestion, true)}
                  title="Run this example command directly"
                >
                  {activeSuggestion.example}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
