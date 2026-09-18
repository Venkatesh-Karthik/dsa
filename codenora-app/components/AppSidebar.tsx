import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import "./AppSidebar.scss";

const TutorSidebarPanel = () => {
  return (
    <div className="app-sidebar-panel">
      <div className="app-sidebar-panel__eyebrow">Cognora Tutor</div>
      <h3 className="app-sidebar-panel__title">Ask. See. Understand.</h3>
      <p className="app-sidebar-panel__text">
        Open the tutor to turn any question into a visual walkthrough on the
        canvas. Cognora keeps each step on the board so you can trace the full
        idea from start to finish.
      </p>
      <div className="app-sidebar-panel__list" aria-label="Tutor tips">
        <div className="app-sidebar-panel__item">
          Ask for a concept, process, or comparison.
        </div>
        <div className="app-sidebar-panel__item">
          Use follow-up questions like “why?”, “what changes?”, or “what happens
          next?”.
        </div>
        <div className="app-sidebar-panel__item">
          Select an AI-created object on the canvas to ask about that exact part
          of the lesson.
        </div>
      </div>
    </div>
  );
};

const CanvasSidebarPanel = () => {
  return (
    <div className="app-sidebar-panel app-sidebar-panel--guide">
      <div className="app-sidebar-panel__eyebrow">Learning Canvas</div>
      <h3 className="app-sidebar-panel__title">
        Move through the lesson visually
      </h3>
      <p className="app-sidebar-panel__text">
        The canvas stays primary. Pan, zoom, select, draw, and annotate
        naturally while Cognora adds lesson steps in a vertical flow below the
        current one.
      </p>
      <div className="app-sidebar-panel__list" aria-label="Canvas guidance">
        <div className="app-sidebar-panel__item">
          Use Next and Previous to move between step regions.
        </div>
        <div className="app-sidebar-panel__item">
          Use Play to auto-walk the generated lesson.
        </div>
        <div className="app-sidebar-panel__item">
          Use Replay to jump back to the first step without regenerating.
        </div>
      </div>
    </div>
  );
};

export const AppSidebar = () => {
  const { openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
          aria-label="Open tutor tips"
          title="Tutor tips"
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
          aria-label="Open lesson navigation guide"
          title="Lesson navigation guide"
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <TutorSidebarPanel />
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <CanvasSidebarPanel />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
