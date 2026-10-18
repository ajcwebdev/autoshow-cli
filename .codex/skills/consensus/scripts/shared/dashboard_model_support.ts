import { getModelRegistry } from "../../../../../src/cli/commands/setup-and-utilities/models/model-loader/registry";
import { SUPPORTED_MODEL_SOURCES } from "../../../../../src/cli/commands/setup-and-utilities/models/supported-model-sources";
import { getStep2ProviderEntries } from "../../../../../src/cli/commands/command-shared/extract-routing/provider-registry";
import { STANDALONE_TTS_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from "../../../../../src/cli/flags/service-selector-normalization/provider-targets";
import { HOSTED_OCR_ADAPTERS } from "../../../../../src/cli/commands/text/ocr/hosted-ocr-adapters";
import { URL_ARTICLE_PROVIDER_ADAPTERS } from "../../../../../src/cli/commands/text/url/url-provider-registry";
import type { CombinedDashboardModel } from "./combined_report_html";

type SupportCategory = "llm" | "tts" | "stt" | "extract";

/** Only the live registry is accepted here; historical tariff accessors also return retired models. */
export type DashboardModelSupportRegistry = Readonly<Record<SupportCategory, Readonly<Record<string, {
  type: "local" | "api";
  models: Readonly<Record<string, unknown>>;
}>>>>;

interface SupportedRoute {
  service: string;
  model: string;
  local: boolean;
  bareKey?: boolean;
}

function isActiveModel(registry: DashboardModelSupportRegistry, step: SupportCategory, service: string, model: string): boolean {
  const models = registry[step][service]?.models;
  if (!models || !Object.hasOwn(models, model)) return false;
  const metadata = models[model];
  if (!metadata || typeof metadata !== "object") return false;
  const lifecycle = "lifecycle" in metadata ? metadata.lifecycle : undefined;
  if (lifecycle === undefined) return true;
  return lifecycle !== null && typeof lifecycle === "object" && "status" in lifecycle && lifecycle.status === "active";
}

function generationRoutes(step: "llm" | "tts", registry: DashboardModelSupportRegistry): SupportedRoute[] {
  const providers = step === "llm" ? WRITE_LLM_PROVIDER_TARGETS : STANDALONE_TTS_PROVIDER_TARGETS;
  return SUPPORTED_MODEL_SOURCES.flatMap(source => {
    if (source.step !== step || !Object.hasOwn(providers, source.service)) return [];
    return source.models.filter(model => isActiveModel(registry, step, source.service, model))
      .map(model => ({ service: source.service, model, local: registry[step][source.service]?.type === "local" }));
  });
}

function extractionRoutes(step: "stt" | "ocr" | "url", registry: DashboardModelSupportRegistry): SupportedRoute[] {
  const category = step === "stt" ? "stt" : "extract";
  const ocrServices = new Set(HOSTED_OCR_ADAPTERS.map(adapter => adapter.service));
  return getStep2ProviderEntries(step).flatMap(entry => {
    const service = entry.targetService;
    if (entry.selection.type === "boolean") {
      // Tesseract is a real local boolean selector, intentionally outside the hosted pricing registry.
      return [{ service, model: entry.selection.model, local: true }];
    }
    if (step === "ocr" && !ocrServices.has(service as typeof HOSTED_OCR_ADAPTERS[number]["service"])) return [];
    if (step === "url" && !Object.hasOwn(URL_ARTICLE_PROVIDER_ADAPTERS, service)) return [];
    const models = entry.selection.type === "models" ? entry.selection.supportedModels : [entry.selection.model];
    return models.filter(model => isActiveModel(registry, category, service, model)).map(model => ({
      service,
      model,
      local: registry[category][service]?.type === "local",
      ...(step === "url" ? { bareKey: true } : {}),
    }));
  });
}

/**
 * Snapshots benchmark row identities selectable by this checkout, without credentials or dispatch.
 * Model IDs can contain slashes, so keys are constructed from routes and never split or guessed.
 * The optional registry keeps lifecycle and missing-registration behavior independently testable.
 */
export function supportedDashboardProviderKeys(
  tabKey: string,
  model: CombinedDashboardModel,
  registry: DashboardModelSupportRegistry = getModelRegistry(),
): string[] {
  let routes: SupportedRoute[];
  switch (tabKey) {
    case "write": routes = generationRoutes("llm", registry); break;
    case "tts": routes = generationRoutes("tts", registry); break;
    case "ocr": routes = extractionRoutes("ocr", registry); break;
    case "url": routes = extractionRoutes("url", registry); break;
    case "stt-local": routes = extractionRoutes("stt", registry).filter(route => route.local); break;
    case "stt-with-speakers":
    case "stt-without-speakers": routes = extractionRoutes("stt", registry).filter(route => !route.local); break;
    default: return [];
  }
  const routeModels = new Map<string, Set<string>>();
  const localModels = new Map<string, Set<string>>();
  for (const route of routes) {
    const key = route.bareKey ? route.service : `${route.service}/${route.model}`;
    const models = routeModels.get(key) ?? new Set<string>();
    models.add(route.model);
    routeModels.set(key, models);
    if (route.local) {
      const models = localModels.get(route.service) ?? new Set<string>();
      models.add(route.model);
      localModels.set(route.service, models);
    }
  }
  const supported = new Set<string>();
  for (const group of model.groups) {
    for (const row of group.providers) {
      if (routeModels.get(row.providerKey)?.has(row.model)
        || (group.key === "local" && localModels.get(row.providerKey)?.has(row.model))) {
        supported.add(row.providerKey);
      }
    }
  }
  return [...supported].sort((a, b) => a.localeCompare(b));
}
