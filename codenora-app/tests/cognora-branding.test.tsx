import { describe, it, expect } from "vitest";
import React from "react";
import { screen, render as rtlRender } from "@testing-library/react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { render } from "@excalidraw/excalidraw/tests/test-utils";

import { AppMainMenu } from "../components/AppMainMenu";
import { AppSidebar } from "../components/AppSidebar";
import { AppWelcomeScreen } from "../components/AppWelcomeScreen";
import { CognoraLogo } from "../components/CognoraLogo";

describe("Cognora Branding & UI Cleanliness", () => {
  it("renders CognoraMark and CognoraLogo with correct text and attributes", () => {
    const { container } = rtlRender(<CognoraLogo showTagline={true} />);
    expect(screen.getByText("Cognora")).toBeTruthy();
    expect(screen.getByText(/Learn by seeing/i)).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders AppWelcomeScreen with Cognora brand identity and no Excalidraw+ promos", async () => {
    const { container } = await render(
      <Excalidraw>
        <AppWelcomeScreen />
      </Excalidraw>,
    );

    // Cognora headings
    expect(screen.getAllByText("Cognora").length).toBeGreaterThan(0);
    expect(screen.getByText(/Learn by seeing/i)).toBeTruthy();
    expect(
      screen.getByText("Ask a question. Understand it visually."),
    ).toBeTruthy();

    // Promotional Excalidraw+ links must NOT be present
    expect(screen.queryByText(/Excalidraw\+/i)).toBeNull();
    expect(screen.queryByText(/Sign up/i)).toBeNull();
    expect(
      container.querySelector('a[href*="plus.excalidraw.com"]'),
    ).toBeNull();
  });

  it("renders AppMainMenu with clean sections and no Excalidraw+ or social links", async () => {
    const { container } = await render(
      <Excalidraw>
        <AppMainMenu
          isCollaborating={false}
          isCollabEnabled={false}
          onCollabDialogOpen={() => {}}
          refresh={() => {}}
          theme="light"
        />
      </Excalidraw>,
    );

    // Excalidraw+ and promotional social links must NOT be present
    expect(screen.queryByText(/Excalidraw\+/i)).toBeNull();
    expect(screen.queryByText(/Follow us/i)).toBeNull();
    expect(screen.queryByText(/Discord chat/i)).toBeNull();
    expect(screen.queryByText(/Sign in/i)).toBeNull();
    expect(container.querySelector('a[href*="discord.gg"]')).toBeNull();
    expect(
      container.querySelector('a[href*="github.com/excalidraw"]'),
    ).toBeNull();
    expect(container.querySelector('a[href*="x.com/excalidraw"]')).toBeNull();
  });

  it("renders AppSidebar with Cognora learning guidance instead of promo links", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{
          appState: {
            openSidebar: {
              name: "default",
              tab: "comments",
            },
          },
        }}
      >
        <AppSidebar />
      </Excalidraw>,
    );

    expect(screen.getByText("Cognora Tutor")).toBeTruthy();
    expect(screen.getByText("Ask. See. Understand.")).toBeTruthy();
    expect(screen.queryByText(/Excalidraw\+/i)).toBeNull();
    expect(screen.queryByText(/Sign up/i)).toBeNull();
    expect(
      container.querySelector('a[href*="plus.excalidraw.com"]'),
    ).toBeNull();
  });
});
