---
name: humanizer
version: 1.0.0
description: Remove AI writing patterns to make text sound natural and human-written.
apply: post
agents:
  - synthesis
  - catalyst
  - fire
  - intake
---

# Humanizer: Remove AI Writing Patterns

Transform AI-generated text to sound more natural and human-written. Focus on clarity, specificity, and authenticity.

## Core Principles

1. **Be specific over vague** - Replace general claims with concrete details
2. **Be direct over inflated** - Cut puffery and get to the point
3. **Be natural over formulaic** - Break predictable patterns
4. **Have voice** - Real writing has personality, not just information

## Patterns to Fix

### Remove AI Vocabulary
These words appear far more in AI text than human writing:
- crucial, pivotal, vital, key (adj), landscape, tapestry, testament
- delve, underscore, highlight, showcase, foster, garner
- Additionally, Moreover, Furthermore (start of sentences)
- vibrant, robust, seamless, cutting-edge, groundbreaking

**Fix:** Use simpler words. "Important" beats "crucial." Just start sentences normally.

### Remove Inflated Significance
Watch for:
- "serves as a testament to"
- "marks a pivotal moment"
- "reflects broader trends"
- "underscores the importance"
- "in the evolving landscape"

**Fix:** State facts directly. "The company grew 40%" beats "The company's growth serves as a testament to its commitment to excellence."

### Remove Superficial -ing Endings
Watch for:
- "highlighting the importance of..."
- "showcasing their commitment to..."
- "emphasizing the need for..."
- "reflecting the broader trend of..."

**Fix:** End sentences. Start new ones. "This shows X" beats "This highlights X, underscoring Y."

### Remove Rule of Three
AI loves grouping things in threes:
- "innovation, collaboration, and excellence"
- "fast, reliable, and secure"
- "planning, execution, and delivery"

**Fix:** If three items aren't all essential, cut to two or one. Be selective.

### Remove Negative Parallelisms
Watch for:
- "It's not just X, it's Y"
- "Not only X, but also Y"
- "This isn't merely X, it's Y"

**Fix:** Just say what it is. Skip the dramatic setup.

### Fix Vague Attributions
Watch for:
- "Experts believe..."
- "Industry observers note..."
- "Research shows..."
- "Many argue that..."

**Fix:** Name sources. "A 2024 MIT study found..." beats "Research shows..."

### Remove Sycophantic Tone
Watch for:
- "Great question!"
- "That's an excellent point!"
- "Absolutely!"
- "I'd be happy to..."

**Fix:** Just answer. Skip the performative enthusiasm.

### Fix Em Dash Overuse
AI uses em dashes (—) heavily for parenthetical asides.

**Fix:** Use commas or periods. One em dash per paragraph max.

### Remove Generic Conclusions
Watch for:
- "The future looks bright"
- "Exciting times lie ahead"
- "This represents a step in the right direction"

**Fix:** End with specifics. What's next? What's the concrete takeaway?

## Add Human Elements

### Have Opinions
Don't just report - react. "I think this is risky because..." is more human than neutral listing.

### Acknowledge Uncertainty
"I'm not sure about X" or "This could go either way" is honest and human.

### Vary Rhythm
Mix short sentences with longer ones. Don't make every sentence the same length.

### Be Specific
"grew 40% in Q3" beats "experienced significant growth"
"3 engineers quit" beats "faced staffing challenges"

## Output

Return ONLY the humanized text. No explanations or commentary.
