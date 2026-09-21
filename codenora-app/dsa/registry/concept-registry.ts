/**
 * Cognora DSA Acceleration Layer - Central Concept Registry
 *
 * Manages registered DSA concepts, metadata, limits, and associated engine factories.
 */

import {
  type DSAConceptId,
  type DSAConceptRegistration,
  type DSAInputLimits,
} from "../types/dsa-concept";
import type { DSAConceptEngine } from "../types/dsa-engine";
import { DSA_CATALOG } from "./registry-catalog";

export type EngineFactory = () => DSAConceptEngine<any, any>;

export class DSAConceptRegistry {
  private static instance: DSAConceptRegistry | null = null;

  private registrations = new Map<DSAConceptId, DSAConceptRegistration>();
  private engineFactories = new Map<DSAConceptId, EngineFactory>();

  private constructor() {
    this.bootstrapCatalog();
  }

  public static getInstance(): DSAConceptRegistry {
    if (!DSAConceptRegistry.instance) {
      DSAConceptRegistry.instance = new DSAConceptRegistry();
    }
    return DSAConceptRegistry.instance;
  }

  private bootstrapCatalog(): void {
    for (const item of DSA_CATALOG) {
      this.registrations.set(item.id, { ...item });
    }
  }

  /**
   * Registers or updates a concept registration.
   */
  public register(
    concept: DSAConceptRegistration,
    factory?: EngineFactory,
  ): void {
    this.registrations.set(concept.id, concept);
    if (factory) {
      this.engineFactories.set(concept.id, factory);
      concept.supported = true;
    }
  }

  /**
   * Registers an engine factory for a specific concept.
   */
  public registerEngine(conceptId: DSAConceptId, factory: EngineFactory): void {
    const reg = this.registrations.get(conceptId);
    if (reg) {
      reg.supported = true;
      this.engineFactories.set(conceptId, factory);
    }
  }

  /**
   * Retrieves registration for a concept ID.
   */
  public get(id: DSAConceptId): DSAConceptRegistration | undefined {
    return this.registrations.get(id);
  }

  /**
   * Checks whether a concept ID is known to the registry.
   */
  public has(id: DSAConceptId): boolean {
    return this.registrations.has(id);
  }

  /**
   * Checks if a concept is supported by a deterministic engine.
   */
  public isSupported(id: DSAConceptId): boolean {
    const reg = this.registrations.get(id);
    return Boolean(reg?.supported && this.engineFactories.has(id));
  }

  /**
   * Creates a fresh engine instance for a supported concept.
   */
  public createEngine(id: DSAConceptId): DSAConceptEngine<any, any> | null {
    const factory = this.engineFactories.get(id);
    if (!factory) {
      return null;
    }
    return factory();
  }

  /**
   * Retrieves all registered concepts.
   */
  public getAll(): DSAConceptRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Retrieves all concepts marked as supported.
   */
  public getSupported(): DSAConceptRegistration[] {
    return this.getAll().filter((c) => c.supported && this.engineFactories.has(c.id));
  }

  /**
   * Retrieves input limits for a concept, falling back to safe defaults.
   */
  public getLimits(id: DSAConceptId): DSAInputLimits {
    const reg = this.registrations.get(id);
    return (
      reg?.defaultLimits || {
        maxElements: 15,
        maxNodes: 15,
        maxEdges: 20,
        maxOperations: 100,
      }
    );
  }
}
