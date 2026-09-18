/**
 * Domain Knowledge Registry & Resolver
 *
 * Directs incoming concepts to their corresponding domain module,
 * with graceful fallback to GenericDomainModule.
 */

import { DsaDomainModule } from "./dsa";
import { NetworkingDomainModule } from "./networking";
import { OperatingSystemsDomainModule } from "./operating-systems";
import { DatabasesDomainModule } from "./databases";
import { PhysicsDomainModule } from "./physics";
import { MachineLearningDomainModule } from "./machine-learning";
import { GenericDomainModule } from "./generic";

import type { DomainKnowledgeModule } from "./types";

export * from "./types";
export * from "./dsa";
export * from "./networking";
export * from "./operating-systems";
export * from "./databases";
export * from "./physics";
export * from "./machine-learning";
export * from "./generic";

const REGISTERED_MODULES: DomainKnowledgeModule[] = [
  OperatingSystemsDomainModule,
  DatabasesDomainModule,
  NetworkingDomainModule,
  MachineLearningDomainModule,
  PhysicsDomainModule,
  DsaDomainModule,
];

/**
 * Resolves the appropriate domain knowledge module for a concept or prompt.
 * Always falls back to GenericDomainModule if no specific domain matches.
 */
export function resolveDomainModule(
  concept: string,
  prompt: string = "",
): DomainKnowledgeModule {
  for (const mod of REGISTERED_MODULES) {
    if (mod.matches(concept, prompt)) {
      return mod;
    }
  }
  return GenericDomainModule;
}
