# Super Admin Module

## User management (`/api/v1/users`)

| Method | Path   | Permission     | Notes                                                                       |
| ------ | ------ | -------------- | --------------------------------------------------------------------------- |
| GET    | `/`    | `users:read`   | Paginated; `search` (email/name), `role`, `status` filters                  |
| POST   | `/`    | `users:create` | Initial password must meet the policy; audited                              |
| PATCH  | `/:id` | `users:update` | Name, role, status; role change / deactivation revoke the target's sessions |
| DELETE | `/:id` | `users:delete` | Soft delete; sessions revoked; audited                                      |

Safety guards enforced in the service layer:

- Only a super admin can assign the super-admin role or manage
  super-admin accounts (privilege-escalation guard).
- The last active super admin can never be deactivated, demoted, or
  deleted.
- Users cannot deactivate or delete their own account.

## Role management (`/api/v1/roles`)

- `GET /` (`roles:read`) — all roles with their permission sets, the full
  permission catalog, and per-role user counts.
- `PUT /:id/permissions` (`roles:manage`) — replace a role's permission
  set. Keys are validated against the catalog. The super-admin role is
  immutable and always holds every permission.

Because `authenticate` loads the user (and role) from the database on
every request, permission-matrix changes take effect immediately.

## Audit & login history

- `GET /api/v1/audit-logs` (`audit-logs:read`) — paginated; `action`,
  `actorId`, `from`, `to` filters; actor email populated.
- `GET /api/v1/login-history` (`login-history:read`) — paginated; `email`
  and `success` filters.

## SMTP settings (`/api/v1/settings/smtp`)

Requires `settings:manage`. Stored in the `SystemSettings` collection
(key `smtp`). The password is masked (`********`) in every API response;
submitting the mask back preserves the stored value. When `enabled` with
a host, the mail service (password reset emails) sends through Nodemailer;
otherwise it logs the message and the flows continue to work.

## Admin UI

- `/admin/users` — search, pagination, create form, inline role change,
  activate/deactivate, delete. Self-targeting actions are disabled.
- `/admin/roles` — permission matrix with checkboxes per role.
- `/admin/audit-logs` — paginated audit trail.

Navigation items and pages are gated by the same permission keys the API
enforces (`RequirePermission` component + sidebar filtering).

## Remaining Phase 3 scope

Company/site management, API keys, security policy configuration,
backups, and monitoring dashboards are tracked in `PROJECT_MEMORY.md` as
pending Phase 3 items.
