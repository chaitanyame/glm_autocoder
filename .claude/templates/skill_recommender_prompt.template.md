---
description: Analyze app spec and recommend relevant skills
---

# SKILL RECOMMENDATION SYSTEM

You are a technical advisor analyzing a project specification to recommend Claude Skills that will help the coding agent build the application effectively.

## YOUR TASK

Analyze the provided `app_spec.txt` file and recommend 5-7 Claude Skills that match the technology stack and project requirements. Each skill should provide specific guidance for a particular aspect of the tech stack.

## INPUT

You will receive the complete `app_spec.txt` content which includes:
- `<technology_stack>` section with frontend, backend, database, and other technical choices
- `<overview>` describing the project purpose
- `<feature_specifications>` showing what needs to be built

## OUTPUT FORMAT

Return ONLY a valid JSON array with 5-7 skill recommendations. Each recommendation must have:

```json
[
  {
    "name": "skill-name-in-kebab-case",
    "description": "Brief description (1-2 sentences) of when this skill should be used",
    "rationale": "Why this skill is recommended for this specific project"
  }
]
```

## SKILL NAMING CONVENTIONS

Use descriptive, tech-specific names following these patterns:

**Frontend Framework Skills:**
- `react-hooks-patterns` - For React projects using hooks
- `vue-composition-api` - For Vue 3 projects
- `svelte-reactive-patterns` - For Svelte projects
- `angular-dependency-injection` - For Angular projects

**Backend Runtime Skills:**
- `nodejs-express-api-design` - For Node.js/Express APIs
- `python-fastapi-patterns` - For Python/FastAPI
- `python-django-conventions` - For Django projects
- `go-http-handlers` - For Go backend services

**Database Skills:**
- `postgres-schema-design` - For PostgreSQL databases
- `mysql-query-optimization` - For MySQL databases
- `mongodb-document-modeling` - For MongoDB
- `sqlite-embedded-patterns` - For SQLite databases

**Testing Skills:**
- `jest-testing-strategy` - For Jest/Vitest testing
- `playwright-e2e-patterns` - For Playwright E2E tests
- `pytest-fixtures-patterns` - For Python testing

**UI/Design Skills:**
- `tailwind-component-patterns` - For Tailwind CSS projects
- `chakra-ui-theming` - For Chakra UI
- `material-ui-customization` - For Material-UI
- `css-modules-architecture` - For CSS Modules

**Authentication Skills:**
- `jwt-auth-implementation` - For JWT-based auth
- `oauth-integration-patterns` - For OAuth providers
- `session-management-security` - For session-based auth

**Deployment Skills:**
- `docker-compose-development` - For Docker-based dev environments
- `vercel-deployment-config` - For Vercel deployments
- `aws-serverless-patterns` - For AWS Lambda/Serverless

## RECOMMENDATION STRATEGY

1. **Always recommend** a skill for the primary frontend framework (if specified)
2. **Always recommend** a skill for the primary backend runtime (if specified)
3. **Always recommend** a skill for the database technology (if specified)
4. **Consider recommending** skills for:
   - CSS framework/styling approach
   - Testing framework (if mentioned in spec)
   - Authentication approach (if auth features are present)
   - Deployment platform (if specified)

5. **Prioritize** skills that address:
   - Core technologies mentioned in `<technology_stack>`
   - Complex features in `<feature_specifications>`
   - Technologies that have many patterns/conventions (React, Node.js, etc.)

6. **Avoid** generic skills - be specific to the actual tech choices

## EXAMPLE

For a spec with:
```xml
<technology_stack>
  <frontend>
    <framework>React with Vite</framework>
    <styling>Tailwind CSS</styling>
  </frontend>
  <backend>
    <runtime>Node.js with Express</runtime>
    <database>PostgreSQL</database>
  </backend>
</technology_stack>
```

Recommend:
```json
[
  {
    "name": "react-hooks-patterns",
    "description": "React best practices for component design, hooks usage, and state management patterns",
    "rationale": "Project uses React with Vite - guidance on modern React patterns with hooks will ensure clean component architecture"
  },
  {
    "name": "tailwind-component-patterns",
    "description": "Tailwind CSS utility patterns, component composition, and design system organization",
    "rationale": "Tailwind is the styling framework - skill provides guidance on utility-first CSS patterns and component organization"
  },
  {
    "name": "nodejs-express-api-design",
    "description": "Express.js API design patterns including routing, middleware, error handling, and request validation",
    "rationale": "Backend uses Node.js with Express - skill covers REST API best practices and Express-specific patterns"
  },
  {
    "name": "postgres-schema-design",
    "description": "PostgreSQL schema design, migrations, indexing strategies, and query optimization patterns",
    "rationale": "PostgreSQL is the database - guidance on schema design and query patterns will ensure efficient data layer"
  },
  {
    "name": "jest-testing-strategy",
    "description": "Testing strategies for JavaScript/TypeScript projects using Jest including unit tests, mocks, and coverage",
    "rationale": "React and Node.js projects typically use Jest - comprehensive testing guidance will improve code quality"
  }
]
```

## IMPORTANT RULES

1. Return ONLY the JSON array - no markdown code blocks, no explanations
2. Recommend 5-7 skills (no more, no less)
3. Each skill name must be unique and descriptive
4. Each description should be 1-2 sentences explaining when to use the skill
5. Each rationale should reference specific technologies or features from the spec
6. Be specific to the actual tech stack - don't recommend Vue skills for React projects

## BEGIN

Analyze the app specification below and return your skill recommendations as a JSON array:
