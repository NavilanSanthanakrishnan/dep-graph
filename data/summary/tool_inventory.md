# Tool Inventory

Generated: 2026-05-02T04:35:45.803Z
Total tools: 1305

## github

Tools: 867
Deprecated: 21
Tools with required inputs: 804

### First 25 Tools

- GITHUB_ABORT_REPOSITORY_MIGRATION | Abort Repository Migration | required: migrationId | outputs: generic/unknown
- GITHUB_ACCEPT_REPOSITORY_INVITATION | Accept a repository invitation | required: invitation_id | outputs: generic/unknown
- GITHUB_ADD_APP_ACCESS_RESTRICTIONS | Add app access restrictions | required: apps, repo, owner, branch | outputs: generic/unknown
- GITHUB_ADD_A_REPOSITORY_COLLABORATOR | Add a repository collaborator | required: repo, owner, username | outputs: generic/unknown
- GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE | Add assignees to an issue | required: repo, owner, issue_number | outputs: generic/unknown
- GITHUB_ADD_EMAIL_ADDRESS_FOR_AUTHENTICATED_USER | Add email for auth user | required: emails | outputs: generic/unknown
- GITHUB_ADD_FIELD_TO_USER_PROJECT | Add field to user project | required: name, username, data_type, project_number | outputs: generic/unknown
- GITHUB_ADD_ITEM_TO_USER_PROJECT | Add item to user project | required: type, username, project_number | outputs: generic/unknown
- GITHUB_ADD_LABELS_TO_AN_ISSUE | Add labels to an issue | required: repo, owner, labels, issue_number | outputs: generic/unknown
- GITHUB_ADD_ORG_RUNNER_LABELS | Add org runner labels | required: org, labels, runner_id | outputs: generic/unknown
- GITHUB_ADD_OR_UPDATE_TEAM_MEMBERSHIP_FOR_USER | Add or update team membership for a user | required: org, username, team_slug | outputs: generic/unknown
- GITHUB_ADD_OR_UPDATE_TEAM_PROJECT_PERMISSIONS | Add or update team project permissions | required: org, team_slug, project_id | outputs: generic/unknown
- GITHUB_ADD_OR_UPDATE_TEAM_REPOSITORY_PERMISSIONS | Add or update team repository permissions | required: org, repo, owner, team_slug | outputs: generic/unknown
- GITHUB_ADD_PROJECT_COLLABORATOR | Add project collaborator | required: username, project_id | outputs: generic/unknown
- GITHUB_ADD_REPOSITORY_TO_APP_INSTALLATION | Add a repository to an app installation | required: repository_id, installation_id | outputs: generic/unknown
- GITHUB_ADD_REPO_TO_ORG_SECRET_WITH_SELECTED_ACCESS | Add repo to org secret with selected access | required: org, secret_name, repository_id | outputs: generic/unknown
- GITHUB_ADD_REPO_TO_ORG_SECRET_WITH_SELECTED_VISIBILITY | Add selected repo to org secret | required: org, secret_name, repository_id | outputs: generic/unknown
- GITHUB_ADD_RUNNER_LABELS | Add runner labels | required: repo, owner, labels, runner_id | outputs: generic/unknown
- GITHUB_ADD_SELECTED_REPOSITORY_TO_ORGANIZATION_SECRET | Add selected repository to an organization secret | required: org, secret_name, repository_id | outputs: generic/unknown
- GITHUB_ADD_SELECTED_REPOSITORY_TO_ORGANIZATION_VARIABLE | Add selected repository to an organization variable | required: org, name, repository_id | outputs: generic/unknown
- GITHUB_ADD_SELECTED_REPOSITORY_TO_USER_SECRET | Add a selected repository to a user secret | required: secret_name, repository_id | outputs: generic/unknown
- GITHUB_ADD_SOCIAL_ACCOUNTS_FOR_AUTHENTICATED_USER | Add social accounts for the authenticated user | required: account_urls | outputs: generic/unknown
- GITHUB_ADD_STATUS_CHECK_CONTEXTS | Add status check contexts | required: repo, owner, branch, contexts | outputs: generic/unknown
- GITHUB_ADD_SUB_ISSUE | Add sub-issue to an issue | required: issue_id | outputs: generic/unknown
- GITHUB_ADD_TEAM_ACCESS_RESTRICTIONS | Add team access restrictions | required: repo, owner, teams, branch | outputs: generic/unknown

