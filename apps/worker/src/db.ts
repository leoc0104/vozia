import postgres, { type Sql } from 'postgres'

export type { Sql }

/** Direct Postgres connection (use Supabase's session pooler URL). `prepare: false` also works behind the transaction pooler. */
export function createSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 4, prepare: false, onnotice: () => undefined })
}
