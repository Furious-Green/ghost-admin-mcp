exports.config = {
  url: 'http://127.0.0.1:1',
  key: `${'0'.repeat(24)}:${'0'.repeat(64)}`,
  version: 'v5.0',
};
exports.timestamp = '2026-10-20T00:00:00.000Z';
exports.entity = {id: 'abc123', title: 'Example', updated_at: exports.timestamp};
exports.pagination = {page: 1, limit: 15, pages: 2, total: 16, next: 2, prev: null};

// Hand-selected inputs: this is not imported from the implementation's schemas.
exports.families = {
  posts: {browse: {}, read: {id: 'abc123'}, add: {title: 'Example'}, edit: {id: 'abc123', title: 'Changed', updated_at: exports.timestamp}, delete: {id: 'abc123'}},
  members: {browse: {}, read: {id: 'abc123'}, add: {email: 'member@example.invalid'}, edit: {id: 'abc123', name: 'Changed'}, delete: {id: 'abc123'}},
  users: {browse: {}, read: {id: 'abc123'}, edit: {id: 'abc123', name: 'Changed'}, delete: {id: 'abc123'}},
  tags: {browse: {}, read: {id: 'abc123'}, add: {name: 'Example'}, edit: {id: 'abc123', name: 'Changed'}, delete: {id: 'abc123'}},
  newsletters: {browse: {}, read: {id: 'abc123'}, add: {name: 'Example'}, edit: {id: 'abc123', name: 'Changed'}, delete: {id: 'abc123'}},
  webhooks: {add: {event: 'post.added', target_url: 'https://receiver.invalid/hook'}, edit: {id: 'abc123', name: 'Changed'}, delete: {id: 'abc123'}},
  tiers: {browse: {}, read: {id: 'abc123'}, add: {name: 'Example'}, edit: {id: 'abc123', name: 'Changed'}},
  offers: {browse: {}, read: {id: 'abc123'}, add: {name: 'Example', code: 'example', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'}, edit: {id: 'abc123', name: 'Changed'}},
  invites: {browse: {}, add: {role_id: 'role1', email: 'staff@example.invalid'}, delete: {id: 'abc123'}},
  roles: {browse: {}},
};
exports.backedFamilies = ['posts', 'members', 'users', 'tags', 'newsletters', 'webhooks'];
exports.toolNames = Object.entries(exports.families).flatMap(([family, operations]) => Object.keys(operations).map(op => `${family}_${op}`)).sort();
exports.additionalToolNames = ['pages_add', 'pages_browse', 'pages_copy', 'pages_delete', 'pages_edit', 'pages_read', 'posts_copy'];
exports.permissionError = function permissionError() {
  const error = new Error('Request failed with status code 403');
  error.request = {headers: {Authorization: `Ghost ${exports.config.key}`}};
  error.config = {key: exports.config.key};
  error.response = {status: 403, data: {errors: [{message: 'Permission denied', type: 'NoPermissionError', context: 'This integration cannot perform this action'}]}};
  return error;
};
