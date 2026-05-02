import type { NormalizedParam, NormalizedTool } from "./types.ts";

type ResourceRule = {
  id: string;
  param: RegExp;
  context?: RegExp;
  producer: RegExp;
  weak?: boolean;
};

const RESOURCE_RULES: ResourceRule[] = [
  {
    id: "github_repository",
    param: /^(repo|repository_id|repository|owner)$/i,
    context: /github|repo|repository|branch|issue|pull|commit/i,
    producer: /repo|repository|repositories/i,
    weak: true,
  },
  {
    id: "github_issue",
    param: /^(issue_number|issue_id|issue)$/i,
    producer: /issue|issues/i,
  },
  {
    id: "github_pull_request",
    param: /^(pull_number|pull_request_id|pr_number)$/i,
    producer: /pull request|pull requests/i,
  },
  {
    id: "github_comment",
    param: /^(comment_id|discussion_comment_id|review_comment_id)$/i,
    producer: /comment|comments|review comment/i,
  },
  {
    id: "github_branch_or_ref",
    param: /^(branch|ref|base|head|sha|commit_sha|head_sha)$/i,
    producer: /branch|branches|ref|commit|commits|sha/i,
  },
  {
    id: "github_workflow_run",
    param: /^(run_id|workflow_run_id)$/i,
    producer: /workflow run|workflow runs|run\b|runs\b/i,
  },
  {
    id: "github_workflow",
    param: /^(workflow_id|workflow_file_name)$/i,
    producer: /workflow|workflows/i,
  },
  {
    id: "github_label",
    param: /^(label|labels|label_id|label_name)$/i,
    producer: /label|labels/i,
  },
  {
    id: "github_user",
    param: /^(username|assignee|assignees|reviewers)$/i,
    producer: /user|users|collaborator|assignee|reviewer|member/i,
  },
  {
    id: "github_org",
    param: /^(org|organization|organization_id)$/i,
    producer: /org|organization|organizations/i,
    weak: true,
  },
  {
    id: "github_team",
    param: /^(team_slug|team_id)$/i,
    producer: /team|teams/i,
  },
  {
    id: "github_runner",
    param: /^(runner_id)$/i,
    producer: /runner|runners/i,
  },
  {
    id: "github_release",
    param: /^(release_id|tag_name)$/i,
    producer: /release|releases|tag/i,
  },
  {
    id: "github_migration",
    param: /^(migrationId|migration_id)$/i,
    producer: /migration|migrations/i,
  },
  {
    id: "github_project",
    param: /^(project_id|project_number)$/i,
    producer: /project|projects/i,
  },
  {
    id: "gmail_message",
    param: /^(message_id|messageIds|message_ids|attachment_id)$/i,
    producer: /email message|email messages|message|messages|mailbox|attachment/i,
  },
  {
    id: "gmail_thread",
    param: /^(thread_id)$/i,
    producer: /thread|threads/i,
  },
  {
    id: "gmail_label",
    param: /^(label_id|label_ids|labelId|labelIds)$/i,
    producer: /gmail label|label|labels/i,
  },
  {
    id: "gmail_draft",
    param: /^(draft_id)$/i,
    producer: /draft|drafts/i,
  },
  {
    id: "gmail_filter",
    param: /^(filter_id)$/i,
    producer: /filter|filters/i,
  },
  {
    id: "email_address_or_contact",
    param: /^(email|emails|recipient_email|extra_recipients|recipients|to|cc|bcc|send_as_email|from_email)$/i,
    producer: /contact|contacts|people|person|email address|send-as|forwarding address/i,
  },
  {
    id: "google_calendar",
    param: /^(calendar_id|calendarId)$/i,
    producer: /calendar|calendars/i,
  },
  {
    id: "google_calendar_event",
    param: /^(event_id|eventId)$/i,
    producer: /event|events/i,
  },
  {
    id: "google_calendar_acl_rule",
    param: /^(rule_id|ruleId)$/i,
    context: /acl|access control|calendar/i,
    producer: /acl|access control/i,
  },
  {
    id: "google_drive_file",
    param: /^(file_id|fileId|file|id)$/i,
    context: /drive|file|folder|document|sheet|comment|permission/i,
    producer: /drive|file|files|folder|folders|document|spreadsheet/i,
  },
  {
    id: "google_drive_comment",
    param: /^(comment_id|reply_id)$/i,
    context: /drive|file|comment|reply/i,
    producer: /comment|comments|reply|replies/i,
  },
  {
    id: "google_drive_permission",
    param: /^(permission_id|permissionId)$/i,
    producer: /permission|permissions|acl|sharing/i,
  },
  {
    id: "google_spreadsheet",
    param: /^(spreadsheet_id|spreadsheetId)$/i,
    producer: /spreadsheet|spreadsheets|sheet|sheets/i,
  },
  {
    id: "google_sheet_tab",
    param: /^(sheet_id|sheetId|sheet_name)$/i,
    producer: /sheet|sheets|worksheet|tab/i,
  },
  {
    id: "google_document",
    param: /^(document_id|documentId)$/i,
    producer: /document|documents|doc|docs/i,
  },
  {
    id: "google_task_list",
    param: /^(tasklist_id|tasklist)$/i,
    producer: /task list|task lists|tasklist|tasklists/i,
  },
  {
    id: "google_task",
    param: /^(task_id|taskId)$/i,
    producer: /task|tasks/i,
  },
  {
    id: "google_photo_album",
    param: /^(albumId|album_id)$/i,
    producer: /album|albums|photo|photos/i,
  },
];

