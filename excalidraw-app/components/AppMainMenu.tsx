import { eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { saveDebugState } from "./DebugCanvas";
import { CognoraMark } from "./CognoraLogo";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  return (
    <MainMenu>
      {/* 1. FILE */}
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />

      <MainMenu.Separator />

      {/* 2. CANVAS */}
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.ClearCanvas />

      <MainMenu.Separator />

      {/* 3. SETTINGS */}
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />

      <MainMenu.Separator />

      {/* 4. HELP & ABOUT */}
      <MainMenu.DefaultItems.Help />
      <MainMenu.ItemCustom>
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--text-secondary, #6b7280)",
            fontSize: "12px",
            borderTop:
              "1px solid var(--default-border-color, rgba(0, 0, 0, 0.06))",
            marginTop: "4px",
          }}
        >
          <CognoraMark size={20} />
          <div>
            <div
              style={{
                fontWeight: 700,
                color: "var(--text-primary-color, #1f2937)",
                letterSpacing: "-0.01em",
              }}
            >
              Cognora
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-primary, #4f46e5)",
              }}
            >
              Learn by seeing
            </div>
          </div>
        </div>
      </MainMenu.ItemCustom>

      {isDevEnv() && (
        <>
          <MainMenu.Separator />
          <MainMenu.Item
            icon={eyeIcon}
            onSelect={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        </>
      )}
    </MainMenu>
  );
});
