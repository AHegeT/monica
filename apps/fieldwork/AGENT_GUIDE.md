# Fieldwork research agent instructions

Fieldwork is a professional CRM and a persistent research workspace. Use its authenticated tools to inspect and save research; a conversation alone does not persist records.

## Explore and assess

1. Call `describe_workspace` first. Inspect available operations, limitations, and conventions. Inspect existing investigations using `list_records` and `get_record` before proposing an organization scheme.
2. Explain which available structures suit the user's research and which fall short. Distinguish implemented behavior from proposed improvements. A successful tool listing does not prove every workflow works.
3. When asked to evaluate the app, create or reuse a separate investigation titled "Fieldwork feedback". Save specific limitations, desired behavior, and examples as Question findings. State whether each gap is an observed problem or a feature proposal. Do not alter the user's sales pipeline to explore a capability unless asked.

## Store competitive analysis

- Use one investigation for a coherent market/question. Title it clearly, with a useful time period when appropriate. Search first to avoid duplicates.
- Put the research question and scope in `question`. Put a concise synthesis, implications, and remaining uncertainty in `summary`. Choose consistent `tags`, e.g. `competitive-analysis`, `pricing`, and a market name.
- Add each competitor as a Company subject. Reuse existing company IDs. Keep profile/source links and short context on subjects.
- Save one meaningful claim per finding. Use Observation for reported evidence, Hypothesis for interpretation, and Question for gaps. Fieldwork does not verify evidence for you.
- Attach competitor-specific findings using `targetId`; leave it absent for comparisons and market-wide conclusions. Preserve source URLs and a short source reference including the source date or section when available. Never invent links or citations. Mark unsourced user input clearly.
- Include topic labels in the finding text, e.g. "Pricing — ...", "Positioning — ...", or "Target customer — ...". Those dimensions are conventions, not structured comparison columns.
- Do not force a report into one enormous finding. Text fields allow 10,000 characters each. Attachments are not supported or needed.
- Use stable `requestId` values for write retries. Read current versions before updating an investigation and pass `expectedVersion` to avoid overwriting concurrent edits.
- Only claim research was saved after successful tool responses. Return the investigation ID, its URL (`<Fieldwork origin>/#research`, where the user can open it by title), record counts, and any failed writes. Never report invented deep links.

## Retrieve later

Use `search_records` with topic, competitor, or tag keywords, or `list_records` for paginated research/status/updated-since discovery. Searches include stored findings and summaries but are literal case-insensitive text matching, not semantic search. `get_record` with collection `research` and its stable ID returns the full investigation, subjects, sources, and findings. Preserve the distinction between stored evidence and your new interpretation when answering.

## Credentials and connection

Keep the Fieldwork token in the MCP environment or GPT Action authentication configuration. Do not put it in prompts or source URLs. Local MCP uses `server/mcp.js`; a cloud chat needs a reachable HTTPS API through configured Actions, or a compatible remote MCP integration. Fieldwork currently provides a local stdio MCP adapter, not a remote MCP endpoint. Tokens have broad read/write permissions across one workspace; they do not have per-investigation permissions.
