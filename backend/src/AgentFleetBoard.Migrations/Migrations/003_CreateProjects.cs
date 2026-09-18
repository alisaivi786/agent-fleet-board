using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>
/// Projects group agents under a single bound repo - an agent assigned to a project is always
/// pointed at that project's repo (see AgentRegistry.AssignProjectAsync), not an arbitrary one.
/// </summary>
[Migration(202609180003)]
public sealed class M202609180003_CreateProjects : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""
            CREATE TABLE "projects" (
                "id" uuid NOT NULL PRIMARY KEY,
                "name" text NOT NULL UNIQUE,
                "repo_id" uuid NOT NULL REFERENCES "repos" ("id") ON DELETE CASCADE
            );
            """);

        Execute.Sql("""
            ALTER TABLE "agents" ADD COLUMN "project_id" uuid NULL REFERENCES "projects" ("id") ON DELETE SET NULL;
            """);

        Execute.Sql("""
            CREATE INDEX "ix_agents_project_id" ON "agents" ("project_id");
            """);
    }

    public override void Down()
    {
        Execute.Sql("""ALTER TABLE "agents" DROP COLUMN IF EXISTS "project_id";""");
        Execute.Sql("""DROP TABLE IF EXISTS "projects";""");
    }
}
