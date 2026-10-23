/** Zod schema of the committed snapshot (spec section 3) and its parse helper. */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.-]+Z)?$/, "expected YYYY-MM-DD or ISO 8601");
const nullable = <T extends z.ZodType>(inner: T): z.ZodType => z.union([inner, z.null()]);

/** Null, never 0 or [], when GitHub did not provide a value (spec section 3). */
const StatisticsSchema = z.strictObject({
  commitActivity: nullable(z.array(z.number().int().nonnegative()).max(52)),
  codeFrequency: nullable(z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()]))),
  punchCard: nullable(
    z.array(
      z
        .tuple([z.number().int(), z.number().int(), z.number().int()])
        .refine(([weekday, hour]) => weekday >= 0 && weekday <= 6 && hour >= 0 && hour <= 23, {
          message: "weekday must be 0..6 and hour must be 0..23",
        }),
    ),
  ),
});

const CommitRecordSchema = z.strictObject({
  sha: z.string().min(7),
  date: z.string().min(10),
  message: z.string(),
  body: z.string(),
  filesChanged: z.optional(z.number().int().nonnegative()),
  additions: z.optional(z.number().int().nonnegative()),
  deletions: z.optional(z.number().int().nonnegative()),
  isMerge: z.boolean(),
  parents: z.number().int().nonnegative(),
});

const ManifestPointSchema = z.strictObject({
  sha: z.string().min(7),
  date: z.string().min(10),
  deps: z.array(z.string()),
  devDeps: z.array(z.string()),
  scripts: z.array(z.string()),
  engines: z.optional(z.record(z.string(), z.string())),
});

const RepoSnapshotSchema = z
  .strictObject({
    name: z.string().min(1),
    isFork: z.boolean(),
    isArchived: z.boolean(),
    isPrivate: z.boolean(),
    createdAt: isoDate,
    pushedAt: isoDate,
    primaryLanguage: nullable(z.string()),
    languages: z.record(z.string(), z.number().int().nonnegative()),
    stars: z.number().int().nonnegative(),
    forks: z.number().int().nonnegative(),
    releases: z.array(z.strictObject({ tag: z.string(), publishedAt: isoDate })),
    stats: StatisticsSchema,
    commits: z.union(
      [
        z.array(CommitRecordSchema),
        z.strictObject({
          truncated: z.literal(true),
          count: z.number().int().nonnegative(),
          sampled: z.array(CommitRecordSchema),
        }),
      ],
      { message: "commits must be an array or a truncated marker" },
    ),
    manifests: z.array(ManifestPointSchema),
    fileStats: z.optional(
      z.strictObject({
        loc: z.number(),
        files: z.number(),
        testFiles: z.number(),
        topDirs: z.array(z.strictObject({ path: z.string(), bytes: z.number() })),
      }),
    ),
  })
  .refine((repo) => !repo.isPrivate || repo.name.startsWith("private-"), {
    message: "private repos must be anonymized to private-<n>",
  });

const ProfileSchema = z.strictObject({
  login: z.string().min(1),
  name: nullable(z.string()),
  company: nullable(z.string()),
  bio: nullable(z.string()),
  blog: nullable(z.string()),
  location: nullable(z.string()),
  createdAt: isoDate,
  publicRepos: z.number().int().nonnegative(),
  followers: z.number().int().nonnegative(),
  following: z.number().int().nonnegative(),
});

const SearchEventsSchema = z.strictObject({
  prs: z.strictObject({ totalCount: nullable(z.number().int().nonnegative()) }),
  issues: z.strictObject({ totalCount: nullable(z.number().int().nonnegative()) }),
});

const CollectionNoteSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  at: nullable(z.string()),
});

/** The full snapshot schema committed under data/snapshot/. */
export const SnapshotSchema = z.strictObject({
  meta: z.strictObject({
    username: z.string().min(1),
    collectedAt: z.string().min(10),
    range: z.strictObject({ from: isoDate, to: isoDate }),
    timezone: z.string().min(1),
    includePrivate: z.boolean(),
    generatorVersion: z.string().min(1),
    source: z.union([z.literal("api"), z.literal("api+git")], { message: 'source must be "api" or "api+git"' }),
  }),
  profile: ProfileSchema,
  repos: z.array(RepoSnapshotSchema),
  events: SearchEventsSchema,
  notes: z.array(CollectionNoteSchema),
});

/** Parsed snapshot value type. */
export type Snapshot = z.output<typeof SnapshotSchema>;

/** One manifest history point (used by parse-manifests and its callers). */
export type ManifestPoint = z.output<typeof ManifestPointSchema>;

/** Usage hint printed by validate-snapshot.ts. */
export const USAGE_VALIDATE = "usage: npm run data:validate [--file data/snapshot/latest.json]";

/**
 * Validate a snapshot parsed from JSON and return its typed value.
 * @param value - a JSON-decoded candidate snapshot
 * @returns the validated snapshot
 * @throws Error with field paths when validation fails
 */
export function parseSnapshot(value: unknown): Snapshot {
  const result = SnapshotSchema.safeParse(value);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Snapshot validation failed:${issues ? " " + issues : ""}`);
  }

  return result.data;
}
