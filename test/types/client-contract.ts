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
client.posts.read({}); // Raw-shape optional selectors: exactly-one is enforced at runtime.
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
client.posts.edit({id: 'x', updated_at: '2026-10-21T00:00:00Z', custom_template: null, published_at: null, save_revision: false, tiers: []});
client.pages.add({title: 'A', show_title_and_feature_image: false, mobiledoc: '{}'});
client.tags.edit({id: 'x', feature_image: null, accent_color: null});
client.posts.browse({limit: 'all', formats: 'html,plaintext'});
// @ts-expect-error Pages cannot have sent status.
client.pages.add({title: 'A', status: 'sent'});
// @ts-expect-error Unknown post statuses cannot be written.
client.posts.add({title: 'A', status: 'ready'});
// @ts-expect-error Booleans do not accept null clearing.
client.posts.edit({id: 'x', updated_at: '2026-10-21T00:00:00Z', featured: null});
// @ts-expect-error Tags have no content formats.
client.tags.browse({formats: 'html'});
client.members.browse({limit: 'all', include: 'tiers', fields: 'id,email', search: 'Ada'});
client.users.read({email: 'name+tag@example.invalid', include: 'roles', fields: 'id,name'});
client.users.edit({id: 'me', bio: null, include: 'roles'});
client.newsletters.edit({id: 'one', sender_email: null, header_image: null, show_badge: false, status: 'archived'});
client.webhooks.edit({id: 'one', secret: null});
// @ts-expect-error Member name cannot be cleared with null.
client.members.edit({id: 'one', name: null});
// @ts-expect-error Newsletter status is a supported enum, not arbitrary text.
client.newsletters.edit({id: 'one', status: 'inactive'});
// @ts-expect-error Font choices are explicit.
client.newsletters.add({name: 'A', title_font_category: 'comic'});
// @ts-expect-error Member reads do not support fields.
client.members.read({id: 'one', fields: 'id'});
// @ts-expect-error Admin tier endpoints do not support include.
client.tiers.read({id: 'one', include: 'benefits'});
// @ts-expect-error Offer cadence is month/year only.
client.offers.add({name: 'A', code: 'a', cadence: 'week', duration: 'once', amount: 10, tier_id: 'one', type: 'percent'});
