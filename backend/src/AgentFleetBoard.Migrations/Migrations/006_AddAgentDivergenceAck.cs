using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>
/// Lets a user acknowledge a known "Diverged" state (ahead of base / already committed) without
/// unassigning the repo - unassigning was the wrong tool for this because it stops tracking the
/// repo entirely, and re-assigning the same repo just shows the exact same Diverged status again
/// since nothing about the repo actually changed. Acknowledgement is scoped to one specific commit:
/// AgentRegistry clears it whenever the repo assignment changes (AssignAsync/UnassignAsync), and
/// Program.cs's GET /api/agents only treats it as still valid when the agent's current
/// LastCommitHash still matches AND the working tree is clean - any new commit or new uncommitted
/// file re-arms the real Diverged status automatically. This stays honest (see CLAUDE.md's rule
/// that git-derived status is never faked): it's not hiding real divergence, it's remembering that
/// a human already reviewed this exact, unchanged state.
/// </summary>
[Migration(202609210006)]
public sealed class M202609210006_AddAgentDivergenceAck : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""ALTER TABLE "agents" ADD COLUMN "diverged_ack_commit_hash" text NULL;""");
    }

    public override void Down()
    {
        Execute.Sql("""ALTER TABLE "agents" DROP COLUMN IF EXISTS "diverged_ack_commit_hash";""");
    }
}
