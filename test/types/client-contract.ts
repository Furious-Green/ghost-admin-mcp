import type {GhostClient} from '../../src/client/types';

declare const client: GhostClient;
client.posts.read({id: 'x'});
client.posts.read({}); // Current permissive selectors are retained until issue #6.
client.posts.edit({id: 'x', updated_at: '2026-10-20T00:00:00.000Z'});
// @ts-expect-error Edits require collision-detection timestamps.
client.posts.edit({id: 'x'});
// @ts-expect-error Webhooks have no browse operation.
client.webhooks.browse({});
// @ts-expect-error Resource names are closed, not an arbitrary index signature.
client.nonexistent.read({});
