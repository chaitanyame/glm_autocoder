---
description: Generate a Claude Skill based on technology stack and skill requirements
---

# SKILL GENERATOR

You are an expert technical writer creating a Claude Skill for a specific technology or framework within a project.

## YOUR TASK

Generate a complete `SKILL.md` file that provides expert guidance for implementing features using a specific technology or framework.

## INPUT CONTEXT

**Project Technology Stack:**
$TECH_STACK

**Skill to Generate:**
- **Name:** $SKILL_NAME
- **Description:** $SKILL_DESCRIPTION

## OUTPUT FORMAT

Generate a complete SKILL.md file following this exact structure:

```markdown
---
name: [skill-name]
description: [When to use this skill - 1-2 sentences that trigger auto-activation]
---

[Opening paragraph explaining what this skill provides]

## Core Principles

[2-4 fundamental principles or best practices for this technology]

## [Section Name 1]

[Detailed guidance on a key aspect]

## [Section Name 2]

[Detailed guidance on another key aspect]

## [Section Name 3]

[Detailed guidance on another key aspect]

## Common Patterns

[Code patterns, examples, or conventions specific to this technology]

## Anti-Patterns to Avoid

[What NOT to do - common mistakes or outdated approaches]

## Best Practices Summary

[Quick reference list of key takeaways]
```

## SKILL WRITING GUIDELINES

### 1. Frontmatter Requirements

The YAML frontmatter MUST include:
- `name`: Exact skill name in kebab-case (e.g., `react-hooks-patterns`)
- `description`: 1-2 sentences describing when Claude should use this skill. This should mention:
  - The technology/framework name
  - Common scenarios that trigger this skill
  - Example: "Use when working with React components, hooks, state management, or implementing React-based user interfaces. Provides modern React patterns and best practices."

### 2. Content Structure

**Opening Paragraph:**
- Briefly explain what expertise this skill provides
- Set the context for when this guidance applies

**Core Principles (2-4 principles):**
- Fundamental concepts that guide all work with this technology
- High-level philosophy or approach
- What makes code "good" in this technology

**Main Sections (3-5 sections):**
Choose sections based on the technology. Examples:
- **For React:** Component Patterns, Hook Usage, State Management, Performance Optimization
- **For Express:** Routing Architecture, Middleware Patterns, Error Handling, Request Validation
- **For PostgreSQL:** Schema Design, Query Optimization, Indexing Strategy, Migration Patterns
- **For Tailwind:** Utility Composition, Component Patterns, Responsive Design, Custom Configuration

**Common Patterns:**
- Concrete code examples or approaches
- Typical implementation patterns
- Configuration snippets
- File organization conventions

**Anti-Patterns:**
- What to avoid
- Common mistakes
- Outdated approaches
- Performance pitfalls

**Best Practices Summary:**
- Bulleted quick reference
- Key takeaways
- Decision-making guidelines

### 3. Tone and Style

- **Prescriptive, not descriptive** - Tell Claude what to do, not what exists
- **Specific and actionable** - Provide concrete guidance
- **Context-aware** - Reference the project's tech stack when relevant
- **Opinionated** - Take clear positions on best approaches
- **Concise** - Dense with information, avoid fluff

### 4. Length Guidelines

- Total length: 100-200 lines
- Each section: 5-15 lines
- Opening paragraph: 2-3 sentences
- Core principles: 1-2 sentences each

### 5. Technology-Specific Focus

Tailor content to the SPECIFIC technology. For example:

**React Skill** should cover:
- Functional components vs class components (prefer functional)
- Hook rules and patterns (useState, useEffect, useCallback, useMemo)
- Component composition and prop patterns
- Context API for state management
- Performance optimization (React.memo, lazy loading)

**Express Skill** should cover:
- Router organization and middleware chain
- Error handling middleware
- Request validation and sanitization
- Response formatting patterns
- Security best practices (helmet, cors, rate limiting)

