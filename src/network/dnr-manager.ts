// DeclarativeNetRequest rule manager for blocking dangerous domains
// Rule IDs: 1000+ range (tracker rules in privacy/ use 1-20)
import { logger } from "@/utils/logger";

const RULE_ID_OFFSET = 1000;
const activeRules = new Map<string, number>(); // domain -> ruleId
let nextRuleId = RULE_ID_OFFSET;

const IS_FIREFOX = typeof globalThis.browser !== "undefined"
  && typeof (globalThis.browser as { runtime?: { getBrowserInfo?: unknown } })?.runtime?.getBrowserInfo === "function";

function domainToRuleId(domain: string): number {
  // Deterministic ID from domain hash
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash + domain.charCodeAt(i)) | 0;
  }
  return RULE_ID_OFFSET + Math.abs(hash % 29000); // 1000-29999 range
}

export async function addDnrBlockRule(domain: string): Promise<void> {
  if (IS_FIREFOX) return; // Firefox MV2 uses webRequest blocking
  if (activeRules.has(domain)) return;

  const ruleId = domainToRuleId(domain);
  activeRules.set(domain, ruleId);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: ruleId,
          priority: 2,
          action: { type: "block" as chrome.declarativeNetRequest.RuleActionType },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: [
              "main_frame" as chrome.declarativeNetRequest.ResourceType,
              "sub_frame" as chrome.declarativeNetRequest.ResourceType,
              "script" as chrome.declarativeNetRequest.ResourceType,
              "xmlhttprequest" as chrome.declarativeNetRequest.ResourceType,
              "image" as chrome.declarativeNetRequest.ResourceType,
            ],
          },
        },
      ],
      removeRuleIds: [ruleId],
    });
  } catch (err) {
    activeRules.delete(domain);
    logger.warn("DNR rule add failed:", domain, err);
  }
}

export async function removeDnrBlockRule(domain: string): Promise<void> {
  if (IS_FIREFOX) return;

  const ruleId = activeRules.get(domain);
  if (ruleId === undefined) return;

  activeRules.delete(domain);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
    });
  } catch (err) {
    logger.warn("DNR rule remove failed:", domain, err);
  }
}

export async function syncDnrRulesWithBlacklist(domains: string[]): Promise<void> {
  if (IS_FIREFOX) return;

  try {
    // Get existing dynamic rules
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingBlockIds = existing
      .filter((r) => r.id >= RULE_ID_OFFSET)
      .map((r) => r.id);

    // Build new rules
    const newRules: chrome.declarativeNetRequest.Rule[] = domains.map((domain) => {
      const ruleId = domainToRuleId(domain);
      activeRules.set(domain, ruleId);
      return {
        id: ruleId,
        priority: 2,
        action: { type: "block" as chrome.declarativeNetRequest.RuleActionType },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: [
            "main_frame" as chrome.declarativeNetRequest.ResourceType,
            "sub_frame" as chrome.declarativeNetRequest.ResourceType,
            "script" as chrome.declarativeNetRequest.ResourceType,
            "xmlhttprequest" as chrome.declarativeNetRequest.ResourceType,
            "image" as chrome.declarativeNetRequest.ResourceType,
          ],
        },
      };
    });

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingBlockIds,
      addRules: newRules,
    });

    logger.debug(`DNR rules synced: ${newRules.length} block rules`);
  } catch (err) {
    logger.warn("DNR sync failed:", err);
  }
}

export async function clearAllDnrRules(): Promise<void> {
  if (IS_FIREFOX) return;

  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const idsToRemove = existing
      .filter((r) => r.id >= RULE_ID_OFFSET)
      .map((r) => r.id);

    if (idsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: idsToRemove,
      });
    }
    activeRules.clear();
    logger.debug("All DNR block rules cleared");
  } catch (err) {
    logger.warn("DNR clear failed:", err);
  }
}

export function getDnrRuleCount(): number {
  return activeRules.size;
}
