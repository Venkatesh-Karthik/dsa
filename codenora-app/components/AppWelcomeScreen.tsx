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
              marginBottom: "8px",
            }}
          >
            <CognoraMark size={52} color="#0f172a" />
          </div>
        </WelcomeScreen.Center.Logo>
        <WelcomeScreen.Center.Heading>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              textAlign: "center",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "#0f172a",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
            >
              Cognora
            </span>
            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 500,
                color: "#64748b",
                letterSpacing: "-0.01em",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              }}
            >
              Learn by seeing.
            </span>
            <span
              style={{
                fontSize: "0.9rem",
                color: "#94a3b8",
                marginTop: "4px",
                fontWeight: 400,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
