import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";
import { CognoraMark } from "./CognoraLogo";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen?: () => any;
  isCollabEnabled?: boolean;
}> = React.memo(() => {
  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        Export, preferences, languages, ...
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "4px",
            }}
          >
            <CognoraMark size={44} />
          </div>
        </WelcomeScreen.Center.Logo>
        <WelcomeScreen.Center.Heading>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text-primary-color, #111827)",
              }}
            >
              COGNORA
            </span>
            <span
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--color-primary, #4f46e5)",
                letterSpacing: "-0.01em",
              }}
            >
              Learn by seeing.
            </span>
            <span
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary, #6b7280)",
                marginTop: "2px",
                fontWeight: 400,
              }}
            >
              Ask a question. Understand it visually.
            </span>
          </div>
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
