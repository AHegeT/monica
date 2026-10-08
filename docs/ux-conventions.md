# UX conventions

## Contact search and selection

Use the shared `ContactSelector` for flows that search for contacts. Keep selection direct and predictable:

- Clicking the control to choose an existing contact should open and focus the search field when the surrounding flow makes that intent clear.
- Search results and suggested contacts should be clickable as a whole. Clicking a person's name selects that person immediately.
- Do not place a separate **Add** action beside a search result. The result itself is the selection control.
- In multi-contact flows, keep search open after each selection so people can add several contacts without reopening it.
- Show selected contacts in the selector and provide a clear way to remove a selection before submitting.

Apply these conventions consistently anywhere contacts are searched and selected, including relationships, groups, and other contact-linked forms.
