using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>
/// Project.BaseBranch is descriptive metadata only (e.g. "this project's work targets develop") -
/// it is NOT wired into ahead/behind computation. That still comes from each repo's own
/// RepoDefinition.BaseBranch (set at repo-registration time), because agents in the same project
/// commonly run against different repos/worktrees - see Project.cs and the 004 migration for why
/// a project can't authoritatively own "the" base branch any more than it owns "the" repo.
/// </summary>
[Migration(202609180005)]
public sealed class M202609180005_AddProjectBaseBranch : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""ALTER TABLE "projects" ADD COLUMN "base_branch" text NULL;""");
    }

    public override void Down()
    {
        Execute.Sql("""ALTER TABLE "projects" DROP COLUMN IF EXISTS "base_branch";""");
    }
}
