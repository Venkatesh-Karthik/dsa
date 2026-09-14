/**
 * Networking Domain Knowledge Module
 *
 * Covers HTTP, TCP 3-Way Handshake, DNS resolution, Packets, Routing,
 * Sockets, and Client-Server architectures.
 */

import type { DomainKnowledgeModule, ExtractedInspectorData } from "./types";
import type {
  ConceptInvariant,
  ConceptMisconception,
  ConceptState,
  ConceptTransformation,
  ConceptModel,
  TeachingStrategy,
} from "../concept-model";

export const NetworkingDomainModule: DomainKnowledgeModule = {
  id: "networking",
  domain: "networking",
  name: "Computer Networking & Protocols",
  description: "HTTP, TCP/IP, DNS, Sockets, Packets, Client-Server Architectures, and REST APIs",

  matches(concept: string, prompt: string = ""): boolean {
    const text = `${concept} ${prompt}`.toLowerCase();
    return (
      text.includes("http") ||
      text.includes("tcp") ||
      text.includes("handshake") ||
      text.includes("dns") ||
      text.includes("packet") ||
      text.includes("client") ||
      text.includes("server") ||
      text.includes("socket") ||
      text.includes("router") ||
      text.includes("api request") ||
      text.includes("websocket")
    );
  },

  suggestStrategy(concept: string, prompt: string = ""): TeachingStrategy {
    const text = `${concept} ${prompt}`.toLowerCase();
    if (text.includes("handshake") || text.includes("lifecycle") || text.includes("tcp") || text.includes("state")) {
      return "STATE_MACHINE";
    }
    if (text.includes("pipeline") || text.includes("osm") || text.includes("layer")) {
      return "PIPELINE";
    }
    return "CAUSAL_PROGRESSION";
  },

  getInvariants(concept: string): ConceptInvariant[] {
    const text = concept.toLowerCase();
    const invariants: ConceptInvariant[] = [
      {
        id: "inv-net-conservation",
        description: "Message transmission coherence",
        rule: "Every transmitted packet/request must either reach receiver, remain in-flight, or trigger timeout/error.",
      },
    ];

    if (text.includes("tcp")) {
      invariants.push({
        id: "inv-tcp-seq-ack",
        description: "Sequence and Acknowledgement progression",
        rule: "ACK number equals received SEQ + 1 during connection establishment.",
      });
    }
    if (text.includes("http")) {
      invariants.push({
        id: "inv-http-pair",
        description: "HTTP request-response correlation",
        rule: "Client and server communicate via correlated HTTP request-response pairs. Every response is paired to an initiating request.",
      });
    }

    return invariants;
  },

  getMisconceptions(concept: string): ConceptMisconception[] {
    const text = concept.toLowerCase();
    const list: ConceptMisconception[] = [];

    if (text.includes("http") || text.includes("api")) {
      list.push({
        id: "misc-http-db",
        misunderstanding: "An HTTP API is the same entity as the database.",
        misconception: "An HTTP API is the same entity as the database.",
        correction: "The API is an interface/transport contract; the server processes the request and accesses storage independently.",
      });
      list.push({
        id: "misc-http-state",
        misunderstanding: "HTTP retains client connection memory by default between distinct requests.",
        misconception: "HTTP/1.1 is inherently stateless at the protocol layer; session state is managed via tokens/cookies.",
        correction: "HTTP/1.1 is inherently stateless at the protocol layer; session state is managed via tokens/cookies.",
      });
    }
    if (text.includes("tcp") || text.includes("handshake") || text.includes("connection")) {
      list.push({
        id: "misc-tcp-synack",
        misunderstanding: "A TCP connection is active immediately when the client sends the initial SYN packet.",
        misconception: "A TCP handshake creates an active connection immediately when the client sends the initial SYN packet.",
        correction: "TCP requires 3 steps: SYN from client, SYN-ACK from server, and final ACK from client before data flows.",
      });
    }

    if (list.length === 0) {
      list.push({
        id: "misc-network-latency",
        misunderstanding: "Bandwidth increases automatically eliminate network request latency.",
        misconception: "Bandwidth increases automatically eliminate network request latency.",
        correction: "Round-trip propagation delay (RTT) is bounded by the speed of light and physical distance, independent of throughput.",
      });
    }

    return list;
  },

  extractInspectorData(
    state: any,
    transformation?: any,
    model?: ConceptModel,
  ): ExtractedInspectorData {
    const metrics: Array<{ label: string; value: string | number; badgeColor?: string }> = [];
    const properties: Array<{ label: string; value: string | number }> = [];

    if (transformation?.inspectorData?.metrics && transformation.inspectorData.metrics.length > 0) {
      metrics.push(...transformation.inspectorData.metrics);
    }
    if (transformation?.inspectorData?.properties && transformation.inspectorData.properties.length > 0) {
      properties.push(...transformation.inspectorData.properties);
    }

    const graphEntities = state?.graph?.entities ? Array.from(state.graph.entities.values()) : [];
    const graphRelationships = state?.graph?.relationships ? Array.from(state.graph.relationships.values()) : [];
    const modelEntities = model?.entities || [];

    let activeEntities: any[] = [];
    if (state?.activeEntityIds && Array.isArray(state.activeEntityIds)) {
      activeEntities = modelEntities.filter((e) => state.activeEntityIds.includes(e.id));
    } else if (graphEntities.length > 0) {
      activeEntities = graphEntities;
    } else if (modelEntities.length > 0) {
      activeEntities = modelEntities;
    }

    if (metrics.length === 0) {
      const client = activeEntities.find(
        (e: any) =>
          e.type === "Client" ||
          e.semanticRole === "client" ||
          (e.label && e.label.toLowerCase().includes("client")),
      );
      const server = activeEntities.find(
        (e: any) =>
          e.type === "Server" ||
          e.semanticRole === "server" ||
          (e.label && e.label.toLowerCase().includes("server")),
      );

      const allLabels = [
        ...activeEntities.map((e: any) => e.label || ""),
        ...graphRelationships.map((r: any) => r.label || ""),
        transformation?.action || "",
        transformation?.title || "",
      ].join(" ");

      const methodMatch = allLabels.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/i);
      const statusMatch = allLabels.match(/\b(200(\s*OK)?|201|400|401|404|500)\b/i);

      if (client) metrics.push({ label: "Client", value: client.label || "Browser" });
      if (server) metrics.push({ label: "Server", value: server.label || "Backend Server" });
      if (methodMatch) {
        metrics.push({ label: "Method", value: methodMatch[1].toUpperCase(), badgeColor: "#2563eb" });
      }
      if (statusMatch) {
        metrics.push({ label: "Status", value: statusMatch[1].toUpperCase(), badgeColor: "#16a34a" });
      }
      metrics.push({
        label: "In-Flight Connections",
        value: graphRelationships.length || state?.activeRelationshipIds?.length || 1,
      });
    }

    const stateIdx = state?.stateIndex ?? state?.version ?? 0;
    const sections = [
      {
        title: "Metrics",
        properties: metrics.map((m) => ({ label: m.label, value: m.value })),
      },
      ...(properties.length > 0
        ? [
            {
              title: "Properties",
              properties,
            },
          ]
        : []),
    ];

    return {
      title: "Network Protocol State",
      subtitle: "Client-Server message exchange and protocol headers",
      metrics,
      properties,
      sections,
      statusBadge: transformation?.inspectorData?.statusBadge || `Step ${stateIdx + 1}`,
      operation: transformation?.action || transformation?.title,
      resultSummary: transformation?.reason || transformation?.learnerObservation,
    };
  },
};
