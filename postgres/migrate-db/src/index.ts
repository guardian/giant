import * as pg from "pg";
import Postgrator, { PostgreSQLOptions } from "postgrator";

const database = "giant"

const pool = new pg.Pool({
  user: "giant_master",
  password: "giant",
  host: "localhost",
  port: 8432,
  database,
});

const migrate = async (version?: string) => {
  try {
    console.log("Configuring migration");
    const connection = await pool.connect();
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
};

const version = process.env.VERSION || process.argv[2];
console.log(`Migrating DB to version ${version}`);
migrate(version);
