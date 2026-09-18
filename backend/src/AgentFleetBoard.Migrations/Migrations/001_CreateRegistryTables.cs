using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>Creates the repos/agents registry tables that replaced the old JSON-file registry.</summary>
[Migration(202609180001)]
public sealed class M202609180001_CreateRegistryTables : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""
            CREATE TABLE "repos" (
                "id" uuid NOT NULL PRIMARY KEY,
                "name" text NOT NULL,
                "path" text NOT NULL,
                "base_branch" text NOT NULL
            );
            """);

        Execute.Sql("""
            CREATE TABLE "agents" (
                "id" uuid NOT NULL PRIMARY KEY,
                "name" text NOT NULL,
                "role" text NOT NULL,
                "assigned_repo_id" uuid NULL
                    REFERENCES "repos" ("id") ON DELETE SET NULL
            );
            """);
    }

    public override void Down()
    {
        Execute.Sql("""
            DROP TABLE IF EXISTS "agents";
            DROP TABLE IF EXISTS "repos";
            """);
    }
}
