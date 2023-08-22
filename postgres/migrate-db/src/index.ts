import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import * as pg from "pg";
import Postgrator, { PostgreSQLOptions } from "postgrator";

const database = "giant";

interface PostgresConfig {
  username: string,
  password: string,
}

const connectionPool = (port: number, config: PostgresConfig): pg.Pool => {
  const pool = new pg.Pool({
    user: config.username,
    password: config.password,
    host: "localhost",
    port,
    database,
  });

  return pool;
}

export const getSecretValue = async (secretName: string) => {
  process.env.AWS_PROFILE = 'investigations';
  const client = new SecretsManagerClient({region: "eu-west-1"});
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
  
    if (response.SecretString) {
      const result: PostgresConfig = JSON.parse(response.SecretString);
      return result;
    } else {
      console.error(`Error database secret string is undefined for ${secretName}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Error retrieving database secrets for ${secretName}`, err);
    process.exitCode = 1;
  }
};

const migrate = async (stage: string, port: number, version?: string) => {
  const postgresConfig =
      stage === 'DEV' ?
          {
            dbname: database,
            username: 'giant_master',
            password: 'giant',
          }:
          await getSecretValue(`pfi-giant-postgres-${stage}`);
  
  if (postgresConfig) {
    try {
      console.log("Configuring migration");
      const pool = connectionPool(port, postgresConfig);
      const connection = await pool.connect();
      console.log("db connection succeeded");
      try {
        const postgrator = new Postgrator({
          driver: "pg",
          database,
          migrationPattern: `${__dirname}/migrations/*`,
          execQuery: (query: string) => connection.query(query),
        } as PostgreSQLOptions);
  
        console.log("Starting migration");
        const appliedMigrations = await postgrator.migrate(version);
  
        if (appliedMigrations.length > 0) {
          const migrationList = appliedMigrations
            .map((m) => `${m.action} ${m.version}`)
            .join(", ");
          console.log(
            `Finished migration. Migration(s) applied: ${migrationList}`
          );
          console.log("Starting VACUUM ANALYZE");
          await connection.query("VACUUM ANALYZE");
          console.log("Finished VACUUM ANALYZE");
        } else {
          console.log("No migrations applied");
        }
      } finally {
        connection.release();
      }
    } catch (err) {
      console.log(`Error running migrate-db`, err);
      // Ensure this is logged as an error when running in ECS
      process.exitCode = 1;
    }
  }
};

const stages = ['DEV', 'CODE', 'PROD'] as const;
type Stage = typeof stages[number];
const isStage = (maybeStage: unknown): maybeStage is Stage => {
  //@ts-expect-error -- custom type guard
  return typeof maybeStage === 'string' && stages.includes(maybeStage);
}

const stage = process.env.STAGE || process.argv[2];
const port = process.env.STAGE || process.argv[3];
const version = process.env.VERSION || process.argv[4];

const exitWithMessage = (message: string) => {
  console.error(message);
  process.exitCode = 1;
}

const portNumber = parseInt(port);

if (!isStage(stage))
  exitWithMessage(`Error stage ${stage} is incorrect! Acceptable values are ${stages}`);
else if (isNaN(portNumber))
  exitWithMessage(`Error port ${port} is incorrect!`);
else {
  console.log(`Migrating DB in stage ${stage} to version ${version} using port ${port}`);
  migrate(stage, portNumber, version);
}


