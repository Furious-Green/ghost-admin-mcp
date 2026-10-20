import type {GhostClient} from '../../src/client/types';
import type {CollectionResponse, EntityResponse} from '../../src/client/responses';

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
// @ts-expect-error Tiers cannot be deleted; explicitly edit active instead.
client.tiers.delete({id: 'x'});
// @ts-expect-error Offers cannot be deleted; explicitly edit status instead.
client.offers.delete({id: 'x'});
// @ts-expect-error Tier reads require ID, not slug.
client.tiers.read({slug: 'paid'});
// @ts-expect-error Offer reads require ID, not code.
client.offers.read({code: 'sale'});
client.tiers.edit({id: 'x', active: false});
client.offers.edit({id: 'x', status: 'archived'});
// @ts-expect-error Roles expose browse only.
client.roles.read({id: 'x'});
// @ts-expect-error Roles are not paginated.
client.roles.browse({page: 1});
// @ts-expect-error Offers are not paginated.
client.offers.browse({page: 1});
client.roles.browse({permissions: 'assign'});
// @ts-expect-error Invites do not expose a read tool.
client.invites.read({id: 'x'});
const collection: Promise<CollectionResponse> = client.posts.browse({});
const entity: Promise<EntityResponse> = client.posts.read({id: 'x'});
const added: Promise<EntityResponse> = client.offers.add({name: 'x', code: 'x', cadence: 'month', duration: 'once', amount: 10, tier_id: 'x', type: 'percent'});
const edited: Promise<EntityResponse> = client.tiers.edit({id: 'x', active: false});
const copied: Promise<EntityResponse> = client.pages.copy({id: 'x'});
const deleted: Promise<undefined> = client.invites.delete({id: 'x'});
// @ts-expect-error Browse responses are explicit envelopes, not bare arrays.
const bare: Promise<unknown[]> = client.posts.browse({});
// @ts-expect-error Entity responses are not collection responses.
const wrongCollection: Promise<CollectionResponse> = client.posts.read({id: 'x'});
// @ts-expect-error Delete cannot pretend to return entity data.
const wrongDelete: Promise<EntityResponse> = client.posts.delete({id: 'x'});
