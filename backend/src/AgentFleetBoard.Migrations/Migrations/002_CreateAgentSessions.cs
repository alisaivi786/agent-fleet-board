using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>Creates agent_sessions: history of real-dispatch `claude` subprocess runs per agent.</summary>
[Migration(202609180002)]
public sealed class M202609180002_CreateAgentSessions : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""
            CREATE TABLE "agent_sessions" (
                "id" uuid NOT NULL PRIMARY KEY,
                "agent_id" uuid NOT NULL REFERENCES "agents" ("id") ON DELETE CASCADE,
                "repo_id" uuid NOT NULL,
                "repo_path" text NOT NULL,
                "prompt" text NOT NULL,
                "status" text NOT NULL,
                "process_id" integer NULL,
                "log_path" text NOT NULL,
                "started_at_utc" timestamp with time zone NOT NULL,
                "ended_at_utc" timestamp with time zone NULL,
                "exit_code" integer NULL
            );
            """);

        Execute.Sql("""
            CREATE INDEX "ix_agent_sessions_agent_id" ON "agent_sessions" ("agent_id");
            """);
    }

    public override void Down()
    {
        Execute.Sql("""DROP TABLE IF EXISTS "agent_sessions";""");
    }
}