const PRODUCER_VERBS = /\b(list|search|find|fetch|get|retrieve|create|insert|lookup|query|autocomplete)\b/i;
const WEAK_PRODUCER_VERBS = /\b(update|patch|modify|add|set)\b/i;
const DESTRUCTIVE_VERBS = /\b(delete|remove|abort|cancel|revoke|trash|permanently|disable)\b/i;

const USER_SUPPLIED_INPUTS = new Set([
  "body",
  "content",
  "description",
  "message",
  "query",
  "q",
  "title",
  "text",
  "name",
  "operation",
  "action",
  "criteria",
  "raw",
]);

export function normalizeName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function toolText(tool: NormalizedTool): string {
  return `${tool.slug} ${tool.name} ${tool.description} ${tool.tags.join(" ")}`;
}

export function paramText(param: NormalizedParam): string {
  return `${param.path} ${param.name} ${param.description ?? ""}`;
}

export function resourceForParam(param: NormalizedParam, targetTool: NormalizedTool): string[] {
  const normalizedPath = normalizeName(param.path);
  const context = `${toolText(targetTool)} ${paramText(param)}`;

  return RESOURCE_RULES.filter((rule) => {
    if (!rule.param.test(param.path) && !rule.param.test(normalizedPath)) return false;
    if (rule.context && !rule.context.test(context)) return false;
    return true;
  }).map((rule) => rule.id);
}

export function resourcesForToolText(tool: NormalizedTool): string[] {
  const text = toolText(tool);
  return [...new Set(RESOURCE_RULES.filter((rule) => rule.producer.test(text)).map((rule) => rule.id))];
}

export function isPotentialProducer(tool: NormalizedTool): boolean {
  const text = toolText(tool);
  if (PRODUCER_VERBS.test(text)) return true;
  if (WEAK_PRODUCER_VERBS.test(text) && /create|id|returns|retrieves|provides/i.test(text)) return true;
  return false;
}

export function producerStrength(tool: NormalizedTool): number {
  const text = toolText(tool);
  if (/\b(list|search|find|fetch|retrieve|lookup|autocomplete)\b/i.test(text)) return 4;
  if (/\b(get)\b/i.test(text)) return 3;
  if (/\b(create|insert)\b/i.test(text)) return 2;
  if (WEAK_PRODUCER_VERBS.test(text)) return 1;
  return 0;
}

export function isDestructive(tool: NormalizedTool): boolean {
  return DESTRUCTIVE_VERBS.test(`${tool.slug} ${tool.name}`);
}

export function meaningfulRequiredInputs(tool: NormalizedTool): NormalizedParam[] {
  return tool.requiredInputs.filter((param) => {
    const normalized = normalizeName(param.name);
    if (USER_SUPPLIED_INPUTS.has(normalized)) return false;
    if (/^(body|content|message|text|title|description|query|name)$/i.test(param.path)) return false;
    return true;
  });
}

export function matchableInputs(tool: NormalizedTool): NormalizedParam[] {
  const required = meaningfulRequiredInputs(tool);
  const optionalReferences = tool.optionalInputs.filter((param) => {
    if (resourceForParam(param, tool).length === 0) return false;
    if (/^(user_id|is_html)$/i.test(param.path)) return false;
    return /(_id|Id|number|email|recipient|label|assignee|reviewer|thread|message|file|calendar|spreadsheet|sheet|repo|owner|username|org|branch|ref)/i.test(
      param.path,
    );
  });

  if (required.length > 0) {
    const optionalWithoutGenericEmails = optionalReferences.filter(
      (param) => !resourceForParam(param, tool).includes("email_address_or_contact"),
    );

    return [...required, ...optionalWithoutGenericEmails].filter(
      (param, index, list) => list.findIndex((other) => other.path === param.path) === index,
    );
  }

  // Some Composio tools mark practically required fields as optional. The README's
  // send-email/contact example is one of these cases, so include reference-like
  // optional fields for action tools even when the schema has no required inputs.
  if (/\b(send|create|reply|forward|update|patch|modify|delete|remove|add|insert)\b/i.test(toolText(tool))) {
    return optionalReferences;
  }

  return [];
}

export function resourceLabel(resource: string): string {
  return resource.replace(/_/g, " ");
}
