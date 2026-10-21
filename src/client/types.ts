import type {ToolInputs as PostInputs} from '../tools/posts';
import type {ToolInputs as PageInputs} from '../tools/pages';
import type {ToolInputs as MemberInputs} from '../tools/members';
import type {ToolInputs as UserInputs} from '../tools/users';
import type {ToolInputs as TagInputs} from '../tools/tags';
import type {ToolInputs as TierInputs} from '../tools/tiers';
import type {ToolInputs as OfferInputs} from '../tools/offers';
import type {ToolInputs as NewsletterInputs} from '../tools/newsletters';
import type {ToolInputs as InviteInputs} from '../tools/invites';
import type {ToolInputs as RoleInputs} from '../tools/roles';
import type {ToolInputs as WebhookInputs} from '../tools/webhooks';
import type {LabelInputs} from '../schemas/labels';
import type {CollectionResponse, EntityResponse} from './responses';
export type {GhostResponse, CollectionResponse, EntityResponse} from './responses';

export type GhostConfig = {url: string; key: string; version: string};
export type QueryOptions = Record<string, string | number | boolean | undefined>;
export type GhostEntity = Record<string, unknown>;
export type GhostMetadata = Record<string, unknown>;
export type GhostResult = EntityResponse | CollectionResponse | undefined;
export type OperationResult<K> = K extends 'browse' ? CollectionResponse : K extends 'delete' ? undefined : EntityResponse;
export type CopyInput = {id: string; formats?: string};
export type CopyOperation = (input: CopyInput) => Promise<EntityResponse>;
export type ResourceClient<Inputs> = {
    [Key in keyof Inputs]: (input: Inputs[Key], options?: QueryOptions) => Promise<OperationResult<Key>>;
};

export interface GhostClient {
    posts: ResourceClient<PostInputs> & {copy: CopyOperation};
    pages: ResourceClient<PageInputs> & {copy: CopyOperation};
    members: ResourceClient<MemberInputs>;
    users: ResourceClient<UserInputs>;
    tags: ResourceClient<TagInputs>;
    tiers: ResourceClient<TierInputs>;
    offers: ResourceClient<OfferInputs>;
    newsletters: ResourceClient<NewsletterInputs>;
    invites: ResourceClient<InviteInputs>;
    roles: ResourceClient<RoleInputs>;
    webhooks: ResourceClient<WebhookInputs>;
    labels: ResourceClient<LabelInputs>;
}

export type SdkRequest = {
    url: string;
    method: string;
    data?: unknown;
    params?: QueryOptions;
    headers?: Record<string, string>;
};
export type RequestExecutor = (request: SdkRequest) => Promise<unknown>;