## googlesuper

Tools: 438
Deprecated: 38
Tools with required inputs: 362

### First 25 Tools

- GOOGLESUPER_ACL_DELETE | Delete ACL Rule | required: rule_id, calendar_id | outputs: generic/unknown
- GOOGLESUPER_ACL_GET | Get ACL Rule | required: rule_id, calendar_id | outputs: generic/unknown
- GOOGLESUPER_ACL_INSERT | Create ACL Rule | required: role, scope, scope.type, calendar_id | outputs: generic/unknown
- GOOGLESUPER_ACL_LIST | List ACL Rules | required: calendarId | outputs: generic/unknown
- GOOGLESUPER_ACL_PATCH | Patch ACL Rule | required: rule_id, calendar_id | outputs: generic/unknown
- GOOGLESUPER_ACL_UPDATE | Update ACL Rule | required: role, rule_id, calendar_id | outputs: generic/unknown
- GOOGLESUPER_ACL_WATCH | Watch ACL Changes | required: id, address, calendarId | outputs: generic/unknown
- GOOGLESUPER_ADD_ENRICHMENT | Add Enrichment | required: albumId, albumPosition, albumPosition.position, newEnrichmentItem | outputs: generic/unknown
- GOOGLESUPER_ADD_FILE_SHARING_PREFERENCE | Add file sharing preference (Deprecated) | required: role, type, file_id | outputs: generic/unknown
- GOOGLESUPER_ADD_LABEL_TO_EMAIL | Modify email labels | required: message_id | outputs: generic/unknown
- GOOGLESUPER_ADD_OR_REMOVE_TO_CUSTOMER_LIST | Add or remove to customer list | required: emails, resource_name | outputs: generic/unknown
- GOOGLESUPER_ADD_PARENT | Insert File Parent (v2) | required: id, fileId | outputs: generic/unknown
- GOOGLESUPER_ADD_PROPERTY | Insert Property (v2 API) | required: fileId, property_key, property_value | outputs: generic/unknown
- GOOGLESUPER_ADD_SHEET | Add Sheet to Existing Spreadsheet | required: spreadsheet_id | outputs: generic/unknown
- GOOGLESUPER_AGGREGATE_COLUMN_DATA | Aggregate Column Data | required: operation, sheet_name, target_column, spreadsheet_id | outputs: generic/unknown
- GOOGLESUPER_APPEND_DIMENSION | Append Dimension | required: length, sheet_id, dimension, spreadsheet_id | outputs: generic/unknown
- GOOGLESUPER_ARCHIVE_CUSTOM_DIMENSION | Archive Custom Dimension | required: name | outputs: generic/unknown
- GOOGLESUPER_AUTOCOMPLETE | Autocomplete Place Predictions | required: input | outputs: generic/unknown
- GOOGLESUPER_AUTO_RESIZE_DIMENSIONS | Auto-Resize Rows or Columns | required: dimension, end_index, start_index, spreadsheet_id | outputs: generic/unknown
- GOOGLESUPER_BATCH_ADD_MEDIA_ITEMS | Batch Add Media Items | required: albumId, mediaItemIds | outputs: generic/unknown
- GOOGLESUPER_BATCH_CLEAR_VALUES_BY_DATA_FILTER | Batch Clear Values By Data Filter | required: dataFilters, spreadsheetId | outputs: generic/unknown
- GOOGLESUPER_BATCH_CREATE_MEDIA_ITEMS | Batch Create Media Items | required: none | outputs: generic/unknown
- GOOGLESUPER_BATCH_DELETE_MESSAGES | Batch delete Gmail messages | required: messageIds | outputs: generic/unknown
- GOOGLESUPER_BATCH_EVENTS | Batch Events | required: operations, operations[].op_id, operations[].method, operations[].calendar_id | outputs: generic/unknown
- GOOGLESUPER_BATCH_EXECUTE | Batch Execute Google Tasks Operations | required: requests, requests[].id, requests[].path, requests[].method | outputs: generic/unknown