**PostgreSQL Skill** should cover:
- Schema design and normalization
- Migration strategies
- Index selection and optimization
- Query patterns and common table expressions
- Connection pooling

**Tailwind Skill** should cover:
- Utility-first composition
- Component extraction strategies
- Custom configuration and theme extension
- Responsive design patterns
- Dark mode implementation

## EXAMPLE OUTPUT

Here's an abbreviated example for `react-hooks-patterns`:

```markdown
---
name: react-hooks-patterns
description: Use when working with React components, hooks, state management, or implementing React-based user interfaces. Provides modern React patterns and best practices for functional components.
---

This skill provides expert guidance on modern React development using functional components and hooks. Apply these patterns when building React UIs to ensure clean, performant, and maintainable code.

## Core Principles

1. **Composition over inheritance** - Build complex UIs by composing small, focused components
2. **Hooks for logic reuse** - Extract reusable logic into custom hooks
3. **Minimize re-renders** - Use memoization strategically to optimize performance
4. **Declarative data flow** - Keep state minimal and derive values when possible

## Component Structure

Organize components with this structure:
1. Imports
2. Type definitions (TypeScript interfaces/types)
3. Component function with hooks at the top
4. Event handlers and derived values
5. Conditional early returns
6. Main JSX return

Keep components focused - if a component grows beyond 150 lines, consider splitting it.

## Hook Usage Patterns

**useState:**
- Initialize with functions for expensive computations: `useState(() => expensiveCalc())`
- Prefer multiple useState calls over complex objects
- Use functional updates when new state depends on old: `setState(prev => prev + 1)`

**useEffect:**
- One effect per concern (don't combine unrelated logic)
- Always specify dependencies array
- Return cleanup functions for subscriptions/timers
- Avoid if you can derive the value instead

**useCallback & useMemo:**
- useCallback for functions passed to optimized children
- useMemo for expensive computations
- Don't over-optimize - measure first

**Custom Hooks:**
- Extract reusable logic into custom hooks (prefix with `use`)
- Return arrays for simple cases `[value, setValue]`
- Return objects for complex cases `{ data, loading, error }`

## State Management

**Local state (useState):** Component-specific data, form inputs, UI toggles

**Context (useContext):** Rarely-changing data shared by many components (theme, auth, i18n)

**External libraries (Zustand, Redux):** Complex global state, frequent updates

Avoid prop drilling - use composition or context for deeply nested data.

## Common Patterns

**Conditional Rendering:**
```jsx
// Early return for loading/error states
if (loading) return <Spinner />
if (error) return <Error message={error} />

// Inline conditional with &&
{isVisible && <Component />}

// Ternary for either/or
{isEdit ? <EditForm /> : <DisplayView />}
```

**Lists:**
```jsx
{items.map(item => (
  <Item key={item.id} {...item} />
))}
```

## Anti-Patterns to Avoid

- ❌ Mutating state directly: `state.push(item)` → Use `setState([...state, item])`
- ❌ Missing dependencies in useEffect → Leads to stale closures
- ❌ Placing hooks inside conditions or loops → Must be at top level
- ❌ Using index as key in dynamic lists → Causes rendering bugs
- ❌ Over-using useEffect → Prefer derived state and event handlers

## Best Practices Summary

- Keep components small and focused (single responsibility)
- Extract custom hooks for reusable logic
- Use TypeScript for props and state types
- Implement error boundaries for graceful failure
- Lazy load routes and heavy components
- Test with React Testing Library focusing on user behavior
```

## IMPORTANT RULES

1. Generate a COMPLETE skill file, not a template or outline
2. Include the YAML frontmatter with proper name and description
3. Make content specific to the requested technology
4. Provide actionable, prescriptive guidance
5. Include concrete examples where helpful
6. Keep total length between 100-200 lines
7. Focus on modern, current best practices for the technology

## BEGIN

Generate the SKILL.md file for the skill specified above. Output the complete file contents, starting with the YAML frontmatter.
