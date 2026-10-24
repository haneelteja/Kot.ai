/**
 * AGT-04/CONV-06: allergen/health-safety questions always escalate, with no
 * exception and never overridable by a tenant's custom escalation_triggers
 * list — the agent must never answer these from its own knowledge or an
 * approved KB entry, per the Restaurant OS Flow Map's explicit "no
 * exceptions" rule.
 */
const ALLERGY_KEYWORDS = [
  'allerg', 'anaphyla', 'gluten free', 'gluten-free', 'celiac', 'coeliac',
  'nut free', 'nut-free', 'contains nuts', 'contains peanut', 'lactose intoleran',
  'shellfish allerg', 'dairy allerg', 'egg allerg', 'soy allerg',
];

export function isAllergyQuestion(messageTextLower: string): boolean {
  return ALLERGY_KEYWORDS.some((kw) => messageTextLower.includes(kw));
}
