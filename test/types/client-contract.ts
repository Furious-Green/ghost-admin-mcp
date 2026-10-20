import type {GhostClient} from '../../src/client/types';

declare const client: GhostClient;
client.posts.copy({id: 'x'});
client.pages.copy({id: 'x', formats: 'html'});
// @ts-expect-error Copy requires an ID.
client.pages.copy({});
// @ts-expect-error No invented member copy operation.
client.members.copy({id: 'x'});
client.pages.read({slug: 'about'});
client.pages.edit({id: 'x', updated_at: '2026-10-20T00:00:00.000Z'});
// @ts-expect-error Page edits also require collision-detection timestamps.
client.pages.edit({id: 'x'});
// @ts-expect-error Pages expose no invented operations.
client.pages.publish({id: 'x'});
client.posts.read({id: 'x'});
client.posts.read({}); // Current permissive selectors are retained until issue #6.
client.posts.edit({id: 'x', updated_at: '2026-10-20T00:00:00.000Z'});
// @ts-expect-error Edits require collision-detection timestamps.
client.posts.edit({id: 'x'});
// @ts-expect-error Webhooks have no browse operation.
client.webhooks.browse({});
// @ts-expect-error Resource names are closed, not an arbitrary index signature.
client.nonexistent.read({});
