export const VANTORA_KNOWLEDGE = {
  name: 'Vantora',
  purpose: 'All-in-one fintech and travel/logistics application.',
  phase1Mvp: [
    'Wallet',
    'Funding',
    'P2P transfers',
    'Airtime and data',
    'Flights and hotels',
    'Logistics via Kwik API',
  ],
  stack: [
    'Flutter',
    'NestJS',
    'Postgres',
    'Redis',
    'Anchor / Maplerad',
    'Paystack',
    'Dojah',
    'Amadeus / Duffel',
    'Hotelbeds',
    'AWS',
  ],
  budgetUsd: 25500,
  timelineWeeks: 20,
  forbiddenConfusions: [
    'Do not describe Vantora as a crypto product.',
    'Do not substitute Stellar or Ripple for the Vantora architecture.',
    'Do not mention Stripe as a Vantora payment provider.',
    'Do not invent a different framework, vendor list, budget, or timeline.',
  ],
  paymentIdempotencyRule: [
    'Always check the idempotency table and the ledger before retrying a payment reference.',
    'If a payment is FAILED and no debit exists, allow a retry using the same reference within the 15-minute retry window.',
    'If a debit exists, block the retry and route the case to the refund workflow; never double-charge.',
    'Record the outcome in the audit log.',
  ],
};

export const TJR_VERIFICATION_KNOWLEDGE = {
  trustedHandles: ['@tjr_tradez', '@tjrtrades'],
  knownImpersonationPattern: /^\.\.tjr/i,
  knownTestHandle: '@..tjrtradez',
  guidance: [
    'Treat the exact known test handle @..tjrtradez as an impersonation/scam warning, not as an official TJR account.',
    'Do not use follower or following counts alone as proof that an account is genuine or fraudulent.',
    'For new or ambiguous accounts, use live web search and identify whether the account is linked from an established official TJR source.',
    'When the evidence is strong, be direct: tell the user it appears to be an impersonation, recommend blocking/reporting it, and do not ask the user to send money or credentials.',
  ],
};

export function projectKnowledgeContext() {
  return [
    'PROJECT-SPECIFIC VERIFIED KNOWLEDGE:',
    `Vantora: ${VANTORA_KNOWLEDGE.purpose}`,
    `Vantora Phase 1 MVP: ${VANTORA_KNOWLEDGE.phase1Mvp.join(', ')}.`,
    `Vantora stack: ${VANTORA_KNOWLEDGE.stack.join(', ')}.`,
    `Vantora budget: $${VANTORA_KNOWLEDGE.budgetUsd.toLocaleString('en-US')} USD. Timeline: ${VANTORA_KNOWLEDGE.timelineWeeks} weeks.`,
    'Vantora payment idempotency procedure:',
    ...VANTORA_KNOWLEDGE.paymentIdempotencyRule.map(item => '- ' + item),
    'Vantora prohibitions:',
    ...VANTORA_KNOWLEDGE.forbiddenConfusions.map(item => '- ' + item),
    `TJR trusted handles: ${TJR_VERIFICATION_KNOWLEDGE.trustedHandles.join(', ')}.`,
    `Known TJR impersonation test handle: ${TJR_VERIFICATION_KNOWLEDGE.knownTestHandle}; matching handles beginning with "..tjr" should be treated as suspicious and investigated.`,
    ...TJR_VERIFICATION_KNOWLEDGE.guidance.map(item => '- ' + item),
    'This project knowledge is higher priority than generic guesses. Never fill missing Vantora facts with unrelated industry templates.',
  ].join('\\n');
}
