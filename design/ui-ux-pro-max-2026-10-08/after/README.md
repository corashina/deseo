# Deseo portal screenshots

Open [the complete gallery](index.html). It shows desktop and narrow views with full-size links.

I captured real product pages at 1440 × 1000 and 390 × 844.
Long forms also have full-page images.

The display date is 5 October 2026, 10:00 Europe/Warsaw.
Backend and Auth clocks keep their real time.
Capture time: 2026-10-08T10:11:10.234Z. Tested source: 880bcb7173ff7221526214ff6e82a8287806840d+diff-fb872902a2f3a4fe19d0464206138408c7bb03801e541aa8160d8df3f2b86dad.
Planning, tasks, messages, and account screens use the local Anna and Marek pair.
Normal Today and memory photo views use an owned disposable pair with decoded photos.
The named photos failed decoding despite HTTP 200 media and storage responses.
Named failure images: [desktop](named-media-failure-1440.jpg) and [phone](named-media-failure-390.jpg).
See [the frontend handoff](../../../docs/DEVELOPMENT.md#frontend-design-handoff) for the named-media evidence and fixture ruling.
Other screens use disposable local fixtures or controlled request failures.
I masked email addresses, invitation codes, and verification codes before capture.
I removed invite tokens from coverage URLs.

The manifest requires 39 routes and 119 views.
The root route resolves to Welcome; its records link the Welcome image.
Invitation entry also resolves to Welcome.

Browser confirmation prompts sit outside the product page.
The navigation suite verifies draft retention after dismissal and navigation after acceptance.
Page images do not claim to show those native prompts.

Reference review: [Cupla](https://www.cupla.app/the-app/) and [Couply](https://www.couply.io/).
Deseo keeps its pastel colors, Two voices icon, partner labels, and shared planning structure.

## Captures

| Route | View | Desktop | Narrow |
|---|---|---|---|
| entry-root | resolved-entry | [1440px](images/entry-welcome-default-1440.jpg) | [390px](images/entry-welcome-default-390.jpg) |
| entry-welcome | default | [1440px](images/entry-welcome-default-1440.jpg) | [390px](images/entry-welcome-default-390.jpg) |
| entry-welcome | invited | [1440px](../../shared/0c37ce31f110a0632ac7ea9bc5d1f60dbfc63ecd5989f77b3330771bf5c54509.jpg) | [390px](../../shared/1ba194c5399823c36a90fc57058db2719972145392e89ed18b12f351ca322337.jpg) |
| entry-welcome | global-signout-failure | [1440px](images/entry-welcome-global-signout-failure-1440.jpg) | [390px](images/entry-welcome-global-signout-failure-390.jpg) |
| entry-email | default | [1440px](images/entry-email-default-1440.jpg) | [390px](images/entry-email-default-390.jpg) |
| entry-email | error | [1440px](images/entry-email-error-1440.jpg) | [390px](images/entry-email-error-390.jpg) |
| entry-verify | default | [1440px](images/entry-verify-default-1440.jpg) | [390px](images/entry-verify-default-390.jpg) |
| entry-verify | invalid-code | [1440px](images/entry-verify-invalid-code-1440.jpg) | [390px](images/entry-verify-invalid-code-390.jpg) |
| entry-profile | new-account | [1440px](images/entry-profile-new-account-1440.jpg) | [390px](images/entry-profile-new-account-390.jpg) |
| pair-start | default | [1440px](images/pair-start-default-1440.jpg) | [390px](images/pair-start-default-390.jpg) |
| pair-invite | default | [1440px](images/pair-invite-default-1440.jpg) | [390px](images/pair-invite-default-390.jpg) |
| pair-invite | generated-code | [1440px](images/pair-invite-generated-code-1440.jpg) | [390px](images/pair-invite-generated-code-390.jpg) |
| pair-invite | delivery-unconfirmed | [1440px](images/pair-invite-delivery-unconfirmed-1440.jpg) | [390px](images/pair-invite-delivery-unconfirmed-390.jpg) |
| pair-invite | already-delivered | [1440px](images/pair-invite-already-delivered-1440.jpg) | [390px](images/pair-invite-already-delivered-390.jpg) |
| pair-join | default | [1440px](images/pair-join-default-1440.jpg) | [390px](images/pair-join-default-390.jpg) |
| pair-join | review | [1440px](images/pair-join-review-1440.jpg) | [390px](images/pair-join-review-390.jpg) |
| pair-join | unavailable | [1440px](images/pair-join-unavailable-1440.jpg) | [390px](images/pair-join-unavailable-390.jpg) |
| pair-waiting | default | [1440px](images/pair-waiting-default-1440.jpg) | [390px](images/pair-waiting-default-390.jpg) |
| pair-waiting | cancel-dialog | [1440px](images/pair-waiting-cancel-dialog-1440.jpg) | [390px](images/pair-waiting-cancel-dialog-390.jpg) |
| pair-welcome | default | [1440px](images/pair-welcome-default-1440.jpg) | [390px](images/pair-welcome-default-390.jpg) |
| pair-ended | default | [1440px](images/pair-ended-default-1440.jpg) | [390px](images/pair-ended-default-390.jpg) |
| invite-entry | valid | [1440px](../../shared/0c37ce31f110a0632ac7ea9bc5d1f60dbfc63ecd5989f77b3330771bf5c54509.jpg) | [390px](../../shared/1ba194c5399823c36a90fc57058db2719972145392e89ed18b12f351ca322337.jpg) |
| invite-entry | invalid | [1440px](images/invite-entry-invalid-1440.jpg) | [390px](images/invite-entry-invalid-390.jpg) |
| calendar | month | [1440px](images/calendar-month-1440.jpg) Â· [Full page](images/calendar-month-1440-full.jpg) | [390px](images/calendar-month-390.jpg) Â· [Full page](images/calendar-month-390-full.jpg) |
| calendar | agenda | [1440px](images/calendar-agenda-1440.jpg) Â· [Full page](images/calendar-agenda-1440-full.jpg) | [390px](images/calendar-agenda-390.jpg) Â· [Full page](images/calendar-agenda-390-full.jpg) |
| calendar | compare | [1440px](images/calendar-compare-1440.jpg) Â· [Full page](images/calendar-compare-1440-full.jpg) | [390px](images/calendar-compare-390.jpg) Â· [Full page](images/calendar-compare-390-full.jpg) |
| calendar | empty | [1440px](images/calendar-empty-1440.jpg) Â· [Full page](images/calendar-empty-1440-full.jpg) | [390px](images/calendar-empty-390.jpg) Â· [Full page](images/calendar-empty-390-full.jpg) |
| calendar | error | [1440px](images/calendar-error-1440.jpg) | [390px](images/calendar-error-390.jpg) |
| event-new | default | [1440px](images/event-new-default-1440.jpg) Â· [Full page](images/event-new-default-1440-full.jpg) | [390px](images/event-new-default-390.jpg) Â· [Full page](images/event-new-default-390-full.jpg) |
| event-new | validation | [1440px](images/event-new-validation-1440.jpg) Â· [Full page](images/event-new-validation-1440-full.jpg) | [390px](images/event-new-validation-390.jpg) Â· [Full page](images/event-new-validation-390-full.jpg) |
| event-new | plan-date | [1440px](images/event-new-plan-date-1440.jpg) Â· [Full page](images/event-new-plan-date-1440-full.jpg) | [390px](images/event-new-plan-date-390.jpg) Â· [Full page](images/event-new-plan-date-390-full.jpg) |
| event-detail | shared | [1440px](images/event-detail-shared-1440.jpg) | [390px](images/event-detail-shared-390.jpg) Â· [Full page](images/event-detail-shared-390-full.jpg) |
| event-detail | private | [1440px](images/event-detail-private-1440.jpg) | [390px](images/event-detail-private-390.jpg) Â· [Full page](images/event-detail-private-390-full.jpg) |
| event-detail | delete-dialog | [1440px](images/event-detail-delete-dialog-1440.jpg) | [390px](images/event-detail-delete-dialog-390.jpg) Â· [Full page](images/event-detail-delete-dialog-390-full.jpg) |
| event-detail | unavailable | [1440px](images/event-detail-unavailable-1440.jpg) | [390px](images/event-detail-unavailable-390.jpg) |
| event-detail | request-error | [1440px](images/event-detail-request-error-1440.jpg) | [390px](images/event-detail-request-error-390.jpg) |
| event-detail | pending-deletion | [1440px](images/event-detail-pending-deletion-1440.jpg) | [390px](images/event-detail-pending-deletion-390.jpg) |
| event-edit | default | [1440px](images/event-edit-default-1440.jpg) Â· [Full page](images/event-edit-default-1440-full.jpg) | [390px](images/event-edit-default-390.jpg) Â· [Full page](images/event-edit-default-390-full.jpg) |
| event-edit | conflict | [1440px](images/event-edit-conflict-1440.jpg) Â· [Full page](images/event-edit-conflict-1440-full.jpg) | [390px](images/event-edit-conflict-390.jpg) Â· [Full page](images/event-edit-conflict-390-full.jpg) |
| event-edit | share-dialog | [1440px](images/event-edit-share-dialog-1440.jpg) Â· [Full page](images/event-edit-share-dialog-1440-full.jpg) | [390px](images/event-edit-share-dialog-390.jpg) Â· [Full page](images/event-edit-share-dialog-390-full.jpg) |
| today | planning | [1440px](images/today-planning-1440.jpg) Â· [Full page](images/today-planning-1440-full.jpg) | [390px](images/today-planning-390.jpg) Â· [Full page](images/today-planning-390-full.jpg) |
| today | empty | [1440px](images/today-empty-1440.jpg) | [390px](images/today-empty-390.jpg) |
| today | error | [1440px](images/today-error-1440.jpg) | [390px](images/today-error-390.jpg) |
| memories | month-feed | [1440px](images/memories-month-feed-1440.jpg) | [390px](images/memories-month-feed-390.jpg) Â· [Full page](images/memories-month-feed-390-full.jpg) |
| memories | empty | [1440px](images/memories-empty-1440.jpg) | [390px](images/memories-empty-390.jpg) |
| memories | error | [1440px](images/memories-error-1440.jpg) | [390px](images/memories-error-390.jpg) |
| memory-new | default | [1440px](../../shared/db932cb733e0e64d4b03a20936d2dda0ed42b747468e9215ab41d3d381f81ac9.jpg) Â· [Full page](../../shared/db932cb733e0e64d4b03a20936d2dda0ed42b747468e9215ab41d3d381f81ac9.jpg) | [390px](images/memory-new-default-390.jpg) Â· [Full page](images/memory-new-default-390-full.jpg) |
| memory-new | selected | [1440px](images/memory-new-selected-1440.jpg) Â· [Full page](images/memory-new-selected-1440-full.jpg) | [390px](images/memory-new-selected-390.jpg) Â· [Full page](images/memory-new-selected-390-full.jpg) |
| memory-new | upload-error | [1440px](images/memory-new-upload-error-1440.jpg) Â· [Full page](images/memory-new-upload-error-1440-full.jpg) | [390px](images/memory-new-upload-error-390.jpg) Â· [Full page](images/memory-new-upload-error-390-full.jpg) |
| memory-detail | author | [1440px](images/memory-detail-author-1440.jpg) | [390px](images/memory-detail-author-390.jpg) |
| memory-detail | partner | [1440px](images/memory-detail-partner-1440.jpg) | [390px](images/memory-detail-partner-390.jpg) |
| memory-detail | delete-dialog | [1440px](images/memory-detail-delete-dialog-1440.jpg) | [390px](images/memory-detail-delete-dialog-390.jpg) |
| memory-detail | unavailable | [1440px](images/memory-detail-unavailable-1440.jpg) | [390px](images/memory-detail-unavailable-390.jpg) |
| memory-detail | media-error | [1440px](images/memory-detail-media-error-1440.jpg) | [390px](images/memory-detail-media-error-390.jpg) |
| memory-detail | request-error | [1440px](images/memory-detail-request-error-1440.jpg) | [390px](images/memory-detail-request-error-390.jpg) |
| memory-detail | pending-deletion | [1440px](images/memory-detail-pending-deletion-1440.jpg) | [390px](images/memory-detail-pending-deletion-390.jpg) |
| memory-edit | default | [1440px](../../shared/12dac4da9357658a3875bc9ef833a2f080a70f17989121dd4a671e687ca4305c.jpg) Â· [Full page](../../shared/12dac4da9357658a3875bc9ef833a2f080a70f17989121dd4a671e687ca4305c.jpg) | [390px](../../shared/5582c4fd031afe42f5d6e698e28fd03f9c45e0957892c27aee9b11adf8861f46.jpg) Â· [Full page](../../shared/5582c4fd031afe42f5d6e698e28fd03f9c45e0957892c27aee9b11adf8861f46.jpg) |
| memory-edit | conflict | [1440px](../../shared/ea4da457fb4379ef32ae3a0c8665321335b54dd8866f0d1730efbd805787330a.jpg) Â· [Full page](../../shared/ea4da457fb4379ef32ae3a0c8665321335b54dd8866f0d1730efbd805787330a.jpg) | [390px](../../shared/bcb71d83c2589e3d2784e833aa6c4e7297fedf3a030ba55f90d88341c6157048.jpg) Â· [Full page](../../shared/bcb71d83c2589e3d2784e833aa6c4e7297fedf3a030ba55f90d88341c6157048.jpg) |
| messages | conversation | [1440px](images/messages-conversation-1440.jpg) | [390px](images/messages-conversation-390.jpg) Â· [Full page](images/messages-conversation-390-full.jpg) |
| messages | notes | [1440px](images/messages-notes-1440.jpg) | [390px](images/messages-notes-390.jpg) |
| messages | empty | [1440px](images/messages-empty-1440.jpg) | [390px](images/messages-empty-390.jpg) Â· [Full page](images/messages-empty-390-full.jpg) |
| messages | error | [1440px](images/messages-error-1440.jpg) | [390px](images/messages-error-390.jpg) Â· [Full page](images/messages-error-390-full.jpg) |
| messages | pending-send | [1440px](images/messages-pending-send-1440.jpg) Â· [Full page](images/messages-pending-send-1440-full.jpg) | [390px](images/messages-pending-send-390.jpg) Â· [Full page](images/messages-pending-send-390-full.jpg) |
| messages | delete-dialog | [1440px](images/messages-delete-dialog-1440.jpg) | [390px](images/messages-delete-dialog-390.jpg) Â· [Full page](images/messages-delete-dialog-390-full.jpg) |
| messages | pending-action | [1440px](images/messages-pending-action-1440.jpg) Â· [Full page](images/messages-pending-action-1440-full.jpg) | [390px](images/messages-pending-action-390.jpg) Â· [Full page](images/messages-pending-action-390-full.jpg) |
| tasks | general | [1440px](images/tasks-general-1440.jpg) | [390px](images/tasks-general-390.jpg) |
| tasks | groceries | [1440px](../../shared/358d70ab5ea4241a45060c0da4e3dcb8b76c191774c9e8b6f86956ea15a5cd67.jpg) | [390px](../../shared/63a59f8a0f9b23797e04342b48c1ddb125e3b7c9c395270853c2ffb3ee9ca364.jpg) |
| tasks | completed | [1440px](../../shared/358d70ab5ea4241a45060c0da4e3dcb8b76c191774c9e8b6f86956ea15a5cd67.jpg) | [390px](../../shared/63a59f8a0f9b23797e04342b48c1ddb125e3b7c9c395270853c2ffb3ee9ca364.jpg) |
| tasks | completion-error | [1440px](images/tasks-completion-error-1440.jpg) | [390px](images/tasks-completion-error-390.jpg) Â· [Full page](images/tasks-completion-error-390-full.jpg) |
| task-new | default | [1440px](../../shared/4b94342771c9c5bfe91a193b60857d4083db50205bd03360079b86b3d0eabe8c.jpg) Â· [Full page](../../shared/4b94342771c9c5bfe91a193b60857d4083db50205bd03360079b86b3d0eabe8c.jpg) | [390px](../../shared/52cb50e33e057a76a86c759f8b28f359d19b9951dca26ed8ffe40075ef1bd009.jpg) Â· [Full page](../../shared/52cb50e33e057a76a86c759f8b28f359d19b9951dca26ed8ffe40075ef1bd009.jpg) |
| task-new | validation | [1440px](../../shared/81ca0ebad7d9add53cd4d67a9be65a86adb9080e85576a5ad2e65564e65b3989.jpg) Â· [Full page](../../shared/81ca0ebad7d9add53cd4d67a9be65a86adb9080e85576a5ad2e65564e65b3989.jpg) | [390px](images/task-new-validation-390.jpg) Â· [Full page](images/task-new-validation-390-full.jpg) |
| task-detail | default | [1440px](images/task-detail-default-1440.jpg) | [390px](images/task-detail-default-390.jpg) |
| task-detail | delete-dialog | [1440px](images/task-detail-delete-dialog-1440.jpg) | [390px](images/task-detail-delete-dialog-390.jpg) |
| task-detail | unavailable | [1440px](images/task-detail-unavailable-1440.jpg) | [390px](images/task-detail-unavailable-390.jpg) |
| task-detail | request-error | [1440px](images/task-detail-request-error-1440.jpg) | [390px](images/task-detail-request-error-390.jpg) |
| task-detail | pending-deletion | [1440px](images/task-detail-pending-deletion-1440.jpg) | [390px](images/task-detail-pending-deletion-390.jpg) |
| task-edit | default | [1440px](../../shared/82f58f6f375c8986e43e852b4ef6f7e7d1fb0af1d65a7ad97be6a4715de6c28f.jpg) Â· [Full page](../../shared/82f58f6f375c8986e43e852b4ef6f7e7d1fb0af1d65a7ad97be6a4715de6c28f.jpg) | [390px](../../shared/bcfded965f23b7931b661125887b1e21faad329c0c0e30081938a266a55346dc.jpg) Â· [Full page](../../shared/bcfded965f23b7931b661125887b1e21faad329c0c0e30081938a266a55346dc.jpg) |
| task-edit | conflict | [1440px](../../shared/1f6e94cea2c2a7d73933140c11d6767c9dc1aa9b0a846c37051a12c89fd44c8e.jpg) Â· [Full page](../../shared/1f6e94cea2c2a7d73933140c11d6767c9dc1aa9b0a846c37051a12c89fd44c8e.jpg) | [390px](images/task-edit-conflict-390.jpg) Â· [Full page](images/task-edit-conflict-390-full.jpg) |
| task-lists | default | [1440px](images/task-lists-default-1440.jpg) | [390px](images/task-lists-default-390.jpg) |
| task-lists | create | [1440px](images/task-lists-create-1440.jpg) | [390px](images/task-lists-create-390.jpg) |
| task-list-detail | general | [1440px](images/task-list-detail-general-1440.jpg) | [390px](images/task-list-detail-general-390.jpg) |
| task-list-detail | nonempty | [1440px](images/task-list-detail-nonempty-1440.jpg) | [390px](images/task-list-detail-nonempty-390.jpg) |
| task-list-detail | empty | [1440px](images/task-list-detail-empty-1440.jpg) | [390px](images/task-list-detail-empty-390.jpg) |
| task-list-detail | move-dialog | [1440px](images/task-list-detail-move-dialog-1440.jpg) | [390px](images/task-list-detail-move-dialog-390.jpg) |
| task-list-detail | remove-dialog | [1440px](images/task-list-detail-remove-dialog-1440.jpg) | [390px](images/task-list-detail-remove-dialog-390.jpg) |
| ideas | saved | [1440px](images/ideas-saved-1440.jpg) | [390px](images/ideas-saved-390.jpg) |
| ideas | planned | [1440px](images/ideas-planned-1440.jpg) | [390px](images/ideas-planned-390.jpg) |
| ideas | archived | [1440px](images/ideas-archived-1440.jpg) | [390px](images/ideas-archived-390.jpg) |
| ideas | empty | [1440px](images/ideas-empty-1440.jpg) | [390px](images/ideas-empty-390.jpg) |
| idea-new | default | [1440px](../../shared/5f0b4981f6af826d843746cc3a43e65d2c0c352eca9e0d7638767ef29d846a73.jpg) Â· [Full page](../../shared/5f0b4981f6af826d843746cc3a43e65d2c0c352eca9e0d7638767ef29d846a73.jpg) | [390px](../../shared/c21d170f847aa8ddb003914e696149994c1a2517a903b8e4296a54cca70af5cf.jpg) Â· [Full page](../../shared/c21d170f847aa8ddb003914e696149994c1a2517a903b8e4296a54cca70af5cf.jpg) |
| idea-new | validation | [1440px](images/idea-new-validation-1440.jpg) Â· [Full page](images/idea-new-validation-1440-full.jpg) | [390px](../../shared/b5c8d84286e25e5c0bdb3a8726f7f3cfa8b5a660e62f0958a74b2edb53f12e46.jpg) Â· [Full page](../../shared/b5c8d84286e25e5c0bdb3a8726f7f3cfa8b5a660e62f0958a74b2edb53f12e46.jpg) |
| idea-detail | saved | [1440px](images/idea-detail-saved-1440.jpg) | [390px](images/idea-detail-saved-390.jpg) |
| idea-detail | planned | [1440px](images/idea-detail-planned-1440.jpg) | [390px](images/idea-detail-planned-390.jpg) |
| idea-detail | archived | [1440px](images/idea-detail-archived-1440.jpg) | [390px](images/idea-detail-archived-390.jpg) |
| idea-detail | archive-dialog | [1440px](images/idea-detail-archive-dialog-1440.jpg) | [390px](images/idea-detail-archive-dialog-390.jpg) |
| idea-detail | unavailable | [1440px](images/idea-detail-unavailable-1440.jpg) | [390px](images/idea-detail-unavailable-390.jpg) |
| idea-detail | request-error | [1440px](images/idea-detail-request-error-1440.jpg) | [390px](images/idea-detail-request-error-390.jpg) |
| idea-edit | default | [1440px](../../shared/d9538684b6fe09b8a1cefb0abc3c78cc4e3ed4b5967d18b45c20388d169d5d20.jpg) Â· [Full page](../../shared/d9538684b6fe09b8a1cefb0abc3c78cc4e3ed4b5967d18b45c20388d169d5d20.jpg) | [390px](../../shared/6d1abd2334a6af9d634da1dc3cd56fbf33b67f923fd5d7262afd8674962cc549.jpg) Â· [Full page](../../shared/6d1abd2334a6af9d634da1dc3cd56fbf33b67f923fd5d7262afd8674962cc549.jpg) |
| idea-edit | conflict | [1440px](../../shared/62dc2c8f0595aaef60ee94b582b441a51fe6225d340c3de84266bbecf3e0df32.jpg) Â· [Full page](../../shared/62dc2c8f0595aaef60ee94b582b441a51fe6225d340c3de84266bbecf3e0df32.jpg) | [390px](images/idea-edit-conflict-390.jpg) Â· [Full page](images/idea-edit-conflict-390-full.jpg) |
| notifications | list | [1440px](images/notifications-list-1440.jpg) | [390px](images/notifications-list-390.jpg) |
| notifications | empty | [1440px](images/notifications-empty-1440.jpg) | [390px](images/notifications-empty-390.jpg) |
| notifications | unavailable | [1440px](images/notifications-unavailable-1440.jpg) | [390px](images/notifications-unavailable-390.jpg) |
| notifications | error | [1440px](images/notifications-error-1440.jpg) | [390px](images/notifications-error-390.jpg) |
| settings | default | [1440px](images/settings-default-1440.jpg) | [390px](images/settings-default-390.jpg) |
| settings | unpaired | [1440px](../../shared/e0696c744fc95c0bb9f78e2b9b7feb595e8631e4940a220ce11f5325dce6a49e.jpg) | [390px](../../shared/72b1482bdd07ae11fbe24a05bfdf26d99d96482fa3075ebcb021fe10dc2cb1fe.jpg) |
| settings | ended | [1440px](../../shared/e0696c744fc95c0bb9f78e2b9b7feb595e8631e4940a220ce11f5325dce6a49e.jpg) | [390px](../../shared/72b1482bdd07ae11fbe24a05bfdf26d99d96482fa3075ebcb021fe10dc2cb1fe.jpg) |
| settings-profile | default | [1440px](../../shared/a5f0a8f983ab6eeb98b49a53af7eb99867189bd6badd2a561eec5ba1efdda077.jpg) Â· [Full page](../../shared/a5f0a8f983ab6eeb98b49a53af7eb99867189bd6badd2a561eec5ba1efdda077.jpg) | [390px](../../shared/f7eb3f0a11ae60799599427903df10735711ae8aa334ae88e2f7b967f1ae69b0.jpg) Â· [Full page](../../shared/f7eb3f0a11ae60799599427903df10735711ae8aa334ae88e2f7b967f1ae69b0.jpg) |
| settings-profile | conflict | [1440px](../../shared/45ec9aa6f3ea124e0f8d76a77e769e2e94e507fabe114a4e4f93130e03ce5ef8.jpg) Â· [Full page](../../shared/45ec9aa6f3ea124e0f8d76a77e769e2e94e507fabe114a4e4f93130e03ce5ef8.jpg) | [390px](../../shared/b304ebce112243c5be0dc39994f2037ac3b791ddf8c8a42bd27363eb6b919fbf.jpg) Â· [Full page](../../shared/b304ebce112243c5be0dc39994f2037ac3b791ddf8c8a42bd27363eb6b919fbf.jpg) |
| settings-pair | default | [1440px](../../shared/b6163938c4efd37d9740b38ce2229b43612243feacfff9a31b2df508475d95d2.jpg) Â· [Full page](../../shared/b6163938c4efd37d9740b38ce2229b43612243feacfff9a31b2df508475d95d2.jpg) | [390px](../../shared/8762564d06221a185dae3baf5d558399a2f976a7ee9e073414337fcf1b00f15d.jpg) Â· [Full page](../../shared/8762564d06221a185dae3baf5d558399a2f976a7ee9e073414337fcf1b00f15d.jpg) |
| settings-pair | verification | [1440px](../../shared/bb9015cba52a582566131147c2795f0c163fcc1506c5b731e96faa1fae01f1cf.jpg) Â· [Full page](../../shared/bb9015cba52a582566131147c2795f0c163fcc1506c5b731e96faa1fae01f1cf.jpg) | [390px](images/settings-pair-verification-390.jpg) Â· [Full page](images/settings-pair-verification-390-full.jpg) |
| settings-pair | end-dialog | [1440px](images/settings-pair-end-dialog-1440.jpg) Â· [Full page](images/settings-pair-end-dialog-1440-full.jpg) | [390px](images/settings-pair-end-dialog-390.jpg) Â· [Full page](images/settings-pair-end-dialog-390-full.jpg) |
| settings-pair | ended | [1440px](../../shared/4167e14a643303da68382a9fbfaebf5b4b8a00cd9af600433d0bb65ed1c732dd.jpg) Â· [Full page](../../shared/4167e14a643303da68382a9fbfaebf5b4b8a00cd9af600433d0bb65ed1c732dd.jpg) | [390px](../../shared/28f44ce75b11926b5f8d7970e4013139fe1a9afdc3d494565337793be276a819.jpg) Â· [Full page](../../shared/28f44ce75b11926b5f8d7970e4013139fe1a9afdc3d494565337793be276a819.jpg) |
| settings-notifications | default | [1440px](images/settings-notifications-default-1440.jpg) Â· [Full page](images/settings-notifications-default-1440-full.jpg) | [390px](images/settings-notifications-default-390.jpg) Â· [Full page](images/settings-notifications-default-390-full.jpg) |
| settings-notifications | quiet-hours | [1440px](images/settings-notifications-quiet-hours-1440.jpg) Â· [Full page](images/settings-notifications-quiet-hours-1440-full.jpg) | [390px](images/settings-notifications-quiet-hours-390.jpg) Â· [Full page](images/settings-notifications-quiet-hours-390-full.jpg) |
| settings-notifications | conflict | [1440px](images/settings-notifications-conflict-1440.jpg) Â· [Full page](images/settings-notifications-conflict-1440-full.jpg) | [390px](images/settings-notifications-conflict-390.jpg) Â· [Full page](images/settings-notifications-conflict-390-full.jpg) |
| settings-account | default | [1440px](../../shared/d6d3122e540867a777132d950de20d4d371e6936e289abdeb23a23a3105d5a58.jpg) Â· [Full page](../../shared/d6d3122e540867a777132d950de20d4d371e6936e289abdeb23a23a3105d5a58.jpg) | [390px](../../shared/236ac56224bbaef6f178a7e1c32bbc204b352e76f89c2c140813f351d76f0993.jpg) Â· [Full page](../../shared/236ac56224bbaef6f178a7e1c32bbc204b352e76f89c2c140813f351d76f0993.jpg) |
| settings-account | unpaired | [1440px](../../shared/10ea490e81d6da87cbd144c3f812b54c525ad715370ea7ffd1034b07a7c313ec.jpg) Â· [Full page](../../shared/10ea490e81d6da87cbd144c3f812b54c525ad715370ea7ffd1034b07a7c313ec.jpg) | [390px](../../shared/d4afe266411e5df1805d8e12d9b4f0bd313ecfe413acdda6d6b48802f528907f.jpg) Â· [Full page](../../shared/d4afe266411e5df1805d8e12d9b4f0bd313ecfe413acdda6d6b48802f528907f.jpg) |
| settings-account | ended | [1440px](../../shared/10ea490e81d6da87cbd144c3f812b54c525ad715370ea7ffd1034b07a7c313ec.jpg) Â· [Full page](../../shared/10ea490e81d6da87cbd144c3f812b54c525ad715370ea7ffd1034b07a7c313ec.jpg) | [390px](../../shared/d4afe266411e5df1805d8e12d9b4f0bd313ecfe413acdda6d6b48802f528907f.jpg) Â· [Full page](../../shared/d4afe266411e5df1805d8e12d9b4f0bd313ecfe413acdda6d6b48802f528907f.jpg) |
| unknown-route | not-found | [1440px](../../shared/8d66208c23528c9f5cfe5930d4dad32852b56e2774d77f604dbd59dc6d076990.jpg) | [390px](../../shared/57572af85dd550134651a1132b95d213be61561cf41fd8abbfb9abbe09860386.jpg) |
