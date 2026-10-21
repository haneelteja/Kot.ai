# Client Intake Questionnaire — WhatsApp AI Bot Setup

**Instructions for the LLM:**
You are helping configure a WhatsApp AI customer service bot for a new business client.
Ask the client each question below one at a time (or in small groups where noted).
After collecting all answers, output two deliverables:

1. **System Prompt** — a ready-to-use bot system prompt based on their answers
2. **Knowledge Base Seed** — a list of Q&A pairs formatted for upload

Do not skip any question marked **[Required]**. For optional questions, note the default if the client skips.

---

## PART 1 — Business Identity

1. **[Required]** What is your business name?

2. **[Required]** In one or two sentences, what does your business do? (product/service, target customer)

3. **[Required]** What industry are you in?
   *(e.g. e-commerce, healthcare, real estate, edtech, fintech, hospitality, logistics)*

4. What is your business's primary language for customer communication?
   *(Default: English. If multilingual, list all languages in order of priority)*

5. Do you have a tagline or brand positioning statement you want the bot to reflect?

---

## PART 2 — Bot Purpose and Scope

6. **[Required]** Which bot(s) are you activating?
   - Support Bot *(handles customer queries, complaints, FAQs)*
   - Sales Bot *(qualifies leads, answers pre-purchase questions, books demos)*
   - Lifecycle Bot *(follow-ups, re-engagement, campaigns)*

7. **[Required]** What are the top 5 questions customers ask you most often?
   *(List question + your standard answer for each)*

8. What topics should the bot **never** discuss?
   *(e.g. competitor pricing, legal advice, medical diagnosis, internal pricing sheets)*
   *(Default: none blocked)*

9. Are there any topics the bot should redirect to a human agent immediately?
   *(e.g. refund requests above ₹5,000, legal complaints, media enquiries)*

---

## PART 3 — Tone and Persona

10. **[Required]** How should the bot communicate?
    - Formal and professional
    - Friendly and conversational
    - Casual and energetic
    - Technical and precise

11. Should the bot have a name?
    *(e.g. "Hi, I'm Aria from [Business]!" — Default: no persona name, just represents the brand)*

12. Any phrases or words you want the bot to always / never use?
    *(e.g. always say "Happy to help!" / never say "I don't know")*

---

## PART 4 — Products and Services

13. **[Required]** List your main products or services with a brief description and price (if public).

14. Do you have any ongoing offers, discounts, or promotions the bot should mention?

15. What are your delivery / fulfilment timelines? (if applicable)

16. What payment methods do you accept?

17. What is your refund / cancellation / return policy?

---

## PART 5 — Escalation and Handoff

18. **[Required]** When should the bot hand the conversation to a human agent?
    *(List specific triggers, e.g. "customer says 'speak to manager'", "complaint about damaged product", "payment failed")*

19. During what hours are human agents available?
    *(e.g. Mon–Fri 9 AM–6 PM IST. Default: 24/7 bot, agents only during business hours)*

20. What should the bot say when no agent is available?
    *(Default: "Our team is currently offline. We'll get back to you within [X] hours.")*

21. Is there a phone number or email the bot should share for urgent issues?

---

## PART 6 — Knowledge Base Content

22. Do you have an existing FAQ document, product catalogue, or help centre?
    *(If yes, paste the content below or describe the key sections — the LLM will convert it into Q&A pairs)*

23. Are there any policies the bot must know verbatim?
    *(e.g. warranty terms, data privacy statement, SLA commitments)*

24. Are there any location-specific details?
    *(e.g. store addresses, delivery zones, regional pricing)*

---

## PART 7 — Compliance and Guardrails

25. Are there any regulatory or legal restrictions on what the bot can say?
    *(e.g. IRDAI rules for insurance bots, RBI guidelines for fintech, healthcare disclaimers)*

26. Should the bot collect any customer information during the conversation?
    *(e.g. name, email, order number — or strictly no PII collection)*

27. Should the bot responses be limited to information in your knowledge base only?
    *(Yes = KB-only mode, bot won't answer from general knowledge / Default: No, bot uses KB + general knowledge)*

---

## PART 8 — Voice Calls (if voice bot is enabled)

28. What scenarios should trigger an outbound call?
    *(e.g. cart abandoned for 2 hours, lead didn't respond to 2 WhatsApp messages, payment failed)*

29. What is the ideal call script opening line?
    *(e.g. "Hi [Name], this is [Bot Name] calling from [Business] regarding your recent order.")*

30. How many call attempts should be made if there is no answer?
    *(Default: 2 attempts, 4 hours apart)*

---

## OUTPUT FORMAT

After collecting all answers, generate:

### 1. System Prompt
```
You are [bot name or "a customer service assistant"] for [Business Name], [one-line description].

[Tone instruction]

Your primary responsibilities:
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

Key information you must know:
[Products, policies, hours, contact details — populated from answers]

Rules you must always follow:
- Never discuss: [blocked topics]
- Always escalate to a human when: [escalation triggers]
- If asked something outside your knowledge, say: "I don't have that information handy — let me connect you with our team."
- [Compliance rules if any]

Tone: [Formal/Friendly/Casual/Technical]. Keep responses under 3 sentences where possible. Use the customer's name if known.
```

### 2. Knowledge Base Q&A Pairs
Format each pair as:
```
Q: [Customer question as they would actually ask it]
A: [Answer — concise, specific, using exact business details provided]
```

Generate at least 15 Q&A pairs covering: top FAQs, product details, policies, hours, escalation paths.
